import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTranslation } from './i18n';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import MapPage from './pages/MapPage';
import AttendancePage from './pages/AttendancePage';
import SessionReportPage from './pages/SessionReportPage';
import EmployeeReportPage from './pages/EmployeeReportPage';
import UserProfilePage from './pages/UserProfilePage';
import WorkHoursReportPage from './pages/WorkHoursReportPage';

function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#0f172a', color: 'white' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
      </svg>
      <span style={{ fontWeight: 600, fontSize: '1rem', marginRight: 24 }}>CONI</span>

      <Link to="/users" style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
        textDecoration: 'none', color: isActive('/users') ? 'white' : '#94a3b8',
        background: isActive('/users') ? '#1e3a5f' : 'transparent', transition: 'all 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {t('nav.users')}
      </Link>

      <Link to="/attendance" style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
        textDecoration: 'none', color: location.pathname.startsWith('/attendance') ? 'white' : '#94a3b8',
        background: location.pathname.startsWith('/attendance') ? '#1e3a5f' : 'transparent', transition: 'all 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {t('nav.attendance')}
      </Link>

      <Link to="/work-hours" style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
        textDecoration: 'none', color: isActive('/work-hours') ? 'white' : '#94a3b8',
        background: isActive('/work-hours') ? '#1e3a5f' : 'transparent', transition: 'all 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        {t('nav.workReport')}
      </Link>

      <Link to="/map" style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
        textDecoration: 'none', color: isActive('/map') ? 'white' : '#94a3b8',
        background: isActive('/map') ? '#1e3a5f' : 'transparent', transition: 'all 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {t('nav.map')}
      </Link>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          {user?.username}
        </span>
        <button onClick={logout} style={{
          background: 'transparent', border: '1px solid #475569', color: '#94a3b8',
          padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('nav.logout')}
        </button>
      </div>
    </nav>
  );
}

function ProtectedLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/users/:id" element={<UserProfilePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/attendance/session/:id" element={<SessionReportPage />} />
            <Route path="/attendance/employee/:id" element={<EmployeeReportPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/work-hours" element={<WorkHoursReportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
