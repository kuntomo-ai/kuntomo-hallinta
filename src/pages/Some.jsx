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

function YouTubeTab() {
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
    <NotConnected platform="YouTube" instructions={[
      'Luo Google Cloud -projekti ja ota käyttöön YouTube Data API v3.',
      'Luo API-avain ja lisää se Vercel-ympäristömuuttujiin: YOUTUBE_API_KEY',
      'Lisää kanavasi ID yt_channels-tauluun Supabasessa (channel_id = UCxxxxxxx)',
      'Aja supabase_some_tables.sql ensin, jos taulut puuttuvat vielä.',
      'Cron-ajo (api/cron/some-daily.js) tallentaa dataa automaattisesti yöllä.',
    ]} />
  )

  const sel = channels.find(c => c.id === selected)

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

function GoogleTab() {
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

  function pctDelta(curr, prev) {
    if (curr == null || prev == null || prev === 0) return null
    const d = curr - prev
    return { d, pct: (d / prev) * 100 }
  }

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
  if (notConnected) return (
    <NotConnected platform="Google Search Console" instructions={[
      'Luo Google Cloud -projekti ja ota käyttöön Search Console API.',
      'Lisää OAuth-tunnukset Vercel-ympäristömuuttujiin: GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN.',
      'Hae refresh token OAuth Playground -palvelulla (scope: webmasters.readonly).',
      'Lisää sivustosi gsc_properties-tauluun (site_url = sc-domain:kuntomo.com).',
      'Cron-ajo (api/cron/some-daily.js) hakee dataa automaattisesti maanantaisin.',
    ]} />
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

// ── LinkedIn tab ──────────────────────────────────────────────────────────────

function LinkedInTab() {
  const [pages, setPages] = useState([])
  const [snaps, setSnaps] = useState([])
  const [posts, setPosts] = useState([])
  const [postMetrics, setPostMetrics] = useState([])
  const [selected, setSelected] = useState(null)
  const [notConnected, setNotConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString().slice(0, 10)
    const [pageRes, snapRes, postRes] = await Promise.all([
      supabase.from('li_pages').select('*').eq('is_active', true).order('name'),
      supabase.from('li_page_snapshots').select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true }),
      supabase.from('li_posts').select('*').order('published_at', { ascending: false }).limit(50),
    ])
    if (pageRes.error) { setNotConnected(true); setLoading(false); return }
    const pg = pageRes.data || []
    setPages(pg)
    if (!pg.length) { setNotConnected(true); setLoading(false); return }
    setSelected(s => s ?? pg[0]?.id ?? null)
    setSnaps(snapRes.data || [])
    setPosts(postRes.data || [])

    const postIds = (postRes.data || []).map(p => p.id)
    if (postIds.length) {
      const { data: met } = await supabase
        .from('li_post_metrics')
        .select('*')
        .in('post_id', postIds)
        .order('snapshot_date', { ascending: false })
      setPostMetrics(met || [])
    }
    setLoading(false)
  }

  const pageSnaps = useMemo(() => snaps.filter(s => s.page_id === selected), [snaps, selected])
  const latestSnap = pageSnaps[pageSnaps.length - 1] || null
  const chartData = useMemo(() => pageSnaps.map(s => ({
    pvm: fiDate(s.snapshot_date),
    seuraajat: s.followers ?? 0,
    nayttokerrat: s.impressions ?? 0,
  })), [pageSnaps])
  const pagePosts = useMemo(() => {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString()
    return posts.filter(p => p.page_id === selected && (!p.published_at || p.published_at >= since))
  }, [posts, selected])
  const latestMetricByPost = useMemo(() => {
    const m = new Map()
    for (const row of postMetrics) { if (!m.has(row.post_id)) m.set(row.post_id, row) }
    return m
  }, [postMetrics])
  // Show recent posts; sort by metrics if available, otherwise by date
  const topPosts = useMemo(() => {
    const withMetrics = pagePosts.filter(p => latestMetricByPost.has(p.id))
    if (withMetrics.length >= 3) {
      return withMetrics
        .sort((a, b) => (latestMetricByPost.get(b.id)?.impressions || 0) - (latestMetricByPost.get(a.id)?.impressions || 0))
        .slice(0, 5)
        .map(p => ({ p, mx: latestMetricByPost.get(p.id) }))
    }
    return pagePosts.slice(0, 5).map(p => ({ p, mx: latestMetricByPost.get(p.id) || null }))
  }, [pagePosts, latestMetricByPost])
  const trendDiff = useMemo(() => {
    if (pageSnaps.length < 2) return null
    const first = pageSnaps[0], last = pageSnaps[pageSnaps.length - 1]
    const diff = (last.followers || 0) - (first.followers || 0)
    return { diff, pct: first.followers ? (diff / first.followers) * 100 : null }
  }, [pageSnaps])

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
  if (notConnected) return (
    <NotConnected platform="LinkedIn" instructions={[
      'Luo LinkedIn Developer -sovellus osoitteessa developer.linkedin.com.',
      'Pyydä Community Management API -oikeudet yrityssivullesi.',
      'Lisää access token ympäristömuuttujiin: LINKEDIN_ACCESS_TOKEN.',
      'Lisää yrityksesi LinkedIn-sivun URN li_pages-tauluun (organization_id = urn:li:organization:xxxxxxx).',
      'Cron-ajo (api/cron/some-daily.js) hakee dataa automaattisesti maanantaisin.',
    ]} />
  )

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Seuraajat</div>
          <div className="stat-value gold">{fmtInt(latestSnap?.followers)}</div>
          {trendDiff && trendDiff.diff !== 0 && (
            <div style={{ fontSize: '.72rem', color: trendDiff.diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
              {trendDiff.diff >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(trendDiff.diff))}{trendDiff.pct != null ? ` (${trendDiff.pct.toFixed(1)}%)` : ''} vs. {LOOKBACK_DAYS} pv sitten
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Näyttökerrat (vk)</div>
          <div className="stat-value">{fmtInt(latestSnap?.impressions)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Reaktiot (vk)</div>
          <div className="stat-value">{fmtInt(latestSnap?.reactions)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Julkaisuja {LOOKBACK_DAYS} pv</div>
          <div className="stat-value">{pagePosts.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Seuraajamäärän kehitys</h3>
        {chartData.length < 2 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei riittävästi snapshotteja vielä.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="pvm" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="seuraajat" stroke="#0077B5" strokeWidth={2.5} dot={false} name="Seuraajat" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>Parhaat julkaisut (näyttökerrat)</h3>
        {topPosts.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei julkaisuja {LOOKBACK_DAYS} päivän aikana.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {topPosts.map(({ p, mx }) => (
              <div key={p.id} style={{ padding: '.6rem', background: 'var(--bg2)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.3rem' }}>
                  <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{fiDate(p.published_at)}</span>
                  {p.post_url && (
                    <a href={p.post_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet)', fontSize: '.72rem', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                      Avaa <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.text_content || <em style={{ color: 'var(--text3)' }}>(ei tekstiä)</em>}
                </div>
                {mx && (
                  <div style={{ display: 'flex', gap: '.85rem', fontSize: '.72rem', color: 'var(--text3)' }}>
                    {mx.impressions != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={11} /> {fmtInt(mx.impressions)}</span>}
                    {mx.reactions != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Heart size={11} /> {fmtInt(mx.reactions)}</span>}
                    {mx.comments != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageCircle size={11} /> {fmtInt(mx.comments)}</span>}
                    {mx.shares != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Share2 size={11} /> {fmtInt(mx.shares)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const CHANNEL_TABS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'google', label: 'Google' },
  { id: 'linkedin', label: 'LinkedIn' },
]

export default function Some() {
  const [channel, setChannel] = useState('instagram')

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">SOME-analytiikka</h1>
          <p className="page-subtitle">Instagram · YouTube · Google · LinkedIn</p>
        </div>
      </div>

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

      {channel === 'instagram' && <InstagramTab />}
      {channel === 'youtube' && <YouTubeTab />}
      {channel === 'google' && <GoogleTab />}
      {channel === 'linkedin' && <LinkedInTab />}
    </div>
  )
}
