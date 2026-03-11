import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api, { generateLateAlerts } from '../services/api';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import KpiCard from '../components/KpiCard';

interface KpiData {
  checkedInEmployees: number;
  activeContracts: number;
  leadersCheckedIn: number;
  leadersNotCheckedIn: number;
  totalHoursToday: number;
}

interface MapEmployee {
  userId: number;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface RecentAlert {
  id: number;
  type: string;
  employee_id: number;
  employee_name: string;
  details: Record<string, unknown> | null;
  created_at: string;
  seen: number;
}

interface ChartDataPoint {
  date: string;
  count: number;
}

interface ChartsData {
  alertsPerDay: ChartDataPoint[];
  checkedInPerDay: ChartDataPoint[];
}

const ROMANIA_CENTER: [number, number] = [45.9432, 24.9668];
const ROMANIA_ZOOM = 7;

function MapAutoFit({ locations }: { locations: MapEmployee[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(
      locations.map(l => [l.latitude, l.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [locations, map]);
  return null;
}

interface Employee {
  id: number;
  username: string;
  uniqueCode: string;
  phone: string | null;
  role: string;
  isCheckedIn: boolean;
  checkInAt: string | null;
  lastActivity: string | null;
  contractEndedAt: string | null;
}

type SortKey = 'username' | 'isCheckedIn' | 'lastActivity';
type SortDir = 'asc' | 'desc';

export default function EmployeeDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState('');
  const [mapEmployees, setMapEmployees] = useState<MapEmployee[]>([]);
  const [mapError, setMapError] = useState('');
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [alertsError, setAlertsError] = useState('');
  const [chartsData, setChartsData] = useState<ChartsData | null>(null);
  const [chartsError, setChartsError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [checkInLoading, setCheckInLoading] = useState<number | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState('');

  const fetchDashboard = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/attendance/employees-dashboard');
      setEmployees(res.data.employees);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load dashboard');
    } finally { setLoading(false); }
  };

  const fetchKpi = async () => {
    setKpiLoading(true); setKpiError('');
    try {
      const res = await api.get('/api/dashboard/kpi');
      setKpiData(res.data);
    } catch (err: any) {
      setKpiError(err?.response?.data?.error || t('dashboard.kpiError'));
    } finally { setKpiLoading(false); }
  };

  const fetchMapSummary = async () => {
    setMapError('');
    try { const res = await api.get('/api/dashboard/map-summary'); setMapEmployees(res.data); }
    catch (err: any) { setMapError(err?.response?.data?.error || t('dashboard.mapError')); }
  };

  const fetchRecentAlerts = async () => {
    setAlertsError('');
    try { const res = await api.get('/api/dashboard/alerts-recent'); setRecentAlerts(res.data); }
    catch (err: any) { setAlertsError(err?.response?.data?.error || t('dashboard.alertsError')); }
  };

  const fetchCharts = async () => {
    setChartsError('');
    try { const res = await api.get('/api/dashboard/charts'); setChartsData(res.data); }
    catch (err: any) { setChartsError(err?.response?.data?.error || t('dashboard.chartsError')); }
  };

  const refreshAll = async () => {
    if (isAdmin) { try { await generateLateAlerts(); } catch { /* ignore */ } }
    await Promise.all([fetchDashboard(), fetchKpi(), fetchMapSummary(), fetchRecentAlerts(), fetchCharts()]);
  };

  useEffect(() => { refreshAll(); }, []);

  const markAlertSeen = async (alertId: number) => {
    try {
      await api.patch(`/api/dashboard/alerts/${alertId}/seen`);
      setRecentAlerts(prev => prev.map(a => a.id === alertId ? { ...a, seen: 1 } : a));
    } catch { /* ignore */ }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedEmployees = useMemo(() => {
    const q = dashboardSearch.toLowerCase().trim();
    const isContractSearch = q.includes('contract') || q.includes('încheiat') || q.includes('incheiat');
    let filtered = employees.filter(e => {
      // Hide contract-ended employees unless specifically searching for them
      if (e.contractEndedAt && !isContractSearch) return false;
      if (!q) return true;
      return e.username.toLowerCase().includes(q) || (e.phone || '').toLowerCase().includes(q) || e.uniqueCode.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
    });
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'username') cmp = a.username.localeCompare(b.username);
      else if (sortKey === 'isCheckedIn') cmp = (a.isCheckedIn === b.isCheckedIn) ? 0 : a.isCheckedIn ? -1 : 1;
      else if (sortKey === 'lastActivity') cmp = (a.lastActivity || '').localeCompare(b.lastActivity || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [employees, sortKey, sortDir, dashboardSearch]);

  const sortIndicator = (key: SortKey) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  const formatDateTime = (dt: string | null) => {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleString('ro-RO'); } catch { return dt; }
  };

  const formatShortDate = (dt: string) => {
    try { return new Date(dt).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }); } catch { return dt; }
  };

  const filteredForCheckIn = useMemo(() => {
    if (!searchQuery.trim()) return employees.filter(e => !e.isCheckedIn);
    const q = searchQuery.toLowerCase();
    return employees.filter(e =>
      !e.isCheckedIn && (e.username.toLowerCase().includes(q) || (e.phone || '').toLowerCase().includes(q) || e.uniqueCode.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  const handleAdminCheckIn = async (emp: Employee) => {
    if (!confirm(t('dashboard.confirmCheckIn').replace('{name}', emp.username))) return;
    setCheckInLoading(emp.id); setError(''); setCheckInSuccess('');
    try {
      await api.post('/api/attendance/admin-check-in', { employee_id: emp.id });
      setCheckInSuccess(t('dashboard.checkInSuccess').replace('{name}', emp.username));
      setShowCheckInModal(false); setSearchQuery(''); fetchDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('dashboard.checkInFailed'));
    } finally { setCheckInLoading(null); }
  };

  // Sort alerts: unseen first, then by date desc
  const sortedAlerts = useMemo(() => {
    return [...recentAlerts].sort((a, b) => {
      if (a.seen !== b.seen) return a.seen - b.seen;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [recentAlerts]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('dashboard.title')}</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => { setShowCheckInModal(true); setSearchQuery(''); setCheckInSuccess(''); }}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              {t('dashboard.adminCheckIn')}
            </button>
          )}
          <button onClick={refreshAll} disabled={loading || kpiLoading}
            style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#111827', cursor: 'pointer' }}>
            {(loading || kpiLoading) ? t('common.loading') : t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}
      {checkInSuccess && <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{checkInSuccess}</div>}

      {/* KPI Cards */}
      {kpiError && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{kpiError}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard title={t('dashboard.kpiCheckedIn')}
          value={kpiData ? `${kpiData.checkedInEmployees}/${kpiData.activeContracts}` : '—'} color="#22c55e"
          subtitle={kpiData && kpiData.activeContracts > 0 ? `${Math.round((kpiData.checkedInEmployees / kpiData.activeContracts) * 100)}%` : undefined}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>} />
        <KpiCard title={t('dashboard.kpiLeaders')}
          value={kpiData ? `${kpiData.leadersCheckedIn}/${(kpiData.leadersCheckedIn ?? 0) + (kpiData.leadersNotCheckedIn ?? 0)}` : '—'} color="#f59e0b"
          subtitle={kpiData ? `${t('dashboard.kpiLeadersIn')}: ${kpiData.leadersCheckedIn}, ${t('dashboard.kpiLeadersOut')}: ${kpiData.leadersNotCheckedIn}` : undefined}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} />
        <KpiCard title={t('dashboard.kpiHoursToday')}
          value={kpiData?.totalHoursToday != null ? `${kpiData.totalHoursToday}h` : '—'} color="#8b5cf6"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
      </div>

      {/* Charts Section — FIRST */}
      {chartsError && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{chartsError}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1e3a5f' }}>{t('dashboard.alertsChart')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartsData?.alertsPerDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip labelFormatter={(label) => formatShortDate(label as string)} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1e3a5f' }}>{t('dashboard.checkedInChart')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartsData?.checkedInPerDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip labelFormatter={(label) => formatShortDate(label as string)} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Table — with seen/unseen, lazy scroll */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1e3a5f' }}>{t('dashboard.recentAlerts')}</h3>
        {alertsError && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{alertsError}</div>}
        {sortedAlerts.length === 0 && !alertsError ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>{t('dashboard.noAlerts')}</p>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', maxHeight: 350, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, width: '20%' }}>{t('dashboard.alertType')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, width: '20%' }}>{t('dashboard.alertEmployee')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, width: '30%' }}>{t('dashboard.alertDate')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, width: '30%' }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedAlerts.map((alert) => (
                  <tr key={alert.id} style={{ borderTop: '1px solid #f3f4f6', opacity: alert.seen ? 0.5 : 1, cursor: 'pointer' }}
                    onClick={() => alert.employee_id && navigate(`/users/${alert.employee_id}`)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <td style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500, background: '#fef3c7', color: '#92400e' }}>{alert.type}</span>
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{alert.employee_name}</td>
                    <td style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(alert.created_at)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!alert.seen && (
                        <button onClick={() => markAlertSeen(alert.id)}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                          ✓ {t('dashboard.markSeen')}
                        </button>
                      )}
                      {alert.seen === 1 && (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>✓ {t('dashboard.alertSeen')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mini-Map Section */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1e3a5f' }}>{t('dashboard.mapTitle')}</h3>
        {mapError && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{mapError}</div>}
        <div style={{ height: 350, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <MapContainer center={ROMANIA_CENTER} zoom={ROMANIA_ZOOM} style={{ height: '100%', width: '100%' }}
            zoomControl={true} dragging={true} scrollWheelZoom={true} doubleClickZoom={true} attributionControl={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapAutoFit locations={mapEmployees} />
            {mapEmployees.map((emp) => (
              <Marker key={emp.userId} position={[emp.latitude, emp.longitude]}><Popup>{emp.username}</Popup></Marker>
            ))}
          </MapContainer>
        </div>
        {mapEmployees.length === 0 && !mapError && (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 8, fontSize: '0.85rem' }}>{t('dashboard.mapNoData')}</p>
        )}
      </div>

      {/* Employee Table */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder={t('dashboard.searchPlaceholder')}
          value={dashboardSearch}
          onChange={e => setDashboardSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('username')}>{t('dashboard.name')}{sortIndicator('username')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.code')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.phone')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.role')}</th>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('isCheckedIn')}>{t('dashboard.status')}{sortIndicator('isCheckedIn')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.checkInAt')}</th>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('lastActivity')}>{t('dashboard.lastActivity')}{sortIndicator('lastActivity')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp) => (
            <tr key={emp.id} onClick={() => navigate(`/users/${emp.id}`)} style={{ borderBottom: '1px solid #f3f4f6', background: emp.contractEndedAt ? '#f9fafb' : emp.isCheckedIn ? '#f0fdf4' : '#fef2f2', opacity: emp.contractEndedAt ? 0.6 : 1, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.96)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; }}
            >
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                {emp.username}
                {emp.contractEndedAt && <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 8, fontSize: '0.7rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{t('users.contractEnded')}</span>}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{emp.uniqueCode}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{emp.phone || '—'}</td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                  background: emp.role === 'leader' ? '#fef3c7' : '#d1fae5', color: emp.role === 'leader' ? '#92400e' : '#065f46' }}>{emp.role}</span>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                  background: emp.isCheckedIn ? '#dcfce7' : '#fee2e2', color: emp.isCheckedIn ? '#166534' : '#991b1b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: emp.isCheckedIn ? '#22c55e' : '#ef4444' }} />
                  {emp.isCheckedIn ? t('dashboard.checkedIn') : t('dashboard.notCheckedIn')}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(emp.checkInAt)}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{formatDateTime(emp.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {employees.length === 0 && !loading && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('dashboard.noEmployees')}</p>}

      {/* Admin Check-in Modal */}
      {showCheckInModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('dashboard.adminCheckInTitle')}</h2>
              <button onClick={() => setShowCheckInModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <input type="text" placeholder={t('dashboard.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredForCheckIn.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 16 }}>{t('dashboard.noResults')}</p>}
              {filteredForCheckIn.map(emp => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{emp.username}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{emp.uniqueCode} · {emp.phone || '—'}</div>
                  </div>
                  <button onClick={() => handleAdminCheckIn(emp)} disabled={checkInLoading === emp.id}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                    {checkInLoading === emp.id ? t('common.loading') : t('dashboard.adminCheckIn')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
