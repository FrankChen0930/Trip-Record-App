'use client';

import { useEffect, useRef, useState } from 'react';

interface MapPin {
  lat: number;
  lng: number;
  label: string;
  time?: string;
}

interface MapViewProps {
  pins: MapPin[];
  isExpanded: boolean;
  onToggle: () => void;
}

// 從 Google Maps URL 中提取經緯度
export function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;

  // 格式: https://maps.google.com/?q=24.123,120.456
  // 格式: https://www.google.com/maps/place/.../@24.123,120.456,...
  // 格式: https://goo.gl/maps/xxx (短網址無法解析)
  // 格式: https://maps.app.goo.gl/xxx (短網址無法解析)

  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,           // @24.123,120.456
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,       // ?q=24.123,120.456
    /place\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/,   // place/.../24.123,120.456
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,           // ll=24.123,120.456
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }
  return null;
}

export default function MapView({ pins, isExpanded, onToggle }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!isExpanded || pins.length === 0 || !mapRef.current) return;

    // 動態載入 Leaflet (避免 SSR 問題)
    const loadMap = async () => {
      const L = (await import('leaflet')).default;

      // Inject Leaflet CSS via link tag (avoids TS module resolution for CSS)
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 清除舊地圖
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
      });

      // OpenStreetMap 圖磚
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      // Zoom 控制放右下
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 自訂圖釘圖標
      const pinIcon = L.divIcon({
        className: 'map-pin-custom',
        html: `<div style="
          width: 28px; height: 28px;
          background: #1e293b;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        "><div style="transform: rotate(45deg); color: white; font-size: 10px; font-weight: 900;">📍</div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      const activePinIcon = L.divIcon({
        className: 'map-pin-custom',
        html: `<div style="
          width: 32px; height: 32px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 12px rgba(37,99,235,0.4);
          display: flex; align-items: center; justify-content: center;
        "><div style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: 900;">📍</div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const bounds = L.latLngBounds([]);

      pins.forEach((pin, i) => {
        const icon = i === 0 ? activePinIcon : pinIcon;
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: system-ui; padding: 4px;">
            <b style="font-size: 13px;">${pin.label}</b>
            ${pin.time ? `<br><span style="font-size: 11px; color: #666;">${pin.time}</span>` : ''}
          </div>
        `);
        bounds.extend([pin.lat, pin.lng]);
      });

      // 畫連線
      if (pins.length > 1) {
        const polyline = L.polyline(
          pins.map(p => [p.lat, p.lng] as [number, number]),
          { color: '#2563eb', weight: 2, opacity: 0.5, dashArray: '8, 8' }
        ).addTo(map);
      }

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      mapInstanceRef.current = map;
      setMapReady(true);
    };

    // 延遲載入確保容器尺寸正確
    const timer = setTimeout(loadMap, 100);
    return () => {
      clearTimeout(timer);
    };
  }, [isExpanded, pins]);

  // 清理
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const validPinCount = pins.length;

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all font-bold text-sm ${
          isExpanded
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2">
          <span>🗺️</span>
          <span>地圖檢視</span>
          {validPinCount > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${isExpanded ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
              {validPinCount} 個地點
            </span>
          )}
        </div>
        <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isExpanded && (
        <div className="mt-3 bg-white rounded-[2rem] shadow-lg border border-gray-100 overflow-hidden">
          {validPinCount === 0 ? (
            <div className="p-8 text-center">
              <span className="text-3xl block mb-2">📍</span>
              <p className="text-sm text-gray-400 font-medium">今天的行程還沒有地圖連結</p>
              <p className="text-[10px] text-gray-300 mt-1">在行程方塊中加入 Google Maps 連結即可顯示地圖</p>
            </div>
          ) : (
            <div
              ref={mapRef}
              className="w-full h-[300px] md:h-[400px]"
              style={{ background: '#f1f5f9' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
