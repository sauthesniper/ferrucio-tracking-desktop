import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api, { fetchEmployeeReport } from '../services/api';
import { generateDateRange } from '../utils/dateRange';
import { computeAttendanceTotals } from '../utils/attendanceTotals';
import type { UserDetails, EmployeeReport, LocationPoint } from '../types/userProfile';
import { useTranslation } from '../i18n';

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

  const dateRange = generateDateRange(30);
  const todayStr = dateRange[dateRange.length - 1];

  const [user, setUser] = useState<UserDetails | null>(null);
  const [report, setReport] = useState<EmployeeReport | null>(null);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          </div>

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
