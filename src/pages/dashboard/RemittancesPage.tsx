import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandCoins, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

type RemittancePartner = {
  partnerId: string;
  partnerName: string;
  collected: number;
  due: number;
  remitted: number;
  balance: number;
};

type RemittanceHistory = {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  currency: string;
  remittanceDate: string;
  note: string;
  createdAt: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const RemittancesPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();

  const [summary, setSummary] = useState({ collected: 0, remitted: 0, balance: 0 });
  const [partners, setPartners] = useState<RemittancePartner[]>([]);
  const [history, setHistory] = useState<RemittanceHistory[]>([]);
  const [currency, setCurrency] = useState('XAF');

  const [search, setSearch] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RemittanceHistory | null>(null);

  const [form, setForm] = useState({
    partnerId: '',
    amount: 0,
    remittanceDate: todayIso(),
    note: '',
  });

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.partnerId === form.partnerId) || null,
    [form.partnerId, partners]
  );

  const formatMoney = useCallback(
    (value: number) => {
      try {
        return new Intl.NumberFormat(i18n.language || 'fr', {
          style: 'currency',
          currency: currency || 'XAF',
          maximumFractionDigits: 0,
        }).format(Number(value || 0));
      } catch {
        return new Intl.NumberFormat(i18n.language || 'fr', {
          style: 'currency',
          currency: 'XAF',
          maximumFractionDigits: 0,
        }).format(Number(value || 0));
      }
    },
    [currency, i18n.language]
  );

  const loadCurrency = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/settings/company', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) return;
      setCurrency(String(data?.company?.deliveryPricing?.currency || 'XAF').toUpperCase());
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search.trim()) params.set('search', search.trim());
      if (partnerFilter) params.set('partnerId', partnerFilter);

      const response = await fetch(`/api/dashboard/remittances?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setSummary({
        collected: Number(data?.summary?.collected || 0),
        remitted: Number(data?.summary?.remitted || 0),
        balance: Number(data?.summary?.balance || 0),
      });
      setPartners(Array.isArray(data?.partners) ? data.partners : []);
      setHistory(Array.isArray(data?.history) ? data.history : []);
      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, partnerFilter, search, showToast, t]);

  useEffect(() => {
    void loadCurrency();
  }, [loadCurrency]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshTick]);

  const openCreateForPartner = (partnerId: string) => {
    setForm({
      partnerId,
      amount: 0,
      remittanceDate: todayIso(),
      note: '',
    });
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.partnerId || Number(form.amount || 0) <= 0 || !form.remittanceDate) {
      showToast(t('dashboard.remittances.validation.required'), 'error');
      return;
    }
    if (selectedPartner && form.amount > selectedPartner.balance) {
      showToast(t('dashboard.remittances.validation.exceedsBalance'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/dashboard/remittances', {
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
      setForm({ partnerId: '', amount: 0, remittanceDate: todayIso(), note: '' });
      setPage(1);
      setRefreshTick((value) => value + 1);
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/remittances/${deleteItem.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setDeleteItem(null);
      setRefreshTick((value) => value + 1);
      showToast(t('common.delete'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.remittances.title')}</h1>
          <p className="text-white/50">{t('dashboard.remittances.subtitle')}</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" onClick={() => openCreateForPartner(partners[0]?.partnerId || '')}>
              <Plus className="w-4 h-4" />
              {t('dashboard.remittances.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.remittances.create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm text-white/50">{t('dashboard.remittances.fields.partner')}</label>
                <select
                  className="input-glass"
                  value={form.partnerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, partnerId: e.target.value }))}
                >
                  <option value="">{t('dashboard.remittances.placeholders.partner')}</option>
                  {partners.map((partner) => (
                    <option key={partner.partnerId} value={partner.partnerId}>
                      {partner.partnerName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPartner ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="text-white/50">{t('dashboard.remittances.fields.currentBalance')}</div>
                  <div className="text-white font-semibold">{formatMoney(selectedPartner.balance)}</div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm text-white/50">{t('dashboard.remittances.fields.amount')}</label>
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
                  <label className="text-sm text-white/50">{t('dashboard.remittances.fields.date')}</label>
                  <input
                    type="date"
                    className="input-glass"
                    value={form.remittanceDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, remittanceDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.remittances.fields.note')}</label>
                <textarea
                  className="input-glass h-24 resize-none"
                  placeholder={t('dashboard.remittances.placeholders.note')}
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <Button className="w-full btn-primary" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="text-sm text-white/60">{t('dashboard.remittances.kpi.collected')}</div>
          <div className="text-2xl font-bold text-white mt-1">{formatMoney(summary.collected)}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-sm text-white/60">{t('dashboard.remittances.kpi.remitted')}</div>
          <div className="text-2xl font-bold text-white mt-1">{formatMoney(summary.remitted)}</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-sm text-white/60">{t('dashboard.remittances.kpi.balance')}</div>
          <div className="text-2xl font-bold text-white mt-1">{formatMoney(summary.balance)}</div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              className="input-glass pl-10 w-full"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="input-glass lg:w-[280px]"
            value={partnerFilter}
            onChange={(e) => {
              setPartnerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('dashboard.remittances.filters.allPartners')}</option>
            {partners.map((partner) => (
              <option key={partner.partnerId} value={partner.partnerId}>
                {partner.partnerName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {partners.map((partner) => (
            <div key={partner.partnerId} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{partner.partnerName}</div>
                  <div className="text-xs text-white/70 mt-1">
                    {t('dashboard.remittances.kpi.collected')}: {formatMoney(partner.collected)}
                  </div>
                  <div className="text-xs text-white/70">
                    {t('dashboard.remittances.kpi.remitted')}: {formatMoney(partner.remitted)}
                  </div>
                  <div className="text-sm text-orange-500 mt-1">
                    {t('dashboard.remittances.kpi.balance')}: {formatMoney(partner.balance)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                  onClick={() => openCreateForPartner(partner.partnerId)}
                  disabled={partner.balance <= 0}
                >
                  <HandCoins className="w-4 h-4" />
                  {t('dashboard.remittances.actions.initiate')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('dashboard.remittances.history.title')}</h3>
          <div className="text-sm text-white/60">
            {t('dashboard.remittances.pagination.summary', {
              from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, totalItems),
              total: totalItems,
            })}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-white/70">{t('dashboard.remittances.fields.date')}</th>
                <th className="px-3 py-2 text-left text-white/70">{t('dashboard.remittances.fields.partner')}</th>
                <th className="px-3 py-2 text-left text-white/70">{t('dashboard.remittances.fields.amount')}</th>
                <th className="px-3 py-2 text-left text-white/70">{t('dashboard.remittances.fields.note')}</th>
                <th className="px-3 py-2 text-left text-white/70">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 text-white/90">{new Date(item.remittanceDate).toLocaleDateString(i18n.language || 'fr')}</td>
                  <td className="px-3 py-2 text-white/90">{item.partnerName}</td>
                  <td className="px-3 py-2 text-white/90">{formatMoney(item.amount)}</td>
                  <td className="px-3 py-2 text-white/70">{item.note || '-'}</td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {t('common.delete')}
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/50">
                    {t('dashboard.remittances.history.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={isLoading || page <= 1}
            >
              {t('dashboard.remittances.pagination.previous')}
            </Button>
            <div className="text-sm text-white/70 min-w-[90px] text-center">
              {t('dashboard.remittances.pagination.page', { page, totalPages })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={isLoading || page >= totalPages}
            >
              {t('dashboard.remittances.pagination.next')}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">{t('dashboard.remittances.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="text-white/60 flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          {t('common.loading')}
        </div>
      ) : null}
    </div>
  );
};

export default RemittancesPage;

