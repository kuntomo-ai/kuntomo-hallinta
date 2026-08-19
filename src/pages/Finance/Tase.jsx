import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
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

const ASSET_COLORS = {
  aineettomat: '#7C3AED',
  aineelliset: '#2563EB',
  sijoitukset: '#0891B2',
  vaihto:      '#D97706',
  saamiset:    '#EA580C',
  rahat:       '#16A34A',
}

const LIAB_COLORS = {
  oma_paaoma:  '#16A34A',
  vieras_pit:  '#DC2626',
  vieras_lyh:  '#F97316',
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

function EuroTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.5rem .8rem', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '.2rem' }}>{name}</div>
      <div style={{ color: payload[0].payload.fill }}>{fmt(value)}</div>
    </div>
  )
}

function DonutChart({ title, data, total }) {
  return (
    <div className="card" style={{ padding: '1.25rem', flex: 1, minWidth: 260 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', marginBottom: '.75rem' }}>{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="52%"
            outerRadius="75%"
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<EuroTip />} />
          <Legend
            wrapperStyle={{ fontSize: '.72rem', paddingTop: '.5rem' }}
            formatter={(value, entry) => (
              <span style={{ color: 'var(--text2)' }}>
                {value} <span style={{ color: 'var(--text3)' }}>
                  {total > 0 ? `${((entry.payload.value / total) * 100).toFixed(0)} %` : ''}
                </span>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--text3)', marginTop: '.25rem' }}>
        Yhteensä <strong style={{ color: 'var(--text)' }}>{fmt(total)}</strong>
      </div>
    </div>
  )
}

function OmavaraisuusGauge({ pct }) {
  const { color, label, desc } =
    pct >= 50 ? { color: '#16A34A', label: 'Erinomainen', desc: 'Yritys on hyvin vakavarainen ja kestää suuriakin riskejä.' }
    : pct >= 35 ? { color: '#2563EB', label: 'Hyvä',        desc: 'Liiketoiminta on vakaalla pohjalla ja yritys on luotettava kumppani.' }
    : pct >= 20 ? { color: '#D97706', label: 'Tyydyttävä',  desc: 'Ulkopuolisen rahoituksen osuus on merkittävä ja vaatii tarkkaa kassanhallintaa.' }
    :             { color: '#DC2626', label: 'Heikko',      desc: 'Vaatii toimenpiteitä, sillä yhtiö on altis ylivelkaantumiselle.' }
  return (
    <div className="card" style={{ padding: '1.25rem', flex: '0 0 auto', minWidth: 220 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', marginBottom: '1rem' }}>Omavaraisuusaste</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color, lineHeight: 1 }}>{pct.toFixed(1)} %</div>
        <div style={{ marginTop: '.65rem', height: 10, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .6s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', color: 'var(--text3)', marginTop: '.25rem' }}>
          <span>0 %</span><span>20 %</span><span>35 %</span><span>50 %</span><span>100 %</span>
        </div>
        <div style={{ marginTop: '.6rem', fontSize: '.78rem', fontWeight: 700, color, background: `color-mix(in srgb, ${color} 12%, var(--bg1))`, borderRadius: 6, padding: '.3rem .75rem', display: 'inline-block' }}>
          {label}
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginTop: '.6rem', lineHeight: 1.45, textAlign: 'left' }}>
          {desc}
        </div>
        <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
          Oma pääoma / Vastaavaa yhteensä
        </div>
      </div>
    </div>
  )
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
              <SubSection key={sub.key} title={sub.label} rows={rows.filter(r => r.sub_section === sub.key)} />
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
    const { data } = await supabase.from('tase_snapshot').select('*').order('side').order('section').order('sub_section').order('account_code')
    const items = data || []
    setRows(items)
    // Näytä vain uusin jakso — kannassa voi olla useita jaksoja (mm. tilikohtaisia
    // rivejä lainaominaisuutta varten), joita ei saa summata keskenään.
    if (items.length) setPeriod(items.map(r => r.period).sort().at(-1))
    setLoading(false)
  }

  const periodRows      = rows.filter(r => r.period === period)
  const vastaavaaRows   = periodRows.filter(r => r.side === 'vastaavaa')
  const vastattavaaRows = periodRows.filter(r => r.side === 'vastattavaa')
  const vastaavaaTotal  = vastaavaaRows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
  const vastattavaaTotal = vastattavaaRows.reduce((s, r) => s + (r.loppusaldo || 0), 0)
  const balanced = Math.abs(vastaavaaTotal - vastattavaaTotal) < 0.1

  const subTotal = (key) => periodRows.filter(r => r.sub_section === key).reduce((s, r) => s + (r.loppusaldo || 0), 0)

  const assetData = [
    { name: 'Aineettomat hyödykkeet', value: subTotal('aineettomat'), fill: ASSET_COLORS.aineettomat },
    { name: 'Aineelliset hyödykkeet', value: subTotal('aineelliset'), fill: ASSET_COLORS.aineelliset },
    { name: 'Sijoitukset',            value: subTotal('sijoitukset'), fill: ASSET_COLORS.sijoitukset },
    { name: 'Vaihto-omaisuus',        value: subTotal('vaihto'),      fill: ASSET_COLORS.vaihto      },
    { name: 'Saamiset',               value: subTotal('saamiset'),    fill: ASSET_COLORS.saamiset    },
    { name: 'Rahat ja pankkisaamiset',value: subTotal('rahat'),       fill: ASSET_COLORS.rahat       },
  ].filter(d => d.value > 0)

  const liabData = [
    { name: 'Oma pääoma',                  value: subTotal('oma_paaoma'),  fill: LIAB_COLORS.oma_paaoma  },
    { name: 'Pitkäaikainen vieras pääoma', value: subTotal('vieras_pit'),  fill: LIAB_COLORS.vieras_pit  },
    { name: 'Lyhytaikainen vieras pääoma', value: subTotal('vieras_lyh'),  fill: LIAB_COLORS.vieras_lyh  },
  ].filter(d => d.value > 0)

  const omaPaaoma = subTotal('oma_paaoma')
  const omavaraisuus = vastaavaaTotal > 0 ? (omaPaaoma / vastaavaaTotal) * 100 : 0

  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tase</h1>
          <p className="page-subtitle">
            {period ? `${period} loppusaldo` : 'Vastaavaa ja vastattavaa'}
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
          {/* KPI-kortit */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Vastaavaa yhteensä</div>
              <div className="stat-value gold">{fmt(vastaavaaTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Oma pääoma</div>
              <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(omaPaaoma)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rahat & pankkisaamiset</div>
              <div className="stat-value">{fmt(subTotal('rahat'))}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Vieras pääoma yht.</div>
              <div className="stat-value" style={{ color: 'var(--red)' }}>
                {fmt(subTotal('vieras_pit') + subTotal('vieras_lyh'))}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Saamiset</div>
              <div className="stat-value">{fmt(subTotal('saamiset'))}</div>
            </div>
          </div>

          {/* Graafit */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <DonutChart title="Varojen rakenne (vastaavaa)" data={assetData} total={vastaavaaTotal} />
            <DonutChart title="Rahoitusrakenne (vastattavaa)" data={liabData} total={vastattavaaTotal} />
            <OmavaraisuusGauge pct={omavaraisuus} />
          </div>

          {/* Taulukkotase */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              <Side title="Vastaavaa" sections={SECTIONS.vastaavaa} rows={vastaavaaRows} total={vastaavaaTotal} />
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <Side title="Vastattavaa" sections={SECTIONS.vastattavaa} rows={vastattavaaRows} total={vastattavaaTotal} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
