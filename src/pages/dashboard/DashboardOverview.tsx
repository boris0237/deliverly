import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Coins, Package, PiggyBank, Wallet } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type Period = 'today' | 'week' | 'month' | 'custom';

type OverviewResponse = {
  kpis: {
    totalDeliveries: number;
    amountCollected: number;
    totalExpenses: number;
    totalCommissions: number;
  };
  statusBreakdown?: {
    pending: number;
    assigned: number;
    inTransit: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
  trends?: Array<{ date: string; deliveries: number; commissions: number }>;
  topDrivers?: Array<{ driverId: string; name: string; completed: number; failed: number }>;
  recentDeliveries: Array<{
    id: string;
    customerName: string;
    customerPhone: string;
    address: string;
    status: string;
    deliveryDate: string;
    orderValue: number;
    deliveryFee: number;
  }>;
  currency: string;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getTodayRange = () => {
  const now = new Date();
  return { dateFrom: toIsoDate(now), dateTo: toIsoDate(now) };
};

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return { dateFrom: toIsoDate(monday), dateTo: toIsoDate(now) };
};

const getMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: toIsoDate(first), dateTo: toIsoDate(now) };
};

const DashboardOverview = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const initialMonthRange = useMemo(() => getMonthRange(), []);

  const [period, setPeriod] = useState<Period>('month');
  const [dateFrom, setDateFrom] = useState(initialMonthRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialMonthRange.dateTo);
  const [isLoading, setIsLoading] = useState(true);

  const [currency, setCurrency] = useState('XAF');
  const [kpis, setKpis] = useState({
    totalDeliveries: 0,
    amountCollected: 0,
    totalExpenses: 0,
    totalCommissions: 0,
  });
  const [statusBreakdown, setStatusBreakdown] = useState({
    pending: 0,
    assigned: 0,
    inTransit: 0,
    delivered: 0,
    failed: 0,
    cancelled: 0,
  });
  const [trends, setTrends] = useState<Array<{ date: string; deliveries: number; commissions: number }>>([]);
  const [topDrivers, setTopDrivers] = useState<Array<{ driverId: string; name: string; completed: number; failed: number }>>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<OverviewResponse['recentDeliveries']>([]);

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

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      const response = await fetch(`/api/dashboard/overview?${params.toString()}`, { cache: 'no-store' });
      const data: OverviewResponse & { error?: string; code?: string } = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      setKpis({
        totalDeliveries: Number(data?.kpis?.totalDeliveries || 0),
        amountCollected: Number(data?.kpis?.amountCollected || 0),
        totalExpenses: Number(data?.kpis?.totalExpenses || 0),
        totalCommissions: Number(data?.kpis?.totalCommissions || 0),
      });
      setCurrency(String(data?.currency || 'XAF').toUpperCase());
      setRecentDeliveries(Array.isArray(data?.recentDeliveries) ? data.recentDeliveries : []);
      setStatusBreakdown({
        pending: Number(data?.statusBreakdown?.pending || 0),
        assigned: Number(data?.statusBreakdown?.assigned || 0),
        inTransit: Number(data?.statusBreakdown?.inTransit || 0),
        delivered: Number(data?.statusBreakdown?.delivered || 0),
        failed: Number(data?.statusBreakdown?.failed || 0),
        cancelled: Number(data?.statusBreakdown?.cancelled || 0),
      });
      setTrends(Array.isArray(data?.trends) ? data.trends : []);
      setTopDrivers(Array.isArray(data?.topDrivers) ? data.topDrivers : []);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, showToast, t]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const applyPeriod = (nextPeriod: Exclude<Period, 'custom'>) => {
    const range = nextPeriod === 'today' ? getTodayRange() : nextPeriod === 'week' ? getWeekRange() : getMonthRange();
    setPeriod(nextPeriod);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const pieData = [
    { name: t('dashboard.deliveries.status.delivered'), value: statusBreakdown.delivered, color: '#10B981' },
    { name: t('dashboard.deliveries.status.inTransit'), value: statusBreakdown.inTransit + statusBreakdown.assigned, color: '#3B82F6' },
    { name: t('dashboard.deliveries.status.cancelled'), value: statusBreakdown.cancelled + statusBreakdown.failed, color: '#EF4444' },
    { name: t('dashboard.deliveries.status.pending'), value: statusBreakdown.pending, color: '#9CA3AF' },
  ];

  const trendData = trends.map((item) => ({
    day: new Date(item.date).toLocaleDateString(i18n.language || 'fr', { weekday: 'short' }),
    deliveries: item.deliveries,
    commissions: item.commissions,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.overview.title')}</h1>
          <p className="text-white/50">{t('dashboard.overview.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={`border-white/10 text-white ${period === 'today' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
            onClick={() => applyPeriod('today')}
          >
            {t('dashboard.overview.filters.today')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`border-white/10 text-white ${period === 'week' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
            onClick={() => applyPeriod('week')}
          >
            {t('dashboard.overview.filters.week')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`border-white/10 text-white ${period === 'month' ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
            onClick={() => applyPeriod('month')}
          >
            {t('dashboard.overview.filters.month')}
          </Button>
          <input
            type="date"
            className="input-glass w-[160px]"
            value={dateFrom}
            onChange={(event) => {
              setPeriod('custom');
              setDateFrom(event.target.value);
            }}
            aria-label={t('dashboard.overview.filters.dateFrom')}
          />
          <input
            type="date"
            className="input-glass w-[160px]"
            value={dateTo}
            onChange={(event) => {
              setPeriod('custom');
              setDateTo(event.target.value);
            }}
            aria-label={t('dashboard.overview.filters.dateTo')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">{t('dashboard.overview.stats.totalDeliveries')}</p>
              <h3 className="text-2xl font-bold text-white">{kpis.totalDeliveries.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-300" />
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">{t('dashboard.overview.stats.amountCollected')}</p>
              <h3 className="text-2xl font-bold text-white">{formatMoney(kpis.amountCollected)}</h3>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-300" />
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">{t('dashboard.overview.stats.totalExpenses')}</p>
              <h3 className="text-2xl font-bold text-white">{formatMoney(kpis.totalExpenses)}</h3>
            </div>
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <PiggyBank className="w-6 h-6 text-red-300" />
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">{t('dashboard.overview.stats.totalCommissions')}</p>
              <h3 className="text-2xl font-bold text-white">{formatMoney(kpis.totalCommissions)}</h3>
            </div>
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-orange-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.overview.charts.deliveryTrends')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorDeliveries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="deliveries" stroke="#FF6B00" fillOpacity={1} fill="url(#colorDeliveries)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.overview.charts.revenue')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="commissions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.overview.charts.driverPerformance')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDrivers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" fontSize={12} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="completed" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="failed" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.overview.charts.deliveryStatus')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('dashboard.overview.recentDeliveries')}</h3>
          <Link href="/dashboard/deliveries" className="text-sm text-orange-400 hover:text-orange-300">
            {t('dashboard.overview.viewAll')}
          </Link>
        </div>
        {isLoading ? <p className="text-white/60">{t('common.loading')}</p> : null}
        {!isLoading && recentDeliveries.length === 0 ? <p className="text-white/50">{t('dashboard.deliveries.empty')}</p> : null}
        <div className="space-y-3">
          {recentDeliveries.map((delivery) => (
            <div key={delivery.id} className="p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-white font-medium">{delivery.customerName || '-'}</p>
                  <p className="text-sm text-white/60">{delivery.customerPhone} • {delivery.address}</p>
                </div>
                <div className="text-sm text-white/70">{new Date(delivery.deliveryDate).toLocaleDateString(i18n.language || 'fr')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;

