import { useState } from 'react';
import { createUser } from '../services/api';
import { useTranslation } from '../i18n';

interface UserFormExtendedProps {
  onSuccess: () => void;
}

export default function UserFormExtended({ onSuccess }: UserFormExtendedProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    username: '', phone: '', unique_code: '', id_number: '', email: '',
    role: 'employee', alert_exit_zone: false, alert_checkout: false,
    work_hours_limit: '', screen_time_limit: '', stationary_limit: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoginCode('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username, phone: form.phone, unique_code: form.unique_code,
        role: form.role, alert_exit_zone: form.alert_exit_zone, alert_checkout: form.alert_checkout,
      };
      if (form.id_number) payload.id_number = form.id_number;
      if (form.email) payload.email = form.email;
      if (form.work_hours_limit) payload.work_hours_limit = parseFloat(form.work_hours_limit);
      if (form.screen_time_limit) payload.screen_time_limit = parseInt(form.screen_time_limit, 10);
      if (form.stationary_limit) payload.stationary_limit = parseInt(form.stationary_limit, 10);
      const res = await createUser(payload);
      setLoginCode(res.data.login_code || res.data.loginCode || '');
      setSuccess(t('form.userCreated').replace('{name}', form.username));
      setForm({ username: '', phone: '', unique_code: '', id_number: '', email: '', role: 'employee', alert_exit_zone: false, alert_checkout: false, work_hours_limit: '', screen_time_limit: '', stationary_limit: '' });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('form.createFailed'));
    } finally { setLoading(false); }
  };

  const inputStyle = { width: '100%', padding: '8px 12px', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' };

  return (
    <div style={{ marginBottom: 24 }}>
      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{success}</div>}

      {loginCode && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 14, borderRadius: 8, marginBottom: 12 }}>
          <strong style={{ color: '#1e40af' }}>{t('form.loginCodeLabel')}</strong>{' '}
          <code style={{ background: '#dbeafe', color: '#1e3a8a', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{loginCode}</code>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{t('form.loginCodeHint')}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>{t('form.username')}</label>
            <input type="text" value={form.username} onChange={(e) => handleChange('username', e.target.value)} required placeholder={t('form.username').replace(' *', '')} style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={labelStyle}>{t('form.phone')}</label>
            <input type="text" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required placeholder="+40712345678" style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>{t('form.uniqueCode')}</label>
            <input type="text" value={form.unique_code} onChange={(e) => handleChange('unique_code', e.target.value)} required placeholder="EMP001" style={inputStyle} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={labelStyle}>{t('form.role')}</label>
            <select value={form.role} onChange={(e) => handleChange('role', e.target.value)} style={inputStyle}>
              <option value="leader">{t('form.leader')}</option>
              <option value="employee">{t('form.employee')}</option>
            </select>
          </div>
        </div>

        <button type="button" onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: 12 }}>
          {expanded ? t('form.hideOptional') : t('form.showOptional')}
        </button>

        {expanded && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>{t('form.idNumber')}</label>
                <input type="text" value={form.id_number} onChange={(e) => handleChange('id_number', e.target.value)} placeholder={t('form.idNumberPlaceholder')} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>{t('form.email')}</label>
                <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="user@example.com" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>{t('form.workHoursLimit')}</label>
                <input type="number" step="0.5" value={form.work_hours_limit} onChange={(e) => handleChange('work_hours_limit', e.target.value)} placeholder="ex. 8" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>{t('form.screenTimeLimit')}</label>
                <input type="number" value={form.screen_time_limit} onChange={(e) => handleChange('screen_time_limit', e.target.value)} placeholder="ex. 60" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>{t('form.stationaryLimit')}</label>
                <input type="number" value={form.stationary_limit} onChange={(e) => handleChange('stationary_limit', e.target.value)} placeholder="ex. 30" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.alert_exit_zone} onChange={(e) => handleChange('alert_exit_zone', e.target.checked)} />
                {t('form.alertExitZone')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.alert_checkout} onChange={(e) => handleChange('alert_checkout', e.target.checked)} />
                {t('form.alertCheckout')}
              </label>
            </div>
          </>
        )}

        <button type="submit" disabled={loading} style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          {loading ? t('form.creating') : t('form.createUser')}
        </button>
      </form>
    </div>
  );
}
