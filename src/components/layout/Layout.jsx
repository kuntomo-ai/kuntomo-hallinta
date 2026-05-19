import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'

const PAGE_TITLES = {
  '/': 'Etusivu',
  '/calendar': 'Kalenteri',
  '/communication': 'Viestit',
  '/tasks': 'Tehtävät',
  '/timelog': 'Ajokirjaus',
  '/employees': 'Henkilöstö',
  '/surveys': 'Kyselyt',
  '/inventory': 'Inventaario',
  '/documents': 'Dokumentit',
  '/finance/myynti/terapiamyynti': 'Terapiamyynti',
  '/finance/myynti/valmennusmyynti': 'Valmennusmyynti',
  '/finance/myynti/jasenmyynti': 'Jäsenmyynti',
  '/finance/lahjakortit': 'Lahjakortit',
  '/finance/kirjanpito': 'Kirjanpito',
  '/finance/kirjanpito/tase': 'Tase',
  '/finance/kirjanpito/tulos': 'Tuloslaskelma',
  '/finance/kirjanpito/kassavirta': 'Kassavirta',
  '/finance/kirjanpito/raportit': 'Raportit',
  '/finance/raportointi': 'Raportointi',
  '/finance/raportointi/terapiamyynti': 'Terapia – Raportti',
  '/finance/raportointi/valmennusmyynti': 'Valmennus – Raportti',
  '/finance/raportointi/jasenmyynti': 'Jäsenmyynti – Raportti',
  '/finance/raportointi/lahjakortit': 'Lahjakortit – Raportti',
  '/customers/yritykset': 'Yritykset',
  '/customers/sport-hockey': 'Sport & Hockey',
}

export default function Layout({ children }) {
  const [mobOpen, setMobOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Kuntomo'

  return (
    <div className="app-layout">
      <div className={`mob-overlay${mobOpen ? ' visible' : ''}`} onClick={() => setMobOpen(false)} />
      <Sidebar mobOpen={mobOpen} onClose={() => setMobOpen(false)} />

      <div className="main-area">
        <header className="topbar">
          <button className="mob-btn" onClick={() => setMobOpen(v => !v)}>
            <Menu size={18} /> Valikko
          </button>
          <span className="topbar-title">{title}</span>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
