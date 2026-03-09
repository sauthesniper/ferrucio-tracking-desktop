import { useState } from 'react';
import { downloadMonthlyReportCsv, fetchMonthlyReportJson } from '../services/api';
import { useTranslation } from '../i18n';

interface MonthlyReportRow {
  name: string;
  uniqueCode: string;
  days: number[];
  leaves: (string | null)[];
  total: number;
}

export default function MonthlyReportPage() {
  const { t } = useTranslation();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<MonthlyReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const generate = async () => {
    setLoading(true);
    setError('');
    setFetched(false);
    try {
      const res = await fetchMonthlyReportJson(month);
      setRows(res.data.employees);
      setFetched(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la generarea raportului');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await downloadMonthlyReportCsv(month);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raport-lunar-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la descărcarea raportului');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('monthlyReport.title')}</h1>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('monthlyReport.month')}</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: '8px 12px' }}
          />
        </div>
        <button onClick={generate} disabled={loading} style={{ padding: '8px 20px' }}>
          {loading ? t('common.loading') : t('workReport.generate')}
        </button>
        <button
          onClick={downloadCsv}
          disabled={downloading}
          style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {downloading ? t('monthlyReport.downloading') : t('monthlyReport.download')}
        </button>
      </div>

      {fetched && rows.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('monthlyReport.noData')}</p>
      )}

      {fetched && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: '8px 10px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>{t('monthlyReport.name')}</th>
                <th style={{ padding: '8px 10px' }}>{t('monthlyReport.code')}</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i} style={{ padding: '8px 6px', textAlign: 'center', minWidth: 40 }}>{i + 1}</th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{t('monthlyReport.total')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>{r.name}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 500 }}>{r.uniqueCode || '—'}</td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const leave = (r as any).leaves?.[i] || null;
                    return (
                      <td key={i} style={{
                        padding: '6px 4px', textAlign: 'center',
                        color: leave ? (leave === 'CM' ? '#9a3412' : '#1e40af') : (r.days[i] > 0 ? '#111' : '#d1d5db'),
                        fontWeight: leave ? 600 : 400,
                        fontSize: leave ? '0.7rem' : undefined,
                        background: leave ? (leave === 'CM' ? '#fff7ed' : leave === 'CO' ? '#eff6ff' : '#faf5ff') : undefined,
                      }}>
                        {leave ? leave : (r.days[i] > 0 ? r.days[i] : '—')}
                      </td>
                    );
                  })}
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{r.total}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
