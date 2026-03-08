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
  UserCheck,
  UserX,
  Copy,
  Share2,
  RefreshCw,
  Save,
  Trash2,
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

type DashboardUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  vehicleId?: string;
  role: 'superAdmin' | 'admin' | 'manager' | 'stockManager' | 'partnerManager' | 'driver' | 'accountant';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};

type UserForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleId: string;
  role: 'admin' | 'manager' | 'stockManager' | 'partnerManager' | 'driver' | 'accountant';
  password: string;
};

const DEFAULT_FORM: UserForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  vehicleId: '',
  role: 'manager',
  password: '',
};

const MANAGEABLE_ROLES: Array<UserForm['role']> = ['admin', 'manager', 'stockManager', 'partnerManager', 'driver', 'accountant'];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const UsersPage = () => {
  const { t } = useTranslation();
  const { showToast } = useUIStore();

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string; plateNumber: string; isActive: boolean }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);

  const [form, setForm] = useState<UserForm>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState<UserForm>(DEFAULT_FORM);

  const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<DashboardUser | null>(null);

  const [credentialPayload, setCredentialPayload] = useState<{ name: string; email: string; password: string } | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const response = await fetch(`/api/dashboard/users?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setUsers(Array.isArray(data?.users) ? data.users : []);
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
      // ignore silently: users page can work without vehicles list
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshTick]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const roleColors: Record<DashboardUser['role'], string> = useMemo(
    () => ({
      superAdmin: 'bg-red-500/20 text-red-400',
      admin: 'bg-orange-500/20 text-orange-400',
      manager: 'bg-blue-500/20 text-blue-400',
      stockManager: 'bg-green-500/20 text-green-400',
      partnerManager: 'bg-purple-500/20 text-purple-400',
      driver: 'bg-cyan-500/20 text-cyan-400',
      accountant: 'bg-pink-500/20 text-pink-400',
    }),
    []
  );

  const openCreate = () => {
    setForm({ ...DEFAULT_FORM, password: generatePassword() });
    setIsCreateDialogOpen(true);
  };

  const openEdit = (user: DashboardUser) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      vehicleId: user.vehicleId || '',
      role: (MANAGEABLE_ROLES.includes(user.role as UserForm['role']) ? user.role : 'manager') as UserForm['role'],
      password: '',
    });
    setIsEditDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim()) {
      showToast(t('dashboard.users.validation.required'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboard/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      showToast(t('dashboard.users.validation.required'), 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/dashboard/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phone: editForm.phone,
          role: editForm.role,
          vehicleId: editForm.role === 'driver' ? editForm.vehicleId : '',
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (user: DashboardUser) => {
    try {
      const response = await fetch(`/api/dashboard/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
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

  const handleResetPassword = async (user: DashboardUser) => {
    const nextPassword = generatePassword();
    try {
      const response = await fetch(`/api/dashboard/users/${user.id}`, {
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
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        password: nextPassword,
      });
      setIsCredentialsDialogOpen(true);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/users/${deleteUser.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeleteUser(null);
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
    const text = `${t('dashboard.users.credentials.user')}: ${credentialPayload.name}\n${t('dashboard.users.fields.email')}: ${credentialPayload.email}\n${t('dashboard.users.fields.password')}: ${credentialPayload.password}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('dashboard.users.credentials.copied'), 'success');
    } catch {
      showToast(t('errors.generic'), 'error');
    }
  };

  const shareCredentials = async () => {
    if (!credentialPayload) return;
    const text = `${t('dashboard.users.credentials.user')}: ${credentialPayload.name}\n${t('dashboard.users.fields.email')}: ${credentialPayload.email}\n${t('dashboard.users.fields.password')}: ${credentialPayload.password}`;

    if (!navigator.share) {
      showToast(t('dashboard.users.credentials.shareUnavailable'), 'warning');
      return;
    }

    try {
      await navigator.share({ text });
    } catch {
      // user cancelled share sheet: no toast needed
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.users.title')}</h1>
          <p className="text-white/50">{t('dashboard.users.subtitle')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t('dashboard.users.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.users.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.users.fields.firstName')}</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.users.placeholders.firstName')}
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.users.fields.lastName')}</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.users.placeholders.lastName')}
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.users.fields.email')}</label>
                  <input
                    type="email"
                    className="input-glass"
                    placeholder={t('dashboard.users.placeholders.email')}
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.users.fields.phone')}</label>
                  <PhoneInput
                    international
                    defaultCountry="CM"
                    value={form.phone}
                    onChange={(value) => setForm((prev) => ({ ...prev, phone: value || '' }))}
                    placeholder={t('dashboard.users.placeholders.phone')}
                    className="input-glass"
                    numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.role')}</label>
                <select
                  className="input-glass"
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => {
                      const nextRole = e.target.value as UserForm['role'];
                      return { ...prev, role: nextRole, vehicleId: nextRole === 'driver' ? prev.vehicleId : '' };
                    })
                  }
                >
                  {MANAGEABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`dashboard.users.roles.${role}`)}
                    </option>
                  ))}
                </select>
              </div>

              {form.role === 'driver' && (
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.users.fields.vehicle')}</label>
                  <select
                    className="input-glass"
                    value={form.vehicleId}
                    onChange={(e) => setForm((prev) => ({ ...prev, vehicleId: e.target.value }))}
                  >
                    <option value="">{t('dashboard.users.placeholders.vehicleOptional')}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.plateNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.password')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-glass"
                    placeholder={t('dashboard.users.placeholders.password')}
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

              <Button className="w-full btn-primary gap-2" onClick={handleCreateUser} disabled={isCreating}>
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
            <DialogTitle className="text-white">{t('dashboard.users.edit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.firstName')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.users.placeholders.firstName')}
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.lastName')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.users.placeholders.lastName')}
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.email')}</label>
                <input
                  type="email"
                  className="input-glass opacity-70"
                  placeholder={t('dashboard.users.placeholders.email')}
                  value={editForm.email}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.phone')}</label>
                <PhoneInput
                  international
                  defaultCountry="CM"
                  value={editForm.phone}
                  onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value || '' }))}
                  placeholder={t('dashboard.users.placeholders.phone')}
                  className="input-glass"
                  numberInputProps={{ className: 'bg-transparent w-full outline-none' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.users.fields.role')}</label>
              <select
                className="input-glass"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((prev) => {
                    const nextRole = e.target.value as UserForm['role'];
                    return { ...prev, role: nextRole, vehicleId: nextRole === 'driver' ? prev.vehicleId : '' };
                  })
                }
              >
                {MANAGEABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`dashboard.users.roles.${role}`)}
                  </option>
                ))}
              </select>
            </div>

            {editForm.role === 'driver' && (
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.users.fields.vehicle')}</label>
                <select
                  className="input-glass"
                  value={editForm.vehicleId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, vehicleId: e.target.value }))}
                >
                  <option value="">{t('dashboard.users.placeholders.vehicleOptional')}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} ({vehicle.plateNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button className="w-full btn-primary gap-2" onClick={handleUpdateUser} disabled={isUpdating}>
              <Save className="w-4 h-4" />
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.users.credentials.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-white">
              <div>
                <span className="text-white/60">{t('dashboard.users.credentials.user')}:</span> {credentialPayload?.name || '-'}
              </div>
              <div>
                <span className="text-white/60">{t('dashboard.users.fields.email')}:</span> {credentialPayload?.email || '-'}
              </div>
              <div>
                <span className="text-white/60">{t('dashboard.users.fields.password')}:</span> {credentialPayload?.password || '-'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={copyCredentials}>
                <Copy className="w-4 h-4" />
                {t('dashboard.users.credentials.copy')}
              </Button>
              <Button type="button" variant="outline" className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={shareCredentials}>
                <Share2 className="w-4 h-4" />
                {t('dashboard.users.credentials.share')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">{t('dashboard.users.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteUser}
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

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-white/50 border-b border-white/5">
                <th className="p-4 font-medium">{t('dashboard.users.table.user')}</th>
                <th className="p-4 font-medium">{t('dashboard.users.fields.role')}</th>
                <th className="p-4 font-medium">{t('dashboard.users.fields.status')}</th>
                <th className="p-4 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="w-10 h-10 rounded-full bg-white/10"
                      />
                      <div>
                        <div className="text-sm text-white font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-white/50">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${roleColors[user.role] || 'bg-white/10 text-white/60'}`}>
                      {t(`dashboard.users.roles.${user.role}`)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`flex items-center gap-1 text-sm ${user.isActive ? 'text-green-400' : 'text-gray-400'}`}>
                      {user.isActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      {user.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEdit(user)}>
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleResetPassword(user)}>
                          {t('dashboard.users.actions.resetPassword')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleToggleActive(user)}>
                          {user.isActive ? t('dashboard.users.actions.deactivate') : t('dashboard.users.actions.activate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-500/10" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <p className="text-white/50">{t('dashboard.users.empty')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          {t('dashboard.users.pagination.summary', {
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
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page <= 1}
          >
            {t('dashboard.users.pagination.previous')}
          </Button>
          <div className="text-sm text-white/70 min-w-[80px] text-center">
            {t('dashboard.users.pagination.page', { page, totalPages })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={isLoading || page >= totalPages}
          >
            {t('dashboard.users.pagination.next')}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-white/60">{t('common.loading')}</div>}
    </div>
  );
};

export default UsersPage;
