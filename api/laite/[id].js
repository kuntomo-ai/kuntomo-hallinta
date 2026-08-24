// Public endpoint for QR-code fault reports. Ei vaadi kirjautumista.
// GET: palauttaa laitteen perustiedot (name, model, sijainti, device_number, ohjevideo_url)
// POST: lähettää vikailmoituksen (luo laite_huoltohistoria + tasks -rivit, päivittää service_requested)
//
// Kutsu server-puolella jotta service_role -avain ei paljastu selaimessa.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js'
import { rateLimit, clientIp } from '../_lib/rateLimit.js'

// Duplikoitu client-lib/salivastaava.js:sta jotta ei tarvi kääntää server-tietoja.
function salivastaavaRole(sijainti) {
  const s = (sijainti || '').toLowerCase()
  if (s.includes('kempele')) return 'salivastaava_kempele'
  if (s.includes('etu-lyötty') || s.includes('etu_lyotty') || s.includes('lyötty')) return 'salivastaava_etu_lyotty'
  return null
}

export default async function handler(req, res) {
  const id = req.query?.id
  if (!id) return res.status(400).json({ error: 'device id required' })

  const ip = clientIp(req)

  // GET: laitteen perustiedot (kevyt limit, jotta QR-koodin skannaukset toimivat)
  if (req.method === 'GET') {
    const rl = await rateLimit({ name: 'laite:get', key: ip, limit: 60, window: '1 m' })
    if (!rl.ok) {
      res.setHeader('Retry-After', String(Math.ceil((rl.reset - Date.now()) / 1000)))
      return res.status(429).json({ error: 'Liian monta pyyntöä. Yritä hetken kuluttua uudelleen.' })
    }
    const { data, error } = await supabaseAdmin
      .from('laiteluettelo_items')
      .select('id, name, model, sijainti, device_number, ohjevideo_url')
      .eq('id', id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data)  return res.status(404).json({ error: 'not found' })
    return res.status(200).json(data)
  }

  // POST: vikailmoituksen lähetys — tiukempi limit (5/10min per IP+laite,
  // 20/tunti per IP) jotta ei voida spammata satoja tehtäviä.
  if (req.method === 'POST') {
    const rlDevice = await rateLimit({ name: 'laite:post:device', key: `${ip}:${id}`, limit: 5, window: '10 m' })
    if (!rlDevice.ok) {
      res.setHeader('Retry-After', String(Math.ceil((rlDevice.reset - Date.now()) / 1000)))
      return res.status(429).json({ error: 'Sama laite on jo ilmoitettu useita kertoja lyhyessä ajassa. Yritä myöhemmin.' })
    }
    const rlIp = await rateLimit({ name: 'laite:post:ip', key: ip, limit: 20, window: '1 h' })
    if (!rlIp.ok) {
      res.setHeader('Retry-After', String(Math.ceil((rlIp.reset - Date.now()) / 1000)))
      return res.status(429).json({ error: 'Liian monta vikailmoitusta. Yritä myöhemmin.' })
    }

    const body = req.body || {}
    const nimi    = String(body.nimi    || '').trim()
    const kuvaus  = String(body.kuvaus  || '').trim()
    const puhelin = String(body.puhelin || '').trim() || null
    const email   = String(body.email   || '').trim() || null

    if (!nimi || !kuvaus) return res.status(400).json({ error: 'nimi ja kuvaus pakollisia' })
    if (nimi.length > 200 || kuvaus.length > 2000) return res.status(400).json({ error: 'liian pitkä syöte' })

    // Fetch device to verify + get label + sijainti
    const { data: device, error: devErr } = await supabaseAdmin
      .from('laiteluettelo_items')
      .select('id, name, sijainti, device_number')
      .eq('id', id)
      .maybeSingle()
    if (devErr) return res.status(500).json({ error: devErr.message })
    if (!device) return res.status(404).json({ error: 'device not found' })

    // 1) Insert huoltohistoria
    const { error: histErr } = await supabaseAdmin.from('laite_huoltohistoria').insert({
      laite_id: id,
      kuvaus,
      ilmoitettu_by: nimi,
      ilmoittaja_puhelin: puhelin,
      ilmoittaja_email: email,
      source: 'qr',
      tehty: false,
    })
    if (histErr) return res.status(500).json({ error: histErr.message })

    // 2) Mark device as service_requested
    await supabaseAdmin
      .from('laiteluettelo_items')
      .update({ service_requested: true })
      .eq('id', id)

    // 3) Create task
    const deviceLabel = device.device_number ? `${device.name} (nro ${device.device_number})` : device.name
    const assigned = ['huolto', 'admin', 'respa']
    const sVastaava = salivastaavaRole(device.sijainti)
    if (sVastaava) assigned.push(sVastaava)
    const task = {
      title: `Laitehuolto: ${deviceLabel}`,
      description: `Vikailmoitus (QR): ${kuvaus}\n` +
                   `Laite: ${deviceLabel}${device.sijainti ? ` · ${device.sijainti}` : ''}\n` +
                   `Ilmoittaja: ${nimi}${puhelin ? ` · ${puhelin}` : ''}${email ? ` · ${email}` : ''}`,
      status: 'avoin',
      priority: 'high',
      created_by: nimi,
      assigned_to: assigned.join(', '),
    }
    const link = `/laiteluettelo?device=${id}`
    const { error: taskErr } = await supabaseAdmin.from('tasks').insert({ ...task, link })
    if (taskErr) {
      // Fallback ilman link-saraketta (jos ei vielä ole DB:ssä)
      await supabaseAdmin.from('tasks').insert(task)
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'GET or POST' })
}
