import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Calendar, Download, FileText, Filter, PieChart as PieChartIcon, Share2, Store, Truck, Users } from 'lucide-react';
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

type ReportType = 'deliveries' | 'financial' | 'driver' | 'inventory' | 'partner';

type ReportResponse = {
  type: ReportType;
  currency: string;
  summary: Record<string, number>;
  series: Array<Record<string, number | string>>;
  distribution: Array<{ key: string; value: number }>;
  rows: Array<Record<string, number | string | boolean>>;
  filters: {
    partners: Array<{ id: string; label: string }>;
    drivers: Array<{ id: string; label: string }>;
  };
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const monthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toIsoDate(first), to: toIsoDate(now) };
};

const reportTypes: Array<{ key: ReportType; icon: any }> = [
  { key: 'deliveries', icon: Truck },
  { key: 'financial', icon: BarChart3 },
  { key: 'driver', icon: Users },
  { key: 'inventory', icon: FileText },
  { key: 'partner', icon: Store },
];

const ReportsPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const [selectedReport, setSelectedReport] = useState<ReportType>('deliveries');
  const [dateFrom, setDateFrom] = useState(monthRange().from);
  const [dateTo, setDateTo] = useState(monthRange().to);
  const [partnerId, setPartnerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ReportResponse | null>(null);

  const formatMoney = useCallback(
    (value: number) => {
      const currency = String(data?.currency || 'XAF').toUpperCase();
      try {
        return new Intl.NumberFormat(i18n.language || 'fr', {
          style: 'currency',
          currency,
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
    [data?.currency, i18n.language]
  );

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', selectedReport);
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (partnerId) params.set('partnerId', partnerId);
      if (driverId) params.set('driverId', driverId);
      if (status) params.set('status', status);

      const response = await fetch(`/api/dashboard/reports?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setData(payload as ReportResponse);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, driverId, partnerId, selectedReport, showToast, status, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const summaryConfig = useMemo(() => {
    if (selectedReport === 'deliveries') {
      return ['total', 'delivered', 'cancelled', 'inTransit', 'successRate'];
    }
    if (selectedReport === 'financial') {
      return ['collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net'];
    }
    if (selectedReport === 'driver') {
      return ['totalDrivers', 'activeDrivers', 'totalAssigned', 'delivered', 'successRate'];
    }
    if (selectedReport === 'inventory') {
      return ['totalProducts', 'totalStock', 'lowStock', 'outOfStock', 'stockValue'];
    }
    return ['totalPartners', 'activePartners', 'totalDeliveries', 'delivered', 'commissions', 'collected'];
  }, [selectedReport]);

  const seriesConfig = useMemo(() => {
    if (selectedReport === 'deliveries') return ['total', 'delivered', 'cancelled'];
    if (selectedReport === 'financial') return ['collected', 'commissions', 'internalExpenses', 'partnerExpenses'];
    if (selectedReport === 'driver') return ['assigned', 'delivered', 'cancelled'];
    if (selectedReport === 'inventory') return ['entries', 'exits', 'adjustments'];
    return ['deliveries', 'delivered', 'commissions'];
  }, [selectedReport]);

  const tableColumns = useMemo(() => {
    if (selectedReport === 'deliveries') return ['id', 'date', 'partner', 'driver', 'status', 'orderValue', 'deliveryFee'];
    if (selectedReport === 'financial') return ['date', 'collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net'];
    if (selectedReport === 'driver') return ['driver', 'phone', 'isActive', 'assigned', 'delivered', 'cancelled', 'failed', 'successRate', 'commissions'];
    if (selectedReport === 'inventory') return ['sku', 'name', 'partner', 'price', 'stock', 'minStock', 'status', 'stockValue'];
    return ['partner', 'deliveries', 'delivered', 'cancelled', 'commissions', 'collected', 'successRate'];
  }, [selectedReport]);

  const colorBySeries: Record<string, string> = {
    total: '#F97316',
    deliveries: '#F97316',
    delivered: '#10B981',
    cancelled: '#EF4444',
    inTransit: '#3B82F6',
    commissions: '#8B5CF6',
    collected: '#22C55E',
    internalExpenses: '#EF4444',
    partnerExpenses: '#F59E0B',
    assigned: '#3B82F6',
    entries: '#10B981',
    exits: '#EF4444',
    adjustments: '#F59E0B',
  };

  const axisStroke = 'hsl(var(--muted-foreground))';
  const gridStroke = 'hsl(var(--border))';
  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  const chartData = useMemo(
    () =>
      (data?.series || []).map((item) => ({
        ...item,
        label: new Date(String(item.date || '')).toLocaleDateString(i18n.language || 'fr', {
          day: '2-digit',
          month: '2-digit',
        }),
      })),
    [data?.series, i18n.language]
  );

  const distributionData = useMemo(
    () =>
      (data?.distribution || []).map((item, index) => ({
        ...item,
        color: ['#F97316', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#22C55E', '#F59E0B'][index % 7],
      })),
    [data?.distribution]
  );

  const formatMetricValue = (key: string, value: number) => {
    if (['successRate'].includes(key)) return `${Number(value || 0).toFixed(1)}%`;
    if (['collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net', 'stockValue', 'price', 'orderValue', 'deliveryFee'].includes(key)) {
      return formatMoney(value);
    }
    return Number(value || 0).toLocaleString(i18n.language || 'fr');
  };

  const formatCell = (column: string, value: unknown) => {
    if (value === null || value === undefined) return '-';
    if (column === 'status') return t(`dashboard.deliveries.status.${String(value)}`);
    if (column === 'isActive') return value ? t('common.yes') : t('common.no');
    if (column === 'successRate') return `${Number(value || 0).toFixed(1)}%`;
    if (['collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net', 'stockValue', 'price', 'orderValue', 'deliveryFee'].includes(column)) {
      return formatMoney(Number(value || 0));
    }
    if (column === 'date') return new Date(String(value)).toLocaleDateString(i18n.language || 'fr');
    return String(value);
  };

  const getDistributionLabel = (key: string) => {
    if (selectedReport === 'deliveries') return t(`dashboard.deliveries.status.${key}`);
    if (selectedReport === 'financial') return t(`dashboard.expenses.categories.${key}`);
    if (selectedReport === 'inventory') return t(`dashboard.reports.distribution.${key}`);
    return key;
  };

  const exportRows = (separator: ',' | '\t', extension: 'csv' | 'xls') => {
    if (!data?.rows?.length) {
      showToast(t('dashboard.reports.empty'), 'warning');
      return;
    }
    const headers = tableColumns.map((column) => t(`dashboard.reports.columns.${column}`));
    const lines = [
      headers.join(separator),
      ...data.rows.map((row) => tableColumns.map((column) => `"${String(formatCell(column, row[column]) || '').replace(/"/g, '""')}"`).join(separator)),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `report-${selectedReport}-${dateFrom}-${dateTo}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/dashboard/reports?type=${selectedReport}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    if (navigator.share) {
      await navigator.share({
        title: t('dashboard.reports.title'),
        text: t('dashboard.reports.subtitle'),
        url: shareUrl,
      });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    showToast(t('dashboard.reports.linkCopied'), 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.reports.title')}</h1>
          <p className="text-white/50">{t('dashboard.reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            {t('dashboard.reports.share')}
          </Button>
          <Button type="button" className="btn-primary gap-2" onClick={() => exportRows(',', 'csv')}>
            <Download className="w-4 h-4" />
            {t('dashboard.reports.export.csv')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes.map((report) => (
          <button
            key={report.key}
            type="button"
            onClick={() => setSelectedReport(report.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              selectedReport === report.key ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <report.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{t(`dashboard.reports.types.${report.key}`)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Calendar className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="date" className="input-glass pl-10 w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="relative lg:col-span-2">
          <Calendar className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="date" className="input-glass pl-10 w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <select className="input-glass" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">{t('dashboard.reports.filters.allPartners')}</option>
          {(data?.filters?.partners || []).map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.label}
            </option>
          ))}
        </select>
        <select className="input-glass" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">{t('dashboard.reports.filters.allDrivers')}</option>
          {(data?.filters?.drivers || []).map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={loadReport}>
          <Filter className="w-4 h-4" />
          {t('dashboard.reports.applyFilters')}
        </Button>
        <select className="input-glass w-[220px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('dashboard.reports.filters.allStatuses')}</option>
          {['pending', 'assigned', 'inTransit', 'delivered', 'failed', 'cancelled'].map((statusKey) => (
            <option key={statusKey} value={statusKey}>
              {t(`dashboard.deliveries.status.${statusKey}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {summaryConfig.map((metricKey) => (
          <div key={metricKey} className="glass-card p-4">
            <div className="text-xs text-white/60">{t(`dashboard.reports.metrics.${selectedReport}.${metricKey}`)}</div>
            <div className="text-xl font-semibold text-white mt-1">
              {formatMetricValue(metricKey, Number(data?.summary?.[metricKey] || 0))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('dashboard.reports.charts.timeline')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
                <XAxis dataKey="label" stroke={axisStroke} fontSize={12} />
                <YAxis stroke={axisStroke} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                {seriesConfig.map((seriesKey) => (
                  <Area
                    key={seriesKey}
                    type="monotone"
                    dataKey={seriesKey}
                    name={t(`dashboard.reports.series.${seriesKey}`)}
                    stroke={colorBySeries[seriesKey] || '#F97316'}
                    fillOpacity={0.18}
                    fill={colorBySeries[seriesKey] || '#F97316'}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('dashboard.reports.charts.distribution')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distributionData} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={95}>
                  {distributionData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, key: string) => [Number(value || 0).toLocaleString(i18n.language || 'fr'), getDistributionLabel(String(key || ''))]}
                  labelFormatter={(label) => getDistributionLabel(String(label || ''))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {distributionData.map((entry) => (
              <div key={entry.key} className="text-xs text-white/65 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{getDistributionLabel(entry.key)}</span>
                <span className="text-white">{entry.value.toLocaleString(i18n.language || 'fr')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{t('dashboard.reports.table.title')}</h3>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={() => exportRows(',', 'csv')}>
              <Download className="w-4 h-4" />
              {t('dashboard.reports.export.csv')}
            </Button>
            <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={() => exportRows('\t', 'xls')}>
              <PieChartIcon className="w-4 h-4" />
              {t('dashboard.reports.export.excel')}
            </Button>
          </div>
        </div>
        {isLoading ? <div className="text-white/60">{t('common.loading')}</div> : null}
        {!isLoading && !data?.rows?.length ? <div className="text-white/50">{t('dashboard.reports.empty')}</div> : null}
        {data?.rows?.length ? (
          <div className="overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-white/5">
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column} className="text-left text-white/70 font-medium px-3 py-2">
                      {t(`dashboard.reports.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                    {tableColumns.map((column) => (
                      <td key={column} className="px-3 py-2 text-white/85 whitespace-nowrap">
                        {formatCell(column, row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReportsPage;

