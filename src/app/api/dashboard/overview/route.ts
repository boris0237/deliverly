import { NextResponse } from 'next/server';
import { CompanyModel, connectDb, DeliveryModel, ExpenseModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

type DateRange = {
  from: Date;
  to: Date;
};

function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function parseDateRange(request: Request): DateRange {
  const { searchParams } = new URL(request.url);
  const dateFrom = (searchParams.get('dateFrom') || '').trim();
  const dateTo = (searchParams.get('dateTo') || '').trim();
  const fallback = getCurrentMonthRange();

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const hasValidFrom = dateFrom && !Number.isNaN(from.getTime());
  const hasValidTo = dateTo && !Number.isNaN(to.getTime());

  if (!hasValidFrom && !hasValidTo) return fallback;

  const resolvedFrom = hasValidFrom ? new Date(from.setHours(0, 0, 0, 0)) : fallback.from;
  const resolvedTo = hasValidTo ? new Date(to.setHours(23, 59, 59, 999)) : fallback.to;
  return resolvedFrom <= resolvedTo ? { from: resolvedFrom, to: resolvedTo } : fallback;
}

async function resolveCurrentCompanyId(userId: string): Promise<string | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company.id;
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCurrentCompanyId(currentUserId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const dateRange = parseDateRange(request);
    const deliveryDateFilter = { $gte: dateRange.from, $lte: dateRange.to };
    const dateFromKey = dateRange.from.toISOString().slice(0, 10);
    const dateToKey = dateRange.to.toISOString().slice(0, 10);
    const effectiveDateStages = [
      { $addFields: { effectiveDate: { $ifNull: ['$accountingDate', '$deliveryDate'] } } },
      { $match: { companyId, effectiveDate: deliveryDateFilter } },
    ];

    const [
      totalDeliveries,
      amountCollectedRows,
      commissionsRows,
      expensesRows,
      recentDeliveries,
      company,
      statusRows,
      trendsRows,
      topDriversRows,
      drivers,
    ] = await Promise.all([
      DeliveryModel.aggregate([...effectiveDateStages, { $count: 'count' }]),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        { $match: { status: 'delivered', collectFromCustomer: true } },
        { $group: { _id: null, total: { $sum: '$orderValue' } } },
      ]),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        { $match: { status: 'delivered' } },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$deliveryFee', 0] } },
          },
        },
      ]),
      ExpenseModel.aggregate([
        { $match: { companyId, targetType: { $ne: 'partner' } } },
        {
          $addFields: {
            expenseDay: {
              $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Africa/Douala' },
            },
          },
        },
        { $match: { expenseDay: { $gte: dateFromKey, $lte: dateToKey } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        { $sort: { createdAt: -1 } },
        { $limit: 6 },
      ]),
      CompanyModel.findOne({ id: companyId }).lean(),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } },
            deliveries: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            commissions: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'delivered'] },
                  { $ifNull: ['$deliveryFee', 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      DeliveryModel.aggregate([
        ...effectiveDateStages,
        { $match: { driverId: { $ne: '' } } },
        {
          $group: {
            _id: '$driverId',
            completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
          },
        },
        { $sort: { completed: -1 } },
        { $limit: 5 },
      ]),
      UserModel.find({ companyId, role: 'driver' }).lean(),
    ]);

    const driverById = new Map(
      drivers.map((driver) => [
        driver.id,
        `${String(driver.firstName || '').trim()} ${String(driver.lastName || '').trim()}`.trim() || driver.email || driver.id,
      ])
    );

    const statusBreakdown = {
      pending: 0,
      assigned: 0,
      inTransit: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of statusRows) {
      const key = String(row?._id || '');
      const count = Number(row?.count || 0);
      if (key === 'pickedUp' || key === 'inTransit') {
        statusBreakdown.inTransit += count;
      } else if (key in statusBreakdown) {
        statusBreakdown[key as keyof typeof statusBreakdown] += count;
      }
    }

    return NextResponse.json({
      kpis: {
        totalDeliveries: Number(totalDeliveries?.[0]?.count || 0),
        amountCollected: Number(amountCollectedRows?.[0]?.total || 0),
        totalExpenses: Number(expensesRows?.[0]?.total || 0),
        totalCommissions: Number(commissionsRows?.[0]?.total || 0),
      },
      statusBreakdown,
      trends: trendsRows.map((item) => ({
        date: String(item._id || ''),
        deliveries: Number(item.deliveries || 0),
        completed: Number(item.completed || 0),
        cancelled: Number(item.cancelled || 0),
        commissions: Number(item.commissions || 0),
      })),
      topDrivers: topDriversRows.map((item) => ({
        driverId: String(item._id || ''),
        name: driverById.get(String(item._id || '')) || '-',
        completed: Number(item.completed || 0),
        failed: Number(item.failed || 0),
      })),
      recentDeliveries: recentDeliveries.map((delivery) => ({
        id: delivery.id,
        customerName: delivery.customerName || '',
        customerPhone: delivery.customerPhone || '',
        address: delivery.address || '',
        status: delivery.status,
        deliveryDate: delivery.deliveryDate,
        orderValue: Number(delivery.orderValue || 0),
        deliveryFee: Number(delivery.deliveryFee || 0),
      })),
      currency: String(company?.deliveryPricing?.currency || 'XAF').toUpperCase(),
      range: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dashboard overview', code: 'DASHBOARD_OVERVIEW_FAILED' },
      { status: 500 }
    );
  }
}
