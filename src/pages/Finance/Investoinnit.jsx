import { useState, useMemo } from 'react'
import {
  ComposedChart, BarChart, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Plus, Trash2 } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
let _id = 100
function nid() { return ++_id }

function fmt(n, dec = 0) {
  const abs = Math.abs(n)
  const s = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: dec }).format(abs) + ' €'
  return n < 0 ? `−${s}` : s
}

const CLR_GREEN  = 'var(--green)'
const CLR_RED    = 'var(--red)'
const CLR_BLUE   = '#6366f1'
const CLR_ORANGE = '#f59e0b'

// 4-week billing → monthly: price × 13/12 (= 52 weeks / 4 / 12 months)
// kertakäynti (periodWeeks === null): count = käynnit per kk, monthly = count × price
function memberMonthly(m) {
  if (m.periodWeeks) return m.count * m.price * (52 / m.periodWeeks / 12)
  return m.count * m.price
}

// Apply annual growth at year boundaries (growth resets at each 12-month mark)
function withGrowth(base, pct, monthIdx) {
  const year = Math.floor(monthIdx / 12)
  return base * Math.pow(1 + pct / 100, year)
}

function calcMonths(expenses, memberships, otherRevs, horisontti) {
  let cum = 0
  return Array.from({ length: horisontti }, (_, i) => {
    const menot     = expenses.reduce((s, e) => s + withGrowth(e.amount, e.growthPct, i), 0)
    const jasenTulot = memberships.reduce((s, m) => s + withGrowth(memberMonthly(m), m.growthPct, i), 0)
    const muutTulot  = otherRevs.reduce((s, r) => s + withGrowth(r.amount, r.growthPct, i), 0)
    const tulot      = jasenTulot + muutTulot
    const netto      = tulot - menot
    cum += netto
    return {
      kk: i + 1,
      label: `Kk ${i + 1}`,
      tulot:          Math.round(tulot),
      menot:          Math.round(menot),
      netto:          Math.round(netto),
      kumulatiivinen: Math.round(cum),
    }
  })
}

// ── Default data ──────────────────────────────────────────────────────────────
const DEF_EXPENSES = [
  { id: 1, label: 'Vuokra',            amount: 3000, growthPct: 2   },
  { id: 2, label: 'Laina',             amount: 1500, growthPct: 0   },
  { id: 3, label: 'Sähkö',             amount: 400,  growthPct: 3   },
  { id: 4, label: 'Leasingkulut',      amount: 500,  growthPct: 0   },
  { id: 5, label: 'Markkinointikulut', amount: 600,  growthPct: 0   },
  { id: 6, label: 'Laitehankinnat',    amount: 200,  growthPct: 0   },
]

const DEF_MEMBERSHIPS = [
  { id: 1, label: 'Kuntosali',     price: 38.90, periodWeeks: 4,    count: 50, growthPct: 10 },
  { id: 2, label: 'Päiväjäsenyys', price: 27.90, periodWeeks: 4,    count: 20, growthPct:  5 },
  { id: 3, label: 'Kertakäynti',   price: 12.00, periodWeeks: null, count: 30, growthPct:  5 },
]

const DEF_OTHER_REVS = [
  { id: 1, label: 'Hoitohuonevuokrat', amount: 1200, growthPct: 2 },
  { id: 2, label: 'Lisäravinnemyynti', amount:  800, growthPct: 5 },
]

// ── Small components ──────────────────────────────────────────────────────────
function NumInput({ value, onChange, step = 1, min, style }) {
  return (
    <input
      className="input-field"
      type="number" step={step} value={value}
      min={min ?? undefined}
      onChange={e => onChange(Number(e.target.value))}
      style={{ fontSize: '.8rem', padding: '.28rem .5rem', height: 'auto', textAlign: 'right', ...style }}
    />
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.07em', color: 'var(--text3)',
      borderBottom: '1px solid var(--border)', paddingBottom: '.35rem', marginBottom: '.55rem',
    }}>
      {children}
    </div>
  )
}

function ColHeader({ children, right }) {
  return (
    <span style={{ fontSize: '.66rem', color: 'var(--text3)', textAlign: right ? 'right' : 'left' }}>
      {children}
    </span>
  )
}

function RowTotal({ label, value }) {
  return (
    <div style={{
      marginTop: '.7rem', paddingTop: '.55rem', borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', fontSize: '.8rem',
    }}>
      <span style={{ color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} title="Poista" style={{
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
      padding: '.15rem', borderRadius: 4, display: 'flex', alignItems: 'center',
    }}>
      <Trash2 size={13} />
    </button>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '.55rem .85rem', fontSize: '.76rem',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '.3rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{
          color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem',
        }}>
          <span>{p.name}</span><span>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card" style={{ padding: '1.1rem' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', margin: '0 0 .9rem' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Investoinnit() {
  const [expenses,    setExpenses]    = useState(DEF_EXPENSES)
  const [memberships, setMemberships] = useState(DEF_MEMBERSHIPS)
  const [otherRevs,   setOtherRevs]   = useState(DEF_OTHER_REVS)
  const [horisontti,  setHorisontti]  = useState(36)

  // ── Projections ─────────────────────────────────────────────────────────
  const months = useMemo(
    () => calcMonths(expenses, memberships, otherRevs, horisontti),
    [expenses, memberships, otherRevs, horisontti],
  )

  const yearSummaries = useMemo(() => {
    const n = Math.ceil(horisontti / 12)
    return Array.from({ length: n }, (_, y) => {
      const slice = months.slice(y * 12, (y + 1) * 12)
      return {
        year:  y + 1,
        label: `Vuosi ${y + 1}`,
        Tulot: slice.reduce((s, m) => s + m.tulot, 0),
        Menot: slice.reduce((s, m) => s + m.menot, 0),
        Netto: slice.reduce((s, m) => s + m.netto, 0),
      }
    })
  }, [months, horisontti])

  const breakEvenMonth = useMemo(
    () => { const i = months.findIndex(m => m.netto >= 0); return i === -1 ? null : i + 1 },
    [months],
  )
  const cumBreakEvenMonth = useMemo(
    () => { const i = months.findIndex(m => m.kumulatiivinen >= 0); return i === -1 ? null : i + 1 },
    [months],
  )

  // Chart data — thin out x-axis for 36-month view
  const chartData = horisontti > 24
    ? months.map((m, i) => ({ ...m, label: i % 3 === 2 ? `Kk ${m.kk}` : '' }))
    : months

  // ── Expense handlers ─────────────────────────────────────────────────────
  const updateExpense = (id, field, val) =>
    setExpenses(p => p.map(e => e.id === id ? { ...e, [field]: val } : e))
  const addExpense = () =>
    setExpenses(p => [...p, { id: nid(), label: 'Uusi kulu', amount: 0, growthPct: 0 }])
  const removeExpense = id =>
    setExpenses(p => p.filter(e => e.id !== id))

  // ── Membership handlers ──────────────────────────────────────────────────
  const updateMembership = (id, field, val) =>
    setMemberships(p => p.map(m => m.id === id ? { ...m, [field]: val } : m))

  // ── Other revenue handlers ───────────────────────────────────────────────
  const updateOtherRev = (id, field, val) =>
    setOtherRevs(p => p.map(r => r.id === id ? { ...r, [field]: val } : r))
  const addOtherRev = () =>
    setOtherRevs(p => [...p, { id: nid(), label: 'Uusi tulo', amount: 0, growthPct: 0 }])
  const removeOtherRev = id =>
    setOtherRevs(p => p.filter(r => r.id !== id))

  // ── Totals for summary ───────────────────────────────────────────────────
  const totalExpenseM1 = expenses.reduce((s, e) => s + e.amount, 0)
  const totalMemberM1  = memberships.reduce((s, m) => s + memberMonthly(m), 0)
  const totalOtherM1   = otherRevs.reduce((s, r) => s + r.amount, 0)
  const totalRevenueM1 = totalMemberM1 + totalOtherM1
  const nettoM1        = totalRevenueM1 - totalExpenseM1

  return (
    <div className="page-wrapper">

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Investointilaskuri</h1>
          <p className="page-subtitle">Uusien toimipisteiden tuotto- ja kuluprojektio</p>
        </div>
        <div style={{ display: 'flex', gap: '.3rem' }}>
          {[12, 24, 36].map(h => (
            <button key={h}
              className={`sub-tab${horisontti === h ? ' active' : ''}`}
              style={{ fontSize: '.8rem', padding: '.35rem .7rem' }}
              onClick={() => setHorisontti(h)}>
              {h} kk
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', marginBottom: '1.25rem' }}>
        {yearSummaries.map(y => (
          <div className="stat-card" key={y.year}>
            <div className="stat-label">Vuosi {y.year} netto</div>
            <div className="stat-value" style={{ color: y.Netto >= 0 ? CLR_GREEN : CLR_RED }}>
              {fmt(y.Netto)}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
              Tulot {fmt(y.Tulot)} · Menot {fmt(y.Menot)}
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-label">Kk 1 netto</div>
          <div className="stat-value" style={{ color: nettoM1 >= 0 ? CLR_GREEN : CLR_RED }}>
            {fmt(nettoM1)}
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
            Tulot {fmt(totalRevenueM1)} · Menot {fmt(totalExpenseM1)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kuukausitasapaino</div>
          <div className="stat-value">{breakEvenMonth ? `Kk ${breakEvenMonth}` : '—'}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>1. kk jolloin netto ≥ 0</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kum. tasapaino</div>
          <div className="stat-value">{cumBreakEvenMonth ? `Kk ${cumBreakEvenMonth}` : '—'}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>1. kk jolloin kum. ≥ 0</div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Menot */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Menot / kk</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 54px 22px', gap: '.3rem', marginBottom: '.3rem' }}>
              <ColHeader>Kulu</ColHeader>
              <ColHeader right>€/kk</ColHeader>
              <ColHeader right>Kasvu/v%</ColHeader>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {expenses.map(e => (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr 76px 54px 22px', gap: '.3rem', alignItems: 'center' }}>
                  <input
                    className="input-field"
                    value={e.label}
                    onChange={ev => updateExpense(e.id, 'label', ev.target.value)}
                    style={{ fontSize: '.8rem', padding: '.28rem .5rem', height: 'auto' }}
                  />
                  <NumInput value={e.amount} step={50} min={0}
                    onChange={v => updateExpense(e.id, 'amount', v)} />
                  <NumInput value={e.growthPct} step={0.5}
                    onChange={v => updateExpense(e.id, 'growthPct', v)} />
                  <DeleteBtn onClick={() => removeExpense(e.id)} />
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addExpense}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem' }}>
              <Plus size={13} /> Lisää kulu
            </button>
            <RowTotal label="Yhteensä kk 1" value={fmt(totalExpenseM1)} />
          </div>

          {/* Jäsenyysmyynti */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Jäsenyysmyynti</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 52px 50px 52px', gap: '.3rem', marginBottom: '.3rem' }}>
              <ColHeader>Tuote</ColHeader>
              <ColHeader right>Hinta €</ColHeader>
              <ColHeader right>Asiak.</ColHeader>
              <ColHeader right>Kasvu/v%</ColHeader>
              <ColHeader right>€/kk</ColHeader>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
              {memberships.map(m => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 58px 52px 50px 52px', gap: '.3rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>
                      {m.periodWeeks ? `/${m.periodWeeks} vko` : '/käynti'}
                    </div>
                  </div>
                  <NumInput value={m.price} step={0.10} min={0}
                    onChange={v => updateMembership(m.id, 'price', v)} />
                  <NumInput value={m.count} step={1} min={0}
                    onChange={v => updateMembership(m.id, 'count', v)} />
                  <NumInput value={m.growthPct} step={1}
                    onChange={v => updateMembership(m.id, 'growthPct', v)} />
                  <span style={{ fontSize: '.8rem', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>
                    {fmt(memberMonthly(m))}
                  </span>
                </div>
              ))}
            </div>
            <RowTotal label="Yhteensä kk 1" value={fmt(totalMemberM1)} />
          </div>

          {/* Muut tulot */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Muut tulot / kk</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 54px 22px', gap: '.3rem', marginBottom: '.3rem' }}>
              <ColHeader>Tulo</ColHeader>
              <ColHeader right>€/kk</ColHeader>
              <ColHeader right>Kasvu/v%</ColHeader>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {otherRevs.map(r => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 76px 54px 22px', gap: '.3rem', alignItems: 'center' }}>
                  <input
                    className="input-field"
                    value={r.label}
                    onChange={ev => updateOtherRev(r.id, 'label', ev.target.value)}
                    style={{ fontSize: '.8rem', padding: '.28rem .5rem', height: 'auto' }}
                  />
                  <NumInput value={r.amount} step={50} min={0}
                    onChange={v => updateOtherRev(r.id, 'amount', v)} />
                  <NumInput value={r.growthPct} step={0.5}
                    onChange={v => updateOtherRev(r.id, 'growthPct', v)} />
                  <DeleteBtn onClick={() => removeOtherRev(r.id)} />
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addOtherRev}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem' }}>
              <Plus size={13} /> Lisää tulo
            </button>
            <RowTotal label="Yhteensä kk 1" value={fmt(totalOtherM1)} />
          </div>

        </div>

        {/* ── Right panel: charts + table ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Tulot vs Menot */}
          <ChartCard title="Tulot vs. Menot — kuukausittain">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={38} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '.75rem' }} />
                <Area type="monotone" dataKey="tulot" name="Tulot"
                  fill="#00b89422" stroke={CLR_GREEN} strokeWidth={2} />
                <Area type="monotone" dataKey="menot" name="Menot"
                  fill="#d6303122" stroke={CLR_RED} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Kuukausittainen netto */}
          <ChartCard title="Kuukausittainen netto">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={38} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                <Bar dataKey="netto" name="Netto" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.netto >= 0 ? '#00b894' : '#d63031'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Kumulatiivinen kassavirta */}
          <ChartCard title="Kumulatiivinen kassavirta">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={38} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                <Area type="monotone" dataKey="kumulatiivinen" name="Kumulatiivinen"
                  fill={`${CLR_BLUE}22`} stroke={CLR_BLUE} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Vuosittainen vertailu */}
          <ChartCard title="Vuosittainen vertailu">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yearSummaries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={38} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '.75rem' }} />
                <Bar dataKey="Tulot" fill="#00b894" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Menot" fill="#d63031" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Netto" fill={CLR_BLUE}  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Kuukausianalyysi taulukko */}
          <ChartCard title="Kuukausianalyysi">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Kk', 'Tulot', 'Menot', 'Netto', 'Kumulatiivinen'].map(h => (
                      <th key={h} style={{
                        padding: '.4rem .6rem', textAlign: h === 'Kk' ? 'left' : 'right',
                        color: 'var(--text3)', fontSize: '.68rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={m.kk} style={{
                      borderBottom: m.kk % 12 === 0
                        ? '2px solid var(--border)'
                        : '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg2)',
                    }}>
                      <td style={{ padding: '.32rem .6rem', color: 'var(--text2)' }}>{m.label}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', color: '#00b894', fontWeight: 500 }}>{fmt(m.tulot)}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', color: '#d63031', fontWeight: 500 }}>{fmt(m.menot)}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', fontWeight: 600,
                        color: m.netto >= 0 ? '#00b894' : '#d63031' }}>{fmt(m.netto)}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', fontWeight: 600,
                        color: m.kumulatiivinen >= 0 ? '#00b894' : '#d63031' }}>{fmt(m.kumulatiivinen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

        </div>
      </div>
    </div>
  )
}
