import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { fetchSessions, fetchSessionEmployees } from '../services/api';
import { useTranslation } from '../i18n';
import { useGeofenceState, GeofenceMapElements, GeofenceToolbar, GeofenceAlerts, GeofenceNameModal } from '../components/GeofenceConfig';

interface LocationData {
  userId: number; username: string;
  latitude: number; longitude: number; timestamp: string;
  prevLatitude?: number; prevLongitude?: number;
  phone?: string | null; last_location_at?: string;
}

interface AttendanceEmployee {
  employee_id: number;
  employee_name: string;
  phone: string;
  check_in_at: string;
  check_out_at: string | null;
}

interface HistoryPoint {
  latitude: number; longitude: number; timestamp: string;
  speed: number | null;
  accel_x: number | null; accel_y: number | null; accel_z: number | null;
  gyro_x: number | null; gyro_y: number | null; gyro_z: number | null;
  screen_on: number | null;
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function makeArrowIcon(angle: number): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(${angle}deg)">
      <polygon points="12,2 6,20 12,15 18,20" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/>
    </svg>`,
  });
}

// Acceleration magnitude → color (green=low, yellow=medium, red=high)
function accelColor(ax: number | null, ay: number | null, az: number | null): string {
  if (ax == null || ay == null || az == null) return '#6b7280';
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const net = Math.abs(mag - 9.81);
  if (net < 0.5) return '#22c55e';
  if (net < 2) return '#eab308';
  if (net < 5) return '#f97316';
  return '#dc2626';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TRAIL_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#be185d', '#4f46e5'];
const REFRESH_MS = 15_000;

function computeStats(pts: HistoryPoint[]) {
  let maxSpeed = 0;
  let totalDist = 0;
  let screenOnMs = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.speed != null && p.speed > maxSpeed) maxSpeed = p.speed;
    if (i > 0) {
      totalDist += haversineKm(pts[i - 1].latitude, pts[i - 1].longitude, p.latitude, p.longitude);
      if (p.screen_on === 1) {
        const dt = new Date(p.timestamp).getTime() - new Date(pts[i - 1].timestamp).getTime();
        screenOnMs += dt;
      }
    }
  }
  return {
    maxSpeedKmh: (maxSpeed * 3.6).toFixed(1),
    distanceKm: totalDist.toFixed(2),
    screenOnMin: (screenOnMs / 60000).toFixed(1),
  };
}

function MapController({ locations, selectedUserIds, histories }: {
  locations: LocationData[];
  selectedUserIds: Set<number>;
  histories: Record<number, HistoryPoint[]>;
}) {
  const map = useMap();
  const initialFitDone = useRef(false);
  const prevSelectedCount = useRef(0);

  useEffect(() => {
    if (initialFitDone.current || locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    initialFitDone.current = true;
  }, [locations, map]);

  useEffect(() => {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    const allPoints: [number, number][] = [];
    for (const uid of ids) {
      const pts = histories[uid];
      if (pts && pts.length > 0) {
        pts.forEach(p => allPoints.push([p.latitude, p.longitude]));
      }
      const loc = locations.find(l => l.userId === uid);
      if (loc) allPoints.push([loc.latitude, loc.longitude]);
    }
    if (allPoints.length === 0) return;
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [selectedUserIds, histories, locations, map]);

  useEffect(() => {
    if (prevSelectedCount.current > 0 && selectedUserIds.size === 0 && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
    prevSelectedCount.current = selectedUserIds.size;
  }, [selectedUserIds, locations, map]);

  return null;
}

const MAX_HISTORY_DOTS = 200;

function downsample(pts: HistoryPoint[], max: number): HistoryPoint[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const result: HistoryPoint[] = [];
  for (let i = 0; i < max; i++) {
    result.push(pts[Math.floor(i * step)]);
  }
  if (result[result.length - 1] !== pts[pts.length - 1]) result.push(pts[pts.length - 1]);
  return result;
}

function HistoryDots({ selectedArr, histories }: { selectedArr: number[]; histories: Record<number, HistoryPoint[]> }) {
  const { t } = useTranslation();
  return (
    <>
      {selectedArr.map((uid) => {
        const pts = histories[uid];
        if (!pts) return null;
        const sampled = downsample(pts, MAX_HISTORY_DOTS);
        return sampled.map((p, i) => {
          const color = accelColor(p.accel_x, p.accel_y, p.accel_z);
          return (
            <CircleMarker
              key={`hist-${uid}-${i}`}
              center={[p.latitude, p.longitude]}
              radius={4}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
            >
              <Popup>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                  <strong>{new Date(p.timestamp).toLocaleString()}</strong><br />
                  {p.speed != null && <>{t('map.speed')} {(p.speed * 3.6).toFixed(1)} km/h<br /></>}
                  {p.accel_x != null && <>{t('map.accel')} {Math.sqrt(p.accel_x**2 + (p.accel_y??0)**2 + (p.accel_z??0)**2).toFixed(2)} m/s²<br /></>}
                  {p.gyro_x != null && <>{t('map.gyro')} {Math.sqrt(p.gyro_x**2 + (p.gyro_y??0)**2 + (p.gyro_z??0)**2).toFixed(2)} rad/s<br /></>}
                  {t('map.screen')} {p.screen_on ? <span style={{color:'#22c55e'}}>● On</span> : <span style={{color:'#ef4444'}}>● Off</span>}
                </div>
              </Popup>
            </CircleMarker>
          );
        });
      })}
    </>
  );
}

const MemoizedHistoryDots = React.memo(HistoryDots);

export default function MapPage() {
  const { t } = useTranslation();
  const geofence = useGeofenceState();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [histories, setHistories] = useState<Record<number, HistoryPoint[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [attendanceEmployees, setAttendanceEmployees] = useState<AttendanceEmployee[]>([]);
  const selectedRef = useRef(selectedUserIds);
  selectedRef.current = selectedUserIds;
  const fetchingRef = useRef(false);

  const fetchHistories = useCallback(async (ids: Set<number>) => {
    if (ids.size === 0) { setHistories({}); return; }
    const result: Record<number, HistoryPoint[]> = {};
    await Promise.all(Array.from(ids).map(async (uid) => {
      try { const res = await api.get(`/api/locations/history/${uid}`); result[uid] = res.data.locations; }
      catch { result[uid] = []; }
    }));
    setHistories(result);
  }, []);

  const fetchLocations = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await api.get('/api/locations/latest');
      setLocations(res.data.locations);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load locations');
    } finally { setLoading(false); }
    if (selectedRef.current.size > 0) fetchHistories(selectedRef.current);

    try {
      const sessRes = await fetchSessions('active');
      const activeSessions = sessRes.data.sessions || [];
      const empResults = await Promise.all(
        activeSessions.map((sess: any) =>
          fetchSessionEmployees(sess.id).catch(() => ({ data: { employees: [] } }))
        )
      );
      const allEmps: AttendanceEmployee[] = [];
      for (const empRes of empResults) {
        const checkedIn = (empRes.data.employees || []).filter((e: any) => !e.check_out_at);
        allEmps.push(...checkedIn);
      }
      const seen = new Set<number>();
      setAttendanceEmployees(allEmps.filter((e) => {
        if (seen.has(e.employee_id)) return false;
        seen.add(e.employee_id);
        return true;
      }));
    } catch { /* attendance data is supplementary */ }
    fetchingRef.current = false;
  }, [fetchHistories]);

  useEffect(() => { fetchLocations(); const iv = setInterval(fetchLocations, REFRESH_MS); return () => clearInterval(iv); }, [fetchLocations]);
  useEffect(() => { fetchHistories(selectedUserIds); }, [selectedUserIds, fetchHistories]);

  const handleMarkerClick = useCallback((userId: number, e: any) => {
    const ctrlKey = e.originalEvent?.ctrlKey || e.originalEvent?.metaKey;
    setSelectedUserIds((prev) => {
      const next = new Set(ctrlKey ? prev : []);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }, []);

  const filteredLocations = locations.filter((loc) => {
    if (!search) return true;
    return loc.username.toLowerCase().includes(search.toLowerCase());
  });

  const filteredAttendanceEmployees = attendanceEmployees.filter((emp) => {
    if (!search) return true;
    return emp.employee_name.toLowerCase().includes(search.toLowerCase());
  });

  const selectedArr = Array.from(selectedUserIds);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <h1 style={{ margin: 0 }}>{t('map.title')}</h1>
          <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: 8 }}>
            {filteredLocations.length} {filteredLocations.length !== 1 ? t('map.trackedPlural') : t('map.tracked')}
            {loading && <span style={{ marginLeft: 6 }}>⟳</span>}
          </span>
        </div>
      </div>

      {/* Toolbar — outside the map container (Req 4.1, 4.3) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <GeofenceToolbar geofence={geofence} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('map.searchPlaceholder')}
            style={{ padding: '6px 12px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: 6, width: 200 }}
          />
          {selectedArr.length > 0 && (
            <button onClick={() => setSelectedUserIds(new Set())} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              {t('map.clearSelection')} ({selectedArr.length})
            </button>
          )}
          <button onClick={fetchLocations} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loading ? t('map.refreshing') : t('map.refresh')}
          </button>
        </div>
      </div>

      {/* Alerts — outside the map container (Req 4.2) */}
      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 10, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <GeofenceAlerts geofence={geofence} />
      </div>

      {/* Acceleration legend — outside the map container (Req 4.3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8rem', color: '#6b7280', marginBottom: 8 }}>
        <span>{t('map.historyHint')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> {t('map.still')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} /> {t('map.moderate')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} /> {t('map.fast')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> {t('map.high')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #059669', display: 'inline-block' }} /> {t('map.checkedIn')}</span>
      </div>

      {/* Map container — only map elements inside (Req 4.4) */}
      <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: 550, width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <MapController locations={filteredLocations} selectedUserIds={selectedUserIds} histories={histories} />
          <GeofenceMapElements geofence={geofence} />

          {/* History trails */}
          {selectedArr.map((uid, idx) => {
            const pts = histories[uid];
            if (!pts || pts.length < 2) return null;
            const color = TRAIL_COLORS[idx % TRAIL_COLORS.length];
            return <Polyline key={`trail-${uid}`} positions={pts.map(p => [p.latitude, p.longitude] as [number, number])} pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: '6 4' }} />;
          })}

          <MemoizedHistoryDots selectedArr={selectedArr} histories={histories} />

          {/* Current position markers */}
          {filteredLocations.map((loc) => {
            const isSelected = selectedUserIds.has(loc.userId);
            return (
              <CircleMarker
                key={loc.userId}
                center={[loc.latitude, loc.longitude]}
                radius={isSelected ? 10 : 8}
                pathOptions={{ color: isSelected ? '#991b1b' : '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9, weight: isSelected ? 3 : 2 }}
                eventHandlers={{ click: (e) => handleMarkerClick(loc.userId, e) }}
              >
                <Tooltip direction="top" offset={[0, -10]} permanent className="username-label">
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{loc.username}</span>
                </Tooltip>
                <Popup>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                    <strong>{loc.username}</strong><br />
                    {t('map.phone')} {loc.phone || t('map.phoneNotSet')}<br />
                    {t('map.lastLocation')} {new Date(loc.last_location_at || loc.timestamp).toLocaleString()}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Direction arrows */}
          {filteredLocations.map((loc) => {
            if (loc.prevLatitude == null || loc.prevLongitude == null) return null;
            const angle = bearing(loc.prevLatitude, loc.prevLongitude, loc.latitude, loc.longitude);
            return <Marker key={`arrow-${loc.userId}`} position={[loc.latitude, loc.longitude]} icon={makeArrowIcon(angle)} interactive={false} />;
          })}

          {/* Checked-in employee markers */}
          {filteredAttendanceEmployees.map((emp) => {
            const loc = filteredLocations.find(l => l.userId === emp.employee_id);
            if (!loc) return null;
            return (
              <CircleMarker
                key={`att-${emp.employee_id}`}
                center={[loc.latitude, loc.longitude]}
                radius={14}
                pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.3, weight: 2, dashArray: '4 2' }}
              >
                <Popup>
                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>✅ {emp.employee_name}</strong> (checked-in)<br />
                    Since: {new Date(emp.check_in_at).toLocaleString()}<br />
                    {emp.phone && <>Phone: {emp.phone}</>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Stats panel for selected users */}
      {selectedArr.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {selectedArr.map((uid, idx) => {
            const user = filteredLocations.find(l => l.userId === uid);
            const pts = histories[uid] ?? [];
            const color = TRAIL_COLORS[idx % TRAIL_COLORS.length];
            const stats = computeStats(pts);
            return (
              <div key={uid} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 220, borderLeft: `4px solid ${color}` }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.95rem' }}>{user?.username ?? `User ${uid}`}</div>
                <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
                  • {pts.length} {t('map.points')}<br />
                  • {t('map.maxSpeed')} {stats.maxSpeedKmh} km/h<br />
                  • {t('map.distance')} {stats.distanceKm} km<br />
                  • {t('map.screenOn')} {stats.screenOnMin} min
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Name modal for geofence zone */}
      <GeofenceNameModal geofence={geofence} />
    </div>
  );
}
