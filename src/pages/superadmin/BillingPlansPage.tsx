import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, DollarSign, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type BillingPlan = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  yearlyDiscountPercent: number;
  limits: {
    partners: number;
    drivers: number;
    users: number;
  };
  features: {
    tracking: boolean;
    financialReports: boolean;
    whatsappAssistant: boolean;
  };
  isActive: boolean;
};

type PlanForm = {
  name: string;
  description: string;
  priceUsd: number;
  yearlyDiscountPercent: number;
  limits: {
    partners: number;
    drivers: number;
    users: number;
  };
  features: {
    tracking: boolean;
    financialReports: boolean;
    whatsappAssistant: boolean;
  };
  isActive: boolean;
};

const emptyForm: PlanForm = {
  name: '',
  description: '',
  priceUsd: 0,
  yearlyDiscountPercent: 0,
  limits: {
    partners: 0,
    drivers: 0,
    users: 0,
  },
  features: {
    tracking: true,
    financialReports: true,
    whatsappAssistant: false,
  },
  isActive: true,
};

const BillingPlansPage = () => {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<BillingPlan | null>(null);
  const [deletePlan, setDeletePlan] = useState<BillingPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  const formatMoney = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(value || 0)
    );
  }, []);

  const annualPrice = useMemo(() => {
    const base = Number(form.priceUsd || 0) * 12;
    const discount = Math.min(100, Math.max(0, Number(form.yearlyDiscountPercent || 0)));
    return Math.max(0, base * (1 - discount / 100));
  }, [form.priceUsd, form.yearlyDiscountPercent]);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/superadmin/billing-plans?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setPlans(Array.isArray(data?.plans) ? data.plans : []);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, showToast, t]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const openCreate = () => {
    setForm(emptyForm);
    setIsCreateOpen(true);
  };

  const openEdit = (plan: BillingPlan) => {
    setEditPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || '',
      priceUsd: plan.priceUsd,
      yearlyDiscountPercent: plan.yearlyDiscountPercent,
      limits: { ...plan.limits },
      features: { ...plan.features },
      isActive: plan.isActive,
    });
    setIsEditOpen(true);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/superadmin/billing-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setIsCreateOpen(false);
      setForm(emptyForm);
      setPlans((prev) => [data.plan, ...prev]);
      showToast(t('superadmin.billingPlans.success.created'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/superadmin/billing-plans/${editPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setIsEditOpen(false);
      setEditPlan(null);
      setPlans((prev) => prev.map((item) => (item.id === data.plan.id ? data.plan : item)));
      showToast(t('superadmin.billingPlans.success.updated'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/superadmin/billing-plans/${deletePlan.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setPlans((prev) => prev.filter((plan) => plan.id !== deletePlan.id));
      setDeletePlan(null);
      showToast(t('superadmin.billingPlans.success.deleted'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (plan: BillingPlan, isActive: boolean) => {
    try {
      const response = await fetch(`/api/superadmin/billing-plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, isActive }),
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setPlans((prev) => prev.map((item) => (item.id === plan.id ? data.plan : item)));
    } catch {
      showToast(t('errors.network'), 'error');
    }
  };

  const PlanDialogForm = (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.name')}</label>
        <input
          className="input-glass"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder={t('superadmin.billingPlans.placeholders.name')}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.description')}</label>
        <textarea
          className="input-glass h-20 resize-none"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={t('superadmin.billingPlans.placeholders.description')}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.priceUsd')}</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="number"
              min={0}
              step="1"
              className="input-glass pl-10"
              value={form.priceUsd}
              onChange={(event) => setForm((prev) => ({ ...prev, priceUsd: Number(event.target.value || 0) }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.yearlyDiscount')}</label>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            className="input-glass"
            value={form.yearlyDiscountPercent}
            onChange={(event) => setForm((prev) => ({ ...prev, yearlyDiscountPercent: Number(event.target.value || 0) }))}
          />
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
        {t('superadmin.billingPlans.fields.yearlyPrice')}:{' '}
        <span className="font-semibold text-white">{formatMoney(annualPrice)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.partners')}</label>
          <input
            type="number"
            min={0}
            step="1"
            className="input-glass"
            value={form.limits.partners}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, limits: { ...prev.limits, partners: Number(event.target.value || 0) } }))
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.drivers')}</label>
          <input
            type="number"
            min={0}
            step="1"
            className="input-glass"
            value={form.limits.drivers}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, limits: { ...prev.limits, drivers: Number(event.target.value || 0) } }))
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/60">{t('superadmin.billingPlans.fields.users')}</label>
          <input
            type="number"
            min={0}
            step="1"
            className="input-glass"
            value={form.limits.users}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, limits: { ...prev.limits, users: Number(event.target.value || 0) } }))
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <div className="text-sm text-white">{t('superadmin.billingPlans.fields.tracking')}</div>
            <div className="text-xs text-white/50">{t('superadmin.billingPlans.fields.trackingHint')}</div>
          </div>
          <Switch
            checked={form.features.tracking}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, features: { ...prev.features, tracking: checked } }))}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <div className="text-sm text-white">{t('superadmin.billingPlans.fields.financialReports')}</div>
            <div className="text-xs text-white/50">{t('superadmin.billingPlans.fields.financialReportsHint')}</div>
          </div>
          <Switch
            checked={form.features.financialReports}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, features: { ...prev.features, financialReports: checked } }))
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <div className="text-sm text-white">{t('superadmin.billingPlans.fields.whatsapp')}</div>
            <div className="text-xs text-white/50">{t('superadmin.billingPlans.fields.whatsappHint')}</div>
          </div>
          <Switch
            checked={form.features.whatsappAssistant}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, features: { ...prev.features, whatsappAssistant: checked } }))
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <div className="text-sm text-white">{t('superadmin.billingPlans.fields.isActive')}</div>
            <div className="text-xs text-white/50">{t('superadmin.billingPlans.fields.isActiveHint')}</div>
          </div>
          <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('superadmin.billingPlans.title')}</h1>
          <p className="text-white/50">{t('superadmin.billingPlans.subtitle')}</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t('superadmin.billingPlans.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">{t('superadmin.billingPlans.create')}</DialogTitle>
            </DialogHeader>
            {PlanDialogForm}
            <Button className="w-full btn-primary" onClick={handleCreate} disabled={isSaving}>
              {isSaving ? t('common.loading') : t('common.save')}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            className="input-glass pl-10 w-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('superadmin.billingPlans.search')}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-8 text-center text-white/60">{t('common.loading')}</div>
      ) : plans.length === 0 ? (
        <div className="glass-card p-8 text-center text-white/60">{t('superadmin.billingPlans.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const yearly = plan.priceUsd * 12 * (1 - (plan.yearlyDiscountPercent || 0) / 100);
            return (
              <div key={plan.id} className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      {plan.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('superadmin.billingPlans.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-300">
                          <XCircle className="w-3 h-3" />
                          {t('superadmin.billingPlans.inactive')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50">{plan.description || t('superadmin.billingPlans.noDescription')}</p>
                  </div>
                  <Switch checked={plan.isActive} onCheckedChange={(checked) => handleToggleActive(plan, checked)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/50">{t('superadmin.billingPlans.monthly')}</div>
                    <div className="text-lg font-semibold text-white">{formatMoney(plan.priceUsd)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/50">{t('superadmin.billingPlans.yearlyDiscount')}</div>
                    <div className="text-lg font-semibold text-white">{plan.yearlyDiscountPercent}%</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-white/50">{t('superadmin.billingPlans.yearlyPrice')}</div>
                    <div className="text-lg font-semibold text-white">{formatMoney(yearly)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('superadmin.billingPlans.fields.partners')}: <span className="text-white font-semibold">{plan.limits.partners}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('superadmin.billingPlans.fields.drivers')}: <span className="text-white font-semibold">{plan.limits.drivers}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    {t('superadmin.billingPlans.fields.users')}: <span className="text-white font-semibold">{plan.limits.users}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">
                    {plan.features.tracking ? t('superadmin.billingPlans.feature.tracking') : t('superadmin.billingPlans.feature.noTracking')}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">
                    {plan.features.financialReports
                      ? t('superadmin.billingPlans.feature.financialReports')
                      : t('superadmin.billingPlans.feature.noFinancialReports')}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">
                    {plan.features.whatsappAssistant
                      ? t('superadmin.billingPlans.feature.whatsapp')
                      : t('superadmin.billingPlans.feature.noWhatsapp')}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" className="hover:bg-white/10" onClick={() => openEdit(plan)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" className="hover:bg-red-500/10 text-red-300" onClick={() => setDeletePlan(plan)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{t('superadmin.billingPlans.edit')}</DialogTitle>
          </DialogHeader>
          {PlanDialogForm}
          <Button className="w-full btn-primary" onClick={handleUpdate} disabled={isSaving}>
            {isSaving ? t('common.loading') : t('common.save')}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePlan} onOpenChange={(open) => !open && setDeletePlan(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('superadmin.billingPlans.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {t('superadmin.billingPlans.delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BillingPlansPage;
