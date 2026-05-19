import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ terapia: 0, valmennus: 0, km: 0, tasks: 0 })
  const [messages, setMessages] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()

    const [terapiaRes, valmennusRes, kmRes, tasksRes, msgsRes, eventsRes] = await Promise.all([
      supabase.from('terapiamyynti').select('price').gte('created_at', today),
      supabase.from('valmennusmyynti').select('price').gte('created_at', today),
      supabase.from('drive_logs').select('distance_km').gte('created_at', today),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'avoin'),
      supabase.from('channel_messages').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('calendar_events').select('*').gte('start_date', now).order('start_date', { ascending: true }).limit(5),
    ])

    const terapia = (terapiaRes.data || []).reduce((s, r) => s + (r.price || 0), 0)
    const valmennus = (valmennusRes.data || []).reduce((s, r) => s + (r.price || 0), 0)
    const km = (kmRes.data || []).reduce((s, r) => s + (r.distance_km || 0), 0)
    const tasks = tasksRes.count || 0

    setStats({ terapia, valmennus, km, tasks })
    setMessages(msgsRes.data || [])
    setEvents(eventsRes.data || [])
    setLoading(false)
  }

  const name = profile?.full_name || profile?.email || 'käyttäjä'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Hyvää huomenta' : hour < 18 ? 'Hyvää päivää' : 'Hyvää iltaa'

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text3)' }}>Ladataan...</div>

  return (
    <div>
      <div className="welcome-banner">
        <div className="welcome-title">{greeting}, <span>{name}</span> 👋</div>
        <div className="welcome-sub">Tervetuloa Kuntomo ERP:hen — {new Date().toLocaleDateString('fi-FI', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Terapiamyynti tänään</div>
          <div className="stat-value gold">{stats.terapia.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valmennusmyynti tänään</div>
          <div className="stat-value gold">{stats.valmennus.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ajokirjaukset tänään</div>
          <div className="stat-value">{stats.km.toFixed(1)} km</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avoimet tehtävät</div>
          <div className="stat-value">{stats.tasks}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Viimeisimmät viestit</h3>
            <Link to="/communication" style={{ fontSize: '.78rem', color: 'var(--violet)', fontWeight: 600 }}>Avaa viestit →</Link>
          </div>
          {messages.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei viestejä.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {messages.map(m => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '.75rem' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '.2rem' }}>{m.sender_name || 'Tuntematon'}</div>
                  <div style={{ fontSize: '.83rem', color: 'var(--text)', lineHeight: 1.4 }}>{m.content}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text4)', marginTop: '.25rem' }}>{new Date(m.created_at).toLocaleDateString('fi-FI')} {new Date(m.created_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Tulevat tapahtumat</h3>
            <Link to="/tasks" style={{ fontSize: '.78rem', color: 'var(--violet)', fontWeight: 600 }}>Avaa tehtävät →</Link>
          </div>
          {events.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '.83rem' }}>Ei tulevia tapahtumia.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {events.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '.75rem' }}>
                  <div style={{ background: 'var(--violet-subtle)', border: '1px solid var(--violet-border)', borderRadius: 'var(--radius)', padding: '.3rem .6rem', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', color: 'var(--violet)', lineHeight: 1 }}>{new Date(e.start_date).getDate()}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{new Date(e.start_date).toLocaleDateString('fi-FI', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{e.title}</div>
                    {e.category && <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.15rem' }}>{e.category}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
