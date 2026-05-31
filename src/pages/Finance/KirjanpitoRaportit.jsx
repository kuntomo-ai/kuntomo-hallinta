import { useEffect, useState } from 'react'
import { Plus, ExternalLink, Trash2 } from 'lucide-react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import KirjanpitoNav from '../../components/KirjanpitoNav'

const DOC_TYPES = ['Tuloslaskelma', 'Tase', 'Muu']
const empty = { title: '', description: '', document_type: DOC_TYPES[0], period: '', file_url: '' }

export default function KirjanpitoRaportit() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('kirjanpito_documents').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabaseAdmin.from('kirjanpito_documents').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      document_type: form.document_type,
      period: form.period.trim() || null,
      file_url: form.file_url.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko raportti?')) return
    await supabaseAdmin.from('kirjanpito_documents').delete().eq('id', id)
    fetchData()
  }

  return (
    <div>
      <KirjanpitoNav />
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Kirjanpitoraportit</h1>
          <p className="page-subtitle">Talouden raportit ja dokumentit</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
          <Plus size={16} /> Uusi raportti
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Otsikko</th>
              <th>Tyyppi</th>
              <th>Tilikausi</th>
              <th>Kuvaus</th>
              <th>Lisätty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-empty">Ladataan...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">Ei raportteja.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.title}</td>
                <td><span className="badge badge-gray">{r.document_type}</span></td>
                <td style={{ color: 'var(--text3)' }}>{r.period || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', maxWidth: 220 }}>{r.description || '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        <ExternalLink size={13} /> Avaa
                      </a>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Uusi raportti" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Otsikko</label>
              <input className="input-field" name="title" placeholder="Raportin nimi" value={form.title} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Tyyppi</label>
                <select className="input-field" name="document_type" value={form.document_type} onChange={handleChange}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Tilikausi</label>
                <input className="input-field" name="period" placeholder="Esim. 2024" value={form.period} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={3} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
            <div className="input-group">
              <label className="input-label">URL-linkki</label>
              <input className="input-field" name="file_url" type="url" placeholder="https://..." value={form.file_url} onChange={handleChange} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
