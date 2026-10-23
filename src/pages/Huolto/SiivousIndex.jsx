import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react'

const DAYS_FI = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La']
// Viikkonäkymä: Ma…Su (display-indeksi 0–6 → dow 1–6,0)
const WEEK_DISPLAY = [1, 2, 3, 4, 5, 6, 0]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekDates() {
  const now = new Date()
  const dow = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  mon.setHours(0, 0, 0, 0)
  return WEEK_DISPLAY.map((_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function formatDate(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr + 'T00:00:00').toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

// ── Viikkoruudukko per toimipiste ─────────────────────────────────────────────

function WeekStrip({ loc, weekDates, weekLogs }) {
  const today = todayISO()
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {WEEK_DISPLAY.map((dow, idx) => {
        const date = weekDates[idx]
        const isScheduled = (loc.siivous_days || []).includes(dow)
        const hasLog = weekLogs.some(l => l.log_date === date)
        const isPast    = date < today
        const isToday   = date === today
        const isFuture  = date > today

        let bg = 'var(--bg2)'
        let color = 'var(--text3)'
        let title = ''

        if (!isScheduled) {
          bg = 'transparent'
          color = 'var(--border)'
        } else if (hasLog) {
          bg = '#DCFCE7'
          color = 'var(--green)'
          title = 'Kirjaus olemassa'
        } else if (isToday) {
          bg = '#FEF9C3'
          color = '#92400E'
          title = 'Tänään — odottaa kirjausta'
        } else if (isPast) {
          bg = '#FEF2F2'
          color = 'var(--red)'
          title = 'Kirjaus puuttuu'
        } else if (isFuture) {
          bg = 'var(--bg2)'
          color = 'var(--text3)'
          title = 'Tuleva'
        }

        return (
          <div
            key={dow}
            title={title}
            style={{
              flex: 1, textAlign: 'center', borderRadius: 6,
              padding: '4px 2px', fontSize: '.65rem', fontWeight: isScheduled ? 700 : 400,
              background: bg, color,
              border: `1px solid ${isToday && isScheduled ? '#FDE68A' : 'transparent'}`,
            }}
          >
            {DAYS_FI[dow]}
            <div style={{ marginTop: 2, fontSize: '1rem', lineHeight: 1 }}>
              {!isScheduled ? '·'
                : hasLog ? '✓'
                : isPast ? '✗'
                : isToday ? '○'
                : '·'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Toimipistekortti ──────────────────────────────────────────────────────────

function LocationCard({ loc, weekDates, weekLogs, lastInspection, openFaults }) {
  const missedThisWeek = WEEK_DISPLAY.filter((dow, idx) => {
    const date = weekDates[idx]
    const scheduled = (loc.siivous_days || []).includes(dow)
    return scheduled && date < todayISO() && !weekLogs.some(l => l.log_date === date)
  }).length

  return (
    <Link to={`/huolto/siivous/${loc.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          background: 'var(--bg)',
          border: `1px solid ${missedThisWeek > 0 ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '1.1rem 1.25rem',
          display: 'flex', flexDirection: 'column', gap: '.75rem',
          cursor: 'pointer', transition: 'box-shadow .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>
            {loc.name}
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
        </div>

        {missedThisWeek > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--red)', fontSize: '.8rem', fontWeight: 700, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '.3rem .6rem' }}>
            <AlertTriangle size={14} />
            {missedThisWeek} kirjaus puuttuu tältä viikolta
          </div>
        )}

        <WeekStrip loc={loc} weekDates={weekDates} weekLogs={weekLogs} />

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', color: 'var(--text3)' }}>
            <Clock size={12} />
            {lastInspection
              ? <span>Tarkastus {formatDate(lastInspection.inspection_date)}</span>
              : <span>Ei tarkastuksia</span>}
          </div>
          {openFaults > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', color: 'var(--red)', fontWeight: 600 }}>
              <AlertTriangle size={12} />
              {openFaults} avoin{openFaults !== 1 ? 'ta' : ''} vika{openFaults !== 1 ? 'a' : ''}
            </div>
          )}
          {loc.scheduled_by && (
            <div style={{ color: 'var(--text3)' }}>{loc.scheduled_by}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Pääkomponentti ────────────────────────────────────────────────────────────

export default function SiivousIndex() {
  const { profile, isAdmin, isSiivooja, isValvoja } = useAuth()
  const [locations, setLocations]         = useState([])
  const [weekLogs, setWeekLogs]           = useState({})   // slug → log[]
  const [lastInspections, setLastInspections] = useState({}) // slug → inspection
  const [openFaults, setOpenFaults]       = useState({})   // slug → count
  const [loading, setLoading]             = useState(true)

  const weekDates = getWeekDates()
  const weekMon   = weekDates[0]
  const weekSun   = weekDates[6]
  const isRestricted = (isSiivooja || isValvoja) && !isAdmin

  useEffect(() => { load() }, [profile])

  async function load() {
    setLoading(true)
    try {
      const { data: locs } = await supabase
        .from('siivous_locations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (!locs?.length) { setLocations([]); return }

      const accessible = isRestricted
        ? locs.filter(l => (profile?.location_access || []).includes(l.slug))
        : locs

      setLocations(accessible)

      const locIds = accessible.map(l => l.id)

      const [
        { data: logs },
        { data: inspections },
        { data: faults },
      ] = await Promise.all([
        supabase.from('siivous_day_logs')
          .select('location_id, log_date, log_type, status')
          .in('location_id', locIds)
          .eq('log_type', 'siivous')
          .gte('log_date', weekMon)
          .lte('log_date', weekSun),
        supabase.from('siivous_inspections')
          .select('location_id, inspection_date')
          .in('location_id', locIds)
          .order('inspection_date', { ascending: false }),
        supabase.from('siivous_faults')
          .select('location_id')
          .in('location_id', locIds)
          .in('status', ['avoin', 'työn alla']),
      ])

      const logsMap = {}
      const insMap  = {}
      const faultMap = {}

      for (const loc of accessible) {
        logsMap[loc.slug]  = (logs || []).filter(l => l.location_id === loc.id)
        insMap[loc.slug]   = (inspections || []).find(i => i.location_id === loc.id) || null
        faultMap[loc.slug] = (faults || []).filter(f => f.location_id === loc.id).length
      }

      setWeekLogs(logsMap)
      setLastInspections(insMap)
      setOpenFaults(faultMap)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Siivous</h1>
          <p className="page-subtitle">Automaattiset päiväkirjaukset toimipisteittäin</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>
      ) : locations.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: '.85rem', padding: '2rem', textAlign: 'center' }}>
          {isRestricted
            ? 'Sinulle ei ole vielä määritetty toimipisteitä. Pyydä ylläpitäjää päivittämään profiilisi.'
            : 'Ei aktiivisia toimipisteitä.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', maxWidth: 960 }}>
          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              weekDates={weekDates}
              weekLogs={weekLogs[loc.slug] || []}
              lastInspection={lastInspections[loc.slug]}
              openFaults={openFaults[loc.slug] || 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
