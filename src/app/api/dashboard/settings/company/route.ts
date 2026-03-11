import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { uploadToCloudinary } from '@/lib/uploads/cloudinary';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const deliveryPricingSchema = z.object({
  currency: z.string().min(3).max(5),
  fixed: z.object({
    enabled: z.boolean(),
    amount: z.number().min(0),
  }),
  package: z.object({
    enabled: z.boolean(),
    plans: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        amount: z.number().min(0),
      })
    ),
  }),
  percentage: z.object({
    enabled: z.boolean(),
    value: z.number().min(0).max(100),
  }),
  zone: z.object({
    enabled: z.boolean(),
    zones: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        amount: z.number().min(0),
        neighborhoods: z.array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            address: z.string().optional(),
            latitude: z.number(),
            longitude: z.number(),
            placeId: z.string().optional(),
          })
        ),
      })
    ),
  }),
});

const defaultDeliveryPricing = {
  currency: 'XAF',
  fixed: { enabled: false, amount: 0 },
  package: { enabled: false, plans: [] },
  percentage: { enabled: false, value: 0 },
  zone: { enabled: false, zones: [] },
};

const notificationSettingsSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
  whatsapp: z.boolean(),
});

const defaultNotificationSettings = {
  email: true,
  inApp: true,
  whatsapp: false,
};

const vehicleSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  plateNumber: z.string().trim().min(1).max(40),
  capacityKg: z.number().min(0).max(100000),
  isActive: z.boolean(),
});

const defaultVehicles: Array<z.infer<typeof vehicleSchema>> = [];

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logo: z.string().trim().optional(),
  address: z.string().trim().max(250).optional(),
  whatsappDefaultLocale: z.enum(['fr', 'en']).optional(),
  businessHours: z
    .object({
      open: timeSchema,
      close: timeSchema,
    })
    .optional(),
  deliveryPricing: deliveryPricingSchema.optional(),
  notificationSettings: notificationSettingsSchema.optional(),
  vehicles: z.array(vehicleSchema).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'No settings payload provided' });

type ResolvedCompany = {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  whatsappDefaultLocale?: string;
  businessHours?: {
    open?: string;
    close?: string;
  } | null;
  deliveryPricing?: unknown;
  notificationSettings?: {
    email?: boolean;
    inApp?: boolean;
    whatsapp?: boolean;
  } | null;
  vehicles?: Array<{
    id?: string;
    name?: string;
    type?: string;
    plateNumber?: string;
    capacityKg?: number;
    isActive?: boolean;
  }> | null;
};

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;

  if (user.companyId) {
    const existingCompany = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (existingCompany) return existingCompany;
  }

  // Backward-compatibility for legacy users without companyId.
  const companyId = randomToken(12);
  const companyName = `${user.firstName}'s Company`;

  await CompanyModel.create({
    id: companyId,
    name: companyName,
    ownerUserId: user.id,
    logo: '',
    address: '',
    businessHours: { open: '09:00', close: '18:00', days: [1, 2, 3, 4, 5] },
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

export async function GET() {
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

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        logo: company.logo || '',
        address: company.address || '',
        whatsappDefaultLocale: company.whatsappDefaultLocale || 'fr',
        businessHours: {
          open: company.businessHours?.open || '09:00',
          close: company.businessHours?.close || '18:00',
        },
        deliveryPricing: company.deliveryPricing || {
          ...defaultDeliveryPricing,
        },
        notificationSettings: company.notificationSettings || {
          ...defaultNotificationSettings,
        },
        vehicles: company.vehicles || [...defaultVehicles],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load company settings', code: 'COMPANY_SETTINGS_GET_FAILED' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let logoFile: File | null = null;
    let body: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const maybeFile = formData.get('logoFile');
      logoFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

      const name = String(formData.get('name') || '').trim();
      const logo = String(formData.get('logo') || '').trim();
      const address = String(formData.get('address') || '').trim();
      const whatsappDefaultLocale = String(formData.get('whatsappDefaultLocale') || '').trim();
      const open = String(formData.get('businessHours.open') || '').trim();
      const close = String(formData.get('businessHours.close') || '').trim();
      const deliveryPricingRaw = String(formData.get('deliveryPricing') || '').trim();

      body = {};
      if (name) body.name = name;
      if (logo) body.logo = logo;
      if (address) body.address = address;
      if (whatsappDefaultLocale) body.whatsappDefaultLocale = whatsappDefaultLocale;
      if (open && close) body.businessHours = { open, close };
      if (deliveryPricingRaw) {
        try {
          body.deliveryPricing = JSON.parse(deliveryPricingRaw);
        } catch {
          return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
        }
      }
    } else {
      body = await request.json();
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const company = await resolveCurrentCompany(userId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const payload = parsed.data;
    let logoUrl = payload.logo ?? company.logo ?? '';

    if (logoFile) {
      const uploaded = await uploadToCloudinary(logoFile, {
        folder: `deliverly/company-logos/${company.id}`,
        resourceType: 'image',
      });
      logoUrl = uploaded.secureUrl;
    }

    const setPayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (payload.name !== undefined) setPayload.name = payload.name;
    if (payload.address !== undefined) setPayload.address = payload.address;
    if (payload.whatsappDefaultLocale !== undefined) setPayload.whatsappDefaultLocale = payload.whatsappDefaultLocale;
    if (payload.businessHours !== undefined) {
      setPayload.businessHours = {
        ...(company.businessHours || {}),
        open: payload.businessHours.open,
        close: payload.businessHours.close,
      };
    }
    if (payload.deliveryPricing !== undefined) setPayload.deliveryPricing = payload.deliveryPricing;
    if (payload.notificationSettings !== undefined) setPayload.notificationSettings = payload.notificationSettings;
    if (payload.vehicles !== undefined) setPayload.vehicles = payload.vehicles;

    if (payload.logo !== undefined || logoFile) {
      setPayload.logo = logoUrl;
    }

    await CompanyModel.updateOne(
      { id: company.id },
      {
        $set: setPayload,
      }
    );

    return NextResponse.json({
      message: 'Company settings updated successfully.',
      company: {
        id: company.id,
        name: payload.name ?? company.name,
        logo: logoUrl,
        address: payload.address ?? company.address ?? '',
        whatsappDefaultLocale: payload.whatsappDefaultLocale ?? company.whatsappDefaultLocale ?? 'fr',
        businessHours: {
          open: payload.businessHours?.open || company.businessHours?.open || '09:00',
          close: payload.businessHours?.close || company.businessHours?.close || '18:00',
        },
        deliveryPricing: payload.deliveryPricing || company.deliveryPricing || {
          ...defaultDeliveryPricing,
        },
        notificationSettings: payload.notificationSettings || company.notificationSettings || {
          ...defaultNotificationSettings,
        },
        vehicles: payload.vehicles || company.vehicles || [...defaultVehicles],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update company settings',
        code: 'COMPANY_SETTINGS_UPDATE_FAILED',
      },
      { status: 500 }
    );
  }
}
