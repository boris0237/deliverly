import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, connectDb, DeliveryModel, PartnerModel, ProductModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { createCompanyNotifications } from '@/lib/notifications/service';
import { emitDeliveryRealtimeEvent } from '@/lib/realtime/socket-server';

const createDeliverySchema = z.object({
  partnerId: z.string().trim().min(1),
  driverId: z.string().trim().optional(),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().min(6).max(40),
  address: z.string().trim().optional(),
  neighborhoodId: z.string().trim().optional(),
  deliveryDate: z.string().trim().min(1),
  orderValue: z.number().min(0).optional(),
  collectFromCustomer: z.boolean().optional(),
  deliveryFee: z.number().min(0).optional(),
  partnerExtraCharge: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ productId: z.string().trim().min(1), quantity: z.number().int().min(1) })).min(1),
});

type ResolvedCompany = {
  id: string;
  deliveryPricing?: {
    zone?: {
      zones?: Array<{
        id: string;
        name: string;
        amount: number;
        neighborhoods?: Array<{ id: string; name: string; address?: string }>;
      }>;
    };
  };
};

type PartnerPricing = {
  type?: 'fixed' | 'package' | 'percentage' | 'zone';
  fixedAmount?: number;
  percentageValue?: number;
  zoneId?: string;
};

function computeAutoDeliveryFee(company: ResolvedCompany, pricing: PartnerPricing | undefined, orderValue: number, neighborhoodId?: string) {
  if (!pricing) return 0;
  if (pricing.type === 'percentage') {
    return Math.max(0, (Math.max(0, Number(orderValue || 0)) * Number(pricing.percentageValue || 0)) / 100);
  }
  if (pricing.type === 'zone' && pricing.zoneId && neighborhoodId?.trim()) {
    const zone = company.deliveryPricing?.zone?.zones?.find((candidate) => candidate.id === pricing.zoneId);
    const match = zone?.neighborhoods?.some((candidate) => candidate.id === neighborhoodId.trim());
    if (match) return Math.max(0, Number(zone?.amount || 0));
  }
  return Math.max(0, Number(pricing.fixedAmount || 0));
}

function mapDelivery(delivery: any, partnerName = '', driverName = '', includeLogs = true) {
  return {
    id: delivery.id,
    companyId: delivery.companyId,
    partnerId: delivery.partnerId,
    partnerName,
    driverId: delivery.driverId || '',
    driverName,
    customerName: delivery.customerName,
    customerPhone: delivery.customerPhone,
    address: delivery.address,
    neighborhoodId: delivery.neighborhoodId || '',
    deliveryDate: delivery.deliveryDate,
    orderValue: delivery.orderValue || 0,
    collectFromCustomer: delivery.collectFromCustomer !== false,
    deliveryFee: delivery.deliveryFee || 0,
    partnerExtraCharge: delivery.partnerExtraCharge || 0,
    cancellationReason: delivery.cancellationReason || '',
    cancellationNote: delivery.cancellationNote || '',
    rescheduledDate: delivery.rescheduledDate || null,
    accountingDate: delivery.accountingDate || null,
    logs: includeLogs && Array.isArray(delivery.logs) ? delivery.logs : [],
    items: Array.isArray(delivery.items) ? delivery.items : [],
    notes: delivery.notes || '',
    status: delivery.status,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company as ResolvedCompany;
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const company = await resolveCurrentCompany(currentUserId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const actor = await UserModel.findOne({ id: currentUserId, companyId: company.id }).lean();
    if (!actor) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();

    const query: Record<string, unknown> = { companyId: company.id };
    if (status && status !== 'all') query.status = status;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ id: regex }, { customerName: regex }, { customerPhone: regex }, { address: regex }];
    }
    if (actor.role === 'driver') {
      const visibilityFilter = {
        $or: [{ driverId: actor.id }, { driverId: '' }, { driverId: null }, { driverId: { $exists: false } }],
      };
      if (query.$or) {
        const searchFilter = { $or: query.$or as Array<Record<string, unknown>> };
        delete query.$or;
        query.$and = [visibilityFilter, searchFilter];
      } else {
        query.$or = visibilityFilter.$or;
      }
    }
    if (dateFrom || dateTo) {
      const dateRange: Record<string, Date> = {};
      if (dateFrom) {
        const start = new Date(dateFrom);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          dateRange.$gte = start;
        }
      }
      if (dateTo) {
        const end = new Date(dateTo);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateRange.$lte = end;
        }
      }
      if (dateRange.$gte || dateRange.$lte) {
        const dateCondition = {
          $or: [{ deliveryDate: dateRange }, { status: 'cancelled', rescheduledDate: dateRange }],
        };
        if (Array.isArray(query.$and)) {
          (query.$and as Array<Record<string, unknown>>).push(dateCondition);
        } else {
          query.$and = [dateCondition];
        }
      }
    }

    const [total, deliveries] = await Promise.all([
      DeliveryModel.countDocuments(query),
      DeliveryModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const partnerIds = Array.from(new Set(deliveries.map((d) => d.partnerId).filter(Boolean)));
    const driverIds = Array.from(new Set(deliveries.map((d) => d.driverId).filter(Boolean)));
    const [partners, drivers] = await Promise.all([
      PartnerModel.find({ companyId: company.id, id: { $in: partnerIds } }).lean(),
      UserModel.find({ companyId: company.id, id: { $in: driverIds } }).lean(),
    ]);
    const partnerMap = new Map(partners.map((p) => [p.id, p.name]));
    const driverMap = new Map(drivers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

    return NextResponse.json({
      deliveries: deliveries.map((delivery) =>
        mapDelivery(
          delivery,
          partnerMap.get(delivery.partnerId) || '',
          driverMap.get(delivery.driverId || '') || '',
          actor.role !== 'driver'
        )
      ),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch deliveries', code: 'DELIVERIES_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const company = await resolveCurrentCompany(currentUserId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const actor = await UserModel.findOne({ id: currentUserId, companyId: company.id }).lean();
    if (!actor) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    if (actor.role === 'driver') {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createDeliverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const actorName = `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || actor?.email || currentUserId;
    const partner = await PartnerModel.findOne({ id: payload.partnerId, companyId: company.id, isActive: true }).lean();
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
    }

    let driverId = '';
    if (payload.driverId?.trim()) {
      const driver = await UserModel.findOne({
        id: payload.driverId.trim(),
        companyId: company.id,
        role: 'driver',
        isActive: true,
      }).lean();
      if (!driver) {
        return NextResponse.json({ error: 'Driver not found', code: 'DRIVER_NOT_FOUND' }, { status: 404 });
      }
      driverId = driver.id;
    }

    const productIds = payload.items.map((item) => item.productId);
    const products = await ProductModel.find({
      companyId: company.id,
      isActive: true,
      id: { $in: productIds },
      partnerId: payload.partnerId,
    }).lean();
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Invalid product selection', code: 'INVALID_DELIVERY_ITEMS' }, { status: 400 });
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const insufficientItems: Array<{ productId: string; productName: string; requested: number; available: number }> = [];
    for (const item of payload.items) {
      const product = productMap.get(item.productId)!;
      const available = Number(product.stockQuantity || 0);
      if (item.quantity > available) {
        insufficientItems.push({
          productId: product.id,
          productName: product.name,
          requested: item.quantity,
          available,
        });
      }
    }
    if (insufficientItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Insufficient stock',
          code: 'INSUFFICIENT_STOCK',
          insufficientItems,
        },
        { status: 400 }
      );
    }

    const items = payload.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price || 0);
      const total = unitPrice * item.quantity;
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        total,
      };
    });
    const computedOrderValue = items.reduce((sum, item) => sum + item.total, 0);
    const orderValue = payload.orderValue ?? computedOrderValue;

    let address = (payload.address || '').trim();
    let neighborhoodId = '';
    if (payload.neighborhoodId?.trim()) {
      const wanted = payload.neighborhoodId.trim();
      const partnerPricing = (partner.pricing || {}) as { type?: string; zoneId?: string };
      const zoneId = partnerPricing.type === 'zone' ? partnerPricing.zoneId : '';
      const zones = company.deliveryPricing?.zone?.zones || [];
      const zone = zones.find((z) => z.id === zoneId);
      const neighborhood = zone?.neighborhoods?.find((n) => n.id === wanted);
      if (!neighborhood) {
        return NextResponse.json({ error: 'Invalid neighborhood', code: 'INVALID_NEIGHBORHOOD' }, { status: 400 });
      }
      neighborhoodId = wanted;
      if (!address) address = neighborhood.address?.trim() || neighborhood.name.trim();
    }

    if (!address) {
      return NextResponse.json({ error: 'Delivery address is required', code: 'ADDRESS_REQUIRED' }, { status: 400 });
    }

    const deliveryDate = new Date(payload.deliveryDate);
    if (Number.isNaN(deliveryDate.getTime())) {
      return NextResponse.json({ error: 'Invalid delivery date', code: 'INVALID_DELIVERY_DATE' }, { status: 400 });
    }

    const resolvedDeliveryFee =
      payload.deliveryFee !== undefined
        ? payload.deliveryFee
        : computeAutoDeliveryFee(company, partner.pricing as PartnerPricing | undefined, orderValue, neighborhoodId);

    const created = await DeliveryModel.create({
      id: randomToken(12),
      companyId: company.id,
      partnerId: payload.partnerId,
      driverId,
      customerName: payload.customerName?.trim() || '',
      customerPhone: payload.customerPhone,
      address,
      neighborhoodId,
      deliveryDate,
      orderValue,
      collectFromCustomer: payload.collectFromCustomer !== false,
      deliveryFee: resolvedDeliveryFee,
      partnerExtraCharge: payload.partnerExtraCharge || 0,
      logs: [
        {
          id: randomToken(12),
          action: 'created',
          message: 'Delivery created',
          actorId: currentUserId,
          actorName,
          createdAt: new Date(),
        },
      ],
      items,
      notes: payload.notes || '',
      status: driverId ? 'assigned' : 'pending',
      accountingDate: null,
      createdBy: currentUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientDriverIds = driverId
      ? [driverId]
      : (
          await UserModel.find({
            companyId: company.id,
            role: 'driver',
            isActive: true,
          })
            .select({ id: 1 })
            .lean()
        ).map((user) => user.id);

    await createCompanyNotifications({
      companyId: company.id,
      actorUserId: currentUserId,
      recipientUserIds: recipientDriverIds,
      type: 'delivery',
      title: driverId ? `Nouvelle course assignée #${created.id}` : `Nouvelle course disponible #${created.id}`,
      message: driverId
        ? `${actorName} vous a assigné une nouvelle course.`
        : `${actorName} a créé une course non assignée.`,
      data: { deliveryId: created.id, action: 'created', driverId: driverId || '' },
    });

    emitDeliveryRealtimeEvent({ companyId: company.id, deliveryId: created.id, type: 'created' });
    return NextResponse.json(
      {
        message: 'Delivery created successfully.',
        delivery: mapDelivery(created.toObject(), partner.name, ''),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create delivery', code: 'DELIVERY_CREATE_FAILED' },
      { status: 500 }
    );
  }
}
