import { useEffect, useState, useRef } from 'react'
import { Send, Users, User, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROLES = ['admin', 'hallitus', 'terapia_valmennus', 'myynti', 'huolto', 'sport', 'respa']

export default function Communication() {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pinned, setPinned] = useState([])

  // recipient state (admin only)
  const [recipientType, setRecipientType] = useState('all') // 'all' | 'role' | 'user'
  const [recipientRole, setRecipientRole] = useState(ROLES[0])
  const [recipientId, setRecipientId] = useState('')
  const [allProfiles, setAllProfiles] = useState([])

  const bottomRef = useRef(null)
  const myId = user?.id

  useEffect(() => {
    fetchMessages()
    if (isAdmin) {
      supabase.from('profiles').select('id, first_name, last_name, full_name, role').order('first_name')
        .then(({ data }) => setAllProfiles(data || []))
    }
    const channel = supabase
      .channel('channel_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages' }, payload => {
        const m = payload.new
        if (shouldShow(m)) {
          setMessages(prev => [...prev, m])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  function shouldShow(m) {
    if (isAdmin) return true
    if (m.sender_id === myId) return true
    if (!m.recipient_type || m.recipient_type === 'all') return true
    if (m.recipient_type === 'role' && m.recipient_role === profile?.role) return true
    if (m.recipient_type === 'user' && m.recipient_id === myId) return true
    return false
  }

  async function fetchMessages() {
    setLoading(true)
    const { data } = await supabase.from('channel_messages').select('*').order('created_at', { ascending: true })
    const visible = (data || []).filter(shouldShow)
    setMessages(visible)
    setPinned(visible.filter(m => m.pinned))
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
  }

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    const payload = {
      content: text.trim(),
      sender_id: myId || null,
      sender_name: profile?.full_name || profile?.email || 'Tuntematon',
      recipient_type: isAdmin ? recipientType : 'user',
      recipient_role: isAdmin && recipientType === 'role' ? recipientRole : null,
      recipient_id: isAdmin && recipientType === 'user' ? recipientId || null : null,
    }
    await supabase.from('channel_messages').insert(payload)
    setText('')
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function recipientLabel(m) {
    if (!m.recipient_type || m.recipient_type === 'all') return null
    if (m.recipient_type === 'role') return `→ rooli: ${m.recipient_role}`
    if (m.recipient_type === 'user') {
      const p = allProfiles.find(x => x.id === m.recipient_id)
      return `→ ${p?.full_name || p?.first_name || 'henkilö'}`
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px - 4rem)' }}>
      <div className="page-header" style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <div className="page-header-left">
          <h1 className="page-title">Viestit</h1>
          <p className="page-subtitle">Sisäinen viestintäkanava</p>
        </div>
      </div>

      {pinned.length > 0 && (
        <div style={{ background: 'var(--violet-subtle)', border: '1px solid var(--violet-border)', borderRadius: 'var(--radius)', padding: '.75rem 1.25rem', marginBottom: '1rem', flexShrink: 0 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: '.4rem' }}>📌 Tärkeä ilmoitus</div>
          {pinned.map(m => (
            <div key={m.id} style={{ fontSize: '.85rem', color: 'var(--text)', fontWeight: 500 }}>{m.content}</div>
          ))}
        </div>
      )}

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {loading ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '2rem' }}>Ladataan...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '2rem' }}>Ei viestejä vielä. Aloita keskustelu!</div>
          ) : messages.map(m => {
            const isMe = m.sender_id === myId
            const rl = recipientLabel(m)
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '.2rem' }}>
                {!isMe && (
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)', marginLeft: '.5rem' }}>{m.sender_name}</div>
                )}
                <div style={{
                  maxWidth: '72%',
                  background: isMe ? 'var(--violet)' : 'var(--bg3)',
                  color: isMe ? '#fff' : 'var(--text)',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '.65rem 1rem',
                  fontSize: '.85rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: '.65rem', color: 'var(--text4)', marginLeft: isMe ? 0 : '.5rem', marginRight: isMe ? '.5rem' : 0, display: 'flex', gap: '.5rem' }}>
                  <span>{new Date(m.created_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} · {new Date(m.created_at).toLocaleDateString('fi-FI')}</span>
                  {rl && <span style={{ color: 'var(--violet)', fontWeight: 600 }}>{rl}</span>}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Recipient selector (admin only) */}
        {isAdmin && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '.65rem 1.25rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg2)', flexShrink: 0 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text3)' }}>Vastaanottaja:</span>
            {[['all', <Globe size={13} />, 'Kaikki'], ['role', <Users size={13} />, 'Rooli'], ['user', <User size={13} />, 'Henkilö']].map(([v, icon, label]) => (
              <button key={v}
                onClick={() => setRecipientType(v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.35rem',
                  padding: '.3rem .65rem', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
                  border: `1.5px solid ${recipientType === v ? 'var(--violet)' : 'var(--border)'}`,
                  background: recipientType === v ? 'var(--violet-subtle)' : 'transparent',
                  color: recipientType === v ? 'var(--violet)' : 'var(--text3)',
                  cursor: 'pointer',
                }}>
                {icon} {label}
              </button>
            ))}
            {recipientType === 'role' && (
              <select className="input-field" style={{ width: 'auto', fontSize: '.8rem', padding: '.3rem .6rem', height: 'auto' }}
                value={recipientRole} onChange={e => setRecipientRole(e.target.value)}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            )}
            {recipientType === 'user' && (
              <select className="input-field" style={{ width: 'auto', fontSize: '.8rem', padding: '.3rem .6rem', height: 'auto' }}
                value={recipientId} onChange={e => setRecipientId(e.target.value)}>
                <option value="">Valitse henkilö</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Compose */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', gap: '.75rem', alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            className="input-field"
            style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 120 }}
            placeholder="Kirjoita viesti... (Enter lähettää)"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !text.trim()} style={{ flexShrink: 0 }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
