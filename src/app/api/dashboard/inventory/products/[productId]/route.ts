import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, ProductModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { uploadToCloudinary } from '@/lib/uploads/cloudinary';

const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  price: z.number().min(0).optional(),
  partnerId: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'No update payload' });

type ResolvedCompany = {
  id: string;
};

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;

  if (user.companyId) {
    const existingCompany = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (existingCompany) return existingCompany;
  }

  const companyId = randomToken(12);
  const companyName = `${user.firstName}'s Company`;

  await CompanyModel.create({
    id: companyId,
    name: companyName,
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

function mapProduct(product: any) {
  return {
    id: product.id,
    companyId: product.companyId,
    name: product.name,
    sku: product.sku,
    category: product.category || '',
    price: product.price || 0,
    stockQuantity: product.stockQuantity || 0,
    minStockLevel: product.minStockLevel || 0,
    partnerId: product.partnerId || '',
    warehouseLocation: product.warehouseLocation || '',
    image: product.image || '',
    isActive: product.isActive !== false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const { productId } = await context.params;
    const company = await resolveCurrentCompany(userId);
    if (!company) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const existing = await ProductModel.findOne({ id: productId, companyId: company.id, isActive: true }).lean();
    if (!existing) return NextResponse.json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });

    const contentType = request.headers.get('content-type') || '';
    let imageFile: File | null = null;
    let body: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const maybeFile = formData.get('imageFile');
      imageFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

      body = {};
      const name = String(formData.get('name') || '').trim();
      const price = String(formData.get('price') || '').trim();
      const partnerId = String(formData.get('partnerId') || '').trim();
      const image = String(formData.get('image') || '').trim();

      if (name) body.name = name;
      if (price) body.price = Number(price);
      body.partnerId = partnerId;
      if (image) body.image = image;
    } else {
      body = await request.json();
    }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const payload = parsed.data;
    let imageUrl = payload.image ?? existing.image ?? '';

    if (imageFile) {
      const uploaded = await uploadToCloudinary(imageFile, {
        folder: `deliverly/products/${company.id}`,
        resourceType: 'image',
      });
      imageUrl = uploaded.secureUrl;
    }

    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.name !== undefined) setPayload.name = payload.name;
    if (payload.price !== undefined) setPayload.price = payload.price;
    if (payload.partnerId !== undefined) setPayload.partnerId = payload.partnerId;
    if (payload.isActive !== undefined) setPayload.isActive = payload.isActive;
    if (payload.image !== undefined || imageFile) setPayload.image = imageUrl;

    await ProductModel.updateOne({ id: productId, companyId: company.id }, { $set: setPayload });

    const updated = await ProductModel.findOne({ id: productId, companyId: company.id }).lean();

    return NextResponse.json({
      message: 'Product updated successfully.',
      product: mapProduct(updated),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update product', code: 'PRODUCT_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const { productId } = await context.params;
    const company = await resolveCurrentCompany(userId);
    if (!company) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const existing = await ProductModel.findOne({ id: productId, companyId: company.id, isActive: true }).lean();
    if (!existing) return NextResponse.json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });

    await ProductModel.updateOne(
      { id: productId, companyId: company.id },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    return NextResponse.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete product', code: 'PRODUCT_DELETE_FAILED' },
      { status: 500 }
    );
  }
}
