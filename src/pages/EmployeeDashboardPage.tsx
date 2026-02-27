import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';

interface Employee {
  id: number;
  username: string;
  uniqueCode: string;
  phone: string | null;
  role: string;
  isCheckedIn: boolean;
  checkInAt: string | null;
  lastActivity: string | null;
}

type SortKey = 'username' | 'isCheckedIn' | 'lastActivity';
type SortDir = 'asc' | 'desc';

export default function EmployeeDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkInLoading, setCheckInLoading] = useState<number | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/attendance/employees-dashboard');
      setEmployees(res.data.employees);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedEmployees = useMemo(() => {
    const sorted = [...employees];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'username') {
        cmp = a.username.localeCompare(b.username);
      } else if (sortKey === 'isCheckedIn') {
        cmp = (a.isCheckedIn === b.isCheckedIn) ? 0 : a.isCheckedIn ? -1 : 1;
      } else if (sortKey === 'lastActivity') {
        const aVal = a.lastActivity || '';
        const bVal = b.lastActivity || '';
        cmp = aVal.localeCompare(bVal);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [employees, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const formatDateTime = (dt: string | null) => {
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleString('ro-RO');
    } catch {
      return dt;
    }
  };

  const filteredForCheckIn = useMemo(() => {
    if (!searchQuery.trim()) return employees.filter(e => !e.isCheckedIn);
    const q = searchQuery.toLowerCase();
    return employees.filter(e =>
      !e.isCheckedIn && (
        e.username.toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        e.uniqueCode.toLowerCase().includes(q)
      )
    );
  }, [employees, searchQuery]);

  const handleAdminCheckIn = async (emp: Employee) => {
    if (!confirm(t('dashboard.confirmCheckIn').replace('{name}', emp.username))) return;
    setCheckInLoading(emp.id);
    setError('');
    setCheckInSuccess('');
    try {
      await api.post('/api/attendance/admin-check-in', { employee_id: emp.id });
      setCheckInSuccess(t('dashboard.checkInSuccess').replace('{name}', emp.username));
      setShowCheckInModal(false);
      setSearchQuery('');
      fetchDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('dashboard.checkInFailed'));
    } finally {
      setCheckInLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('dashboard.title')}</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button
              onClick={() => { setShowCheckInModal(true); setSearchQuery(''); setCheckInSuccess(''); }}
              style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
            >
              {t('dashboard.adminCheckIn')}
            </button>
          )}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}
          >
            {loading ? t('common.loading') : t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {checkInSuccess && (
        <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {checkInSuccess}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('username')}>
              {t('dashboard.name')}{sortIndicator('username')}
            </th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.code')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.phone')}</th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.role')}</th>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('isCheckedIn')}>
              {t('dashboard.status')}{sortIndicator('isCheckedIn')}
            </th>
            <th style={{ padding: '12px 16px' }}>{t('dashboard.checkInAt')}</th>
            <th style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('lastActivity')}>
              {t('dashboard.lastActivity')}{sortIndicator('lastActivity')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((emp) => (
            <tr
              key={emp.id}
              style={{
                borderBottom: '1px solid #f3f4f6',
                background: emp.isCheckedIn ? '#f0fdf4' : '#fef2f2',
              }}
            >
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>{emp.username}</td>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>{emp.uniqueCode}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{emp.phone || '—'}</td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                  background: emp.role === 'leader' ? '#fef3c7' : '#d1fae5',
                  color: emp.role === 'leader' ? '#92400e' : '#065f46',
                }}>{emp.role}</span>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                  background: emp.isCheckedIn ? '#dcfce7' : '#fee2e2',
                  color: emp.isCheckedIn ? '#166534' : '#991b1b',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: emp.isCheckedIn ? '#22c55e' : '#ef4444',
                  }} />
                  {emp.isCheckedIn ? t('dashboard.checkedIn') : t('dashboard.notCheckedIn')}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>
                {formatDateTime(emp.checkInAt)}
              </td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>
                {formatDateTime(emp.lastActivity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {employees.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('dashboard.noEmployees')}</p>
      )}

      {/* Admin Check-in Modal */}
      {showCheckInModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('dashboard.adminCheckInTitle')}</h2>
              <button onClick={() => setShowCheckInModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <input
              type="text"
              placeholder={t('dashboard.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredForCheckIn.length === 0 && (
                <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 16 }}>{t('dashboard.noResults')}</p>
              )}
              {filteredForCheckIn.map(emp => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{emp.username}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{emp.uniqueCode} · {emp.phone || '—'}</div>
                  </div>
                  <button
                    onClick={() => handleAdminCheckIn(emp)}
                    disabled={checkInLoading === emp.id}
                    style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
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
