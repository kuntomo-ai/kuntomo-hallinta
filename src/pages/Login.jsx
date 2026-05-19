import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../logo.svg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-grid-bg" />
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Kuntomo" />
          <div className="login-logo-sub">Kuntomo ERP</div>
        </div>
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
        </form>
      </div>
    </div>
  )
}
