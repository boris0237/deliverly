import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  MoreVertical,
  Store,
  Phone,
  Mail,
  MapPin,
  Percent,
  Wallet,
  Save,
  Upload,
  Eye,
  Pencil,
} from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import type { Partner, PartnerType } from '@/types';
import { usePartnersStore, useUIStore } from '@/store';
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
import { getLocalizedApiError } from '@/lib/auth/error-message';

type PricingType = 'fixed' | 'package' | 'percentage' | 'zone';

type PricingContext = {
  currency: string;
  activeTypes: PricingType[];
  defaults: {
    fixedAmount: number;
    percentageValue: number;
    packagePlans: Array<{ id: string; name: string; amount: number }>;
    zones: Array<{ id: string; name: string; amount: number }>;
  };
};

type PartnerForm = {
  name: string;
  type: PartnerType;
  email: string;
  address: string;
  pricingType: PricingType;
  useDefaultValue: boolean;
  fixedAmount: number;
  percentageValue: number;
  packagePlanId: string;
  zoneId: string;
};

const DEFAULT_FORM: PartnerForm = {
  name: '',
  type: 'restaurant',
  email: '',
  address: '',
  pricingType: 'fixed',
  useDefaultValue: true,
  fixedAmount: 0,
  percentageValue: 0,
  packagePlanId: '',
  zoneId: '',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  XAF: 'FCFA',
  XOF: 'CFA',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  UGX: 'USh',
  TZS: 'TSh',
  MAD: 'MAD',
  DZD: 'DZD',
  TND: 'TND',
  ZAR: 'R',
  USD: '$',
  EUR: '€',
};

const getCurrencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] || currency;

const buildDefaultFormFromPricing = (context: PricingContext | null): PartnerForm => {
  const nextType = context?.activeTypes?.[0] || 'fixed';
  const nextPackage = context?.defaults?.packagePlans?.[0]?.id || '';
  const nextZone = context?.defaults?.zones?.[0]?.id || '';

  return {
    ...DEFAULT_FORM,
    pricingType: nextType,
    fixedAmount: context?.defaults.fixedAmount || 0,
    percentageValue: context?.defaults.percentageValue || 0,
    packagePlanId: nextPackage,
    zoneId: nextZone,
    useDefaultValue: true,
  };
};

const mapPartnerToEditForm = (partner: Partner, context: PricingContext | null): PartnerForm => ({
  name: partner.name,
  type: partner.type,
  email: partner.email || '',
  address: partner.address || '',
  pricingType: partner.pricing?.type || context?.activeTypes?.[0] || 'fixed',
  useDefaultValue: partner.pricing?.useDefaultValue ?? true,
  fixedAmount: partner.pricing?.fixedAmount ?? context?.defaults.fixedAmount ?? 0,
  percentageValue: partner.pricing?.percentageValue ?? context?.defaults.percentageValue ?? 0,
  packagePlanId: partner.pricing?.packagePlanId || context?.defaults.packagePlans?.[0]?.id || '',
  zoneId: partner.pricing?.zoneId || context?.defaults.zones?.[0]?.id || '',
});

const PartnersPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const { partners, setPartners } = usePartnersStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [pricingContext, setPricingContext] = useState<PricingContext | null>(null);
  const [form, setForm] = useState<PartnerForm>(DEFAULT_FORM);
  const [phoneValue, setPhoneValue] = useState<string | undefined>('');

  const [viewPartner, setViewPartner] = useState<Partner | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState<PartnerForm>(DEFAULT_FORM);
  const [editPhoneValue, setEditPhoneValue] = useState<string | undefined>('');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const editLogoInputRef = useRef<HTMLInputElement | null>(null);
  const didInitPricingRef = useRef(false);

  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreviewUrl, setEditLogoPreviewUrl] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!selectedLogoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedLogoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedLogoFile]);

  useEffect(() => {
    if (!editLogoFile) {
      setEditLogoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(editLogoFile);
    setEditLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editLogoFile]);

  const resetCreateForm = useCallback(
    (context: PricingContext | null) => {
      setForm(buildDefaultFormFromPricing(context));
      setPhoneValue('');
      setSelectedLogoFile(null);
    },
    [setForm]
  );

  const loadPartners = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const response = await fetch(`/api/dashboard/partners?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      const pricing: PricingContext = data?.pricing || {
        currency: 'XAF',
        activeTypes: [],
        defaults: { fixedAmount: 0, percentageValue: 0, packagePlans: [], zones: [] },
      };

      setPartners(Array.isArray(data?.partners) ? data.partners : []);
      setPricingContext(pricing);

      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));

      if (!didInitPricingRef.current) {
        resetCreateForm(pricing);
        didInitPricingRef.current = true;
      }

      if (!pricing.activeTypes.length) {
        showToast(t('dashboard.partners.noActivePricing'), 'warning');
        router.push('/dashboard/settings?tab=delivery');
      }
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, resetCreateForm, router, searchQuery, setPartners, showToast, t]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners, refreshTick]);

  const partnerTypeColors: Record<PartnerType, string> = {
    restaurant: 'bg-orange-500/20 text-orange-400',
    shop: 'bg-blue-500/20 text-blue-400',
    pharmacy: 'bg-green-500/20 text-green-400',
    ecommerce: 'bg-purple-500/20 text-purple-400',
    other: 'bg-gray-500/20 text-gray-400',
  };

  const pricingTypeOptions = useMemo(
    () =>
      (pricingContext?.activeTypes || []).map((type) => ({
        value: type,
        label: t(`dashboard.partners.pricing.types.${type}`),
      })),
    [pricingContext?.activeTypes, t]
  );

  const currentFixedDefault = pricingContext?.defaults.fixedAmount || 0;
  const currentPercentageDefault = pricingContext?.defaults.percentageValue || 0;

  const updateFormPricingType = (
    type: PricingType,
    setter: React.Dispatch<React.SetStateAction<PartnerForm>>,
    baseFixed: number,
    basePercentage: number
  ) => {
    setter((prev) => {
      const next = { ...prev, pricingType: type, useDefaultValue: true };
      if (type === 'package') next.packagePlanId = pricingContext?.defaults.packagePlans?.[0]?.id || '';
      if (type === 'zone') next.zoneId = pricingContext?.defaults.zones?.[0]?.id || '';
      if (type === 'fixed') next.fixedAmount = baseFixed;
      if (type === 'percentage') next.percentageValue = basePercentage;
      return next;
    });
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.partners.invalidLogoFile'), 'error');
      event.target.value = '';
      return;
    }

    setSelectedLogoFile(file);
    showToast(t('dashboard.partners.logoSelected'), 'info');
    event.target.value = '';
  };

  const handleEditLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.partners.invalidLogoFile'), 'error');
      event.target.value = '';
      return;
    }

    setEditLogoFile(file);
    showToast(t('dashboard.partners.logoSelected'), 'info');
    event.target.value = '';
  };

  const handleCreatePartner = async () => {
    if (!pricingContext?.activeTypes.length) {
      showToast(t('dashboard.partners.noActivePricing'), 'warning');
      router.push('/dashboard/settings?tab=delivery');
      return;
    }

    if (!form.name.trim()) {
      showToast(t('dashboard.partners.nameRequired'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('type', form.type);
      payload.append('email', form.email);
      payload.append('phone', phoneValue?.trim() || '');
      payload.append('address', form.address);
      payload.append('pricing.type', form.pricingType);
      payload.append('pricing.useDefaultValue', String(form.useDefaultValue));
      payload.append('pricing.fixedAmount', String(form.fixedAmount));
      payload.append('pricing.percentageValue', String(form.percentageValue));
      payload.append('pricing.packagePlanId', form.packagePlanId);
      payload.append('pricing.zoneId', form.zoneId);
      if (selectedLogoFile) payload.append('logoFile', selectedLogoFile);

      const response = await fetch('/api/dashboard/partners', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        if (data?.code === 'NO_ACTIVE_DELIVERY_PRICING') {
          router.push('/dashboard/settings?tab=delivery');
        }
        return;
      }

      showToast(data?.message || t('common.create'), 'success');
      setIsCreateDialogOpen(false);
      resetCreateForm(pricingContext);
      setPage(1);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const openViewDialog = (partner: Partner) => {
    setViewPartner(partner);
    setIsViewDialogOpen(true);
  };

  const openEditDialog = (partner: Partner) => {
    setEditingPartner(partner);
    setEditForm(mapPartnerToEditForm(partner, pricingContext));
    setEditPhoneValue(partner.phone || '');
    setEditLogoFile(null);
    setIsEditDialogOpen(true);
  };

  const handleEditPartner = async () => {
    if (!editingPartner) return;
    if (!editForm.name.trim()) {
      showToast(t('dashboard.partners.nameRequired'), 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const payload = new FormData();
      payload.append('name', editForm.name);
      payload.append('type', editForm.type);
      payload.append('email', editForm.email);
      payload.append('phone', editPhoneValue?.trim() || '');
      payload.append('address', editForm.address);
      payload.append('pricing.type', editForm.pricingType);
      payload.append('pricing.useDefaultValue', String(editForm.useDefaultValue));
      payload.append('pricing.fixedAmount', String(editForm.fixedAmount));
      payload.append('pricing.percentageValue', String(editForm.percentageValue));
      payload.append('pricing.packagePlanId', editForm.packagePlanId);
      payload.append('pricing.zoneId', editForm.zoneId);
      if (editLogoFile) payload.append('logoFile', editLogoFile);

      const response = await fetch(`/api/dashboard/partners/${editingPartner.id}`, {
        method: 'PUT',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('common.save'), 'success');
      setIsEditDialogOpen(false);
      setEditingPartner(null);
      setEditLogoFile(null);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderPartnerPricing = (partner: Partner) => {
    const pricingType = partner.pricing?.type || 'percentage';
    const currency = partner.pricing?.currency || pricingContext?.currency || 'XAF';
    const symbol = getCurrencySymbol(currency);

    if (pricingType === 'percentage') {
      const value = partner.pricing?.percentageValue ?? partner.commissionRate ?? 0;
      return (
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-400">
            <Percent className="w-4 h-4" />
            <span className="text-lg font-bold">{value}%</span>
          </div>
          <div className="text-xs text-white/40">{t('dashboard.partners.pricing.rate')}</div>
        </div>
      );
    }

    const amount = partner.pricing?.fixedAmount ?? 0;
    let subLabel = t('dashboard.partners.pricing.types.fixed');
    if (pricingType === 'package') subLabel = partner.pricing?.packagePlanName || t('dashboard.partners.pricing.types.package');
    if (pricingType === 'zone') subLabel = partner.pricing?.zoneName || t('dashboard.partners.pricing.types.zone');

    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-1 text-purple-400">
          <Wallet className="w-4 h-4" />
          <span className="text-lg font-bold">{symbol}{amount.toFixed(2)}</span>
        </div>
        <div className="text-xs text-white/40">{subLabel}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.partners.title')}</h1>
          <p className="text-white/50">{t('dashboard.partners.subtitle')}</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" disabled={!pricingContext?.activeTypes.length}>
              <Plus className="w-4 h-4" />
              {t('dashboard.partners.create')}
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.partners.create')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.name')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.partners.placeholders.name')}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.logo')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {logoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreviewUrl} alt="Partner logo" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-7 h-7 text-white/40" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {t('dashboard.partners.uploadLogo')}
                  </Button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.partners.fields.type')}</label>
                  <select
                    className="input-glass"
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as PartnerType }))}
                  >
                    <option value="restaurant">{t('dashboard.partners.types.restaurant')}</option>
                    <option value="shop">{t('dashboard.partners.types.shop')}</option>
                    <option value="pharmacy">{t('dashboard.partners.types.pharmacy')}</option>
                    <option value="ecommerce">{t('dashboard.partners.types.ecommerce')}</option>
                    <option value="other">{t('dashboard.partners.types.other')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.partners.pricing.strategyLabel')}</label>
                  <select
                    className="input-glass"
                    value={form.pricingType}
                    onChange={(e) =>
                      updateFormPricingType(
                        e.target.value as PricingType,
                        setForm,
                        currentFixedDefault,
                        currentPercentageDefault
                      )
                    }
                  >
                    {pricingTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(form.pricingType === 'fixed' || form.pricingType === 'percentage') && (
                <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{t('dashboard.partners.pricing.useDefault')}</div>
                      <div className="text-xs text-white/50">
                        {form.pricingType === 'fixed'
                          ? `${getCurrencySymbol(pricingContext?.currency || 'XAF')}${currentFixedDefault.toFixed(2)}`
                          : `${currentPercentageDefault}%`}
                      </div>
                    </div>
                    <Switch
                      checked={form.useDefaultValue}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, useDefaultValue: checked }))}
                    />
                  </div>

                  {!form.useDefaultValue && form.pricingType === 'fixed' && (
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">{t('dashboard.partners.pricing.customFixed')}</label>
                      <div className="flex">
                        <span className="inline-flex items-center justify-center min-w-[72px] px-3 rounded-l-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                          {getCurrencySymbol(pricingContext?.currency || 'XAF')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="input-glass rounded-l-none border-l-0"
                          value={form.fixedAmount}
                          onChange={(e) => setForm((prev) => ({ ...prev, fixedAmount: Number(e.target.value || 0) }))}
                        />
                      </div>
                    </div>
                  )}

                  {!form.useDefaultValue && form.pricingType === 'percentage' && (
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">{t('dashboard.partners.pricing.customPercentage')}</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="input-glass pl-10"
                          value={form.percentageValue}
                          onChange={(e) => setForm((prev) => ({ ...prev, percentageValue: Number(e.target.value || 0) }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(form.pricingType === 'package' || form.pricingType === 'zone') && (
                <div className="text-xs text-white/60 p-3 rounded-xl border border-white/10 bg-white/5">
                  {t('dashboard.partners.pricing.defaultAutoApplied')}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.partners.fields.email')}</label>
                  <input
                    type="email"
                    className="input-glass"
                    placeholder={t('dashboard.partners.placeholders.email')}
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.partners.fields.phone')}</label>
                  <PhoneInput
                    international
                    defaultCountry="CM"
                    value={phoneValue}
                    onChange={(value) => setPhoneValue(value)}
                    placeholder={t('dashboard.partners.placeholders.phone')}
                    className="input-glass"
                    numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.address')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.partners.placeholders.address')}
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <Button className="w-full btn-primary gap-2" onClick={handleCreatePartner} disabled={isCreating}>
                <Save className="w-4 h-4" />
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.partners.details')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.fields.name')}:</span> {viewPartner?.name || '-'}</div>
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.fields.type')}:</span> {viewPartner ? t(`dashboard.partners.types.${viewPartner.type}`) : '-'}</div>
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.fields.email')}:</span> {viewPartner?.email || '-'}</div>
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.fields.phone')}:</span> {viewPartner?.phone || '-'}</div>
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.fields.address')}:</span> {viewPartner?.address || '-'}</div>
            <div className="text-white"><span className="text-white/60">{t('dashboard.partners.pricing.strategyLabel')}:</span> {viewPartner ? t(`dashboard.partners.pricing.types.${viewPartner.pricing?.type || 'fixed'}`) : '-'}</div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.partners.edit')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.partners.fields.name')}</label>
              <input
                type="text"
                className="input-glass"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.partners.fields.logo')}</label>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {editLogoPreviewUrl || editingPartner?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editLogoPreviewUrl || editingPartner?.logo} alt="Partner logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-7 h-7 text-white/40" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                  onClick={() => editLogoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {t('dashboard.partners.uploadLogo')}
                </Button>
                <input
                  ref={editLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleEditLogoFileChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.type')}</label>
                <select
                  className="input-glass"
                  value={editForm.type}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value as PartnerType }))}
                >
                  <option value="restaurant">{t('dashboard.partners.types.restaurant')}</option>
                  <option value="shop">{t('dashboard.partners.types.shop')}</option>
                  <option value="pharmacy">{t('dashboard.partners.types.pharmacy')}</option>
                  <option value="ecommerce">{t('dashboard.partners.types.ecommerce')}</option>
                  <option value="other">{t('dashboard.partners.types.other')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.pricing.strategyLabel')}</label>
                <select
                  className="input-glass"
                  value={editForm.pricingType}
                  onChange={(e) =>
                    updateFormPricingType(
                      e.target.value as PricingType,
                      setEditForm,
                      currentFixedDefault,
                      currentPercentageDefault
                    )
                  }
                >
                  {pricingTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(editForm.pricingType === 'fixed' || editForm.pricingType === 'percentage') && (
              <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{t('dashboard.partners.pricing.useDefault')}</div>
                    <div className="text-xs text-white/50">
                      {editForm.pricingType === 'fixed'
                        ? `${getCurrencySymbol(pricingContext?.currency || 'XAF')}${currentFixedDefault.toFixed(2)}`
                        : `${currentPercentageDefault}%`}
                    </div>
                  </div>
                  <Switch
                    checked={editForm.useDefaultValue}
                    onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, useDefaultValue: checked }))}
                  />
                </div>

                {!editForm.useDefaultValue && editForm.pricingType === 'fixed' && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">{t('dashboard.partners.pricing.customFixed')}</label>
                    <div className="flex">
                      <span className="inline-flex items-center justify-center min-w-[72px] px-3 rounded-l-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                        {getCurrencySymbol(pricingContext?.currency || 'XAF')}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input-glass rounded-l-none border-l-0"
                        value={editForm.fixedAmount}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, fixedAmount: Number(e.target.value || 0) }))}
                      />
                    </div>
                  </div>
                )}

                {!editForm.useDefaultValue && editForm.pricingType === 'percentage' && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">{t('dashboard.partners.pricing.customPercentage')}</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input-glass pl-10"
                        value={editForm.percentageValue}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, percentageValue: Number(e.target.value || 0) }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(editForm.pricingType === 'package' || editForm.pricingType === 'zone') && (
              <div className="text-xs text-white/60 p-3 rounded-xl border border-white/10 bg-white/5">
                {t('dashboard.partners.pricing.defaultAutoApplied')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.email')}</label>
                <input
                  type="email"
                  className="input-glass"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.partners.fields.phone')}</label>
                <PhoneInput
                  international
                  defaultCountry="CM"
                  value={editPhoneValue}
                  onChange={(value) => setEditPhoneValue(value)}
                  placeholder={t('dashboard.partners.placeholders.phone')}
                  className="input-glass"
                  numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.partners.fields.address')}</label>
              <input
                type="text"
                className="input-glass"
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <Button className="w-full btn-primary gap-2" onClick={handleEditPartner} disabled={isUpdating}>
              <Save className="w-4 h-4" />
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {isLoading ? (
        <div className="glass-card p-12 text-center text-white/60">{t('common.loading')}</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((partner) => (
              <div key={partner.id} className="glass-card p-6 hover:scale-[1.02] transition-transform">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${partnerTypeColors[partner.type]}`}>
                      {partner.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={partner.logo} alt={partner.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <Store className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{partner.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${partnerTypeColors[partner.type]}`}>
                        {t(`dashboard.partners.types.${partner.type}`)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openViewDialog(partner)}>
                        <Eye className="w-4 h-4 mr-2" />
                        {t('common.view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEditDialog(partner)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-4">
                  {partner.email && (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Mail className="w-4 h-4" />
                      {partner.email}
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Phone className="w-4 h-4" />
                      {partner.phone}
                    </div>
                  )}
                  {partner.address && (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <MapPin className="w-4 h-4" />
                      {partner.address}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5" />
              </div>
            ))}
          </div>

          {partners.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Store className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/50">{t('dashboard.partners.empty')}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/60">
              {t('dashboard.partners.pagination.summary', {
                from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, totalItems),
                total: totalItems,
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input-glass py-2 px-3 w-full sm:w-[90px]"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={9}>9</option>
                <option value={18}>18</option>
                <option value={30}>30</option>
              </select>
              <Button
                type="button"
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={isLoading || page <= 1}
              >
                {t('dashboard.partners.pagination.previous')}
              </Button>
              <div className="text-sm text-white/70 min-w-[90px] text-center w-full sm:w-auto">
                {t('dashboard.partners.pagination.page', { page, totalPages })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={isLoading || page >= totalPages}
              >
                {t('dashboard.partners.pagination.next')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PartnersPage;
