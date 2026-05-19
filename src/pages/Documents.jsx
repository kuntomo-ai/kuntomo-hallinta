import { useEffect, useState, useRef } from 'react'
import { Plus, FileText, Download, Trash2, Upload, Lock, FileIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const DOC_TYPES = ['Tuloslaskelma', 'Tase', 'Sopimus', 'Ohje', 'Tiedote', 'Muu']
const FILTER_TYPES = ['Kaikki', ...DOC_TYPES]

const ROLES = ['all', 'hallitus', 'terapeutti', 'valmentaja', 'toimisto']
const ROLE_LABELS = {
  all: 'Kaikille',
  hallitus: 'Hallitus',
  terapeutti: 'Terapeutit',
  valmentaja: 'Valmentajat',
  toimisto: 'Toimisto',
}

const empty = { title: '', description: '', document_type: 'Muu', period: '', visible_to: 'all' }

function fileIcon(name) {
  if (!name) return <FileText size={26} style={{ color: 'var(--violet)' }} />
  const ext = name.split('.').pop().toLowerCase()
  return <FileIcon size={26} style={{ color: ext === 'pdf' ? '#e63946' : ext === 'xlsx' || ext === 'xls' ? '#2a9d8f' : 'var(--violet)' }} />
}

export default function Documents() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('Kaikki')
  const fileRef = useRef(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('kirjanpito_documents')
      .select('*')
      .order('created_at', { ascending: false })

    const visible = (data || []).filter(d => {
      if (isAdmin) return true
      if (!d.visible_to || d.visible_to === 'all') return true
      if (d.visible_to === profile?.role) return true
      return false
    })
    setRows(visible)
    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setUploading(true)

    let file_url = null
    let file_name = null

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from('documents').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        file_url = urlData.publicUrl
        file_name = file.name
      }
    }

    await supabase.from('kirjanpito_documents').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      document_type: form.document_type,
      period: form.period.trim() || null,
      visible_to: form.visible_to,
      file_url,
      file_name,
      uploaded_by: profile?.full_name || profile?.email || null,
    })

    setUploading(false)
    setShowModal(false)
    setForm(empty)
    setFile(null)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko dokumentti?')) return
    await supabase.from('kirjanpito_documents').delete().eq('id', id)
    fetchData()
  }

  const filtered = typeFilter === 'Kaikki' ? rows : rows.filter(r => r.document_type === typeFilter)

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dokumentit</h1>
          <p className="page-subtitle">Sisäiset asiakirjat ja tiedostot</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setForm(empty); setFile(null); setShowModal(true) }}>
            <Plus size={16} /> Uusi dokumentti
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTER_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '.3rem .8rem', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
            border: `1.5px solid ${typeFilter === t ? 'var(--violet)' : 'var(--border)'}`,
            background: typeFilter === t ? 'var(--violet-subtle)' : 'transparent',
            color: typeFilter === t ? 'var(--violet)' : 'var(--text3)',
            cursor: 'pointer',
          }}>{t}</button>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>Ladataan...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>Ei dokumentteja.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filtered.map(r => (
            <div key={r.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flexShrink: 0 }}>{fileIcon(r.file_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', flexWrap: 'wrap', marginBottom: '.15rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '.95rem' }}>{r.title}</span>
                  <span className="badge badge-gray">{r.document_type}</span>
                  {r.period && (
                    <span style={{ fontSize: '.72rem', color: 'var(--text3)', fontWeight: 500 }}>{r.period}</span>
                  )}
                  {r.visible_to && r.visible_to !== 'all' && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '.2rem',
                      fontSize: '.68rem', fontWeight: 700, color: 'var(--violet)',
                      background: 'var(--violet-subtle)', padding: '.1rem .5rem', borderRadius: 10,
                    }}>
                      <Lock size={9} /> {ROLE_LABELS[r.visible_to] || r.visible_to}
                    </span>
                  )}
                </div>
                {r.description && (
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.15rem' }}>{r.description}</div>
                )}
                <div style={{ fontSize: '.7rem', color: 'var(--text4)' }}>
                  {new Date(r.created_at).toLocaleDateString('fi-FI')}
                  {r.uploaded_by && ` · ${r.uploaded_by}`}
                  {r.file_name && ` · ${r.file_name}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                {r.file_url && (
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    <Download size={13} /> Lataa
                  </a>
                )}
                {isAdmin && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && isAdmin && (
        <Modal title="Uusi dokumentti" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={uploading || !form.title.trim()}>
              {uploading ? 'Tallennetaan...' : 'Tallenna'}
            </button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Otsikko *</label>
              <input className="input-field" name="title" placeholder="Dokumentin nimi" value={form.title} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Tyyppi</label>
                <select className="input-field" name="document_type" value={form.document_type} onChange={handleChange}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Ajanjakso</label>
                <input className="input-field" name="period" placeholder="Esim. 2024" value={form.period} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kuvaus</label>
              <textarea className="input-field" name="description" rows={2} value={form.description} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>

            {/* Visibility */}
            <div className="input-group">
              <label className="input-label">Näkyvyys</label>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {ROLES.map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm(f => ({ ...f, visible_to: r }))}
                    style={{
                      padding: '.3rem .75rem', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
                      border: `1.5px solid ${form.visible_to === r ? 'var(--violet)' : 'var(--border)'}`,
                      background: form.visible_to === r ? 'var(--violet-subtle)' : 'transparent',
                      color: form.visible_to === r ? 'var(--violet)' : 'var(--text3)',
                      cursor: 'pointer',
                    }}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* File upload */}
            <div className="input-group">
              <label className="input-label">Tiedosto</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? 'var(--violet)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: file ? 'var(--violet-subtle)' : 'var(--bg2)',
                  transition: 'all .15s',
                }}>
                <Upload size={22} style={{ color: file ? 'var(--violet)' : 'var(--text3)', marginBottom: '.4rem' }} />
                <div style={{ fontSize: '.83rem', color: file ? 'var(--violet)' : 'var(--text3)', fontWeight: file ? 600 : 400 }}>
                  {file ? file.name : 'Klikkaa valitaksesi tiedoston'}
                </div>
                {file && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text4)', marginTop: '.25rem' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
