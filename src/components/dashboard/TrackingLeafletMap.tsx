'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  labels: {
    drivers: string;
    deliveries: string;
    routes: string;
    selectedDriver: string;
  };
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

function getTileConfig(isDark: boolean) {
  if (isDark) {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '',
    };
  }
  return {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '',
  };
}

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

const TrackingLeafletMap = ({
  center,
  deliveryPoints,
  driverPoints,
  selectedDriverId,
  onSelectDriver,
  emptyLabel,
  labels,
}: Props) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const deliveryLayerRef = useRef<any>(null);
  const driverLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await ensureLeaflet();
      if (!mounted || !mapNodeRef.current || !window.L || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapNodeRef.current, { zoomControl: false });
      map.setView([center.lat, center.lng], 12);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const tileConfig = getTileConfig(isDark);
      const tile = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      tileLayerRef.current = tile;
      deliveryLayerRef.current = L.layerGroup().addTo(map);
      driverLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
    };

    void init();
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      tileLayerRef.current = null;
      deliveryLayerRef.current = null;
      driverLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [center.lat, center.lng, isDark]);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const tileConfig = getTileConfig(isDark);
    tileLayerRef.current = L.tileLayer(tileConfig.url, { attribution: tileConfig.attribution, maxZoom: 19 }).addTo(map);
  }, [isDark]);
  

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const deliveryLayer = deliveryLayerRef.current;
    const driverLayer = driverLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!deliveryLayer || !driverLayer || !routeLayer) return;

    deliveryLayer.clearLayers();
    driverLayer.clearLayers();
    routeLayer.clearLayers();

    const bounds = L.latLngBounds([]);
    const driverById = new Map(driverPoints.map((driver) => [driver.id, driver]));

    for (const point of deliveryPoints) {
      if (!point.driverId) continue;
      const driver = driverById.get(point.driverId);
      if (!driver) continue;
      const isSelectedDriver = selectedDriverId ? selectedDriverId === driver.id : true;
      if (!isSelectedDriver) continue;
      const color = DELIVERY_COLORS[point.status] || '#64748b';
      L.polyline(
        [
          [driver.lat, driver.lng],
          [point.lat, point.lng],
        ],
        {
          color,
          opacity: 0.55,
          weight: selectedDriverId === driver.id ? 3.5 : 2.5,
          dashArray: '6 8',
        }
      ).addTo(routeLayer);
    }

    for (const point of deliveryPoints) {
      const color = DELIVERY_COLORS[point.status] || '#64748b';
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: 'deliverly-delivery-marker',
          html: `<div style="
            width:20px;
            height:20px;
            border-radius:6px;
            border:2px solid #ffffff;
            background:${color};
            box-shadow:0 6px 16px rgba(0,0,0,.26);
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            font-size:10px;
            font-weight:700;
          ">•</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
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
  const selectedDriver = useMemo(() => driverPoints.find((driver) => driver.id === selectedDriverId) || null, [driverPoints, selectedDriverId]);

  return (
    <div className="relative h-[460px] rounded-xl overflow-hidden border border-border bg-card/60">
      <div ref={mapNodeRef} className="absolute inset-0" />
      {!isDark ? (
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0.13))]" />
      ) : null}
      <div className="absolute top-3 left-3 z-[500] flex flex-wrap gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-background/85 backdrop-blur border border-border text-[11px] text-foreground">
          {labels.drivers}: <span className="font-semibold">{driverPoints.length}</span>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-background/85 backdrop-blur border border-border text-[11px] text-foreground">
          {labels.deliveries}: <span className="font-semibold">{deliveryPoints.length}</span>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-background/85 backdrop-blur border border-border text-[11px] text-foreground">
          {labels.routes}: <span className="font-semibold">{deliveryPoints.filter((point) => Boolean(point.driverId)).length}</span>
        </div>
      </div>
      {selectedDriver ? (
        <div className="absolute top-3 right-3 z-[500] pointer-events-none">
          <div className="px-3 py-2 rounded-lg bg-background/85 backdrop-blur border border-border text-xs text-foreground">
            <span className="text-muted-foreground">{labels.selectedDriver}: </span>
            <span className="font-medium">{selectedDriver.name}</span>
          </div>
        </div>
      ) : null}
      {noPoints ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-lg text-xs text-muted-foreground bg-card/90 border border-border">{emptyLabel}</div>
        </div>
      ) : null}
    </div>
  );
};

export default TrackingLeafletMap;
