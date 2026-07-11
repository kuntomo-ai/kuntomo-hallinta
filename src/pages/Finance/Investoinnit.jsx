import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import KirjanpitoNav from '../../components/KirjanpitoNav'
import {
  ComposedChart, BarChart, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
let _id = 100
function nid() { return ++_id }

function syncIdCounter(data) {
  data.forEach(inv => {
    if (inv.id > _id) _id = inv.id
    inv.expenses?.forEach(e    => { if (e.id  > _id) _id = e.id  })
    inv.memberships?.forEach(m => { if (m.id  > _id) _id = m.id  })
    inv.otherRevs?.forEach(r   => { if (r.id  > _id) _id = r.id  })
    inv.savings?.forEach(s     => { if (s.id  > _id) _id = s.id  })
    inv.deviceInvestments?.forEach(d => { if (d.id > _id) _id = d.id })
  })
}

function fmt(n, dec = 0) {
  const abs = Math.abs(n)
  const s = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: dec }).format(abs) + ' €'
  return n < 0 ? `−${s}` : s
}

const CLR_GREEN = 'var(--green)'
const CLR_RED   = 'var(--red)'
const CLR_BLUE  = '#6366f1'

// ── Billing type calculation ──────────────────────────────────────────────────
// type 'kk':    amount per month, grows annually
// type 'v':     amount per year, paid as lump sum in month 1 of each year, grows annually
// type 'kerta': one-time amount at startMonth (1-indexed), no growth
function itemAmount(item, monthIdx) {
  const type = item.type ?? 'kk'
  const year = Math.floor(monthIdx / 12)
  const monthInYear = monthIdx % 12
  if (type === 'kk')
    return item.amount * Math.pow(1 + (item.growthPct ?? 0) / 100, year)
  if (type === 'v')
    return monthInYear === 0
      ? item.amount * Math.pow(1 + (item.growthPct ?? 0) / 100, year)
      : 0
  if (type === 'kerta')
    return monthIdx === Math.max(1, item.startMonth ?? 1) - 1 ? item.amount : 0
  return 0
}

// Jäsenmäärä tiettynä kuukautena. Prioriteetti:
//   1. kuukausikohtainen arvo (countsByMonth[monthIdx])
//   2. vuosikohtainen arvo (countsByYear[year]) – vanha data
//   3. peruskäyttäjämäärä kasvatettuna kasvuprosentilla
function memberCount(m, monthIdx = 0) {
  const year = Math.floor(monthIdx / 12)
  const byMonth = m.countsByMonth
  if (byMonth && byMonth[monthIdx] != null && byMonth[monthIdx] !== '')
    return Number(byMonth[monthIdx])
  const byYear = m.countsByYear
  if (byYear && byYear[year] != null && byYear[year] !== '')
    return Number(byYear[year])
  return (m.count || 0) * Math.pow(1 + (m.growthPct ?? 0) / 100, year)
}

// 4-week billing → monthly: price × 13/12
function memberMonthly(m, monthIdx = 0) {
  const count = memberCount(m, monthIdx)
  if (m.periodWeeks) return count * m.price * (52 / m.periodWeeks / 12)
  return count * m.price
}

function calcMonths(expenses, memberships, otherRevs, savings, deviceInvestments, horisontti) {
  let cum = 0
  return Array.from({ length: horisontti }, (_, i) => {
    const laitteet   = deviceInvestments.reduce((s, d) => s + itemAmount(d, i), 0)
    // Laiteinvestointeja EI lasketa menoihin — ne lisätään käsin Leasingkuluina.
    const menot      = expenses.reduce((s, e) => s + itemAmount(e, i), 0)
    const jasenTulot = memberships.reduce((s, m) => s + memberMonthly(m, i), 0)
    const muutTulot  = otherRevs.reduce((s, r) => s + itemAmount(r, i), 0)
    const saastot    = savings.reduce((s, r) => s + itemAmount(r, i), 0)
    const tulot      = jasenTulot + muutTulot + saastot
    const netto      = tulot - menot
    cum += netto
    return {
      kk: i + 1,
      label: `Kk ${i + 1}`,
      tulot:          Math.round(tulot),
      menot:          Math.round(menot),
      laitteet:       Math.round(laitteet),
      netto:          Math.round(netto),
      kumulatiivinen: Math.round(cum),
      saastot:        Math.round(saastot),
    }
  })
}

// ── Default data ──────────────────────────────────────────────────────────────
const DEF_EXPENSES = [
  { label: 'Vuokra',            amount: 3000, growthPct: 2, type: 'kk',    startMonth: 1 },
  { label: 'Laina',             amount: 1500, growthPct: 0, type: 'kk',    startMonth: 1 },
  { label: 'Sähkö',             amount:  400, growthPct: 3, type: 'kk',    startMonth: 1 },
  { label: 'Leasingkulut',      amount:  500, growthPct: 0, type: 'kk',    startMonth: 1 },
  { label: 'Markkinointikulut', amount:  600, growthPct: 0, type: 'kk',    startMonth: 1 },
  { label: 'Laitehankinnat',    amount: 5000, growthPct: 0, type: 'kerta', startMonth: 1 },
]

const DEF_MEMBERSHIPS = [
  { label: 'Kuntosali',     price: 38.90, periodWeeks: 4,    count: 50, growthPct: 10 },
  { label: 'Päiväjäsenyys', price: 27.90, periodWeeks: 4,    count: 20, growthPct:  5 },
  { label: 'Kertakäynti',   price: 12.00, periodWeeks: null, count: 30, growthPct:  5 },
]

const DEF_OTHER_REVS = [
  { label: 'Hoitohuonevuokrat', amount: 1200, growthPct: 2, type: 'kk', startMonth: 1 },
  { label: 'Lisäravinnemyynti', amount:  800, growthPct: 5, type: 'kk', startMonth: 1 },
]

const DEF_SAVINGS = [
  { label: 'Energiasäästö (LED, pumput)', amount: 150, growthPct: 0, type: 'kk', startMonth: 1 },
  { label: 'Laitteiden tuottoarvo',       amount: 300, growthPct: 2, type: 'kk', startMonth: 1 },
]

const DEF_DEVICE_INVESTMENTS = [
  { label: 'Kuntosalilaitteet', amount: 40000, growthPct: 0, type: 'kerta', startMonth: 1 },
  { label: 'Huoltolaitteet',    amount:  8000, growthPct: 0, type: 'kerta', startMonth: 1 },
]

function makeInvestment(n) {
  return {
    id:          nid(),
    name:        `Toimipiste ${n}`,
    horisontti:  36,
    expenses:          DEF_EXPENSES.map(e => ({ ...e, id: nid() })),
    memberships:       DEF_MEMBERSHIPS.map(m => ({ ...m, id: nid() })),
    otherRevs:         DEF_OTHER_REVS.map(r => ({ ...r, id: nid() })),
    savings:           DEF_SAVINGS.map(s => ({ ...s, id: nid() })),
    deviceInvestments: DEF_DEVICE_INVESTMENTS.map(d => ({ ...d, id: nid() })),
  }
}

// ── Small components ──────────────────────────────────────────────────────────
function NumInput({ value, onChange, step = 1, min, max, style }) {
  return (
    <input
      className="input-field"
      type="number" step={step} value={value}
      min={min ?? undefined} max={max ?? undefined}
      onChange={e => onChange(Number(e.target.value))}
      style={{ fontSize: '.8rem', padding: '.28rem .45rem', height: 'auto', textAlign: 'right', ...style }}
    />
  )
}

function TypeSelect({ value, onChange }) {
  return (
    <select
      className="input-field"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ fontSize: '.75rem', padding: '.28rem .25rem', height: 'auto', cursor: 'pointer' }}
    >
      <option value="kk">kk</option>
      <option value="v">vuosi</option>
      <option value="kerta">kerta</option>
    </select>
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

// Type badge shown next to amount for non-monthly items in the totals row
function TypeBadge({ type }) {
  if (type === 'kk') return null
  const label = type === 'v' ? '€/v' : '€ kerta'
  return (
    <span style={{
      fontSize: '.63rem', background: type === 'v' ? 'rgba(99,102,241,.12)' : 'rgba(245,158,11,.12)',
      color: type === 'v' ? '#6366f1' : '#d97706',
      borderRadius: 4, padding: '.05rem .3rem', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
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
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
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

// ── Investment tab bar ────────────────────────────────────────────────────────
function InvestmentTabs({ investments, activeId, onSelect, onAdd, onDelete, onRename }) {
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editId && inputRef.current) inputRef.current.focus()
  }, [editId])

  function startEdit(inv, e) {
    e.stopPropagation()
    setEditId(inv.id)
    setEditName(inv.name)
  }

  function commitEdit() {
    if (editName.trim()) onRename(editId, editName.trim())
    setEditId(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditId(null)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      {investments.map(inv => {
        const isActive  = inv.id === activeId
        const isEditing = inv.id === editId
        return (
          <div key={inv.id}
            onClick={() => !isEditing && onSelect(inv.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '.3rem',
              padding: '.38rem .65rem .38rem .75rem', borderRadius: 8,
              border: isActive ? '1px solid var(--violet, #7c5cbf)' : '1px solid var(--border)',
              background: isActive ? 'var(--violet-subtle, rgba(124,92,191,.08))' : 'var(--bg2)',
              cursor: isEditing ? 'default' : 'pointer', transition: 'all .15s',
            }}
          >
            {isEditing ? (
              <>
                <input ref={inputRef} value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown} onBlur={commitEdit}
                  style={{ border: 'none', background: 'transparent', outline: 'none',
                    fontSize: '.82rem', fontWeight: 600, color: 'var(--text)',
                    width: Math.max(80, editName.length * 9) }} />
                <button onMouseDown={e => { e.preventDefault(); commitEdit() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: CLR_GREEN,
                    display: 'flex', alignItems: 'center', padding: '.1rem' }}>
                  <Check size={13} />
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '.82rem', fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--violet, #7c5cbf)' : 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {inv.name}
                </span>
                {isActive && (
                  <button onClick={e => startEdit(inv, e)} title="Nimeä uudelleen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: '.1rem' }}>
                    <Pencil size={11} />
                  </button>
                )}
                {investments.length > 1 && isActive && (
                  <button onClick={e => { e.stopPropagation(); onDelete(inv.id) }} title="Poista investointi"
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: '.1rem' }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
      <button onClick={onAdd} title="Lisää uusi investointi"
        style={{ display: 'flex', alignItems: 'center', gap: '.3rem',
          padding: '.38rem .65rem', borderRadius: 8,
          border: '1px dashed var(--border2)', background: 'none',
          cursor: 'pointer', color: 'var(--text3)', fontSize: '.82rem', transition: 'all .15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text4)'; e.currentTarget.style.color = 'var(--text2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
      >
        <Plus size={13} /> Uusi investointi
      </button>
    </div>
  )
}

// ── LineItem row (shared by Menot and Muut tulot) ─────────────────────────────
// Grid: label(1fr) | amount(68px) | type(46px) | last-col(44px) | suffix(18px) | delete(22px)
const ITEM_GRID = '1fr 68px 46px 44px 18px 22px'

function ItemRowHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: ITEM_GRID, gap: '.28rem', marginBottom: '.3rem' }}>
      <ColHeader>Nimi</ColHeader>
      <ColHeader right>Summa</ColHeader>
      <ColHeader right>Tyyppi</ColHeader>
      <ColHeader right>Kasvu/Kk</ColHeader>
      <span />
      <span />
    </div>
  )
}

function ItemRow({ item, onUpdate, onDelete, maxMonth }) {
  const type = item.type ?? 'kk'
  const isKerta = type === 'kerta'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: ITEM_GRID, gap: '.28rem', alignItems: 'center' }}>
      <input className="input-field" value={item.label}
        onChange={e => onUpdate('label', e.target.value)}
        style={{ fontSize: '.8rem', padding: '.28rem .5rem', height: 'auto' }} />
      <NumInput value={item.amount} step={isKerta ? 500 : 50} min={0}
        onChange={v => onUpdate('amount', v)} />
      <TypeSelect value={type} onChange={v => onUpdate('type', v)} />
      {isKerta ? (
        <NumInput value={Math.max(1, item.startMonth ?? 1)} step={1} min={1} max={maxMonth}
          onChange={v => onUpdate('startMonth', Math.max(1, v || 1))} />
      ) : (
        <NumInput value={item.growthPct ?? 0} step={0.5}
          onChange={v => onUpdate('growthPct', v)} />
      )}
      <span style={{ fontSize: '.65rem', color: 'var(--text3)', textAlign: 'center' }}>
        {isKerta ? 'kk#' : '%'}
      </span>
      <DeleteBtn onClick={onDelete} />
    </div>
  )
}

// ── Membership row (with expandable per-year member counts) ───────────────────
const MEMBER_GRID = '1fr 58px 52px 50px 52px'

const MONTH_ABBR = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Mar', 'Jou']

function MembershipRow({ m, horisontti, onUpdate, onUpdateMonthCount, onFillYear }) {
  const [open, setOpen] = useState(false)
  const years = Math.ceil(horisontti / 12)
  const hasMonthCounts = Array.isArray(m.countsByMonth) && m.countsByMonth.some(c => c != null && c !== '')
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: MEMBER_GRID, gap: '.3rem', alignItems: 'center' }}>
        <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }} title="Näytä jäsenmäärä kuukausittain">
          <div style={{ fontSize: '.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '.28rem' }}>
            <span style={{ fontSize: '.58rem', color: hasMonthCounts ? 'var(--violet, #7c5cbf)' : 'var(--text3)' }}>
              {open ? '▾' : '▸'}
            </span>
            {m.label}
          </div>
          <div style={{ fontSize: '.65rem', color: 'var(--text3)', paddingLeft: '.86rem' }}>
            {m.periodWeeks ? `/${m.periodWeeks} vko` : '/käynti'}
            {hasMonthCounts && <span style={{ color: 'var(--violet, #7c5cbf)', marginLeft: '.3rem' }}>· kk-määrät</span>}
          </div>
        </div>
        <NumInput value={m.price} step={0.10} min={0} onChange={v => onUpdate('price', v)} />
        <NumInput value={m.count} step={1}    min={0} onChange={v => onUpdate('count', v)} />
        <NumInput value={m.growthPct} step={1}       onChange={v => onUpdate('growthPct', v)} />
        <span style={{ fontSize: '.8rem', fontWeight: 600, textAlign: 'right' }}>
          {fmt(memberMonthly(m))}
        </span>
      </div>

      {open && (
        <div style={{ margin: '.5rem 0 .3rem', padding: '.55rem .6rem', background: 'var(--bg2)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
            <span style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text2)' }}>Jäsenmäärä / kuukausi</span>
            <span style={{ fontSize: '.62rem', color: 'var(--text3)' }}>tyhjä = auto (kasvu%)</span>
          </div>
          {Array.from({ length: years }, (_, y) => {
            const startM = y * 12
            const endM   = Math.min((y + 1) * 12, horisontti)
            const autoY  = Math.round((m.count || 0) * Math.pow(1 + (m.growthPct ?? 0) / 100, y))
            return (
              <div key={y} style={{ marginBottom: '.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.25rem' }}>
                  <span style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--text3)' }}>Vuosi {y + 1}</span>
                  <button
                    onClick={() => onFillYear(y, autoY)}
                    title={`Täytä vuoden ${y + 1} kaikki kuukaudet arvolla ${autoY}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--violet, #7c5cbf)',
                      fontSize: '.6rem', padding: 0 }}>
                    täytä {autoY} →
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.3rem' }}>
                  {Array.from({ length: endM - startM }, (_, k) => {
                    const monthIdx = startM + k
                    const val = m.countsByMonth?.[monthIdx]
                    return (
                      <div key={monthIdx}>
                        <div style={{ fontSize: '.57rem', color: 'var(--text3)', textAlign: 'center', marginBottom: '.1rem' }}>
                          {MONTH_ABBR[monthIdx % 12]} {monthIdx + 1}
                        </div>
                        <input
                          className="input-field" type="number" min={0}
                          value={val ?? ''} placeholder={String(autoY)}
                          onChange={e => onUpdateMonthCount(monthIdx, e.target.value)}
                          style={{ fontSize: '.74rem', padding: '.22rem .2rem', height: 'auto', textAlign: 'center', width: '100%' }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Investoinnit() {
  const [investments, setInvestments] = useState(() => [makeInvestment(1)])
  const [activeId,    setActiveId]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saveStatus,  setSaveStatus]  = useState(null) // null | 'saving' | 'saved' | 'error'

  const currentId = activeId ?? investments[0]?.id
  const inv       = investments.find(i => i.id === currentId) ?? investments[0]

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    supabaseAdmin
      .from('investoinnit_data')
      .select('data')
      .eq('id', 'default')
      .single()
      .then(({ data: row }) => {
        if (row?.data?.length) {
          syncIdCounter(row.data)
          setInvestments(row.data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── Investment management ────────────────────────────────────────────────
  function addInvestment() {
    const next = makeInvestment(investments.length + 1)
    setInvestments(p => [...p, next])
    setActiveId(next.id)
  }
  function deleteInvestment(id) {
    setInvestments(p => {
      const remaining = p.filter(i => i.id !== id)
      if (currentId === id) setActiveId(remaining[0]?.id ?? null)
      return remaining
    })
  }
  function renameInvestment(id, name) {
    setInvestments(p => p.map(i => i.id === id ? { ...i, name } : i))
  }

  async function handleSave() {
    setSaveStatus('saving')
    const { error } = await supabaseAdmin
      .from('investoinnit_data')
      .upsert({ id: 'default', data: investments, updated_at: new Date().toISOString() })
    setSaveStatus(error ? 'error' : 'saved')
    setTimeout(() => setSaveStatus(null), 2200)
  }

  function patch(changes) {
    setInvestments(p => p.map(i => i.id === currentId ? { ...i, ...changes } : i))
  }

  // ── Row handlers ─────────────────────────────────────────────────────────
  const updateExpense = (id, field, val) =>
    patch({ expenses: inv.expenses.map(e => e.id === id ? { ...e, [field]: val } : e) })
  const addExpense = () =>
    patch({ expenses: [...inv.expenses, { id: nid(), label: 'Uusi kulu', amount: 0, growthPct: 0, type: 'kk', startMonth: 1 }] })
  const removeExpense = id =>
    patch({ expenses: inv.expenses.filter(e => e.id !== id) })

  const updateMembership = (id, field, val) =>
    patch({ memberships: inv.memberships.map(m => m.id === id ? { ...m, [field]: val } : m) })
  const updateMemberMonthCount = (id, monthIdx, val) =>
    patch({ memberships: inv.memberships.map(m => {
      if (m.id !== id) return m
      const arr = Array.isArray(m.countsByMonth) ? [...m.countsByMonth] : []
      arr[monthIdx] = (val === '' || val == null) ? null : Number(val)
      return { ...m, countsByMonth: arr }
    }) })
  // Täytä yhden vuoden kaikki kuukaudet samalla jäsenmäärällä
  const fillMemberYear = (id, year, value) =>
    patch({ memberships: inv.memberships.map(m => {
      if (m.id !== id) return m
      const arr = Array.isArray(m.countsByMonth) ? [...m.countsByMonth] : []
      for (let k = year * 12; k < Math.min((year + 1) * 12, inv.horisontti); k++) arr[k] = value
      return { ...m, countsByMonth: arr }
    }) })

  const updateOtherRev = (id, field, val) =>
    patch({ otherRevs: inv.otherRevs.map(r => r.id === id ? { ...r, [field]: val } : r) })
  const addOtherRev = () =>
    patch({ otherRevs: [...inv.otherRevs, { id: nid(), label: 'Uusi tulo', amount: 0, growthPct: 0, type: 'kk', startMonth: 1 }] })
  const removeOtherRev = id =>
    patch({ otherRevs: inv.otherRevs.filter(r => r.id !== id) })

  const savings = inv.savings ?? []
  const updateSaving = (id, field, val) =>
    patch({ savings: savings.map(s => s.id === id ? { ...s, [field]: val } : s) })
  const addSaving = () =>
    patch({ savings: [...savings, { id: nid(), label: 'Uusi säästö / tuotto', amount: 0, growthPct: 0, type: 'kk', startMonth: 1 }] })
  const removeSaving = id =>
    patch({ savings: savings.filter(s => s.id !== id) })

  const deviceInvestments = inv.deviceInvestments ?? []
  const updateDevice = (id, field, val) =>
    patch({ deviceInvestments: deviceInvestments.map(d => d.id === id ? { ...d, [field]: val } : d) })
  const addDevice = () =>
    patch({ deviceInvestments: [...deviceInvestments, { id: nid(), label: 'Uusi laiteinvestointi', amount: 0, growthPct: 0, type: 'kerta', startMonth: 1 }] })
  const removeDevice = id =>
    patch({ deviceInvestments: deviceInvestments.filter(d => d.id !== id) })

  // ── Projections ──────────────────────────────────────────────────────────
  const months = useMemo(
    () => calcMonths(inv.expenses, inv.memberships, inv.otherRevs, inv.savings ?? [], inv.deviceInvestments ?? [], inv.horisontti),
    [inv],
  )

  const yearSummaries = useMemo(() => (
    Array.from({ length: Math.ceil(inv.horisontti / 12) }, (_, y) => {
      const slice = months.slice(y * 12, (y + 1) * 12)
      return {
        year:  y + 1,
        label: `Vuosi ${y + 1}`,
        Tulot: slice.reduce((s, m) => s + m.tulot, 0),
        Menot: slice.reduce((s, m) => s + m.menot, 0),
        Netto: slice.reduce((s, m) => s + m.netto, 0),
      }
    })
  ), [months, inv.horisontti])

  const breakEvenMonth    = useMemo(() => { const i = months.findIndex(m => m.netto >= 0);          return i === -1 ? null : i + 1 }, [months])
  const cumBreakEvenMonth = useMemo(() => { const i = months.findIndex(m => m.kumulatiivinen >= 0); return i === -1 ? null : i + 1 }, [months])

  const chartData = inv.horisontti > 24
    ? months.map((m, i) => ({ ...m, label: i % 3 === 2 ? `Kk ${m.kk}` : '' }))
    : months

  // Month-1 totals from actual calculation (correct for all types)
  const m1 = months[0] ?? { tulot: 0, menot: 0, netto: 0 }
  // Left-panel subtotals for month 1 (for RowTotal displays)
  const expenseM1   = inv.expenses.reduce((s, e) => s + itemAmount(e, 0), 0)
  const memberM1    = inv.memberships.reduce((s, m) => s + memberMonthly(m), 0)
  const otherRevM1  = inv.otherRevs.reduce((s, r) => s + itemAmount(r, 0), 0)
  const savingM1    = savings.reduce((s, r) => s + itemAmount(r, 0), 0)
  // Laiteinvestointien kokonaissumma koko horisontin ajalta (vain viitteeksi)
  const deviceTotal = months.reduce((s, m) => s + m.laitteet, 0)

  if (loading) return (
    <div>
      <KirjanpitoNav />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
        Ladataan…
      </div>
    </div>
  )

  return (
    <div className="page-wrapper">
      <KirjanpitoNav />

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Investointilaskuri</h1>
          <p className="page-subtitle">Uusien toimipisteiden tuotto- ja kuluprojektio</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '.3rem' }}>
            {[12, 24, 36].map(h => (
              <button key={h}
                className={`sub-tab${inv.horisontti === h ? ' active' : ''}`}
                style={{ fontSize: '.8rem', padding: '.35rem .7rem' }}
                onClick={() => patch({ horisontti: h })}>
                {h} kk
              </button>
            ))}
          </div>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            style={{
              background: saveStatus === 'saved' ? '#00b894' : saveStatus === 'error' ? '#d63031' : 'var(--violet, #7c5cbf)',
              color: '#fff', border: 'none', transition: 'background .3s',
              minWidth: 100, opacity: saveStatus === 'saving' ? .7 : 1,
            }}
          >
            {saveStatus === 'saving' ? 'Tallennetaan…' : saveStatus === 'saved' ? 'Tallennettu ✓' : saveStatus === 'error' ? 'Virhe!' : 'Tallenna'}
          </button>
        </div>
      </div>

      {/* Investment tabs */}
      <InvestmentTabs
        investments={investments} activeId={currentId}
        onSelect={setActiveId} onAdd={addInvestment}
        onDelete={deleteInvestment} onRename={renameInvestment}
      />

      {/* KPI cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', marginBottom: '1.25rem' }}>
        {yearSummaries.map(y => (
          <div className="stat-card" key={y.year}>
            <div className="stat-label">Vuosi {y.year} netto</div>
            <div className="stat-value" style={{ color: y.Netto >= 0 ? CLR_GREEN : CLR_RED }}>{fmt(y.Netto)}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>Tulot {fmt(y.Tulot)} · Menot {fmt(y.Menot)}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-label">Kk 1 netto</div>
          <div className="stat-value" style={{ color: m1.netto >= 0 ? CLR_GREEN : CLR_RED }}>{fmt(m1.netto)}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>Tulot {fmt(m1.tulot)} · Menot {fmt(m1.menot)}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Menot */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Menot</SectionLabel>
            <ItemRowHeader />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {inv.expenses.map(e => (
                <ItemRow key={e.id} item={e} maxMonth={inv.horisontti}
                  onUpdate={(f, v) => updateExpense(e.id, f, v)}
                  onDelete={() => removeExpense(e.id)} />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addExpense}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem' }}>
              <Plus size={13} /> Lisää kulu
            </button>
            {/* Legend */}
            <div style={{ marginTop: '.65rem', paddingTop: '.55rem', borderTop: '1px solid var(--border)',
              display: 'flex', gap: '.5rem', fontSize: '.68rem', color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span><b>kk</b> = joka kuukausi</span>
              <span><b>vuosi</b> = kerran vuodessa</span>
              <span><b>kerta</b> = kertaluonteinen, Kk# = milloin</span>
            </div>
            <RowTotal label="Menot kk 1 yhteensä" value={fmt(expenseM1)} />
          </div>

          {/* Jäsenyysmyynti */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Jäsenyysmyynti</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: MEMBER_GRID, gap: '.3rem', marginBottom: '.3rem' }}>
              <ColHeader>Tuote</ColHeader>
              <ColHeader right>Hinta €</ColHeader>
              <ColHeader right>Asiak.</ColHeader>
              <ColHeader right>Kasvu/v%</ColHeader>
              <ColHeader right>€/kk</ColHeader>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
              {inv.memberships.map(m => (
                <MembershipRow key={m.id} m={m} horisontti={inv.horisontti}
                  onUpdate={(f, v) => updateMembership(m.id, f, v)}
                  onUpdateMonthCount={(mi, v) => updateMemberMonthCount(m.id, mi, v)}
                  onFillYear={(y, v) => fillMemberYear(m.id, y, v)} />
              ))}
            </div>
            <div style={{ marginTop: '.6rem', fontSize: '.66rem', color: 'var(--text3)', lineHeight: 1.4 }}>
              Avaa tuote (▸) syöttääksesi jäsenmäärän erikseen jokaiselle kuukaudelle. Tyhjä kenttä käyttää automaattista kasvua. "Täytä" asettaa koko vuoden kerralla.
            </div>
            <RowTotal label="Yhteensä kk 1" value={fmt(memberM1)} />
          </div>

          {/* Muut tulot */}
          <div className="card" style={{ padding: '1rem' }}>
            <SectionLabel>Muut tulot</SectionLabel>
            <ItemRowHeader />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {inv.otherRevs.map(r => (
                <ItemRow key={r.id} item={r} maxMonth={inv.horisontti}
                  onUpdate={(f, v) => updateOtherRev(r.id, f, v)}
                  onDelete={() => removeOtherRev(r.id)} />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addOtherRev}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem' }}>
              <Plus size={13} /> Lisää tulo
            </button>
            <RowTotal label="Muut tulot kk 1 yhteensä" value={fmt(otherRevM1)} />
          </div>

          {/* Säästö / tuotto */}
          <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #00b894' }}>
            <SectionLabel>Säästö / tuotto</SectionLabel>
            <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.65rem', lineHeight: 1.45 }}>
              Kirjaa investoinnin tuomat säästöt tai lisätuotot — esim. energiasäästöt, laitteiden tuotto tai kulujen pieneneminen. Nämä lasketaan mukaan tuloihin.
            </div>
            <ItemRowHeader />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {savings.map(s => (
                <ItemRow key={s.id} item={s} maxMonth={inv.horisontti}
                  onUpdate={(f, v) => updateSaving(s.id, f, v)}
                  onDelete={() => removeSaving(s.id)} />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addSaving}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem', color: '#00b894', borderColor: '#00b89440' }}>
              <Plus size={13} /> Lisää säästö / tuotto
            </button>
            <RowTotal label="Säästöt / tuotot kk 1 yhteensä" value={fmt(savingM1)} />
          </div>

          {/* Laiteinvestoinnit */}
          <div className="card" style={{ padding: '1rem', borderLeft: '3px solid #d63031' }}>
            <SectionLabel>Laiteinvestoinnit</SectionLabel>
            <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: '.65rem', lineHeight: 1.45 }}>
              Kirjaa laitehankinnat rivikohtaisesti nähdäksesi kokonaissumman. <b>Ei lasketa mukaan menoihin</b> — lisää haluamasi summa itse Menot-osioon Leasingkuluina.
            </div>
            <ItemRowHeader />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {deviceInvestments.map(d => (
                <ItemRow key={d.id} item={d} maxMonth={inv.horisontti}
                  onUpdate={(f, v) => updateDevice(d.id, f, v)}
                  onDelete={() => removeDevice(d.id)} />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addDevice}
              style={{ marginTop: '.6rem', width: '100%', justifyContent: 'center', gap: '.3rem', color: '#d63031', borderColor: '#d6303140' }}>
              <Plus size={13} /> Lisää laiteinvestointi
            </button>
            <RowTotal label="Laiteinvestoinnit yhteensä" value={fmt(deviceTotal)} />
          </div>

        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          <ChartCard title="Tulot vs. Menot — kuukausittain">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={38} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '.75rem' }} />
                <Area type="monotone" dataKey="tulot" name="Tulot" fill="#00b89422" stroke="#00b894" strokeWidth={2} />
                <Area type="monotone" dataKey="menot" name="Menot" fill="#d6303122" stroke="#d63031" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

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

          <ChartCard title="Kuukausianalyysi">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Kk', 'Tulot', 'josta säästöt', 'Menot', 'Netto', 'Kumulatiivinen'].map(h => (
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
                      borderBottom: m.kk % 12 === 0 ? '2px solid var(--border)' : '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg2)',
                    }}>
                      <td style={{ padding: '.32rem .6rem', color: 'var(--text2)' }}>{m.label}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', color: '#00b894', fontWeight: 500 }}>{fmt(m.tulot)}</td>
                      <td style={{ padding: '.32rem .6rem', textAlign: 'right', color: '#00b894', fontWeight: 400, opacity: .7, fontSize: '.72rem' }}>
                        {m.saastot > 0 ? fmt(m.saastot) : '—'}
                      </td>
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
