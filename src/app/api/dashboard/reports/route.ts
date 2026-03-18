import { NextResponse } from 'next/server';
import {
  CompanyModel,
  DeliveryModel,
  ExpenseModel,
  PartnerModel,
  ProductModel,
  StockMovementModel,
  UserModel,
  connectDb,
} from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { getAllowedReportTypes } from '@/lib/auth/access';
import type { UserRole } from '@/types';

type ReportType = 'deliveries' | 'financial' | 'driver' | 'inventory' | 'partner';

type DateRange = {
  from: Date;
  to: Date;
};

function getCurrentMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function parseDateRange(request: Request): DateRange {
  const { searchParams } = new URL(request.url);
  const fromRaw = (searchParams.get('dateFrom') || '').trim();
  const toRaw = (searchParams.get('dateTo') || '').trim();
  const fallback = getCurrentMonthRange();
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  const hasFrom = fromRaw && !Number.isNaN(from.getTime());
  const hasTo = toRaw && !Number.isNaN(to.getTime());
  if (!hasFrom && !hasTo) return fallback;
  const resolvedFrom = hasFrom ? new Date(from.setHours(0, 0, 0, 0)) : fallback.from;
  const resolvedTo = hasTo ? new Date(to.setHours(23, 59, 59, 999)) : fallback.to;
  return resolvedFrom <= resolvedTo ? { from: resolvedFrom, to: resolvedTo } : fallback;
}

async function resolveActor(userId: string): Promise<{ companyId: string; role: string } | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return { companyId: company.id, role: String(user.role || '') };
}

function buildDeliveryStages(companyId: string, dateRange: DateRange, filters: { partnerId: string; driverId: string; status: string }) {
  const match: Record<string, unknown> = { companyId };
  if (filters.partnerId) match.partnerId = filters.partnerId;
  if (filters.driverId) match.driverId = filters.driverId;
  const statuses = ['pending', 'assigned', 'pickedUp', 'inTransit', 'delivered', 'failed', 'cancelled'];
  if (statuses.includes(filters.status)) match.status = filters.status;
  return [
    { $match: match },
    { $addFields: { effectiveDate: { $ifNull: ['$accountingDate', '$deliveryDate'] } } },
    { $match: { effectiveDate: { $gte: dateRange.from, $lte: dateRange.to } } },
  ];
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const actor = await resolveActor(currentUserId);
    if (!actor?.companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    const companyId = actor.companyId;

    const { searchParams } = new URL(request.url);
    const reportType = (searchParams.get('type') || 'deliveries') as ReportType;
    const requestedType: ReportType = ['deliveries', 'financial', 'driver', 'inventory', 'partner'].includes(reportType)
      ? reportType
      : 'deliveries';
    const allowedTypes = getAllowedReportTypes(actor.role as UserRole);
    const fallbackType = (allowedTypes[0] || 'deliveries') as ReportType;
    const type: ReportType = allowedTypes.includes(requestedType) ? requestedType : fallbackType;
    const dateRange = parseDateRange(request);
    const partnerId = (searchParams.get('partnerId') || '').trim();
    const driverId = actor.role === 'driver' ? currentUserId : (searchParams.get('driverId') || '').trim();
    const status = (searchParams.get('status') || '').trim();

    const company = await CompanyModel.findOne({ id: companyId }).lean();
    const currency = String(company?.deliveryPricing?.currency || 'XAF').toUpperCase();
    const [partners, drivers] = await Promise.all([
      PartnerModel.find({ companyId, isActive: true }).select({ _id: 0, id: 1, name: 1 }).lean(),
      UserModel.find({ companyId, role: 'driver' })
        .select({ _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, isActive: 1 })
        .lean(),
    ]);
    const partnerById = new Map(partners.map((p) => [p.id, p.name]));
    const driverById = new Map(
      drivers.map((d) => [d.id, `${String(d.firstName || '').trim()} ${String(d.lastName || '').trim()}`.trim() || d.id])
    );

    const deliveryStages = buildDeliveryStages(companyId, dateRange, { partnerId, driverId, status });

    if (type === 'deliveries') {
      const [summaryRows, seriesRows, distributionRows, rows] = await Promise.all([
        DeliveryModel.aggregate([
          ...deliveryStages,
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
              inTransit: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'pickedUp', 'inTransit']] }, 1, 0] } },
            },
          },
        ]),
        DeliveryModel.aggregate([
          ...deliveryStages,
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } },
              total: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        DeliveryModel.aggregate([...deliveryStages, { $group: { _id: '$status', value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
        DeliveryModel.aggregate([...deliveryStages, { $sort: { effectiveDate: -1 } }, { $limit: 50 }]),
      ]);

      const summary = summaryRows?.[0] || { total: 0, delivered: 0, cancelled: 0, inTransit: 0 };
      const successRate = summary.total > 0 ? (summary.delivered / summary.total) * 100 : 0;
      return NextResponse.json({
        type,
        currency,
        range: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
        filters: {
          partners: partners.map((p) => ({ id: p.id, label: p.name })),
          drivers: drivers.map((d) => ({ id: d.id, label: driverById.get(d.id) || d.id })),
        },
        summary: {
          total: Number(summary.total || 0),
          delivered: Number(summary.delivered || 0),
          cancelled: Number(summary.cancelled || 0),
          inTransit: Number(summary.inTransit || 0),
          successRate: Number(successRate.toFixed(2)),
        },
        series: seriesRows.map((r) => ({
          date: String(r._id || ''),
          total: Number(r.total || 0),
          delivered: Number(r.delivered || 0),
          cancelled: Number(r.cancelled || 0),
        })),
        distribution: distributionRows.map((r) => ({ key: String(r._id || 'pending'), value: Number(r.value || 0) })),
        rows: rows.map((r) => ({
          id: r.id,
          date: r.effectiveDate,
          partner: partnerById.get(String(r.partnerId || '')) || '-',
          driver: driverById.get(String(r.driverId || '')) || '-',
          status: r.status,
          orderValue: Number(r.orderValue || 0),
          deliveryFee: Number(r.deliveryFee || 0),
          partnerExtraCharge: Number(r.partnerExtraCharge || 0),
          collectFromCustomer: r.collectFromCustomer !== false,
          cancellationReason: String(r.cancellationReason || ''),
          cancellationNote: String(r.cancellationNote || ''),
          rescheduledDate: r.rescheduledDate || null,
          totalAmount: Number(r.orderValue || 0) + Number(r.deliveryFee || 0),
          remitAmount:
            r.collectFromCustomer === false
              ? 0
              : Math.max(0, Number(r.orderValue || 0) - Number(r.deliveryFee || 0) - Number(r.partnerExtraCharge || 0)),
        })),
      });
    }

    if (type === 'financial') {
      const dateFromKey = dateRange.from.toISOString().slice(0, 10);
      const dateToKey = dateRange.to.toISOString().slice(0, 10);
      const expenseDateStages: any[] = [
        { $match: { companyId } },
        {
          $addFields: {
            expenseDay: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Africa/Douala' } },
          },
        },
        { $match: { expenseDay: { $gte: dateFromKey, $lte: dateToKey } } },
      ];
      if (partnerId) expenseDateStages.push({ $match: { $or: [{ targetType: { $ne: 'partner' } }, { targetId: partnerId }] } });

      const [deliveryFinancial, expenseFinancial, seriesRows, expenseCategoryRows] = await Promise.all([
        DeliveryModel.aggregate([
          ...deliveryStages,
          {
            $group: {
              _id: null,
              collected: {
                $sum: {
                  $cond: [{ $and: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$collectFromCustomer', true] }] }, '$orderValue', 0],
                },
              },
              commissions: {
                $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] },
              },
            },
          },
        ]),
        ExpenseModel.aggregate([
          ...expenseDateStages,
          {
            $group: {
              _id: null,
              internalExpenses: { $sum: { $cond: [{ $ne: ['$targetType', 'partner'] }, '$amount', 0] } },
              partnerExpenses: { $sum: { $cond: [{ $eq: ['$targetType', 'partner'] }, '$amount', 0] } },
            },
          },
        ]),
        DeliveryModel.aggregate([
          ...deliveryStages,
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } },
              collected: {
                $sum: {
                  $cond: [{ $and: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$collectFromCustomer', true] }] }, '$orderValue', 0],
                },
              },
              commissions: {
                $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        ExpenseModel.aggregate([
          ...expenseDateStages,
          { $group: { _id: '$category', value: { $sum: '$amount' } } },
          { $sort: { value: -1 } },
        ]),
      ]);

      const d = deliveryFinancial?.[0] || { collected: 0, commissions: 0 };
      const e = expenseFinancial?.[0] || { internalExpenses: 0, partnerExpenses: 0 };
      const seriesByDate = new Map(
        seriesRows.map((row) => [
          String(row._id),
          {
            date: String(row._id),
            collected: Number(row.collected || 0),
            commissions: Number(row.commissions || 0),
            internalExpenses: 0,
            partnerExpenses: 0,
          },
        ])
      );
      const expenseDailyRows = await ExpenseModel.aggregate([
        ...expenseDateStages,
        {
          $group: {
            _id: '$expenseDay',
            internalExpenses: { $sum: { $cond: [{ $ne: ['$targetType', 'partner'] }, '$amount', 0] } },
            partnerExpenses: { $sum: { $cond: [{ $eq: ['$targetType', 'partner'] }, '$amount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      for (const row of expenseDailyRows) {
        const key = String(row._id || '');
        const current = seriesByDate.get(key) || { date: key, collected: 0, commissions: 0, internalExpenses: 0, partnerExpenses: 0 };
        current.internalExpenses = Number(row.internalExpenses || 0);
        current.partnerExpenses = Number(row.partnerExpenses || 0);
        seriesByDate.set(key, current);
      }
      const series = [...seriesByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      const rows = series.map((s) => ({
        ...s,
        net: Number((s.commissions - s.internalExpenses).toFixed(2)),
      }));

      return NextResponse.json({
        type,
        currency,
        range: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
        filters: {
          partners: partners.map((p) => ({ id: p.id, label: p.name })),
          drivers: drivers.map((d) => ({ id: d.id, label: driverById.get(d.id) || d.id })),
        },
        summary: {
          collected: Number(d.collected || 0),
          commissions: Number(d.commissions || 0),
          internalExpenses: Number(e.internalExpenses || 0),
          partnerExpenses: Number(e.partnerExpenses || 0),
          net: Number((Number(d.commissions || 0) - Number(e.internalExpenses || 0)).toFixed(2)),
        },
        series,
        distribution: expenseCategoryRows.map((row) => ({ key: String(row._id || 'other'), value: Number(row.value || 0) })),
        rows,
      });
    }

    if (type === 'driver') {
      const [summaryRows, seriesRows, driverRows] = await Promise.all([
        DeliveryModel.aggregate([
          ...deliveryStages,
          { $match: { driverId: { $ne: '' } } },
          {
            $group: {
              _id: null,
              totalAssigned: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
            },
          },
        ]),
        DeliveryModel.aggregate([
          ...deliveryStages,
          { $match: { driverId: { $ne: '' } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } },
              assigned: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        DeliveryModel.aggregate([
          ...deliveryStages,
          { $match: { driverId: { $ne: '' } } },
          {
            $group: {
              _id: '$driverId',
              assigned: { $sum: 1 },
              delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              commissions: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] } },
            },
          },
          { $sort: { delivered: -1 } },
        ]),
      ]);
      const s = summaryRows?.[0] || { totalAssigned: 0, delivered: 0, cancelled: 0 };
      const successRate = s.totalAssigned > 0 ? (s.delivered / s.totalAssigned) * 100 : 0;
      return NextResponse.json({
        type,
        currency,
        range: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
        filters: {
          partners: partners.map((p) => ({ id: p.id, label: p.name })),
          drivers: drivers.map((d) => ({ id: d.id, label: driverById.get(d.id) || d.id })),
        },
        summary: {
          totalDrivers: drivers.length,
          activeDrivers: drivers.filter((d) => d.isActive !== false).length,
          totalAssigned: Number(s.totalAssigned || 0),
          delivered: Number(s.delivered || 0),
          cancelled: Number(s.cancelled || 0),
          successRate: Number(successRate.toFixed(2)),
        },
        series: seriesRows.map((r) => ({
          date: String(r._id || ''),
          assigned: Number(r.assigned || 0),
          delivered: Number(r.delivered || 0),
          cancelled: Number(r.cancelled || 0),
        })),
        distribution: driverRows.slice(0, 8).map((r) => ({ key: driverById.get(String(r._id || '')) || '-', value: Number(r.delivered || 0) })),
        rows: driverRows.map((r) => {
          const assigned = Number(r.assigned || 0);
          const delivered = Number(r.delivered || 0);
          const cancelled = Number(r.cancelled || 0);
          const failed = Number(r.failed || 0);
          return {
            driver: driverById.get(String(r._id || '')) || '-',
            phone: drivers.find((d) => d.id === r._id)?.phone || '',
            isActive: drivers.find((d) => d.id === r._id)?.isActive !== false,
            assigned,
            delivered,
            cancelled,
            failed,
            successRate: assigned > 0 ? Number(((delivered / assigned) * 100).toFixed(2)) : 0,
            commissions: Number(r.commissions || 0),
          };
        }),
      });
    }

    if (type === 'inventory') {
      const [products, movementRows, movementSeriesRows] = await Promise.all([
        ProductModel.find({ companyId, ...(partnerId ? { partnerId } : {}) }).lean(),
        StockMovementModel.find({ companyId, createdAt: { $gte: dateRange.from, $lte: dateRange.to } }).lean(),
        StockMovementModel.aggregate([
          { $match: { companyId, createdAt: { $gte: dateRange.from, $lte: dateRange.to } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              entries: { $sum: { $cond: [{ $eq: ['$type', 'entry'] }, '$quantity', 0] } },
              exits: { $sum: { $cond: [{ $eq: ['$type', 'exit'] }, '$quantity', 0] } },
              adjustments: {
                $sum: { $cond: [{ $in: ['$type', ['transfer', 'adjustment']] }, '$quantity', 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);
      const movementByProduct = new Map<string, { entries: number; exits: number; adjustments: number }>();
      for (const movement of movementRows) {
        const productId = String(movement.productId || '');
        if (!productId) continue;
        const current = movementByProduct.get(productId) || { entries: 0, exits: 0, adjustments: 0 };
        const qty = Number(movement.quantity || 0);
        if (movement.type === 'entry') current.entries += qty;
        else if (movement.type === 'exit') current.exits += qty;
        else current.adjustments += qty;
        movementByProduct.set(productId, current);
      }
      const totalProducts = products.length;
      const totalStock = products.reduce((sum, p) => sum + Number(p.stockQuantity || 0), 0);
      const lowStock = products.filter((p) => Number(p.stockQuantity || 0) > 0 && Number(p.stockQuantity || 0) <= Number(p.minStockLevel || 0)).length;
      const outOfStock = products.filter((p) => Number(p.stockQuantity || 0) <= 0).length;
      const stockValue = products.reduce((sum, p) => sum + Number(p.stockQuantity || 0) * Number(p.price || 0), 0);
      return NextResponse.json({
        type,
        currency,
        range: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
        filters: {
          partners: partners.map((p) => ({ id: p.id, label: p.name })),
          drivers: drivers.map((d) => ({ id: d.id, label: driverById.get(d.id) || d.id })),
        },
        summary: { totalProducts, totalStock, lowStock, outOfStock, stockValue },
        series: movementSeriesRows.map((r) => ({
          date: String(r._id || ''),
          entries: Number(r.entries || 0),
          exits: Number(r.exits || 0),
          adjustments: Number(r.adjustments || 0),
        })),
        distribution: [
          { key: 'healthy', value: Math.max(0, totalProducts - lowStock - outOfStock) },
          { key: 'low', value: lowStock },
          { key: 'out', value: outOfStock },
        ],
        rows: products
          .map((p) => {
            const stock = Number(p.stockQuantity || 0);
            const minStock = Number(p.minStockLevel || 0);
            const statusKey = stock <= 0 ? 'out' : stock <= minStock ? 'low' : 'healthy';
            return {
              sku: p.sku,
              name: p.name,
              partner: partnerById.get(String(p.partnerId || '')) || '-',
              price: Number(p.price || 0),
              stock,
              minStock,
              status: statusKey,
              entries: movementByProduct.get(String(p.id || ''))?.entries || 0,
              exits: movementByProduct.get(String(p.id || ''))?.exits || 0,
              adjustments: movementByProduct.get(String(p.id || ''))?.adjustments || 0,
              stockValue: stock * Number(p.price || 0),
            };
          })
          .sort((a, b) => a.stock - b.stock),
        movementCount: movementRows.length,
      });
    }

    const dateFromKey = dateRange.from.toISOString().slice(0, 10);
    const dateToKey = dateRange.to.toISOString().slice(0, 10);
    const partnerExpenseStages: any[] = [
      { $match: { companyId, targetType: 'partner' } },
      {
        $addFields: {
          expenseDay: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Africa/Douala' } },
        },
      },
      { $match: { expenseDay: { $gte: dateFromKey, $lte: dateToKey } } },
    ];
    if (partnerId) partnerExpenseStages.push({ $match: { targetId: partnerId } });

    const [summaryRows, seriesRows, partnerRows, partnerExpenseSummaryRows, partnerExpenseDailyRows, partnerExpenseByPartnerRows] = await Promise.all([
      DeliveryModel.aggregate([
        ...deliveryStages,
        {
          $group: {
            _id: null,
            totalDeliveries: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            commissions: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] } },
            extraCharges: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$partnerExtraCharge', 0] }, 0] } },
            collected: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$collectFromCustomer', true] }] }, '$orderValue', 0],
              },
            },
          },
        },
      ]),
      DeliveryModel.aggregate([
        ...deliveryStages,
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } },
            deliveries: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            commissions: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] } },
            extraCharges: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$partnerExtraCharge', 0] }, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      DeliveryModel.aggregate([
        ...deliveryStages,
        {
          $group: {
            _id: '$partnerId',
            deliveries: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
            commissions: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$deliveryFee', 0] }, 0] } },
            extraCharges: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, { $ifNull: ['$partnerExtraCharge', 0] }, 0] } },
            collected: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$collectFromCustomer', true] }] }, '$orderValue', 0],
              },
            },
          },
        },
        { $sort: { deliveries: -1 } },
      ]),
      ExpenseModel.aggregate([...partnerExpenseStages, { $group: { _id: null, partnerExpenses: { $sum: '$amount' } } }]),
      ExpenseModel.aggregate([
        ...partnerExpenseStages,
        { $group: { _id: '$expenseDay', partnerExpenses: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      ExpenseModel.aggregate([
        ...partnerExpenseStages,
        { $group: { _id: '$targetId', partnerExpenses: { $sum: '$amount' } } },
        { $sort: { partnerExpenses: -1 } },
      ]),
    ]);
    const summary = summaryRows?.[0] || { totalDeliveries: 0, delivered: 0, commissions: 0, extraCharges: 0, collected: 0 };
    const partnerExpensesSummary = Number(partnerExpenseSummaryRows?.[0]?.partnerExpenses || 0);
    const seriesByDate = new Map(
      seriesRows.map((row) => [
        String(row._id),
        {
          date: String(row._id),
          deliveries: Number(row.deliveries || 0),
          delivered: Number(row.delivered || 0),
          commissions: Number(row.commissions || 0),
          extraCharges: Number(row.extraCharges || 0),
          partnerExpenses: 0,
        },
      ])
    );
    for (const expenseRow of partnerExpenseDailyRows) {
      const key = String(expenseRow._id || '');
      const current = seriesByDate.get(key) || {
        date: key,
        deliveries: 0,
        delivered: 0,
        commissions: 0,
        extraCharges: 0,
        partnerExpenses: 0,
      };
      current.partnerExpenses = Number(expenseRow.partnerExpenses || 0);
      seriesByDate.set(key, current);
    }
    const partnerExpensesByPartner = new Map(
      partnerExpenseByPartnerRows.map((row) => [String(row._id || ''), Number(row.partnerExpenses || 0)])
    );
    return NextResponse.json({
      type,
      currency,
      range: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
      filters: {
        partners: partners.map((p) => ({ id: p.id, label: p.name })),
        drivers: drivers.map((d) => ({ id: d.id, label: driverById.get(d.id) || d.id })),
      },
      summary: {
        totalPartners: partners.length,
        activePartners: partners.length,
        totalDeliveries: Number(summary.totalDeliveries || 0),
        delivered: Number(summary.delivered || 0),
        commissions: Number(summary.commissions || 0),
        extraCharges: Number(summary.extraCharges || 0),
        partnerExpenses: partnerExpensesSummary,
        collected: Number(summary.collected || 0),
      },
      series: [...seriesByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      distribution: partnerRows.slice(0, 8).map((r) => ({
        key: partnerById.get(String(r._id || '')) || '-',
        value: Number(r.deliveries || 0),
      })),
      rows: partnerRows.map((r) => {
        const deliveries = Number(r.deliveries || 0);
        const delivered = Number(r.delivered || 0);
        return {
          partner: partnerById.get(String(r._id || '')) || '-',
          deliveries,
          delivered,
          cancelled: Number(r.cancelled || 0),
          commissions: Number(r.commissions || 0),
          extraCharges: Number(r.extraCharges || 0),
          partnerExpenses: Number(partnerExpensesByPartner.get(String(r._id || '')) || 0),
          collected: Number(r.collected || 0),
          successRate: deliveries > 0 ? Number(((delivered / deliveries) * 100).toFixed(2)) : 0,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reports', code: 'REPORTS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
