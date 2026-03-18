import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, QrCode, RefreshCw, Search, Unplug } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type AssistantConnection = {
  id: string;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'error';
  qrCode: string;
  phoneNumber: string;
  displayName: string;
  lastError: string;
  lastSeenAt: string | null;
};

type GroupBinding = {
  id: string;
  groupJid: string;
  groupName: string;
  partnerId: string;
  isActive: boolean;
  notifyOnStatusUpdates: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};

type AssistantResponse = {
  connection: AssistantConnection | null;
  groups: GroupBinding[];
  partners: Array<{ id: string; name: string }>;
  metrics?: {
    mappedGroups?: number;
    activeMappedGroups?: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
type WhatsAppRealtimeEvent = {
  companyId: string;
  connectionId?: string;
  type: 'connection' | 'groups' | 'inbound';
};

const WhatsAppAssistantPage = () => {
  const { t } = useTranslation();
  const authUser = useAuthStore((state) => state.user);
  const { showToast } = useUIStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [connection, setConnection] = useState<AssistantConnection | null>(null);
  const [groups, setGroups] = useState<GroupBinding[]>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [mappedGroupsCount, setMappedGroupsCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        if (search.trim()) params.set('search', search.trim());
        const response = await fetch(`/api/dashboard/whatsapp/assistant?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as AssistantResponse & { error?: string; code?: string };
        if (!response.ok) {
          showToast(getLocalizedApiError(t, data, response.status), 'error');
          return;
        }
        setConnection(data?.connection || null);
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
        setPartners(Array.isArray(data?.partners) ? data.partners : []);
        setMappedGroupsCount(Number(data?.metrics?.mappedGroups || 0));
        setPagination({
          page: Number(data?.pagination?.page || 1),
          pageSize: Number(data?.pagination?.pageSize || pageSize),
          total: Number(data?.pagination?.total || 0),
          totalPages: Number(data?.pagination?.totalPages || 1),
        });
      } catch {
        showToast(t('errors.network'), 'error');
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [page, pageSize, search, showToast, t]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        socket.on('whatsapp:updated', (event: WhatsAppRealtimeEvent) => {
          if (event?.companyId && authUser?.companyId && event.companyId !== authUser.companyId) return;
          void loadData({ silent: true });
        });
      } catch {
        // ignore realtime errors
      }
    };

    void setupRealtime();

    const fallbackTimer = setInterval(() => {
      void loadData({ silent: true });
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(fallbackTimer);
      if (socket) socket.disconnect();
    };
  }, [authUser?.companyId, loadData]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/dashboard/whatsapp/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      showToast(t('dashboard.whatsappAssistant.connectionStarted'), 'success');
      await loadData();
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/dashboard/whatsapp/assistant', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      showToast(t('dashboard.whatsappAssistant.disconnected'), 'success');
      await loadData();
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const syncGroups = async () => {
    setIsSyncingGroups(true);
    try {
      const response = await fetch('/api/dashboard/whatsapp/assistant/groups', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      showToast(t('dashboard.whatsappAssistant.groupSyncStarted'), 'success');
      await loadData();
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSyncingGroups(false);
    }
  };

  const updateBinding = async (binding: GroupBinding, patch: Partial<GroupBinding>) => {
    try {
      const response = await fetch('/api/dashboard/whatsapp/assistant/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bindingId: binding.id,
          partnerId: patch.partnerId ?? binding.partnerId,
          isActive: patch.isActive ?? binding.isActive,
          notifyOnStatusUpdates: patch.notifyOnStatusUpdates ?? binding.notifyOnStatusUpdates,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setGroups((prev) => prev.map((row) => (row.id === binding.id ? { ...row, ...patch } : row)));
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.whatsappAssistant.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.whatsappAssistant.subtitle')}</p>
      </div>

      <div className="glass-card p-6 grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border p-4 bg-card/70">
          <p className="text-xs text-muted-foreground">{t('dashboard.whatsappAssistant.connectionStatus')}</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {t(`dashboard.whatsappAssistant.status.${connection?.status || 'disconnected'}`)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{connection?.phoneNumber || '-'}</p>
        </div>
        <div className="rounded-xl border border-border p-4 bg-card/70">
          <p className="text-xs text-muted-foreground">{t('dashboard.whatsappAssistant.groupsMapped')}</p>
          <p className="text-lg font-semibold text-foreground mt-1">{mappedGroupsCount}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('dashboard.whatsappAssistant.totalGroups', { count: pagination.total })}</p>
        </div>
        <div className="rounded-xl border border-border p-4 bg-card/70">
          <p className="text-xs text-muted-foreground">{t('dashboard.whatsappAssistant.lastSeen')}</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {connection?.lastSeenAt ? new Date(connection.lastSeenAt).toLocaleString() : '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{connection?.lastError || '-'}</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="btn-primary gap-2" onClick={connect} disabled={isConnecting}>
            <Link2 className="w-4 h-4" />
            {isConnecting ? t('common.loading') : t('dashboard.whatsappAssistant.connect')}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={disconnect} disabled={isDisconnecting}>
            <Unplug className="w-4 h-4" />
            {isDisconnecting ? t('common.loading') : t('dashboard.whatsappAssistant.disconnect')}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={syncGroups} disabled={isSyncingGroups}>
            <RefreshCw className={`w-4 h-4 ${isSyncingGroups ? 'animate-spin' : ''}`} />
            {t('dashboard.whatsappAssistant.syncGroups')}
          </Button>
        </div>

        {connection?.status === 'qr' && connection?.qrCode ? (
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <p className="text-sm text-muted-foreground mb-3">{t('dashboard.whatsappAssistant.scanQrHelp')}</p>
            <div className="grid md:grid-cols-[auto,1fr] gap-6 items-center">
              <div className="bg-white rounded-lg p-4 inline-flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="WhatsApp QR"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(connection.qrCode)}`}
                  className="w-56 h-56 object-contain"
                />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">
                  {t('dashboard.whatsappAssistant.scanQrStepsTitle')}
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t('dashboard.whatsappAssistant.scanQrSteps.0')}</li>
                  <li>{t('dashboard.whatsappAssistant.scanQrSteps.1')}</li>
                  <li>{t('dashboard.whatsappAssistant.scanQrSteps.2')}</li>
                  <li>{t('dashboard.whatsappAssistant.scanQrSteps.3')}</li>
                </ol>
                <p className="text-xs text-muted-foreground">{t('dashboard.whatsappAssistant.scanQrHint')}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.whatsappAssistant.groupBindings')}</h2>
          <QrCode className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input-glass pl-10 w-full"
              value={searchInput}
              placeholder={t('dashboard.whatsappAssistant.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            {t('common.search')}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{group.groupName || group.groupJid}</p>
                  <p className="text-xs text-muted-foreground">{group.groupJid}</p>
                </div>
                <Switch checked={group.isActive} onCheckedChange={(checked) => updateBinding(group, { isActive: checked })} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('dashboard.whatsappAssistant.partner')}</label>
                  <select
                    className="input-glass w-full"
                    value={group.partnerId || ''}
                    onChange={(event) => updateBinding(group, { partnerId: event.target.value })}
                    disabled={!group.isActive}
                  >
                    <option value="">{t('dashboard.whatsappAssistant.unmapped')}</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={group.notifyOnStatusUpdates}
                      onCheckedChange={(checked) => updateBinding(group, { notifyOnStatusUpdates: checked })}
                      disabled={!group.isActive}
                    />
                    {t('dashboard.whatsappAssistant.notifyStatus')}
                  </label>
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 && !isLoading ? <p className="text-sm text-muted-foreground">{t('dashboard.whatsappAssistant.noGroups')}</p> : null}
        </div>

        <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {t('dashboard.whatsappAssistant.pagination.summary', {
              from: pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0,
              to: pagination.total ? Math.min(pagination.total, pagination.page * pagination.pageSize) : 0,
              total: pagination.total,
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
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.page <= 1}>
              {t('dashboard.whatsappAssistant.pagination.previous')}
            </Button>
            <span className="text-xs text-muted-foreground min-w-[92px] text-center">
              {t('dashboard.whatsappAssistant.pagination.page', {
                page: pagination.page,
                totalPages: pagination.totalPages,
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => value + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              {t('dashboard.whatsappAssistant.pagination.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAssistantPage;
