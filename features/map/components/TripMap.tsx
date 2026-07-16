'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet 底層封裝：頁面一律透過 next/dynamic({ ssr: false }) 載入本元件。
// 底圖用 CARTO Voyager（免費、明亮、無需金鑰）。

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color?: string;   // marker 底色（預設湖水青）
  number?: number;  // 顯示編號；未給則畫小圓點
  sub?: string;     // popup 副標（時間 / 地址）
  action?: { label: string; onClick: () => void; done?: boolean };
}

interface TripMapProps {
  points: MapPoint[];
  route?: [number, number][];   // 依序連線的座標（當日路線）
  fitKey?: string;              // 值改變時重新 fitBounds 到所有 points
  focus?: { lat: number; lng: number } | null; // 指定時 flyTo
  onViewChange?: (center: { lat: number; lng: number }) => void;
  className?: string;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function markerIcon(color: string, number?: number) {
  const size = number !== undefined ? 28 : 14;
  const label = number !== undefined ? String(number) : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);color:#fff;font-weight:900;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapController({ points, fitKey, focus, onViewChange }: Pick<TripMapProps, 'points' | 'fitKey' | 'focus' | 'onViewChange'>) {
  const lastFit = useRef<string | undefined>(undefined);
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onViewChange?.({ lat: c.lat, lng: c.lng });
    },
  });

  useEffect(() => {
    if (fitKey === undefined || fitKey === lastFit.current || points.length === 0) return;
    lastFit.current = fitKey;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, points, fitKey]);

  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, focus]);

  return null;
}

export default function TripMap({ points, route, fitKey, focus, onViewChange, className }: TripMapProps) {
  return (
    <MapContainer
      center={[23.75, 120.95]}
      zoom={8}
      scrollWheelZoom
      className={className ?? 'w-full h-full'}
      style={{ minHeight: 200 }}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={19} />
      <MapController points={points} fitKey={fitKey} focus={focus} onViewChange={onViewChange} />

      {route && route.length >= 2 && (
        <Polyline positions={route} pathOptions={{ color: '#0F6E56', weight: 4, opacity: 0.75 }} />
      )}

      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={markerIcon(p.color ?? '#1D9E75', p.number)}>
          <Popup>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{p.name}</div>
              {p.sub && <div style={{ fontSize: 11, color: '#6B7C77', marginTop: 2 }}>{p.sub}</div>}
              {p.action && (
                <button
                  onClick={p.action.onClick}
                  disabled={p.action.done}
                  style={{
                    marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 8, border: 'none',
                    background: p.action.done ? '#CDEEE2' : '#1D9E75',
                    color: p.action.done ? '#0F6E56' : '#fff',
                    fontWeight: 700, fontSize: 12, cursor: p.action.done ? 'default' : 'pointer',
                  }}
                >
                  {p.action.done ? '✓ 已加入' : p.action.label}
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
