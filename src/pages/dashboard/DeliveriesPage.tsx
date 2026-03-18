import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  MoreVertical,
  MapPin,
  Phone,
  MessageCircle,
  Package,
  Calendar,
  Truck,
  Banknote,
  Save,
  Trash2,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';
import { cn } from '@/lib/utils';
import { canManage } from '@/lib/auth/access';

type DeliveryStatus = 'pending' | 'assigned' | 'pickedUp' | 'inTransit' | 'delivered' | 'failed' | 'cancelled';

type DeliveryCard = {
  id: string;
  partnerId: string;
  partnerName: string;
  driverId: string;
  driverName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhoodId: string;
  deliveryDate: string;
  orderValue: number;
  collectFromCustomer: boolean;
  deliveryFee: number;
  partnerExtraCharge: number;
  cancellationReason?: string;
  cancellationNote?: string;
  rescheduledDate?: string | null;
  accountingDate?: string | null;
  notes: string;
  status: DeliveryStatus;
  logs?: Array<{ id: string; action: string; message: string; actorId: string; actorName: string; createdAt: string }>;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; total: number }>;
};

type PartnerItem = {
  id: string;
  name: string;
  pricing?: {
    type?: 'fixed' | 'package' | 'percentage' | 'zone';
    fixedAmount?: number;
    percentageValue?: number;
    zoneId?: string;
  };
};

type ProductItem = {
  id: string;
  name: string;
  price: number;
  partnerId?: string;
};

type DriverItem = { id: string; firstName: string; lastName: string; role: string; isActive: boolean };

type NeighborhoodItem = { id: string; name: string; address?: string };

type DeliveryFormItem = { productId: string; quantity: number };

type DeliveryForm = {
  partnerId: string;
  driverId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhoodId: string;
  deliveryDate: string;
  orderValue: number;
  collectFromCustomer: boolean;
  deliveryFee: number;
  partnerExtraCharge: number;
  notes: string;
  items: DeliveryFormItem[];
};
type InsufficientStockItem = { productId: string; productName: string; requested: number; available: number };

type SearchableOption = {
  value: string;
  label: string;
};
type DeliveryRealtimeEvent = {
  companyId: string;
  deliveryId?: string;
  type: 'created' | 'updated' | 'deleted' | 'accepted';
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const tomorrowIso = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const isSameDay = (left?: string | Date | null, right?: string | Date | null) => {
  if (!left || !right) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false;
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};
const CANCELLATION_REASONS = [
  'no_response',
  'postponed_later',
  'not_satisfied',
  'phone_off',
  'will_call_back',
  'call_rejected',
  'already_delivered',
  'afternoon',
  'evening',
  'cancelled_by_customer',
  'already_delivered_other_driver',
  'item_unavailable',
  'awaiting_payment',
  'other',
] as const;
type CancellationReason = (typeof CANCELLATION_REASONS)[number];

const normalizePhone = (value: string) => value.replace(/[^\d]/g, '');

const DEFAULT_FORM: DeliveryForm = {
  partnerId: '',
  driverId: '',
  customerName: '',
  customerPhone: '',
  address: '',
  neighborhoodId: '',
  deliveryDate: todayIso(),
  orderValue: 0,
  collectFromCustomer: true,
  deliveryFee: 0,
  partnerExtraCharge: 0,
  notes: '',
  items: [{ productId: '', quantity: 1 }],
};

const SearchableSelect = ({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  onChange,
  emptyOptionLabel,
  disabled = false,
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  onChange: (next: string) => void;
  emptyOptionLabel?: string;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between input-glass border-white/10 bg-transparent hover:bg-white/5',
            !selected && 'text-white/50'
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-60 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border-border">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {emptyOptionLabel ? (
              <CommandItem
                value={emptyOptionLabel}
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === '' ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{emptyOptionLabel}</span>
              </CommandItem>
            ) : null}
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const DeliveriesPage = () => {
  const { t, i18n } = useTranslation();
  const authUser = useAuthStore((state) => state.user);
  const { showToast } = useUIStore();
  const isDriverUser = authUser?.role === 'driver';
  const currentUserId = authUser?.id || '';
  const canManageDeliveries = canManage(authUser?.role, 'manageDeliveries');

  const [deliveries, setDeliveries] = useState<DeliveryCard[]>([]);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [zoneNeighborhoodsByZone, setZoneNeighborhoodsByZone] = useState<Record<string, NeighborhoodItem[]>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOrderValueManual, setIsOrderValueManual] = useState(false);
  const [isEditOrderValueManual, setIsEditOrderValueManual] = useState(false);
  const [isDeliveryFeeManual, setIsDeliveryFeeManual] = useState(false);
  const [isEditDeliveryFeeManual, setIsEditDeliveryFeeManual] = useState(false);

  const [form, setForm] = useState<DeliveryForm>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<DeliveryForm>(DEFAULT_FORM);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryCard | null>(null);
  const [viewDelivery, setViewDelivery] = useState<DeliveryCard | null>(null);
  const [deleteDelivery, setDeleteDelivery] = useState<DeliveryCard | null>(null);
  const [cancelDelivery, setCancelDelivery] = useState<DeliveryCard | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | ''>('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelRescheduledDate, setCancelRescheduledDate] = useState(tomorrowIso());
  const [createStockErrors, setCreateStockErrors] = useState<InsufficientStockItem[]>([]);
  const [companyDeliveryPricing, setCompanyDeliveryPricing] = useState<{
    currency?: string;
    zone?: { zones?: Array<{ id: string; amount: number; neighborhoods?: Array<{ id: string }> }> };
  } | null>(null);
  const [companyCurrency, setCompanyCurrency] = useState('XAF');

  const loadMeta = useCallback(async () => {
    try {
      const [partnersRes, productsRes, usersRes, settingsRes] = await Promise.all([
        fetch('/api/dashboard/partners?page=1&pageSize=100', { cache: 'no-store' }),
        fetch('/api/dashboard/inventory/products?page=1&pageSize=100', { cache: 'no-store' }),
        fetch('/api/dashboard/users?page=1&pageSize=100', { cache: 'no-store' }),
        fetch('/api/dashboard/settings/company', { cache: 'no-store' }),
      ]);

      const [partnersData, productsData, usersData, settingsData] = await Promise.all([
        partnersRes.json(),
        productsRes.json(),
        usersRes.json(),
        settingsRes.json(),
      ]);

      if (partnersRes.ok) setPartners(Array.isArray(partnersData?.partners) ? partnersData.partners : []);
      if (productsRes.ok) setProducts(Array.isArray(productsData?.products) ? productsData.products : []);
      if (usersRes.ok) {
        const allUsers = Array.isArray(usersData?.users) ? usersData.users : [];
        setDrivers(allUsers.filter((user: DriverItem) => user.role === 'driver' && user.isActive));
      }
      if (settingsRes.ok) {
        setCompanyDeliveryPricing(settingsData?.company?.deliveryPricing || null);
        const incomingCurrency = String(settingsData?.company?.deliveryPricing?.currency || '').trim().toUpperCase();
        setCompanyCurrency(incomingCurrency || 'XAF');
        const zones = settingsData?.company?.deliveryPricing?.zone?.zones || [];
        const nextMap: Record<string, NeighborhoodItem[]> = {};
        for (const zone of zones) {
          if (zone?.id) nextMap[zone.id] = Array.isArray(zone.neighborhoods) ? zone.neighborhoods : [];
        }
        setZoneNeighborhoodsByZone(nextMap);
      }
    } catch {
      // silent: each section has fallback behavior
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const response = await fetch(`/api/dashboard/deliveries?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, page, pageSize, searchQuery, showToast, statusFilter, t]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries, refreshTick]);

  useEffect(() => {
    if (!authUser?.companyId) return;
    let socket: Socket | null = null;
    let isMounted = true;

    const setup = async () => {
      try {
        await fetch('/api/socket', { cache: 'no-store' });
        if (!isMounted) return;
        socket = io({
          path: '/api/socket_io',
          transports: ['websocket', 'polling'],
        });
        socket.on('deliveries:updated', (event: DeliveryRealtimeEvent) => {
          if (!event?.companyId || event.companyId !== authUser.companyId) return;
          setRefreshTick((value) => value + 1);
        });
      } catch {
        // no-op: page still works with manual refreshes and local actions
      }
    };

    void setup();

    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [authUser?.companyId]);

  const formatMoney = (value: number) => {
    const currency = (companyCurrency || 'XAF').toUpperCase();
    try {
      return new Intl.NumberFormat(i18n.language || 'fr', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value || 0);
    } catch {
      return new Intl.NumberFormat(i18n.language || 'fr', {
        style: 'currency',
        currency: 'XAF',
        maximumFractionDigits: 0,
      }).format(value || 0);
    }
  };

  const handleCopyId = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        showToast(t('common.copied'), 'success');
      } catch {
        showToast(t('errors.network'), 'error');
      }
    },
    [showToast, t]
  );

  const statusBadgeClass = (status: DeliveryStatus) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500/20 text-green-400';
      case 'inTransit':
        return 'bg-blue-500/20 text-blue-400';
      case 'pickedUp':
        return 'bg-purple-500/20 text-purple-400';
      case 'assigned':
        return 'bg-orange-500/20 text-orange-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-white/10 text-white/60';
    }
  };

  const selectedPartner = useMemo(() => partners.find((partner) => partner.id === form.partnerId) || null, [form.partnerId, partners]);
  const selectedZoneId = selectedPartner?.pricing?.type === 'zone' ? selectedPartner?.pricing?.zoneId || '' : '';
  const zoneNeighborhoods = selectedZoneId ? zoneNeighborhoodsByZone[selectedZoneId] || [] : [];
  const editSelectedPartner = useMemo(
    () => partners.find((partner) => partner.id === editForm.partnerId) || null,
    [editForm.partnerId, partners]
  );
  const editSelectedZoneId = editSelectedPartner?.pricing?.type === 'zone' ? editSelectedPartner?.pricing?.zoneId || '' : '';
  const editZoneNeighborhoods = editSelectedZoneId ? zoneNeighborhoodsByZone[editSelectedZoneId] || [] : [];

  const formItemsWithProduct = useMemo(
    () =>
      form.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const unitPrice = Number(product?.price || 0);
        return { ...item, productName: product?.name || '', unitPrice, total: unitPrice * item.quantity };
      }),
    [form.items, products]
  );
  const computedOrderValue = formItemsWithProduct.reduce((sum, item) => sum + item.total, 0);
  const editItemsWithProduct = useMemo(
    () =>
      editForm.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const unitPrice = Number(product?.price || 0);
        return { ...item, productName: product?.name || '', unitPrice, total: unitPrice * item.quantity };
      }),
    [editForm.items, products]
  );
  const computedEditOrderValue = editItemsWithProduct.reduce((sum, item) => sum + item.total, 0);

  const partnerProducts = useMemo(
    () => products.filter((product) => !form.partnerId || product.partnerId === form.partnerId),
    [form.partnerId, products]
  );
  const editPartnerProducts = useMemo(
    () => products.filter((product) => !editForm.partnerId || product.partnerId === editForm.partnerId),
    [editForm.partnerId, products]
  );
  const partnerOptions = useMemo(() => partners.map((partner) => ({ value: partner.id, label: partner.name })), [partners]);
  const driverOptions = useMemo(
    () => drivers.map((driver) => ({ value: driver.id, label: `${driver.firstName} ${driver.lastName}`.trim() })),
    [drivers]
  );
  const partnerProductOptions = useMemo(
    () => partnerProducts.map((product) => ({ value: product.id, label: product.name })),
    [partnerProducts]
  );
  const editPartnerProductOptions = useMemo(
    () => editPartnerProducts.map((product) => ({ value: product.id, label: product.name })),
    [editPartnerProducts]
  );
  const neighborhoodOptions = useMemo(
    () => zoneNeighborhoods.map((item) => ({ value: item.id, label: item.name })),
    [zoneNeighborhoods]
  );
  const editNeighborhoodOptions = useMemo(
    () => editZoneNeighborhoods.map((item) => ({ value: item.id, label: item.name })),
    [editZoneNeighborhoods]
  );

  const computeAutoDeliveryFee = useCallback(
    (partnerId: string, orderValue: number, neighborhoodId: string) => {
      if (!partnerId) return 0;
      const partner = partners.find((item) => item.id === partnerId);
      if (!partner?.pricing) return 0;
      const pricingType = partner.pricing.type || 'fixed';
      if (pricingType === 'percentage') {
        const percent = Number(partner.pricing.percentageValue || 0);
        return Math.max(0, (Math.max(0, Number(orderValue || 0)) * percent) / 100);
      }
      if (pricingType === 'zone') {
        const zoneId = partner.pricing.zoneId || '';
        if (zoneId && neighborhoodId) {
          const zone = companyDeliveryPricing?.zone?.zones?.find((candidate) => candidate.id === zoneId);
          const hasNeighborhood = zone?.neighborhoods?.some((candidate) => candidate.id === neighborhoodId);
          if (hasNeighborhood) return Math.max(0, Number(zone?.amount || 0));
        }
      }
      return Math.max(0, Number(partner.pricing.fixedAmount || 0));
    },
    [companyDeliveryPricing?.zone?.zones, partners]
  );

  useEffect(() => {
    if (isOrderValueManual) return;
    setForm((prev) => {
      if (Math.abs(prev.orderValue - computedOrderValue) < 0.0001) return prev;
      return { ...prev, orderValue: computedOrderValue };
    });
  }, [computedOrderValue, isOrderValueManual]);

  useEffect(() => {
    if (isEditOrderValueManual) return;
    setEditForm((prev) => {
      if (Math.abs(prev.orderValue - computedEditOrderValue) < 0.0001) return prev;
      return { ...prev, orderValue: computedEditOrderValue };
    });
  }, [computedEditOrderValue, isEditOrderValueManual]);

  useEffect(() => {
    if (isDeliveryFeeManual) return;
    const nextFee = computeAutoDeliveryFee(form.partnerId, form.orderValue > 0 ? form.orderValue : computedOrderValue, form.neighborhoodId);
    setForm((prev) => {
      if (Math.abs(prev.deliveryFee - nextFee) < 0.0001) return prev;
      return { ...prev, deliveryFee: nextFee };
    });
  }, [computeAutoDeliveryFee, computedOrderValue, form.neighborhoodId, form.orderValue, form.partnerId, isDeliveryFeeManual]);

  useEffect(() => {
    if (isEditDeliveryFeeManual) return;
    const nextFee = computeAutoDeliveryFee(
      editForm.partnerId,
      editForm.orderValue > 0 ? editForm.orderValue : computedEditOrderValue,
      editForm.neighborhoodId
    );
    setEditForm((prev) => {
      if (Math.abs(prev.deliveryFee - nextFee) < 0.0001) return prev;
      return { ...prev, deliveryFee: nextFee };
    });
  }, [
    computeAutoDeliveryFee,
    computedEditOrderValue,
    editForm.neighborhoodId,
    editForm.orderValue,
    editForm.partnerId,
    isEditDeliveryFeeManual,
  ]);

  const updateFormItem = (index: number, patch: Partial<DeliveryFormItem>) => {
    setCreateStockErrors([]);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  };

  const addItemRow = () => {
    setCreateStockErrors([]);
    setForm((prev) => ({ ...prev, items: [...prev.items, { productId: '', quantity: 1 }] }));
  };

  const removeItemRow = (index: number) => {
    setCreateStockErrors([]);
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const updateEditItem = (index: number, patch: Partial<DeliveryFormItem>) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  };

  const addEditItemRow = () => {
    setEditForm((prev) => ({ ...prev, items: [...prev.items, { productId: '', quantity: 1 }] }));
  };

  const removeEditItemRow = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateDelivery = async () => {
    setCreateStockErrors([]);
    const payloadItems = form.items.filter((item) => item.productId);
    if (!form.partnerId || !form.customerPhone.trim() || payloadItems.length === 0) {
      showToast(t('dashboard.deliveries.validation.required'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboard/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: form.partnerId,
          driverId: form.driverId,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          address: form.address,
          neighborhoodId: form.neighborhoodId,
          deliveryDate: form.deliveryDate,
          orderValue: form.orderValue > 0 ? form.orderValue : computedOrderValue,
          collectFromCustomer: form.collectFromCustomer,
          deliveryFee: form.deliveryFee,
          partnerExtraCharge: form.partnerExtraCharge,
          notes: form.notes,
          items: payloadItems,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.code === 'INSUFFICIENT_STOCK' && Array.isArray(data?.insufficientItems)) {
          setCreateStockErrors(data.insufficientItems as InsufficientStockItem[]);
        }
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsCreateDialogOpen(false);
      setForm(DEFAULT_FORM);
      setCreateStockErrors([]);
      setIsOrderValueManual(false);
      setIsDeliveryFeeManual(false);
      showToast(t('common.saved'), 'success');
      setPage(1);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (delivery: DeliveryCard) => {
    const deliveryItems = Array.isArray(delivery.items) ? delivery.items : [];
    const deliveryItemsTotal = deliveryItems.reduce((sum, item) => sum + Number(item?.total || 0), 0);
    setSelectedDelivery(delivery);
    setEditForm({
      partnerId: delivery.partnerId,
      driverId: delivery.driverId || '',
      customerName: delivery.customerName,
      customerPhone: delivery.customerPhone,
      address: delivery.address,
      neighborhoodId: delivery.neighborhoodId || '',
      deliveryDate: String(delivery.deliveryDate).slice(0, 10),
      orderValue: delivery.orderValue || 0,
      collectFromCustomer: delivery.collectFromCustomer !== false,
      deliveryFee: delivery.deliveryFee,
      partnerExtraCharge: delivery.partnerExtraCharge,
      notes: delivery.notes || '',
      items: deliveryItems
        ? deliveryItems.map((item) => ({ productId: item.productId, quantity: item.quantity }))
        : [],
    });
    setIsEditOrderValueManual(Math.abs((delivery.orderValue || 0) - deliveryItemsTotal) > 0.0001);
    setIsEditDeliveryFeeManual(false);
    setIsEditDialogOpen(true);
  };

  const handleUpdateDelivery = async () => {
    if (!selectedDelivery) return;
    const payloadItems = editForm.items.filter((item) => item.productId);
      if (
      !editForm.customerPhone.trim() ||
        (!editForm.address.trim() && !editForm.neighborhoodId) ||
        payloadItems.length === 0
    ) {
      showToast(t('dashboard.deliveries.validation.required'), 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/dashboard/deliveries/${selectedDelivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: editForm.partnerId,
          customerName: editForm.customerName,
          customerPhone: editForm.customerPhone,
          address: editForm.address,
          neighborhoodId: editForm.neighborhoodId,
          deliveryDate: editForm.deliveryDate,
          items: payloadItems,
          orderValue: editForm.orderValue > 0 ? editForm.orderValue : computedEditOrderValue,
          collectFromCustomer: editForm.collectFromCustomer,
          driverId: editForm.driverId,
          deliveryFee: editForm.deliveryFee,
          partnerExtraCharge: editForm.partnerExtraCharge,
          notes: editForm.notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsEditDialogOpen(false);
      setSelectedDelivery(null);
      setIsEditOrderValueManual(false);
      setIsEditDeliveryFeeManual(false);
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (delivery: DeliveryCard, status: DeliveryStatus) => {
    try {
      const response = await fetch(`/api/dashboard/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  const handleDeleteDelivery = async () => {
    if (!deleteDelivery) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/deliveries/${deleteDelivery.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeleteDelivery(null);
      showToast(t('common.delete'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCancelDialog = (delivery: DeliveryCard) => {
    setCancelDelivery(delivery);
    setCancelReason('');
    setCancelNote('');
    setCancelRescheduledDate(tomorrowIso());
  };

  const handleCancelDelivery = async () => {
    if (!cancelDelivery) return;
    if (!cancelReason) {
      showToast(t('dashboard.deliveries.cancel.validation.reasonRequired'), 'error');
      return;
    }
    if (cancelReason === 'postponed_later' && !cancelRescheduledDate) {
      showToast(t('dashboard.deliveries.cancel.validation.rescheduledDateRequired'), 'error');
      return;
    }
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/dashboard/deliveries/${cancelDelivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancellationReason: cancelReason,
          cancellationNote: cancelNote,
          rescheduledDate: cancelReason === 'postponed_later' ? cancelRescheduledDate : '',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setCancelDelivery(null);
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const getLogMessage = (log: { action: string; message: string }) => {
    if (log.action === 'status_changed') {
      const match = /from\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+)/i.exec(log.message || '');
      if (match?.[1] && match?.[2]) {
        return t('dashboard.deliveries.logs.statusChangedTemplate', {
          from: t(`dashboard.deliveries.status.${match[1]}`),
          to: t(`dashboard.deliveries.status.${match[2]}`),
        });
      }
    }
    if (log.action === 'created') return t('dashboard.deliveries.logs.messages.created');
    if (log.action === 'updated') return t('dashboard.deliveries.logs.messages.updated');
    if (log.action === 'assignment_updated') return t('dashboard.deliveries.logs.messages.assignmentUpdated');
    if (log.action === 'cancelled') {
      const reasonMatch = /reason=([^;]*)/.exec(log.message || '');
      const dateMatch = /rescheduledDate=([^;]*)/.exec(log.message || '');
      const noteMatch = /note=(.*)$/.exec(log.message || '');
      const reason = (reasonMatch?.[1] || '').trim();
      const dateValue = (dateMatch?.[1] || '').trim();
      const note = (noteMatch?.[1] || '').trim();
      const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString(i18n.language || 'fr') : '-';
      return t('dashboard.deliveries.logs.messages.cancelled', {
        reason: t(`dashboard.deliveries.cancel.reasons.${reason || 'other'}`),
        date: dateLabel,
        note: note || '-',
      });
    }
    return log.message || '-';
  };

  const getCancellationFromLogs = (delivery: DeliveryCard | null) => {
    const logs = delivery?.logs || [];
    const cancelledLog = logs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find((log) => log.action === 'cancelled');
    if (!cancelledLog) return { reason: '', note: '', date: '' };
    const reasonMatch = /reason=([^;]*)/.exec(cancelledLog.message || '');
    const dateMatch = /rescheduledDate=([^;]*)/.exec(cancelledLog.message || '');
    const noteMatch = /note=(.*)$/.exec(cancelledLog.message || '');
    return {
      reason: (reasonMatch?.[1] || '').trim(),
      date: (dateMatch?.[1] || '').trim(),
      note: (noteMatch?.[1] || '').trim(),
    };
  };

  const openViewDialog = async (delivery: DeliveryCard) => {
    setIsViewDialogOpen(true);
    setIsViewLoading(true);
    setViewDelivery(delivery);
    try {
      const response = await fetch(`/api/dashboard/deliveries/${delivery.id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      if (data?.delivery) setViewDelivery(data.delivery);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsViewLoading(false);
    }
  };

  const cancellationFallback = getCancellationFromLogs(viewDelivery);
  const getDriverWorkflowActions = (delivery: DeliveryCard) => {
    if (!isDriverUser || !currentUserId) return [] as Array<{ key: string; label: string; tone?: 'danger'; onClick: () => void }>;
    const isAssignedToCurrentDriver = delivery.driverId === currentUserId;
    const isUnassigned = !delivery.driverId;
    const deliveryDate = new Date(delivery.deliveryDate);
    const now = new Date();
    const isDeliveryToday =
      !Number.isNaN(deliveryDate.getTime()) &&
      deliveryDate.getFullYear() === now.getFullYear() &&
      deliveryDate.getMonth() === now.getMonth() &&
      deliveryDate.getDate() === now.getDate();

    if (delivery.status === 'pending' && isUnassigned) {
      return [
        {
          key: 'accept',
          label: t('dashboard.deliveries.actions.accept'),
          onClick: () => void handleUpdateStatus(delivery, 'assigned'),
        },
      ];
    }

    if (delivery.status === 'assigned' && isAssignedToCurrentDriver) {
      return [
        {
          key: 'start',
          label: t('dashboard.deliveries.actions.start'),
          onClick: () => void handleUpdateStatus(delivery, 'inTransit'),
        },
        {
          key: 'cancel',
          label: t('dashboard.deliveries.actions.cancel'),
          tone: 'danger',
          onClick: () => openCancelDialog(delivery),
        },
      ];
    }

    if (delivery.status === 'inTransit' && isAssignedToCurrentDriver) {
      return [
        {
          key: 'deliver',
          label: t('dashboard.deliveries.actions.complete'),
          onClick: () => void handleUpdateStatus(delivery, 'delivered'),
        },
        {
          key: 'cancel',
          label: t('dashboard.deliveries.actions.cancel'),
          tone: 'danger',
          onClick: () => openCancelDialog(delivery),
        },
      ];
    }

    if (delivery.status === 'cancelled' && isAssignedToCurrentDriver && isDeliveryToday) {
      return [
        {
          key: 'resume',
          label: t('dashboard.deliveries.actions.resume'),
          onClick: () => void handleUpdateStatus(delivery, 'inTransit'),
        },
      ];
    }

    return [] as Array<{ key: string; label: string; tone?: 'danger'; onClick: () => void }>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.deliveries.title')}</h1>
          <p className="text-white/50">{t('dashboard.deliveries.subtitle')}</p>
        </div>
        {!isDriverUser && canManageDeliveries ? (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" />
              {t('dashboard.deliveries.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.deliveries.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.partner')}</label>
                  <SearchableSelect
                    value={form.partnerId}
                    options={partnerOptions}
                    placeholder={t('dashboard.deliveries.placeholders.partner')}
                    searchPlaceholder={t('common.search')}
                    emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                    onChange={(partnerId) => {
                      setIsOrderValueManual(false);
                      setIsDeliveryFeeManual(false);
                      setCreateStockErrors([]);
                      setForm((prev) => ({
                        ...prev,
                        partnerId,
                        neighborhoodId: '',
                        address: '',
                        items: [{ productId: '', quantity: 1 }],
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.driver')}</label>
                  <SearchableSelect
                    value={form.driverId}
                    options={driverOptions}
                    placeholder={t('dashboard.deliveries.placeholders.driverOptional')}
                    searchPlaceholder={t('common.search')}
                    emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                    emptyOptionLabel={t('dashboard.deliveries.placeholders.driverOptional')}
                    onChange={(driverId) => setForm((prev) => ({ ...prev, driverId }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.customerName')}</label>
                  <input
                    type="text"
                    className="input-glass h-10"
                    placeholder={t('dashboard.deliveries.placeholders.customerName')}
                    value={form.customerName}
                    onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.customerPhone')}</label>
                  <PhoneInput
                    international
                    defaultCountry="CM"
                    value={form.customerPhone}
                    onChange={(value) => setForm((prev) => ({ ...prev, customerPhone: value || '' }))}
                    placeholder={t('dashboard.deliveries.placeholders.customerPhone')}
                    className="input-glass h-10"
                    numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.deliveryDate')}</label>
                  <input
                    type="date"
                    className="input-glass h-10"
                    value={form.deliveryDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                  />
                </div>
                {selectedZoneId ? (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.neighborhood')}</label>
                    <SearchableSelect
                      value={form.neighborhoodId}
                      options={neighborhoodOptions}
                      placeholder={t('dashboard.deliveries.placeholders.neighborhoodOptional')}
                      searchPlaceholder={t('common.search')}
                      emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                      emptyOptionLabel={t('dashboard.deliveries.placeholders.neighborhoodOptional')}
                      onChange={(nextNeighborhoodId) => {
                        const neighborhood = zoneNeighborhoods.find((item) => item.id === nextNeighborhoodId);
                        setIsDeliveryFeeManual(false);
                        setForm((prev) => ({
                          ...prev,
                          neighborhoodId: nextNeighborhoodId,
                          address: neighborhood?.address || neighborhood?.name || prev.address,
                        }));
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.address')}</label>
                    <input
                      type="text"
                      className="input-glass h-10"
                      placeholder={t('dashboard.deliveries.placeholders.address')}
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {selectedZoneId && (
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.address')}</label>
                  <input
                    type="text"
                    className="input-glass h-10"
                    placeholder={t('dashboard.deliveries.placeholders.address')}
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm text-white/70 font-medium">{t('dashboard.deliveries.fields.items')}</div>
                {form.items.map((item, index) => (
                  <div key={`${index}-${item.productId}`} className="grid md:grid-cols-[1fr_140px_auto] gap-3">
                    <SearchableSelect
                      value={item.productId}
                      options={partnerProductOptions}
                      placeholder={t('dashboard.deliveries.placeholders.product')}
                      searchPlaceholder={t('common.search')}
                      emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                      onChange={(productId) => updateFormItem(index, { productId })}
                      disabled={!form.partnerId}
                    />
                    <input
                      type="number"
                      min={1}
                      className="input-glass h-10"
                      value={item.quantity}
                      onChange={(e) => updateFormItem(index, { quantity: Number(e.target.value || 1) })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      onClick={() => removeItemRow(index)}
                      disabled={form.items.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={addItemRow}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dashboard.deliveries.addItem')}
                </Button>
                {createStockErrors.length > 0 ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 space-y-1">
                    <div className="font-medium">{t('dashboard.deliveries.validation.outOfStockTitle')}</div>
                    {createStockErrors.map((item) => (
                      <div key={`${item.productId}-${item.requested}-${item.available}`}>
                        {t('dashboard.deliveries.validation.outOfStockItem', {
                          product: item.productName,
                          requested: item.requested,
                          available: item.available,
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.orderValue')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input-glass h-10"
                    value={form.orderValue}
                    placeholder={String(computedOrderValue)}
                    onChange={(e) => {
                      setIsOrderValueManual(true);
                      setForm((prev) => ({ ...prev, orderValue: Number(e.target.value || 0) }));
                    }}
                  />
                  <p className="text-xs text-white/50">{t('dashboard.deliveries.orderValueAutoHint')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.deliveryFee')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input-glass h-10"
                    value={form.deliveryFee}
                    onChange={(e) => {
                      setIsDeliveryFeeManual(true);
                      setForm((prev) => ({ ...prev, deliveryFee: Number(e.target.value || 0) }));
                    }}
                  />
                  <p className="text-xs text-white/50">{t('dashboard.deliveries.deliveryFeeAutoHint')}</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white">{t('dashboard.deliveries.fields.collectFromCustomer')}</p>
                  <p className="text-xs text-white/60">{t('dashboard.deliveries.collectFromCustomerHint')}</p>
                </div>
                <Switch
                  checked={form.collectFromCustomer}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, collectFromCustomer: checked }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.partnerExtraCharge')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-glass h-10"
                  value={form.partnerExtraCharge}
                  onChange={(e) => setForm((prev) => ({ ...prev, partnerExtraCharge: Number(e.target.value || 0) }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.notes')}</label>
                <textarea
                  className="input-glass h-20 resize-none"
                  placeholder={t('dashboard.deliveries.placeholders.notes')}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button className="w-full btn-primary gap-2" onClick={handleCreateDelivery} disabled={isCreating}>
                <Save className="w-4 h-4" />
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {!isDriverUser ? (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.deliveries.edit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.partner')}</label>
                <SearchableSelect
                  value={editForm.partnerId}
                  options={partnerOptions}
                  placeholder={t('dashboard.deliveries.placeholders.partner')}
                  searchPlaceholder={t('common.search')}
                  emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                  onChange={(partnerId) => {
                    setIsEditOrderValueManual(false);
                    setIsEditDeliveryFeeManual(false);
                    setEditForm((prev) => ({
                      ...prev,
                      partnerId,
                      neighborhoodId: '',
                      address: '',
                      items: [{ productId: '', quantity: 1 }],
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.driver')}</label>
                <SearchableSelect
                  value={editForm.driverId}
                  options={driverOptions}
                  placeholder={t('dashboard.deliveries.placeholders.driverOptional')}
                  searchPlaceholder={t('common.search')}
                  emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                  emptyOptionLabel={t('dashboard.deliveries.placeholders.driverOptional')}
                  onChange={(driverId) => setEditForm((prev) => ({ ...prev, driverId }))}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.customerName')}</label>
                <input
                  type="text"
                  className="input-glass h-10"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.customerPhone')}</label>
                <PhoneInput
                  international
                  defaultCountry="CM"
                  value={editForm.customerPhone}
                  onChange={(value) => setEditForm((prev) => ({ ...prev, customerPhone: value || '' }))}
                  placeholder={t('dashboard.deliveries.placeholders.customerPhone')}
                  className="input-glass h-10"
                  numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.deliveryDate')}</label>
                <input
                  type="date"
                  className="input-glass h-10"
                  value={editForm.deliveryDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                />
              </div>
              {editSelectedZoneId ? (
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.neighborhood')}</label>
                  <SearchableSelect
                    value={editForm.neighborhoodId}
                    options={editNeighborhoodOptions}
                    placeholder={t('dashboard.deliveries.placeholders.neighborhoodOptional')}
                    searchPlaceholder={t('common.search')}
                    emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                    emptyOptionLabel={t('dashboard.deliveries.placeholders.neighborhoodOptional')}
                    onChange={(neighborhoodId) => {
                      const neighborhood = editZoneNeighborhoods.find((item) => item.id === neighborhoodId);
                      setIsEditDeliveryFeeManual(false);
                      setEditForm((prev) => ({
                        ...prev,
                        neighborhoodId,
                        address: neighborhood?.address || neighborhood?.name || prev.address,
                      }));
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.address')}</label>
                  <input
                    type="text"
                    className="input-glass h-10"
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white/70 font-medium">{t('dashboard.deliveries.fields.items')}</div>
              {editForm.items.map((item, index) => (
                <div key={`${index}-${item.productId}`} className="grid md:grid-cols-[1fr_140px_auto] gap-3">
                  <SearchableSelect
                    value={item.productId}
                    options={editPartnerProductOptions}
                    placeholder={t('dashboard.deliveries.placeholders.product')}
                    searchPlaceholder={t('common.search')}
                    emptyLabel={t('dashboard.deliveries.placeholders.noResult')}
                    onChange={(productId) => updateEditItem(index, { productId })}
                    disabled={!editForm.partnerId}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input-glass h-10"
                    value={item.quantity}
                    onChange={(e) => updateEditItem(index, { quantity: Number(e.target.value || 1) })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                    onClick={() => removeEditItemRow(index)}
                    disabled={editForm.items.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                onClick={addEditItemRow}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.deliveries.addItem')}
              </Button>
            </div>
            {editSelectedZoneId && (
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.address')}</label>
                <input
                  type="text"
                  className="input-glass h-10"
                  value={editForm.address}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.orderValue')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-glass h-10"
                  value={editForm.orderValue}
                  placeholder={String(computedEditOrderValue)}
                  onChange={(e) => {
                    setIsEditOrderValueManual(true);
                    setEditForm((prev) => ({ ...prev, orderValue: Number(e.target.value || 0) }));
                  }}
                />
                <p className="text-xs text-white/50">{t('dashboard.deliveries.orderValueAutoHint')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.deliveryFee')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-glass h-10"
                  value={editForm.deliveryFee}
                  onChange={(e) => {
                    setIsEditDeliveryFeeManual(true);
                    setEditForm((prev) => ({ ...prev, deliveryFee: Number(e.target.value || 0) }));
                  }}
                />
                <p className="text-xs text-white/50">{t('dashboard.deliveries.deliveryFeeAutoHint')}</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white">{t('dashboard.deliveries.fields.collectFromCustomer')}</p>
                <p className="text-xs text-white/60">{t('dashboard.deliveries.collectFromCustomerHint')}</p>
              </div>
              <Switch
                checked={editForm.collectFromCustomer}
                onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, collectFromCustomer: checked }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.partnerExtraCharge')}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input-glass h-10"
                value={editForm.partnerExtraCharge}
                onChange={(e) => setEditForm((prev) => ({ ...prev, partnerExtraCharge: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.deliveries.fields.notes')}</label>
              <textarea
                className="input-glass h-20 resize-none"
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <Button className="w-full btn-primary gap-2" onClick={handleUpdateDelivery} disabled={isUpdating}>
              <Save className="w-4 h-4" />
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.deliveries.details')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details">
            <TabsList className={cn('grid w-full bg-white/5', isDriverUser ? 'grid-cols-1' : 'grid-cols-2')}>
              <TabsTrigger value="details">{t('dashboard.deliveries.tabs.details')}</TabsTrigger>
              {!isDriverUser ? <TabsTrigger value="logs">{t('dashboard.deliveries.tabs.logs')}</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <div className="space-y-3 text-sm text-white/80">
                <div><span className="text-white/50">ID:</span> {viewDelivery?.id}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.partner')}:</span> {viewDelivery?.partnerName || '-'}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.driver')}:</span> {viewDelivery?.driverName || '-'}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.customerName')}:</span> {viewDelivery?.customerName || '-'}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.customerPhone')}:</span> {viewDelivery?.customerPhone}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.address')}:</span> {viewDelivery?.address}</div>
                <div>
                  <span className="text-white/50">{t('dashboard.deliveries.fields.status')}:</span>{' '}
                  {viewDelivery?.status ? t(`dashboard.deliveries.status.${viewDelivery.status}`) : '-'}
                </div>
                {viewDelivery?.status !== 'cancelled' && viewDelivery?.rescheduledDate ? (
                  <div>
                    <span className="text-white/50">{t('dashboard.deliveries.labels.rescheduledTo')}:</span>{' '}
                    {new Date(viewDelivery.rescheduledDate).toLocaleDateString(i18n.language || 'fr')}
                  </div>
                ) : null}
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.orderValue')}:</span> {formatMoney(viewDelivery?.orderValue || 0)}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.deliveryFee')}:</span> {formatMoney(viewDelivery?.deliveryFee || 0)}</div>
                <div><span className="text-white/50">{t('dashboard.deliveries.fields.partnerExtraCharge')}:</span> {formatMoney(viewDelivery?.partnerExtraCharge || 0)}</div>
                {viewDelivery?.status === 'cancelled' ? (
                  <>
                    <div>
                      <span className="text-white/50">{t('dashboard.deliveries.cancel.reason')}:</span>{' '}
                      {(viewDelivery?.cancellationReason || cancellationFallback.reason)
                        ? t(`dashboard.deliveries.cancel.reasons.${viewDelivery?.cancellationReason || cancellationFallback.reason}`)
                        : '-'}
                    </div>
                    {(viewDelivery?.cancellationNote || cancellationFallback.note) ? (
                      <div>
                        <span className="text-white/50">{t('dashboard.deliveries.cancel.note')}:</span>{' '}
                        {viewDelivery?.cancellationNote || cancellationFallback.note}
                      </div>
                    ) : null}
                    {['postponed', 'postponed_later'].includes(String(viewDelivery?.cancellationReason || cancellationFallback.reason || '')) &&
                    (viewDelivery?.rescheduledDate || cancellationFallback.date) ? (
                      <div>
                        <span className="text-white/50">{t('dashboard.deliveries.cancel.rescheduledDate')}:</span>{' '}
                        {new Date(String(viewDelivery?.rescheduledDate || cancellationFallback.date)).toLocaleDateString(i18n.language || 'fr')}
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div>
                  <span className="text-white/50">{t('dashboard.deliveries.fields.collectFromCustomer')}:</span>{' '}
                  {viewDelivery?.collectFromCustomer ? t('common.yes') : t('common.no')}
                </div>
                <div>
                  <span className="text-white/50">{t('dashboard.deliveries.fields.items')}:</span>
                  <div className="mt-1 space-y-1">
                    {(viewDelivery?.items || []).map((item) => (
                      <div key={`${item.productId}-${item.productName}`} className="text-white/80">
                        {item.productName} x{item.quantity}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
            {!isDriverUser ? (
            <TabsContent value="logs" className="mt-4">
              {isViewLoading ? (
                <div className="text-sm text-white/60">{t('common.loading')}</div>
              ) : (viewDelivery?.logs || []).length === 0 ? (
                <div className="text-sm text-white/60">{t('dashboard.deliveries.logs.empty')}</div>
              ) : (
                <div className="space-y-3">
                  {(viewDelivery?.logs || [])
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((log) => (
                      <div key={log.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-sm text-white">{t(`dashboard.deliveries.logs.actions.${log.action}`)}</div>
                        <div className="text-xs text-white/60 mt-1">{getLogMessage(log)}</div>
                        <div className="text-xs text-white/50 mt-1">
                          {log.actorName || log.actorId} - {new Date(log.createdAt).toLocaleString(i18n.language || 'fr')}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
            ) : null}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteDelivery)} onOpenChange={(open) => !open && setDeleteDelivery(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">{t('dashboard.deliveries.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteDelivery}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(cancelDelivery)} onOpenChange={(open) => !open && setCancelDelivery(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.deliveries.cancel.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.deliveries.cancel.reason')}</label>
              <select
                className="input-glass h-10"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as CancellationReason | '')}
              >
                <option value="">{t('dashboard.deliveries.cancel.reasonPlaceholder')}</option>
                {CANCELLATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`dashboard.deliveries.cancel.reasons.${reason}`)}
                  </option>
                ))}
              </select>
            </div>
            {cancelReason === 'postponed_later' ? (
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.deliveries.cancel.rescheduledDate')}</label>
                <input
                  type="date"
                  className="input-glass h-10"
                  value={cancelRescheduledDate}
                  onChange={(e) => setCancelRescheduledDate(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.deliveries.cancel.note')}</label>
              <textarea
                className="input-glass h-20 resize-none"
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder={t('dashboard.deliveries.cancel.notePlaceholder')}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={() => setCancelDelivery(null)}>
                {t('common.cancel')}
              </Button>
              <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleCancelDelivery} disabled={isCancelling}>
                {isCancelling ? t('common.loading') : t('dashboard.deliveries.cancel.confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_180px] gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="input-glass pl-12 w-full"
          />
        </div>
        <select
          className="input-glass"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | DeliveryStatus);
            setPage(1);
          }}
        >
          <option value="all">{t('dashboard.deliveries.filters.allStatuses')}</option>
          <option value="pending">{t('dashboard.deliveries.status.pending')}</option>
          <option value="assigned">{t('dashboard.deliveries.status.assigned')}</option>
          <option value="pickedUp">{t('dashboard.deliveries.status.pickedUp')}</option>
          <option value="inTransit">{t('dashboard.deliveries.status.inTransit')}</option>
          <option value="delivered">{t('dashboard.deliveries.status.delivered')}</option>
          <option value="failed">{t('dashboard.deliveries.status.failed')}</option>
          <option value="cancelled">{t('dashboard.deliveries.status.cancelled')}</option>
        </select>
        <input
          type="date"
          className="input-glass"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          aria-label={t('dashboard.deliveries.filters.dateFrom')}
          title={t('dashboard.deliveries.filters.dateFrom')}
        />
        <input
          type="date"
          className="input-glass"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          aria-label={t('dashboard.deliveries.filters.dateTo')}
          title={t('dashboard.deliveries.filters.dateTo')}
        />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {deliveries.map((delivery) => {
          const driverActions = isDriverUser ? getDriverWorkflowActions(delivery) : [];
          return (
            <div key={delivery.id} className="glass-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 hover:bg-white/10"
                    onClick={() => handleCopyId(delivery.id)}
                    title={t('dashboard.deliveries.card.copyId')}
                  >
                    #{delivery.id}
                  </button>
                </div>
                <div className="text-white font-semibold">{delivery.customerName}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(delivery.status)}`}>
                {t(`dashboard.deliveries.status.${delivery.status}`)}
              </span>
            </div>

            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {delivery.customerPhone}
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {delivery.customerPhone ? (
                  <>
                    <a
                      href={`tel:${normalizePhone(delivery.customerPhone)}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 "
                    >
                      <Phone className="h-3 w-3" />
                      {t('dashboard.deliveries.card.call')}
                    </a>
                    {/* <a
                      href={`https://wa.me/${normalizePhone(delivery.customerPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-700 hover:bg-emerald-400/20"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a> */}
                  </>
                ) : null}
              </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span className="line-clamp-2">{delivery.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                {delivery.partnerName || '-'}
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                {delivery.driverName || t('dashboard.deliveries.unassigned')}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(delivery.deliveryDate).toLocaleDateString(i18n.language || 'fr')}
              </div>
              <div className="text-xs text-white/60 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                {t('dashboard.deliveries.card.amountShort')}: {formatMoney(delivery.orderValue)} | {t('dashboard.deliveries.card.feeShort')}:{' '}
                {formatMoney(delivery.deliveryFee)}
              </div>
              <div className="text-xs text-white/70 space-y-1">
                {(delivery.items || []).slice(0, 2).map((item) => (
                  <div key={`${delivery.id}-${item.productId}`} className="truncate">
                    {item.productName} x{item.quantity}
                  </div>
                ))}
                {(delivery.items || []).length > 2 ? (
                  <div className="text-white/50">+{delivery.items.length - 2}</div>
                ) : null}
              </div>
              {delivery.rescheduledDate &&
              (delivery.status === 'cancelled' || isSameDay(delivery.rescheduledDate, delivery.deliveryDate)) ? (
                <div className="inline-flex items-center rounded-full border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[11px] text-orange-500">
                  {t('dashboard.deliveries.labels.rescheduledTo')} - {new Date(delivery.rescheduledDate).toLocaleDateString(i18n.language || 'fr')}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              {!isDriverUser ? (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => void openViewDialog(delivery)}
                >
                  {t('common.view')}
                </Button>
              ) : (
                <span />
              )}

              {isDriverUser ? (
                <div className="flex flex-nowrap items-center justify-center gap-2 w-full">
                  {driverActions.map((action) => (
                    <Button
                      key={`${delivery.id}-${action.key}`}
                      type="button"
                      variant="ghost"
                      onClick={action.onClick}
                      className={cn(
                        'text-center justify-center whitespace-nowrap border-0',
                        action.key === 'accept' && '!bg-[#86EFAC] hover:!bg-[#86EFAC]',
                        action.key === 'start' && '!bg-[#93C5FD] hover:!bg-[#93C5FD]',
                        action.key === 'deliver' && '!bg-[#6EE7B7] hover:!bg-[#6EE7B7]',
                        action.key === 'resume' && '!bg-[#60A5FA] hover:!bg-[#60A5FA]',
                        action.key === 'cancel' && '!bg-[#FCA5A5] hover:!bg-[#FCA5A5]'
                      )}
                    >
                      <span className="!text-white">{action.label}</span>
                    </Button>
                  ))}
                </div>
              ) : canManageDeliveries ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <>
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEditDialog(delivery)}>
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleUpdateStatus(delivery, 'assigned')}>
                        {t('dashboard.deliveries.status.assigned')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleUpdateStatus(delivery, 'inTransit')}>
                        {t('dashboard.deliveries.status.inTransit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleUpdateStatus(delivery, 'delivered')}>
                        {t('dashboard.deliveries.status.delivered')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-orange-300 hover:bg-orange-500/10" onClick={() => openCancelDialog(delivery)}>
                        {t('dashboard.deliveries.status.cancelled')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-500/10" onClick={() => setDeleteDelivery(delivery)}>
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span />
              )}
            </div>
            </div>
          );
        })}
      </div>

      {!isLoading && deliveries.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50">{t('dashboard.deliveries.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          {t('dashboard.deliveries.pagination.summary', {
            from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, totalItems),
            total: totalItems,
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input-glass py-2 px-3 w-[90px]"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={isLoading || page <= 1}
          >
            {t('dashboard.deliveries.pagination.previous')}
          </Button>
          <div className="text-sm text-white/70 min-w-[90px] text-center">
            {t('dashboard.deliveries.pagination.page', { page, totalPages })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={isLoading || page >= totalPages}
          >
            {t('dashboard.deliveries.pagination.next')}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-white/60">{t('common.loading')}</div>}
    </div>
  );
};

export default DeliveriesPage;
