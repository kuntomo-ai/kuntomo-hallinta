import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Timelog from './pages/Timelog'
import Employees from './pages/Employees'
import Kausityontekijat from './pages/Employees/Kausityontekijat'
import Surveys from './pages/Surveys'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import Communication from './pages/Communication'
import Inventory from './pages/Inventory'
import Laiteluettelo from './pages/Laiteluettelo'
import Documents from './pages/Documents'
import Lahjakortit from './pages/Finance/Lahjakortit'
import Sales from './pages/Finance/Sales'
import Kirjanpito from './pages/Finance/Kirjanpito'
import Tase from './pages/Finance/Tase'
import Tulos from './pages/Finance/Tulos'
import Kassavirta from './pages/Finance/Kassavirta'
import KirjanpitoTuonti from './pages/Finance/KirjanpitoTuonti'
import Tilinpaatos from './pages/Finance/Tilinpaatos'
import Raportointi from './pages/Reporting/Raportointi'
import RaportointiTerapia from './pages/Reporting/RaportointiTerapia'
import RaportointiValmennus from './pages/Reporting/RaportointiValmennus'
import RaportointiJasen from './pages/Reporting/RaportointiJasen'
import RaportointiLahjakortit from './pages/Reporting/RaportointiLahjakortit'
import RaportointiOma from './pages/Reporting/RaportointiOma'
import RaportointiJasenyydet from './pages/Reporting/RaportointiJasenyydet'
import Yritykset from './pages/Customers/Yritykset'
import SportHockey from './pages/Customers/SportHockey'
import UserSettings from './pages/UserSettings'
import ResetPassword from './pages/ResetPassword'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text3)' }}>Ladataan...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Redirects to / if the user's role doesn't have access to the current path.
function RoleRoute({ children }) {
  const { canAccess, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return null
  if (!canAccess(pathname)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/communication" element={<Communication />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/surveys" element={<Surveys />} />
              <Route path="/documents" element={<Documents />} />

              <Route path="/timelog" element={<RoleRoute><Timelog /></RoleRoute>} />
              <Route path="/employees" element={<RoleRoute><Employees /></RoleRoute>} />
              <Route path="/employees/kausityontekijat" element={<RoleRoute><Kausityontekijat /></RoleRoute>} />
              <Route path="/inventory" element={<RoleRoute><Inventory /></RoleRoute>} />
              <Route path="/laiteluettelo" element={<RoleRoute><Laiteluettelo /></RoleRoute>} />

              <Route path="/finance/myynti" element={<RoleRoute><Sales /></RoleRoute>} />
              <Route path="/finance/myynti/terapiamyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/myynti/valmennusmyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/myynti/jasenmyynti" element={<Navigate to="/finance/myynti" replace />} />
              <Route path="/finance/lahjakortit" element={<RoleRoute><Lahjakortit /></RoleRoute>} />

              <Route path="/finance/kirjanpito" element={<RoleRoute><Kirjanpito /></RoleRoute>} />
              <Route path="/finance/kirjanpito/tase" element={<RoleRoute><Tase /></RoleRoute>} />
              <Route path="/finance/kirjanpito/tulos" element={<RoleRoute><Tulos /></RoleRoute>} />
              <Route path="/finance/kirjanpito/kassavirta" element={<RoleRoute><Kassavirta /></RoleRoute>} />
              <Route path="/finance/kirjanpito/raportit" element={<Navigate to="/finance/kirjanpito" replace />} />
              <Route path="/finance/kirjanpito/tilinpaatos" element={<RoleRoute><Tilinpaatos /></RoleRoute>} />
              <Route path="/finance/kirjanpito/tuonti" element={<RoleRoute><KirjanpitoTuonti /></RoleRoute>} />

              <Route path="/finance/raportointi/oma" element={<RoleRoute><RaportointiOma /></RoleRoute>} />
              <Route path="/finance/raportointi" element={<RoleRoute><Raportointi /></RoleRoute>} />
              <Route path="/finance/raportointi/terapiamyynti" element={<RoleRoute><RaportointiTerapia /></RoleRoute>} />
              <Route path="/finance/raportointi/valmennusmyynti" element={<RoleRoute><RaportointiValmennus /></RoleRoute>} />
              <Route path="/finance/raportointi/jasenmyynti" element={<RoleRoute><RaportointiJasen /></RoleRoute>} />
              <Route path="/finance/raportointi/lahjakortit" element={<RoleRoute><RaportointiLahjakortit /></RoleRoute>} />
              <Route path="/finance/raportointi/jasenyydet" element={<RoleRoute><RaportointiJasenyydet /></RoleRoute>} />

              <Route path="/customers/yritykset" element={<RoleRoute><Yritykset /></RoleRoute>} />
              <Route path="/customers/sport-hockey" element={<RoleRoute><SportHockey /></RoleRoute>} />

              <Route path="/settings" element={<UserSettings />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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
