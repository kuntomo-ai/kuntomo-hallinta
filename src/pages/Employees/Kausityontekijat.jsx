import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import EmployeesNav from '../../components/EmployeesNav'

const SALIT = ['Etu-Lyötty', 'Kempele', 'Linnakangas']
const KOOT  = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const empty = {
  etunimi: '', sukunimi: '', sahkoposti: '',
  tyoaika_alkaa: '', tyoaika_paattyy: '',
  sali: '', sopimus: false, verokortti: false,
  kesatyoseteli: false, paidan_koko: 'S', huomiot: '',
  liite1: '', liite2: '',
}

function Badge({ val }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em',
      background: val ? 'var(--violet)' : 'var(--bg2)',
      color: val ? '#fff' : 'var(--text3)',
    }}>
      {val ? 'Kyllä' : 'Ei'}
    </span>
  )
}

function RadioGroup({ label, name, value, onChange }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '.25rem' }}>
        {[true, false].map(v => (
          <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.85rem' }}>
            <input
              type="radio"
              name={name}
              checked={value === v}
              onChange={() => onChange(v)}
              style={{ accentColor: 'var(--violet)', width: 15, height: 15 }}
            />
            {v ? 'Kyllä' : 'Ei'}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function Kausityontekijat() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('perustiedot')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('kausityontekijat')
      .select('*')
      .order('sukunimi')
      .order('etunimi')
    setRows(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(empty)
    setActiveTab('perustiedot')
    setShowModal(true)
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      etunimi:        r.etunimi || '',
      sukunimi:       r.sukunimi || '',
      sahkoposti:     r.sahkoposti || '',
      tyoaika_alkaa:  r.tyoaika_alkaa || '',
      tyoaika_paattyy: r.tyoaika_paattyy || '',
      sali:           r.sali || '',
      sopimus:        !!r.sopimus,
      verokortti:     !!r.verokortti,
      kesatyoseteli:  !!r.kesatyoseteli,
      paidan_koko:    r.paidan_koko || 'S',
      huomiot:        r.huomiot || '',
      liite1:         r.liite1 || '',
      liite2:         r.liite2 || '',
    })
    setActiveTab('perustiedot')
    setShowModal(true)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSave() {
    if (!form.etunimi.trim() || !form.sukunimi.trim()) return
    setSaving(true)
    const payload = {
      etunimi:        form.etunimi.trim(),
      sukunimi:       form.sukunimi.trim(),
      sahkoposti:     form.sahkoposti.trim() || null,
      tyoaika_alkaa:  form.tyoaika_alkaa || null,
      tyoaika_paattyy: form.tyoaika_paattyy || null,
      sali:           form.sali || null,
      sopimus:        form.sopimus,
      verokortti:     form.verokortti,
      kesatyoseteli:  form.kesatyoseteli,
      paidan_koko:    form.paidan_koko || null,
      huomiot:        form.huomiot.trim() || null,
      liite1:         form.liite1.trim() || null,
      liite2:         form.liite2.trim() || null,
    }
    if (editing) {
      await supabase.from('kausityontekijat').update(payload).eq('id', editing)
    } else {
      await supabase.from('kausityontekijat').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    setEditing(null)
    fetchData()
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Poistetaanko kausityöntekijä?')) return
    await supabase.from('kausityontekijat').delete().eq('id', id)
    fetchData()
  }

  function fmtDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fi-FI')
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${r.etunimi} ${r.sukunimi}`.toLowerCase().includes(q) ||
      r.sahkoposti?.toLowerCase().includes(q) ||
      r.sali?.toLowerCase().includes(q)
    )
  })

  const TABS = [
    { key: 'perustiedot', label: 'Perustiedot' },
    { key: 'liite1', label: 'Liite 1' },
    { key: 'liite2', label: 'Liite 2' },
  ]

  return (
    <div>
      <EmployeesNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kausityöntekijät</h1>
          <p className="page-subtitle">Kausityöntekijöiden tiedot ja dokumentit.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Lisää kausityöntekijä
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="search-wrap">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Hae nimellä, sähköpostilla tai salilla..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NIMI</th>
              <th>SÄHKÖPOSTI</th>
              <th>TYÖAIKA</th>
              <th>SALI</th>
              <th>SOPIMUS</th>
              <th>VEROKORTTI</th>
              <th>KESÄTYÖSETELI</th>
              <th>PAITA</th>
              <th>HUOMIOT</th>
              <th>TOIMINNOT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="table-empty">Ladataan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Ei kausityöntekijöitä.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.etunimi} {r.sukunimi}</td>
                <td style={{ color: 'var(--text2)', fontSize: '.83rem' }}>{r.sahkoposti || '—'}</td>
                <td style={{ fontSize: '.83rem', whiteSpace: 'nowrap' }}>
                  {r.tyoaika_alkaa ? `${fmtDate(r.tyoaika_alkaa)} – ${fmtDate(r.tyoaika_paattyy)}` : '—'}
                </td>
                <td style={{ fontSize: '.83rem' }}>{r.sali || '—'}</td>
                <td><Badge val={r.sopimus} /></td>
                <td><Badge val={r.verokortti} /></td>
                <td><Badge val={r.kesatyoseteli} /></td>
                <td style={{ fontSize: '.83rem' }}>{r.paidan_koko || '—'}</td>
                <td style={{ fontSize: '.78rem', color: 'var(--text3)', maxWidth: 180 }}>{r.huomiot || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.35rem' }}>
                    {isAdmin && (
                      <>
                        <button className="btn-icon" onClick={() => openEdit(r)} title="Muokkaa">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={e => handleDelete(e, r.id)} title="Poista">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editing ? `${form.etunimi} ${form.sukunimi}` : 'Lisää kausityöntekijä'}
          onClose={() => { setShowModal(false); setEditing(null) }}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); setEditing(null) }}>Peruuta</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </button>
            </>
          }
        >
          {/* Tab nav */}
          <div style={{ display: 'flex', gap: '.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1.25rem' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '.5rem 1.1rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '.85rem',
                  fontWeight: activeTab === t.key ? 700 : 400,
                  color: activeTab === t.key ? 'var(--violet)' : 'var(--text2)',
                  borderBottom: activeTab === t.key ? '2px solid var(--violet)' : '2px solid transparent',
                  marginBottom: -2,
                  transition: 'color .15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Perustiedot */}
          {activeTab === 'perustiedot' && (
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div className="input-group">
                  <label className="input-label">Etunimi *</label>
                  <input className="input-field" name="etunimi" value={form.etunimi} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Sukunimi *</label>
                  <input className="input-field" name="sukunimi" value={form.sukunimi} onChange={handleChange} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Sähköposti</label>
                <input className="input-field" name="sahkoposti" type="email" value={form.sahkoposti} onChange={handleChange} />
              </div>
              <div className="form-grid form-grid-2">
                <div className="input-group">
                  <label className="input-label">Työaika alkaa</label>
                  <input className="input-field" name="tyoaika_alkaa" type="date" value={form.tyoaika_alkaa} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Työaika päättyy</label>
                  <input className="input-field" name="tyoaika_paattyy" type="date" value={form.tyoaika_paattyy} onChange={handleChange} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Millä salilla työ tehdään</label>
                <input className="input-field" name="sali" list="salit-list" value={form.sali} onChange={handleChange} placeholder="Esim. Kempele" />
                <datalist id="salit-list">
                  {SALIT.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="grid-cols-3">
                <RadioGroup label="Työsopimus" name="sopimus" value={form.sopimus} onChange={v => setForm(f => ({ ...f, sopimus: v }))} />
                <RadioGroup label="Verokortti" name="verokortti" value={form.verokortti} onChange={v => setForm(f => ({ ...f, verokortti: v }))} />
                <RadioGroup label="Kesätyöseteli" name="kesatyoseteli" value={form.kesatyoseteli} onChange={v => setForm(f => ({ ...f, kesatyoseteli: v }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Paidan koko</label>
                <select className="input-field" name="paidan_koko" value={form.paidan_koko} onChange={handleChange}>
                  {KOOT.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Muuta huomioitavaa</label>
                <textarea className="input-field" name="huomiot" rows={3} value={form.huomiot} onChange={handleChange} style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}

          {/* Liite 1 */}
          {activeTab === 'liite1' && (
            <div>
              <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.75rem' }}>
                Liite 1 — työsopimuksen liite. Tallentuu tähän työntekijään.
              </p>
              <textarea
                className="input-field"
                name="liite1"
                rows={18}
                value={form.liite1}
                onChange={handleChange}
                style={{ resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: '.85rem', lineHeight: 1.6 }}
                placeholder="Kirjoita tai liitä Liite 1:n sisältö tähän..."
              />
            </div>
          )}

          {/* Liite 2 */}
          {activeTab === 'liite2' && (
            <div>
              <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.75rem' }}>
                Liite 2 — työsopimuksen liite. Tallentuu tähän työntekijään.
              </p>
              <textarea
                className="input-field"
                name="liite2"
                rows={18}
                value={form.liite2}
                onChange={handleChange}
                style={{ resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: '.85rem', lineHeight: 1.6 }}
                placeholder="Kirjoita tai liitä Liite 2:n sisältö tähän..."
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
