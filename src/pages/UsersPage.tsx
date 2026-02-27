import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UserFormExtended from '../components/UserFormExtended';
import { useTranslation } from '../i18n';

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
  contract_ended_at: string | null;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.users);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users');
    }
  };

  useEffect(() => { fetchUsers(); }, []);

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
              <button type="button" onClick={() => { setEditingUser(null); setNewPassword(''); }} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>{t('users.cancel')}</button>
              <button type="submit" disabled={passwordLoading}>{passwordLoading ? t('users.saving') : t('users.updatePassword')}</button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px' }}>{t('users.username')}</th>
            <th style={{ padding: '12px 16px' }}>{t('users.role')}</th>
            <th style={{ padding: '12px 16px' }}>{t('users.created')}</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('users.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} onClick={() => navigate(`/users/${u.id}`)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
              <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                {u.username}
                {u.contract_ended_at && (
                  <span style={{
                    marginLeft: 8, padding: '1px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 500,
                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
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
              <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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

      {users.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('users.noUsers')}</p>}
    </div>
  );
}
