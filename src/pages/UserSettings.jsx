import { useState } from 'react'
import { KeyRound, Check, Eye, EyeOff, User, Phone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function UserSettings() {
  const { profile, user } = useAuth()

  // Password
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')

  // Profile info
  const [phone, setPhone] = useState(profile?.phone || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSuccess, setInfoSuccess] = useState(false)
  const [infoError, setInfoError] = useState('')

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw.length < 8) { setPwError('Salasanan tulee olla vähintään 8 merkkiä.'); return }
    if (newPw !== confirmPw) { setPwError('Uudet salasanat eivät täsmää.'); return }
    setPwSaving(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (updateErr) { setPwError('Salasanan vaihto epäonnistui: ' + updateErr.message); return }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => setPwSuccess(false), 4000)
  }

  async function handleInfoSave(e) {
    e.preventDefault()
    setInfoError('')
    setInfoSuccess(false)
    setInfoSaving(true)

    // Update phone in profiles table
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ phone: phone.trim() || null })
      .eq('id', user?.id)

    if (profileErr) {
      setInfoSaving(false)
      setInfoError('Tallennus epäonnistui: ' + profileErr.message)
      return
    }

    // Update email in Supabase Auth (if changed)
    if (email.trim() && email.trim() !== profile?.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: email.trim() })
      if (emailErr) {
        setInfoSaving(false)
        setInfoError('Sähköpostin vaihto epäonnistui: ' + emailErr.message)
        return
      }
    }

    setInfoSaving(false)
    setInfoSuccess(true)
    setTimeout(() => setInfoSuccess(false), 4000)
  }

  const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile?.email || '—'
  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Omat tiedot</h1>
          <p className="page-subtitle">Käyttäjäasetukset ja yhteystiedot</p>
        </div>
      </div>

      {/* Profile info card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'var(--violet)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem',
        }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{name}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.1rem' }}>{profile?.email || '—'}</div>
          <div style={{ marginTop: '.35rem' }}>
            <span className="badge badge-gray" style={{ fontSize: '.7rem' }}>{profile?.role || '—'}</span>
          </div>
        </div>
      </div>

      {/* Contact info edit card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem' }}>
          <User size={16} style={{ color: 'var(--violet)' }} />
          <span style={{ fontWeight: 700, fontSize: '.95rem' }}>Yhteystiedot</span>
        </div>

        <form onSubmit={handleInfoSave} className="form-grid">
          <div className="input-group">
            <label className="input-label">Sähköpostiosoite</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={profile?.email || 'etunimi@kuntomo.fi'}
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
            {email !== profile?.email && email.trim() && (
              <div style={{ fontSize: '.75rem', color: 'var(--orange)', marginTop: '.3rem' }}>
                ⚠️ Supabase lähettää vahvistuslinkin uuteen osoitteeseen — muutos astuu voimaan vasta vahvistuksen jälkeen.
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Puhelinnumero</label>
            <div style={{ position: 'relative' }}>
              <Phone size={14} style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                className="input-field"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+358 40 123 4567"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>
          </div>

          {infoError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
              ⚠️ {infoError}
            </div>
          )}
          {infoSuccess && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <Check size={14} /> Tiedot tallennettu!
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={infoSaving}
            style={{ width: 'fit-content' }}
          >
            {infoSaving ? 'Tallennetaan...' : 'Tallenna tiedot'}
          </button>
        </form>
      </div>

      {/* Password change card */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem' }}>
          <KeyRound size={16} style={{ color: 'var(--violet)' }} />
          <span style={{ fontWeight: 700, fontSize: '.95rem' }}>Vaihda salasana</span>
        </div>

        <form onSubmit={handlePasswordChange} className="form-grid">
          <div className="input-group">
            <label className="input-label">Uusi salasana</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showNew ? 'text' : 'password'}
                placeholder="Vähintään 8 merkkiä"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position: 'absolute', right: '.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {newPw && (
              <div style={{ marginTop: '.35rem', display: 'flex', gap: '.25rem' }}>
                {[...Array(4)].map((_, i) => {
                  const strength = newPw.length >= 12 ? 4 : newPw.length >= 10 ? 3 : newPw.length >= 8 ? 2 : 1
                  const colors = ['var(--red)', 'var(--orange)', '#eab308', 'var(--green)']
                  return <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < strength ? colors[strength - 1] : 'var(--border)', transition: 'background .2s' }} />
                })}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Vahvista uusi salasana</label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              required
            />
            {confirmPw && newPw && (
              <div style={{ fontSize: '.78rem', marginTop: '.25rem', color: confirmPw === newPw ? 'var(--green)' : 'var(--red)' }}>
                {confirmPw === newPw ? '✓ Salasanat täsmäävät' : 'Salasanat eivät täsmää'}
              </div>
            )}
          </div>

          {pwError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
              ⚠️ {pwError}
            </div>
          )}
          {pwSuccess && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <Check size={14} /> Salasana vaihdettu onnistuneesti!
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={pwSaving || !newPw || !confirmPw}
            style={{ width: 'fit-content' }}
          >
            {pwSaving ? 'Vaihdetaan...' : 'Vaihda salasana'}
          </button>
        </form>
      </div>
    </div>
  )
}
