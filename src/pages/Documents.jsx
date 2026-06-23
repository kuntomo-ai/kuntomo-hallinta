import { useEffect, useState, useRef } from 'react'
import { Plus, FileText, Download, Trash2, Upload, Lock, FileIcon, Eye, X } from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import { useSignedUrl, getSignedUrl } from '../lib/signedUrl'

const DOC_TYPES = ['Tuloslaskelma', 'Tase', 'Sopimus', 'Ohje', 'Tiedote', 'Kokouspöytäkirja', 'Muu']
const FILTER_TYPES = ['Kaikki', ...DOC_TYPES]

const ROLES = ['all', 'hallitus', 'terapia_valmennus', 'myynti', 'huolto', 'sport', 'respa']
const ROLE_LABELS = {
  all: 'Kaikille',
  hallitus: 'Hallitus',
  terapia_valmennus: 'Terapia & Valmennus',
  myynti: 'Myynti',
  huolto: 'Huolto',
  sport: 'Sport',
  respa: 'Respa',
}

const empty = { title: '', description: '', document_type: 'Muu', period: '', visible_to: 'all' }

function fileIcon(name) {
  if (!name) return <FileText size={26} style={{ color: 'var(--violet)' }} />
  const ext = name.split('.').pop().toLowerCase()
  return <FileIcon size={26} style={{ color: ext === 'pdf' ? '#e63946' : ext === 'xlsx' || ext === 'xls' ? '#2a9d8f' : 'var(--violet)' }} />
}

function PreviewOverlay({ doc, onClose }) {
  const ext = doc.file_name ? doc.file_name.split('.').pop().toLowerCase() : ''
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
  const isPdf = ext === 'pdf'
  const fileUrl = useSignedUrl('documents', doc.file_url)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.72)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius)',
        width: '100%', maxWidth: 900, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,.4)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.75rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '.95rem' }}>{doc.title}</span>
            {doc.file_name && <span style={{ marginLeft: '.5rem', fontSize: '.78rem', color: 'var(--text3)' }}>{doc.file_name}</span>}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <a href={fileUrl || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" aria-disabled={!fileUrl}>
              <Download size={13} /> Lataa
            </a>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '.3rem' }}><X size={16} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)' }}>
          {!fileUrl && (
            <div style={{ color: 'var(--text3)', padding: '3rem' }}>Ladataan…</div>
          )}
          {fileUrl && isPdf && (
            <iframe
              src={fileUrl}
              title={doc.title}
              style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
            />
          )}
          {fileUrl && isImage && (
            <img
              src={fileUrl}
              alt={doc.title}
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          )}
          {fileUrl && !isPdf && !isImage && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
              <FileIcon size={48} style={{ marginBottom: '1rem', color: 'var(--violet)' }} />
              <div style={{ fontWeight: 600, marginBottom: '.5rem' }}>{doc.file_name}</div>
              <div style={{ fontSize: '.82rem', marginBottom: '1.25rem' }}>Tiedostotyyppiä ei voi esikatsella suoraan.</div>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <Download size={14} /> Lataa tiedosto
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Documents() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [typeFilter, setTypeFilter] = useState('Kaikki')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('kirjanpito_documents')
      .select('*')
      .order('created_at', { ascending: false })

    const docs = data || []

    // Resolve uploader names from profiles table
    const uploaderIds = [...new Set(docs.filter(d => d.uploaded_by).map(d => d.uploaded_by))]
    const nameMap = {}
    if (uploaderIds.length) {
      const { data: profileRows } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', uploaderIds)
      profileRows?.forEach(p => {
        nameMap[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || null
      })
    }

    const withNames = docs.map(d => ({ ...d, uploader_name: nameMap[d.uploaded_by] ?? null }))

    const visible = withNames.filter(d => {
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
    setSaveError('')

    // file_url/file_path now store the storage object key (e.g. "1780..._foo.pdf").
    // Signed URLs are generated server-side at view time via /api/storage/signed-url.
    let file_url = null
    let file_name = null

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${Date.now()}-${safeName}`
      const { error: uploadError } = await supabaseAdmin.storage.from('documents').upload(path, file)
      if (uploadError) {
        setSaveError('Tiedoston lataus epäonnistui: ' + uploadError.message)
        setUploading(false)
        return
      }
      file_url = path
      file_name = file.name
    }

    const { error: insertError } = await supabaseAdmin.from('kirjanpito_documents').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      document_type: form.document_type,
      period: form.period.trim() || null,
      visible_to: form.visible_to,
      file_url,
      file_name,
      file_path: file_url,
      uploaded_by: profile?.id ?? null,
    })

    setUploading(false)
    if (insertError) { setSaveError('Tallennus epäonnistui: ' + insertError.message); return }
    setShowModal(false)
    setForm(empty)
    setFile(null)
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Poistetaanko dokumentti?')) return
    await supabaseAdmin.from('kirjanpito_documents').delete().eq('id', id)
    fetchData()
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
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
                  {r.uploader_name && ` · ${r.uploader_name}`}
                  {r.file_name && ` · ${r.file_name}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                {r.file_url && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setPreviewDoc(r)}>
                    <Eye size={13} /> Esikatselu
                  </button>
                )}
                {r.file_url && (
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Lataa"
                    onClick={async () => {
                      const u = await getSignedUrl('documents', r.file_url)
                      if (u) window.open(u, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    <Download size={13} />
                  </button>
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

      {previewDoc && <PreviewOverlay doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {showModal && isAdmin && (
        <Modal title="Uusi dokumentti" onClose={() => { setShowModal(false); setSaveError('') }} footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowModal(false); setSaveError('') }}>Peruuta</button>
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
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--violet)' : file ? 'var(--violet)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'var(--violet-subtle)' : file ? 'var(--violet-subtle)' : 'var(--bg2)',
                  transition: 'all .15s',
                }}>
                <Upload size={22} style={{ color: (file || dragOver) ? 'var(--violet)' : 'var(--text3)', marginBottom: '.4rem' }} />
                <div style={{ fontSize: '.83rem', color: (file || dragOver) ? 'var(--violet)' : 'var(--text3)', fontWeight: (file || dragOver) ? 600 : 400 }}>
                  {dragOver ? 'Pudota tiedosto tähän' : file ? file.name : 'Klikkaa tai vedä tiedosto tähän'}
                </div>
                {file && !dragOver && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text4)', marginTop: '.25rem' }}>
                    {(file.size / 1024).toFixed(0)} KB · <span
                      style={{ color: 'var(--red)', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setFile(null) }}>Poista</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
            </div>
            {saveError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
                ⚠️ {saveError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
