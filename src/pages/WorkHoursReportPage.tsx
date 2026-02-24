import { useState } from 'react';
import { fetchWorkHoursReport } from '../services/api';
import { useTranslation } from '../i18n';

interface EmployeeRow {
  id: number;
  username: string;
  uniqueCode: string;
  sessionCount: number;
  totalMinutes: number;
  totalHours: number;
}

export default function WorkHoursReportPage() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const generate = async () => {
    setLoading(true); setError(''); setFetched(false);
    try {
      const res = await fetchWorkHoursReport(from, to);
      setRows(res.data.employees);
      setGrandTotal(res.data.grandTotalHours);
      setFetched(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la generarea raportului');
    } finally { setLoading(false); }
  };

  const exportCsv = () => {
    const header = `${t('workReport.empCode')},${t('workReport.username')},${t('workReport.sessions')},${t('workReport.hoursWorked')}`;
    const lines = rows.map(r => `${r.uniqueCode || ''},${r.username},${r.sessionCount},${r.totalHours}`);
    lines.push(`,,${t('workReport.total')},${grandTotal}`);
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `raport-ore-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('workReport.title')}</h1>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('workReport.from')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 12px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('workReport.to')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 12px' }} />
        </div>
        <button onClick={generate} disabled={loading} style={{ padding: '8px 20px' }}>
          {loading ? t('workReport.generating') : t('workReport.generate')}
        </button>
        {fetched && rows.length > 0 && (
          <button onClick={exportCsv} style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {t('workReport.exportCsv')}
          </button>
        )}
      </div>

      {fetched && rows.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('workReport.noData')}</p>}

      {fetched && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
              <th style={{ padding: '12px 16px' }}>{t('workReport.empCode')}</th>
              <th style={{ padding: '12px 16px' }}>{t('workReport.username')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>{t('workReport.sessions')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('workReport.hoursWorked')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 500 }}>{r.uniqueCode || '—'}</td>
                <td style={{ padding: '10px 16px' }}>{r.username}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>{r.sessionCount}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{r.totalHours}h</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: '12px 16px' }}>{t('workReport.total')}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>{grandTotal}h</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
