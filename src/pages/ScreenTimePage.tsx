import { useState } from 'react';
import { fetchScreenTime } from '../services/api';
import { useTranslation } from '../i18n';

interface ScreenTimeRow {
  id: number;
  username: string;
  uniqueCode: string;
  screenTimeMinutes: number;
}

type SortKey = 'username' | 'uniqueCode' | 'screenTimeMinutes';
type SortDir = 'asc' | 'desc';

export default function ScreenTimePage() {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<ScreenTimeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const generate = async () => {
    setLoading(true);
    setError('');
    setFetched(false);
    try {
      const res = await fetchScreenTime(from, to);
      setRows(res.data.employees);
      setFetched(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la generarea raportului');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('screenTime.title')}</h1>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('screenTime.from')}</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 12px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('screenTime.to')}</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 12px' }} />
        </div>
        <button onClick={generate} disabled={loading} style={{ padding: '8px 20px' }}>
          {loading ? t('screenTime.loading') : t('screenTime.generate')}
        </button>
      </div>

      {fetched && rows.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('screenTime.noData')}</p>
      )}

      {fetched && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
              <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => toggleSort('username')}>{t('screenTime.name')}{arrow('username')}</th>
              <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => toggleSort('uniqueCode')}>{t('screenTime.code')}{arrow('uniqueCode')}</th>
              <th style={{ padding: '10px 12px', cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('screenTimeMinutes')}>{t('screenTime.minutes')}{arrow('screenTimeMinutes')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 12px' }}>{r.username}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 500 }}>{r.uniqueCode || '—'}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{r.screenTimeMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
