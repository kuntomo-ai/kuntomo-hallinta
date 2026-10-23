import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import ReactMarkdown from 'react-markdown'
import { ExternalLink, Heart, MessageCircle, Bookmark, Share2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

const LOOKBACK_DAYS = 30

function fmtInt(n) { return Number(n ?? 0).toLocaleString('fi-FI') }
function fiDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' })
}
function pctDelta(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null
  const d = curr - prev
  return { d, pct: (d / prev) * 100 }
}

// ── Shared: not-connected placeholder ────────────────────────────────────────

function NotConnected({ platform, instructions }) {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ textAlign: 'center', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🔌</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text2)', marginBottom: '.3rem' }}>
          {platform} ei ole yhdistetty
        </div>
        <div style={{ fontSize: '.82rem' }}>Dataa ei löydy vielä. Yhdistä kanava alla olevilla ohjeilla.</div>
      </div>
      <ol style={{ fontSize: '.82rem', color: 'var(--text2)', paddingLeft: '1.25rem', margin: 0, lineHeight: 1.7 }}>
        {instructions.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </div>
  )
}

// ── Google Connect button ─────────────────────────────────────────────────────

function GoogleConnectButton() {
  const [busy, setBusy] = useState(false)

  async function handleConnect() {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setBusy(false); return }
      const res = await fetch('/api/google/auth', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        window.location.href = `/some?google_error=${encodeURIComponent(err.error || 'auth_failed')}`
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '.4rem',
        background: '#4285F4', color: '#fff', fontWeight: 700, fontSize: '.85rem',
        padding: '.55rem 1.1rem', borderRadius: 'var(--radius)',
        border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {busy ? 'Yhdistetään...' : 'Yhdistä Google'}
    </button>
  )
}

// ── Yhteenveto tab ────────────────────────────────────────────────────────────

function YhteenvetoTab({ isAdmin }) {
  const [igSnap, setIgSnap] = useState(null)
  const [igPrevSnap, setIgPrevSnap] = useState(null)
  const [ytSnap, setYtSnap] = useState(null)
  const [ytPrevSnap, setYtPrevSnap] = useState(null)
  const [gscSummary, setGscSummary] = useState(null)
  const [gscPrevSummary, setGscPrevSummary] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10)

      const [igAccRes, ytChRes, gscPropRes, anRes] = await Promise.all([
        supabase.from('ig_accounts').select('id').eq('is_active', true).limit(1),
        supabase.from('yt_channels').select('id').eq('is_active', true).limit(1),
        supabase.from('gsc_properties').select('id').eq('is_active', true).limit(1),
        supabase.from('ig_analyses').select('*').order('period_end', { ascending: false }).limit(1),
      ])

      const igAccId = igAccRes.data?.[0]?.id
      const ytChId = ytChRes.data?.[0]?.id
      const gscPropId = gscPropRes.data?.[0]?.id

      setAnalysis(anRes.data?.[0] || null)

      if (igAccId) {
        const { data: snaps } = await supabase.from('ig_account_snapshots')
          .select('*').eq('account_id', igAccId).gte('snapshot_date', since)
          .order('snapshot_date', { ascending: true })
        const rows = snaps || []
        setIgSnap(rows[rows.length - 1] || null)
        setIgPrevSnap(rows[0] || null)
      }

      if (!ytChRes.error && ytChId) {
        const { data: snaps } = await supabase.from('yt_channel_snapshots')
          .select('*').eq('channel_id', ytChId).gte('snapshot_date', since)
          .order('snapshot_date', { ascending: true })
        const rows = snaps || []
        setYtSnap(rows[rows.length - 1] || null)
        setYtPrevSnap(rows[0] || null)
      } else if (!ytChId) {
        setGoogleConnected(false)
      }

      if (!gscPropRes.error && gscPropId) {
        const { data: rows } = await supabase.from('gsc_weekly_summary')
          .select('*').eq('property_id', gscPropId)
          .order('week_start', { ascending: false }).limit(2)
        setGscSummary(rows?.[0] || null)
        setGscPrevSummary(rows?.[1] || null)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>

  const igDelta = pctDelta(igSnap?.followers_count, igPrevSnap?.followers_count)
  const ytDelta = pctDelta(ytSnap?.subscribers, ytPrevSnap?.subscribers)
  const gscDelta = pctDelta(gscSummary?.clicks, gscPrevSummary?.clicks)

  const channels = [
    {
      name: 'Instagram',
      color: '#E4405F',
      metric: 'Seuraajia',
      value: igSnap ? fmtInt(igSnap.followers_count) : '—',
      delta: igDelta,
      deltaLabel: 'vs. 14 pv sitten',
      sub: igSnap ? `Reach: ${fmtInt(igSnap.reach)}` : null,
      connected: !!igSnap,
    },
    {
      name: 'YouTube',
      color: '#EF4444',
      metric: 'Tilaajat',
      value: ytSnap ? fmtInt(ytSnap.subscribers) : '—',
      delta: ytDelta,
      deltaLabel: 'vs. 14 pv sitten',
      sub: ytSnap ? `Katselut: ${fmtInt(ytSnap.total_views)}` : null,
      connected: !!ytSnap,
    },
    {
      name: 'Google Search',
      color: '#4285F4',
      metric: 'Klikkaukset (vk)',
      value: gscSummary ? fmtInt(gscSummary.clicks) : '—',
      delta: gscDelta,
      deltaLabel: 'vs. edellinen vk',
      sub: gscSummary ? `CTR: ${gscSummary.ctr != null ? (gscSummary.ctr * 100).toFixed(1) + ' %' : '—'}` : null,
      connected: !!gscSummary,
    },
  ]

  return (
    <>
      {isAdmin && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: '.15rem' }}>
              {googleConnected ? 'Google yhdistetty' : 'Google ei ole yhdistetty'}
            </div>
            <div style={{ fontSize: '.79rem', color: 'var(--text3)' }}>
              {googleConnected
                ? 'Tili: info@kuntomo.fi · Voit yhdistää uudelleen jos token on vanhentunut.'
                : 'Yhdistä Google-tili (info@kuntomo.fi) hakemaan YouTube ja Search Console -data.'}
            </div>
          </div>
          <GoogleConnectButton />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {channels.map(ch => {
          const isGood = ch.delta ? ch.delta.d >= 0 : null
          return (
            <div key={ch.name} className="stat-card" style={{ borderLeft: `3px solid ${ch.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.4rem' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                <span style={{ fontSize: '.75rem', color: 'var(--text3)', fontWeight: 600 }}>{ch.name}</span>
              </div>
              <div className="stat-label">{ch.metric}</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{ch.value}</div>
              {ch.delta && ch.delta.d !== 0 && (
                <div style={{ fontSize: '.72rem', color: isGood ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.2rem' }}>
                  {ch.delta.d >= 0 ? '▲' : '▼'} {Math.abs(ch.delta.pct).toFixed(1)}% {ch.deltaLabel}
                </div>
              )}
              {ch.sub && <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.2rem' }}>{ch.sub}</div>}
              {!ch.connected && (
                <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.2rem', fontStyle: 'italic' }}>ei dataa vielä</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>AI-yhteenveto (Instagram)</h3>
          {analysis && (
            <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
              {fiDate(analysis.period_start)} – {fiDate(analysis.period_end)}
            </span>
          )}
        </div>
        {!analysis ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem', margin: 0 }}>Ei yhteenvetoja vielä. Viikoittainen analyysi ajetaan maanantaisin.</p>
        ) : (
          <div className="markdown-body" style={{ fontSize: '.85rem', lineHeight: 1.55 }}>
            <ReactMarkdown>{analysis.summary_md}</ReactMarkdown>
          </div>
        )}
      </div>
    </>
  )
}

// ── Instagram tab ─────────────────────────────────────────────────────────────

function InstagramTab() {
  const [accounts, setAccounts] = useState([])
  const [snaps, setSnaps] = useState([])
  const [media, setMedia] = useState([])
  const [metrics, setMetrics] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString().slice(0, 10)
    const [accRes, snapRes, medRes, anRes] = await Promise.all([
      supabase.from('ig_accounts').select('*').eq('is_active', true).order('label'),
      supabase.from('ig_account_snapshots').select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true }),
      supabase.from('ig_media').select('*').gte('posted_at', since).order('posted_at', { ascending: false }),
      supabase.from('ig_analyses').select('*').order('period_end', { ascending: false }),
    ])
    const accs = accRes.data || []
    setAccounts(accs)
    setSelected(s => s ?? accs[0]?.id ?? null)
    setSnaps(snapRes.data || [])
    setMedia(medRes.data || [])
    setAnalyses(anRes.data || [])

    const mediaIds = (medRes.data || []).map(m => m.id)
    if (mediaIds.length) {
      const { data: met } = await supabase
        .from('ig_media_metrics')
        .select('*')
        .in('media_id', mediaIds)
        .order('snapshot_date', { ascending: false })
      setMetrics(met || [])
    }
    setLoading(false)
  }

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const sel = selected && accountById.get(selected)
  const accountSnaps = useMemo(() => snaps.filter(s => s.account_id === selected), [snaps, selected])
  const chartData = useMemo(() => accountSnaps.map(s => ({
    pvm: fiDate(s.snapshot_date),
    seuraajia: s.followers_count ?? 0,
    reach: s.reach ?? 0,
    profile_views: s.profile_views ?? 0,
  })), [accountSnaps])
  const accountMedia = useMemo(() => media.filter(m => m.account_id === selected), [media, selected])
  const latestByMedia = useMemo(() => {
    const m = new Map()
    for (const row of metrics) { if (!m.has(row.media_id)) m.set(row.media_id, row) }
    return m
  }, [metrics])
  const topMedia = useMemo(() => accountMedia
    .map(med => ({ med, mx: latestByMedia.get(med.id) }))
    .filter(x => x.mx)
    .sort((a, b) => (b.mx.total_interactions || 0) - (a.mx.total_interactions || 0))
    .slice(0, 5), [accountMedia, latestByMedia])
  const latestAnalysis = useMemo(() => analyses.find(a => a.account_id === selected), [analyses, selected])
  const igLatestSnap = accountSnaps[accountSnaps.length - 1] || null
  const trend = useMemo(() => {
    if (accountSnaps.length < 2) return null
    const first = accountSnaps[0], last = accountSnaps[accountSnaps.length - 1]
    const diff = (last.followers_count || 0) - (first.followers_count || 0)
    return { diff, pct: first.followers_count ? (diff / first.followers_count) * 100 : null }
  }, [accountSnaps])

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
  if (!sel) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ei aktiivisia tilejä.</div>

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {accounts.map(a => (
          <button key={a.id} className={`sub-tab${selected === a.id ? ' active' : ''}`} onClick={() => setSelected(a.id)}>
            @{a.username}{a.label ? ` · ${a.label}` : ''}
          </button>
        ))}
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Seuraajia</div>
          <div className="stat-value gold">{fmtInt(igLatestSnap?.followers_count)}</div>
          {trend && trend.diff !== 0 && (
            <div style={{ fontSize: '.72rem', color: trend.diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
              {trend.diff >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(trend.diff))}{trend.pct != null ? ` (${trend.pct.toFixed(1)}%)` : ''} vs. {LOOKBACK_DAYS} pv sitten
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Reach (eilen)</div>
          <div className="stat-value">{fmtInt(igLatestSnap?.reach)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profile views (eilen)</div>
          <div className="stat-value">{fmtInt(igLatestSnap?.profile_views)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Julkaisuja jakson aikana</div>
          <div className="stat-value">{accountMedia.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Seuraajakehitys & reach</h3>
        {chartData.length < 2 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei riittävästi snapshotteja vielä.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="pvm" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '.78rem' }} />
              <Line yAxisId="left" type="monotone" dataKey="seuraajia" stroke="var(--violet)" strokeWidth={2.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="reach" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="profile_views" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid-main-aside" style={{ gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Parhaat julkaisut (total interactions)</h3>
          {topMedia.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei julkaisuja jakson aikana.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {topMedia.map(({ med, mx }) => (
                <div key={med.id} style={{ display: 'flex', gap: '.75rem', padding: '.6rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', alignItems: 'flex-start' }}>
                  {med.thumbnail_url && <img src={med.thumbnail_url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.2rem' }}>
                      <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{fiDate(med.posted_at)} · {med.media_type}</span>
                      {med.permalink && (
                        <a href={med.permalink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet)', fontSize: '.72rem', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                          Avaa <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '.3rem' }}>
                      {med.caption || <em style={{ color: 'var(--text3)' }}>(ei tekstiä)</em>}
                    </div>
                    <div style={{ display: 'flex', gap: '.85rem', fontSize: '.72rem', color: 'var(--text3)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Heart size={11} /> {fmtInt(mx.likes)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageCircle size={11} /> {fmtInt(mx.comments)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Bookmark size={11} /> {fmtInt(mx.saved)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Share2 size={11} /> {fmtInt(mx.shares)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={11} /> {fmtInt(mx.reach)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.75rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>AI-yhteenveto</h3>
            {latestAnalysis && (
              <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
                {fiDate(latestAnalysis.period_start)} – {fiDate(latestAnalysis.period_end)}
              </span>
            )}
          </div>
          {!latestAnalysis ? (
            <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei yhteenvetoja vielä. Viikoittainen analyysi ajetaan maanantaisin.</p>
          ) : (
            <div className="markdown-body" style={{ fontSize: '.85rem', lineHeight: 1.55 }}>
              <ReactMarkdown>{latestAnalysis.summary_md}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── YouTube tab ───────────────────────────────────────────────────────────────

function YouTubeTab({ isAdmin }) {
  const [channels, setChannels] = useState([])
  const [snaps, setSnaps] = useState([])
  const [videos, setVideos] = useState([])
  const [videoMetrics, setVideoMetrics] = useState([])
  const [selected, setSelected] = useState(null)
  const [notConnected, setNotConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString().slice(0, 10)
    const [chRes, snapRes, vidRes] = await Promise.all([
      supabase.from('yt_channels').select('*').eq('is_active', true).order('title'),
      supabase.from('yt_channel_snapshots').select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true }),
      supabase.from('yt_videos').select('*').order('published_at', { ascending: false }).limit(50),
    ])
    if (chRes.error) { setNotConnected(true); setLoading(false); return }
    const chs = chRes.data || []
    setChannels(chs)
    if (!chs.length) { setNotConnected(true); setLoading(false); return }
    setSelected(s => s ?? chs[0]?.id ?? null)
    setSnaps(snapRes.data || [])
    setVideos(vidRes.data || [])

    const videoIds = (vidRes.data || []).map(v => v.id)
    if (videoIds.length) {
      const { data: met } = await supabase
        .from('yt_video_metrics')
        .select('*')
        .in('video_id', videoIds)
        .order('snapshot_date', { ascending: false })
      setVideoMetrics(met || [])
    }
    setLoading(false)
  }

  const channelSnaps = useMemo(() => snaps.filter(s => s.channel_id === selected), [snaps, selected])
  const latestSnap = channelSnaps[channelSnaps.length - 1] || null
  const chartData = useMemo(() => channelSnaps.map(s => ({
    pvm: fiDate(s.snapshot_date),
    tilaajat: s.subscribers ?? 0,
  })), [channelSnaps])
  const channelVideos = useMemo(() => {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString()
    return videos.filter(v => v.channel_id === selected && (!v.published_at || v.published_at >= since))
  }, [videos, selected])
  const latestMetricByVideo = useMemo(() => {
    const m = new Map()
    for (const row of videoMetrics) { if (!m.has(row.video_id)) m.set(row.video_id, row) }
    return m
  }, [videoMetrics])
  const topVideos = useMemo(() => channelVideos
    .map(v => ({ v, mx: latestMetricByVideo.get(v.id) }))
    .filter(x => x.mx)
    .sort((a, b) => (b.mx.views || 0) - (a.mx.views || 0))
    .slice(0, 5), [channelVideos, latestMetricByVideo])
  const trendDiff = useMemo(() => {
    if (channelSnaps.length < 2) return null
    const first = channelSnaps[0], last = channelSnaps[channelSnaps.length - 1]
    const diff = (last.subscribers || 0) - (first.subscribers || 0)
    return { diff, pct: first.subscribers ? (diff / first.subscribers) * 100 : null }
  }, [channelSnaps])

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
  if (notConnected) return (
    <div>
      <NotConnected platform="YouTube" instructions={[
        'Siirry Yhteenveto-välilehdelle ja klikkaa "Yhdistä Google" -nappia (vaatii admin-roolin).',
        'Kirjaudu Google-tilillä info@kuntomo.fi ja hyväksy käyttöoikeudet.',
        'Callback ohjaa takaisin SOME-sivulle — kanava löytyy automaattisesti.',
        'Cron-ajo (api/cron/some-daily.js) tallentaa dataa automaattisesti yöllä.',
      ]} />
      {isAdmin && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <GoogleConnectButton />
        </div>
      )}
    </div>
  )

  return (
    <>
      {channels.length > 1 && (
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {channels.map(c => (
            <button key={c.id} className={`sub-tab${selected === c.id ? ' active' : ''}`} onClick={() => setSelected(c.id)}>
              {c.handle ? `@${c.handle}` : (c.title || c.channel_id)}
            </button>
          ))}
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Tilaajat</div>
          <div className="stat-value gold">{fmtInt(latestSnap?.subscribers)}</div>
          {trendDiff && trendDiff.diff !== 0 && (
            <div style={{ fontSize: '.72rem', color: trendDiff.diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
              {trendDiff.diff >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(trendDiff.diff))}{trendDiff.pct != null ? ` (${trendDiff.pct.toFixed(1)}%)` : ''} vs. {LOOKBACK_DAYS} pv sitten
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Yhteensä katseluja</div>
          <div className="stat-value">{fmtInt(latestSnap?.total_views)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Videoita yhteensä</div>
          <div className="stat-value">{fmtInt(latestSnap?.video_count)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Videoita {LOOKBACK_DAYS} pv</div>
          <div className="stat-value">{channelVideos.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Tilaajamäärän kehitys</h3>
        {chartData.length < 2 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei riittävästi snapshotteja vielä.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="pvm" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="tilaajat" stroke="#EF4444" strokeWidth={2.5} dot={false} name="Tilaajat" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Suosituimmat videot</h3>
        {topVideos.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei videoita tai mittaushistoriaa vielä.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {topVideos.map(({ v, mx }) => (
              <div key={v.id} style={{ display: 'flex', gap: '.75rem', padding: '.6rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', alignItems: 'flex-start' }}>
                {v.thumbnail_url && <img src={v.thumbnail_url} alt="" style={{ width: 80, height: 45, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.2rem' }}>
                    <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{fiDate(v.published_at)}</span>
                    <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet)', fontSize: '.72rem', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                      Avaa <ExternalLink size={11} />
                    </a>
                  </div>
                  <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '.3rem' }}>
                    {v.title || v.id}
                  </div>
                  <div style={{ display: 'flex', gap: '.85rem', fontSize: '.72rem', color: 'var(--text3)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={11} /> {fmtInt(mx.views)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Heart size={11} /> {fmtInt(mx.likes)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageCircle size={11} /> {fmtInt(mx.comments)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Google Search Console tab ─────────────────────────────────────────────────

function GoogleTab({ isAdmin }) {
  const [properties, setProperties] = useState([])
  const [summaries, setSummaries] = useState([])
  const [queries, setQueries] = useState([])
  const [selected, setSelected] = useState(null)
  const [notConnected, setNotConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const since = new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10)
    const [propRes, sumRes, qRes] = await Promise.all([
      supabase.from('gsc_properties').select('*').eq('is_active', true).order('display_name'),
      supabase.from('gsc_weekly_summary').select('*').gte('week_start', since).order('week_start', { ascending: true }),
      supabase.from('gsc_top_queries').select('*').order('week_start', { ascending: false }).limit(500),
    ])
    if (propRes.error) { setNotConnected(true); setLoading(false); return }
    const props = propRes.data || []
    setProperties(props)
    if (!props.length) { setNotConnected(true); setLoading(false); return }
    setSelected(s => s ?? props[0]?.id ?? null)
    setSummaries(sumRes.data || [])
    setQueries(qRes.data || [])
    setLoading(false)
  }

  const propSummaries = useMemo(() => summaries.filter(s => s.property_id === selected), [summaries, selected])
  const chartData = useMemo(() => propSummaries.map(s => ({
    pvm: fiDate(s.week_start),
    klikkaukset: s.clicks ?? 0,
    nayttokerrat: s.impressions ?? 0,
  })), [propSummaries])
  const latestSummary = propSummaries[propSummaries.length - 1]
  const prevSummary = propSummaries[propSummaries.length - 2]
  const latestWeek = latestSummary?.week_start
  const topQueries = useMemo(() =>
    queries.filter(q => q.property_id === selected && q.week_start === latestWeek)
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 15),
    [queries, selected, latestWeek])

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
  if (notConnected) return (
    <div>
      <NotConnected platform="Google Search Console" instructions={[
        'Siirry Yhteenveto-välilehdelle ja klikkaa "Yhdistä Google" -nappia (vaatii admin-roolin).',
        'Kirjaudu Google-tilillä info@kuntomo.fi ja hyväksy käyttöoikeudet.',
        'Callback ohjaa takaisin SOME-sivulle — sivusto löytyy automaattisesti.',
        'Cron-ajo (api/cron/some-daily.js) hakee dataa automaattisesti maanantaisin.',
      ]} />
      {isAdmin && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <GoogleConnectButton />
        </div>
      )}
    </div>
  )

  const statCards = [
    { label: 'Klikkaukset (vk)', val: latestSummary?.clicks, prev: prevSummary?.clicks, fmt: fmtInt },
    { label: 'Näyttökerrat (vk)', val: latestSummary?.impressions, prev: prevSummary?.impressions, fmt: fmtInt },
    { label: 'CTR', val: latestSummary?.ctr, prev: prevSummary?.ctr, fmt: v => v != null ? `${(v * 100).toFixed(1)} %` : '—' },
    { label: 'Keskim. sijoitus', val: latestSummary?.position, prev: prevSummary?.position, fmt: v => v != null ? v.toFixed(1) : '—', lowerIsBetter: true },
  ]

  return (
    <>
      {properties.length > 1 && (
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {properties.map(p => (
            <button key={p.id} className={`sub-tab${selected === p.id ? ' active' : ''}`} onClick={() => setSelected(p.id)}>
              {p.display_name || p.site_url}
            </button>
          ))}
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {statCards.map(({ label, val, prev, fmt, lowerIsBetter }) => {
          const d = pctDelta(val, prev)
          const isGood = d ? (lowerIsBetter ? d.d < 0 : d.d > 0) : null
          return (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{fmt(val)}</div>
              {d && (
                <div style={{ fontSize: '.72rem', color: isGood ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
                  {d.d >= 0 ? '▲' : '▼'} {Math.abs(d.pct).toFixed(0)}% vs. edellinen vk
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Klikkaukset & näyttökerrat</h3>
        {chartData.length < 2 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei riittävästi dataa vielä.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="pvm" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '.78rem' }} />
              <Line yAxisId="left" type="monotone" dataKey="klikkaukset" stroke="#4285F4" strokeWidth={2.5} dot={false} name="Klikkaukset" />
              <Line yAxisId="right" type="monotone" dataKey="nayttokerrat" stroke="#34A853" strokeWidth={2} dot={false} name="Näyttökerrat" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>
          Suosituimmat hakusanat{latestWeek ? ` (vk alkaen ${fiDate(latestWeek)})` : ''}
        </h3>
        {topQueries.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei hakusanadataa vielä.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['Hakusana', 'Klikk.', 'Näyttö', 'CTR', 'Sij.'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--text3)', fontWeight: 600, fontSize: '.75rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topQueries.map((q, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{q.query}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtInt(q.clicks)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text3)' }}>{fmtInt(q.impressions)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text3)' }}>{q.ctr != null ? `${(q.ctr * 100).toFixed(1)} %` : '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text3)' }}>{q.position != null ? q.position.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const CHANNEL_TABS = [
  { id: 'yhteenveto', label: 'Yhteenveto' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'google', label: 'Google' },
]

export default function Some() {
  const [channel, setChannel] = useState('yhteenveto')
  const [isAdmin, setIsAdmin] = useState(false)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    checkRole()
    handleGoogleParams()
  }, [])

  async function checkRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('role, roles').eq('id', user.id).maybeSingle()
    const rolesArr = Array.isArray(profile?.roles) ? profile.roles.map(String) : []
    if (profile?.role) rolesArr.push(String(profile.role))
    setIsAdmin(rolesArr.includes('admin'))
  }

  function handleGoogleParams() {
    const params = new URLSearchParams(window.location.search)
    const google = params.get('google')
    const googleError = params.get('google_error')
    if (google === 'connected') {
      setNotification({ type: 'success', msg: 'Google yhdistetty onnistuneesti! Data päivittyy yöllä.' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (googleError) {
      setNotification({ type: 'error', msg: `Google-yhteys epäonnistui: ${googleError}` })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">SOME-analytiikka</h1>
          <p className="page-subtitle">Instagram · YouTube · Google Search Console</p>
        </div>
      </div>

      {notification && (
        <div style={{
          padding: '.75rem 1rem',
          marginBottom: '1.25rem',
          borderRadius: 'var(--radius)',
          background: notification.type === 'success' ? 'var(--green-bg, #dcfce7)' : 'var(--red-bg, #fee2e2)',
          color: notification.type === 'success' ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)',
          fontSize: '.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '.5rem',
        }}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit', padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {CHANNEL_TABS.map(ch => (
          <button
            key={ch.id}
            className={`sub-tab${channel === ch.id ? ' active' : ''}`}
            onClick={() => setChannel(ch.id)}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {channel === 'yhteenveto' && <YhteenvetoTab isAdmin={isAdmin} />}
      {channel === 'instagram' && <InstagramTab />}
      {channel === 'youtube' && <YouTubeTab isAdmin={isAdmin} />}
      {channel === 'google' && <GoogleTab isAdmin={isAdmin} />}
    </div>
  )
}
