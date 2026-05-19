import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Timelog from './pages/Timelog'
import Employees from './pages/Employees'
import Surveys from './pages/Surveys'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import Communication from './pages/Communication'
import Inventory from './pages/Inventory'
import Documents from './pages/Documents'
import Lahjakortit from './pages/Finance/Lahjakortit'
import Sales from './pages/Finance/Sales'
import Kirjanpito from './pages/Finance/Kirjanpito'
import Tase from './pages/Finance/Tase'
import Tulos from './pages/Finance/Tulos'
import Kassavirta from './pages/Finance/Kassavirta'
import KirjanpitoRaportit from './pages/Finance/KirjanpitoRaportit'
import Raportointi from './pages/Reporting/Raportointi'
import RaportointiTerapia from './pages/Reporting/RaportointiTerapia'
import RaportointiValmennus from './pages/Reporting/RaportointiValmennus'
import RaportointiJasen from './pages/Reporting/RaportointiJasen'
import RaportointiLahjakortit from './pages/Reporting/RaportointiLahjakortit'
import Yritykset from './pages/Customers/Yritykset'
import SportHockey from './pages/Customers/SportHockey'
import VoiceControl from './components/VoiceControl'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text3)' }}>Ladataan...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/timelog" element={<Timelog />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/surveys" element={<Surveys />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/communication" element={<Communication />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/finance/myynti" element={<Sales />} />
              <Route path="/finance/myynti/terapiamyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/myynti/valmennusmyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/myynti/jasenmyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/lahjakortit" element={<Lahjakortit />} />
              <Route path="/finance/kirjanpito" element={<Kirjanpito />} />
              <Route path="/finance/kirjanpito/tase" element={<Tase />} />
              <Route path="/finance/kirjanpito/tulos" element={<Tulos />} />
              <Route path="/finance/kirjanpito/kassavirta" element={<Kassavirta />} />
              <Route path="/finance/kirjanpito/raportit" element={<KirjanpitoRaportit />} />
              <Route path="/finance/raportointi" element={<Raportointi />} />
              <Route path="/finance/raportointi/terapiamyynti" element={<RaportointiTerapia />} />
              <Route path="/finance/raportointi/valmennusmyynti" element={<RaportointiValmennus />} />
              <Route path="/finance/raportointi/jasenmyynti" element={<RaportointiJasen />} />
              <Route path="/finance/raportointi/lahjakortit" element={<RaportointiLahjakortit />} />
              <Route path="/customers/yritykset" element={<Yritykset />} />
              <Route path="/customers/sport-hockey" element={<SportHockey />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <VoiceControl />
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
