import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logo from '../logo.svg'
import { Eye, EyeOff, Check } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash — listen for the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Salasanan tulee olla vähintään 8 merkkiä.'); return }
    if (password !== confirm) { setError('Salasanat eivät täsmää.'); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => navigate('/'), 2500)
  }

  return (
    <div className="login-page">
      <div className="login-bg-photo" />
      <div className="login-grid-bg" />
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Kuntomo" />
          <div className="login-logo-sub">Kuntomo ERP</div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '1rem', fontSize: '.88rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
              <Check size={16} /> Salasana vaihdettu! Ohjataan etusivulle...
            </div>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '.88rem', padding: '1rem 0' }}>
            Odota hetki — käsitellään palautuslinkkiä...
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <div style={{ fontSize: '.88rem', color: 'var(--text2)', marginBottom: '.25rem', textAlign: 'center', fontWeight: 600 }}>
              Aseta uusi salasana
            </div>
            <div className="input-group">
              <label className="input-label">Uusi salasana</label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type={showPw ? 'text' : 'password'}
                  placeholder="Vähintään 8 merkkiä" value={password}
                  onChange={e => setPassword(e.target.value)} required autoFocus
                  style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: '.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {password && (
                <div style={{ marginTop: '.35rem', display: 'flex', gap: '.25rem' }}>
                  {[...Array(4)].map((_, i) => {
                    const strength = password.length >= 12 ? 4 : password.length >= 10 ? 3 : password.length >= 8 ? 2 : 1
                    const colors = ['var(--red)', 'var(--orange)', '#eab308', 'var(--green)']
                    return <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < strength ? colors[strength - 1] : 'var(--border)', transition: 'background .2s' }} />
                  })}
                </div>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Vahvista salasana</label>
              <input className="input-field" type="password" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
              {confirm && (
                <div style={{ fontSize: '.78rem', marginTop: '.25rem', color: confirm === password ? 'var(--green)' : 'var(--red)' }}>
                  {confirm === password ? '✓ Salasanat täsmäävät' : 'Salasanat eivät täsmää'}
                </div>
              )}
            </div>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', padding: '.6rem .9rem', fontSize: '.82rem', color: 'var(--red)' }}>
                ⚠️ {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={saving || !password || !confirm}>
              {saving ? 'Tallennetaan...' : 'Aseta salasana'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
