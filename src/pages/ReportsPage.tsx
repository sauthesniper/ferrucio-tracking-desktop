import { useState } from 'react';
import { useTranslation } from '../i18n';
import {
  fetchWorkHoursReport,
  fetchMonthlyReportJson,
  downloadMonthlyReportCsv,
  fetchScreenTime,
} from '../services/api';

// ── Types ──

interface WorkHoursRow {
  id: number; username: string; uniqueCode: string;
  sessionCount: number; totalMinutes: number; totalHours: number;
}
interface MonthlyRow {
  name: string; uniqueCode: string; days: number[]; leaves: (string | null)[]; total: number;
}
interface ScreenTimeRow {
  id: number; username: string; uniqueCode: string; screenTimeMinutes: number;
}

type ReportTab = 'work_hours' | 'monthly' | 'screen_time';

// ── Component ──

export default function ReportsPage() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [tab, setTab] = useState<ReportTab>('work_hours');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  // Work hours state
  const [whRows, setWhRows] = useState<WorkHoursRow[]>([]);
  const [whTotal, setWhTotal] = useState(0);

  // Monthly state
  const [mRows, setMRows] = useState<MonthlyRow[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Screen time state
  const [stRows, setStRows] = useState<ScreenTimeRow[]>([]);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const generate = async () => {
    setLoading(true); setError(''); setFetched(false);
    try {
      if (tab === 'work_hours') {
        const res = await fetchWorkHoursReport(from, to);
        setWhRows(res.data.employees); setWhTotal(res.data.grandTotalHours);
      } else if (tab === 'monthly') {
        const res = await fetchMonthlyReportJson(month);
        setMRows(res.data.employees);
      } else {
        const res = await fetchScreenTime(from, to);
        setStRows(res.data.employees);
      }
      setFetched(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la generarea raportului');
    } finally { setLoading(false); }
  };

  const exportWorkHoursCsv = () => {
    const header = `${t('workReport.empCode')},${t('workReport.username')},${t('workReport.sessions')},${t('workReport.hoursWorked')}`;
    const lines = whRows.map(r => `${r.uniqueCode || ''},${r.username},${r.sessionCount},${r.totalHours}`);
    lines.push(`,,${t('workReport.total')},${whTotal}`);
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `raport-ore-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMonthlyCsv = async () => {
    setDownloading(true); setError('');
    try {
      const res = await downloadMonthlyReportCsv(month);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `raport-lunar-${month}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la descărcarea raportului');
    } finally { setDownloading(false); }
  };

  const switchTab = (t: ReportTab) => { setTab(t); setFetched(false); setError(''); };

  const tabStyle = (active: boolean) => ({
    padding: '10px 20px', fontSize: '0.9rem', fontWeight: active ? 700 : 400,
    border: 'none', borderBottom: active ? '3px solid #1e3a5f' : '3px solid transparent',
    background: 'transparent', color: active ? '#1e3a5f' : '#6b7280', cursor: 'pointer',
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('reports.title')}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button style={tabStyle(tab === 'work_hours')} onClick={() => switchTab('work_hours')}>{t('reports.tabWorkHours')}</button>
        <button style={tabStyle(tab === 'monthly')} onClick={() => switchTab('monthly')}>{t('reports.tabMonthly')}</button>
        <button style={tabStyle(tab === 'screen_time')} onClick={() => switchTab('screen_time')}>{t('reports.tabScreenTime')}</button>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{error}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {tab === 'monthly' ? (
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('monthlyReport.month')}</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '8px 12px' }} />
          </div>
        ) : (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('workReport.from')}</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151' }}>{t('workReport.to')}</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 12px' }} />
            </div>
          </>
        )}
        <button onClick={generate} disabled={loading} style={{ padding: '8px 20px' }}>
          {loading ? t('common.loading') : t('workReport.generate')}
        </button>
        {/* Export buttons */}
        {fetched && tab === 'work_hours' && whRows.length > 0 && (
          <button onClick={exportWorkHoursCsv} style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {t('workReport.exportCsv')}
          </button>
        )}
        {tab === 'monthly' && (
          <button onClick={exportMonthlyCsv} disabled={downloading} style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {downloading ? t('monthlyReport.downloading') : t('monthlyReport.download')}
          </button>
        )}
      </div>

      {/* ── Work Hours Table ── */}
      {tab === 'work_hours' && fetched && whRows.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('workReport.noData')}</p>}
      {tab === 'work_hours' && fetched && whRows.length > 0 && (
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
            {whRows.map((r) => (
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
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>{whTotal}h</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* ── Monthly Table ── */}
      {tab === 'monthly' && fetched && mRows.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('monthlyReport.noData')}</p>}
      {tab === 'monthly' && fetched && mRows.length > 0 && (
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
              {mRows.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>{r.name}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 500 }}>{r.uniqueCode || '—'}</td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const leave = r.leaves?.[i] || null;
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

      {/* ── Screen Time Table ── */}
      {tab === 'screen_time' && fetched && stRows.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>{t('screenTime.noData')}</p>}
      {tab === 'screen_time' && fetched && stRows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
              <th style={{ padding: '10px 12px' }}>{t('screenTime.name')}</th>
              <th style={{ padding: '10px 12px' }}>{t('screenTime.code')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('screenTime.minutes')}</th>
            </tr>
          </thead>
          <tbody>
            {stRows.map(r => (
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
