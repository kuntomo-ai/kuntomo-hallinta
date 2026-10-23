// Siivous-cronityö: luo automaattiset päiväkirjaukset (siivous_day_logs)
// Schedule: 30 3 * * * UTC = klo 5:30 Helsingissä (talvi) / 6:30 (kesä)
// Käyttää service_rolea — ohittaa RLS-säännöt.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { requireCron } from '../_lib/auth.js'

function getFinnishDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(new Date())
}

function getFinnishDayOfWeek() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
    weekday: 'short',
  }).formatToParts(new Date())
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[parts.find(p => p.type === 'weekday')?.value] ?? new Date().getDay()
}

function getFinnishMonthAndDay() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Helsinki',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())
  return {
    month: parseInt(parts.find(p => p.type === 'month')?.value ?? '1'),
    day:   parseInt(parts.find(p => p.type === 'day')?.value   ?? '1'),
  }
}

export default async function handler(req, res) {
  if (!requireCron(req, res)) return

  const today = getFinnishDate()
  const dow   = getFinnishDayOfWeek()
  const { month, day } = getFinnishMonthAndDay()
  const isDeepCleanMonth = month === 1 || month === 7

  const result = { date: today, dow, locations: [] }

  try {
    const { data: locations, error: locErr } = await supabaseAdmin
      .from('siivous_locations')
      .select('id, name, siivous_days, tarkistus_days')
      .eq('is_active', true)

    if (locErr) throw locErr

    for (const loc of locations) {
      const locResult = { id: loc.id, name: loc.name, logs: [] }

      const types = []
      if ((loc.siivous_days   || []).includes(dow)) types.push('siivous')
      if ((loc.tarkistus_days || []).includes(dow)) types.push('tarkistus')

      if (types.length === 0) {
        locResult.skipped = 'not scheduled today'
        result.locations.push(locResult)
        continue
      }

      // Tarkista onko poikkeuspäivä ennalta merkittynä
      const { data: closedDay, error: closedErr } = await supabaseAdmin
        .from('siivous_closed_days')
        .select('reason')
        .eq('location_id', loc.id)
        .eq('closed_date', today)
        .maybeSingle()
      if (closedErr) throw closedErr

      const status = closedDay ? 'poikkeuspäivä' : 'aikataulun_mukainen'

      for (const logType of types) {
        // Idempotentti: tarkista olemassa oleva kirjaus
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from('siivous_day_logs')
          .select('id')
          .eq('location_id', loc.id)
          .eq('log_date', today)
          .eq('log_type', logType)
          .maybeSingle()
        if (existingErr) throw existingErr

        let logId = existing?.id ?? null

        if (existing) {
          // Kirjaus löytyy — tarkista onko tehtävät jo lisätty
          const { data: existingItems, error: existingItemsErr } = await supabaseAdmin
            .from('siivous_day_log_items')
            .select('id')
            .eq('log_id', existing.id)
            .limit(1)
          if (existingItemsErr) throw existingItemsErr

          if (existingItems?.length > 0) {
            locResult.logs.push({ type: logType, status: 'already_exists', id: existing.id })
            continue
          }
          // Kirjaus olemassa mutta tehtävät puuttuvat (aiempi ajo keskeytyi) — täydennä
        } else {
          // Luo uusi päiväkirjaus
          const { data: newLog, error: logErr } = await supabaseAdmin
            .from('siivous_day_logs')
            .insert({
              location_id:      loc.id,
              log_date:         today,
              log_type:         logType,
              entry_type:       'auto',
              status,
              created_by_type:  'system',
              created_by_name:  'Järjestelmä',
              notes:            closedDay?.reason ?? null,
            })
            .select('id')
            .single()
          if (logErr) throw logErr
          logId = newLog.id
        }

        // Hae tänään aikataulutetut tehtävät
        const { data: allTasks, error: taskErr } = await supabaseAdmin
          .from('siivous_tasks')
          .select('id, room, task_name, schedule_type, schedule_day, sort_order')
          .eq('location_id', loc.id)
          .eq('signoff_type', logType)
          .eq('is_active', true)
          .order('sort_order')
        if (taskErr) throw taskErr

        if (!allTasks?.length) {
          locResult.logs.push({ type: logType, status: existing ? 'filled_no_tasks' : 'created_no_tasks', id: logId })
          continue
        }

        // Selvitä mitkä kuukausitehtävät on jo tämän kuun aikataulun mukaisissa kirjauksissa
        // (poikkeuspäivät jätetään huomiotta, jotta tehtävät siirtyvät seuraavalle siivouskerralle)
        const monthStart = today.slice(0, 7) + '-01'
        const { data: monthLogs, error: monthLogsErr } = await supabaseAdmin
          .from('siivous_day_logs')
          .select('id')
          .eq('location_id', loc.id)
          .eq('log_type', logType)
          .eq('status', 'aikataulun_mukainen')
          .gte('log_date', monthStart)
          .lt('log_date', today)
        if (monthLogsErr) throw monthLogsErr

        const monthLogIds = (monthLogs || []).map(l => l.id)
        const doneThisMonth = new Set()

        if (monthLogIds.length > 0) {
          const { data: prevItems, error: prevItemsErr } = await supabaseAdmin
            .from('siivous_day_log_items')
            .select('task_id')
            .in('log_id', monthLogIds)
          if (prevItemsErr) throw prevItemsErr
          for (const item of (prevItems || [])) {
            if (item.task_id) doneThisMonth.add(item.task_id)
          }
        }

        // Suodata tämän päivän tehtävät aikataulusäännön mukaan
        const filtered = allTasks.filter(t => {
          if (t.schedule_type === 'daily')      return true
          if (t.schedule_type === 'weekly')     return t.schedule_day === dow
          if (t.schedule_type === 'monthly')    return !doneThisMonth.has(t.id)
          if (t.schedule_type === 'deep_clean') return isDeepCleanMonth && !doneThisMonth.has(t.id)
          return false
        })

        if (filtered.length > 0) {
          const items = filtered.map(t => ({
            log_id:     logId,
            task_id:    t.id,
            task_name:  t.task_name,
            room:       t.room,
            sort_order: t.sort_order,
          }))
          const { error: itemErr } = await supabaseAdmin
            .from('siivous_day_log_items')
            .insert(items)
          if (itemErr) throw itemErr
        }

        locResult.logs.push({ type: logType, status: existing ? 'filled' : 'created', id: logId, taskCount: filtered.length })
      }

      result.locations.push(locResult)
    }

    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    console.error('[siivous-daily]', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
