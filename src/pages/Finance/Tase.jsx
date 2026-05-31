import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'

const SECTIONS = {
  vastaavaa: [
    { key: 'pysyvat_vastaavat', label: 'Pysyvät vastaavat', subs: [
      { key: 'aineettomat', label: 'Aineettomat hyödykkeet' },
      { key: 'aineelliset', label: 'Aineelliset hyödykkeet' },
      { key: 'sijoitukset', label: 'Sijoitukset' },
    ]},
    { key: 'vaihtuvat_vastaavat', label: 'Vaihtuvat vastaavat', subs: [
      { key: 'vaihto', label: 'Vaihto-omaisuus' },
      { key: 'saamiset', label: 'Saamiset' },
      { key: 'rahat', label: 'Rahat ja pankkisaamiset' },
    ]},
  ],
  vastattavaa: [
    { key: null, label: 'Oma pääoma', subs: [
      { key: 'oma_paaoma', label: 'Oma pääoma' },
    ]},
    { key: null, label: 'Vieras pääoma', subs: [
      { key: 'vieras_pit', label: 'Pitkäaikainen vieras pääoma' },
      { key: 'vieras_lyh', label: 'Lyhytaikainen vieras pääoma' },
    ]},
  ],
}

function fmt(v, sign = false) {
  if (v == null) return '—'
  const n = Number(v)
  const s = Math.abs(n).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (sign && n < 0) return `-${s} €`
  return `${s} €`
}

function fmtChange(v) {
  if (v == null || v === 0) return <span style={{ color: 'var(--text3)' }}>—</span>
  const n = Number(v)
  const s = Math.abs(n).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span style={{ color: n > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{n > 0 ? '+' : '-'}{s} €</span>
}

function SubSection({ title, rows }) {
  const [open, setOpen] = useState(true)
  const total = rows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: '.5rem' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', borderRadius: 6, background: 'var(--bg2)', marginBottom: open ? 4 : 0 }}
      >
        <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</span>
        <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text1)' }}>{fmt(total)}</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '5px 12px', borderBottom: '1px solid var(--border)', fontSize: '.8rem', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--text3)', marginRight: 6, fontFamily: 'monospace', fontSize: '.72rem' }}>{r.account_code}</span>
                <span style={{ color: 'var(--text1)' }}>{r.account_name}</span>
              </div>
              <div style={{ textAlign: 'right', color: 'var(--text3)' }}>{fmt(r.alkusaldo)}</div>
              <div style={{ textAlign: 'right' }}>{fmtChange(r.muutos)}</div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: r.loppusaldo < 0 ? 'var(--red)' : 'var(--text1)' }}>{fmt(r.loppusaldo, true)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Side({ title, sections, rows, total }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '.06em', marginBottom: '1rem', color: 'var(--violet)', textTransform: 'uppercase' }}>
        {title}
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', padding: '4px 12px', fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        <div>Tili</div>
        <div style={{ textAlign: 'right' }}>Alkusaldo</div>
        <div style={{ textAlign: 'right' }}>Muutos</div>
        <div style={{ textAlign: 'right' }}>Loppusaldo</div>
      </div>

      {sections.map(sec => {
        const secRows = rows.filter(r => sec.key === null
          ? sec.subs.some(s => r.sub_section === s.key)
          : r.section === sec.key
        )
        const secTotal = secRows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
        return (
          <div key={sec.label} style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: 'color-mix(in srgb, var(--violet) 8%, var(--bg1))', borderRadius: 8, marginBottom: 6, borderLeft: '3px solid var(--violet)' }}>
              <span style={{ fontWeight: 700, fontSize: '.85rem' }}>{sec.label}</span>
              <span style={{ fontWeight: 800, fontSize: '.9rem' }}>{fmt(secTotal)}</span>
            </div>
            {sec.subs.map(sub => (
              <SubSection
                key={sub.key}
                title={sub.label}
                rows={rows.filter(r => r.sub_section === sub.key)}
              />
            ))}
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '2px solid var(--violet)', marginTop: '0.5rem', background: 'color-mix(in srgb, var(--violet) 5%, var(--bg1))', borderRadius: '0 0 8px 8px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{title} yhteensä</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.15rem', color: 'var(--violet)' }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function Tase() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('tase_snapshot').select('*').order('side').order('section').order('sub_section').order('account_code')
    const items = data || []
    setRows(items)
    if (items.length) setPeriod(items[0].period)
    setLoading(false)
  }

  const vastaavaaRows = rows.filter(r => r.side === 'vastaavaa')
  const vastattavaaRows = rows.filter(r => r.side === 'vastattavaa')
  const vastaavaaTotal = vastaavaaRows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
  const vastattavaaTotal = vastattavaaRows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
  const balanced = Math.abs(vastaavaaTotal - vastattavaaTotal) < 0.1

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tase</h1>
          <p className="page-subtitle">
            {period ? `30.4.2026 loppusaldo · tilikausi 1.5.2025–30.4.2026` : 'Vastaavaa ja vastattavaa'}
          </p>
        </div>
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
              background: balanced ? 'color-mix(in srgb, var(--green) 15%, var(--bg1))' : 'color-mix(in srgb, var(--red) 15%, var(--bg1))',
              color: balanced ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${balanced ? 'var(--green)' : 'var(--red)'}`,
            }}>
              {balanced ? '✓ Tase täsmää' : '✗ Tase ei täsmää'}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>Ladataan...</div>
      ) : !rows.length ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem' }}>
          Ei dataa. Aja <code>tase_snapshot.sql</code> Supabase SQL Editorissa.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-label">Vastaavaa yhteensä</div>
              <div className="stat-value gold">{fmt(vastaavaaTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Oma pääoma</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>
                {fmt(vastattavaaRows.filter(r => r.sub_section === 'oma_paaoma').reduce((s, r) => s + (r.loppusaldo || 0), 0))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rahat & pankkisaamiset</div>
              <div className="stat-value">
                {fmt(vastaavaaRows.filter(r => r.sub_section === 'rahat').reduce((s, r) => s + (r.loppusaldo || 0), 0))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Vieras pääoma yht.</div>
              <div className="stat-value" style={{ color: 'var(--red)' }}>
                {fmt(vastattavaaRows.filter(r => r.sub_section?.startsWith('vieras')).reduce((s, r) => s + (r.loppusaldo || 0), 0))}
              </div>
            </div>
          </div>

          {/* Balance sheet two-column layout */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              <Side
                title="Vastaavaa"
                sections={SECTIONS.vastaavaa}
                rows={vastaavaaRows}
                total={vastaavaaTotal}
              />
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <Side
                title="Vastattavaa"
                sections={SECTIONS.vastattavaa}
                rows={vastattavaaRows}
                total={vastattavaaTotal}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
