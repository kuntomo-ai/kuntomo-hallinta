import { useEffect, useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Communication() {
  const { profile, user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pinned, setPinned] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchMessages()
    const channel = supabase
      .channel('channel_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages' }, payload => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchMessages() {
    setLoading(true)
    const { data } = await supabase.from('channel_messages').select('*').order('created_at', { ascending: true })
    setMessages(data || [])
    setPinned((data || []).filter(m => m.pinned))
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
  }

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('channel_messages').insert({
      content: text.trim(),
      sender_id: user?.id || null,
      sender_name: profile?.full_name || profile?.email || 'Tuntematon',
    })
    setText('')
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const myId = user?.id

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
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {loading ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '2rem' }}>Ladataan...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '2rem' }}>Ei viestejä vielä. Aloita keskustelu!</div>
          ) : messages.map(m => {
            const isMe = m.sender_id === myId
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
                <div style={{ fontSize: '.65rem', color: 'var(--text4)', marginLeft: isMe ? 0 : '.5rem', marginRight: isMe ? '.5rem' : 0 }}>
                  {new Date(m.created_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} · {new Date(m.created_at).toLocaleDateString('fi-FI')}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

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
