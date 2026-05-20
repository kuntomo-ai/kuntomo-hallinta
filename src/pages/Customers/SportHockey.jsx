import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'

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
    const { data } = await supabase.from('sport_hockey').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.team_name.trim()) return
    setSaving(true)
    await supabase.from('sport_hockey').insert({
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
    await supabase.from('sport_hockey').delete().eq('id', id)
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
    const { data } = await supabase.from('sport_jaakiekko_kesaryhma').select('*').order('syntymavuosi').order('nimi')
    setRows(data || [])
    setLoading(false)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
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
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.nimi.trim()) return
    setSaving(true)
    const payload = {
      nimi: form.nimi.trim(),
      syntymavuosi: form.syntymavuosi.trim() || null,
      aloitus: form.aloitus || null,
      lopetus: form.lopetus || null,
      viikot: form.viikot !== '' ? parseInt(form.viikot) : null,
      eur_per_vko: form.eur_per_vko !== '' ? parseFloat(form.eur_per_vko) : 0,
      laskutustapa: form.laskutustapa || null,
      maksaja: form.maksaja.trim() || null,
      summa_yhteensa: form.summa_yhteensa !== '' ? parseFloat(form.summa_yhteensa) : 0,
      muuta: form.muuta.trim() || null,
    }
    if (editing) {
      await supabase.from('sport_jaakiekko_kesaryhma').update(payload).eq('id', editing)
    } else {
      await supabase.from('sport_jaakiekko_kesaryhma').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    setForm(emptyPlayer)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko pelaaja?')) return
    await supabase.from('sport_jaakiekko_kesaryhma').delete().eq('id', id)
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
          <div className="stat-label">Laskutettu yht.</div>
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
                <td colSpan={isAdmin ? 8 : 8}>Yhteensä ({filtered.length} pelaajaa)</td>
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
              <div className="input-group"><label className="input-label">Aloitus</label><input className="input-field" type="date" value={form.aloitus} onChange={e => setForm(f => ({ ...f, aloitus: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Lopetus</label><input className="input-field" type="date" value={form.lopetus} onChange={e => setForm(f => ({ ...f, lopetus: e.target.value }))} /></div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group"><label className="input-label">Viikot</label><input className="input-field" type="number" min="0" value={form.viikot} onChange={e => setForm(f => ({ ...f, viikot: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">€/vko</label><input className="input-field" type="number" step="0.01" min="0" value={form.eur_per_vko} onChange={e => setForm(f => ({ ...f, eur_per_vko: e.target.value }))} /></div>
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
            <div className="input-group"><label className="input-label">Summa yhteensä (€)</label><input className="input-field" type="number" step="0.01" min="0" value={form.summa_yhteensa} onChange={e => setForm(f => ({ ...f, summa_yhteensa: e.target.value }))} /></div>
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
          <p className="page-subtitle">Joukkueet ja jääkiekon kesäryhmä</p>
        </div>
      </div>

      <div className="sub-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`sub-tab${tab === 'joukkueet' ? ' active' : ''}`} onClick={() => setTab('joukkueet')}>Joukkueet</button>
        <button className={`sub-tab${tab === 'kesaryhma' ? ' active' : ''}`} onClick={() => setTab('kesaryhma')}>Jääkiekon kesäryhmä</button>
      </div>

      {tab === 'joukkueet' && <Joukkueet />}
      {tab === 'kesaryhma' && <Kesaryhma />}
    </div>
  )
}
