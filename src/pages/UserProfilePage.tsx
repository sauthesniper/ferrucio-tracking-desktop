import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api, { fetchEmployeeReport, fetchLeaves, createLeave, deleteLeave, sendSms, sendCheckinAlert, sendLoginCode, fetchSmsLog, fetchAlerts, adminCheckOut, updateCheckInDeadline } from '../services/api';
import { generateDateRange } from '../utils/dateRange';
import { computeAttendanceTotals } from '../utils/attendanceTotals';
import type { UserDetails, EmployeeReport, LocationPoint } from '../types/userProfile';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';

function MapBoundsUpdater({ locations }: { locations: LocationPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds: LatLngBoundsExpression = locations.map(
      (p) => [p.latitude, p.longitude] as [number, number]
    );
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [locations, map]);
  return null;
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const dateRange = generateDateRange(30);
  const todayStr = dateRange[dateRange.length - 1];

  const [user, setUser] = useState<UserDetails | null>(null);
  const [report, setReport] = useState<EmployeeReport | null>(null);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [terminateLoading, setTerminateLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Leave management state
  interface Leave { id: number; employeeId: number; type: string; startDate: string; endDate: string; }
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  const LEAVE_TYPES = ['CO', 'CM', 'CFP', 'CS', 'CC', 'CI'] as const;

  // SMS state
  interface SmsLogEntry { id: number; phone: string; message: string; type: string; status: string; username?: string; created_at: string; error?: string; }
  const [smsLog, setSmsLog] = useState<SmsLogEntry[]>([]);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState('');
  const [smsError, setSmsError] = useState('');

  // Admin check-in/out state
  const [adminCheckInLoading, setAdminCheckInLoading] = useState(false);
  const [adminCheckOutLoading, setAdminCheckOutLoading] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<{ isCheckedIn: boolean; sessionId?: number } | null>(null);

  // Alerts state
  interface AlertEntry { id: number; type: string; details: Record<string, unknown> | null; created_at: string; seen: number; attendance_session_id?: number; employee_name?: string; }
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [alertMapCoords, setAlertMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Check-in deadline state
  const [deadlineValue, setDeadlineValue] = useState('10:00');
  const [deadlineSaving, setDeadlineSaving] = useState(false);
  // CO uses working days (Mon-Fri), CM uses calendar days, others use working days
  const countDays = (start: string, end: string, type: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    if (type === 'CM') {
      // Calendar days
      return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    // Working days (Mon-Fri)
    let count = 0;
    const d = new Date(s);
    while (d <= e) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const leaveDays = countDays(leaveStart, leaveEnd, leaveType);

  const loadLeaves = async () => {
    if (!id) return;
    try {
      const res = await fetchLeaves(Number(id));
      setLeaves(res.data.leaves || []);
    } catch { /* ignore */ }
  };

  const handleCreateLeave = async () => {
    if (!id || !leaveType || !leaveStart || !leaveEnd) return;
    setLeaveSaving(true);
    setLeaveError('');
    setLeaveSuccess('');
    try {
      await createLeave({ employee_id: Number(id), type: leaveType, start_date: leaveStart, end_date: leaveEnd });
      setLeaveSuccess(t('leave.created'));
      setShowLeaveModal(false);
      setLeaveType(''); setLeaveStart(''); setLeaveEnd('');
      loadLeaves();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'LEAVE_OVERLAP') setLeaveError(t('leave.overlap'));
      else setLeaveError(err?.response?.data?.error || t('leave.error'));
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveId: number) => {
    if (!confirm(t('leave.confirmDelete'))) return;
    try {
      await deleteLeave(leaveId);
      setLeaveSuccess(t('leave.deleted'));
      loadLeaves();
    } catch (err: any) {
      setLeaveError(err?.response?.data?.error || t('leave.error'));
    }
  };

  const loadSmsLog = async () => {
    if (!id) return;
    try {
      const res = await fetchSmsLog(Number(id));
      setSmsLog(res.data.log || []);
    } catch { /* ignore */ }
  };

  const handleSendCheckinAlert = async () => {
    if (!id) return;
    setSmsSending(true); setSmsError(''); setSmsSuccess('');
    try {
      await sendCheckinAlert(Number(id));
      setSmsSuccess(t('sms.sent'));
      loadSmsLog();
    } catch (err: any) {
      setSmsError(err?.response?.data?.error || t('sms.failed'));
    } finally { setSmsSending(false); }
  };

  const handleSendLoginCode = async () => {
    if (!id) return;
    setSmsSending(true); setSmsError(''); setSmsSuccess('');
    try {
      await sendLoginCode(Number(id));
      setSmsSuccess(t('sms.sent'));
      loadSmsLog();
    } catch (err: any) {
      setSmsError(err?.response?.data?.error || t('sms.failed'));
    } finally { setSmsSending(false); }
  };

  const handleSendCustomSms = async () => {
    if (!id || !user?.phone || !smsMessage.trim()) return;
    setSmsSending(true); setSmsError(''); setSmsSuccess('');
    try {
      await sendSms({ phone: user.phone, message: smsMessage.trim(), user_id: Number(id) });
      setSmsSuccess(t('sms.sent'));
      setShowSmsModal(false);
      setSmsMessage('');
      loadSmsLog();
    } catch (err: any) {
      setSmsError(err?.response?.data?.error || t('sms.failed'));
    } finally { setSmsSending(false); }
  };

  const handleTerminateContract = async () => {
    if (!id || !user) return;
    if (!confirm(t('userProfile.confirmTerminate'))) return;
    setTerminateLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/api/users/${id}/terminate-contract`);
      setSuccess(t('userProfile.contractTerminated'));
      setUser({ ...user, contract_ended_at: new Date().toISOString() });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to terminate contract');
    } finally {
      setTerminateLoading(false);
    }
  };

  const loadAlerts = async () => {
    if (!id) return;
    try {
      const res = await fetchAlerts(undefined, Number(id));
      setAlerts(res.data.alerts || []);
    } catch { /* ignore */ }
  };

  const loadAttendanceStatus = async () => {
    if (!id) return;
    try {
      const res = await api.get('/api/attendance/employees-dashboard');
      const emp = (res.data.employees || []).find((e: any) => e.id === Number(id));
      if (emp) setAttendanceStatus({ isCheckedIn: emp.isCheckedIn, sessionId: emp.id });
      else setAttendanceStatus({ isCheckedIn: false });
    } catch { /* ignore */ }
  };

  const handleAdminCheckIn = async () => {
    if (!id) return;
    setAdminCheckInLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/api/attendance/admin-check-in', { employee_id: Number(id) });
      setSuccess(t('userProfile.adminCheckInSuccess'));
      loadAttendanceStatus();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('userProfile.adminCheckInFailed'));
    } finally { setAdminCheckInLoading(false); }
  };

  const handleAdminCheckOut = async () => {
    if (!id) return;
    setAdminCheckOutLoading(true); setError(''); setSuccess('');
    try {
      await adminCheckOut(Number(id));
      setSuccess(t('userProfile.adminCheckOutSuccess'));
      loadAttendanceStatus();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('userProfile.adminCheckOutFailed'));
    } finally { setAdminCheckOutLoading(false); }
  };

  const handleSaveDeadline = async () => {
    if (!id) return;
    setDeadlineSaving(true); setError(''); setSuccess('');
    try {
      await updateCheckInDeadline(Number(id), deadlineValue);
      setSuccess(t('userProfile.deadlineSaved'));
      if (user) setUser({ ...user, check_in_deadline: deadlineValue } as any);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Eroare la salvare');
    } finally { setDeadlineSaving(false); }
  };

  // Fetch user details and attendance report on mount
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [userRes, reportRes, locRes] = await Promise.all([
          api.get('/api/users/' + id),
          fetchEmployeeReport(Number(id), dateRange[0], dateRange[dateRange.length - 1]),
          api.get('/api/locations/history/' + id, { params: { date: todayStr } }),
        ]);
        setUser(userRes.data);
        setReport(reportRes.data);
        setLocations(locRes.data.locations || []);
        // Load leaves
        try {
          const lvRes = await fetchLeaves(Number(id));
          setLeaves(lvRes.data.leaves || []);
        } catch { /* ignore */ }
        // Load SMS log
        try {
          const smsRes = await fetchSmsLog(Number(id));
          setSmsLog(smsRes.data.log || []);
        } catch { /* ignore */ }
        // Load alerts
        try {
          const alertRes = await fetchAlerts(undefined, Number(id));
          setAlerts(alertRes.data.alerts || []);
        } catch { /* ignore */ }
        // Load attendance status
        try {
          const statusRes = await api.get('/api/attendance/employees-dashboard');
          const emp = (statusRes.data.employees || []).find((e: any) => e.id === Number(id));
          if (emp) setAttendanceStatus({ isCheckedIn: emp.isCheckedIn });
          else setAttendanceStatus({ isCheckedIn: false });
        } catch { /* ignore */ }
        // Set deadline from user data
        if (userRes.data.check_in_deadline) setDeadlineValue(userRes.data.check_in_deadline);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Debounced fetch of location history when selectedDate changes (skip initial mount)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!id || loading) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/locations/history/' + id, { params: { date: selectedDate } });
        setLocations(res.data.locations || []);
      } catch (err: any) {
        // Don't overwrite the main error — location fetch failures are non-critical
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedDate]);

  const formatDuration = (mins: number | null) => {
    if (mins == null) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr) setSelectedDate(next);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const parseDate = (d: string | null) => {
    if (!d) return null;
    const normalized = d.includes('T') ? d : d.replace(' ', 'T');
    return new Date(normalized);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        <Link to="/users" style={{ color: '#0369a1', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          {t('userProfile.backToUsers')}
        </Link>
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 48 }}>{t('userProfile.loadingProfile')}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <Link to="/users" style={{ color: '#0369a1', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        {t('userProfile.backToUsers')}
      </Link>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* User Details Section */}
      {user && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{user.username}</h1>
            <span style={{
              padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
              background: user.role === 'admin' ? '#dbeafe' : user.role === 'leader' ? '#fef3c7' : '#dcfce7',
              color: user.role === 'admin' ? '#1e40af' : user.role === 'leader' ? '#92400e' : '#166534',
            }}>{user.role}</span>
            {user.contract_ended_at && (
              <span style={{
                padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
              }}>{t('userProfile.contractEnded')}</span>
            )}
          </div>

          {success && (
            <div style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
              {success}
            </div>
          )}

          {isAdmin && !user.contract_ended_at && user.role !== 'admin' && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleTerminateContract}
                disabled={terminateLoading}
                style={{
                  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                  padding: '8px 16px', borderRadius: 8, cursor: terminateLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem', fontWeight: 500,
                }}
              >
                {terminateLoading ? t('common.loading') : t('userProfile.terminateContract')}
              </button>
            </div>
          )}

          {user.contract_ended_at && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem', color: '#991b1b' }}>
              {t('userProfile.contractEndedOn')} {new Date(user.contract_ended_at).toLocaleDateString()}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>{t('userProfile.phone')}</span>
              <div style={{ fontWeight: 500 }}>{user.phone}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>{t('userProfile.uniqueCode')}</span>
              <div style={{ fontWeight: 500 }}>{user.unique_code}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>{t('userProfile.loginCode')}</span>
              <div style={{ fontWeight: 500 }}>{user.login_code}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>{t('userProfile.idNumber')}</span>
              <div style={{ fontWeight: 500 }}>{user.id_number ?? '—'}</div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>{t('userProfile.email')}</span>
              <div style={{ fontWeight: 500 }}>{user.email ?? '—'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <span style={{ color: '#6b7280' }}>{t('userProfile.zoneExitAlert')}</span>
              <span style={{
                padding: '1px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
                background: user.alert_exit_zone ? '#dcfce7' : '#f3f4f6',
                color: user.alert_exit_zone ? '#166534' : '#6b7280',
              }}>{user.alert_exit_zone ? t('userProfile.on') : t('userProfile.off')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <span style={{ color: '#6b7280' }}>{t('userProfile.checkoutAlert')}</span>
              <span style={{
                padding: '1px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
                background: user.alert_checkout ? '#dcfce7' : '#f3f4f6',
                color: user.alert_checkout ? '#166534' : '#6b7280',
              }}>{user.alert_checkout ? t('userProfile.on') : t('userProfile.off')}</span>
            </div>
          </div>

          {(user.work_hours_limit != null || user.screen_time_limit != null || user.stationary_limit != null) && (
            <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: '0.85rem' }}>
              {user.work_hours_limit != null && (
                <div>
                  <span style={{ color: '#6b7280' }}>{t('userProfile.workHoursLimit')} </span>
                  <span style={{ fontWeight: 500 }}>{user.work_hours_limit}h</span>
                </div>
              )}
              {user.screen_time_limit != null && (
                <div>
                  <span style={{ color: '#6b7280' }}>{t('userProfile.screenTimeLimit')} </span>
                  <span style={{ fontWeight: 500 }}>{user.screen_time_limit}min</span>
                </div>
              )}
              {user.stationary_limit != null && (
                <div>
                  <span style={{ color: '#6b7280' }}>{t('userProfile.stationaryLimit')} </span>
                  <span style={{ fontWeight: 500 }}>{user.stationary_limit}min</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin Pontaj + Deadline Section */}
      {user && isAdmin && !user.contract_ended_at && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{t('userProfile.adminPontaj')}</h2>
            {attendanceStatus?.isCheckedIn ? (
              <button onClick={handleAdminCheckOut} disabled={adminCheckOutLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                {adminCheckOutLoading ? t('common.loading') : t('userProfile.adminCheckOut')}
              </button>
            ) : (
              <button onClick={handleAdminCheckIn} disabled={adminCheckInLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                {adminCheckInLoading ? t('common.loading') : t('userProfile.adminCheckIn')}
              </button>
            )}
            <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
              background: attendanceStatus?.isCheckedIn ? '#dcfce7' : '#fee2e2',
              color: attendanceStatus?.isCheckedIn ? '#166534' : '#991b1b' }}>
              {attendanceStatus?.isCheckedIn ? t('userProfile.statusCheckedIn') : t('userProfile.statusNotCheckedIn')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{t('userProfile.checkInDeadline')}</span>
            <input type="time" value={deadlineValue} onChange={e => setDeadlineValue(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
            <button onClick={handleSaveDeadline} disabled={deadlineSaving}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
              {deadlineSaving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Attendance Summary Section */}
      {report && (() => {
        const totals = computeAttendanceTotals(report.sessions);
        return (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('userProfile.attendanceSummary')}</h2>

            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('userProfile.totalHours')}</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{report.totalHours.toFixed(1)}h</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('userProfile.totalSessions')}</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{totals.totalSessions}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('userProfile.screenTime')}</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{report.screenTimeMinutes.toFixed(0)} min</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('userProfile.zoneExits')}</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{report.zoneExits.length}</div>
              </div>
            </div>

            {/* Sessions table */}
            <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{t('userProfile.workSessions')}</h3>
            {report.sessions.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>{t('userProfile.checkIn')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('userProfile.checkOut')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('userProfile.duration')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('userProfile.type')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sessions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{parseDate(s.checkInAt)?.toLocaleString() ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{s.checkOutAt ? parseDate(s.checkOutAt)?.toLocaleString() ?? '—' : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{formatDuration(s.durationMinutes)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500,
                          background: s.checkInType === 'manual' ? '#fef3c7' : '#dbeafe',
                          color: s.checkInType === 'manual' ? '#92400e' : '#1e40af',
                        }}>
                          in: {s.checkInType}
                        </span>
                        {s.checkOutType && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500, marginLeft: 4,
                            background: s.checkOutType === 'manual' ? '#fef3c7' : s.checkOutType === 'auto' ? '#fce7f3' : '#dbeafe',
                            color: s.checkOutType === 'manual' ? '#92400e' : s.checkOutType === 'auto' ? '#9d174d' : '#1e40af',
                          }}>
                            out: {s.checkOutType}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('userProfile.noSessions')}</p>
            )}
          </div>
        );
      })()}

      {/* Leave Management Section */}
      {user && !user.contract_ended_at && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{t('leave.title')}</h2>
            {isAdmin && (
              <button
                onClick={() => { setShowLeaveModal(true); setLeaveError(''); setLeaveSuccess(''); setLeaveType(''); setLeaveStart(''); setLeaveEnd(''); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
              >
                + {t('leave.addLeave')}
              </button>
            )}
          </div>

          {leaveSuccess && (
            <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
              {leaveSuccess}
            </div>
          )}
          {leaveError && !showLeaveModal && (
            <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
              {leaveError}
            </div>
          )}

          {leaves.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('leave.type')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('leave.startDate')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('leave.endDate')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('leave.days')}</th>
                  <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('leave.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(lv => {
                  const days = countDays(lv.startDate, lv.endDate, lv.type);
                  const isCalendar = lv.type === 'CM';
                  return (
                    <tr key={lv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                          background: lv.type === 'CO' ? '#dbeafe' : lv.type === 'CM' ? '#fff7ed' : '#f3e8ff',
                          color: lv.type === 'CO' ? '#1e40af' : lv.type === 'CM' ? '#9a3412' : '#6b21a8',
                        }}>
                          {lv.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{lv.startDate}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{lv.endDate}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                        {days} {isCalendar ? t('leave.calendarDays') : t('leave.workingDays')}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteLeave(lv.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            {t('leave.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{t('leave.noLeaves')}</p>
          )}
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>{t('leave.addLeave')}</h2>

            {leaveError && (
              <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
                {leaveError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{t('leave.type')}</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
              >
                <option value="">{t('leave.selectType')}</option>
                {LEAVE_TYPES.map(lt => (
                  <option key={lt} value={lt}>{t(`leave.${lt}`)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{t('leave.startDate')}</label>
                <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{t('leave.endDate')}</label>
                <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
            </div>

            {leaveType && leaveStart && leaveEnd && leaveEnd >= leaveStart && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.9rem', color: '#0c4a6e' }}>
                <strong>{leaveDays}</strong> {leaveType === 'CM' ? t('leave.calendarDays') : t('leave.workingDays')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowLeaveModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#111827', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {t('leave.cancel')}
              </button>
              <button
                onClick={handleCreateLeave}
                disabled={leaveSaving || !leaveType || !leaveStart || !leaveEnd || leaveEnd < leaveStart}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                  opacity: (!leaveType || !leaveStart || !leaveEnd || leaveEnd < leaveStart) ? 0.5 : 1,
                }}
              >
                {leaveSaving ? t('common.loading') : t('leave.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Section */}
      {user && isAdmin && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{t('sms.title')}</h2>
            <button onClick={handleSendCheckinAlert} disabled={smsSending || !user.phone}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', cursor: !user.phone ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, opacity: !user.phone ? 0.5 : 1 }}>
              {t('sms.sendCheckinAlert')}
            </button>
            <button onClick={handleSendLoginCode} disabled={smsSending || !user.phone}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#1e40af', cursor: !user.phone ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, opacity: !user.phone ? 0.5 : 1 }}>
              {t('sms.sendLoginCode')}
            </button>
            <button onClick={() => { setShowSmsModal(true); setSmsError(''); setSmsSuccess(''); setSmsMessage(''); }} disabled={!user.phone}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', cursor: !user.phone ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 500, opacity: !user.phone ? 0.5 : 1 }}>
              {t('sms.sendCustom')}
            </button>
          </div>

          {smsSuccess && (
            <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
              {smsSuccess}
            </div>
          )}
          {smsError && !showSmsModal && (
            <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
              {smsError}
            </div>
          )}

          {smsLog.length > 0 ? (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('sms.date')}</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('sms.type')}</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('sms.message')}</th>
                    <th style={{ padding: '10px 16px', fontSize: '0.85rem' }}>{t('sms.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {smsLog.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{new Date(entry.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
                          background: entry.type === 'alert' ? '#fef3c7' : entry.type === 'login_code' ? '#dbeafe' : '#f3e8ff',
                          color: entry.type === 'alert' ? '#92400e' : entry.type === 'login_code' ? '#1e40af' : '#6b21a8',
                        }}>
                          {entry.type === 'alert' ? t('sms.typeAlert') : entry.type === 'login_code' ? t('sms.typeLoginCode') : t('sms.typeCustom')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '0.85rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.message}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
                          background: entry.status === 'sent' ? '#dcfce7' : entry.status === 'debug' ? '#e0e7ff' : '#fef2f2',
                          color: entry.status === 'sent' ? '#166534' : entry.status === 'debug' ? '#3730a3' : '#dc2626',
                        }}>
                          {entry.status === 'sent' ? t('sms.statusSent') : entry.status === 'debug' ? t('sms.statusDebug') : t('sms.statusFailed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{t('sms.noLog')}</p>
          )}
        </div>
      )}

      {/* Custom SMS Modal */}
      {showSmsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>{t('sms.sendCustom')}</h2>
            {smsError && (
              <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
                {smsError}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{t('sms.phone')}</label>
              <input type="text" value={user?.phone || ''} disabled
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box', background: '#f9fafb', color: '#6b7280' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{t('sms.message')}</label>
              <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} placeholder={t('sms.messagePlaceholder')}
                rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSmsModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#111827', cursor: 'pointer', fontSize: '0.85rem' }}>
                {t('sms.cancel')}
              </button>
              <button onClick={handleSendCustomSms} disabled={smsSending || !smsMessage.trim()}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, opacity: !smsMessage.trim() ? 0.5 : 1 }}>
                {smsSending ? t('common.loading') : t('sms.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {user && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('userProfile.alertsTitle')}</h2>
          {alerts.length > 0 ? (
            <>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', maxHeight: 350, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left' }}>{t('userProfile.alertType')}</th>
                      <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left' }}>{t('userProfile.alertDate')}</th>
                      <th style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left' }}>{t('userProfile.alertDetails')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => {
                      const isGeofence = a.type === 'geofence_exit' && a.details;
                      const hasCoords = isGeofence && a.details && typeof a.details === 'object' && 'latitude' in a.details && 'longitude' in a.details;
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6', opacity: a.seen ? 0.5 : 1, cursor: hasCoords ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (hasCoords && a.details) {
                              setAlertMapCoords({ lat: Number((a.details as any).latitude), lng: Number((a.details as any).longitude) });
                            }
                          }}
                          onMouseEnter={e => { if (hasCoords) (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <td style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
                              background: a.type === 'geofence_exit' ? '#fef3c7' : a.type === 'late_checkin' ? '#fee2e2' : '#dbeafe',
                              color: a.type === 'geofence_exit' ? '#92400e' : a.type === 'late_checkin' ? '#991b1b' : '#1e40af' }}>
                              {a.type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#6b7280' }}>
                            {(() => { try { return new Date(a.created_at).toLocaleString('ro-RO'); } catch { return a.created_at; } })()}
                          </td>
                          <td style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#6b7280' }}>
                            {hasCoords && <span style={{ color: '#2563eb', fontSize: '0.8rem' }}>📍 {t('userProfile.showOnMap')}</span>}
                            {a.type === 'late_checkin' && a.details && (a.details as any).deadline && (
                              <span>{t('userProfile.deadlineLabel')}: {(a.details as any).deadline}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Geofence alert map */}
              {alertMapCoords && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('userProfile.alertLocation')}</h3>
                    <button onClick={() => setAlertMapCoords(null)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}>
                      ✕ {t('common.close')}
                    </button>
                  </div>
                  <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', height: 300 }}>
                    <MapContainer center={[alertMapCoords.lat, alertMapCoords.lng]} zoom={16} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                      <Marker position={[alertMapCoords.lat, alertMapCoords.lng]}>
                        <Popup>{t('userProfile.geofenceExitHere')}</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{t('userProfile.noAlerts')}</p>
          )}
        </div>
      )}

      {/* Location Map Section */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('userProfile.locationTrail')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={handlePrevDay}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#000" xmlns="http://www.w3.org/2000/svg"><path d="M10.354 3.354a.5.5 0 0 0-.708-.708l-5 5a.5.5 0 0 0 0 .708l5 5a.5.5 0 0 0 .708-.708L5.707 8l4.647-4.646z"/></svg>
          </button>
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={handleDateChange}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
          />
          <button
            onClick={handleNextDay}
            disabled={selectedDate >= todayStr}
            style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: selectedDate >= todayStr ? 'not-allowed' : 'pointer',
              opacity: selectedDate >= todayStr ? 0.4 : 1, display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#000" xmlns="http://www.w3.org/2000/svg"><path d="M5.646 3.354a.5.5 0 0 1 .708-.708l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708-.708L10.293 8 5.646 3.354z"/></svg>
          </button>
        </div>

        {locations.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('userProfile.noGpsData')}</p>
        ) : (
          <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <MapContainer
              center={[locations[0].latitude, locations[0].longitude]}
              zoom={14}
              style={{ height: 400, width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapBoundsUpdater locations={locations} />
              <Polyline
                positions={locations.map((p) => [p.latitude, p.longitude] as [number, number])}
                pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.7 }}
              />
              {locations.map((p, i) => (
                <CircleMarker
                  key={i}
                  center={[p.latitude, p.longitude]}
                  radius={3}
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>{new Date(p.timestamp).toLocaleString()}</strong><br />
                      {p.speed != null && <>{t('userProfile.speed')} {(p.speed * 3.6).toFixed(1)} km/h<br /></>}
                      {t('userProfile.battery')} {p.battery_level != null ? `${Math.round(p.battery_level)}%` : '—'}<br />
                      {t('userProfile.screen')} {p.screen_on ? <span style={{color:'#22c55e'}}>● On</span> : <span style={{color:'#ef4444'}}>● Off</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}
