import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, connectDb, DeliveryModel, PartnerModel, ProductModel, StockMovementModel, UserModel } from '@/lib/auth/db';
import { createCompanyNotifications } from '@/lib/notifications/service';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { emitDeliveryRealtimeEvent } from '@/lib/realtime/socket-server';

const updateDeliverySchema = z
  .object({
    partnerId: z.string().trim().optional(),
    customerName: z.string().trim().max(120).optional(),
    customerPhone: z.string().trim().min(6).max(40).optional(),
    address: z.string().trim().max(250).optional(),
    neighborhoodId: z.string().trim().optional(),
    deliveryDate: z.string().trim().optional(),
    driverId: z.string().trim().optional(),
    orderValue: z.number().min(0).optional(),
    collectFromCustomer: z.boolean().optional(),
    items: z.array(z.object({ productId: z.string().trim().min(1), quantity: z.number().int().min(1) })).optional(),
    deliveryFee: z.number().min(0).optional(),
    partnerExtraCharge: z.number().min(0).optional(),
    cancellationReason: z.string().trim().optional(),
    cancellationNote: z.string().trim().max(500).optional(),
    rescheduledDate: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional(),
    status: z.enum(['pending', 'assigned', 'pickedUp', 'inTransit', 'delivered', 'failed', 'cancelled']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No update payload provided' });

type ResolvedCompany = {
  id: string;
  deliveryPricing?: {
    zone?: {
      zones?: Array<{
        id: string;
        amount: number;
        neighborhoods?: Array<{ id: string; name: string; address?: string }>;
      }>;
    } | null;
  } | null;
};

type PartnerPricing = {
  type?: 'fixed' | 'package' | 'percentage' | 'zone';
  fixedAmount?: number;
  percentageValue?: number;
  zoneId?: string;
};

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company;
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

export async function GET(_: Request, context: { params: Promise<{ deliveryId: string }> }) {
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

    const { deliveryId } = await context.params;
    const delivery = await DeliveryModel.findOne({ id: deliveryId, companyId: company.id }).lean();
    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found', code: 'DELIVERY_NOT_FOUND' }, { status: 404 });
    }
    if (actor.role === 'driver') {
      const isVisibleToDriver = delivery.driverId === actor.id || !delivery.driverId;
      if (!isVisibleToDriver) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
      }
    }
    const [partner, driver] = await Promise.all([
      delivery.partnerId ? PartnerModel.findOne({ id: delivery.partnerId, companyId: company.id }).lean() : null,
      delivery.driverId ? UserModel.findOne({ id: delivery.driverId, companyId: company.id }).lean() : null,
    ]);
    const partnerName = partner?.name || '';
    const driverName = driver ? `${driver.firstName} ${driver.lastName}`.trim() : '';
    return NextResponse.json({ delivery: mapDelivery(delivery, partnerName, driverName, actor.role !== 'driver') });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch delivery', code: 'DELIVERY_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

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

function aggregateItemQuantities(items: Array<{ productId: string; quantity: number }>) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item?.productId) continue;
    map.set(item.productId, (map.get(item.productId) || 0) + Number(item.quantity || 0));
  }
  return map;
}

async function ensureSufficientStock(companyId: string, required: Map<string, number>) {
  const entries = Array.from(required.entries()).filter(([, qty]) => qty > 0);
  if (entries.length === 0) return;
  const productIds = entries.map(([productId]) => productId);
  const products = await ProductModel.find({ companyId, id: { $in: productIds }, isActive: true }).lean();
  const productMap = new Map(products.map((product) => [product.id, product]));
  for (const [productId, qty] of entries) {
    const product = productMap.get(productId);
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }
    const available = Number(product.stockQuantity || 0);
    if (qty > available) {
      throw new Error('INSUFFICIENT_STOCK');
    }
  }
}

async function applyStockDeltas(
  companyId: string,
  userId: string,
  deliveryId: string,
  deltas: Map<string, number>,
  reasonPrefix: string
) {
  const entries = Array.from(deltas.entries()).filter(([, delta]) => delta !== 0);
  if (entries.length === 0) return;

  const productIds = entries.map(([productId]) => productId);
  const products = await ProductModel.find({ companyId, id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const [productId, delta] of entries) {
    const product = productMap.get(productId);
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }
    const previousStock = Number(product.stockQuantity || 0);
    const nextStock = previousStock + delta;
    if (nextStock < 0) {
      throw new Error('INSUFFICIENT_STOCK');
    }
    productMap.set(productId, { ...product, stockQuantity: nextStock });
  }

  for (const [productId, delta] of entries) {
    const product = productMap.get(productId)!;
    const nextStock = Number(product.stockQuantity || 0);
    const previousStock = nextStock - delta;
    await ProductModel.updateOne({ companyId, id: productId }, { $set: { stockQuantity: nextStock, updatedAt: new Date() } });
    await StockMovementModel.create({
      id: randomToken(12),
      companyId,
      productId,
      type: delta > 0 ? 'entry' : 'exit',
      quantity: Math.abs(delta),
      previousStock,
      newStock: nextStock,
      reason: `${reasonPrefix} #${deliveryId}`,
      performedBy: userId,
      createdAt: new Date(),
    });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ deliveryId: string }> }) {
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

    const { deliveryId } = await context.params;
    const existing = await DeliveryModel.findOne({ id: deliveryId, companyId: company.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'Delivery not found', code: 'DELIVERY_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateDeliverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const actor = await UserModel.findOne({ id: currentUserId, companyId: company.id }).lean();
    if (!actor) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    const isDriverActor = actor.role === 'driver';

    const payload = parsed.data;
    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    const actorName = `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || actor?.email || currentUserId;

    if (isDriverActor) {
      const unauthorizedKeys = Object.keys(payload).filter(
        (key) => !['status', 'cancellationReason', 'cancellationNote', 'rescheduledDate'].includes(key)
      );
      if (unauthorizedKeys.length > 0) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
      }

      const nextStatus = payload.status;
      if (!nextStatus) {
        return NextResponse.json({ error: 'Status is required', code: 'INVALID_INPUT' }, { status: 400 });
      }

      const isAssignedToCurrentDriver = existing.driverId === currentUserId;
      const isUnassigned = !existing.driverId;
      const deliveryDate = new Date(existing.deliveryDate);
      const now = new Date();
      const isDeliveryToday =
        !Number.isNaN(deliveryDate.getTime()) &&
        deliveryDate.getFullYear() === now.getFullYear() &&
        deliveryDate.getMonth() === now.getMonth() &&
        deliveryDate.getDate() === now.getDate();
      if (nextStatus === 'assigned') {
        if (!(existing.status === 'pending' && isUnassigned)) {
          return NextResponse.json({ error: 'Invalid status transition', code: 'INVALID_STATUS_TRANSITION' }, { status: 400 });
        }
        const accepted = await DeliveryModel.findOneAndUpdate(
          {
            id: deliveryId,
            companyId: company.id,
            status: 'pending',
            $or: [{ driverId: '' }, { driverId: null }, { driverId: { $exists: false } }],
          },
          {
            $set: {
              status: 'assigned',
              driverId: currentUserId,
              updatedAt: new Date(),
            },
            $push: {
              logs: {
                id: randomToken(12),
                action: 'status_changed',
                message: 'Status changed from pending to assigned',
                actorId: currentUserId,
                actorName,
                createdAt: new Date(),
              },
            },
          },
          { new: true }
        ).lean();

        if (!accepted) {
          return NextResponse.json({ error: 'Delivery already accepted', code: 'DELIVERY_ALREADY_ACCEPTED' }, { status: 409 });
        }

        await createCompanyNotifications({
          companyId: company.id,
          actorUserId: currentUserId,
          type: 'delivery',
          title: `Livraison #${deliveryId} acceptée`,
          message: `${actorName} a accepté la livraison.`,
          data: { deliveryId, action: 'accepted', status: 'assigned' },
        });
        emitDeliveryRealtimeEvent({ companyId: company.id, deliveryId, type: 'accepted' });
        return NextResponse.json({ message: 'Delivery accepted successfully.', delivery: mapDelivery(accepted, '', '', !isDriverActor) });
      } else if (nextStatus === 'inTransit') {
        const canStartAssigned = existing.status === 'assigned' && isAssignedToCurrentDriver;
        const canResumeCancelledToday = existing.status === 'cancelled' && isAssignedToCurrentDriver && isDeliveryToday;
        if (!(canStartAssigned || canResumeCancelledToday)) {
          return NextResponse.json({ error: 'Invalid status transition', code: 'INVALID_STATUS_TRANSITION' }, { status: 400 });
        }
      } else if (nextStatus === 'delivered') {
        if (!(existing.status === 'inTransit' && isAssignedToCurrentDriver)) {
          return NextResponse.json({ error: 'Invalid status transition', code: 'INVALID_STATUS_TRANSITION' }, { status: 400 });
        }
      } else if (nextStatus === 'cancelled') {
        if (!isAssignedToCurrentDriver || !['assigned', 'inTransit'].includes(existing.status)) {
          return NextResponse.json({ error: 'Invalid status transition', code: 'INVALID_STATUS_TRANSITION' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'Invalid status transition', code: 'INVALID_STATUS_TRANSITION' }, { status: 400 });
      }
    }

    if (payload.customerName !== undefined) setPayload.customerName = payload.customerName;
    if (payload.customerPhone !== undefined) setPayload.customerPhone = payload.customerPhone;
    if (payload.orderValue !== undefined) setPayload.orderValue = payload.orderValue;
    if (payload.collectFromCustomer !== undefined) setPayload.collectFromCustomer = payload.collectFromCustomer;
    if (payload.deliveryFee !== undefined) setPayload.deliveryFee = payload.deliveryFee;
    if (payload.partnerExtraCharge !== undefined) setPayload.partnerExtraCharge = payload.partnerExtraCharge;
    if (payload.cancellationReason !== undefined) setPayload.cancellationReason = payload.cancellationReason;
    if (payload.cancellationNote !== undefined) setPayload.cancellationNote = payload.cancellationNote;
    if (payload.notes !== undefined) setPayload.notes = payload.notes;
    if (payload.status !== undefined) setPayload.status = payload.status;

    if (payload.rescheduledDate !== undefined) {
      if (!payload.rescheduledDate.trim()) {
        setPayload.rescheduledDate = null;
      } else {
        const parsedRescheduledDate = new Date(payload.rescheduledDate);
        if (Number.isNaN(parsedRescheduledDate.getTime())) {
          return NextResponse.json({ error: 'Invalid rescheduled date', code: 'INVALID_DELIVERY_DATE' }, { status: 400 });
        }
        setPayload.rescheduledDate = parsedRescheduledDate;
      }
    }

    if ((payload.status === 'cancelled' || existing.status === 'cancelled') && payload.status === 'cancelled') {
      const cancellationReason = (payload.cancellationReason || '').trim();
      if (!cancellationReason) {
        return NextResponse.json({ error: 'Cancellation reason is required', code: 'INVALID_CANCELLATION_REASON' }, { status: 400 });
      }
      if ((cancellationReason === 'postponed' || cancellationReason === 'postponed_later') && !String(payload.rescheduledDate || '').trim()) {
        return NextResponse.json({ error: 'Rescheduled date is required', code: 'RESCHEDULED_DATE_REQUIRED' }, { status: 400 });
      }
    }

    let nextPartnerId = existing.partnerId;
    if (payload.partnerId !== undefined) {
      const wantedPartnerId = payload.partnerId.trim();
      if (!wantedPartnerId) {
        return NextResponse.json({ error: 'Partner is required', code: 'PARTNER_REQUIRED' }, { status: 400 });
      }
      const partner = await PartnerModel.findOne({
        id: wantedPartnerId,
        companyId: company.id,
        isActive: true,
      }).lean();
      if (!partner) {
        return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
      }
      nextPartnerId = partner.id;
      setPayload.partnerId = nextPartnerId;
      if (nextPartnerId !== existing.partnerId) {
        if (payload.items === undefined) {
          return NextResponse.json(
            { error: 'Items are required when changing partner', code: 'DELIVERY_ITEMS_REQUIRED' },
            { status: 400 }
          );
        }
        setPayload.neighborhoodId = '';
      }
    }

    if (payload.deliveryDate !== undefined) {
      const parsedDate = new Date(payload.deliveryDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid delivery date', code: 'INVALID_DELIVERY_DATE' }, { status: 400 });
      }
      setPayload.deliveryDate = parsedDate;
    }

    if (payload.driverId !== undefined) {
      const nextDriverId = payload.driverId.trim();
      if (!nextDriverId) {
        setPayload.driverId = '';
        if (existing.status === 'assigned') {
          setPayload.status = 'pending';
        }
      } else {
        const driver = await UserModel.findOne({
          id: nextDriverId,
          companyId: company.id,
          role: 'driver',
          isActive: true,
        }).lean();
        if (!driver) {
          return NextResponse.json({ error: 'Driver not found', code: 'DRIVER_NOT_FOUND' }, { status: 404 });
        }
        setPayload.driverId = nextDriverId;
        if (existing.status === 'pending') {
          setPayload.status = 'assigned';
        }
      }
    }

    if (payload.items !== undefined) {
      const productIds = payload.items.map((item) => item.productId);
      const products = await ProductModel.find({
        companyId: company.id,
        isActive: true,
        id: { $in: productIds },
        partnerId: nextPartnerId,
      }).lean();
      if (products.length !== productIds.length) {
        return NextResponse.json({ error: 'Invalid product selection', code: 'INVALID_DELIVERY_ITEMS' }, { status: 400 });
      }
      const productMap = new Map(products.map((product) => [product.id, product]));
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
      setPayload.items = items;
      if (payload.orderValue === undefined) {
        setPayload.orderValue = items.reduce((sum, item) => sum + item.total, 0);
      }
    }

    const activePartner = await PartnerModel.findOne({ id: nextPartnerId, companyId: company.id, isActive: true }).lean();
    if (!activePartner) {
      return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
    }

    const pricing = (activePartner.pricing || {}) as PartnerPricing;
    let nextNeighborhoodId = existing.neighborhoodId || '';
    if (payload.neighborhoodId !== undefined) {
      nextNeighborhoodId = payload.neighborhoodId.trim();
    } else if (payload.partnerId !== undefined && payload.partnerId.trim() !== existing.partnerId) {
      nextNeighborhoodId = '';
    }

    let nextAddress = payload.address !== undefined ? payload.address.trim() : (existing.address || '').trim();
    if (pricing.type === 'zone' && nextNeighborhoodId) {
      const zone = company.deliveryPricing?.zone?.zones?.find((candidate) => candidate.id === pricing.zoneId);
      const neighborhood = zone?.neighborhoods?.find((candidate) => candidate.id === nextNeighborhoodId);
      if (!neighborhood) {
        return NextResponse.json({ error: 'Invalid neighborhood', code: 'INVALID_NEIGHBORHOOD' }, { status: 400 });
      }
      if (!nextAddress) {
        nextAddress = neighborhood.address?.trim() || neighborhood.name.trim();
      }
    }

    if (!nextAddress) {
      return NextResponse.json({ error: 'Delivery address is required', code: 'ADDRESS_REQUIRED' }, { status: 400 });
    }
    setPayload.address = nextAddress;
    setPayload.neighborhoodId = nextNeighborhoodId;

    if (payload.deliveryFee === undefined) {
      const nextOrderValue =
        typeof setPayload.orderValue === 'number' ? Number(setPayload.orderValue) : Number(existing.orderValue || 0);
      setPayload.deliveryFee = computeAutoDeliveryFee(company, pricing, nextOrderValue, nextNeighborhoodId);
    }

    const statusBefore = existing.status;
    const statusAfter = (setPayload.status as string | undefined) || existing.status;
    const nextDeliveryDate =
      setPayload.deliveryDate instanceof Date
        ? setPayload.deliveryDate
        : new Date(existing.deliveryDate);
    const nextRescheduledDate =
      setPayload.rescheduledDate instanceof Date
        ? setPayload.rescheduledDate
        : existing.rescheduledDate
          ? new Date(existing.rescheduledDate)
          : null;

    if (statusAfter === 'delivered') {
      setPayload.accountingDate = nextRescheduledDate || nextDeliveryDate;
    } else if (statusBefore === 'delivered' && statusAfter !== 'delivered') {
      setPayload.accountingDate = null;
    }

    const wasDelivered = statusBefore === 'delivered';
    const willBeDelivered = statusAfter === 'delivered';

    const existingItemQuantities = aggregateItemQuantities(
      Array.isArray(existing.items)
        ? existing.items.map((item: any) => ({ productId: String(item.productId || ''), quantity: Number(item.quantity || 0) }))
        : []
    );
    const nextItemsArray = Array.isArray(setPayload.items)
      ? (setPayload.items as Array<{ productId: string; quantity: number }>)
      : Array.isArray(existing.items)
        ? existing.items.map((item: any) => ({ productId: String(item.productId || ''), quantity: Number(item.quantity || 0) }))
        : [];
    const nextItemQuantities = aggregateItemQuantities(nextItemsArray);

    if (!wasDelivered && !willBeDelivered && payload.items !== undefined) {
      await ensureSufficientStock(company.id, nextItemQuantities);
    }

    if (!wasDelivered && willBeDelivered) {
      const deltas = new Map<string, number>();
      for (const [productId, qty] of nextItemQuantities.entries()) {
        deltas.set(productId, (deltas.get(productId) || 0) - qty);
      }
      await applyStockDeltas(company.id, currentUserId, deliveryId, deltas, 'DELIVERY_STOCK_DEDUCT');
    } else if (wasDelivered && !willBeDelivered) {
      const deltas = new Map<string, number>();
      for (const [productId, qty] of existingItemQuantities.entries()) {
        deltas.set(productId, (deltas.get(productId) || 0) + qty);
      }
      await applyStockDeltas(company.id, currentUserId, deliveryId, deltas, 'DELIVERY_STOCK_RESTORE');
    } else if (wasDelivered && willBeDelivered && payload.items !== undefined) {
      const deltas = new Map<string, number>();
      for (const [productId, qty] of existingItemQuantities.entries()) {
        deltas.set(productId, (deltas.get(productId) || 0) + qty);
      }
      for (const [productId, qty] of nextItemQuantities.entries()) {
        deltas.set(productId, (deltas.get(productId) || 0) - qty);
      }
      await applyStockDeltas(company.id, currentUserId, deliveryId, deltas, 'DELIVERY_STOCK_ADJUST');
    }

    const isCancellation = payload.status === 'cancelled';
    const logAction = isCancellation
      ? 'cancelled'
      : statusBefore !== statusAfter
        ? 'status_changed'
        : payload.driverId !== undefined
          ? 'assignment_updated'
          : 'updated';
    const logMessage = isCancellation
      ? `Cancelled reason=${payload.cancellationReason || ''};rescheduledDate=${payload.rescheduledDate || ''};note=${payload.cancellationNote || ''}`
      : statusBefore !== statusAfter
        ? `Status changed from ${statusBefore} to ${statusAfter}`
        : payload.driverId !== undefined
          ? 'Driver assignment updated'
          : 'Delivery updated';

    await DeliveryModel.updateOne(
      { id: deliveryId, companyId: company.id },
      {
        $set: setPayload,
        $push: {
          logs: {
            id: randomToken(12),
            action: logAction,
            message: logMessage,
            actorId: currentUserId,
            actorName,
            createdAt: new Date(),
          },
        },
      }
    );
    const updated = await DeliveryModel.findOne({ id: deliveryId, companyId: company.id }).lean();
    if (!updated) {
      return NextResponse.json({ error: 'Delivery not found', code: 'DELIVERY_NOT_FOUND' }, { status: 404 });
    }

    const notificationMessage =
      logAction === 'cancelled'
        ? `${actorName} a annulé la livraison #${deliveryId}.`
        : statusBefore !== statusAfter
          ? `${actorName} a changé le statut de la livraison #${deliveryId} vers ${statusAfter}.`
          : payload.driverId !== undefined
            ? `${actorName} a modifié l'affectation du livreur pour #${deliveryId}.`
            : `${actorName} a mis à jour la livraison #${deliveryId}.`;
    await createCompanyNotifications({
      companyId: company.id,
      actorUserId: currentUserId,
      type: 'delivery',
      title: `Livraison #${deliveryId} mise à jour`,
      message: notificationMessage,
      data: { deliveryId, action: logAction, status: statusAfter },
    });
    emitDeliveryRealtimeEvent({ companyId: company.id, deliveryId, type: 'updated' });
    return NextResponse.json({ message: 'Delivery updated successfully.', delivery: mapDelivery(updated, '', '', !isDriverActor) });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update delivery', code: 'DELIVERY_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ deliveryId: string }> }) {
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

    const { deliveryId } = await context.params;
    const existing = await DeliveryModel.findOne({ id: deliveryId, companyId: company.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'Delivery not found', code: 'DELIVERY_NOT_FOUND' }, { status: 404 });
    }

    if (existing.status === 'delivered') {
      const revertDeltas = new Map<string, number>();
      for (const item of existing.items || []) {
        revertDeltas.set(item.productId, (revertDeltas.get(item.productId) || 0) + Number(item.quantity || 0));
      }
      await applyStockDeltas(company.id, currentUserId, existing.id, revertDeltas, 'DELIVERY_STOCK_REVERT_DELETE');
    }

    await DeliveryModel.deleteOne({ id: deliveryId, companyId: company.id });
    const actorName = `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || actor?.email || currentUserId;
    await createCompanyNotifications({
      companyId: company.id,
      actorUserId: currentUserId,
      type: 'delivery',
      title: `Livraison #${deliveryId} supprimée`,
      message: `${actorName} a supprimé la livraison.`,
      data: { deliveryId, action: 'deleted' },
    });
    emitDeliveryRealtimeEvent({ companyId: company.id, deliveryId, type: 'deleted' });
    return NextResponse.json({ message: 'Delivery deleted successfully.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete delivery', code: 'DELIVERY_DELETE_FAILED' },
      { status: 500 }
    );
  }
}
