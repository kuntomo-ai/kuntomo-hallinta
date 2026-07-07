import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import KirjanpitoNav from '../../components/KirjanpitoNav'
import { FileText } from 'lucide-react'

// ─── Historialliset tilinpäätöstiedot ────────────────────────────────────────
// FY = tilikausi päättyy 30.4.
// FY2017 kattaa 18 kk (1.11.2015–30.4.2017) — vertailuluku huomioitava
const DATA = [
  {
    label: '2017', period: '1.11.2015–30.4.2017', note: '18 kk',
    liikevaihto:  393_293, liikevoitto:  -36_720, voitto: -44_406,
    tase:          81_305, oma:          -28_570,
    pdf: null,
  },
  {
    label: '2018', period: '1.5.2017–30.4.2018',
    liikevaihto:  407_082, liikevoitto:   20_593, voitto:  15_127,
    tase:          87_748, oma:          -13_443,
    pdf: null,
  },
  {
    label: '2019', period: '1.5.2018–30.4.2019',
    liikevaihto:  662_645, liikevoitto:   13_046, voitto:   8_028,
    tase:         120_893, oma:           -5_415,
    pdf: null,
  },
  {
    label: '2020', period: '1.5.2019–30.4.2020',
    liikevaihto:  735_760, liikevoitto:    5_651, voitto:  10_926,
    tase:          88_369, oma:             5_510,
    pdf: null,
  },
  {
    label: '2021', period: '1.5.2020–30.4.2021',
    liikevaihto:  784_566, liikevoitto:    9_866, voitto:   7_373,
    tase:         129_414, oma:            12_883,
    pdf: null,
  },
  {
    label: '2022', period: '1.5.2021–30.4.2022',
    liikevaihto: 1_068_342, liikevoitto:  -2_259, voitto: -10_162,
    tase:          195_712, oma:             2_721,
    pdf: null,
  },
  {
    label: '2023', period: '1.5.2022–30.4.2023',
    liikevaihto: 1_269_200, liikevoitto:   6_555, voitto:      872,
    tase:          187_679, oma:             3_593,
    pdf: 'https://sign.visma.net/fi/document-check/5843dc57-8252-4c40-b0d7-da305a1dceb6',
  },
  {
    label: '2024', period: '1.5.2023–30.4.2024',
    liikevaihto: 1_260_200, liikevoitto:  74_308, voitto:  61_629,
    tase:          224_778, oma:            65_222,
    pdf: 'https://sign.visma.net/fi/document-check/5d3859ea-33ec-4484-9ab8-82f824dffc3d',
  },
  {
    label: '2025', period: '1.5.2024–30.4.2025',
    liikevaihto: 1_616_258, liikevoitto:  14_275, voitto: -10_813,
    tase:          500_627, oma:            54_410,
    pdf: 'https://sign.visma.net/fi/document-check/c919f022-bc46-407d-952a-41392fc04013',
  },
  {
    label: '2026', period: '1.5.2025–30.4.2026',
    liikevaihto: 1_919_009, liikevoitto: 226_365, voitto: 171_045,
    tase:          642_003, oma:          225_455,
    pdf: 'https://sign.visma.net/fi/document-check/d7cddf5a-af7b-46c8-adfa-93f5f4578c69',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VIOLET  = 'var(--violet)'
const GREEN   = '#22c55e'
const RED     = '#ef4444'
const BLUE    = '#3b82f6'
const GRAY    = '#94a3b8'

function kEur(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const str = (abs / 1000).toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (v < 0 ? '-' : '') + str + ' k€'
}

function eur(v) {
  if (v == null) return '—'
  return v.toLocaleString('fi-FI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

// Custom tooltip
function EurTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '.5rem .75rem', fontSize: '.8rem', minWidth: 120 }}>
      <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || 'var(--text1)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{kEur(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2rem 0 .75rem' }}>
      {children}
    </h3>
  )
}

// ─── Charts ──────────────────────────────────────────────────────────────────
function LiikevaihdoChart() {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '1rem' }}>Liikevaihto</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={DATA} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => (v / 1000).toFixed(0) + 'k'}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false} width={42}
          />
          <Tooltip content={<EurTooltip />} />
          <Bar dataKey="liikevaihto" name="Liikevaihto" radius={[4, 4, 0, 0]} fill={VIOLET} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TulosChart() {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '1rem' }}>Liikevoitto & Tilikauden tulos</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={DATA} barSize={14} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => (v / 1000).toFixed(0) + 'k'}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false} width={42}
          />
          <Tooltip content={<EurTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: '.5rem' }} />
          <Bar dataKey="liikevoitto" name="Liikevoitto" radius={[3, 3, 0, 0]}>
            {DATA.map(d => (
              <Cell key={d.label} fill={d.liikevoitto >= 0 ? BLUE : RED} />
            ))}
          </Bar>
          <Bar dataKey="voitto" name="Tilikauden tulos" radius={[3, 3, 0, 0]}>
            {DATA.map(d => (
              <Cell key={d.label} fill={d.voitto >= 0 ? GREEN : RED} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TaseChart() {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '1rem' }}>Tase & Oma pääoma</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => (v / 1000).toFixed(0) + 'k'}
            tick={{ fontSize: 10, fill: 'var(--text3)' }}
            axisLine={false} tickLine={false} width={42}
          />
          <Tooltip content={<EurTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: '.5rem' }} />
          <Line type="monotone" dataKey="tase" name="Tase yhteensä" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} />
          <Line type="monotone" dataKey="oma" name="Oma pääoma" stroke={GREEN} strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Tilinpaatos() {
  return (
    <div>
      <KirjanpitoNav />

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tilinpäätökset</h1>
          <p className="page-subtitle">Historialliset tilinpäätöstiedot 2017–2026</p>
        </div>
      </div>

      {/* KPI tiles – viimeisin tilikausi */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Liikevaihto 2026',   value: eur(DATA[9].liikevaihto) },
          { label: 'Liikevoitto 2026',   value: eur(DATA[9].liikevoitto), color: DATA[9].liikevoitto >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Tilikauden tulos',   value: eur(DATA[9].voitto),      color: DATA[9].voitto >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Tase 30.4.2026',     value: eur(DATA[9].tase) },
          { label: 'Oma pääoma 2026',    value: eur(DATA[9].oma),         color: DATA[9].oma >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.3rem' }}>{k.label}</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: k.color || 'var(--text1)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <SectionTitle>Kehitys vuosittain</SectionTitle>
      <div className="grid-cols-2" style={{ marginBottom: '1rem' }}>
        <LiikevaihdoChart />
        <TulosChart />
      </div>
      <TaseChart />

      {/* Data table */}
      <SectionTitle>Tilinpäätöstiedot</SectionTitle>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th>Tilikausi</th>
              <th>Ajanjakso</th>
              <th style={{ textAlign: 'right' }}>Liikevaihto</th>
              <th style={{ textAlign: 'right' }}>Liikevoitto</th>
              <th style={{ textAlign: 'right' }}>Tilikauden tulos</th>
              <th style={{ textAlign: 'right' }}>Tase</th>
              <th style={{ textAlign: 'right' }}>Oma pääoma</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...DATA].reverse().map(d => (
              <tr key={d.label}>
                <td>
                  <span style={{ fontWeight: 600 }}>FY{d.label}</span>
                  {d.note && <span className="badge badge-gray" style={{ marginLeft: '.4rem', fontSize: '.65rem' }}>{d.note}</span>}
                </td>
                <td style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{d.period}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{eur(d.liikevaihto)}</td>
                <td style={{ textAlign: 'right', color: d.liikevoitto >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {eur(d.liikevoitto)}
                </td>
                <td style={{ textAlign: 'right', color: d.voitto >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {eur(d.voitto)}
                </td>
                <td style={{ textAlign: 'right' }}>{eur(d.tase)}</td>
                <td style={{ textAlign: 'right', color: d.oma >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {eur(d.oma)}
                </td>
                <td>
                  {d.pdf ? (
                    <a
                      href={d.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ padding: '.25rem .5rem', fontSize: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                    >
                      <FileText size={12} /> PDF
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.75rem' }}>
        * FY2017 kattaa 18 kuukautta (1.11.2015–30.4.2017) yrityksen ensimmäisenä tilikautena.
        Luvut pyöristetty lähimpään euroon. FY2020 tilikauden tulos sisältää tilinpäätössiirrot.
      </p>
    </div>
  )
}
