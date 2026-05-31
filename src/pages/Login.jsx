import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../logo.svg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    setResetSent(true)
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

        {view === 'login' ? (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="input-group">
              <label className="input-label">Sähköposti</label>
              <input className="input-field" type="email" placeholder="nimi@kuntomo.fi"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Salasana</label>
              <input className="input-field" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '.5rem' }}>
              {loading ? 'Kirjaudutaan...' : 'Kirjaudu sisään'}
            </button>
            <button type="button" onClick={() => { setView('forgot'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--violet)', fontSize: '.82rem', cursor: 'pointer', padding: '.25rem 0', alignSelf: 'center' }}>
              Unohditko salasanan?
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleReset}>
            <div style={{ fontSize: '.88rem', color: 'var(--text2)', marginBottom: '.75rem', textAlign: 'center' }}>
              Syötä sähköpostiosoitteesi niin lähetämme salasanan palautuslinkin.
            </div>
            {resetSent ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '.75rem', fontSize: '.83rem', color: '#166534', textAlign: 'center' }}>
                Linkki lähetetty! Tarkista sähköpostisi.
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label className="input-label">Sähköposti</label>
                  <input className="input-field" type="email" placeholder="nimi@kuntomo.fi"
                    value={resetEmail} onChange={e => setResetEmail(e.target.value)} required autoFocus />
                </div>
                <button className="btn btn-primary" type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Lähetetään...' : 'Lähetä palautuslinkki'}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setView('login'); setResetSent(false); setResetEmail('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '.82rem', cursor: 'pointer', padding: '.25rem 0', alignSelf: 'center' }}>
              ← Takaisin kirjautumiseen
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
