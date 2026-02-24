import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchEmployeeReport } from '../services/api';
import { useTranslation } from '../i18n';

interface EmployeeInfo {
  id: number;
  username: string;
  phone: string;
  uniqueCode: string;
}

interface Session {
  id: number;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  checkInType: string;
  checkOutType: string | null;
  checkInLeaderName: string | null;
  checkOutLeaderName: string | null;
  manualReason: string | null;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  speed: number | null;
  screen_on: number | null;
  battery_level: number | null;
  recorded_at: string;
}

interface ZoneExit {
  id: number;
  type: string;
  details: { latitude?: number; longitude?: number } | null;
  created_at: string;
}

export default function EmployeeReportPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [screenTimeMinutes, setScreenTimeMinutes] = useState(0);
  const [gpsTrail, setGpsTrail] = useState<GpsPoint[]>([]);
  const [zoneExits, setZoneExits] = useState<ZoneExit[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchEmployeeReport(Number(id), from || undefined, to || undefined);
      setEmployee(res.data.employee);
      setSessions(res.data.sessions);
      setTotalHours(res.data.totalHours);
      setScreenTimeMinutes(res.data.screenTimeMinutes);
      setGpsTrail(res.data.gpsTrail);
      setZoneExits(res.data.zoneExits);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load employee report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [id]);

  const formatDuration = (mins: number | null) => {
    if (mins == null) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const parseDate = (d: string | null) => {
    if (!d) return null;
    // Handle PostgreSQL text format "2026-02-23 19:30:00" by adding T
    const normalized = d.includes('T') ? d : d.replace(' ', 'T');
    return new Date(normalized);
  };

  const trailPositions = gpsTrail.map(p => [p.latitude, p.longitude] as [number, number]);
  const mapCenter: [number, number] = trailPositions.length > 0
    ? trailPositions[Math.floor(trailPositions.length / 2)]
    : [20, 0];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <Link to="/attendance" style={{ color: '#0369a1', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        {t('employeeReport.backToSessions')}
      </Link>

      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {employee && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>{t('employeeReport.title')} {employee.username}</h1>
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>({employee.phone})</span>
        </div>
      )}

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#6b7280' }}>{t('employeeReport.from')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '6px 12px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', color: '#6b7280' }}>{t('employeeReport.to')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '6px 12px' }} />
        </div>
        <button onClick={loadReport} disabled={loading} style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
          {loading ? t('employeeReport.loading') : t('employeeReport.applyFilter')}
        </button>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }} style={{ padding: '6px 16px', fontSize: '0.85rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>
            {t('employeeReport.clear')}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('employeeReport.totalHours')}</div>
          <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{totalHours.toFixed(1)}h</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('employeeReport.sessions')}</div>
          <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{sessions.length}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('employeeReport.screenTime')}</div>
          <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{screenTimeMinutes.toFixed(0)} min</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('employeeReport.zoneExits')}</div>
          <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{zoneExits.length}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{t('employeeReport.gpsPoints')}</div>
          <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{gpsTrail.length}</div>
        </div>
      </div>

      {/* GPS Trail Map */}
      {gpsTrail.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('employeeReport.gpsTrail')}</h2>
          <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <MapContainer center={mapCenter} zoom={14} style={{ height: 400, width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <Polyline positions={trailPositions} pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.7 }} />
              {gpsTrail.map((p, i) => (
                <CircleMarker
                  key={i}
                  center={[p.latitude, p.longitude]}
                  radius={3}
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>{new Date(p.recorded_at).toLocaleString()}</strong><br />
                      {p.speed != null && <>{t('map.speed')} {(p.speed * 3.6).toFixed(1)} km/h<br /></>}
                      {t('employeeReport.battery')} {p.battery_level != null ? `${p.battery_level.toFixed(0)}%` : '—'}<br />
                      {t('map.screen')} {p.screen_on ? <span style={{color:'#22c55e'}}>● On</span> : <span style={{color:'#ef4444'}}>● Off</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Sessions table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('employeeReport.workSessions')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '12px 16px' }}>{t('employeeReport.checkIn')}</th>
            <th style={{ padding: '12px 16px' }}>{t('employeeReport.checkOut')}</th>
            <th style={{ padding: '12px 16px' }}>{t('employeeReport.duration')}</th>
            <th style={{ padding: '12px 16px' }}>{t('employeeReport.type')}</th>
            <th style={{ padding: '12px 16px' }}>{t('employeeReport.details')}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
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
              <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#6b7280' }}>
                {s.checkInLeaderName && <div>{t('employeeReport.checkInBy')} {s.checkInLeaderName}</div>}
                {s.checkOutLeaderName && <div>{t('employeeReport.checkOutBy')} {s.checkOutLeaderName}</div>}
                {s.manualReason && <div>{t('employeeReport.reason')} {s.manualReason}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sessions.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 32 }}>{t('employeeReport.noSessions')}</p>
      )}
    </div>
  );
}
