import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  Plus, Trash2, Camera, ArrowLeft, ChevronRight,
} from 'lucide-react'

const WEEKDAYS_LONG = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai']
const FAULT_CATEGORIES = [
  'Tukkeutunut kaivo', 'Vesivuoto', 'Rikkoutunut laite',
  'Haittaeläinhavainto', 'Siivoustarvike loppu', 'Muu',
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(isoDate) {
  if (!isoDate) return ''
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── PaivaTab ──────────────────────────────────────────────────────────────────

function RoomReadOnly({ room, items }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '.6rem', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} type="button" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.65rem 1rem', background: 'var(--bg2)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.88rem', color: 'var(--text)' }}>
        <span>{room}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '.72rem', fontWeight: 400, color: 'var(--text3)' }}>{items.length} tehtävää</span>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '.4rem 1rem' }}>
          {items.map(item => (
            <div key={item.id} style={{ padding: '.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '.84rem', color: 'var(--text2)' }}>
              {item.task_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const ok = status === 'aikataulun_mukainen'
  return (
    <span style={{ fontSize: '.72rem', fontWeight: 700, background: ok ? '#DCFCE7' : '#FEF9C3', color: ok ? 'var(--green)' : '#92400E', border: `1px solid ${ok ? '#86EFAC' : '#FDE68A'}`, borderRadius: 4, padding: '.15rem .5rem' }}>
      {ok ? 'Aikataulun mukainen' : 'Poikkeuspäivä'}
    </span>
  )
}

function PaivaTab({ location }) {
  const [logs, setLogs]           = useState([])
  const [items, setItems]         = useState({})      // logId → items[]
  const [exceptions, setExceptions] = useState({})  // logId → exception
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [location.id])

  async function load() {
    setLoading(true)
    const today = todayISO()
    const { data: dayLogs } = await supabase
      .from('siivous_day_logs')
      .select('*')
      .eq('location_id', location.id)
      .eq('log_date', today)
      .order('log_type')

    if (!dayLogs?.length) { setLogs([]); setLoading(false); return }

    const logIds = dayLogs.map(l => l.id)
    const [{ data: logItems }, { data: excs }] = await Promise.all([
      supabase.from('siivous_day_log_items').select('*').in('log_id', logIds).order('sort_order'),
      supabase.from('siivous_exceptions').select('*').in('log_id', logIds),
    ])

    const itemsMap = {}
    for (const item of (logItems || [])) {
      if (!itemsMap[item.log_id]) itemsMap[item.log_id] = []
      itemsMap[item.log_id].push(item)
    }
    const excsMap = {}
    for (const exc of (excs || [])) excsMap[exc.log_id] = exc

    setLogs(dayLogs)
    setItems(itemsMap)
    setExceptions(excsMap)
    setLoading(false)
  }

  if (loading) return <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>

  if (!logs.length) {
    const todayDow = new Date().getDay()
    const scheduled = (location.siivous_days || []).includes(todayDow) || (location.tarkistus_days || []).includes(todayDow)
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text3)' }}>
        <p style={{ fontSize: '.9rem', marginBottom: '.4rem' }}>Ei kirjausta tänään</p>
        <p style={{ fontSize: '.82rem' }}>
          {scheduled
            ? 'Järjestelmä luo kirjauksen automaattisesti klo 5:30–6:30.'
            : 'Ei aikataulutettua siivousta tänään.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {logs.map(log => {
        const logItems = items[log.id] || []
        const exc = exceptions[log.id]
        const grouped = {}
        for (const item of logItems) {
          if (!grouped[item.room]) grouped[item.room] = []
          grouped[item.room].push(item)
        }
        return (
          <div key={log.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.9rem 1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{log.log_type === 'siivous' ? 'Siivous' : 'Tarkistus'}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.1rem' }}>
                    {formatDate(log.log_date)} · {log.created_by_name}
                  </div>
                </div>
                <StatusBadge status={log.status} />
              </div>
              {log.notes && <p style={{ fontSize: '.82rem', color: 'var(--text2)', margin: '.5rem 0 0', fontStyle: 'italic' }}>{log.notes}</p>}
              {exc && (
                <div style={{ marginTop: '.6rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '.4rem .7rem', fontSize: '.8rem', color: 'var(--red)' }}>
                  ⚠️ Poikkeus: {exc.exception_type === 'ei_toteutunut' ? 'Ei toteutunut' : 'Osittain tekemättä'} — {exc.reason}
                  {exc.supervisor_name && <span style={{ color: 'var(--text3)', marginLeft: '.4rem' }}>({exc.supervisor_name})</span>}
                </div>
              )}
            </div>
            {logItems.length === 0
              ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei tehtäväluetteloa.</p>
              : Object.entries(grouped).map(([room, roomItems]) => (
                <RoomReadOnly key={room} room={room} items={roomItems} />
              ))}
          </div>
        )
      })}
    </div>
  )
}

// ── HistoriaTab ───────────────────────────────────────────────────────────────

function HistoriaTab({ location }) {
  const { profile } = useAuth()
  const [logs, setLogs]           = useState([])
  const [exceptions, setExceptions] = useState({}) // logId → exception
  const [items, setItems]         = useState({})   // logId → items[]
  const [faults, setFaults]       = useState([])
  const [expanded, setExpanded]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType] = useState('kaikki')

  const faultStatusColor = { avoin: 'var(--red)', 'työn alla': 'var(--yellow)', korjattu: 'var(--green)' }

  useEffect(() => { load() }, [location.id])

  async function load() {
    setLoading(true)
    const [{ data: dayLogs }, { data: fts }] = await Promise.all([
      supabase.from('siivous_day_logs')
        .select('*')
        .eq('location_id', location.id)
        .order('log_date', { ascending: false })
        .limit(60),
      supabase.from('siivous_faults')
        .select('*')
        .eq('location_id', location.id)
        .order('reported_at', { ascending: false }),
    ])
    const logIds = (dayLogs || []).map(l => l.id)
    const excsMap = {}
    if (logIds.length > 0) {
      const { data: excs } = await supabase.from('siivous_exceptions').select('*').in('log_id', logIds)
      for (const exc of (excs || [])) excsMap[exc.log_id] = exc
    }
    setLogs(dayLogs || [])
    setExceptions(excsMap)
    setFaults(fts || [])
    setLoading(false)
  }

  async function loadItems(logId) {
    if (items[logId]) return
    const { data } = await supabase.from('siivous_day_log_items').select('*').eq('log_id', logId).order('sort_order')
    setItems(prev => ({ ...prev, [logId]: data || [] }))
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    await loadItems(id)
  }

  async function updateFaultStatus(faultId, status) {
    const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Tuntematon'
    const patch = { status }
    if (status === 'korjattu') { patch.resolved_at = new Date().toISOString(); patch.resolved_by_name = myName }
    await supabase.from('siivous_faults').update(patch).eq('id', faultId)
    setFaults(prev => prev.map(f => f.id === faultId ? { ...f, ...patch } : f))
  }

  const filtered = logs.filter(l => filterType === 'kaikki' || l.log_type === filterType)

  return (
    <div>
      {faults.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '.6rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} /> Viat
          </div>
          {faults.map(f => (
            <div key={f.id} style={{ border: `1px solid ${f.status === 'korjattu' ? 'var(--border)' : '#FECACA'}`, borderRadius: 'var(--radius)', padding: '.7rem .9rem', marginBottom: '.5rem', background: f.status === 'korjattu' ? 'var(--bg2)' : '#FFF3F3', fontSize: '.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{f.category}</span>
                  <span style={{ color: 'var(--text3)', marginLeft: '.4rem' }}>{formatDateTime(f.reported_at)} · {f.reported_by_name}</span>
                  <p style={{ margin: '.2rem 0 0', color: 'var(--text2)' }}>{f.description}</p>
                  {f.status === 'korjattu' && f.resolved_by_name && (
                    <p style={{ margin: '.2rem 0 0', color: 'var(--green)', fontSize: '.75rem' }}>✓ Korjattu {formatDateTime(f.resolved_at)} · {f.resolved_by_name}</p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.3rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, color: faultStatusColor[f.status], background: faultStatusColor[f.status] + '20', padding: '.15rem .45rem', borderRadius: 4, textTransform: 'uppercase' }}>{f.status}</span>
                  {f.status !== 'korjattu' && (
                    <select className="input-field" style={{ fontSize: '.75rem', padding: '.2rem .4rem', width: 'auto' }} value={f.status} onChange={e => updateFaultStatus(f.id, e.target.value)}>
                      <option value="avoin">Avoin</option>
                      <option value="työn alla">Työn alla</option>
                      <option value="korjattu">Korjattu</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['kaikki', 'siivous', 'tarkistus'].map(t => (
          <button key={t} type="button" onClick={() => setFilterType(t)} className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-ghost'}`}>
            {t === 'kaikki' ? 'Kaikki' : t === 'siivous' ? 'Siivous' : 'Tarkistus'}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>
        : filtered.length === 0 ? <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ei kirjauksia.</p>
        : filtered.map(log => {
          const isOpen = expanded === log.id
          const exc = exceptions[log.id]
          const logItems = items[log.id] || []
          return (
            <div key={log.id} style={{ border: `1px solid ${exc ? '#FECACA' : 'var(--border)'}`, borderRadius: 'var(--radius)', marginBottom: '.6rem', overflow: 'hidden' }}>
              <button type="button" onClick={() => toggleExpand(log.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.75rem 1rem', background: isOpen ? 'var(--bg2)' : 'var(--bg)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
                    {formatDate(log.log_date)}
                    <span style={{ fontSize: '.7rem', fontWeight: 400, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '.1rem .35rem' }}>
                      {log.log_type === 'siivous' ? 'Siivous' : 'Tarkistus'}
                    </span>
                    {log.status === 'poikkeuspäivä' && <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#92400E', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 4, padding: '.1rem .35rem' }}>Poikkeuspäivä</span>}
                    {exc && <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--red)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '.1rem .35rem' }}>⚠️ Poikkeus</span>}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.1rem' }}>{log.created_by_name}</div>
                </div>
                {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {isOpen && (
                <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                  {exc && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '.6rem .85rem', marginBottom: '.75rem', fontSize: '.82rem' }}>
                      <strong>Poikkeus: {exc.exception_type === 'ei_toteutunut' ? 'Ei toteutunut' : 'Osittain tekemättä'}</strong>
                      <p style={{ margin: '.2rem 0 0', color: 'var(--text2)' }}>{exc.reason}</p>
                      {exc.corrective_action && <p style={{ margin: '.2rem 0 0', color: 'var(--text3)', fontStyle: 'italic' }}>Korjaava: {exc.corrective_action}</p>}
                      <p style={{ margin: '.2rem 0 0', color: 'var(--text3)', fontSize: '.75rem' }}>{exc.supervisor_name} · {formatDateTime(exc.created_at)}</p>
                    </div>
                  )}
                  {log.notes && <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '.6rem', fontStyle: 'italic' }}>{log.notes}</p>}
                  {logItems.length === 0
                    ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p>
                    : logItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', padding: '.25rem 0', borderBottom: '1px solid var(--border)', gap: '.5rem', fontSize: '.82rem' }}>
                        <span style={{ color: 'var(--text3)', minWidth: 90, flexShrink: 0, fontSize: '.75rem' }}>{item.room}</span>
                        <span style={{ color: 'var(--text2)' }}>{item.task_name}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

// ── VikaTab ───────────────────────────────────────────────────────────────────

function VikaTab({ location }) {
  const { profile } = useAuth()
  const fileRef = useRef()
  const [category, setCategory]   = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages]       = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [submitted, setSubmitted] = useState(false)

  function addImage(file) {
    setImages(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
  }

  async function handleSubmit() {
    if (!category || !description.trim()) return
    setSubmitting(true)
    setError('')
    const reporterName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email : 'Tuntematon'
    try {
      const { data: fault, error: fErr } = await supabase
        .from('siivous_faults')
        .insert({ location_id: location.id, category, description: description.trim(), reported_by_name: reporterName, reported_by_id: profile?.id || null, reported_at: new Date().toISOString() })
        .select('id').single()
      if (fErr) throw fErr
      for (const img of images) {
        try {
          const ext = img.file.name.split('.').pop() || 'jpg'
          const path = `${fault.id}/${Date.now()}.${ext}`
          await supabase.storage.from('siivous-kuvat').upload(path, img.file)
          await supabase.from('siivous_fault_images').insert({ fault_id: fault.id, storage_path: path })
        } catch { /* non-fatal */ }
      }
      setSubmitted(true)
    } catch (e) {
      setError(e.message || 'Tallentaminen epäonnistui')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <CheckCircle size={48} style={{ color: 'var(--green)', margin: '0 auto .75rem' }} />
        <p style={{ fontWeight: 700 }}>Vikailmoitus lähetetty!</p>
        <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => { setSubmitted(false); setCategory(''); setDescription(''); setImages([]) }}>Uusi ilmoitus</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div className="input-group">
        <label className="input-label">Kategoria</label>
        <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Valitse...</option>
          {FAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Kuvaus</label>
        <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Kerro vian sijainti ja luonne..." style={{ resize: 'vertical', fontSize: '.85rem' }} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label className="input-label">Kuvat</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' }}>
          {images.map((img, i) => (
            <div key={i} style={{ width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} style={{ width: 72, height: 72, border: '2px dashed var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.25rem', color: 'var(--text3)', fontSize: '.7rem' }}>
            <Camera size={18} />Lisää
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) addImage(e.target.files[0]) }} />
        </div>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: '.82rem', marginBottom: '.75rem' }}>⚠️ {error}</div>}
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!category || !description.trim() || submitting} onClick={handleSubmit}>
        {submitting ? 'Lähetetään...' : 'Lähetä vikailmoitus'}
      </button>
    </div>
  )
}

// ── PoikkeusTab ───────────────────────────────────────────────────────────────

function PoikkeusTab({ location }) {
  const { profile } = useAuth()
  const [logs, setLogs]           = useState([])
  const [exceptions, setExceptions] = useState({}) // logId → exception (with _tasks)
  const [selectedLog, setSelectedLog] = useState(null)
  const [logItems, setLogItems]   = useState({}) // logId → items[]
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState({ exception_type: 'ei_toteutunut', reason: '', corrective_action: '' })
  const [selectedTasks, setSelectedTasks] = useState([]) // task_ids for osittain_tekematta
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { load() }, [location.id])

  async function load() {
    setLoading(true)
    const today = todayISO()
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14)
    const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`

    const { data: dayLogs } = await supabase
      .from('siivous_day_logs')
      .select('*')
      .eq('location_id', location.id)
      .gte('log_date', cutoffISO)
      .lte('log_date', today)
      .order('log_date', { ascending: false })

    const logIds = (dayLogs || []).map(l => l.id)
    const excsMap = {}

    if (logIds.length > 0) {
      const { data: excs } = await supabase.from('siivous_exceptions').select('*').in('log_id', logIds)
      const excIds = (excs || []).map(e => e.id)
      let excTasks = []
      if (excIds.length > 0) {
        const { data: et } = await supabase.from('siivous_exception_tasks').select('*').in('exception_id', excIds)
        excTasks = et || []
      }
      for (const exc of (excs || [])) {
        excsMap[exc.log_id] = { ...exc, _tasks: excTasks.filter(t => t.exception_id === exc.id) }
      }
    }

    setLogs(dayLogs || [])
    setExceptions(excsMap)
    setLoading(false)
  }

  async function selectLog(log) {
    setSelectedLog(log)
    setSaveError('')
    setForm({ exception_type: 'ei_toteutunut', reason: '', corrective_action: '' })
    setSelectedTasks([])
    if (!logItems[log.id]) {
      const { data } = await supabase.from('siivous_day_log_items').select('*').eq('log_id', log.id).order('sort_order')
      setLogItems(prev => ({ ...prev, [log.id]: data || [] }))
    }
  }

  async function handleSave() {
    if (!form.reason.trim() || !selectedLog) return
    setSaving(true)
    setSaveError('')
    const supervisorName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Tuntematon'
    try {
      const { data: exc, error: excErr } = await supabase
        .from('siivous_exceptions')
        .insert({ log_id: selectedLog.id, exception_type: form.exception_type, reason: form.reason.trim(), corrective_action: form.corrective_action.trim() || null, supervisor_id: profile?.id || null, supervisor_name: supervisorName })
        .select('id').single()
      if (excErr) throw excErr

      if (form.exception_type === 'osittain_tekematta' && selectedTasks.length > 0) {
        const curItems = (logItems[selectedLog.id] || []).filter(item => selectedTasks.includes(item.task_id))
        if (curItems.length > 0) {
          const { error: etErr } = await supabase.from('siivous_exception_tasks').insert(curItems.map(item => ({ exception_id: exc.id, task_id: item.task_id, task_name: item.task_name })))
          if (etErr) throw etErr
        }
      }

      await load()
      setSelectedLog(null)
    } catch (e) {
      setSaveError(e.message || 'Tallentaminen epäonnistui')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>

  if (selectedLog) {
    const existingExc = exceptions[selectedLog.id]
    const curItems = logItems[selectedLog.id] || []

    if (existingExc) {
      return (
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }} onClick={() => setSelectedLog(null)}>← Takaisin</button>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <p style={{ fontWeight: 700, marginBottom: '.5rem' }}>{formatDate(selectedLog.log_date)}</p>
            <p style={{ fontWeight: 700, color: 'var(--red)', fontSize: '.88rem' }}>Poikkeus jo kirjattu</p>
            <p style={{ color: 'var(--text2)', margin: '.2rem 0', fontSize: '.85rem' }}>Tyyppi: {existingExc.exception_type === 'ei_toteutunut' ? 'Ei toteutunut' : 'Osittain tekemättä'}</p>
            <p style={{ color: 'var(--text2)', margin: '.2rem 0', fontSize: '.85rem' }}>Syy: {existingExc.reason}</p>
            {existingExc.corrective_action && <p style={{ color: 'var(--text2)', margin: '.2rem 0', fontSize: '.85rem' }}>Korjaava: {existingExc.corrective_action}</p>}
            <p style={{ color: 'var(--text3)', fontSize: '.75rem', margin: '.4rem 0 0' }}>{existingExc.supervisor_name} · {formatDateTime(existingExc.created_at)}</p>
            {existingExc._tasks?.length > 0 && (
              <div style={{ marginTop: '.6rem' }}>
                <p style={{ fontWeight: 600, fontSize: '.8rem', marginBottom: '.25rem' }}>Tekemättä jääneet:</p>
                {existingExc._tasks.map(t => <div key={t.id} style={{ fontSize: '.82rem', color: 'var(--text2)' }}>• {t.task_name}</div>)}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }} onClick={() => setSelectedLog(null)}>← Takaisin</button>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '1rem' }}>
          {formatDate(selectedLog.log_date)} — {selectedLog.log_type === 'siivous' ? 'Siivous' : 'Tarkistus'}
        </div>
        <div className="input-group">
          <label className="input-label">Poikkeustyyppi</label>
          <select className="input-field" value={form.exception_type} onChange={e => setForm(f => ({ ...f, exception_type: e.target.value }))}>
            <option value="ei_toteutunut">Ei toteutunut</option>
            <option value="osittain_tekematta">Osittain tekemättä</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Syy (pakollinen)</label>
          <textarea className="input-field" rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Kerro poikkeuksen syy..." style={{ resize: 'vertical', fontSize: '.85rem' }} />
        </div>
        <div className="input-group">
          <label className="input-label">Korjaava toimenpide</label>
          <textarea className="input-field" rows={2} value={form.corrective_action} onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))} placeholder="Miten tilanne korjataan..." style={{ resize: 'vertical', fontSize: '.85rem' }} />
        </div>
        {form.exception_type === 'osittain_tekematta' && curItems.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label className="input-label">Tekemättä jääneet tehtävät</label>
            {curItems.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.3rem 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '.84rem' }}>
                <input type="checkbox" checked={selectedTasks.includes(item.task_id)}
                  onChange={e => setSelectedTasks(prev => e.target.checked ? [...prev, item.task_id] : prev.filter(id => id !== item.task_id))} />
                <span style={{ color: 'var(--text3)', fontSize: '.73rem', minWidth: 85 }}>{item.room}</span>
                <span>{item.task_name}</span>
              </label>
            ))}
          </div>
        )}
        {saveError && <div style={{ color: 'var(--red)', fontSize: '.82rem', marginBottom: '.75rem' }}>⚠️ {saveError}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!form.reason.trim() || saving} onClick={handleSave}>
          {saving ? 'Tallennetaan...' : 'Tallenna poikkeus'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ color: 'var(--text3)', fontSize: '.82rem', marginBottom: '1rem' }}>Valitse päivä, jolle kirjataan poikkeus (max 14 pv taaksepäin).</p>
      {logs.length === 0
        ? <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ei kirjauksia viimeiseltä 14 päivältä.</p>
        : logs.map(log => {
          const exc = exceptions[log.id]
          return (
            <button key={log.id} type="button" onClick={() => selectLog(log)} style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.7rem 1rem', background: 'var(--bg)', border: `1px solid ${exc ? '#FECACA' : 'var(--border)'}`, borderRadius: 'var(--radius)', marginBottom: '.5rem', cursor: 'pointer', transition: 'box-shadow .15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{formatDate(log.log_date)}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.1rem' }}>
                  {log.log_type === 'siivous' ? 'Siivous' : 'Tarkistus'} · {log.status === 'poikkeuspäivä' ? 'Poikkeuspäivä' : 'Aikataulun mukainen'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                {exc && <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--red)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '.1rem .4rem' }}>Poikkeus</span>}
                <ChevronRight size={14} style={{ color: 'var(--text3)' }} />
              </div>
            </button>
          )
        })
      }
    </div>
  )
}

// ── TarkastusTab ──────────────────────────────────────────────────────────────

function TarkastusTab({ location }) {
  const { profile } = useAuth()
  const fileRef = useRef()
  const [rooms, setRooms]         = useState([])
  const [roomData, setRoomData]   = useState({}) // room → { status, notes, images[] }
  const [activeImageRoom, setActiveImageRoom] = useState(null)
  const [pastInspections, setPastInspections] = useState([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { load() }, [location.id])

  async function load() {
    setLoading(true)
    const [{ data: tasks }, { data: inspections }] = await Promise.all([
      supabase.from('siivous_tasks').select('room, sort_order').eq('location_id', location.id).eq('is_active', true).order('sort_order'),
      supabase.from('siivous_inspections').select('id, inspection_date, inspector_name, siivous_inspection_rooms(id, room, status, notes)').eq('location_id', location.id).order('inspection_date', { ascending: false }).limit(5),
    ])
    const uniqueRooms = [...new Set((tasks || []).map(t => t.room))]
    const initData = {}
    for (const room of uniqueRooms) initData[room] = { status: null, notes: '', images: [] }
    setRooms(uniqueRooms)
    setRoomData(initData)
    setPastInspections(inspections || [])
    setLoading(false)
  }

  const canSubmit = rooms.every(r => roomData[r]?.status !== null)

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const inspectorName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Tuntematon'
    const today = todayISO()
    try {
      const { data: inspection, error: insErr } = await supabase
        .from('siivous_inspections')
        .insert({ location_id: location.id, inspection_date: today, inspector_id: profile?.id || null, inspector_name: inspectorName, submitted_at: new Date().toISOString() })
        .select('id').single()
      if (insErr) throw insErr

      const roomRows = rooms.map((room, idx) => ({ inspection_id: inspection.id, room, status: roomData[room].status, notes: roomData[room].notes.trim() || null, sort_order: idx }))
      const { data: insertedRooms, error: roomErr } = await supabase.from('siivous_inspection_rooms').insert(roomRows).select('id, room')
      if (roomErr) throw roomErr

      for (const [room, rd] of Object.entries(roomData)) {
        if (rd.images?.length > 0) {
          const roomRow = insertedRooms.find(r => r.room === room)
          if (roomRow) {
            try {
              const file = rd.images[0].file
              const ext = file.name.split('.').pop() || 'jpg'
              const path = `inspection/${inspection.id}/${room.replace(/\s+/g, '_').slice(0, 40)}.${ext}`
              await supabase.storage.from('siivous-kuvat').upload(path, file)
              await supabase.from('siivous_inspection_rooms').update({ image_path: path }).eq('id', roomRow.id)
            } catch { /* non-fatal */ }
          }
        }
      }
      setSubmitted(true)
      await load()
    } catch (e) {
      setError(e.message || 'Tallentaminen epäonnistui')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <CheckCircle size={48} style={{ color: 'var(--green)', margin: '0 auto .75rem' }} />
        <p style={{ fontWeight: 700 }}>Tarkastus tallennettu!</p>
        <button className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setSubmitted(false)}>Uusi tarkastus</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>Siisteystarkastus</div>
        <div style={{ fontSize: '.82rem', color: 'var(--text3)' }}>{formatDate(todayISO())}</div>
      </div>

      {rooms.map(room => {
        const rd = roomData[room] || {}
        return (
          <div key={room} style={{ border: `1px solid ${rd.status === 'huomautettavaa' ? '#FECACA' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '.85rem 1rem', marginBottom: '.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.55rem' }}>{room}</div>
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: rd.status === 'huomautettavaa' ? '.6rem' : 0 }}>
              {[{ val: 'siisti', label: 'Siisti', color: 'var(--green)' }, { val: 'huomautettavaa', label: 'Huomautettavaa', color: 'var(--red)' }].map(opt => {
                const active = rd.status === opt.val
                return (
                  <button key={opt.val} type="button" onClick={() => setRoomData(p => ({ ...p, [room]: { ...p[room], status: opt.val } }))} style={{ flex: 1, padding: '.5rem', borderRadius: 8, border: `2px solid ${active ? opt.color : 'var(--border)'}`, background: active ? opt.color + '15' : 'transparent', color: active ? opt.color : 'var(--text3)', fontWeight: active ? 700 : 400, fontSize: '.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.3rem' }}>
                    {active && opt.val === 'siisti' && <CheckCircle size={13} />}
                    {active && opt.val === 'huomautettavaa' && <AlertTriangle size={13} />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {rd.status === 'huomautettavaa' && (
              <div>
                <textarea className="input-field" rows={2} value={rd.notes || ''} onChange={e => setRoomData(p => ({ ...p, [room]: { ...p[room], notes: e.target.value } }))} placeholder="Huomautuksen kuvaus..." style={{ marginBottom: '.5rem', fontSize: '.85rem', resize: 'vertical' }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', alignItems: 'center' }}>
                  {(rd.images || []).map((img, i) => (
                    <div key={i} style={{ width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => { setActiveImageRoom(room); fileRef.current?.click() }} style={{ width: 60, height: 60, border: '2px dashed var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.2rem', color: 'var(--text3)', fontSize: '.65rem' }}>
                    <Camera size={15} />Kuva
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { if (e.target.files[0] && activeImageRoom) setRoomData(p => ({ ...p, [activeImageRoom]: { ...p[activeImageRoom], images: [...(p[activeImageRoom].images || []), { file: e.target.files[0], preview: URL.createObjectURL(e.target.files[0]) }] } })) }} />

      {error && <div style={{ color: 'var(--red)', fontSize: '.82rem', marginBottom: '.75rem' }}>⚠️ {error}</div>}
      {!canSubmit && <p style={{ fontSize: '.78rem', color: 'var(--text3)', textAlign: 'center', marginBottom: '.5rem' }}>Merkitse jokainen tila ennen lähettämistä</p>}
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSubmit || submitting} onClick={handleSubmit}>
        {submitting ? 'Tallennetaan...' : 'Tallenna tarkastus'}
      </button>

      {pastInspections.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', marginBottom: '.75rem', color: 'var(--text2)' }}>Aiemmat tarkastukset</div>
          {pastInspections.map(ins => {
            const warnings = (ins.siivous_inspection_rooms || []).filter(r => r.status === 'huomautettavaa')
            return (
              <div key={ins.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.7rem 1rem', marginBottom: '.5rem', fontSize: '.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><span style={{ fontWeight: 700 }}>{formatDate(ins.inspection_date)}</span><span style={{ color: 'var(--text3)', marginLeft: '.4rem' }}>{ins.inspector_name}</span></div>
                  {warnings.length > 0 && <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--red)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '.1rem .4rem' }}>Huomautuksia</span>}
                </div>
                {warnings.map(r => <div key={r.id} style={{ marginTop: '.3rem', color: 'var(--red)', fontSize: '.78rem' }}>⚠️ {r.room}{r.notes ? ': ' + r.notes : ''}</div>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── TehtavatAdminTab ──────────────────────────────────────────────────────────

function TehtavatAdminTab({ location }) {
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editTask, setEditTask]   = useState(null)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  const emptyForm = { room: '', task_name: '', schedule_type: 'daily', schedule_day: '', signoff_type: 'siivous', sort_order: 0, is_active: true }
  const [form, setForm] = useState(emptyForm)
  const DAYS = [{ val: 0, label: 'Su' }, { val: 1, label: 'Ma' }, { val: 2, label: 'Ti' }, { val: 3, label: 'Ke' }, { val: 4, label: 'To' }, { val: 5, label: 'Pe' }, { val: 6, label: 'La' }]

  useEffect(() => { load() }, [location.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('siivous_tasks').select('*').eq('location_id', location.id).order('sort_order')
    setTasks(data || [])
    setLoading(false)
  }

  function openNew() { setForm(emptyForm); setEditTask(null); setSaveError(''); setShowForm(true) }
  function openEdit(t) { setForm({ room: t.room || '', task_name: t.task_name || '', schedule_type: t.schedule_type || 'daily', schedule_day: t.schedule_day ?? '', signoff_type: t.signoff_type || 'siivous', sort_order: t.sort_order ?? 0, is_active: t.is_active ?? true }); setEditTask(t.id); setSaveError(''); setShowForm(true) }

  async function handleSave() {
    if (!form.task_name.trim() || !form.room.trim()) return
    if (form.schedule_type === 'weekly' && form.schedule_day === '') { setSaveError('Viikoittaiselle tehtävälle täytyy valita viikonpäivä.'); return }
    setSaving(true); setSaveError('')
    const payload = { location_id: location.id, room: form.room.trim(), task_name: form.task_name.trim(), schedule_type: form.schedule_type, schedule_day: form.schedule_type === 'weekly' ? parseInt(form.schedule_day) : null, signoff_type: form.signoff_type, sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active }
    const { error } = editTask ? await supabase.from('siivous_tasks').update(payload).eq('id', editTask) : await supabase.from('siivous_tasks').insert(payload)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setShowForm(false); load()
  }

  async function toggleActive(t) {
    const { error } = await supabase.from('siivous_tasks').update({ is_active: !t.is_active }).eq('id', t.id)
    if (!error) load()
  }

  const grouped = tasks.reduce((acc, t) => { const key = `${t.room}___${t.signoff_type}`; if (!acc[key]) acc[key] = []; acc[key].push(t); return acc }, {})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={14} /> Uusi tehtävä</button>
      </div>
      {loading ? <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ladataan...</p>
        : Object.entries(grouped).map(([key, tks]) => {
          const [room, st] = key.split('___')
          return (
            <div key={key} style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.88rem', color: 'var(--text2)', marginBottom: '.4rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                {room}
                <span style={{ fontSize: '.72rem', color: 'var(--text3)', fontWeight: 400, border: '1px solid var(--border)', borderRadius: 4, padding: '.1rem .35rem' }}>{st}</span>
              </div>
              {tks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.45rem .65rem', background: t.is_active ? 'var(--bg)' : 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '.35rem', opacity: t.is_active ? 1 : 0.55, fontSize: '.82rem' }}>
                  <div style={{ flex: 1, color: 'var(--text2)' }}>
                    {t.task_name}
                    <span style={{ marginLeft: '.4rem', color: 'var(--text3)', fontSize: '.72rem' }}>{t.schedule_type === 'weekly' ? (DAYS.find(d => d.val === t.schedule_day)?.label ?? '?') : t.schedule_type}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem', padding: '.2rem .45rem' }} onClick={() => openEdit(t)}>Muokkaa</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem', padding: '.2rem .45rem', color: t.is_active ? 'var(--red)' : 'var(--green)' }} onClick={() => toggleActive(t)}>{t.is_active ? 'Poista' : 'Aktivoi'}</button>
                </div>
              ))}
            </div>
          )
        })}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: '1.25rem 1.25rem 2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: '0 0 1rem' }}>{editTask ? 'Muokkaa tehtävää' : 'Uusi tehtävä'}</h3>
            <div className="input-group"><label className="input-label">Huone / ryhmä</label><input className="input-field" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="esim. Pukuhuoneet" /></div>
            <div className="input-group"><label className="input-label">Tehtävä</label><input className="input-field" value={form.task_name} onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} placeholder="Tehtävän teksti" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="input-group"><label className="input-label">Toistuvuus</label><select className="input-field" value={form.schedule_type} onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))}><option value="daily">Päivittäin</option><option value="weekly">Viikoittain</option><option value="monthly">Kuukausittain</option><option value="deep_clean">Peruspuhdistus</option></select></div>
              {form.schedule_type === 'weekly' && <div className="input-group"><label className="input-label">Viikonpäivä</label><select className="input-field" value={form.schedule_day} onChange={e => setForm(f => ({ ...f, schedule_day: e.target.value }))}><option value="">Valitse...</option>{DAYS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}</select></div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="input-group"><label className="input-label">Tyyppi</label><select className="input-field" value={form.signoff_type} onChange={e => setForm(f => ({ ...f, signoff_type: e.target.value }))}><option value="siivous">Siivous</option><option value="tarkistus">Tarkistus</option></select></div>
              <div className="input-group"><label className="input-label">Järjestys</label><input className="input-field" type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem', cursor: 'pointer', marginTop: '.25rem' }}><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />Aktiivinen</label>
            {saveError && <div style={{ color: 'var(--red)', fontSize: '.78rem', marginTop: '.5rem' }}>⚠️ {saveError}</div>}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.task_name.trim() || !form.room.trim()}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AikatauluTab ──────────────────────────────────────────────────────────────

function AikatauluTab({ location, onLocationUpdated }) {
  const [siivousDays, setSiivousDays]     = useState(location.siivous_days || [])
  const [tarkistusDays, setTarkistusDays] = useState(location.tarkistus_days || [])
  const [supervisorName, setSupervisorName] = useState(location.supervisor_name || '')
  const [scheduledBy, setScheduledBy]     = useState(location.scheduled_by || '')
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')

  const [closedDays, setClosedDays]       = useState([])
  const [loadingClosed, setLoadingClosed] = useState(true)
  const [newDate, setNewDate]             = useState('')
  const [newReason, setNewReason]         = useState('')
  const [addingClosed, setAddingClosed]   = useState(false)

  const DAYS = [{ dow: 1, label: 'Ma' }, { dow: 2, label: 'Ti' }, { dow: 3, label: 'Ke' }, { dow: 4, label: 'To' }, { dow: 5, label: 'Pe' }, { dow: 6, label: 'La' }, { dow: 0, label: 'Su' }]

  useEffect(() => { loadClosedDays() }, [location.id])

  async function loadClosedDays() {
    setLoadingClosed(true)
    const { data } = await supabase.from('siivous_closed_days').select('*').eq('location_id', location.id).order('closed_date', { ascending: false })
    setClosedDays(data || [])
    setLoadingClosed(false)
  }

  function toggleDay(arr, dow) { return arr.includes(dow) ? arr.filter(d => d !== dow) : [...arr, dow] }

  async function handleSave() {
    setSaving(true); setSaveMsg('')
    const { error } = await supabase.from('siivous_locations').update({ siivous_days: siivousDays, tarkistus_days: tarkistusDays, supervisor_name: supervisorName.trim() || null, scheduled_by: scheduledBy.trim() || null }).eq('id', location.id)
    setSaving(false)
    if (error) { setSaveMsg('Virhe: ' + error.message); return }
    setSaveMsg('Tallennettu!')
    if (onLocationUpdated) onLocationUpdated()
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function addClosedDay() {
    if (!newDate || !newReason.trim()) return
    setAddingClosed(true)
    const { data, error } = await supabase.from('siivous_closed_days').insert({ location_id: location.id, closed_date: newDate, reason: newReason.trim() }).select('*').single()
    setAddingClosed(false)
    if (error) { alert(error.message); return }
    setClosedDays(prev => [data, ...prev])
    setNewDate(''); setNewReason('')
  }

  async function removeClosedDay(id) {
    await supabase.from('siivous_closed_days').delete().eq('id', id)
    setClosedDays(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {[
        { label: 'Siivous — aikataulutetut päivät', arr: siivousDays, set: setSiivousDays },
        { label: 'Tarkistus — aikataulutetut päivät', arr: tarkistusDays, set: setTarkistusDays },
      ].map(({ label, arr, set }) => (
        <div key={label} style={{ marginBottom: '1.25rem' }}>
          <label className="input-label">{label}</label>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            {DAYS.map(d => {
              const active = arr.includes(d.dow)
              return (
                <button key={d.dow} type="button" onClick={() => set(a => toggleDay(a, d.dow))} style={{ padding: '.45rem .7rem', borderRadius: 6, border: `2px solid ${active ? 'var(--violet)' : 'var(--border)'}`, background: active ? 'var(--violet)' : 'transparent', color: active ? '#fff' : 'var(--text3)', fontWeight: active ? 700 : 400, fontSize: '.85rem', cursor: 'pointer' }}>
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="input-group">
        <label className="input-label">Valvoja</label>
        <input className="input-field" value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="esim. Tiina Virtanen" />
      </div>
      <div className="input-group">
        <label className="input-label">Aikataulutettu / siivooja(t)</label>
        <input className="input-field" value={scheduledBy} onChange={e => setScheduledBy(e.target.value)} placeholder="esim. Jhunie Aquino, Mario Aquino" />
      </div>

      {saveMsg && <div style={{ fontSize: '.82rem', color: saveMsg.startsWith('Virhe') ? 'var(--red)' : 'var(--green)', marginBottom: '.75rem' }}>{saveMsg}</div>}
      <button className="btn btn-primary" style={{ marginBottom: '2rem' }} disabled={saving} onClick={handleSave}>{saving ? 'Tallennetaan...' : 'Tallenna aikataulu'}</button>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', marginBottom: '.75rem' }}>Poikkeuspäivät (suljettu / arkipyhä)</div>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input type="date" className="input-field" style={{ flex: '0 0 auto', width: 'auto' }} value={newDate} onChange={e => setNewDate(e.target.value)} />
          <input className="input-field" style={{ flex: 1, minWidth: 120 }} value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Syy (esim. Joulu)" />
          <button className="btn btn-primary btn-sm" disabled={!newDate || !newReason.trim() || addingClosed} onClick={addClosedDay}>Lisää</button>
        </div>
        {loadingClosed ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ladataan...</p>
          : closedDays.length === 0 ? <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei merkittyjä poikkeuspäiviä.</p>
          : closedDays.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.45rem .65rem', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '.4rem', fontSize: '.83rem' }}>
              <div><span style={{ fontWeight: 600 }}>{formatDate(d.closed_date)}</span><span style={{ color: 'var(--text3)', marginLeft: '.4rem' }}>{d.reason}</span></div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '.72rem', padding: '.2rem .45rem' }} onClick={() => removeClosedDay(d.id)}><Trash2 size={12} /></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SiivousLocation() {
  const { locationSlug } = useParams()
  const navigate = useNavigate()
  const { isAdmin, isSiivooja, isValvoja, profile } = useAuth()

  const [location, setLocation]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [tab, setTab]                   = useState('paiva')
  const reqGen = useRef(0)

  const isRestricted = (isSiivooja || isValvoja) && !isAdmin

  useEffect(() => { loadLocation() }, [locationSlug, profile])

  async function loadLocation() {
    const gen = ++reqGen.current
    setLoading(true)
    setAccessDenied(false)
    const { data } = await supabase
      .from('siivous_locations')
      .select('*')
      .eq('slug', locationSlug)
      .eq('is_active', true)
      .maybeSingle()

    if (reqGen.current !== gen) return

    if (data && isRestricted) {
      const allowed = profile?.location_access || []
      if (!allowed.includes(locationSlug)) {
        setAccessDenied(true)
        setLoading(false)
        return
      }
    }

    setLocation(data || null)
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--text3)', padding: '2rem' }}>Ladataan...</div>
  if (accessDenied) return (
    <div style={{ padding: '2rem' }}>
      <p style={{ color: 'var(--red)' }}>Sinulla ei ole pääsyä tähän toimipisteeseen.</p>
      <button className="btn btn-ghost" onClick={() => navigate('/huolto/siivous')}>← Takaisin</button>
    </div>
  )
  if (!location) return (
    <div style={{ padding: '2rem' }}>
      <p style={{ color: 'var(--red)' }}>Toimipistettä ei löydy.</p>
      <button className="btn btn-ghost" onClick={() => navigate('/huolto/siivous')}>← Takaisin</button>
    </div>
  )

  const tabs = [
    { id: 'paiva',     label: 'Päivä' },
    { id: 'historia',  label: 'Historia' },
    { id: 'vika',      label: 'Vikailmoitus' },
    ...(isAdmin || isValvoja ? [{ id: 'poikkeus', label: 'Poikkeus' }, { id: 'tarkastus', label: 'Tarkastus' }] : []),
    ...(isAdmin ? [{ id: 'tehtavat', label: 'Tehtävät' }, { id: 'aikataulu', label: 'Aikataulu' }] : []),
  ]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/huolto/siivous')}><ArrowLeft size={14} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>{location.name}</h1>
      </div>

      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border)', paddingBottom: '.6rem', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: tab === t.id ? 800 : 400, color: tab === t.id ? 'var(--violet)' : 'var(--text3)', borderBottom: `2px solid ${tab === t.id ? 'var(--violet)' : 'transparent'}`, marginBottom: '-8px', paddingBottom: '6px', fontSize: '.92rem' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'paiva'     && <PaivaTab location={location} />}
      {tab === 'historia'  && <HistoriaTab location={location} />}
      {tab === 'vika'      && <VikaTab location={location} />}
      {tab === 'poikkeus'  && (isAdmin || isValvoja) && <PoikkeusTab location={location} />}
      {tab === 'tarkastus' && (isAdmin || isValvoja) && <TarkastusTab location={location} />}
      {tab === 'tehtavat'  && isAdmin && <TehtavatAdminTab location={location} />}
      {tab === 'aikataulu' && isAdmin && <AikatauluTab location={location} onLocationUpdated={loadLocation} />}
    </div>
  )
}
