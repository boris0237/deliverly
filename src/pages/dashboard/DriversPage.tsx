import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  Plus,
  Search,
  MoreVertical,
  Users,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Copy,
  Share2,
  RefreshCw,
  Save,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type DashboardDriver = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  vehicleId?: string;
  role: 'driver';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};

type DriverForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleId: string;
  password: string;
};

const DEFAULT_FORM: DriverForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  vehicleId: '',
  password: '',
};

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const DriversPage = () => {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [drivers, setDrivers] = useState<DashboardDriver[]>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string; plateNumber: string; isActive: boolean }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);

  const [form, setForm] = useState<DriverForm>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<DriverForm>(DEFAULT_FORM);

  const [selectedDriver, setSelectedDriver] = useState<DashboardDriver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<DashboardDriver | null>(null);

  const [credentialPayload, setCredentialPayload] = useState<{ name: string; email: string; password: string } | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((vehicle) => {
      map.set(vehicle.id, `${vehicle.name} (${vehicle.plateNumber})`);
    });
    return map;
  }, [vehicles]);

  const loadDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('role', 'driver');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const response = await fetch(`/api/dashboard/users?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDrivers(Array.isArray(data?.users) ? data.users : []);
      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery, showToast, t]);

  const loadVehicles = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/settings/company', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) return;
      const incoming = Array.isArray(data?.company?.vehicles) ? data.company.vehicles : [];
      setVehicles(
        incoming
          .filter((vehicle: any) => vehicle?.isActive !== false)
          .map((vehicle: any) => ({
            id: String(vehicle.id || ''),
            name: String(vehicle.name || ''),
            plateNumber: String(vehicle.plateNumber || ''),
            isActive: vehicle?.isActive !== false,
          }))
          .filter((vehicle: { id: string }) => Boolean(vehicle.id))
      );
    } catch {
      // page still works without vehicle list
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers, refreshTick]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const openCreate = () => {
    setForm({ ...DEFAULT_FORM, password: generatePassword() });
    setIsCreateDialogOpen(true);
  };

  const openEdit = (driver: DashboardDriver) => {
    setSelectedDriver(driver);
    setEditForm({
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone || '',
      vehicleId: driver.vehicleId || '',
      password: '',
    });
    setIsEditDialogOpen(true);
  };

  const handleCreateDriver = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
      showToast(t('dashboard.drivers.validation.required'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboard/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          role: 'driver',
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsCreateDialogOpen(false);
      setCredentialPayload({
        name: `${form.firstName} ${form.lastName}`,
        email: form.email,
        password: form.password,
      });
      setIsCredentialsDialogOpen(true);
      showToast(t('common.saved'), 'success');
      setPage(1);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateDriver = async () => {
    if (!selectedDriver) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      showToast(t('dashboard.drivers.validation.required'), 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/dashboard/users/${selectedDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phone: editForm.phone,
          role: 'driver',
          vehicleId: editForm.vehicleId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsEditDialogOpen(false);
      setSelectedDriver(null);
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (driver: DashboardDriver) => {
    try {
      const response = await fetch(`/api/dashboard/users/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !driver.isActive }),
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

  const handleResetPassword = async (driver: DashboardDriver) => {
    const nextPassword = generatePassword();
    try {
      const response = await fetch(`/api/dashboard/users/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setCredentialPayload({
        name: `${driver.firstName} ${driver.lastName}`,
        email: driver.email,
        password: nextPassword,
      });
      setIsCredentialsDialogOpen(true);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  const handleDeleteDriver = async () => {
    if (!deleteDriver) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/users/${deleteDriver.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeleteDriver(null);
      showToast(t('common.delete'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentialPayload) return;
    const text = `${t('dashboard.drivers.credentials.user')}: ${credentialPayload.name}\n${t('dashboard.drivers.fields.email')}: ${credentialPayload.email}\n${t('dashboard.drivers.fields.password')}: ${credentialPayload.password}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('dashboard.drivers.credentials.copied'), 'success');
    } catch {
      showToast(t('errors.generic'), 'error');
    }
  };

  const shareCredentials = async () => {
    if (!credentialPayload) return;
    const text = `${t('dashboard.drivers.credentials.user')}: ${credentialPayload.name}\n${t('dashboard.drivers.fields.email')}: ${credentialPayload.email}\n${t('dashboard.drivers.fields.password')}: ${credentialPayload.password}`;

    if (!navigator.share) {
      showToast(t('dashboard.drivers.credentials.shareUnavailable'), 'warning');
      return;
    }

    try {
      await navigator.share({ text });
    } catch {
      // user cancelled share sheet
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.drivers.title')}</h1>
          <p className="text-white/50">{t('dashboard.drivers.subtitle')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t('dashboard.drivers.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.drivers.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.drivers.fields.firstName')}</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.drivers.placeholders.firstName')}
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.drivers.fields.lastName')}</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.drivers.placeholders.lastName')}
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.drivers.fields.email')}</label>
                  <input
                    type="email"
                    className="input-glass"
                    placeholder={t('dashboard.drivers.placeholders.email')}
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.drivers.fields.phone')}</label>
                  <PhoneInput
                    international
                    defaultCountry="CM"
                    value={form.phone}
                    onChange={(value) => setForm((prev) => ({ ...prev, phone: value || '' }))}
                    placeholder={t('dashboard.drivers.placeholders.phone')}
                    className="input-glass"
                    numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.vehicle')}</label>
                <select
                  className="input-glass"
                  value={form.vehicleId}
                  onChange={(e) => setForm((prev) => ({ ...prev, vehicleId: e.target.value }))}
                >
                  <option value="">{t('dashboard.drivers.placeholders.vehicleOptional')}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} ({vehicle.plateNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.password')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.drivers.placeholders.password')}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                    onClick={() => setForm((prev) => ({ ...prev, password: generatePassword() }))}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button className="w-full btn-primary gap-2" onClick={handleCreateDriver} disabled={isCreating}>
                <Save className="w-4 h-4" />
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.drivers.edit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.firstName')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.drivers.placeholders.firstName')}
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.lastName')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.drivers.placeholders.lastName')}
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.email')}</label>
                <input
                  type="email"
                  className="input-glass opacity-70"
                  value={editForm.email}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.drivers.fields.phone')}</label>
                <PhoneInput
                  international
                  defaultCountry="CM"
                  value={editForm.phone}
                  onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value || '' }))}
                  placeholder={t('dashboard.drivers.placeholders.phone')}
                  className="input-glass"
                  numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.drivers.fields.vehicle')}</label>
              <select
                className="input-glass"
                value={editForm.vehicleId}
                onChange={(e) => setEditForm((prev) => ({ ...prev, vehicleId: e.target.value }))}
              >
                <option value="">{t('dashboard.drivers.placeholders.vehicleOptional')}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.plateNumber})
                  </option>
                ))}
              </select>
            </div>

            <Button className="w-full btn-primary gap-2" onClick={handleUpdateDriver} disabled={isUpdating}>
              <Save className="w-4 h-4" />
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.drivers.credentials.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white">
              <div>
                <span className="text-white/60">{t('dashboard.drivers.credentials.user')}:</span> {credentialPayload?.name || '-'}
              </div>
              <div>
                <span className="text-white/60">{t('dashboard.drivers.fields.email')}:</span> {credentialPayload?.email || '-'}
              </div>
              <div>
                <span className="text-white/60">{t('dashboard.drivers.fields.password')}:</span> {credentialPayload?.password || '-'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={copyCredentials}>
                <Copy className="w-4 h-4" />
                {t('dashboard.drivers.credentials.copy')}
              </Button>
              <Button type="button" variant="outline" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={shareCredentials}>
                <Share2 className="w-4 h-4" />
                {t('dashboard.drivers.credentials.share')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteDriver)} onOpenChange={(open) => !open && setDeleteDriver(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">{t('dashboard.drivers.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteDriver}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {drivers.map((driver) => (
          <div key={driver.id} className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(driver.email)}`}
                  alt={`${driver.firstName} ${driver.lastName}`}
                  className="w-12 h-12 rounded-full bg-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {driver.firstName} {driver.lastName}
                  </p>
                  <p className="text-xs text-white/50 truncate">{driver.email}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEdit(driver)}>
                    {t('common.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleResetPassword(driver)}>
                    {t('dashboard.drivers.actions.resetPassword')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleToggleActive(driver)}>
                    {driver.isActive ? t('dashboard.drivers.actions.deactivate') : t('dashboard.drivers.actions.activate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-500/10" onClick={() => setDeleteDriver(driver)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Mail className="w-4 h-4" />
                <span className="truncate">{driver.email}</span>
              </div>
              {driver.phone ? (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Phone className="w-4 h-4" />
                  <span>{driver.phone}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Truck className="w-4 h-4" />
                <span className="truncate">{driver.vehicleId ? vehicleLabelById.get(driver.vehicleId) || '-' : '-'}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <span className={`inline-flex items-center gap-1 text-sm ${driver.isActive ? 'text-green-400' : 'text-gray-400'}`}>
                {driver.isActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                {driver.isActive ? t('common.active') : t('common.inactive')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && drivers.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50">{t('dashboard.drivers.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          {t('dashboard.drivers.pagination.summary', {
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
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page <= 1}
          >
            {t('dashboard.drivers.pagination.previous')}
          </Button>
          <div className="text-sm text-white/70 min-w-[80px] text-center w-full sm:w-auto">
            {t('dashboard.drivers.pagination.page', { page, totalPages })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={isLoading || page >= totalPages}
          >
            {t('dashboard.drivers.pagination.next')}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-white/60">{t('common.loading')}</div>}
    </div>
  );
};

export default DriversPage;
