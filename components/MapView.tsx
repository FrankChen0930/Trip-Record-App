'use client';

import { useEffect, useRef, useState } from 'react';

interface MapPin {
  lat: number;
  lng: number;
  label: string;
  time?: string;
}

interface RawMapItem {
  location: string;
  mapUrl?: string;
  time?: string;
}

interface MapViewProps {
  items: RawMapItem[];
  isExpanded: boolean;
  onToggle: () => void;
}

// 從 Google Maps URL 中提取經緯度
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

// 用 Nominatim 免費 API 從地名查座標
async function geocodeLocation(name: string): Promise<{ lat: number; lng: number } | null> {
  // 清除 emoji 和特殊字元
  const cleanName = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  if (!cleanName || cleanName.length < 2) return null;

  // 跳過移動/交通類項目
  if (/^(騎車|開車|搭|移動|轉乘|步行|走路|出發|抵達|回程|回家)/.test(cleanName)) return null;

  try {
    const query = encodeURIComponent(cleanName);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=tw`,
      { headers: { 'Accept-Language': 'zh-TW' } }
    );
    const data = await resp.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng) };
    }
  } catch {
    // 忽略 geocoding 錯誤
  }
  return null;
}

export default function MapView({ items, isExpanded, onToggle }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocodedCount, setGeocodedCount] = useState(0);

  // 解析座標（先試 URL，再試 geocoding）
  useEffect(() => {
    if (!isExpanded || items.length === 0) return;

    let cancelled = false;
    const resolve = async () => {
      setLoading(true);
      setGeocodedCount(0);
      const results: MapPin[] = [];

      for (const item of items) {
        if (cancelled) break;

        // 先從 URL 提取
        let coords = item.mapUrl ? extractCoordsFromUrl(item.mapUrl) : null;

        // 若 URL 沒有座標（短網址等），用地名 geocode
        if (!coords) {
          coords = await geocodeLocation(item.location);
          if (coords) setGeocodedCount(prev => prev + 1);
        }

        if (coords) {
          results.push({ lat: coords.lat, lng: coords.lng, label: item.location, time: item.time });
        }
      }

      if (!cancelled) {
        setPins(results);
        setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [isExpanded, items]);

  // 渲染地圖
  useEffect(() => {
    if (!isExpanded || pins.length === 0 || !mapRef.current || loading) return;

    const loadMap = async () => {
      const L = (await import('leaflet')).default;

      // Inject CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        await new Promise(r => setTimeout(r, 200)); // wait for CSS
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'map-pin-custom',
        html: `<div style="width:28px;height:28px;background:#1e293b;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);color:white;font-size:10px;font-weight:900;">📍</div></div>`,
        iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
      });

      const startIcon = L.divIcon({
        className: 'map-pin-custom',
        html: `<div style="width:32px;height:32px;background:#2563eb;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 12px rgba(37,99,235,0.4);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);color:white;font-size:12px;font-weight:900;">🚩</div></div>`,
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
      });

      const bounds = L.latLngBounds([]);

      pins.forEach((pin, i) => {
        const icon = i === 0 ? startIcon : pinIcon;
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
        marker.bindPopup(`<div style="font-family:system-ui;padding:4px;"><b style="font-size:13px;">${i + 1}. ${pin.label}</b>${pin.time ? `<br><span style="font-size:11px;color:#666;">⏰ ${pin.time}</span>` : ''}</div>`);
        bounds.extend([pin.lat, pin.lng]);
      });

      if (pins.length > 1) {
        L.polyline(pins.map(p => [p.lat, p.lng] as [number, number]), {
          color: '#2563eb', weight: 2, opacity: 0.5, dashArray: '8, 8'
        }).addTo(map);
      }

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      mapInstanceRef.current = map;
    };

    const timer = setTimeout(loadMap, 150);
    return () => clearTimeout(timer);
  }, [isExpanded, pins, loading]);

  useEffect(() => {
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all font-bold text-sm ${
          isExpanded ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2">
          <span>🗺️</span>
          <span>地圖檢視</span>
          {pins.length > 0 && !loading && (
            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${isExpanded ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
              {pins.length} 個地點
            </span>
          )}
        </div>
        <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isExpanded && (
        <div className="mt-3 bg-white rounded-[2rem] shadow-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <span className="text-3xl block mb-2 animate-bounce">🗺️</span>
              <p className="text-sm text-gray-400 font-medium animate-pulse">正在定位行程地點...</p>
              {geocodedCount > 0 && <p className="text-[10px] text-gray-300 mt-1">已找到 {geocodedCount} 個地點</p>}
            </div>
          ) : pins.length === 0 ? (
            <div className="p-8 text-center">
              <span className="text-3xl block mb-2">📍</span>
              <p className="text-sm text-gray-400 font-medium">無法定位今天的行程地點</p>
              <p className="text-[10px] text-gray-300 mt-1">嘗試在行程方塊加入完整的 Google Maps 連結</p>
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-[300px] md:h-[400px]" style={{ background: '#f1f5f9' }} />
          )}
        </div>
      )}
    </div>
  );
}
