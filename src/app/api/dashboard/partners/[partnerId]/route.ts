import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, PartnerModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { uploadToCloudinary } from '@/lib/uploads/cloudinary';

const updatePartnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['restaurant', 'shop', 'pharmacy', 'ecommerce', 'other']),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(250).optional(),
  pricing: z.object({
    type: z.enum(['fixed', 'package', 'percentage', 'zone']),
    useDefaultValue: z.boolean().optional(),
    fixedAmount: z.number().min(0).optional(),
    percentageValue: z.number().min(0).max(100).optional(),
    packagePlanId: z.string().trim().optional(),
    zoneId: z.string().trim().optional(),
  }),
});

type ResolvedCompany = {
  id: string;
  deliveryPricing?: {
    currency?: string;
    fixed?: { enabled?: boolean; amount?: number } | null;
    package?: { enabled?: boolean; plans?: Array<{ id: string; name: string; amount: number }> } | null;
    percentage?: { enabled?: boolean; value?: number } | null;
    zone?: { enabled?: boolean; zones?: Array<{ id: string; name: string; amount: number }> } | null;
  } | null;
};

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;

  if (user.companyId) {
    const existingCompany = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (existingCompany) return existingCompany;
  }

  const companyId = randomToken(12);
  await CompanyModel.create({
    id: companyId,
    name: `${user.firstName}'s Company`,
    ownerUserId: user.id,
    logo: '',
    address: '',
    businessHours: { open: '09:00', close: '18:00', days: [1, 2, 3, 4, 5] },
    deliveryPricing: {
      currency: 'XAF',
      fixed: { enabled: false, amount: 0 },
      package: { enabled: false, plans: [] },
      percentage: { enabled: false, value: 0 },
      zone: { enabled: false, zones: [] },
    },
    isActive: true,
  });

  await UserModel.updateOne({ id: user.id }, { $set: { companyId, updatedAt: new Date() } });
  await CompanyMemberModel.updateOne(
    { companyId, userId: user.id },
    {
      $setOnInsert: {
        id: randomToken(12),
        companyId,
        userId: user.id,
        role: user.role,
        isActive: true,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  return CompanyModel.findOne({ id: companyId }).lean();
}

function buildPricingContext(company: ResolvedCompany) {
  const pricing = company.deliveryPricing || {};
  const currency = pricing.currency || 'XAF';

  const fixedEnabled = pricing.fixed?.enabled === true;
  const packageEnabled = pricing.package?.enabled === true && Array.isArray(pricing.package?.plans) && pricing.package!.plans!.length > 0;
  const percentageEnabled = pricing.percentage?.enabled === true;
  const zoneEnabled = pricing.zone?.enabled === true && Array.isArray(pricing.zone?.zones) && pricing.zone!.zones!.length > 0;

  const activeTypes: Array<'fixed' | 'package' | 'percentage' | 'zone'> = [];
  if (fixedEnabled) activeTypes.push('fixed');
  if (packageEnabled) activeTypes.push('package');
  if (percentageEnabled) activeTypes.push('percentage');
  if (zoneEnabled) activeTypes.push('zone');

  return {
    currency,
    activeTypes,
    defaults: {
      fixedAmount: pricing.fixed?.amount ?? 0,
      percentageValue: pricing.percentage?.value ?? 0,
      packagePlans: pricing.package?.plans ?? [],
      zones: pricing.zone?.zones ?? [],
    },
  };
}

function mapPartner(partner: any) {
  return {
    id: partner.id,
    companyId: partner.companyId,
    name: partner.name,
    type: partner.type,
    email: partner.email || '',
    phone: partner.phone || '',
    address: partner.address || '',
    logo: partner.logo || '',
    commissionRate: partner.commissionRate || 0,
    balance: partner.balance || 0,
    pricing: {
      type: partner.pricing?.type || 'fixed',
      currency: partner.pricing?.currency || 'XAF',
      useDefaultValue: partner.pricing?.useDefaultValue ?? true,
      fixedAmount: partner.pricing?.fixedAmount ?? 0,
      percentageValue: partner.pricing?.percentageValue ?? 0,
      packagePlanId: partner.pricing?.packagePlanId || '',
      packagePlanName: partner.pricing?.packagePlanName || '',
      zoneId: partner.pricing?.zoneId || '',
      zoneName: partner.pricing?.zoneName || '',
    },
    isActive: partner.isActive !== false,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}

export async function PUT(request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const company = await resolveCurrentCompany(userId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const { partnerId } = await context.params;
    const existingPartner = await PartnerModel.findOne({ id: partnerId, companyId: company.id, isActive: true }).lean();
    if (!existingPartner) {
      return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let logoFile: File | null = null;
    let body: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const maybeFile = formData.get('logoFile');
      logoFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

      const name = String(formData.get('name') || '').trim();
      const type = String(formData.get('type') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      const address = String(formData.get('address') || '').trim();

      const pricingType = String(formData.get('pricing.type') || '').trim();
      const useDefaultRaw = String(formData.get('pricing.useDefaultValue') || 'true').trim();
      const fixedRaw = String(formData.get('pricing.fixedAmount') || '').trim();
      const percentageRaw = String(formData.get('pricing.percentageValue') || '').trim();
      const packagePlanId = String(formData.get('pricing.packagePlanId') || '').trim();
      const zoneId = String(formData.get('pricing.zoneId') || '').trim();

      body = {
        name,
        type,
        email,
        phone,
        address,
        pricing: {
          type: pricingType,
          useDefaultValue: useDefaultRaw !== 'false',
          fixedAmount: fixedRaw ? Number(fixedRaw) : undefined,
          percentageValue: percentageRaw ? Number(percentageRaw) : undefined,
          packagePlanId,
          zoneId,
        },
      };
    } else {
      body = await request.json();
    }

    const parsed = updatePartnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const pricingContext = buildPricingContext(company);

    if (pricingContext.activeTypes.length === 0) {
      return NextResponse.json(
        { error: 'No active delivery pricing strategy', code: 'NO_ACTIVE_DELIVERY_PRICING' },
        { status: 400 }
      );
    }

    if (!pricingContext.activeTypes.includes(payload.pricing.type)) {
      return NextResponse.json({ error: 'Invalid pricing type', code: 'INVALID_PRICING_TYPE' }, { status: 400 });
    }

    let useDefaultValue = payload.pricing.useDefaultValue ?? true;
    let fixedAmount = 0;
    let percentageValue = 0;
    let packagePlanId = '';
    let packagePlanName = '';
    let zoneId = '';
    let zoneName = '';

    if (payload.pricing.type === 'fixed') {
      fixedAmount = pricingContext.defaults.fixedAmount;
      if (!useDefaultValue) {
        if (typeof payload.pricing.fixedAmount !== 'number') {
          return NextResponse.json({ error: 'Invalid fixed amount', code: 'INVALID_PRICING_VALUE' }, { status: 400 });
        }
        fixedAmount = payload.pricing.fixedAmount;
      }
    }

    if (payload.pricing.type === 'percentage') {
      percentageValue = pricingContext.defaults.percentageValue;
      if (!useDefaultValue) {
        if (typeof payload.pricing.percentageValue !== 'number') {
          return NextResponse.json({ error: 'Invalid percentage value', code: 'INVALID_PRICING_VALUE' }, { status: 400 });
        }
        percentageValue = payload.pricing.percentageValue;
      }
    }

    if (payload.pricing.type === 'package') {
      const packagePlans = pricingContext.defaults.packagePlans;
      const selected = packagePlans.find((plan) => plan.id === payload.pricing.packagePlanId) || packagePlans[0];
      if (!selected) {
        return NextResponse.json({ error: 'Invalid package plan', code: 'INVALID_PACKAGE_PLAN' }, { status: 400 });
      }
      packagePlanId = selected.id;
      packagePlanName = selected.name;
      fixedAmount = selected.amount;
      useDefaultValue = true;
    }

    if (payload.pricing.type === 'zone') {
      const zones = pricingContext.defaults.zones;
      const selected = zones.find((zone) => zone.id === payload.pricing.zoneId) || zones[0];
      if (!selected) {
        return NextResponse.json({ error: 'Invalid zone', code: 'INVALID_ZONE' }, { status: 400 });
      }
      zoneId = selected.id;
      zoneName = selected.name;
      fixedAmount = selected.amount;
      useDefaultValue = true;
    }

    let logoUrl = existingPartner.logo || '';
    if (logoFile) {
      const uploaded = await uploadToCloudinary(logoFile, {
        folder: `deliverly/partner-logos/${company.id}`,
        resourceType: 'image',
      });
      logoUrl = uploaded.secureUrl;
    }

    await PartnerModel.updateOne(
      { id: partnerId, companyId: company.id, isActive: true },
      {
        $set: {
          name: payload.name,
          type: payload.type,
          email: payload.email || '',
          phone: payload.phone || '',
          address: payload.address || '',
          logo: logoUrl,
          commissionRate: payload.pricing.type === 'percentage' ? percentageValue : 0,
          pricing: {
            type: payload.pricing.type,
            currency: pricingContext.currency,
            useDefaultValue,
            fixedAmount,
            percentageValue,
            packagePlanId,
            packagePlanName,
            zoneId,
            zoneName,
          },
          updatedAt: new Date(),
        },
      }
    );

    const updated = await PartnerModel.findOne({ id: partnerId, companyId: company.id, isActive: true }).lean();
    if (!updated) {
      return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Partner updated successfully.',
      partner: mapPartner(updated),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update partner',
        code: 'PARTNER_UPDATE_FAILED',
      },
      { status: 500 }
    );
  }
}
