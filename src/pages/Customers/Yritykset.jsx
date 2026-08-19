import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, Upload, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'

const empty = { name: '', contact_person: '', email: '', phone: '', city: '', notes: '' }
const emptyVisit = { service: '', price: '', visit_date: '', employee_name: '' }

const MONTH_SHORT = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä', 'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu']
const MONTH_LONG = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu']

export default function Yritykset() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'hallitus'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)       // new company
  const [showPersonModal, setShowPersonModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(false)
  const [form, setForm] = useState(empty)
  const [editForm, setEditForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState(null)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  const [persons, setPersons] = useState([])
  const [visits, setVisits] = useState([])
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [addingPerson, setAddingPerson] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)

  const [employees, setEmployees] = useState([])
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visitForm, setVisitForm] = useState(emptyVisit)
  const [visitTarget, setVisitTarget] = useState(null)
  const [addingVisit, setAddingVisit] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    supabase.from('employees').select('first_name, last_name').eq('status', 'active').order('last_name').then(({ data }) => {
      const names = (data || []).map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim()).filter(Boolean)
      setEmployees(names)
    })
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').order('name')
    setRows(data || [])
    setLoading(false)
  }

  async function handleRowClick(row) {
    setSelected(row)
    fetchCompanyData(row.id, viewYear)
  }

  async function fetchCompanyData(company_id, year) {
    const [personsRes, visitsRes, notesRes] = await Promise.all([
      supabase.from('company_persons').select('*').eq('company_id', company_id).order('name'),
      supabase.from('company_visits').select('*').eq('company_id', company_id).gte('visit_date', `${year}-01-01`).lte('visit_date', `${year}-12-31`),
      supabase.from('company_notes').select('*').eq('company_id', company_id).eq('year', year).maybeSingle(),
    ])
    setPersons(personsRes.data || [])
    setVisits(visitsRes.data || [])
    setNotes(notesRes.data?.notes || '')
  }

  useEffect(() => {
    if (selected) fetchCompanyData(selected.id, viewYear)
  }, [viewYear])

  async function addPerson() {
    if (!newPersonName.trim() || !selected) return
    setAddingPerson(true)
    await supabase.from('company_persons').insert({ company_id: selected.id, name: newPersonName.trim() })
    setNewPersonName('')
    setAddingPerson(false)
    fetchCompanyData(selected.id, viewYear)
  }

  async function importCsv(file) {
    if (!file || !selected) return
    setCsvImporting(true)
    const text = await file.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const firstLower = lines[0]?.toLowerCase()
    const startIdx = (firstLower === 'name' || firstLower === 'nimi' || firstLower === 'henkilö') ? 1 : 0
    const names = lines.slice(startIdx).map(l => l.split(',')[0].trim()).filter(Boolean)
    if (names.length > 0) {
      await supabase.from('company_persons').insert(names.map(name => ({ company_id: selected.id, name })))
    }
    setCsvImporting(false)
    fetchCompanyData(selected.id, viewYear)
  }

  async function deletePerson(id) {
    if (!confirm('Poistetaanko henkilö?')) return
    await supabase.from('company_persons').delete().eq('id', id)
    fetchCompanyData(selected.id, viewYear)
  }

  async function saveNotes() {
    setNotesSaving(true)
    const existing = await supabase.from('company_notes').select('id').eq('company_id', selected.id).eq('year', viewYear).maybeSingle()
    if (existing.data) {
      await supabase.from('company_notes').update({ notes }).eq('id', existing.data.id)
    } else {
      await supabase.from('company_notes').insert({ company_id: selected.id, year: viewYear, notes })
    }
    setNotesSaving(false)
    setEditingNotes(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('companies').insert({
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm(empty)
    fetchData()
  }

  async function handleUpdateCompany() {
    if (!editForm.name.trim()) return
    setSaving(true)
    await supabase.from('companies').update({
      name: editForm.name.trim(),
      contact_person: editForm.contact_person.trim() || null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      city: editForm.city.trim() || null,
      notes: editForm.notes.trim() || null,
    }).eq('id', selected.id)
    setSelected(s => ({ ...s, ...editForm, name: editForm.name.trim() }))
    fetchData()
    setSaving(false)
    setEditingCompany(false)
  }

  async function toggleInvoiced(visit) {
    if (!isAdmin) return
    await supabase.from('company_visits').update({ invoiced: !visit.invoiced }).eq('id', visit.id)
    fetchCompanyData(selected.id, viewYear)
  }

  async function markAllInvoiced() {
    if (!isAdmin || !selected) return
    const openVisits = visits.filter(v => !v.invoiced)
    if (openVisits.length === 0) return
    const sum = openVisits.reduce((s, v) => s + (v.price || 0), 0)
    if (!confirm(`Merkitäänkö kaikki ${openVisits.length} avointa käyntiä (${sum.toFixed(2)} €) laskutetuksi vuodelta ${viewYear}?`)) return
    setMarkingAll(true)
    await supabase.from('company_visits').update({ invoiced: true })
      .eq('company_id', selected.id)
      .eq('invoiced', false)
      .gte('visit_date', `${viewYear}-01-01`)
      .lte('visit_date', `${viewYear}-12-31`)
    setMarkingAll(false)
    fetchCompanyData(selected.id, viewYear)
  }

  function openAddVisit(person, month) {
    const defaultDate = `${viewYear}-${String(month).padStart(2, '0')}-15`
    const defaultEmp = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
    setVisitTarget({ person, month })
    setVisitForm({ service: '', price: '', visit_date: defaultDate, employee_name: defaultEmp })
    setShowVisitModal(true)
  }

  async function saveVisit() {
    if (!visitTarget || !selected) return
    const price = parseFloat(visitForm.price)
    if (!visitForm.service.trim() || isNaN(price) || !visitForm.visit_date) return
    setAddingVisit(true)
    await supabase.from('company_visits').insert({
      company_id: selected.id,
      company_person_id: visitTarget.person.id,
      company_person_name: visitTarget.person.name,
      visit_date: visitForm.visit_date,
      service: visitForm.service.trim(),
      price,
      payment_type: 'Yrityslaskutus',
      invoiced: false,
      employee_name: visitForm.employee_name.trim() || null,
    })
    setAddingVisit(false)
    setShowVisitModal(false)
    setVisitForm(emptyVisit)
    setVisitTarget(null)
    fetchCompanyData(selected.id, viewYear)
  }

  function exportPDF() {
    if (!selected) return
    const doc = new jsPDF()
    doc.setFontSize(15)
    doc.text(`${selected.name} — käyntiraportti ${viewYear}`, 14, 16)
    doc.setFontSize(9)
    let y = 24
    if (selected.contact_person) { doc.text(`Yhteyshenkilö: ${selected.contact_person}`, 14, y); y += 5 }
    if (selected.email)          { doc.text(`Sähköposti: ${selected.email}`, 14, y); y += 5 }
    if (selected.phone)          { doc.text(`Puhelin: ${selected.phone}`, 14, y); y += 5 }
    doc.text(`Laskutettu yhteensä: ${invoicedTotal.toFixed(2)} €    Avoinna: ${openTotal.toFixed(2)} €`, 14, y + 2)

    const detailBody = [...visits]
      .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))
      .map(v => [
        new Date(v.visit_date).toLocaleDateString('fi-FI'),
        v.company_person_name || '—',
        v.service || '—',
        v.employee_name || '—',
        (v.price || 0).toFixed(2) + ' €',
        v.invoiced ? 'Laskutettu' : 'Avoinna',
      ])

    autoTable(doc, {
      startY: y + 8,
      head: [['Pvm', 'Henkilö', 'Palvelu', 'Hieroja', 'Hinta', 'Tila']],
      body: detailBody.length ? detailBody : [['—', '—', 'Ei käyntejä valittuna vuonna', '—', '—', '—']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    })

    const monthTotals = Array.from({ length: 12 }, () => ({ count: 0, total: 0, invoiced: 0, open: 0 }))
    visits.forEach(v => {
      const mi = new Date(v.visit_date).getMonth()
      monthTotals[mi].count += 1
      monthTotals[mi].total += v.price || 0
      if (v.invoiced) monthTotals[mi].invoiced += v.price || 0
      else monthTotals[mi].open += v.price || 0
    })
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Kuukausi', 'Käyntejä', 'Yhteensä', 'Laskutettu', 'Avoinna']],
      body: monthTotals.map((m, i) => [
        MONTH_LONG[i],
        m.count,
        m.total.toFixed(2) + ' €',
        m.invoiced.toFixed(2) + ' €',
        m.open.toFixed(2) + ' €',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    })

    if (notes) {
      const finalY = doc.lastAutoTable.finalY + 8
      doc.setFontSize(10); doc.text('Muistiinpanot:', 14, finalY)
      doc.setFontSize(9); doc.text(doc.splitTextToSize(notes, 180), 14, finalY + 5)
    }

    doc.save(`${selected.name.replace(/[^a-zA-Z0-9]/g, '_')}_kaynnit_${viewYear}.pdf`)
  }

  async function deleteVisit(id) {
    if (!confirm('Poistetaanko käyntikirjaus?')) return
    await supabase.from('company_visits').delete().eq('id', id)
    fetchCompanyData(selected.id, viewYear)
  }

  async function handleDeleteCompany(e, id) {
    e.stopPropagation()
    if (!confirm('Poistetaanko yritys? Tämä poistaa myös kaikki henkilöt, käynnit ja muistiinpanot.')) return
    await supabase.from('company_persons').delete().eq('company_id', id)
    await supabase.from('company_visits').delete().eq('company_id', id)
    await supabase.from('company_notes').delete().eq('company_id', id)
    await supabase.from('companies').delete().eq('id', id)
    fetchData()
  }

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }
  function handleEditChange(e) { setEditForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  const filtered = rows.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_person?.toLowerCase().includes(search.toLowerCase())
  )

  const visitGrid = {}
  persons.forEach(p => { visitGrid[p.id] = {} })
  const orphanGrid = {}
  const personIds = new Set(persons.map(p => p.id))
  visits.forEach(v => {
    const target = personIds.has(v.company_person_id) ? visitGrid[v.company_person_id] : orphanGrid
    const m = new Date(v.visit_date).getMonth() + 1
    if (!target[m]) target[m] = []
    target[m].push(v)
  })
  Object.values(visitGrid).forEach(months => {
    Object.values(months).forEach(arr => arr.sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date)))
  })
  Object.values(orphanGrid).forEach(arr => arr.sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date)))
  const hasOrphans = Object.values(orphanGrid).some(arr => arr.length > 0)

  const invoicedTotal = visits.filter(v => v.invoiced).reduce((s, v) => s + (v.price || 0), 0)
  const openTotal = visits.filter(v => !v.invoiced).reduce((s, v) => s + (v.price || 0), 0)

  return (
    <div>
      {/* ── Page header (list view) ── */}
      {!selected && (
        <>
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title">Yritykset</h1>
              <p className="page-subtitle">Yritysasiakkaat ja yhteystiedot</p>
            </div>
            <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true) }}>
              <Plus size={16} /> Uusi yritys
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <div className="search-wrap">
              <Search size={15} />
              <input className="search-input" placeholder="Hae yrityksellä, yhteyshenkilöllä..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Yritys</th>
                  <th>Lisätty</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isAdmin ? 3 : 2} className="table-empty">Ladataan...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 3 : 2} className="table-empty">Ei yrityksiä.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} onClick={() => handleRowClick(r)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    <td style={{ color: 'var(--text3)', fontSize: '.78rem', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('fi-FI')}</td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-danger btn-sm" onClick={e => handleDeleteCompany(e, r.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Company kuukausiseuranta view ── */}
      {selected && (
        <div>
          {/* Header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
              <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setSelected(null)}>
                <ChevronLeft size={15} /> Takaisin yrityksiin
              </button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.name} — kuukausiseuranta
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  setEditForm({ name: selected.name || '', contact_person: selected.contact_person || '', email: selected.email || '', phone: selected.phone || '', city: selected.city || '', notes: selected.notes || '' })
                  setEditingCompany(true)
                }}>Muokkaa yritystä</button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setShowPersonModal(true)}>
                <Plus size={14} /> Työntekijä
              </button>
              <button className="btn btn-ghost btn-sm" onClick={exportPDF} title="Lataa PDF-raportti">
                <FileText size={14} /> PDF
              </button>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewYear(y => y - 1)} style={{ borderRadius: 0, border: 'none', borderRight: '1px solid var(--border)' }}><ChevronLeft size={14} /></button>
                <span style={{ fontWeight: 700, fontSize: '.88rem', padding: '0 .6rem', minWidth: 44, textAlign: 'center' }}>{viewYear}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewYear(y => y + 1)} style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--border)' }}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '.7rem 1.1rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '.85rem', flexWrap: 'wrap' }}>
            <span>Laskutettu yhteensä: <strong>{invoicedTotal.toFixed(2)} €</strong></span>
            <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
              Avoinna: <strong style={{ color: openTotal > 0 ? 'var(--orange)' : 'inherit' }}>{openTotal.toFixed(2)} €</strong>
            </span>
            {isAdmin && openTotal > 0 && (
              <button className="btn btn-sm" onClick={markAllInvoiced} disabled={markingAll}
                style={{ background: 'var(--green)', color: 'white', fontSize: '.75rem', padding: '.35rem .7rem' }}>
                {markingAll ? 'Merkitään...' : `Merkitse kaikki laskutetuiksi (${visits.filter(v => !v.invoiced).length} kpl)`}
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--text3)' }}>
              Klikkaa tyhjää lokeroa lisätäksesi käynnin{isAdmin && ' · käyntiä klikkaamalla merkitset laskutetuksi'}
            </span>
          </div>

          {/* Notes */}
          <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.3rem' }}>
                Muistiinpanot ({viewYear})
              </div>
              {editingNotes ? (
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
                  <textarea className="input-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    style={{ flex: 1, resize: 'vertical', fontSize: '.85rem' }} autoFocus />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNotes} disabled={notesSaving}>Tallenna</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(false)}>Peruuta</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '.85rem', cursor: 'pointer', color: notes ? 'var(--text)' : 'var(--text4)', fontStyle: notes ? 'normal' : 'italic' }}
                  onClick={() => setEditingNotes(true)}>
                  {notes || 'Lisää muistiinpano...'}
                </div>
              )}
            </div>
            {!editingNotes && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(true)}>Muokkaa</button>
            )}
          </div>

          {/* Monthly grid */}
          {persons.length === 0 && !hasOrphans ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
              Ei henkilöitä. Lisää henkilöt <strong>+ Työntekijä</strong> -painikkeella.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '.6rem .75rem', background: 'var(--bg2)', fontWeight: 700, position: 'sticky', left: 0, zIndex: 2, minWidth: 150, borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                      Työntekijä
                    </th>
                    {MONTH_SHORT.map((m, i) => {
                      const isCurrentMonth = viewYear === new Date().getFullYear() && i === new Date().getMonth()
                      return (
                        <th key={i} style={{ padding: '.6rem .5rem', background: 'var(--bg2)', fontWeight: 700, textAlign: 'center', minWidth: 105, borderBottom: '2px solid var(--border)', color: isCurrentMonth ? 'var(--violet)' : 'inherit', borderLeft: '1px solid var(--border)' }}>
                          {m} {String(viewYear).slice(2)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {persons.map((p, pi) => (
                    <tr key={p.id} style={{ background: pi % 2 === 0 ? 'var(--bg)' : 'var(--bg2)' }}>
                      <td style={{ padding: '.55rem .75rem', fontWeight: 600, position: 'sticky', left: 0, background: pi % 2 === 0 ? 'var(--bg)' : 'var(--bg2)', borderRight: '1px solid var(--border)', zIndex: 1 }}>
                        {p.name}
                      </td>
                      {Array.from({ length: 12 }, (_, mi) => {
                        const m = mi + 1
                        const cellVisits = visitGrid[p.id]?.[m] || []
                        return (
                          <td key={mi} style={{ padding: '.35rem .4rem', textAlign: 'center', verticalAlign: 'top', borderLeft: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                              {cellVisits.map(visit => (
                                <div key={visit.id}
                                  onClick={() => isAdmin && toggleInvoiced(visit)}
                                  style={{ position: 'relative', background: visit.invoiced ? 'var(--green-subtle)' : 'var(--orange-subtle)', borderRadius: 4, padding: '.3rem .45rem', fontSize: '.7rem', lineHeight: 1.45, border: `1px solid ${visit.invoiced ? 'var(--green)' : 'var(--orange)'}`, opacity: visit.invoiced ? 0.8 : 1, textAlign: 'left', cursor: isAdmin ? 'pointer' : 'default' }}>
                                  {isAdmin && (
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteVisit(visit.id) }}
                                      title="Poista käynti"
                                      style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: 'var(--text4)', lineHeight: 1, borderRadius: 3, fontSize: '.65rem' }}>
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                  <div style={{ fontWeight: 700, color: visit.invoiced ? 'var(--green)' : 'var(--text)', marginBottom: 1 }}>
                                    {visit.company_person_name || visit.payment_type || '—'}
                                  </div>
                                  {visit.employee_name && <div style={{ color: 'var(--text3)', fontSize: '.65rem' }}>{visit.employee_name}</div>}
                                  <div style={{ color: 'var(--text3)' }}>{new Date(visit.visit_date).toLocaleDateString('fi-FI')}</div>
                                  <div style={{ color: 'var(--text2)' }}>{visit.service}</div>
                                  <div style={{ fontWeight: 700, color: 'var(--violet)' }}>{(visit.price || 0).toFixed(2)} €</div>
                                  {visit.invoiced && <div style={{ color: 'var(--green)', fontSize: '.62rem', fontWeight: 700, marginTop: 1 }}>✓ Laskutettu</div>}
                                </div>
                              ))}
                              <button
                                onClick={() => openAddVisit(p, m)}
                                title={cellVisits.length ? 'Lisää toinen käynti' : 'Lisää käynti'}
                                style={{ background: 'none', border: '1px dashed transparent', color: 'var(--text4)', fontSize: cellVisits.length ? '.65rem' : '.75rem', cursor: 'pointer', padding: cellVisits.length ? '.15rem .3rem' : '.35rem .5rem', borderRadius: 4, width: '100%', minHeight: cellVisits.length ? 20 : 28, transition: 'all .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--violet)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text4)' }}>
                                +{cellVisits.length ? ' lisää' : ''}
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {hasOrphans && (
                    <tr style={{ background: 'var(--bg2)', borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '.55rem .75rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--text3)', position: 'sticky', left: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', zIndex: 1 }}>
                        (Ei työntekijää)
                      </td>
                      {Array.from({ length: 12 }, (_, mi) => {
                        const m = mi + 1
                        const cellVisits = orphanGrid[m] || []
                        return (
                          <td key={mi} style={{ padding: '.35rem .4rem', textAlign: 'center', verticalAlign: 'top', borderLeft: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                              {cellVisits.map(visit => (
                                <div key={visit.id}
                                  onClick={() => isAdmin && toggleInvoiced(visit)}
                                  style={{ position: 'relative', background: visit.invoiced ? 'var(--green-subtle)' : 'var(--orange-subtle)', borderRadius: 4, padding: '.3rem .45rem', fontSize: '.7rem', lineHeight: 1.45, border: `1px solid ${visit.invoiced ? 'var(--green)' : 'var(--orange)'}`, opacity: visit.invoiced ? 0.8 : 1, textAlign: 'left', cursor: isAdmin ? 'pointer' : 'default' }}>
                                  {isAdmin && (
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteVisit(visit.id) }}
                                      title="Poista käynti"
                                      style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: 'var(--text4)', lineHeight: 1, borderRadius: 3, fontSize: '.65rem' }}>
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                  <div style={{ fontWeight: 700, color: visit.invoiced ? 'var(--green)' : 'var(--text)', marginBottom: 1 }}>
                                    {visit.company_person_name || visit.payment_type || '—'}
                                  </div>
                                  {visit.employee_name && <div style={{ color: 'var(--text3)', fontSize: '.65rem' }}>{visit.employee_name}</div>}
                                  <div style={{ color: 'var(--text3)' }}>{new Date(visit.visit_date).toLocaleDateString('fi-FI')}</div>
                                  <div style={{ color: 'var(--text2)' }}>{visit.service}</div>
                                  <div style={{ fontWeight: 700, color: 'var(--violet)' }}>{(visit.price || 0).toFixed(2)} €</div>
                                  {visit.invoiced && <div style={{ color: 'var(--green)', fontSize: '.62rem', fontWeight: 700, marginTop: 1 }}>✓ Laskutettu</div>}
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── New company modal ── */}
      {showModal && (
        <Modal title="Uusi yritys" onClose={() => setShowModal(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Yrityksen nimi</label>
              <input className="input-field" name="name" placeholder="Yritys Oy" value={form.name} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Yhteyshenkilö</label>
              <input className="input-field" name="contact_person" placeholder="Etunimi Sukunimi" value={form.contact_person} onChange={handleChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Sähköposti</label>
                <input className="input-field" name="email" type="email" value={form.email} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Puhelin</label>
                <input className="input-field" name="phone" value={form.phone} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kaupunki</label>
              <input className="input-field" name="city" value={form.city} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={3} value={form.notes} onChange={handleChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit company modal (admin) ── */}
      {editingCompany && (
        <Modal title="Muokkaa yritystä" onClose={() => setEditingCompany(false)} footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditingCompany(false)}>Peruuta</button>
            <button className="btn btn-primary" onClick={handleUpdateCompany} disabled={saving}>{saving ? 'Tallennetaan...' : 'Tallenna'}</button>
          </>
        }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Yrityksen nimi</label>
              <input className="input-field" name="name" value={editForm.name} onChange={handleEditChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Yhteyshenkilö</label>
              <input className="input-field" name="contact_person" value={editForm.contact_person} onChange={handleEditChange} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Sähköposti</label>
                <input className="input-field" name="email" type="email" value={editForm.email} onChange={handleEditChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Puhelin</label>
                <input className="input-field" name="phone" value={editForm.phone} onChange={handleEditChange} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Kaupunki</label>
              <input className="input-field" name="city" value={editForm.city} onChange={handleEditChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Muistiinpanot</label>
              <textarea className="input-field" name="notes" rows={3} value={editForm.notes} onChange={handleEditChange} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add visit modal ── */}
      {showVisitModal && visitTarget && (
        <Modal
          title={`Lisää käynti — ${visitTarget.person.name} · ${MONTH_LONG[visitTarget.month - 1]} ${viewYear}`}
          onClose={() => { setShowVisitModal(false); setVisitTarget(null) }}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setShowVisitModal(false); setVisitTarget(null) }}>Peruuta</button>
              <button className="btn btn-primary" onClick={saveVisit}
                disabled={addingVisit || !visitForm.service.trim() || !visitForm.price || !visitForm.visit_date}>
                {addingVisit ? 'Tallennetaan...' : 'Tallenna käynti'}
              </button>
            </>
          }>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Palvelu</label>
              <input className="input-field" placeholder="esim. Hieronta 45 min"
                value={visitForm.service}
                onChange={e => setVisitForm(f => ({ ...f, service: e.target.value }))} autoFocus />
            </div>
            <div className="form-grid form-grid-2">
              <div className="input-group">
                <label className="input-label">Hinta (€)</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                  value={visitForm.price}
                  onChange={e => setVisitForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Päivämäärä</label>
                <input className="input-field" type="date"
                  value={visitForm.visit_date}
                  onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Hieroja</label>
              <input className="input-field" list="employee-list" placeholder="Etunimi Sukunimi"
                value={visitForm.employee_name}
                onChange={e => setVisitForm(f => ({ ...f, employee_name: e.target.value }))} />
              <datalist id="employee-list">
                {employees.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text3)', background: 'var(--orange-subtle)', padding: '.5rem .7rem', borderRadius: 6, border: '1px solid var(--orange)' }}>
              Kirjaus tallentuu <strong>avoimena</strong> (ei laskutettu). Admin voi merkitä laskutetuksi klikkaamalla käyntiä ruudukossa.
            </div>
          </div>
        </Modal>
      )}

      {/* ── Person management modal ── */}
      {showPersonModal && (
        <Modal title={`Henkilöt — ${selected?.name}`} onClose={() => setShowPersonModal(false)} footer={
          <button className="btn btn-ghost" onClick={() => setShowPersonModal(false)}>Sulje</button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {persons.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '.85rem' }}>Ei henkilöitä vielä.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', maxHeight: 260, overflowY: 'auto' }}>
                {persons.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.4rem .5rem', borderRadius: 6, background: 'var(--bg2)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--violet-subtle)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 800, flexShrink: 0 }}>
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 600 }}>{p.name}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => deletePerson(p.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text3)', marginBottom: '.4rem' }}>Lisää henkilö</div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <input className="input-field" placeholder="Etunimi Sukunimi" style={{ flex: 1 }}
                  value={newPersonName} onChange={e => setNewPersonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPerson()} />
                <button className="btn btn-primary btn-sm" onClick={addPerson} disabled={addingPerson}><Plus size={14} /></button>
              </div>
            </div>
            <label title="Tuo henkilöt CSV-tiedostosta (yksi nimi per rivi)" style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontSize: '.78rem', color: 'var(--text3)', padding: '.4rem .6rem', border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--bg2)', width: 'fit-content' }}>
              <Upload size={13} />
              {csvImporting ? 'Tuodaan...' : 'Tuo CSV (yksi nimi per rivi)'}
              <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
                onChange={e => { importCsv(e.target.files[0]); e.target.value = '' }} />
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
