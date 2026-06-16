import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import ReactMarkdown from 'react-markdown'
import { ExternalLink, Heart, MessageCircle, Bookmark, Share2, Eye } from 'lucide-react'
import { supabaseAdmin } from '../lib/supabase'

const LOOKBACK_DAYS = 30

function fmtInt(n) {
  return Number(n ?? 0).toLocaleString('fi-FI')
}

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function fiDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' })
}

export default function Instagram() {
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
      supabaseAdmin.from('ig_accounts').select('*').eq('is_active', true).order('label'),
      supabaseAdmin.from('ig_account_snapshots').select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true }),
      supabaseAdmin.from('ig_media').select('*').gte('posted_at', since).order('posted_at', { ascending: false }),
      supabaseAdmin.from('ig_analyses').select('*').order('period_end', { ascending: false }),
    ])
    const accs = accRes.data || []
    setAccounts(accs)
    setSelected(s => s ?? accs[0]?.id ?? null)
    setSnaps(snapRes.data || [])
    setMedia(medRes.data || [])
    setAnalyses(anRes.data || [])

    const mediaIds = (medRes.data || []).map(m => m.id)
    if (mediaIds.length) {
      const { data: met } = await supabaseAdmin
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

  const accountSnaps = useMemo(
    () => snaps.filter(s => s.account_id === selected),
    [snaps, selected]
  )
  const chartData = useMemo(() => accountSnaps.map(s => ({
    pvm: fiDate(s.snapshot_date),
    seuraajia: s.followers_count ?? 0,
    reach: s.reach ?? 0,
    profile_views: s.profile_views ?? 0,
  })), [accountSnaps])

  const accountMedia = useMemo(
    () => media.filter(m => m.account_id === selected),
    [media, selected]
  )

  // Latest metric snapshot per media
  const latestByMedia = useMemo(() => {
    const m = new Map()
    for (const row of metrics) {
      if (!m.has(row.media_id)) m.set(row.media_id, row)
    }
    return m
  }, [metrics])

  const topMedia = useMemo(() => {
    return accountMedia
      .map(med => ({ med, mx: latestByMedia.get(med.id) }))
      .filter(x => x.mx)
      .sort((a, b) => (b.mx.total_interactions || 0) - (a.mx.total_interactions || 0))
      .slice(0, 5)
  }, [accountMedia, latestByMedia])

  const latestAnalysis = useMemo(
    () => analyses.find(a => a.account_id === selected),
    [analyses, selected]
  )

  // Current vs first snapshot delta
  const trend = useMemo(() => {
    if (accountSnaps.length < 2) return null
    const first = accountSnaps[0]
    const last = accountSnaps[accountSnaps.length - 1]
    const diff = (last.followers_count || 0) - (first.followers_count || 0)
    return { diff, pct: first.followers_count ? (diff / first.followers_count) * 100 : null, last }
  }, [accountSnaps])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Instagram-analytiikka</h1>
          <p className="page-subtitle">Viimeisen {LOOKBACK_DAYS} päivän data — päivittyy automaattisesti yöllä</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {accounts.map(a => (
          <button
            key={a.id}
            className={`sub-tab${selected === a.id ? ' active' : ''}`}
            onClick={() => setSelected(a.id)}
          >
            @{a.username}{a.label ? ` · ${a.label}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ladataan...</div>
      ) : !sel ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Ei aktiivisia tilejä.</div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Seuraajia</div>
              <div className="stat-value gold">{fmtInt(trend?.last.followers_count)}</div>
              {trend && trend.diff !== 0 && (
                <div style={{ fontSize: '.72rem', color: trend.diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: '.25rem' }}>
                  {trend.diff >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(trend.diff))}{trend.pct != null ? ` (${trend.pct.toFixed(1)}%)` : ''} vs. {LOOKBACK_DAYS} pv sitten
                </div>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-label">Reach (eilen)</div>
              <div className="stat-value">{fmtInt(trend?.last.reach)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profile views (eilen)</div>
              <div className="stat-value">{fmtInt(trend?.last.profile_views)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Julkaisuja jakson aikana</div>
              <div className="stat-value">{accountMedia.length}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>
              Seuraajakehitys & reach
            </h3>
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
            {/* Top media */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: '.75rem' }}>
                Parhaat julkaisut (total interactions)
              </h3>
              {topMedia.length === 0 ? (
                <p style={{ color: 'var(--text3)', fontSize: '.82rem' }}>Ei julkaisuja jakson aikana.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  {topMedia.map(({ med, mx }) => (
                    <div key={med.id} style={{ display: 'flex', gap: '.75rem', padding: '.6rem', background: 'var(--bg2)', borderRadius: 'var(--radius)', alignItems: 'flex-start' }}>
                      {med.thumbnail_url && (
                        <img src={med.thumbnail_url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      )}
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

            {/* Latest AI analysis */}
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>
                  AI-yhteenveto
                </h3>
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
      )}
    </div>
  )
}
