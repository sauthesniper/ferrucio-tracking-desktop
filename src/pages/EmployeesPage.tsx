import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api, { fetchLeaves } from '../services/api';
import UserFormExtended from '../components/UserFormExtended';
import { useTranslation } from '../i18n';
import {
  filterAndSortEmployees,
  type Employee,
  type SortColumn,
  type SortDirection,
  type RoleFilter,
  type StatusFilter,
} from '../utils/employeeFilters';

type User = Employee;

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // QR modal state
  const [qrUser, setQrUser] = useState<User | null>(null);
  const [qrError, setQrError] = useState('');

  // Search, sort, filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('username');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [leaveEmployeeIds, setLeaveEmployeeIds] = useState<Set<number>>(new Set());
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string | null>(null);
  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);

  const LEAVE_TYPES = ['CO', 'CM', 'CFP', 'CS', 'CC', 'CI'] as const;

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.users);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users');
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Fetch all leaves to determine who's on leave today
  useEffect(() => {
    const loadLeaves = async () => {
      try {
        const res = await api.get('/api/leaves');
        const today = new Date().toISOString().split('T')[0];
        const leaves = res.data.leaves || [];
        const ids = new Set<number>();
        for (const lv of leaves) {
          if (lv.startDate <= today && lv.endDate >= today) {
            if (!leaveTypeFilter || lv.type === leaveTypeFilter) {
              ids.add(lv.employeeId);
            }
          }
        }
        setLeaveEmployeeIds(ids);
      } catch { /* ignore */ }
    };
    loadLeaves();
  }, [leaveTypeFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('users.confirmDelete'))) return;
    setError(''); setSuccess('');
    try {
      await api.delete(`/api/users/${id}`);
      setSuccess(t('users.deleted'));
      await fetchUsers();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete user');
    }
  };

  const handlePasswordUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setPasswordLoading(true); setError('');
    try {
      await api.patch(`/api/users/${editingUser.id}/password`, { password: newPassword });
      setSuccess(`Password updated for "${editingUser.username}"`);
      setEditingUser(null); setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update password');
    } finally { setPasswordLoading(false); }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleRoleFilter = (role: RoleFilter) => {
    setRoleFilter(prev => prev === role ? null : role);
  };

  const toggleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  const sortArrow = (column: SortColumn) => {
    if (sortColumn !== column) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // Filtered and sorted users (logic extracted to utils/employeeFilters.ts)
  const filteredUsers = useMemo(() => {
    return filterAndSortEmployees(
      users,
      { searchQuery, roleFilter, statusFilter, leaveEmployeeIds },
      { sortColumn, sortDirection },
    );
  }, [users, searchQuery, roleFilter, statusFilter, sortColumn, sortDirection, leaveEmployeeIds]);

  const handleGenerateQR = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (!user.login_code) {
      setQrError('Utilizatorul nu are cod de logare');
      setQrUser(null);
      return;
    }
    setQrError('');
    setQrUser(user);
  };

  const chipStyle = (active: boolean, color: string, bg: string, border: string) => ({
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: '0.85rem',
    fontWeight: 500 as const,
    cursor: 'pointer',
    border: `1px solid ${active ? color : border}`,
    background: active ? bg : '#fff',
    color: active ? color : '#6b7280',
    transition: 'all 0.15s',
  });

  const thStyle = (column: SortColumn) => ({
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    background: sortColumn === column ? '#f0f9ff' : undefined,
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('users.title')}</h1>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{success}</div>}

      <UserFormExtended onSuccess={fetchUsers} />

      {/* Search input - prominent, above table */}
      <div style={{ marginBottom: 16, marginTop: 24 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('employees.searchPlaceholder')}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '1rem',
            borderRadius: 10,
            border: '2px solid #e5e7eb',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {/* Role filters */}
        <button onClick={() => toggleRoleFilter('admin')} style={chipStyle(roleFilter === 'admin', '#1e40af', '#dbeafe', '#d1d5db')}>
          Admin
        </button>
        <button onClick={() => toggleRoleFilter('leader')} style={chipStyle(roleFilter === 'leader', '#92400e', '#fef3c7', '#d1d5db')}>
          {t('form.leader')}
        </button>
        <button onClick={() => toggleRoleFilter('employee')} style={chipStyle(roleFilter === 'employee', '#065f46', '#d1fae5', '#d1d5db')}>
          {t('form.employee')}
        </button>

        <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />

        {/* Status filters */}
        <button onClick={() => toggleStatusFilter('checked_in')} style={chipStyle(statusFilter === 'checked_in', '#16a34a', '#f0fdf4', '#d1d5db')}>
          {t('employees.checkedIn')}
        </button>
        <button onClick={() => toggleStatusFilter('not_checked_in')} style={chipStyle(statusFilter === 'not_checked_in', '#dc2626', '#fef2f2', '#d1d5db')}>
          {t('employees.notCheckedIn')}
        </button>
        <button onClick={() => toggleStatusFilter('contract_ended')} style={chipStyle(statusFilter === 'contract_ended', '#6b7280', '#f3f4f6', '#d1d5db')}>
          {t('users.contractEnded')}
        </button>

        <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />

        {/* Leave filter with dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            onClick={() => { toggleStatusFilter('on_leave'); setLeaveTypeFilter(null); }}
            style={chipStyle(statusFilter === 'on_leave', '#7c3aed', '#f5f3ff', '#d1d5db')}
          >
            {t('employees.onLeave')}{leaveTypeFilter ? ` (${leaveTypeFilter})` : ''}
          </button>
          {statusFilter === 'on_leave' && (
            <button
              onClick={() => setShowLeaveDropdown(!showLeaveDropdown)}
              style={{
                padding: '6px 8px', borderRadius: '0 20px 20px 0', marginLeft: -8,
                fontSize: '0.75rem', cursor: 'pointer',
                border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed',
              }}
            >
              ▾
            </button>
          )}
          {showLeaveDropdown && statusFilter === 'on_leave' && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 10, minWidth: 180, overflow: 'hidden',
            }}>
              <button onClick={() => { setLeaveTypeFilter(null); setShowLeaveDropdown(false); }}
                style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: !leaveTypeFilter ? '#f5f3ff' : '#fff', color: '#111', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}>
                {t('employees.onLeave')} (toate)
              </button>
              {LEAVE_TYPES.map(lt => (
                <button key={lt} onClick={() => { setLeaveTypeFilter(lt); setShowLeaveDropdown(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: leaveTypeFilter === lt ? '#f5f3ff' : '#fff', color: '#111', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}>
                  {t(`leave.${lt}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password edit modal */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handlePasswordUpdate} style={{ width: 380, padding: 28, background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{t('users.changePassword')}</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 20 }}>{t('users.setNewPasswordFor')} <strong>{editingUser.username}</strong></p>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="edit-password" style={{ display: 'block', marginBottom: 6 }}>{t('users.newPassword')}</label>
              <input id="edit-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder={t('users.newPasswordPlaceholder')} style={{ width: '100%', padding: '8px 12px' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setEditingUser(null); setNewPassword(''); }} style={{ background: '#fff', color: '#111827', border: '1px solid #d1d5db' }}>{t('users.cancel')}</button>
              <button type="submit" disabled={passwordLoading}>{passwordLoading ? t('users.saving') : t('users.updatePassword')}</button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code modal */}
      {qrUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setQrUser(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 380, padding: 28, background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>QR Login</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 20 }}>{qrUser.username}</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <QRCodeSVG value={qrUser.login_code!} size={200} />
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: 16 }}>Cod: {qrUser.login_code}</p>
            <button type="button" onClick={() => setQrUser(null)} style={{ background: '#fff', color: '#111827', border: '1px solid #d1d5db', padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}>Închide</button>
          </div>
        </div>
      )}

      {/* QR error toast */}
      {qrError && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: '0.9rem', zIndex: 1001, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {qrError}
          <button onClick={() => setQrError('')} style={{ marginLeft: 12, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={thStyle('username')} onClick={() => handleSort('username')}>
              {t('users.username')}{sortArrow('username')}
            </th>
            <th style={thStyle('role')} onClick={() => handleSort('role')}>
              {t('users.role')}{sortArrow('role')}
            </th>
            <th style={thStyle('phone')} onClick={() => handleSort('phone')}>
              {t('employees.phone')}{sortArrow('phone')}
            </th>
            <th style={thStyle('unique_code')} onClick={() => handleSort('unique_code')}>
              {t('employees.uniqueCode')}{sortArrow('unique_code')}
            </th>
            <th style={thStyle('createdAt')} onClick={() => handleSort('createdAt')}>
              {t('users.created')}{sortArrow('createdAt')}
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('users.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((u) => (
            <tr
              key={u.id}
              onClick={() => navigate(`/users/${u.id}`)}
              style={{
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                background: u.contract_ended_at ? '#f9fafb' : u.is_checked_in ? '#f0fdf4' : '#fef2f2',
              }}
            >
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                {u.username}
                {u.contract_ended_at && (
                  <span style={{
                    marginLeft: 8, padding: '1px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 500,
                    background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db',
                  }}>{t('users.contractEnded')}</span>
                )}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                  background: u.role === 'admin' ? '#dbeafe' : u.role === 'leader' ? '#fef3c7' : '#d1fae5',
                  color: u.role === 'admin' ? '#1e40af' : u.role === 'leader' ? '#92400e' : '#065f46',
                }}>{u.role}</span>
              </td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{u.phone || '—'}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{u.unique_code || '—'}</td>
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={(e) => handleGenerateQR(e, u)} title="Generează QR" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '4px 8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingUser(u); setNewPassword(''); }} title="Change password" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} title="Delete user" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredUsers.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('users.noUsers')}</p>}
    </div>
  );
}
