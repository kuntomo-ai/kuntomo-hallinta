import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabaseAdmin } from '../lib/supabase'
import logo from '../logo.svg'

// view: 'landing' | 'fault-form' | 'success'

export default function LaiteVika() {
  const { id } = useParams()

  const [device,     setDevice]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [notFound,   setNotFound]   = useState(false)
  const [view,       setView]       = useState('landing')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState('')

  const [form, setForm] = useState({ nimi: '', puhelin: '', email: '', kuvaus: '' })

  useEffect(() => {
    supabaseAdmin
      .from('laiteluettelo_items')
      .select('id, name, sijainti, device_number, ohjevideo_url')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setDevice(data)
        setLoading(false)
      })
  }, [id])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nimi.trim() || !form.kuvaus.trim()) return
    setSubmitting(true)
    setSubmitErr('')

    const { error: insErr } = await supabaseAdmin.from('laite_huoltohistoria').insert({
      laite_id:           id,
      kuvaus:             form.kuvaus.trim(),
      ilmoitettu_by:      form.nimi.trim(),
      ilmoittaja_puhelin: form.puhelin.trim() || null,
      ilmoittaja_email:   form.email.trim() || null,
      source:             'qr',
      tehty:              false,
    })

    if (insErr) {
      setSubmitErr('Lähetys epäonnistui. Yritä uudelleen.')
      setSubmitting(false)
      return
    }

    await supabaseAdmin
      .from('laiteluettelo_items')
      .update({ service_requested: true })
      .eq('id', id)

    const taskBase = {
      title:       `Laitehuolto: ${device.name}`,
      description: `Vikailmoitus (QR): ${form.kuvaus.trim()}\nIlmoittaja: ${form.nimi.trim()}` +
                   (form.puhelin ? ` · ${form.puhelin.trim()}` : '') +
                   (form.email   ? ` · ${form.email.trim()}`   : ''),
      status:      'avoin',
      priority:    'high',
      created_by:  form.nimi.trim(),
    }
    await Promise.all([
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'huolto' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'admin' }),
      supabaseAdmin.from('tasks').insert({ ...taskBase, assigned_to: 'respa' }),
    ])

    setView('success')
    setSubmitting(false)
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const card = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,.08)',
    padding: '2rem',
    width: '100%',
    maxWidth: 440,
  }

  const inputStyle = {
    width: '100%',
    padding: '.6rem .85rem',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    fontSize: '.88rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    color: '#1A1A2E',
    background: '#fff',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '.8rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '.35rem',
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F9FC',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '2rem 1rem',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
        <img src={logo} alt="Kuntomo" style={{ height: 32 }} />
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1A2E', letterSpacing: '-.01em' }}>Kuntomo</span>
      </div>

      <div style={card}>

        {/* Loading */}
        {loading && (
          <p style={{ textAlign: 'center', color: '#64748B', fontSize: '.9rem' }}>Ladataan…</p>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>❓</div>
            <h2 style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1A1A2E', marginBottom: '.5rem' }}>
              Laitetta ei löydy
            </h2>
            <p style={{ color: '#64748B', fontSize: '.88rem' }}>
              Tarkista QR-koodi ja yritä uudelleen.
            </p>
          </div>
        )}

        {/* ── LANDING: valinta ────────────────────────────────────────────── */}
        {!loading && !notFound && view === 'landing' && device && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Device header */}
            <div style={{
              background: '#F8F9FC',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              padding: '.85rem 1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1A2E' }}>{device.name}</div>
                  {device.sijainti && (
                    <div style={{ fontSize: '.8rem', color: '#64748B', marginTop: '.2rem' }}>{device.sijainti}</div>
                  )}
                </div>
                {device.device_number && (
                  <span style={{
                    background: '#EDE9FE', color: '#6D28D9',
                    fontSize: '.72rem', fontWeight: 700,
                    padding: '.2rem .55rem', borderRadius: 6,
                    letterSpacing: '.04em', flexShrink: 0, marginLeft: '.5rem',
                  }}>
                    {device.device_number}
                  </span>
                )}
              </div>
            </div>

            {/* Ohjevideo-nappi */}
            {device.ohjevideo_url ? (
              <a
                href={device.ohjevideo_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '.65rem',
                  padding: '1.1rem',
                  background: '#7C3AED',
                  color: '#fff',
                  borderRadius: 12,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  transition: 'background .15s',
                }}>
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>▶</span>
                Katso ohjevideo
              </a>
            ) : (
              <div style={{
                padding: '.8rem 1rem',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                fontSize: '.82rem',
                color: '#94A3B8',
                textAlign: 'center',
              }}>
                Tälle laitteelle ei ole ohjevideota
              </div>
            )}

            {/* Ilmoita viasta -nappi */}
            <button
              onClick={() => setView('fault-form')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '.65rem',
                padding: '1.1rem',
                background: '#fff',
                color: '#DC2626',
                border: '2px solid #FECACA',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background .15s, border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FCA5A5' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#FECACA' }}
            >
              <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🔧</span>
              Ilmoita viasta
            </button>
          </div>
        )}

        {/* ── FAULT FORM ──────────────────────────────────────────────────── */}
        {!loading && !notFound && view === 'fault-form' && device && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Back + device */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <button
                type="button"
                onClick={() => setView('landing')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#64748B', fontSize: '.82rem', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '.3rem', padding: 0,
                  flexShrink: 0,
                }}>
                ← Takaisin
              </button>
              <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#1A1A2E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.name}
              </span>
              {device.device_number && (
                <span style={{ background: '#EDE9FE', color: '#6D28D9', fontSize: '.7rem', fontWeight: 700, padding: '.15rem .45rem', borderRadius: 5, flexShrink: 0 }}>
                  {device.device_number}
                </span>
              )}
            </div>

            <h2 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1A2E', margin: 0 }}>
              Ilmoita vika tai huoltotarve
            </h2>

            {/* Kuvaus */}
            <div>
              <label style={labelStyle}>Kuvaus <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea
                value={form.kuvaus}
                onChange={set('kuvaus')}
                required
                placeholder="Kerro tarkasti, mikä laitteessa on vialla…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = '#7C3AED')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* Nimi */}
            <div>
              <label style={labelStyle}>Nimesi <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                type="text"
                value={form.nimi}
                onChange={set('nimi')}
                required
                placeholder="Etunimi Sukunimi"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#7C3AED')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* Puhelin + email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div>
                <label style={labelStyle}>Puhelinnumero</label>
                <input
                  type="tel"
                  value={form.puhelin}
                  onChange={set('puhelin')}
                  placeholder="040 123 4567"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#7C3AED')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              <div>
                <label style={labelStyle}>Sähköposti</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="nimi@esimerkki.fi"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#7C3AED')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
            </div>

            {submitErr && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '.6rem .85rem',
                fontSize: '.82rem', color: '#DC2626',
              }}>
                {submitErr}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !form.nimi.trim() || !form.kuvaus.trim()}
              style={{
                padding: '.8rem',
                background: submitting || !form.nimi.trim() || !form.kuvaus.trim() ? '#FECACA' : '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: '.95rem',
                fontWeight: 700,
                cursor: submitting || !form.nimi.trim() || !form.kuvaus.trim() ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
                fontFamily: 'inherit',
              }}>
              {submitting ? 'Lähetetään…' : 'Lähetä vikailmoitus'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '.73rem', color: '#94A3B8', margin: 0 }}>
              Ilmoituksesi välitetään huoltohenkilöstölle.
            </p>
          </form>
        )}

        {/* ── SUCCESS ─────────────────────────────────────────────────────── */}
        {!loading && !notFound && view === 'success' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A1A2E', marginBottom: '.6rem' }}>
              Vikailmoitus lähetetty!
            </h2>
            <p style={{ color: '#64748B', fontSize: '.88rem', lineHeight: 1.6 }}>
              Huoltohenkilöstö saa tiedon viasta ja ottaa sen käsittelyyn.
              Kiitos ilmoituksesta!
            </p>
            <div style={{
              marginTop: '1.25rem',
              background: '#F0FDF4', border: '1px solid #86EFAC',
              borderRadius: 10, padding: '.85rem 1rem',
              fontSize: '.82rem', color: '#166534', textAlign: 'left',
            }}>
              <strong>{device?.name}</strong>
              {device?.sijainti && <span style={{ color: '#16A34A', marginLeft: '.5rem' }}>· {device.sijainti}</span>}
              <br />
              <span>{form.kuvaus}</span>
            </div>
            <button
              onClick={() => setView('landing')}
              style={{
                marginTop: '1.25rem',
                padding: '.65rem 1.5rem',
                background: 'none',
                border: '1.5px solid #E2E8F0',
                borderRadius: 8,
                fontSize: '.85rem',
                color: '#64748B',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              ← Takaisin
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
