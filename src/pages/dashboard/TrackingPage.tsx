import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io, type Socket } from 'socket.io-client';
import { Calendar, Clock3, Navigation, Package, Phone, RefreshCw, Search, Truck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';
import TrackingLeafletMap from '@/components/dashboard/TrackingLeafletMap';

type DeliveryStatus = 'pending' | 'assigned' | 'pickedUp' | 'inTransit' | 'delivered' | 'failed' | 'cancelled';

type TrackingDriver = {
  id: string;
  name: string;
  phone: string;
  vehicleLabel: string;
  isActive: boolean;
  activeDeliveries: number;
  inTransitDeliveries: number;
  status: 'offline' | 'busy' | 'available';
};

type TrackingDelivery = {
  id: string;
  partnerId: string;
  partnerName: string;
  driverId: string;
  driverName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: DeliveryStatus;
  deliveryDate: string;
  orderValue: number;
  deliveryFee: number;
  etaMinutes: number;
  neighborhoodName?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type TrackingResponse = {
  summary: {
    activeDrivers: number;
    busyDrivers: number;
    availableDrivers: number;
    activeDeliveries: number;
    unassignedDeliveries: number;
    avgEtaMinutes: number;
  };
  statusBuckets: Record<string, number>;
  drivers: TrackingDriver[];
  deliveries: TrackingDelivery[];
  filters: {
    drivers: Array<{ id: string; label: string }>;
  };
  map: {
    center: { lat: number; lng: number };
    deliveryPoints: Array<{
      id: string;
      status: string;
      lat: number;
      lng: number;
      label: string;
      driverId: string;
      driverName: string;
    }>;
    driverPoints: Array<{
      id: string;
      name: string;
      status: 'offline' | 'busy' | 'available';
      activeDeliveries: number;
      vehicleType?: string;
      lat: number;
      lng: number;
    }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta: {
    role: string;
  };
};

type DeliveryRealtimeEvent = {
  companyId: string;
  deliveryId?: string;
  type: 'created' | 'updated' | 'deleted' | 'accepted';
};
type DriverLocationRealtimeEvent = {
  companyId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const statusClassName: Record<DeliveryStatus, string> = {
  pending: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  assigned: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  pickedUp: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  inTransit: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  delivered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
  cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const driverClassName: Record<TrackingDriver['status'], string> = {
  offline: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  busy: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  available: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

const TrackingPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const authUser = useAuthStore((state) => state.user);
  const isDriverUser = authUser?.role === 'driver';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | DeliveryStatus>('active');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [data, setData] = useState<TrackingResponse | null>(null);

  const formatMoney = useCallback(
    (value: number) =>
      new Intl.NumberFormat(i18n.language || 'fr', {
        style: 'currency',
        currency: 'XAF',
        maximumFractionDigits: 0,
      }).format(Number(value || 0)),
    [i18n.language]
  );

  const loadTracking = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('status', statusFilter);
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (!isDriverUser && driverFilter) params.set('driverId', driverFilter);

      const response = await fetch(`/api/dashboard/tracking?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setData(payload as TrackingResponse);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateFrom, dateTo, driverFilter, isDriverUser, page, pageSize, searchQuery, showToast, statusFilter, t]);

  useEffect(() => {
    void loadTracking();
  }, [loadTracking, refreshTick]);

  useEffect(() => {
    let socket: Socket | null = null;
    let mounted = true;

    const setupRealtime = async () => {
      try {
        await fetch('/api/socket', { cache: 'no-store' });
        if (!mounted) return;
        socket = io({
          path: '/api/socket_io',
          transports: ['websocket', 'polling'],
        });
        socket.on('deliveries:updated', (_event: DeliveryRealtimeEvent) => {
          setRefreshTick((value) => value + 1);
        });
        socket.on('drivers:location', (_event: DriverLocationRealtimeEvent) => {
          setRefreshTick((value) => value + 1);
        });
      } catch {
        // ignore realtime failures
      }
    };

    void setupRealtime();
    return () => {
      mounted = false;
      if (socket) socket.disconnect();
    };
  }, []);

  const selectedDriver = useMemo(
    () => data?.drivers.find((driver) => driver.id === selectedDriverId) || null,
    [data?.drivers, selectedDriverId]
  );

  const deliveriesByStatus = useMemo(() => {
    const bucket: Record<'pending' | 'assigned' | 'pickedUp' | 'inTransit', TrackingDelivery[]> = {
      pending: [],
      assigned: [],
      pickedUp: [],
      inTransit: [],
    };
    for (const delivery of data?.deliveries || []) {
      if (delivery.status === 'pending') bucket.pending.push(delivery);
      if (delivery.status === 'assigned') bucket.assigned.push(delivery);
      if (delivery.status === 'pickedUp') bucket.pickedUp.push(delivery);
      if (delivery.status === 'inTransit') bucket.inTransit.push(delivery);
    }
    return bucket;
  }, [data?.deliveries]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTick((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('dashboard.tracking.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.tracking.subtitle')}</p>
        </div>
        <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('dashboard.tracking.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <User className="w-4 h-4" />
            {t('dashboard.tracking.kpi.activeDrivers')}
          </div>
          <div className="text-2xl font-semibold text-foreground mt-1">{Number(data?.summary?.activeDrivers || 0).toLocaleString()}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Truck className="w-4 h-4" />
            {t('dashboard.tracking.kpi.busyDrivers')}
          </div>
          <div className="text-2xl font-semibold text-foreground mt-1">{Number(data?.summary?.busyDrivers || 0).toLocaleString()}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Package className="w-4 h-4" />
            {t('dashboard.tracking.kpi.activeDeliveries')}
          </div>
          <div className="text-2xl font-semibold text-foreground mt-1">{Number(data?.summary?.activeDeliveries || 0).toLocaleString()}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Navigation className="w-4 h-4" />
            {t('dashboard.tracking.kpi.unassigned')}
          </div>
          <div className="text-2xl font-semibold text-foreground mt-1">{Number(data?.summary?.unassignedDeliveries || 0).toLocaleString()}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock3 className="w-4 h-4" />
            {t('dashboard.tracking.kpi.avgEta')}
          </div>
          <div className="text-2xl font-semibold text-foreground mt-1">{Number(data?.summary?.avgEtaMinutes || 0)}m</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="relative md:col-span-2 xl:col-span-2">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t('dashboard.tracking.searchPlaceholder')}
            className="input-glass pl-10 w-full"
          />
        </div>
        <div className="xl:col-span-1">
          <select
            className="input-glass w-full"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'active' | 'all' | DeliveryStatus);
              setPage(1);
            }}
          >
            <option value="active">{t('dashboard.tracking.filters.activeOnly')}</option>
            <option value="all">{t('dashboard.tracking.filters.allStatuses')}</option>
            {['pending', 'assigned', 'pickedUp', 'inTransit', 'delivered', 'failed', 'cancelled'].map((status) => (
              <option key={status} value={status}>
                {t(`dashboard.deliveries.status.${status}`)}
              </option>
            ))}
          </select>
        </div>
        {!isDriverUser ? (
          <div className="xl:col-span-1">
            <select
              className="input-glass w-full"
              value={driverFilter}
              onChange={(event) => {
                setDriverFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('dashboard.tracking.filters.allDrivers')}</option>
              {(data?.filters?.drivers || []).map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="relative">
          <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="input-glass pl-10 w-full"
          />
        </div>
        <div className="relative">
          <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="input-glass pl-10 w-full"
          />
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.tracking.liveMap')}</h2>
            <TrackingLeafletMap
              center={data?.map?.center || { lat: 3.848, lng: 11.5021 }}
              deliveryPoints={data?.map?.deliveryPoints || []}
              driverPoints={data?.map?.driverPoints || []}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              emptyLabel={t('dashboard.tracking.mapNoPoints')}
            />
          </div>
          <div className="glass-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.tracking.boardTitle')}</h2>
            <span className="text-xs text-muted-foreground">
              {(data?.pagination?.total || 0).toLocaleString(i18n.language || 'fr')} {t('dashboard.tracking.total')}
            </span>
          </div>
          {isLoading ? <div className="text-muted-foreground">{t('common.loading')}</div> : null}
          {!isLoading && !data?.deliveries?.length ? <div className="text-muted-foreground">{t('dashboard.tracking.empty')}</div> : null}
          {data?.deliveries?.length ? (
            <div className="grid lg:grid-cols-2 gap-3">
              {data.deliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">#{delivery.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{delivery.partnerName}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClassName[delivery.status]}`}>
                      {t(`dashboard.deliveries.status.${delivery.status}`)}
                    </span>
                  </div>
                  <div className="text-sm text-foreground font-medium">{delivery.customerName || t('dashboard.tracking.noCustomer')}</div>
                  <div className="text-xs text-muted-foreground truncate">{delivery.address}</div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {delivery.customerPhone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      {delivery.driverName || t('dashboard.tracking.unassignedLabel')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {delivery.etaMinutes > 0 ? `${delivery.etaMinutes}m` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('dashboard.tracking.orderShort')}</span>
                    <span className="text-foreground font-semibold">{formatMoney(delivery.orderValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">
              {t('dashboard.tracking.pagination.summary', {
                from: data?.pagination?.total ? (data.pagination.page - 1) * data.pagination.pageSize + 1 : 0,
                to: data?.pagination?.total ? Math.min(data.pagination.total, data.pagination.page * data.pagination.pageSize) : 0,
                total: data?.pagination?.total || 0,
              })}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="input-glass h-9 px-3 text-sm w-[84px]"
              >
                {[6, 12, 24].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={(data?.pagination?.page || 1) <= 1}>
                {t('dashboard.tracking.pagination.previous')}
              </Button>
              <span className="text-xs text-muted-foreground min-w-[92px] text-center">
                {t('dashboard.tracking.pagination.page', {
                  page: data?.pagination?.page || 1,
                  totalPages: data?.pagination?.totalPages || 1,
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => value + 1)}
                disabled={(data?.pagination?.page || 1) >= (data?.pagination?.totalPages || 1)}
              >
                {t('dashboard.tracking.pagination.next')}
              </Button>
            </div>
          </div>
          </div>
        </div>

        <div className="glass-card p-4 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.tracking.driversTitle')}</h2>
          <div className="space-y-2 max-h-[440px] overflow-auto pr-1 custom-scrollbar">
            {(data?.drivers || []).map((driver) => (
              <button
                key={driver.id}
                type="button"
                className={`w-full text-left rounded-xl border p-3 transition ${
                  selectedDriverId === driver.id ? 'border-orange-400/50 bg-orange-500/10' : 'border-border bg-card/70 hover:bg-accent/50'
                }`}
                onClick={() => setSelectedDriverId(driver.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{driver.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${driverClassName[driver.status]}`}>
                    {t(`dashboard.tracking.driverStatus.${driver.status}`)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{driver.phone || '-'}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('dashboard.tracking.activeMissions')}</span>
                  <span className="text-foreground font-semibold">{driver.activeDeliveries}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedDriver ? (
            <div className="rounded-xl border border-border bg-card/70 p-3 space-y-2">
              <h3 className="font-medium text-foreground">{t('dashboard.tracking.driverDetails')}</h3>
              <div className="text-sm text-foreground">{selectedDriver.name}</div>
              <div className="text-xs text-muted-foreground">{selectedDriver.vehicleLabel || '-'}</div>
              <div className="text-xs text-muted-foreground">{selectedDriver.phone || '-'}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="rounded-lg bg-background/60 p-2">
                  <div className="text-muted-foreground">{t('dashboard.tracking.activeMissions')}</div>
                  <div className="text-foreground font-semibold">{selectedDriver.activeDeliveries}</div>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <div className="text-muted-foreground">{t('dashboard.tracking.inTransit')}</div>
                  <div className="text-foreground font-semibold">{selectedDriver.inTransitDeliveries}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(['pending', 'assigned', 'pickedUp', 'inTransit'] as const).map((statusKey) => (
          <div key={statusKey} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t(`dashboard.deliveries.status.${statusKey}`)}</h3>
              <span className="text-xs text-muted-foreground">{deliveriesByStatus[statusKey].length}</span>
            </div>
            <div className="space-y-2 max-h-52 overflow-auto pr-1 custom-scrollbar">
              {deliveriesByStatus[statusKey].slice(0, 8).map((delivery) => (
                <div key={delivery.id} className="rounded-lg border border-border bg-card/70 p-2">
                  <div className="text-xs text-foreground font-medium">#{delivery.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground truncate">{delivery.address}</div>
                </div>
              ))}
              {deliveriesByStatus[statusKey].length === 0 ? (
                <div className="text-xs text-muted-foreground">{t('dashboard.tracking.noItem')}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrackingPage;
