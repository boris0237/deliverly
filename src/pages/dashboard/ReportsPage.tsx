import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Calendar, Download, FileText, PieChart as PieChartIcon, Share2, Store, Truck, Users } from 'lucide-react';
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
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';
import { buildSimplePdf } from '@/lib/pdf/simple-pdf';

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
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const isDriver = user?.role === 'driver';
  const currentUserId = String(user?.id || '');
  const [selectedReport, setSelectedReport] = useState<ReportType>('deliveries');
  const [dateFrom, setDateFrom] = useState(monthRange().from);
  const [dateTo, setDateTo] = useState(monthRange().to);
  const [partnerId, setPartnerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ReportResponse | null>(null);
  const currentReportType: ReportType = isDriver ? 'deliveries' : selectedReport;
  const currentDriverFilter = isDriver ? currentUserId : driverId;
  const visibleReportTypes = isDriver ? reportTypes.filter((report) => report.key === 'deliveries') : reportTypes;

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
      params.set('type', currentReportType);
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (!isDriver && partnerId) params.set('partnerId', partnerId);
      if (currentDriverFilter) params.set('driverId', currentDriverFilter);
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
  }, [currentDriverFilter, currentReportType, dateFrom, dateTo, isDriver, partnerId, showToast, status, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (isDriver && selectedReport !== 'deliveries') {
      setSelectedReport('deliveries');
    }
  }, [isDriver, selectedReport]);

  const summaryConfig = useMemo(() => {
    if (currentReportType === 'deliveries') {
      return ['total', 'delivered', 'cancelled', 'inTransit', 'successRate'];
    }
    if (currentReportType === 'financial') {
      return ['collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net'];
    }
    if (currentReportType === 'driver') {
      return ['totalDrivers', 'activeDrivers', 'totalAssigned', 'delivered', 'successRate'];
    }
    if (currentReportType === 'inventory') {
      return ['totalProducts', 'totalStock', 'lowStock', 'outOfStock', 'stockValue'];
    }
    return ['totalPartners', 'activePartners', 'totalDeliveries', 'delivered', 'commissions', 'extraCharges', 'partnerExpenses', 'collected'];
  }, [currentReportType]);

  const seriesConfig = useMemo(() => {
    if (currentReportType === 'deliveries') return ['total', 'delivered', 'cancelled'];
    if (currentReportType === 'financial') return ['collected', 'commissions', 'internalExpenses', 'partnerExpenses'];
    if (currentReportType === 'driver') return ['assigned', 'delivered', 'cancelled'];
    if (currentReportType === 'inventory') return ['entries', 'exits', 'adjustments'];
    return ['deliveries', 'delivered', 'commissions', 'extraCharges', 'partnerExpenses'];
  }, [currentReportType]);

  const tableColumns = useMemo(() => {
    if (currentReportType === 'deliveries') return ['id', 'date', 'partner', 'driver', 'status', 'orderValue', 'deliveryFee'];
    if (currentReportType === 'financial') return ['date', 'collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'net'];
    if (currentReportType === 'driver') return ['driver', 'phone', 'isActive', 'assigned', 'delivered', 'cancelled', 'failed', 'successRate', 'commissions'];
    if (currentReportType === 'inventory') return ['sku', 'name', 'partner', 'price', 'entries', 'exits', 'stock', 'status'];
    return ['partner', 'deliveries', 'delivered', 'cancelled', 'commissions', 'extraCharges', 'partnerExpenses', 'collected', 'successRate'];
  }, [currentReportType]);

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
    extraCharges: '#06B6D4',
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
    if (['collected', 'commissions', 'internalExpenses', 'partnerExpenses', 'extraCharges', 'net', 'stockValue', 'price', 'orderValue', 'deliveryFee'].includes(key)) {
      return formatMoney(value);
    }
    return Number(value || 0).toLocaleString(i18n.language || 'fr');
  };

  const formatCell = (column: string, value: unknown) => {
    if (value === null || value === undefined) return '-';
    if (column === 'status') {
      if (currentReportType === 'inventory') return t(`dashboard.reports.distribution.${String(value)}`);
      return t(`dashboard.deliveries.status.${String(value)}`);
    }
    if (column === 'isActive') return value ? t('common.yes') : t('common.no');
    if (column === 'successRate') return `${Number(value || 0).toFixed(1)}%`;
    if (
      [
        'collected',
        'commissions',
        'internalExpenses',
        'partnerExpenses',
        'extraCharges',
        'net',
        'stockValue',
        'price',
        'orderValue',
        'deliveryFee',
        'partnerExtraCharge',
        'totalAmount',
        'remitAmount',
      ].includes(column)
    ) {
      return formatMoney(Number(value || 0));
    }
    if (column === 'date') return new Date(String(value)).toLocaleDateString(i18n.language || 'fr');
    return String(value);
  };

  const getDistributionLabel = (key: string) => {
    if (currentReportType === 'deliveries') return t(`dashboard.deliveries.status.${key}`);
    if (currentReportType === 'financial') return t(`dashboard.expenses.categories.${key}`);
    if (currentReportType === 'inventory') return t(`dashboard.reports.distribution.${key}`);
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
    anchor.download = `report-${currentReportType}-${dateFrom}-${dateTo}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!data) {
      showToast(t('dashboard.reports.empty'), 'warning');
      return;
    }
    try {
      const settingsRes = await fetch('/api/dashboard/settings/company', { cache: 'no-store' });
      const settingsData = await settingsRes.json();
      const company = settingsData?.company || {};
      const companyName = String(company?.name || 'Deliverly');
      const companyAddress = String(company?.address || '');

      const escapeHtml = (value: unknown) =>
        String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const detailsRows = (data.rows as Array<Record<string, unknown>>).map((row) => {
        if (currentReportType === 'deliveries') {
          const cancellationReasonKey = String(row.cancellationReason || '').trim();
          const cancellationReasonTranslated =
            cancellationReasonKey && cancellationReasonKey !== '-'
              ? (() => {
                  const key = `dashboard.deliveries.cancel.reasons.${cancellationReasonKey}`;
                  const translated = t(key);
                  return translated !== key ? translated : cancellationReasonKey;
                })()
              : '-';
          const rescheduledDateText = row.rescheduledDate
            ? `${t('dashboard.deliveries.cancel.rescheduledDate')}: ${new Date(String(row.rescheduledDate)).toLocaleDateString(
                i18n.language || 'fr'
              )}`
            : '';
          const cancellationDisplay =
            cancellationReasonTranslated === '-'
              ? rescheduledDateText
                ? `(${rescheduledDateText})`
                : '-'
              : rescheduledDateText
              ? `${cancellationReasonTranslated} (${rescheduledDateText})`
              : cancellationReasonTranslated;
          return `
            <tr>
              <td>${escapeHtml(formatCell('date', row.date))}</td>
              <td>${escapeHtml(row.partner)}</td>
              <td>${escapeHtml(formatCell('status', row.status))}</td>
              <td>${escapeHtml(formatCell('orderValue', row.orderValue))}</td>
              <td>${escapeHtml(formatCell('deliveryFee', row.deliveryFee))}</td>
              <td>${escapeHtml(formatCell('partnerExtraCharge', row.partnerExtraCharge))}</td>
              <td>${escapeHtml(formatCell('remitAmount', row.remitAmount))}</td>
              <td>${escapeHtml(row.collectFromCustomer ? t('common.yes') : t('common.no'))}</td>
              <td>${escapeHtml(cancellationDisplay)}</td>
              <td>${escapeHtml(row.cancellationNote || '-')}</td>
            </tr>
          `;
        }
        return `
          <tr>
            ${tableColumns.map((column) => `<td>${escapeHtml(formatCell(column, row[column]))}</td>`).join('')}
          </tr>
        `;
      });

      const deliveryHeader = currentReportType === 'deliveries'
        ? `
          <th>${escapeHtml(t('dashboard.reports.columns.date'))}</th>
          <th>${escapeHtml(t('dashboard.reports.columns.partner'))}</th>
          <th>${escapeHtml(t('dashboard.reports.columns.status'))}</th>
          <th>${escapeHtml(t('dashboard.reports.columns.orderValue'))}</th>
          <th>${escapeHtml(t('dashboard.reports.columns.deliveryFee'))}</th>
          <th>${escapeHtml(t('dashboard.reports.columns.partnerExtraCharge'))}</th>
          <th>${escapeHtml(t('dashboard.reports.pdf.amountToRemit'))}</th>
          <th>${escapeHtml(t('dashboard.reports.pdf.collectFromCustomer'))}</th>
          <th>${escapeHtml(t('dashboard.reports.pdf.cancellationReason'))}</th>
          <th>${escapeHtml(t('dashboard.deliveries.cancel.note'))}</th>
        `
        : tableColumns.map((column) => `<th>${escapeHtml(t(`dashboard.reports.columns.${column}`))}</th>`).join('');

      const deliveryTotals:
        | {
            orderValue: number;
            deliveryFee: number;
            partnerExtraCharge: number;
            remitAmount: number;
          }
        | null =
        currentReportType === 'deliveries'
          ? (data.rows as Array<Record<string, unknown>>).reduce<{
              orderValue: number;
              deliveryFee: number;
              partnerExtraCharge: number;
              remitAmount: number;
            }>(
              (acc, row) => ({
                orderValue: acc.orderValue + Number(row.orderValue || 0),
                deliveryFee: acc.deliveryFee + Number(row.deliveryFee || 0),
                partnerExtraCharge: acc.partnerExtraCharge + Number(row.partnerExtraCharge || 0),
                remitAmount: acc.remitAmount + Number(row.remitAmount || 0),
              }),
              { orderValue: 0, deliveryFee: 0, partnerExtraCharge: 0, remitAmount: 0 }
            )
          : null;

      const deliveryFooter =
        currentReportType === 'deliveries' && deliveryTotals
          ? `
            <tr>
              <td colspan="3" style="font-weight:700; background:#fff7ed;">${escapeHtml(t('dashboard.reports.pdf.totals'))}</td>
              <td style="font-weight:700; background:#fff7ed;">${escapeHtml(formatMoney(deliveryTotals.orderValue))}</td>
              <td style="font-weight:700; background:#fff7ed;">${escapeHtml(formatMoney(deliveryTotals.deliveryFee))}</td>
              <td style="font-weight:700; background:#fff7ed;">${escapeHtml(formatMoney(deliveryTotals.partnerExtraCharge))}</td>
              <td style="font-weight:700; background:#fff7ed;">${escapeHtml(formatMoney(deliveryTotals.remitAmount))}</td>
              <td colspan="3" style="background:#fff7ed;"></td>
            </tr>
          `
          : '';

      const html = `<!doctype html>
<html lang="${escapeHtml(i18n.language || 'fr')}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(t('dashboard.reports.title'))}</title>
  <style>
    @page { size: A4 landscape; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; background: #f8fafc; }
    .sheet { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0; background: #fff; }
    .logo-placeholder { width: 52px; height: 52px; border-radius: 10px; background: linear-gradient(135deg, #fb923c, #f97316); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .h1 { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
    .muted { margin: 2px 0; color: #64748b; font-size: 12px; }
    .badge { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #e5e7eb; padding: 7px 8px; font-size: 11px; vertical-align: top; word-wrap: break-word; }
    th { background: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 10px; letter-spacing: .03em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .empty { padding: 24px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 10px; }
    .foot { margin-top: 12px; color: #94a3b8; font-size: 10px; text-align: right; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${
          company?.logo
            ? `<img class="logo" src="${escapeHtml(company.logo)}" alt="logo" />`
            : `<div class="logo-placeholder">${escapeHtml((companyName || 'D').slice(0, 1).toUpperCase())}</div>`
        }
        <div>
          <h1 class="h1">${escapeHtml(companyName)}</h1>
          ${companyAddress ? `<p class="muted">${escapeHtml(companyAddress)}</p>` : ''}
          <p class="muted">${escapeHtml(t('dashboard.reports.pdf.period'))}: ${escapeHtml(dateFrom)} → ${escapeHtml(dateTo)}</p>
          <p class="muted">${escapeHtml(t('dashboard.reports.pdf.generatedAt'))}: ${escapeHtml(
            new Date().toLocaleString(i18n.language || 'fr')
          )}</p>
        </div>
      </div>
      <div class="badge">${escapeHtml(t(`dashboard.reports.types.${currentReportType}`))}</div>
    </div>
    ${
      detailsRows.length
        ? `
      <table>
        <thead><tr>${deliveryHeader}</tr></thead>
        <tbody>${detailsRows.join('')}</tbody>
        ${deliveryFooter ? `<tfoot>${deliveryFooter}</tfoot>` : ''}
      </table>
      `
        : `<div class="empty">${escapeHtml(t('dashboard.reports.pdf.noData'))}</div>`
    }
    <div class="foot">Deliverly · ${escapeHtml(t('dashboard.reports.title'))}</div>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

      const printWindow = window.open('', '', 'noopener,noreferrer');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        return;
      }

      // Fallback when popup is blocked by the browser.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      iframe.onload = () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
          showToast(t('dashboard.reports.pdf.openBlocked'), 'error');
          document.body.removeChild(iframe);
          return;
        }
        frameWindow.focus();
        frameWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      showToast(`${t('dashboard.reports.pdf.generationFailed')}${errorMessage ? `: ${errorMessage}` : ''}`, 'error');
    }
  };

  const handleShare = async () => {
    if (!data) {
      showToast(t('dashboard.reports.empty'), 'warning');
      return;
    }
    try {
      const lines: string[] = [];
      lines.push(`${t('dashboard.reports.types.' + currentReportType)}`);
      lines.push(`${t('dashboard.reports.pdf.period')}: ${dateFrom} -> ${dateTo}`);
      lines.push(`${t('dashboard.reports.pdf.generatedAt')}: ${new Date().toLocaleString(i18n.language || 'fr')}`);
      lines.push('');
      lines.push(tableColumns.map((column) => t(`dashboard.reports.columns.${column}`)).join(' | '));
      lines.push('---');
      for (const row of data.rows as Array<Record<string, unknown>>) {
        lines.push(tableColumns.map((column) => String(formatCell(column, row[column]))).join(' | '));
      }
      if (!data.rows?.length) {
        lines.push(t('dashboard.reports.pdf.noData'));
      }

      const pdfContent = buildSimplePdf({
        title: `${t('dashboard.reports.title')} - ${t(`dashboard.reports.types.${currentReportType}`)}`,
        lines,
      });
      const filename = `report-${currentReportType}-${dateFrom}-${dateTo}.pdf`;
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });

      const fallbackDownload = () => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        showToast(t('dashboard.reports.pdf.shareFileFallback'), 'info');
      };

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: t('dashboard.reports.title'),
            text: t('dashboard.reports.subtitle'),
            files: [file],
          });
          return;
        } catch (shareError) {
          const message = shareError instanceof Error ? shareError.message.toLowerCase() : '';
          const isAbort = message.includes('abort') || message.includes('cancel');
          if (isAbort) return;
          fallbackDownload();
          return;
        }
      }

      fallbackDownload();
    } catch {
      showToast(t('dashboard.reports.pdf.generationFailed'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.reports.title')}</h1>
          <p className="text-white/50">{t('dashboard.reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={handleExportPdf}>
            <FileText className="w-4 h-4" />
            {t('dashboard.reports.export.pdf')}
          </Button>
          <Button type="button" className="btn-primary gap-2" onClick={() => exportRows(',', 'csv')}>
            <Download className="w-4 h-4" />
            {t('dashboard.reports.export.csv')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleReportTypes.map((report) => (
          <button
            key={report.key}
            type="button"
            onClick={() => setSelectedReport(report.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              currentReportType === report.key ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <report.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{t(`dashboard.reports.types.${report.key}`)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Calendar className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="date" className="input-glass pl-10 w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="relative">
          <Calendar className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="date" className="input-glass pl-10 w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {!isDriver ? (
          <select className="input-glass" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">{t('dashboard.reports.filters.allPartners')}</option>
            {(data?.filters?.partners || []).map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.label}
              </option>
            ))}
          </select>
        ) : null}
        {!isDriver ? (
          <select className="input-glass" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">{t('dashboard.reports.filters.allDrivers')}</option>
            {(data?.filters?.drivers || []).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.label}
              </option>
            ))}
          </select>
        ) : null}
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
            <div className="text-xs text-white/60">{t(`dashboard.reports.metrics.${currentReportType}.${metricKey}`)}</div>
            <div className="text-xl font-semibold text-white mt-1">
              {formatMetricValue(metricKey, Number(data?.summary?.[metricKey] || 0))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.reports.charts.timeline')}</h3>
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
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.reports.charts.distribution')}</h3>
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
              <div key={entry.key} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{getDistributionLabel(entry.key)}</span>
                <span className="text-foreground">{entry.value.toLocaleString(i18n.language || 'fr')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">{t('dashboard.reports.table.title')}</h3>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2" onClick={handleExportPdf}>
              <FileText className="w-4 h-4" />
              {t('dashboard.reports.export.pdf')}
            </Button>
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
                    <th key={column} className="text-left text-muted-foreground font-medium px-3 py-2">
                      {t(`dashboard.reports.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                    {tableColumns.map((column) => (
                      <td key={column} className="px-3 py-2 text-foreground whitespace-nowrap">
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
