'use client';

import { useEffect, useRef } from 'react';

type MapDeliveryPoint = {
  id: string;
  status: string;
  lat: number;
  lng: number;
  label: string;
  driverId: string;
  driverName: string;
};

type MapDriverPoint = {
  id: string;
  name: string;
  status: 'offline' | 'busy' | 'available';
  activeDeliveries: number;
  vehicleType?: string;
  lat: number;
  lng: number;
};

type Props = {
  center: { lat: number; lng: number };
  deliveryPoints: MapDeliveryPoint[];
  driverPoints: MapDriverPoint[];
  selectedDriverId?: string;
  onSelectDriver?: (driverId: string) => void;
  emptyLabel: string;
};

declare global {
  interface Window {
    L: any;
  }
}

const DELIVERY_COLORS: Record<string, string> = {
  pending: '#64748b',
  assigned: '#3b82f6',
  pickedUp: '#8b5cf6',
  inTransit: '#f97316',
  delivered: '#10b981',
  failed: '#ef4444',
  cancelled: '#f43f5e',
};

function getVehicleEmoji(vehicleType?: string) {
  switch (String(vehicleType || '').toLowerCase()) {
    case 'bicycle':
      return '🚲';
    case 'motorcycle':
      return '🛵';
    case 'car':
      return '🚗';
    case 'van':
      return '🚐';
    case 'truck':
      return '🚚';
    default:
      return '📍';
  }
}

let leafletLoader: Promise<void> | null = null;

function ensureLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise<void>((resolve, reject) => {
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'leaflet-js-cdn';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Leaflet script failed')));
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet script failed'));
    document.body.appendChild(script);
  });

  return leafletLoader;
}

const TrackingLeafletMap = ({ center, deliveryPoints, driverPoints, selectedDriverId, onSelectDriver, emptyLabel }: Props) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const deliveryLayerRef = useRef<any>(null);
  const driverLayerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await ensureLeaflet();
      if (!mounted || !mapNodeRef.current || !window.L || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapNodeRef.current, { zoomControl: true });
      map.setView([center.lat, center.lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      deliveryLayerRef.current = L.layerGroup().addTo(map);
      driverLayerRef.current = L.layerGroup().addTo(map);
    };

    void init();
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      deliveryLayerRef.current = null;
      driverLayerRef.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const deliveryLayer = deliveryLayerRef.current;
    const driverLayer = driverLayerRef.current;
    if (!deliveryLayer || !driverLayer) return;

    deliveryLayer.clearLayers();
    driverLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    for (const point of deliveryPoints) {
      const color = DELIVERY_COLORS[point.status] || '#64748b';
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
      });
      marker.bindPopup(`<strong>#${point.id.slice(0, 8)}</strong><br/>${point.label}`);
      marker.addTo(deliveryLayer);
      bounds.extend([point.lat, point.lng]);
    }

    for (const point of driverPoints) {
      const color = point.status === 'busy' ? '#f97316' : point.status === 'available' ? '#10b981' : '#64748b';
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: 'deliverly-driver-marker',
          html: `<div style="
            width:${selectedDriverId === point.id ? 34 : 30}px;
            height:${selectedDriverId === point.id ? 34 : 30}px;
            border-radius:9999px;
            border:${selectedDriverId === point.id ? 3 : 2}px solid ${color};
            background:#ffffff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:16px;
            box-shadow:0 6px 14px rgba(0,0,0,.2);
          ">${getVehicleEmoji(point.vehicleType)}</div>`,
          iconSize: [selectedDriverId === point.id ? 34 : 30, selectedDriverId === point.id ? 34 : 30],
          iconAnchor: [selectedDriverId === point.id ? 17 : 15, selectedDriverId === point.id ? 17 : 15],
        }),
      });
      marker.bindPopup(`<strong>${point.name}</strong><br/>${point.activeDeliveries} delivery(ies)`);
      marker.on('click', () => onSelectDriver?.(point.id));
      marker.addTo(driverLayer);
      bounds.extend([point.lat, point.lng]);
    }

    if (selectedDriverId) {
      const selected = driverPoints.find((driver) => driver.id === selectedDriverId);
      if (selected) {
        map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 13), { animate: true });
        return;
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    } else {
      map.setView([center.lat, center.lng], 12);
    }
  }, [center.lat, center.lng, deliveryPoints, driverPoints, onSelectDriver, selectedDriverId]);

  const noPoints = deliveryPoints.length === 0 && driverPoints.length === 0;

  return (
    <div className="relative h-[460px] rounded-xl overflow-hidden border border-border bg-card/60">
      <div ref={mapNodeRef} className="absolute inset-0" />
      {noPoints ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-lg text-xs text-muted-foreground bg-card/90 border border-border">{emptyLabel}</div>
        </div>
      ) : null}
    </div>
  );
};

export default TrackingLeafletMap;
