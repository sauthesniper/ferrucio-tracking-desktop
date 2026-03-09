import { useState, useEffect, useCallback } from 'react';
import { Rectangle, useMapEvents, Tooltip } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';

interface GreenZoneRect {
  id: number;
  north_lat: number;
  south_lat: number;
  west_lng: number;
  east_lng: number;
  name: string | null;
  created_at: string;
}

const RECT_STYLE = { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 };
const RECT_HOVER_STYLE = { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2 };
const DRAWING_STYLE = { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2, dashArray: '6 4' };

export interface GeofenceState {
  rects: GreenZoneRect[];
  isDrawing: boolean;
  showNameModal: boolean;
  rectName: string;
  nameError: string;
  message: { text: string; type: 'success' | 'error' } | null;
  isAdmin: boolean;
}

export interface GeofenceActions {
  startAddFlow: () => void;
  confirmName: () => void;
  cancelDrawing: () => void;
  setRectName: (name: string) => void;
  clearNameError: () => void;
  fetchRects: () => Promise<void>;
}

export function useGeofenceState(): { state: GeofenceState; actions: GeofenceActions } {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rects, setRects] = useState<GreenZoneRect[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [rectName, setRectName] = useState('');
  const [nameError, setNameError] = useState('');

  const fetchRects = useCallback(async () => {
    try {
      const res = await api.get('/api/geofence/rects');
      setRects(res.data.rects || []);
    } catch {
      // silently fail — rects will be empty
    }
  }, []);

  useEffect(() => {
    fetchRects();
  }, [fetchRects]);

  const showMessageFn = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  // Step 1: user clicks "Adaugă" → show modal
  const startAddFlow = useCallback(() => {
    setShowNameModal(true);
    setRectName('');
    setNameError('');
  }, []);

  // Step 2: user confirms name in modal → close modal, start drawing
  const confirmName = useCallback(() => {
    if (!rectName.trim()) {
      setNameError(t('map.rectNameRequired'));
      return;
    }
    setShowNameModal(false);
    setNameError('');
    setIsDrawing(true);
  }, [rectName, t]);

  // Cancel: either from modal or from drawing mode
  const cancelDrawing = useCallback(() => {
    setShowNameModal(false);
    setIsDrawing(false);
    setRectName('');
    setNameError('');
  }, []);

  const clearNameError = useCallback(() => {
    setNameError('');
  }, []);

  return {
    state: { rects, isDrawing, showNameModal, rectName, nameError, message, isAdmin: !!isAdmin },
    actions: { startAddFlow, confirmName, cancelDrawing, setRectName, clearNameError, fetchRects },
    _internal: { showMessageFn, setIsDrawing, setRectName, setNameError, setMessage },
  } as any;
}

/**
 * Map-only elements: rectangles, preview, and click/mousemove handlers.
 * Must be rendered inside <MapContainer>.
 */
export function GeofenceMapElements({ geofence }: { geofence: ReturnType<typeof useGeofenceState> }) {
  const { t } = useTranslation();
  const { state } = geofence;
  const internal = (geofence as any)._internal;

  const [firstCorner, setFirstCorner] = useState<{ lat: number; lng: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<{ lat: number; lng: number } | null>(null);

  const handleAddRect = useCallback(async (north_lat: number, south_lat: number, west_lng: number, east_lng: number, name: string) => {
    try {
      await api.post('/api/geofence/rects', { north_lat, south_lat, west_lng, east_lng, name });
      internal.showMessageFn(t('map.rectAdded'), 'success');
      geofence.actions.fetchRects();
    } catch (err: any) {
      internal.showMessageFn(err?.response?.data?.error || t('common.error'), 'error');
    }
  }, [geofence.actions, internal, t]);

  const handleDeleteRect = useCallback(async (id: number) => {
    if (!window.confirm(t('map.confirmDelete'))) return;
    try {
      await api.delete(`/api/geofence/rects/${id}`);
      internal.showMessageFn(t('map.rectDeleted'), 'success');
      geofence.actions.fetchRects();
    } catch (err: any) {
      internal.showMessageFn(err?.response?.data?.error || t('common.error'), 'error');
    }
  }, [geofence.actions, internal, t]);

  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (!state.isAdmin || !state.isDrawing) return;

      if (!firstCorner) {
        setFirstCorner({ lat: e.latlng.lat, lng: e.latlng.lng });
        setPreviewRect(null);
      } else {
        // Name is already validated via modal — just use it
        const second = { lat: e.latlng.lat, lng: e.latlng.lng };
        const north_lat = Math.max(firstCorner.lat, second.lat);
        const south_lat = Math.min(firstCorner.lat, second.lat);
        const east_lng = Math.max(firstCorner.lng, second.lng);
        const west_lng = Math.min(firstCorner.lng, second.lng);

        handleAddRect(north_lat, south_lat, west_lng, east_lng, state.rectName.trim());
        setFirstCorner(null);
        setPreviewRect(null);
        internal.setIsDrawing(false);
        internal.setRectName('');
      }
    },
    mousemove(e: LeafletMouseEvent) {
      if (!state.isAdmin || !state.isDrawing || !firstCorner) return;
      setPreviewRect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  const previewBounds = firstCorner && previewRect
    ? [
        [Math.min(firstCorner.lat, previewRect.lat), Math.min(firstCorner.lng, previewRect.lng)] as [number, number],
        [Math.max(firstCorner.lat, previewRect.lat), Math.max(firstCorner.lng, previewRect.lng)] as [number, number],
      ]
    : null;

  return (
    <>
      {state.rects.map((rect) => (
        <Rectangle
          key={rect.id}
          bounds={[
            [rect.south_lat, rect.west_lng],
            [rect.north_lat, rect.east_lng],
          ]}
          pathOptions={RECT_STYLE}
          eventHandlers={
            state.isAdmin
              ? {
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    if (!state.isDrawing) handleDeleteRect(rect.id);
                  },
                  mouseover: (e) => {
                    if (!state.isDrawing) (e.target as any).setStyle(RECT_HOVER_STYLE);
                  },
                  mouseout: (e) => {
                    (e.target as any).setStyle(RECT_STYLE);
                  },
                }
              : undefined
          }
        >
          {rect.name && (
            <Tooltip direction="center" permanent className="zone-name-label">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>{rect.name}</span>
            </Tooltip>
          )}
        </Rectangle>
      ))}

      {previewBounds && (
        <Rectangle bounds={previewBounds} pathOptions={DRAWING_STYLE} />
      )}
    </>
  );
}

/**
 * Name input modal — shown before drawing starts.
 */
export function GeofenceNameModal({ geofence }: { geofence: ReturnType<typeof useGeofenceState> }) {
  const { t } = useTranslation();
  const { state, actions } = geofence;

  if (!state.showNameModal) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) actions.cancelDrawing(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px', minWidth: 360,
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', color: '#1e3a5f' }}>
          {t('map.rectNameModalTitle')}
        </h3>
        <input
          type="text"
          value={state.rectName}
          onChange={(e) => {
            actions.setRectName(e.target.value);
            if (state.nameError) actions.clearNameError();
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') actions.confirmName(); }}
          placeholder={t('map.rectNamePlaceholder')}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
            border: `1px solid ${state.nameError ? '#dc2626' : '#d1d5db'}`,
            borderRadius: 8, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {state.nameError && (
          <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: 6 }}>
            {state.nameError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            onClick={actions.cancelDrawing}
            style={{
              padding: '8px 18px', fontSize: '0.85rem', borderRadius: 6,
              border: '1px solid #d1d5db', background: '#fff', color: '#111827', cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={actions.confirmName}
            style={{
              padding: '8px 18px', fontSize: '0.85rem', borderRadius: 6,
              border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer',
            }}
          >
            {t('map.rectNameModalOk')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Toolbar controls rendered OUTSIDE the map container.
 */
export function GeofenceToolbar({ geofence }: { geofence: ReturnType<typeof useGeofenceState> }) {
  const { t } = useTranslation();
  const { state, actions } = geofence;

  if (!state.isAdmin) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {state.isDrawing ? (
        <>
          <button
            onClick={actions.cancelDrawing}
            style={{
              padding: '8px 14px', fontSize: '0.85rem',
              background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            ✕ {t('map.cancelDrawing')}
          </button>
          <span style={{ background: '#dbeafe', border: '1px solid #3b82f6', color: '#1e40af', padding: '6px 12px', borderRadius: 6, fontSize: '0.8rem' }}>
            {t('map.drawInstructions')}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#374151' }}>
            — <strong>{state.rectName}</strong>
          </span>
        </>
      ) : (
        <button
          onClick={actions.startAddFlow}
          style={{
            padding: '8px 14px', fontSize: '0.85rem',
            background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}
        >
          + {t('map.addRect')}
        </button>
      )}
    </div>
  );
}

/**
 * Alert messages rendered OUTSIDE the map container.
 */
export function GeofenceAlerts({ geofence }: { geofence: ReturnType<typeof useGeofenceState> }) {
  const { state } = geofence;

  if (!state.message) return null;

  return (
    <div
      style={{
        background: state.message.type === 'success' ? '#dcfce7' : '#fef2f2',
        border: `1px solid ${state.message.type === 'success' ? '#22c55e' : '#fecaca'}`,
        color: state.message.type === 'success' ? '#166534' : '#dc2626',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: '0.85rem',
      }}
    >
      {state.message.text}
    </div>
  );
}

// Keep backward-compatible default export for any other usage
export default function GeofenceConfig() {
  const geofence = useGeofenceState();
  return (
    <>
      <GeofenceMapElements geofence={geofence} />
      <div
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <GeofenceToolbar geofence={geofence} />
        </div>
        <div style={{ pointerEvents: 'auto' }}>
          <GeofenceAlerts geofence={geofence} />
        </div>
      </div>
      <GeofenceNameModal geofence={geofence} />
    </>
  );
}
