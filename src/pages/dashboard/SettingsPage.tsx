import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { 
  Building2, 
  Truck, 
  CarFront,
  Bell, 
  Save,
  Upload,
  Clock,
  Percent,
  Plus,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type PackagePlan = {
  id: string;
  name: string;
  amount: number;
};

type ZoneRate = {
  id: string;
  name: string;
  amount: number;
  neighborhoods: Array<{
    id: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    placeId?: string;
  }>;
};

type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type CompanyVehicle = {
  id: string;
  name: string;
  type: string;
  plateNumber: string;
  capacityKg: number;
  isActive: boolean;
};

const DEFAULT_DELIVERY_PRICING = {
  currency: 'XAF',
  fixed: { enabled: false, amount: 0 },
  package: { enabled: false, plans: [] as PackagePlan[] },
  percentage: { enabled: false, value: 0 },
  zone: { enabled: false, zones: [] as ZoneRate[] },
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  email: true,
  inApp: true,
  whatsapp: false,
};

const DEFAULT_VEHICLES: CompanyVehicle[] = [];

const CURRENCY_OPTIONS = [
  { code: 'XAF', symbol: 'FCFA' },
  { code: 'XOF', symbol: 'CFA' },
  { code: 'NGN', symbol: '₦' },
  { code: 'GHS', symbol: 'GH₵' },
  { code: 'KES', symbol: 'KSh' },
  { code: 'UGX', symbol: 'USh' },
  { code: 'TZS', symbol: 'TSh' },
  { code: 'MAD', symbol: 'MAD' },
  { code: 'DZD', symbol: 'DZD' },
  { code: 'TND', symbol: 'TND' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
];

const VEHICLE_TYPE_OPTIONS = ['motorcycle', 'car', 'van', 'truck', 'bicycle', 'other'] as const;

const SettingsPage = () => {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [activeTab, setActiveTab] = useState('company');
  const [isCompanyLoading, setIsCompanyLoading] = useState(true);
  const [isCompanySaving, setIsCompanySaving] = useState(false);
  const [isDeliverySaving, setIsDeliverySaving] = useState(false);
  const [isVehiclesSaving, setIsVehiclesSaving] = useState(false);
  const [isNotificationsSaving, setIsNotificationsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [zoneSearchQueries, setZoneSearchQueries] = useState<Record<string, string>>({});
  const [zoneSuggestions, setZoneSuggestions] = useState<Record<string, PlaceSuggestion[]>>({});
  const [zoneSearching, setZoneSearching] = useState<Record<string, boolean>>({});
  const zoneSearchTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const [companyForm, setCompanyForm] = useState({
    name: '',
    logo: '',
    address: '',
    openTime: '09:00',
    closeTime: '18:00',
    whatsappDefaultLocale: 'fr',
  });
  const [deliveryPricing, setDeliveryPricing] = useState(DEFAULT_DELIVERY_PRICING);
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>(DEFAULT_VEHICLES);
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'company' || tab === 'delivery' || tab === 'vehicles' || tab === 'notifications') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    const loadCompanySettings = async () => {
      setIsCompanyLoading(true);
      try {
        const response = await fetch('/api/dashboard/settings/company', { cache: 'no-store' });
        const data = await response.json();

        if (!mounted) return;

        if (!response.ok) {
          showToast(getLocalizedApiError(t, data, response.status), 'error');
          return;
        }

        setCompanyForm({
          name: data?.company?.name || '',
          logo: data?.company?.logo || '',
          address: data?.company?.address || '',
          openTime: data?.company?.businessHours?.open || '09:00',
          closeTime: data?.company?.businessHours?.close || '18:00',
          whatsappDefaultLocale: data?.company?.whatsappDefaultLocale || 'fr',
        });
        setDeliveryPricing({
          ...DEFAULT_DELIVERY_PRICING,
          ...(data?.company?.deliveryPricing || {}),
        });
        setNotificationSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(data?.company?.notificationSettings || {}),
        });
        setVehicles(Array.isArray(data?.company?.vehicles) ? data.company.vehicles : []);
      } catch {
        if (mounted) showToast(t('errors.network'), 'error');
      } finally {
        if (mounted) setIsCompanyLoading(false);
      }
    };

    loadCompanySettings();

    return () => {
      mounted = false;
    };
  }, [showToast, t]);

  const updateCompanyField = (field: keyof typeof companyForm, value: string) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDeliveryPricing = (next: typeof DEFAULT_DELIVERY_PRICING) => {
    setDeliveryPricing(next);
  };

  const currencySymbol =
    CURRENCY_OPTIONS.find((currency) => currency.code === deliveryPricing.currency)?.symbol || deliveryPricing.currency;

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
    return () => {
      Object.values(zoneSearchTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const handleSaveCompanySettings = async () => {
    setIsCompanySaving(true);
    try {
      const payload = new FormData();
      payload.append('name', companyForm.name);
      payload.append('logo', companyForm.logo);
      payload.append('address', companyForm.address);
      payload.append('whatsappDefaultLocale', companyForm.whatsappDefaultLocale);
      payload.append('businessHours.open', companyForm.openTime);
      payload.append('businessHours.close', companyForm.closeTime);
      if (selectedLogoFile) payload.append('logoFile', selectedLogoFile);

      const response = await fetch('/api/dashboard/settings/company', {
        method: 'PUT',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setCompanyForm((prev) => ({
        ...prev,
        logo: data?.company?.logo || prev.logo,
      }));
      setSelectedLogoFile(null);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCompanySaving(false);
    }
  };

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.settings.company.invalidLogoFile'), 'error');
      event.target.value = '';
      return;
    }

    setSelectedLogoFile(file);
    showToast(t('dashboard.settings.company.logoSelected'), 'info');
    event.target.value = '';
  };

  const handleSaveDeliveryPricing = async () => {
    setIsDeliverySaving(true);
    try {
      const response = await fetch('/api/dashboard/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryPricing }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeliveryPricing(data?.company?.deliveryPricing || deliveryPricing);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeliverySaving(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setIsNotificationsSaving(true);
    try {
      const response = await fetch('/api/dashboard/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSettings }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setNotificationSettings({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(data?.company?.notificationSettings || notificationSettings),
      });
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsNotificationsSaving(false);
    }
  };

  const addVehicle = () => {
    setVehicles((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        type: '',
        plateNumber: '',
        capacityKg: 0,
        isActive: true,
      },
    ]);
  };

  const updateVehicle = (id: string, patch: Partial<CompanyVehicle>) => {
    setVehicles((prev) => prev.map((vehicle) => (vehicle.id === id ? { ...vehicle, ...patch } : vehicle)));
  };

  const removeVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id));
  };

  const handleSaveVehicles = async () => {
    const hasInvalid = vehicles.some(
      (vehicle) => !vehicle.name.trim() || !vehicle.type.trim() || !vehicle.plateNumber.trim()
    );
    if (hasInvalid) {
      showToast(t('dashboard.settings.vehicles.validationRequired'), 'error');
      return;
    }

    setIsVehiclesSaving(true);
    try {
      const response = await fetch('/api/dashboard/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicles }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setVehicles(Array.isArray(data?.company?.vehicles) ? data.company.vehicles : []);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsVehiclesSaving(false);
    }
  };

  const addPackagePlan = () => {
    updateDeliveryPricing({
      ...deliveryPricing,
      package: {
        ...deliveryPricing.package,
        plans: [...deliveryPricing.package.plans, { id: crypto.randomUUID(), name: '', amount: 0 }],
      },
    });
  };

  const updatePackagePlan = (id: string, patch: Partial<PackagePlan>) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      package: {
        ...deliveryPricing.package,
        plans: deliveryPricing.package.plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)),
      },
    });
  };

  const removePackagePlan = (id: string) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      package: {
        ...deliveryPricing.package,
        plans: deliveryPricing.package.plans.filter((plan) => plan.id !== id),
      },
    });
  };

  const updateZoneRate = (id: string, amount: number) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.map((zone) => (zone.id === id ? { ...zone, amount } : zone)),
      },
    });
  };

  const updateZoneName = (id: string, name: string) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.map((zone) => (zone.id === id ? { ...zone, name } : zone)),
      },
    });
  };

  const removeZoneRate = (id: string) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.filter((zone) => zone.id !== id),
      },
    });
    setZoneSearchQueries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setZoneSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setZoneSearching((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (zoneSearchTimers.current[id]) {
      clearTimeout(zoneSearchTimers.current[id]!);
      delete zoneSearchTimers.current[id];
    }
  };

  const addZoneGroup = () => {
    const newId = crypto.randomUUID();
    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: [...deliveryPricing.zone.zones, { id: newId, name: '', amount: 0, neighborhoods: [] }],
      },
    });
    setZoneSearchQueries((prev) => ({ ...prev, [newId]: '' }));
    setZoneSuggestions((prev) => ({ ...prev, [newId]: [] }));
  };

  const searchPlacesForZone = async (zoneId: string, query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setZoneSuggestions((prev) => ({ ...prev, [zoneId]: [] }));
      return;
    }

    setZoneSearching((prev) => ({ ...prev, [zoneId]: true }));
    try {
      const response = await fetch(`/api/dashboard/settings/company/places?query=${encodeURIComponent(trimmed)}`);
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setZoneSuggestions((prev) => ({ ...prev, [zoneId]: Array.isArray(data?.places) ? data.places : [] }));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setZoneSearching((prev) => ({ ...prev, [zoneId]: false }));
    }
  };

  const addZoneFromPlace = (zoneId: string, place: PlaceSuggestion) => {
    const targetZone = deliveryPricing.zone.zones.find((zone) => zone.id === zoneId);
    if (!targetZone) return;

    if (targetZone.neighborhoods.some((n) => n.placeId === place.placeId)) {
      showToast(t('dashboard.settings.delivery.zone.duplicateNeighborhood'), 'warning');
      return;
    }

    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                neighborhoods: [
                  ...zone.neighborhoods,
                  {
                    id: crypto.randomUUID(),
                    name: place.name || place.address,
                    address: place.address,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    placeId: place.placeId,
                  },
                ],
              }
            : zone
        ),
      },
    });
    setZoneSuggestions((prev) => ({ ...prev, [zoneId]: [] }));
    setZoneSearchQueries((prev) => ({ ...prev, [zoneId]: '' }));
  };

  const removeNeighborhood = (zoneId: string, neighborhoodId: string) => {
    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.map((zone) =>
          zone.id === zoneId
            ? { ...zone, neighborhoods: zone.neighborhoods.filter((n) => n.id !== neighborhoodId) }
            : zone
        ),
      },
    });
  };

  const handleZoneSearchChange = (zoneId: string, value: string) => {
    setZoneSearchQueries((prev) => ({ ...prev, [zoneId]: value }));

    if (zoneSearchTimers.current[zoneId]) {
      clearTimeout(zoneSearchTimers.current[zoneId]!);
    }

   /* zoneSearchTimers.current[zoneId] = setTimeout(() => {
      searchPlacesForZone(zoneId, value);
    }, 250);*/ // Commented out to disable search suggestions on input change, as per latest requirements
  };

  const handleZoneSearchEnter = (zoneId: string) => {
    const suggestions = zoneSuggestions[zoneId] || [];
    const typed = (zoneSearchQueries[zoneId] || '').trim();

    if (suggestions.length > 0) {
      addZoneFromPlace(zoneId, suggestions[0]);
      return;
    }

    if (!typed) return;

    const targetZone = deliveryPricing.zone.zones.find((zone) => zone.id === zoneId);
    if (!targetZone) return;
    if (targetZone.neighborhoods.some((n) => n.name.toLowerCase() === typed.toLowerCase())) {
      showToast(t('dashboard.settings.delivery.zone.duplicateNeighborhood'), 'warning');
      return;
    }

    updateDeliveryPricing({
      ...deliveryPricing,
      zone: {
        ...deliveryPricing.zone,
        zones: deliveryPricing.zone.zones.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                neighborhoods: [
                  ...zone.neighborhoods,
                  {
                    id: crypto.randomUUID(),
                    name: typed,
                    address: typed,
                    latitude: 0,
                    longitude: 0,
                    placeId: '',
                  },
                ],
              }
            : zone
        ),
      },
    });
    setZoneSearchQueries((prev) => ({ ...prev, [zoneId]: '' }));
    setZoneSuggestions((prev) => ({ ...prev, [zoneId]: [] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {t('dashboard.settings.title')}
        </h1>
        <p className="text-white/50">
          Configurez les paramètres de votre entreprise
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 flex flex-wrap gap-1">
          <TabsTrigger 
            value="company" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60"
          >
            <Building2 className="w-4 h-4 mr-2" />
            {t('dashboard.settings.company.title')}
          </TabsTrigger>
          <TabsTrigger 
            value="delivery"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60"
          >
            <Truck className="w-4 h-4 mr-2" />
            {t('dashboard.settings.delivery.title')}
          </TabsTrigger>
          <TabsTrigger
            value="vehicles"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60"
          >
            <CarFront className="w-4 h-4 mr-2" />
            {t('dashboard.settings.vehicles.title')}
          </TabsTrigger>
          <TabsTrigger 
            value="notifications"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-white/60"
          >
            <Bell className="w-4 h-4 mr-2" />
            {t('dashboard.settings.notifications.title')}
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">
              {t('dashboard.settings.company.title')}
            </h3>

            {isCompanyLoading ? (
              <div className="text-white/60">{t('common.loading')}</div>
            ) : (
              <>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t('dashboard.settings.company.name')}
                </label>
                <input 
                  type="text" 
                  className="input-glass" 
                  value={companyForm.name}
                  onChange={(e) => updateCompanyField('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t('dashboard.settings.company.logo')}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center">
                    {logoPreviewUrl || companyForm.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreviewUrl || companyForm.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Building2 className="w-8 h-8 text-white/40" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isCompanySaving}
                  >
                    <Upload className="w-4 h-4" />
                    {t('dashboard.settings.company.uploadLogo')}
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
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">
                {t('dashboard.settings.company.address')}
              </label>
              <input 
                type="text" 
                className="input-glass" 
                placeholder={t('dashboard.settings.company.addressPlaceholder')}
                value={companyForm.address}
                onChange={(e) => updateCompanyField('address', e.target.value)}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t('dashboard.settings.company.businessHours')}
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/40" />
                    <input 
                      type="time" 
                      className="input-glass py-2"
                      value={companyForm.openTime}
                      onChange={(e) => updateCompanyField('openTime', e.target.value)}
                    />
                  </div>
                  <span className="text-white/50">{t('dashboard.settings.company.to')}</span>
                  <input
                    type="time" 
                    className="input-glass py-2"
                    value={companyForm.closeTime}
                    onChange={(e) => updateCompanyField('closeTime', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">
                  {t('dashboard.settings.company.whatsappLocale')}
                </label>
                <select
                  className="input-glass"
                  value={companyForm.whatsappDefaultLocale}
                  onChange={(e) => updateCompanyField('whatsappDefaultLocale', e.target.value)}
                >
                  <option value="fr">{t('dashboard.settings.company.whatsappLocaleFr')}</option>
                  <option value="en">{t('dashboard.settings.company.whatsappLocaleEn')}</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <Button className="btn-primary gap-2" onClick={handleSaveCompanySettings} disabled={isCompanySaving}>
                <Save className="w-4 h-4" />
                {isCompanySaving ? t('common.loading') : t('common.save')}
              </Button>
            </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Delivery Settings */}
        <TabsContent value="delivery" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">
              {t('dashboard.settings.delivery.title')}
            </h3>
            <p className="text-sm text-white/60">
              {t('dashboard.settings.delivery.description')}
            </p>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.settings.delivery.currency')}</label>
              <select
                className="input-glass"
                value={deliveryPricing.currency}
                onChange={(e) =>
                  updateDeliveryPricing({
                    ...deliveryPricing,
                    currency: e.target.value,
                  })
                }
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency.code} value={currency.code} className="bg-[#111]">
                    {t(`dashboard.settings.delivery.currencies.${currency.code}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4 order-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t('dashboard.settings.delivery.fixed.title')}</div>
                  <div className="text-sm text-white/50">{t('dashboard.settings.delivery.fixed.description')}</div>
                </div>
                <Switch
                  checked={deliveryPricing.fixed.enabled}
                  onCheckedChange={(checked) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      fixed: { ...deliveryPricing.fixed, enabled: checked },
                    })
                  }
                />
              </div>
              <div className={`max-w-xs flex ${!deliveryPricing.fixed.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="inline-flex items-center justify-center min-w-[72px] px-3 rounded-l-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  className="input-glass rounded-l-none border-l-0"
                  step="0.01"
                  min={0}
                  value={deliveryPricing.fixed.amount}
                  onChange={(e) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      fixed: { ...deliveryPricing.fixed, amount: Number(e.target.value || 0) },
                    })
                  }
                />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4 order-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t('dashboard.settings.delivery.package.title')}</div>
                  <div className="text-sm text-white/50">{t('dashboard.settings.delivery.package.description')}</div>
                </div>
                <Switch
                  checked={deliveryPricing.package.enabled}
                  onCheckedChange={(checked) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      package: { ...deliveryPricing.package, enabled: checked },
                    })
                  }
                />
              </div>

              <div className={`space-y-3 ${!deliveryPricing.package.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {deliveryPricing.package.plans.map((plan) => (
                  <div key={plan.id} className="grid md:grid-cols-[1fr_180px_auto] gap-3">
                    <input
                      type="text"
                      className="input-glass"
                      placeholder={t('dashboard.settings.delivery.package.planPlaceholder')}
                      value={plan.name}
                      onChange={(e) => updatePackagePlan(plan.id, { name: e.target.value })}
                    />
                    <div className="flex">
                      <span className="inline-flex items-center justify-center min-w-[72px] px-3 rounded-l-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        className="input-glass rounded-l-none border-l-0"
                        step="0.01"
                        min={0}
                        value={plan.amount}
                        onChange={(e) => updatePackagePlan(plan.id, { amount: Number(e.target.value || 0) })}
                      />
                    </div>
                    <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={() => removePackagePlan(plan.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={addPackagePlan}>
                  <Plus className="w-4 h-4" />
                  {t('dashboard.settings.delivery.package.addPlan')}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4 order-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t('dashboard.settings.delivery.percentage.title')}</div>
                  <div className="text-sm text-white/50">{t('dashboard.settings.delivery.percentage.description')}</div>
                </div>
                <Switch
                  checked={deliveryPricing.percentage.enabled}
                  onCheckedChange={(checked) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      percentage: { ...deliveryPricing.percentage, enabled: checked },
                    })
                  }
                />
              </div>
              <div className={`relative max-w-xs ${!deliveryPricing.percentage.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="number"
                  className="input-glass pl-12"
                  min={0}
                  max={100}
                  value={deliveryPricing.percentage.value}
                  onChange={(e) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      percentage: { ...deliveryPricing.percentage, value: Number(e.target.value || 0) },
                    })
                  }
                />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4 order-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t('dashboard.settings.delivery.zone.title')}</div>
                  <div className="text-sm text-white/50">{t('dashboard.settings.delivery.zone.description')}</div>
                </div>
                <Switch
                  checked={deliveryPricing.zone.enabled}
                  onCheckedChange={(checked) =>
                    updateDeliveryPricing({
                      ...deliveryPricing,
                      zone: { ...deliveryPricing.zone, enabled: checked },
                    })
                  }
                />
              </div>

              <div className={`space-y-3 ${!deliveryPricing.zone.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/70">{t('dashboard.settings.delivery.zone.groupsTitle')}</div>
                  <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={addZoneGroup}>
                    <Plus className="w-4 h-4" />
                    {t('dashboard.settings.delivery.zone.addZone')}
                  </Button>
                </div>

                <div className="space-y-3">
                  {deliveryPricing.zone.zones.map((zone) => (
                    <div key={zone.id} className="p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="grid md:grid-cols-[1fr_180px_auto] gap-3 items-center">
                        <input
                          type="text"
                          className="input-glass"
                          placeholder={t('dashboard.settings.delivery.zone.zoneNamePlaceholder')}
                          value={zone.name}
                          onChange={(e) => updateZoneName(zone.id, e.target.value)}
                        />
                        <div className="flex">
                          <span className="inline-flex items-center justify-center min-w-[72px] px-3 rounded-l-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            className="input-glass rounded-l-none border-l-0"
                            step="0.01"
                            min={0}
                            value={zone.amount}
                            onChange={(e) => updateZoneRate(zone.id, Number(e.target.value || 0))}
                          />
                        </div>
                        <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white" onClick={() => removeZoneRate(zone.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {zone.neighborhoods.length === 0 ? (
                          <div className="text-xs text-white/50">{t('dashboard.settings.delivery.zone.emptyNeighborhoods')}</div>
                        ) : (
                          zone.neighborhoods.map((neighborhood) => (
                            <div key={neighborhood.id} className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10">
                              <div className="flex-1">
                                <div className="text-sm text-white">{neighborhood.name}</div>
                                {/* <div className="text-xs text-white/50">{neighborhood.address || `${neighborhood.latitude}, ${neighborhood.longitude}`}</div> */}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                                onClick={() => removeNeighborhood(zone.id, neighborhood.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          className="input-glass w-full"
                          placeholder={t('dashboard.settings.delivery.zone.searchPlaceholderSelected')}
                          value={zoneSearchQueries[zone.id] || ''}
                          onChange={(e) => handleZoneSearchChange(zone.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter'|| e.key === ',') {
                              e.preventDefault();
                              handleZoneSearchEnter(zone.id);
                            }
                          }}
                        />
                        {(zoneSearching[zone.id] || false) && (
                          <div className="text-xs text-white/50">{t('dashboard.settings.delivery.zone.searching')}</div>
                        )}
                        {(zoneSuggestions[zone.id] || []).length > 0 && (
                          <div className="space-y-2">
                            {(zoneSuggestions[zone.id] || []).map((place) => (
                              <button
                                key={place.placeId}
                                type="button"
                                onClick={() => addZoneFromPlace(zone.id, place)}
                                className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                              >
                                <div className="text-sm text-white font-medium">{place.name}</div>
                                <div className="text-xs text-white/60">{place.address}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <Button className="btn-primary gap-2" onClick={handleSaveDeliveryPricing} disabled={isDeliverySaving}>
                <Save className="w-4 h-4" />
                {isDeliverySaving ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Vehicles Settings */}
        <TabsContent value="vehicles" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">{t('dashboard.settings.vehicles.title')}</h3>
            <p className="text-sm text-white/60">{t('dashboard.settings.vehicles.description')}</p>

            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      className="input-glass"
                      placeholder={t('dashboard.settings.vehicles.namePlaceholder')}
                      value={vehicle.name}
                      onChange={(e) => updateVehicle(vehicle.id, { name: e.target.value })}
                    />
                    <select
                      className="input-glass"
                      value={vehicle.type}
                      onChange={(e) => updateVehicle(vehicle.id, { type: e.target.value })}
                    >
                      <option value="">{t('dashboard.settings.vehicles.typePlaceholder')}</option>
                      {VEHICLE_TYPE_OPTIONS.map((vehicleType) => (
                        <option key={vehicleType} value={vehicleType} className="bg-[#111]">
                          {t(`dashboard.settings.vehicles.types.${vehicleType}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
                    <input
                      type="text"
                      className="input-glass"
                      placeholder={t('dashboard.settings.vehicles.platePlaceholder')}
                      value={vehicle.plateNumber}
                      onChange={(e) => updateVehicle(vehicle.id, { plateNumber: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                      onClick={() => removeVehicle(vehicle.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-black/20">
                    <div className="text-sm text-white">{t('dashboard.settings.vehicles.active')}</div>
                    <Switch
                      checked={vehicle.isActive}
                      onCheckedChange={(checked) => updateVehicle(vehicle.id, { isActive: checked })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
              onClick={addVehicle}
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.settings.vehicles.add')}
            </Button>

            <div className="pt-4 border-t border-white/10">
              <Button className="btn-primary gap-2" onClick={handleSaveVehicles} disabled={isVehiclesSaving}>
                <Save className="w-4 h-4" />
                {isVehiclesSaving ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">
              {t('dashboard.settings.notifications.title')}
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div>
                  <div className="text-white font-medium">
                    {t('dashboard.settings.notifications.email')}
                  </div>
                  <div className="text-sm text-white/50">
                    {t('dashboard.settings.notifications.emailDescription')}
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.email}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, email: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div>
                  <div className="text-white font-medium">
                    {t('dashboard.settings.notifications.inApp')}
                  </div>
                  <div className="text-sm text-white/50">
                    {t('dashboard.settings.notifications.inAppDescription')}
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.inApp}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, inApp: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div>
                  <div className="text-white font-medium">
                    {t('dashboard.settings.notifications.whatsapp')}
                  </div>
                  <div className="text-sm text-white/50">
                    {t('dashboard.settings.notifications.whatsappDescription')}
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.whatsapp}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({ ...prev, whatsapp: checked }))
                  }
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <Button className="btn-primary gap-2" onClick={handleSaveNotificationSettings} disabled={isNotificationsSaving}>
                <Save className="w-4 h-4" />
                {isNotificationsSaving ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
