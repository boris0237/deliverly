'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Calendar, Search, User, Users, Truck, Package, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type CompanyListItem = {
  id: string;
  name: string;
  logo?: string;
  ownerUserId?: string;
  isActive: boolean;
  createdAt: string;
  billing: {
    planId: string;
    planName: string;
    status: string;
    interval: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
};

type CompanyDetails = {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  billing: {
    planName: string;
    status: string;
    interval: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  owner: { id: string; firstName: string; lastName: string; email: string } | null;
  stats: { users: number; drivers: number; partners: number; deliveries: number };
};

const SuperAdminCompaniesPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(i18n.language || 'fr');
  };

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
      });
      const response = await fetch(`/api/superadmin/companies?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setCompanies(payload.companies || []);
      setTotal(payload.total || 0);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, [page, pageSize, search]);

  const openDetails = async (companyId: string) => {
    setIsDetailLoading(true);
    setIsDetailOpen(true);
    try {
      const response = await fetch(`/api/superadmin/companies/${companyId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setSelectedCompany(payload.company);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const paginationLabel = useMemo(() => {
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    if (!total) return t('superadmin.companies.pagination.empty');
    return t('superadmin.companies.pagination.summary', { from, to, total });
  }, [page, pageSize, total, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('superadmin.companies.title')}</h1>
          <p className="text-white/50">{t('superadmin.companies.subtitle')}</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            className="input-glass pl-10 w-full"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t('superadmin.companies.search')}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-8 text-center text-white/60">{t('common.loading')}</div>
      ) : companies.length === 0 ? (
        <div className="glass-card p-8 text-center text-white/60">{t('superadmin.companies.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {companies.map((company) => {
            const subscriptionStart = company.billing.currentPeriodStart || company.createdAt;
            const subscriptionEnd = company.billing.trialEndsAt || company.billing.currentPeriodEnd;
            return (
              <div key={company.id} className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                      {company.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-white/60" />
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{company.name}</div>
                      <div className="text-xs text-white/50">{company.billing.planName || t('superadmin.companies.noPlan')}</div>
                    </div>
                  </div>
                  <Button variant="ghost" className="hover:bg-white/10" onClick={() => openDetails(company.id)}>
                    <Eye className="w-4 h-4 mr-2" />
                    {t('common.view')}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    <div className="text-xs text-white/50">{t('superadmin.companies.subscriptionStart')}</div>
                    <div className="text-white font-semibold">{formatDate(subscriptionStart)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                    <div className="text-xs text-white/50">{t('superadmin.companies.subscriptionEnd')}</div>
                    <div className="text-white font-semibold">{formatDate(subscriptionEnd)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-white/60">
                  <Calendar className="w-4 h-4" />
                  {t('superadmin.companies.createdAt', { date: formatDate(company.createdAt) })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/60">
        <div>{paginationLabel}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="hover:bg-white/10"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            {t('superadmin.companies.pagination.previous')}
          </Button>
          <span>{t('superadmin.companies.pagination.page', { page, totalPages })}</span>
          <Button
            variant="ghost"
            className="hover:bg-white/10"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            {t('superadmin.companies.pagination.next')}
          </Button>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">{t('superadmin.companies.detailsTitle')}</DialogTitle>
          </DialogHeader>
          {isDetailLoading || !selectedCompany ? (
            <div className="text-center text-white/60 py-8">{t('common.loading')}</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {selectedCompany.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedCompany.logo} alt={selectedCompany.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-white/60" />
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{selectedCompany.name}</div>
                  <div className="text-xs text-white/50">{selectedCompany.address || t('superadmin.companies.noAddress')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <div className="text-xs text-white/50">{t('superadmin.companies.plan')}</div>
                  <div className="text-white font-semibold">{selectedCompany.billing.planName || t('superadmin.companies.noPlan')}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <div className="text-xs text-white/50">{t('superadmin.companies.status')}</div>
                  <div className="text-white font-semibold">{t(`superadmin.companies.statuses.${selectedCompany.billing.status}`)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <div className="text-xs text-white/50">{t('superadmin.companies.subscriptionStart')}</div>
                  <div className="text-white font-semibold">{formatDate(selectedCompany.billing.currentPeriodStart || selectedCompany.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <div className="text-xs text-white/50">{t('superadmin.companies.subscriptionEnd')}</div>
                  <div className="text-white font-semibold">
                    {formatDate(selectedCompany.billing.trialEndsAt || selectedCompany.billing.currentPeriodEnd)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <Users className="w-4 h-4 text-white/50" />
                  <div className="text-xs text-white/50">{t('superadmin.companies.stats.users')}</div>
                  <div className="text-white font-semibold">{selectedCompany.stats.users}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <Truck className="w-4 h-4 text-white/50" />
                  <div className="text-xs text-white/50">{t('superadmin.companies.stats.drivers')}</div>
                  <div className="text-white font-semibold">{selectedCompany.stats.drivers}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <User className="w-4 h-4 text-white/50" />
                  <div className="text-xs text-white/50">{t('superadmin.companies.stats.partners')}</div>
                  <div className="text-white font-semibold">{selectedCompany.stats.partners}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70">
                  <Package className="w-4 h-4 text-white/50" />
                  <div className="text-xs text-white/50">{t('superadmin.companies.stats.deliveries')}</div>
                  <div className="text-white font-semibold">{selectedCompany.stats.deliveries}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminCompaniesPage;
