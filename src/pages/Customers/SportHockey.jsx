import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Edit2, ChevronRight, Lock } from 'lucide-react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'

// ── Pipeline ──────────────────────────────────────────────────────────────────

const STAGES = ['Potentiaalinen asiakas', 'Otettu yhteyttä', 'Tarjous lähetetty', 'Tarjous Hyväksytty', 'Tarjous Hylätty', 'Sopimus tehty']

// Linear forward progression (Hylätty is a side-track, not in the flow)
const STAGE_FLOW = ['Potentiaalinen asiakas', 'Otettu yhteyttä', 'Tarjous lähetetty', 'Tarjous Hyväksytty', 'Sopimus tehty']

const STAGE_STYLE = {
  'Potentiaalinen asiakas': { bg: 'var(--bg2)',           color: 'var(--text3)',   border: 'var(--border)' },
  'Otettu yhteyttä':        { bg: '#EFF6FF',              color: '#3B82F6',        border: '#BFDBFE' },
  'Tarjous lähetetty':      { bg: '#FDF4FF',              color: '#A855F7',        border: '#E9D5FF' },
  'Tarjous Hyväksytty':     { bg: '#F0FDF4',              color: '#16A34A',        border: '#BBF7D0' },
  'Tarjous Hylätty':        { bg: '#FEF2F2',              color: '#EF4444',        border: '#FECACA' },
  'Sopimus tehty':          { bg: 'var(--green-subtle)',  color: 'var(--green)',   border: 'var(--green)' },
}

const emptyPipe = { team_name: '', league: '', city: '', contact_name: '', contact_email: '', contact_phone: '', stage: 'Potentiaalinen asiakas', seller_name: '', notes: '', next_action: '', next_action_date: '', admin_only: false }

function StageBadge({ stage }) {
  const s = STAGE_STYLE[stage] || STAGE_STYLE['Prospekti']
  return (
    <span style={{ display: 'inline-block', padding: '.18em .65em', borderRadius: 99, fontSize: '.72rem', fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

function Pipeline() {
  const { profile, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyPipe)
  const [saving, setSaving] = useState(false)
  const [tableError, setTableError] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabaseAdmin
      .from('sport_hockey_pipeline')
      .select('*')
      .order('created_at', { ascending: false })
    if (error?.code === 'PGRST205' || error?.message?.includes('not found')) {
      setTableError(true)
    } else {
      setRows(data || [])
      setTableError(false)
    }
    setLoading(false)
  }

  const myName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
  function openNew() { setEditing(null); setForm({ ...emptyPipe, seller_name: myName }); setShowModal(true) }
  function openEdit(r) {
    setEditing(r.id)
    setForm({
      team_name: r.team_name || '',
      league: r.league || '',
      city: r.city || '',
      contact_name: r.contact_name || '',
      contact_email: r.contact_email || '',
      contact_phone: r.contact_phone || '',
      stage: r.stage || 'Potentiaalinen asiakas',
      seller_name: r.seller_name || '',
      notes: r.notes || '',
      next_action: r.next_action || '',
      next_action_date: r.next_action_date || '',
      admin_only: r.admin_only || false,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.team_name.trim()) return
    setSaving(true)
    const payload = {
      team_name: form.team_name.trim(),
      league: form.league.trim() || null,
      city: form.city.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      stage: form.stage || 'Potentiaalinen asiakas',
      seller_name: form.seller_name.trim() || null,
      notes: form.notes.trim() || null,
      next_action: form.next_action.trim() || null,
      next_action_date: form.next_action_date || null,
      admin_only: form.admin_only || false,
    }
    let saveError = null
    if (editing) {
      const { error } = await supabaseAdmin.from('sport_hockey_pipeline').update(payload).eq('id', editing)
      saveError = error
    } else {
      const { error } = await supabaseAdmin.from('sport_hockey_pipeline').insert(payload)
      saveError = error
    }
    setSaving(false)
    if (saveError) {
      alert('Tallennus epäonnistui: ' + saveError.message)
      return
    }
    setShowModal(false)
    fetchData()
  }

  async function handleStageChange(id, stage) {
    await supabaseAdmin.from('sport_hockey_pipeline').update({ stage }).eq('id', id)
    setRows(r => r.map(row => row.id === id ? { ...row, stage } : row))
  }

  async function handleAdvanceStage(row) {
    const idx = STAGE_FLOW.indexOf(row.stage)
    if (idx === -1 || idx >= STAGE_FLOW.length - 1) return
    const next = STAGE_FLOW[idx + 1]
    await handleStageChange(row.id, next)
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko?')) return
    await supabaseAdmin.from('sport_hockey_pipeline').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r => {
    if (r.admin_only && !isAdmin) return false
    const q = search.toLowerCase()
    const matchSearch = !q || r.team_name?.toLowerCase().includes(q) || r.contact_name?.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q)
    const matchStage = !stageFilter || r.stage === stageFilter
    return matchSearch && matchStage
  })

  const counts = {}
  STAGES.forEach(s => { counts[s] = rows.filter(r => r.stage === s).length })

  if (tableError) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>⚠️</div>
        <div style={{ fontWeight: 700, marginBottom: '.5rem' }}>Pipeline-taulu puuttuu tietokannasta</div>
        <div style={{ color: 'var(--text3)', fontSize: '.85rem', marginBottom: '1rem' }}>Aja tämä SQL Supabase-dashboardissa (SQL Editor):</div>
        <pre style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', textAlign: 'left', fontSize: '.75rem', overflowX: 'auto', userSelect: 'all' }}>{`CREATE TABLE public.sport_hockey_pipeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_name text NOT NULL,
  league text,
  city text,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage text NOT NULL DEFAULT 'Potentiaalinen asiakas',
  seller_name text,
  notes text,
  next_action text,
  next_action_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sport_hockey_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON sport_hockey_pipeline FOR ALL USING (true) WITH CHECK (true);`}</pre>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={fetchData}>Yritä uudelleen</button>
      </div>
    )
  }

  return (
    <>
      {/* Stage filter pills */}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => setStageFilter('')}
          style={{ padding: '.25em .8em', borderRadius: 99, fontSize: '.78rem', fontWeight: 600, border: '1px solid var(--border)', background: !stageFilter ? 'var(--violet)' : 'var(--bg)', color: !stageFilter ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>
          Kaikki ({rows.length})
        </button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setStageFilter(stageFilter === s ? '' : s)}
            style={{ padding: '.25em .8em', borderRadius: 99, fontSize: '.78rem', fontWeight: 600, border: `1px solid ${STAGE_STYLE[s].border}`, background: stageFilter === s ? STAGE_STYLE[s].bg : 'var(--bg)', color: STAGE_STYLE[s].color, cursor: 'pointer', opacity: counts[s] === 0 ? 0.45 : 1 }}>
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '.5rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae joukkueella, yhteyshenkilöllä, kaupungilla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Uusi liidi</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Joukkue</th><th>Sarja / Kaupunki</th><th>Yhteyshenkilö</th>
              <th>Vaihe</th><th></th>
              <th>Myyjä</th><th>Seuraava toimenpide</th><th>Pvm</th><th>Muistiinpanot</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Ei liidejä.</td></tr>
            ) : filtered.map(r => {
              const flowIdx = STAGE_FLOW.indexOf(r.stage)
              const canAdvance = flowIdx !== -1 && flowIdx < STAGE_FLOW.length - 1
              return (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>
                  {r.admin_only && <Lock size={11} style={{ marginRight: 4, color: 'var(--text3)', verticalAlign: 'middle', display: 'inline' }} title="Näkyy vain adminille" />}
                  {r.team_name}
                </td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>
                  {[r.league, r.city].filter(Boolean).join(' / ') || '—'}
                </td>
                <td style={{ fontSize: '.82rem' }}>
                  {r.contact_name || '—'}
                  {r.contact_email && <div style={{ color: 'var(--text3)', fontSize: '.75rem' }}>{r.contact_email}</div>}
                </td>
                <td>
                  <select
                    value={r.stage}
                    onChange={e => handleStageChange(r.id, e.target.value)}
                    style={{ border: `1px solid ${STAGE_STYLE[r.stage]?.border || 'var(--border)'}`, background: STAGE_STYLE[r.stage]?.bg || 'var(--bg)', color: STAGE_STYLE[r.stage]?.color || 'var(--text)', borderRadius: 99, padding: '.2em .7em', fontSize: '.73rem', fontWeight: 700, cursor: 'pointer' }}>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ paddingLeft: 0 }}>
                  <button
                    title={canAdvance ? `Siirrä → ${STAGE_FLOW[flowIdx + 1]}` : 'Viimeinen vaihe'}
                    disabled={!canAdvance}
                    onClick={() => handleAdvanceStage(r)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: canAdvance ? '1px solid var(--violet)' : '1px solid var(--border)', background: canAdvance ? 'var(--violet)' : 'var(--bg2)', color: canAdvance ? '#fff' : 'var(--text3)', cursor: canAdvance ? 'pointer' : 'default', padding: 0 }}>
                    <ChevronRight size={14} />
                  </button>
                </td>
                <td style={{ fontSize: '.82rem', color: 'var(--text3)' }}>{r.seller_name || '—'}</td>
                <td style={{ fontSize: '.82rem', color: 'var(--text2)' }}>{r.next_action || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                  {r.next_action_date ? new Date(r.next_action_date).toLocaleDateString('fi-FI') : '—'}
                </td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 160 }}>{r.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.3rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            )})}

          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Muokkaa liidiä' : 'Uusi liidi'} onClose={() => setShowModal(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Joukkueen nimi *</label>
              <input className="input-field" value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} autoFocus />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Sarja</label><input className="input-field" value={form.league} onChange={e => setForm(f => ({ ...f, league: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Kaupunki</label><input className="input-field" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Vaihe</label>
                <select className="input-field" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Myyjä</label>
                <input className="input-field" placeholder="Etunimi Sukunimi" value={form.seller_name} onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))} />
              </div>
            </div>
            <div className="input-group"><label className="input-label">Yhteyshenkilö</label><input className="input-field" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Email</label><input className="input-field" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Puhelin</label><input className="input-field" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Seuraava toimenpide</label><input className="input-field" placeholder="esim. Soita maanantaina" value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Päivämäärä</label><input className="input-field" type="date" value={form.next_action_date} onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))} /></div>
            </div>
            <div className="input-group"><label className="input-label">Muistiinpanot</label><textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} /></div>
            {isAdmin && (
              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={form.admin_only}
                    onChange={e => setForm(f => ({ ...f, admin_only: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.88rem', fontWeight: 600, color: form.admin_only ? 'var(--text2)' : 'var(--text3)' }}>
                    <Lock size={13} />
                    Näkyy vain adminille
                  </span>
                </label>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Joukkueet ─────────────────────────────────────────────────────────────────

const emptyTeam = { team_name: '', league: '', city: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }

function Joukkueet() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyTeam)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('sport_hockey').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.team_name.trim()) return
    setSaving(true)
    await supabaseAdmin.from('sport_hockey').insert({
      team_name: form.team_name.trim(),
      league: form.league.trim() || null,
      city: form.city.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(emptyTeam)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko joukkue?')) return
    await supabaseAdmin.from('sport_hockey').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r =>
    r.team_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.league?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae joukkueella, sarjalla, kaupungilla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyTeam); setShowModal(true) }}>
          <Plus size={16} /> Uusi joukkue
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Joukkue</th><th>Sarja</th><th>Kaupunki</th><th>Yhteyshenkilö</th>
              <th>Email</th><th>Puhelin</th><th>Lisätty</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">Ei joukkueita.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.team_name}</td>
                <td>{r.league || '—'}</td>
                <td>{r.city || '—'}</td>
                <td>{r.contact_name || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.contact_email || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.contact_phone || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi joukkue" onClose={() => setShowModal(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Joukkueen nimi</label>
              <input className="input-field" name="team_name" value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Sarja</label><input className="input-field" value={form.league} onChange={e => setForm(f => ({ ...f, league: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Kaupunki</label><input className="input-field" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div className="input-group"><label className="input-label">Yhteyshenkilö</label><input className="input-field" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Email</label><input className="input-field" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Puhelin</label><input className="input-field" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="input-group"><label className="input-label">Muistiinpanot</label><textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Jääkiekon kesäryhmä ───────────────────────────────────────────────────────

const emptyPlayer = { nimi: '', syntymavuosi: '', aloitus: '', lopetus: '', viikot: '', eur_per_vko: '', laskutustapa: '', maksaja: '', summa_yhteensa: '', muuta: '' }

const LASKUTUS = ['lasku', 'käteinen', 'kortti', 'muu']

function fmt(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function calcWeeks(aloitus, lopetus) {
  if (!aloitus || !lopetus) return null
  const start = new Date(aloitus)
  const end = new Date(lopetus)
  const diffDays = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  return Math.round(diffDays / 7)
}

function calcDerived(f) {
  const viikot = f.aloitus && f.lopetus ? String(calcWeeks(f.aloitus, f.lopetus)) : f.viikot
  const vkNum = parseInt(viikot)
  const eurNum = parseFloat(f.eur_per_vko)
  const summa = (!isNaN(vkNum) && !isNaN(eurNum)) ? String(+(vkNum * eurNum).toFixed(2)) : f.summa_yhteensa
  return { ...f, viikot, summa_yhteensa: summa }
}

function Kesaryhma() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyPlayer)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('sport_jaakiekko_kesaryhma').select('*').order('syntymavuosi').order('nimi')
    // Compute derived fields for display (viikot from dates, summa from viikot×€/vko)
    setRows((data || []).map(r => {
      const viikot = r.aloitus && r.lopetus ? calcWeeks(r.aloitus, r.lopetus) : (r.viikot ?? null)
      const eurNum = parseFloat(r.eur_per_vko)
      const summa_yhteensa = viikot != null && !isNaN(eurNum) ? +(viikot * eurNum).toFixed(2) : (r.summa_yhteensa ?? 0)
      return { ...r, viikot, summa_yhteensa }
    }))
    setLoading(false)
  }

  function openEdit(r) {
    setEditing(r.id)
    const base = {
      nimi: r.nimi || '',
      syntymavuosi: r.syntymavuosi || '',
      aloitus: r.aloitus || '',
      lopetus: r.lopetus || '',
      viikot: r.viikot != null ? String(r.viikot) : '',
      eur_per_vko: r.eur_per_vko != null ? String(r.eur_per_vko) : '',
      laskutustapa: r.laskutustapa || '',
      maksaja: r.maksaja || '',
      summa_yhteensa: r.summa_yhteensa != null ? String(r.summa_yhteensa) : '',
      muuta: r.muuta || '',
    }
    setForm(calcDerived(base))
    setShowModal(true)
  }

  function setFormDerived(updater) {
    setForm(f => calcDerived(updater(f)))
  }

  async function handleSave() {
    if (!form.nimi.trim()) return
    setSaving(true)
    const derived = calcDerived(form)
    const payload = {
      nimi: derived.nimi.trim(),
      syntymavuosi: derived.syntymavuosi.trim() || null,
      aloitus: derived.aloitus || null,
      lopetus: derived.lopetus || null,
      viikot: derived.viikot !== '' ? parseInt(derived.viikot) : null,
      eur_per_vko: derived.eur_per_vko !== '' ? parseFloat(derived.eur_per_vko) : 0,
      laskutustapa: derived.laskutustapa || null,
      maksaja: derived.maksaja.trim() || null,
      summa_yhteensa: derived.summa_yhteensa !== '' ? parseFloat(derived.summa_yhteensa) : 0,
      muuta: derived.muuta.trim() || null,
    }
    if (editing) {
      await supabaseAdmin.from('sport_jaakiekko_kesaryhma').update(payload).eq('id', editing)
    } else {
      await supabaseAdmin.from('sport_jaakiekko_kesaryhma').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(emptyPlayer)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko pelaaja?')) return
    await supabaseAdmin.from('sport_jaakiekko_kesaryhma').delete().eq('id', id)
    fetchData()
  }

  const filtered = rows.filter(r =>
    !search ||
    r.nimi?.toLowerCase().includes(search.toLowerCase()) ||
    r.syntymavuosi?.includes(search) ||
    r.laskutustapa?.toLowerCase().includes(search.toLowerCase())
  )

  const totalSumma = filtered.reduce((s, r) => s + (r.summa_yhteensa || 0), 0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae nimellä tai vuosiluokalla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyPlayer); setShowModal(true) }}>
            <Plus size={16} /> Lisää pelaaja
          </button>
        )}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Pelaajia</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Summa yht.</div>
          <div className="stat-value gold">{fmt(totalSumma)}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PELAAJA</th>
              <th style={{ textAlign: 'center' }}>S.VUOSI</th>
              <th>ALOITUS</th>
              <th>LOPETUS</th>
              <th style={{ textAlign: 'center' }}>VIIKOT</th>
              <th style={{ textAlign: 'right' }}>€/VKO</th>
              <th>LASKUTUSTAPA</th>
              <th>MAKSAJA</th>
              <th style={{ textAlign: 'right' }}>SUMMA</th>
              <th>MUUTA</th>
              {isAdmin && <th style={{ textAlign: 'center' }}>TOIMINNOT</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 11 : 10} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={isAdmin ? 11 : 10} className="table-empty">Ei pelaajia.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.nimi}</td>
                <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>{r.syntymavuosi || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.aloitus ? new Date(r.aloitus).toLocaleDateString('fi-FI') : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem' }}>{r.lopetus ? new Date(r.lopetus).toLocaleDateString('fi-FI') : '—'}</td>
                <td style={{ textAlign: 'center' }}>{r.viikot || '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.eur_per_vko > 0 ? fmt(r.eur_per_vko) : '—'}</td>
                <td>{r.laskutustapa || '—'}</td>
                <td>{r.maksaja || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: r.summa_yhteensa > 0 ? 'var(--violet)' : 'var(--text3)' }}>
                  {r.summa_yhteensa > 0 ? fmt(r.summa_yhteensa) : '—'}
                </td>
                <td style={{ color: 'var(--text3)', fontSize: '.75rem', maxWidth: 160, whiteSpace: 'pre-wrap' }}>{r.muuta || '—'}</td>
                {isAdmin && (
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={13} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && !loading && (
            <tfoot>
              <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                <td colSpan={isAdmin ? 8 : 8}>Summa yht. ({filtered.length} pelaajaa)</td>
                <td style={{ textAlign: 'right', color: 'var(--violet)' }}>{fmt(totalSumma)}</td>
                <td />{isAdmin && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Muokkaa pelaajaa' : 'Lisää pelaaja'} onClose={() => setShowModal(false)} wide footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Nimi</label><input className="input-field" value={form.nimi} onChange={e => setForm(f => ({ ...f, nimi: e.target.value }))} autoFocus /></div>
              <div className="input-group"><label className="input-label">Syntymävuosi</label><input className="input-field" placeholder="2005" value={form.syntymavuosi} onChange={e => setForm(f => ({ ...f, syntymavuosi: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Aloitus</label><input className="input-field" type="date" value={form.aloitus} onChange={e => setFormDerived(f => ({ ...f, aloitus: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Lopetus</label><input className="input-field" type="date" value={form.lopetus} onChange={e => setFormDerived(f => ({ ...f, lopetus: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Viikot <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(lasketaan automaattisesti)</span></label>
                <input className="input-field" type="number" min="0" value={form.viikot} readOnly style={{ background: 'var(--bg2)', color: 'var(--text2)' }} />
              </div>
              <div className="input-group"><label className="input-label">€/vko</label><input className="input-field" type="number" step="0.01" min="0" value={form.eur_per_vko} onChange={e => setFormDerived(f => ({ ...f, eur_per_vko: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Laskutustapa</label>
                <select className="input-field" value={form.laskutustapa} onChange={e => setForm(f => ({ ...f, laskutustapa: e.target.value }))}>
                  <option value="">—</option>
                  {LASKUTUS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="input-group"><label className="input-label">Maksaja</label><input className="input-field" placeholder="itse / seura / ..." value={form.maksaja} onChange={e => setForm(f => ({ ...f, maksaja: e.target.value }))} /></div>
            </div>
            <div className="input-group">
              <label className="input-label">Summa yhteensä (€) <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(lasketaan automaattisesti: viikot × €/vko)</span></label>
              <input className="input-field" type="number" step="0.01" min="0" value={form.summa_yhteensa} readOnly style={{ background: 'var(--bg2)', color: 'var(--violet)', fontWeight: 700 }} />
            </div>
            <div className="input-group"><label className="input-label">Muuta</label><textarea className="input-field" rows={3} value={form.muuta} onChange={e => setForm(f => ({ ...f, muuta: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Pääkomponentti ─────────────────────────────────────────────────────────────

export default function SportHockey() {
  const [tab, setTab] = useState('joukkueet')

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sport &amp; Hockey</h1>
          <p className="page-subtitle">Joukkueet, pipeline ja jääkiekon kesäryhmä</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`sub-tab${tab === 'joukkueet' ? ' active' : ''}`} onClick={() => setTab('joukkueet')}>Joukkueet</button>
        <button className={`sub-tab${tab === 'pipeline' ? ' active' : ''}`} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button className={`sub-tab${tab === 'kesaryhma' ? ' active' : ''}`} onClick={() => setTab('kesaryhma')}>Jääkiekon kesäryhmä</button>
      </div>

      {tab === 'joukkueet' && <Joukkueet />}
      {tab === 'pipeline' && <Pipeline />}
      {tab === 'kesaryhma' && <Kesaryhma />}
    </div>
  )
}
