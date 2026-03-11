import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, DeliveryModel, PartnerModel, ProductModel, WhatsAppConnectionModel, WhatsAppGroupBindingModel } from '@/lib/auth/db';
import { createCompanyNotifications } from '@/lib/notifications/service';
import { emitDeliveryRealtimeEvent } from '@/lib/realtime/socket-server';
import type { ParsedWhatsAppOrder } from './order-parser';

function normalize(value: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStrict(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenSet(value: string) {
  return new Set(normalizeStrict(value).split(' ').filter(Boolean));
}

function isLooseMatch(left: string, right: string) {
  const a = normalizeStrict(left);
  const b = normalizeStrict(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size || !bTokens.size) return false;
  let overlap = 0;
  for (const token of bTokens) {
    if (aTokens.has(token)) overlap += 1;
  }
  return overlap >= Math.min(2, bTokens.size);
}

function normalizeAddress(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveZoneFromAddress(input: {
  address: string;
  zones: Array<{ id: string; name: string; amount: number; neighborhoods?: Array<{ name: string; address?: string }> }>;
  fallbackZoneId?: string;
}) {
  const normalizedAddress = normalizeAddress(input.address);
  if (!normalizedAddress) return null;

  let best: { zoneId: string; amount: number; score: number } | null = null;
  for (const zone of input.zones) {
    let score = 0;
    const zoneName = normalizeAddress(zone.name);
    if (zoneName && normalizedAddress.includes(zoneName)) score += 2;
    for (const neighborhood of zone.neighborhoods || []) {
      const nName = normalizeAddress(neighborhood.name);
      const nAddress = normalizeAddress(neighborhood.address || '');
      if (nName && normalizedAddress.includes(nName)) score += 3;
      if (nAddress && normalizedAddress.includes(nAddress)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { zoneId: zone.id, amount: Number(zone.amount || 0), score };
    }
  }
  if (best) return best;
  if (input.fallbackZoneId) {
    const fallback = input.zones.find((zone) => zone.id === input.fallbackZoneId);
    if (fallback) return { zoneId: fallback.id, amount: Number(fallback.amount || 0), score: 0 };
  }
  return null;
}

function computeDeliveryFee(input: {
  orderValue: number;
  address?: string;
  pricing: {
    type?: 'fixed' | 'package' | 'percentage' | 'zone';
    fixedAmount?: number;
    percentageValue?: number;
    packagePlanId?: string;
    zoneId?: string;
  };
  companyPricing?: {
    package?: { plans?: Array<{ id: string; amount: number }> };
    zone?: { zones?: Array<{ id: string; amount: number }> };
  };
}) {
  const pricingType = input.pricing?.type || 'fixed';
  if (pricingType === 'percentage') {
    return Math.max(0, (Math.max(0, Number(input.orderValue || 0)) * Number(input.pricing.percentageValue || 0)) / 100);
  }
  if (pricingType === 'package') {
    const plans = input.companyPricing?.package?.plans || [];
    const selected = plans.find((plan) => plan.id === input.pricing.packagePlanId) || plans[0];
    if (selected) return Math.max(0, Number(selected.amount || 0));
  }
  if (pricingType === 'zone') {
    const zones = input.companyPricing?.zone?.zones || [];
    const resolved = resolveZoneFromAddress({
      address: input.address || '',
      zones: zones as Array<{ id: string; name: string; amount: number; neighborhoods?: Array<{ name: string; address?: string }> }>,
      fallbackZoneId: input.pricing.zoneId,
    });
    if (resolved) return Math.max(0, Number(resolved.amount || 0));
  }
  return Math.max(0, Number(input.pricing.fixedAmount || 0));
}

export async function createDeliveryFromWhatsAppOrder(input: {
  companyId: string;
  connectionId: string;
  groupJid: string;
  senderName: string;
  senderJid: string;
  order: ParsedWhatsAppOrder;
}) {
  const binding = await WhatsAppGroupBindingModel.findOne({
    companyId: input.companyId,
    connectionId: input.connectionId,
    groupJid: input.groupJid,
    isActive: true,
  }).lean();
  if (!binding?.partnerId) {
    throw new Error('WHATSAPP_GROUP_NOT_MAPPED');
  }

  const partner = await PartnerModel.findOne({ companyId: input.companyId, id: binding.partnerId, isActive: true }).lean();
  if (!partner) throw new Error('PARTNER_NOT_FOUND');
  const company = await CompanyModel.findOne({ id: input.companyId }).lean();
  const connection = await WhatsAppConnectionModel.findOne({ companyId: input.companyId, id: input.connectionId }).lean();
  const createdByUserId = String(connection?.ownerUserId || '').trim();
  if (!createdByUserId) {
    throw new Error('WHATSAPP_CONNECTION_OWNER_NOT_FOUND');
  }

  const products = await ProductModel.find({ companyId: input.companyId, partnerId: partner.id, isActive: true }).lean();
  if (!products.length) throw new Error('NO_PARTNER_PRODUCTS');

  const productByName = new Map(products.map((product) => [normalize(product.name), product]));
  const items = input.order.items.map((item) => {
    const product = productByName.get(normalize(item.productName));
    if (!product) {
      const fallback = products.find((candidate) => isLooseMatch(candidate.name, item.productName));
      if (!fallback) throw new Error(`UNKNOWN_PRODUCT:${item.productName}`);
      return {
        product: fallback,
        quantity: item.quantity,
      };
    }
    return { product, quantity: item.quantity };
  });

  for (const item of items) {
    if (Number(item.quantity || 0) > Number(item.product.stockQuantity || 0)) {
      throw new Error(`INSUFFICIENT_STOCK:${item.product.name}`);
    }
  }

  const deliveryItems = items.map((item) => {
    const unitPrice = Number(item.product.price || 0);
    return {
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  });
  const computedOrderValue = deliveryItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const orderValue =
    Number.isFinite(input.order.orderTotal || NaN) && Number(input.order.orderTotal) > 0
      ? Number(input.order.orderTotal)
      : computedOrderValue;

  const created = await DeliveryModel.create({
    id: randomToken(12),
    companyId: input.companyId,
    partnerId: partner.id,
    driverId: '',
    customerName: input.order.customerName || '',
    customerPhone: input.order.customerPhone,
    address: input.order.address,
    neighborhoodId: '',
    deliveryDate: new Date(),
    orderValue,
    collectFromCustomer: true,
    deliveryFee: computeDeliveryFee({
      orderValue,
      address: input.order.address,
      pricing: {
        type: partner.pricing?.type,
        fixedAmount: partner.pricing?.fixedAmount,
        percentageValue: partner.pricing?.percentageValue,
        packagePlanId: partner.pricing?.packagePlanId,
        zoneId: partner.pricing?.zoneId,
      },
      companyPricing: (company?.deliveryPricing as {
        package?: { plans?: Array<{ id: string; amount: number }> };
        zone?: { zones?: Array<{ id: string; amount: number }> };
      }) || undefined,
    }),
    partnerExtraCharge: 0,
    items: deliveryItems,
    notes: [input.order.notes].filter(Boolean).join(' '),
    logs: [
      {
        id: randomToken(12),
        action: 'whatsapp_imported',
        message: `Imported from WhatsApp group ${input.groupJid} by ${input.senderName || input.senderJid}`,
        actorId: '',
        actorName: 'WhatsApp Assistant',
        createdAt: new Date(),
      },
    ],
    status: 'pending',
    createdBy: createdByUserId,
  });

  await createCompanyNotifications({
    companyId: input.companyId,
    type: 'delivery',
    title: `Nouvelle livraison WhatsApp #${created.id}`,
    message: `Commande capturée depuis WhatsApp (${partner.name})`,
    data: { deliveryId: created.id, source: 'whatsapp' },
  });
  emitDeliveryRealtimeEvent({ companyId: input.companyId, deliveryId: created.id, type: 'created' });

  return created;
}
