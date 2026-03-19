import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  MoreVertical,
  Receipt,
  Fuel,
  Wrench,
  Users,
  Package,
  MoreHorizontal,
  Calendar,
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

type ExpenseCategory = 'fuel' | 'maintenance' | 'salaries' | 'equipment' | 'other';
type ExpenseTargetType = 'partner' | 'user' | 'vehicle' | 'other';

type ExpenseItem = {
  id: string;
  companyId: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  targetType: ExpenseTargetType;
  targetId: string;
  targetLabel: string;
  description: string;
  receipt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseForm = {
  amount: number;
  category: ExpenseCategory;
  date: string;
  targetType: ExpenseTargetType;
  targetId: string;
  targetLabel: string;
  description: string;
  receipt: string;
};

const expenseCategories: ExpenseCategory[] = ['fuel', 'maintenance', 'salaries', 'equipment', 'other'];
const expenseTargetTypes: ExpenseTargetType[] = ['partner', 'user', 'vehicle', 'other'];

const firstDayOfCurrentMonthIso = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return first.toISOString().slice(0, 10);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultForm: ExpenseForm = {
  amount: 0,
  category: 'other',
  date: todayIso(),
  targetType: 'other',
  targetId: '',
  targetLabel: '',
  description: '',
  receipt: '',
};

const ExpensesPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; name: string; plateNumber: string }>>([]);
  const [companyCurrency, setCompanyCurrency] = useState('XAF');

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | ExpenseTargetType>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [form, setForm] = useState<ExpenseForm>(defaultForm);
  const [editForm, setEditForm] = useState<ExpenseForm>(defaultForm);

  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<ExpenseItem | null>(null);

  const categoryIcons: Record<ExpenseCategory, any> = {
    fuel: Fuel,
    maintenance: Wrench,
    salaries: Users,
    equipment: Package,
    other: MoreHorizontal,
  };

  const categoryColors: Record<ExpenseCategory, string> = {
    fuel: 'bg-orange-500/20 text-orange-400',
    maintenance: 'bg-blue-500/20 text-blue-400',
    salaries: 'bg-green-500/20 text-green-400',
    equipment: 'bg-purple-500/20 text-purple-400',
    other: 'bg-gray-500/20 text-gray-400',
  };

  const targetTypeColors: Record<ExpenseTargetType, string> = {
    partner: 'bg-cyan-500/20 text-cyan-700',
    user: 'bg-emerald-500/20 text-emerald-700',
    vehicle: 'bg-amber-500/20 text-amber-700',
    other: 'bg-white/10 text-white/70',
  };

  const formatMoney = (value: number) => {
    const currency = String(companyCurrency || 'XAF').toUpperCase();
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

  const totalAmountOnPage = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const loadMeta = useCallback(async () => {
    try {
      const [partnersRes, usersRes, settingsRes] = await Promise.all([
        fetch('/api/dashboard/partners?page=1&pageSize=100', { cache: 'no-store' }),
        fetch('/api/dashboard/users?page=1&pageSize=100', { cache: 'no-store' }),
        fetch('/api/dashboard/settings/company', { cache: 'no-store' }),
      ]);
      const [partnersData, usersData, settingsData] = await Promise.all([
        partnersRes.json(),
        usersRes.json(),
        settingsRes.json(),
      ]);

      if (partnersRes.ok) {
        const incoming = Array.isArray(partnersData?.partners) ? partnersData.partners : [];
        setPartners(
          incoming
            .map((partner: any) => ({ id: String(partner.id || ''), name: String(partner.name || '') }))
            .filter((partner: { id: string; name: string }) => Boolean(partner.id && partner.name))
        );
      }

      if (usersRes.ok) {
        const incoming = Array.isArray(usersData?.users) ? usersData.users : [];
        setUsers(
          incoming
            .map((user: any) => ({
              id: String(user.id || ''),
              firstName: String(user.firstName || ''),
              lastName: String(user.lastName || ''),
              email: String(user.email || ''),
            }))
            .filter((user: { id: string }) => Boolean(user.id))
        );
      }

      if (settingsRes.ok) {
        const currency = String(settingsData?.company?.deliveryPricing?.currency || '').trim().toUpperCase();
        setCompanyCurrency(currency || 'XAF');
        const incomingVehicles = Array.isArray(settingsData?.company?.vehicles) ? settingsData.company.vehicles : [];
        setVehicles(
          incomingVehicles
            .filter((vehicle: any) => vehicle?.isActive !== false)
            .map((vehicle: any) => ({
              id: String(vehicle.id || ''),
              name: String(vehicle.name || ''),
              plateNumber: String(vehicle.plateNumber || ''),
            }))
            .filter((vehicle: { id: string }) => Boolean(vehicle.id))
        );
      }
    } catch {
      // ignore: page can still function with partial metadata
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (targetTypeFilter !== 'all') params.set('targetType', targetTypeFilter);

      const response = await fetch(`/api/dashboard/expenses?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setExpenses(Array.isArray(data?.expenses) ? data.expenses : []);
      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, page, pageSize, searchQuery, showToast, t, targetTypeFilter]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses, refreshTick]);

  const resetCreateForm = () => {
    setForm({ ...defaultForm, date: todayIso() });
  };

  const openEditDialog = (expense: ExpenseItem) => {
    setSelectedExpense(expense);
    setEditForm({
      amount: Number(expense.amount || 0),
      category: expense.category,
      date: String(expense.date).slice(0, 10),
      targetType: expense.targetType,
      targetId: expense.targetId || '',
      targetLabel: expense.targetLabel || '',
      description: expense.description || '',
      receipt: expense.receipt || '',
    });
    setIsEditDialogOpen(true);
  };

  const getTargetDisplay = (targetType: ExpenseTargetType, targetId: string, targetLabel: string) => {
    if (targetType === 'partner') {
      const found = partners.find((partner) => partner.id === targetId);
      return found?.name || targetLabel || '-';
    }
    if (targetType === 'user') {
      const found = users.find((user) => user.id === targetId);
      return (found ? `${found.firstName} ${found.lastName}`.trim() : '') || targetLabel || '-';
    }
    if (targetType === 'vehicle') {
      const found = vehicles.find((vehicle) => vehicle.id === targetId);
      return found ? `${found.name} (${found.plateNumber})` : targetLabel || '-';
    }
    return targetLabel || '-';
  };

  const validateForm = (payload: ExpenseForm) => {
    if (Number(payload.amount || 0) <= 0 || !payload.date) return false;
    if (payload.targetType === 'partner' || payload.targetType === 'user' || payload.targetType === 'vehicle') {
      return Boolean(payload.targetId);
    }
    if (payload.targetType === 'other') {
      return Boolean(payload.targetLabel.trim());
    }
    return true;
  };

  const toPayload = (payload: ExpenseForm) => ({
    amount: Number(payload.amount || 0),
    category: payload.category,
    date: payload.date,
    targetType: payload.targetType,
    targetId: payload.targetId,
    targetLabel:
      payload.targetType === 'other'
        ? payload.targetLabel
        : getTargetDisplay(payload.targetType, payload.targetId, payload.targetLabel),
    description: payload.description,
    receipt: payload.receipt,
  });

  const handleCreateExpense = async () => {
    if (!validateForm(form)) {
      showToast(t('dashboard.expenses.validation.required'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/dashboard/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsCreateDialogOpen(false);
      resetCreateForm();
      showToast(t('common.saved'), 'success');
      setPage(1);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense) return;
    if (!validateForm(editForm)) {
      showToast(t('dashboard.expenses.validation.required'), 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/dashboard/expenses/${selectedExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(editForm)),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsEditDialogOpen(false);
      setSelectedExpense(null);
      showToast(t('common.saved'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/expenses/${deleteExpense.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setDeleteExpense(null);
      showToast(t('common.delete'), 'success');
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTargetSelector = (
    currentForm: ExpenseForm,
    setCurrentForm: React.Dispatch<React.SetStateAction<ExpenseForm>>
  ) => {
    if (currentForm.targetType === 'partner') {
      return (
        <select
          className="input-glass"
          value={currentForm.targetId}
          onChange={(e) =>
            setCurrentForm((prev) => ({
              ...prev,
              targetId: e.target.value,
              targetLabel: partners.find((partner) => partner.id === e.target.value)?.name || '',
            }))
          }
        >
          <option value="">{t('dashboard.expenses.placeholders.partner')}</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
      );
    }

    if (currentForm.targetType === 'user') {
      return (
        <select
          className="input-glass"
          value={currentForm.targetId}
          onChange={(e) =>
            setCurrentForm((prev) => {
              const user = users.find((item) => item.id === e.target.value);
              return {
                ...prev,
                targetId: e.target.value,
                targetLabel: user ? `${user.firstName} ${user.lastName}`.trim() : '',
              };
            })
          }
        >
          <option value="">{t('dashboard.expenses.placeholders.user')}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {`${user.firstName} ${user.lastName}`.trim() || user.email}
            </option>
          ))}
        </select>
      );
    }

    if (currentForm.targetType === 'vehicle') {
      return (
        <select
          className="input-glass"
          value={currentForm.targetId}
          onChange={(e) =>
            setCurrentForm((prev) => {
              const vehicle = vehicles.find((item) => item.id === e.target.value);
              return {
                ...prev,
                targetId: e.target.value,
                targetLabel: vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : '',
              };
            })
          }
        >
          <option value="">{t('dashboard.expenses.placeholders.vehicle')}</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name} ({vehicle.plateNumber})
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        className="input-glass"
        value={currentForm.targetLabel}
        placeholder={t('dashboard.expenses.placeholders.otherTarget')}
        onChange={(e) => setCurrentForm((prev) => ({ ...prev, targetLabel: e.target.value, targetId: '' }))}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.expenses.title')}</h1>
          <p className="text-white/50">
            {t('dashboard.expenses.subtitle')} {formatMoney(totalAmountOnPage)}
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" onClick={resetCreateForm}>
              <Plus className="w-4 h-4" />
              {t('dashboard.expenses.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.expenses.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.expenses.fields.amount')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input-glass"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.expenses.fields.category')}</label>
                  <select
                    className="input-glass"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                  >
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {t(`dashboard.expenses.categories.${category}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.expenses.fields.date')}</label>
                  <input
                    type="date"
                    className="input-glass"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.expenses.fields.targetType')}</label>
                  <select
                    className="input-glass"
                    value={form.targetType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        targetType: e.target.value as ExpenseTargetType,
                        targetId: '',
                        targetLabel: '',
                      }))
                    }
                  >
                    {expenseTargetTypes.map((targetType) => (
                      <option key={targetType} value={targetType}>
                        {t(`dashboard.expenses.targetTypes.${targetType}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.target')}</label>
                {renderTargetSelector(form, setForm)}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.description')}</label>
                <textarea
                  className="input-glass h-20 resize-none"
                  placeholder={t('dashboard.expenses.placeholders.description')}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.receipt')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.expenses.placeholders.receipt')}
                  value={form.receipt}
                  onChange={(e) => setForm((prev) => ({ ...prev, receipt: e.target.value }))}
                />
              </div>

              <Button className="w-full btn-primary gap-2" onClick={handleCreateExpense} disabled={isCreating}>
                <Save className="w-4 h-4" />
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.expenses.edit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.amount')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-glass"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.category')}</label>
                <select
                  className="input-glass"
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {t(`dashboard.expenses.categories.${category}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.date')}</label>
                <input
                  type="date"
                  className="input-glass"
                  value={editForm.date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.expenses.fields.targetType')}</label>
                <select
                  className="input-glass"
                  value={editForm.targetType}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      targetType: e.target.value as ExpenseTargetType,
                      targetId: '',
                      targetLabel: '',
                    }))
                  }
                >
                  {expenseTargetTypes.map((targetType) => (
                    <option key={targetType} value={targetType}>
                      {t(`dashboard.expenses.targetTypes.${targetType}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.expenses.fields.target')}</label>
              {renderTargetSelector(editForm, setEditForm)}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.expenses.fields.description')}</label>
              <textarea
                className="input-glass h-20 resize-none"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.expenses.fields.receipt')}</label>
              <input
                type="text"
                className="input-glass"
                value={editForm.receipt}
                onChange={(e) => setEditForm((prev) => ({ ...prev, receipt: e.target.value }))}
              />
            </div>

            <Button className="w-full btn-primary gap-2" onClick={handleUpdateExpense} disabled={isUpdating}>
              <Save className="w-4 h-4" />
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteExpense)} onOpenChange={(open) => !open && setDeleteExpense(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">{t('dashboard.expenses.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteExpense} disabled={isDeleting}>
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_180px] gap-3">
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

        <input
          type="date"
          className="input-glass"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          aria-label={t('dashboard.expenses.filters.dateFrom')}
        />

        <input
          type="date"
          className="input-glass"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          aria-label={t('dashboard.expenses.filters.dateTo')}
        />

        <select
          className="input-glass"
          value={targetTypeFilter}
          onChange={(e) => {
            setTargetTypeFilter(e.target.value as 'all' | ExpenseTargetType);
            setPage(1);
          }}
        >
          <option value="all">{t('dashboard.expenses.filters.allTargets')}</option>
          {expenseTargetTypes.map((targetType) => (
            <option key={targetType} value={targetType}>
              {t(`dashboard.expenses.targetTypes.${targetType}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {expenses.map((expense) => {
          const Icon = categoryIcons[expense.category] || MoreHorizontal;
          const targetLabel = getTargetDisplay(expense.targetType, expense.targetId, expense.targetLabel);
          return (
            <div key={expense.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${categoryColors[expense.category]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-white font-semibold">{t(`dashboard.expenses.categories.${expense.category}`)}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${categoryColors[expense.category]}`}>
                        {t(`dashboard.expenses.categories.${expense.category}`)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${targetTypeColors[expense.targetType]}`}>
                        {t(`dashboard.expenses.targetTypes.${expense.targetType}`)}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 mt-1">{targetLabel}</p>
                    {expense.description ? <p className="text-sm text-white/70 mt-1">{expense.description}</p> : null}
                    <div className="flex items-center gap-2 text-xs text-white/50 mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(expense.date).toLocaleDateString(i18n.language || 'fr')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-base font-semibold text-white">{formatMoney(expense.amount)}</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEditDialog(expense)}>
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-500/10" onClick={() => setDeleteExpense(expense)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && expenses.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50">{t('dashboard.expenses.empty')}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          {t('dashboard.expenses.pagination.summary', {
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
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={isLoading || page <= 1}
          >
            {t('dashboard.expenses.pagination.previous')}
          </Button>
          <div className="text-sm text-white/70 min-w-[90px] text-center w-full sm:w-auto">
            {t('dashboard.expenses.pagination.page', { page, totalPages })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white w-full sm:w-auto"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={isLoading || page >= totalPages}
          >
            {t('dashboard.expenses.pagination.next')}
          </Button>
        </div>
      </div>

      {isLoading ? <div className="text-white/60">{t('common.loading')}</div> : null}
    </div>
  );
};

export default ExpensesPage;
