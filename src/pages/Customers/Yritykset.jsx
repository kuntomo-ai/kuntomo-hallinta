import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'

const empty = { name: '', contact_person: '', email: '', phone: '', city: '', notes: '' }

export default function Yritykset() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [companyEmployees, setCompanyEmployees] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  async function handleRowClick(row) {
    setSelected(row)
    const { data } = await supabase
      .from('company_employees')
      .select('*, employees(*)')
      .eq('company_id', row.id)
    setCompanyEmployees(data || [])
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('companies').insert({
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  const filtered = rows.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Yritykset</h1>
          <p className="page-subtitle">Yritysasiakkaat ja yhteystiedot</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi yritys
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input className="search-input" placeholder="Hae yrityksellä, yhteyshenkilöllä, kaupungilla..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Yritys</th>
                <th>Yhteyshenkilö</th>
                <th>Sähköposti</th>
                <th>Puhelin</th>
                <th>Kaupunki</th>
                <th>Lisätty</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-empty">Ladataan...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">Ei yrityksiä.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} onClick={() => handleRowClick(r)} style={{ cursor: 'pointer', background: selected?.id === r.id ? 'var(--violet-subtle)' : undefined }}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.contact_person || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.email || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{r.phone || '—'}</td>
                  <td>{r.city || '—'}</td>
                  <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>{selected.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1.25rem' }}>
              {selected.contact_person && <div style={{ fontSize: '.83rem' }}><span style={{ color: 'var(--text3)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Yhteyshenkilö</span><br />{selected.contact_person}</div>}
              {selected.email && <div style={{ fontSize: '.83rem' }}><span style={{ color: 'var(--text3)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email</span><br />{selected.email}</div>}
              {selected.phone && <div style={{ fontSize: '.83rem' }}><span style={{ color: 'var(--text3)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Puhelin</span><br />{selected.phone}</div>}
              {selected.city && <div style={{ fontSize: '.83rem' }}><span style={{ color: 'var(--text3)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kaupunki</span><br />{selected.city}</div>}
              {selected.notes && <div style={{ fontSize: '.83rem', color: 'var(--text2)' }}>{selected.notes}</div>}
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.75rem' }}>Henkilöstö</h4>
            {companyEmployees.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei liitettyjä henkilöitä.</p>
            ) : companyEmployees.map(ce => {
              const emp = ce.employees
              return emp ? (
                <div key={ce.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="emp-avatar" style={{ width: 28, height: 28, fontSize: '.7rem' }}>{(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.83rem' }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{emp.title || emp.role}</div>
                  </div>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Uusi yritys" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Yrityksen nimi</label>
              <input className="input-field" name="name" placeholder="Yritys Oy" value={form.name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Yhteyshenkilö</label>
              <input className="input-field" name="contact_person" placeholder="Etunimi Sukunimi" value={form.contact_person} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Sähköposti</label>
                <input className="input-field" name="email" type="email" placeholder="yhteys@yritys.fi" value={form.email} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Puhelin</label>
                <input className="input-field" name="phone" placeholder="+358 40 123 4567" value={form.phone} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kaupunki</label>
              <input className="input-field" name="city" placeholder="Helsinki" value={form.city} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={3} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
