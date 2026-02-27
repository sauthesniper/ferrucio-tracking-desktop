import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTranslation } from '../i18n';

interface Session {
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
}

interface CalendarDay {
  date: string;
  sessions: Session[];
  totalHours: number;
  screenTimeMinutes: number;
}

interface Leave {
  id: number;
  type: 'odihna' | 'medical';
  startDate: string;
  endDate: string;
}

interface CalendarResponse {
  days: Record<string, CalendarDay>;
  leaves: Leave[];
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sun, 1=Mon... We want Mon=0
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function isLeaveDay(date: string, leaves: Leave[]): Leave | null {
  for (const l of leaves) {
    if (date >= l.startDate && date <= l.endDate) return l;
  }
  return null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function AttendanceCalendarPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchCalendar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/reports/calendar/${id}`, { params: { month: formatMonth(year, month) } });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await api.get(`/api/users/${id}`);
      setUsername(res.data.username || res.data.user?.username || `#${id}`);
    } catch { setUsername(`#${id}`); }
  };

  useEffect(() => { fetchUser(); }, [id]);
  useEffect(() => { fetchCalendar(); setSelectedDay(null); }, [id, year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const weekDays = [t('calendar.mon'), t('calendar.tue'), t('calendar.wed'), t('calendar.thu'), t('calendar.fri'), t('calendar.sat'), t('calendar.sun')];

  const monthLabel = new Date(year, month - 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  const selectedDayData = useMemo(() => {
    if (!selectedDay || !data) return null;
    return data.days[selectedDay] || null;
  }, [selectedDay, data]);

  const selectedDayLeave = useMemo(() => {
    if (!selectedDay || !data) return null;
    return isLeaveDay(selectedDay, data.leaves);
  }, [selectedDay, data]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <button onClick={() => navigate('/users')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', marginBottom: 12, fontSize: '0.9rem' }}>
        {t('calendar.backToUsers')}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h1 style={{ margin: 0 }}>{t('calendar.title')} — {username}</h1>
      </div>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>
          {t('calendar.prevMonth')}
        </button>
        <span style={{ fontWeight: 600, fontSize: '1.1rem', textTransform: 'capitalize' }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>
          {t('calendar.nextMonth')}
        </button>
      </div>

      {loading && <p>{t('common.loading')}</p>}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: '0.85rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#bbf7d0', border: '1px solid #86efac' }} /> {t('dashboard.checkedIn')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#bfdbfe', border: '1px solid #93c5fd' }} /> {t('calendar.leaveVacation')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fed7aa', border: '1px solid #fdba74' }} /> {t('calendar.leaveMedical')}
        </span>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 24 }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 600, padding: '8px 0', fontSize: '0.85rem', color: '#64748b' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: 70 }} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dayStr = `${formatMonth(year, month)}-${String(dayNum).padStart(2, '0')}`;
          const dayData = data?.days[dayStr];
          const leave = data ? isLeaveDay(dayStr, data.leaves) : null;
          const isSelected = selectedDay === dayStr;

          let bg = '#fff';
          let border = '1px solid #e5e7eb';
          if (leave?.type === 'odihna') { bg = '#bfdbfe'; border = '1px solid #93c5fd'; }
          else if (leave?.type === 'medical') { bg = '#fed7aa'; border = '1px solid #fdba74'; }
          else if (dayData && dayData.sessions.length > 0) { bg = '#bbf7d0'; border = '1px solid #86efac'; }
          if (isSelected) border = '2px solid #2563eb';

          return (
            <div
              key={dayStr}
              onClick={() => setSelectedDay(dayStr)}
              style={{
                minHeight: 70, padding: 6, borderRadius: 6, background: bg, border,
                cursor: 'pointer', fontSize: '0.8rem', position: 'relative',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{dayNum}</div>
              {dayData && dayData.totalHours > 0 && (
                <div style={{ color: '#166534', fontSize: '0.75rem' }}>{dayData.totalHours}{t('calendar.hours')}</div>
              )}
              {leave && (
                <div style={{ fontSize: '0.7rem', color: leave.type === 'medical' ? '#9a3412' : '#1e40af' }}>
                  {leave.type === 'medical' ? t('calendar.leaveMedical') : t('calendar.leaveVacation')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day details panel */}
      {selectedDay && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px 0' }}>{t('calendar.dayDetails')} — {selectedDay}</h3>

          {selectedDayLeave && (
            <div style={{
              padding: '8px 14px', borderRadius: 6, marginBottom: 12, fontSize: '0.9rem',
              background: selectedDayLeave.type === 'medical' ? '#fff7ed' : '#eff6ff',
              border: selectedDayLeave.type === 'medical' ? '1px solid #fdba74' : '1px solid #93c5fd',
              color: selectedDayLeave.type === 'medical' ? '#9a3412' : '#1e40af',
            }}>
              {t('calendar.leave')}: {selectedDayLeave.type === 'medical' ? t('calendar.leaveMedical') : t('calendar.leaveVacation')}
              {' '}({selectedDayLeave.startDate} — {selectedDayLeave.endDate})
            </div>
          )}

          {selectedDayData && selectedDayData.sessions.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: '0.9rem' }}>
                <span><strong>{t('calendar.totalHours')}:</strong> {selectedDayData.totalHours}{t('calendar.hours')}</span>
                <span><strong>{t('calendar.screenTime')}:</strong> {selectedDayData.screenTimeMinutes} {t('calendar.minutes')}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 12px' }}>{t('calendar.checkIn')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('calendar.checkOut')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('calendar.duration')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayData.sessions.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}>{formatTime(s.checkInAt)}</td>
                      <td style={{ padding: '8px 12px' }}>{s.checkOutAt ? formatTime(s.checkOutAt) : t('calendar.active')}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {s.durationMinutes != null ? `${Math.round(s.durationMinutes)} ${t('calendar.minutes')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            !selectedDayLeave && <p style={{ color: '#9ca3af', margin: 0 }}>{t('calendar.noData')}</p>
          )}
        </div>
      )}
    </div>
  );
}
