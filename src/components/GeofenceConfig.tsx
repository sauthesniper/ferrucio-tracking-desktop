import React, { useState, useEffect, useCallback } from 'react';
import { Rectangle, useMapEvents } from 'react-leaflet';
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
  created_at: string;
}

const RECT_STYLE = { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 };
const RECT_HOVER_STYLE = { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2 };
const DRAWING_STYLE = { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.3, weight: 2, dashArray: '6 4' };

export default function GeofenceConfig() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rects, setRects] = useState<GreenZoneRect[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [firstCorner, setFirstCorner] = useState<{ lat: number; lng: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleAddRect = useCallback(async (north_lat: number, south_lat: number, west_lng: number, east_lng: number) => {
    try {
      await api.post('/api/geofence/rects', { north_lat, south_lat, west_lng, east_lng });
      showMessage(t('map.rectAdded'), 'success');
      fetchRects();
    } catch (err: any) {
      showMessage(err?.response?.data?.error || t('common.error'), 'error');
    }
  }, [fetchRects, showMessage, t]);

  const handleDeleteRect = useCallback(async (id: number) => {
    if (!window.confirm(t('map.confirmDelete'))) return;
    try {
      await api.delete(`/api/geofence/rects/${id}`);
      showMessage(t('map.rectDeleted'), 'success');
      fetchRects();
    } catch (err: any) {
      showMessage(err?.response?.data?.error || t('common.error'), 'error');
    }
  }, [fetchRects, showMessage, t]);

  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (!isAdmin || !isDrawing) return;

      if (!firstCorner) {
        setFirstCorner({ lat: e.latlng.lat, lng: e.latlng.lng });
        setPreviewRect(null);
      } else {
        const second = { lat: e.latlng.lat, lng: e.latlng.lng };
        const north_lat = Math.max(firstCorner.lat, second.lat);
        const south_lat = Math.min(firstCorner.lat, second.lat);
        const east_lng = Math.max(firstCorner.lng, second.lng);
        const west_lng = Math.min(firstCorner.lng, second.lng);

        handleAddRect(north_lat, south_lat, west_lng, east_lng);
        setFirstCorner(null);
        setPreviewRect(null);
        setIsDrawing(false);
      }
    },
    mousemove(e: LeafletMouseEvent) {
      if (!isAdmin || !isDrawing || !firstCorner) return;
      setPreviewRect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  const toggleDrawing = useCallback(() => {
    setIsDrawing((prev) => !prev);
    setFirstCorner(null);
    setPreviewRect(null);
  }, []);

  // Compute preview bounds
  const previewBounds = firstCorner && previewRect
    ? [
        [Math.min(firstCorner.lat, previewRect.lat), Math.min(firstCorner.lng, previewRect.lng)] as [number, number],
        [Math.max(firstCorner.lat, previewRect.lat), Math.max(firstCorner.lng, previewRect.lng)] as [number, number],
      ]
    : null;

  return (
    <>
      {/* Render existing rectangles */}
      {rects.map((rect) => (
        <Rectangle
          key={rect.id}
          bounds={[
            [rect.south_lat, rect.west_lng],
            [rect.north_lat, rect.east_lng],
          ]}
          pathOptions={RECT_STYLE}
          eventHandlers={
            isAdmin
              ? {
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    if (!isDrawing) handleDeleteRect(rect.id);
                  },
                  mouseover: (e) => {
                    if (!isDrawing) (e.target as any).setStyle(RECT_HOVER_STYLE);
                  },
                  mouseout: (e) => {
                    (e.target as any).setStyle(RECT_STYLE);
                  },
                }
              : undefined
          }
        />
      ))}

      {/* Preview rectangle while drawing */}
      {previewBounds && (
        <Rectangle bounds={previewBounds} pathOptions={DRAWING_STYLE} />
      )}

      {/* UI overlay for controls and messages */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {/* No zone message */}
        {rects.length === 0 && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.85rem',
              pointerEvents: 'auto',
            }}
          >
            ⚠ {t('map.noZone')}
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', pointerEvents: 'auto' }}>
            <button
              onClick={toggleDrawing}
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                background: isDrawing ? '#dc2626' : '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {isDrawing ? '✕ ' + t('common.cancel') : '+ ' + t('map.addRect')}
            </button>
            {isDrawing && (
              <div
                style={{
                  background: '#dbeafe',
                  border: '1px solid #3b82f6',
                  color: '#1e40af',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  maxWidth: 260,
                }}
              >
                {t('map.drawInstructions')}
              </div>
            )}
          </div>
        )}

        {/* Success/error message */}
        {message && (
          <div
            style={{
              background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
              border: `1px solid ${message.type === 'success' ? '#22c55e' : '#fecaca'}`,
              color: message.type === 'success' ? '#166534' : '#dc2626',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.85rem',
              pointerEvents: 'auto',
            }}
          >
            {message.text}
          </div>
        )}
      </div>
    </>
  );
}
