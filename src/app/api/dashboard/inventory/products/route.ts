import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, ProductModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { uploadToCloudinary } from '@/lib/uploads/cloudinary';

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().max(80).optional(),
  category: z.string().trim().max(120).optional(),
  price: z.number().min(0),
  stockQuantity: z.number().int().min(0),
  minStockLevel: z.number().int().min(0).optional(),
  partnerId: z.string().trim().optional(),
  warehouseLocation: z.string().trim().max(160).optional(),
  image: z.string().trim().optional(),
});

type ResolvedCompany = {
  id: string;
  deliveryPricing?: {
    currency?: string;
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

function toSkuSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 6);
}

async function generateUniqueSku(companyId: string, productName: string): Promise<string> {
  const base = toSkuSlug(productName) || 'PRD';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = randomToken(2).toUpperCase();
    const candidate = `${base}-${suffix}`;
    const existing = await ProductModel.findOne({ companyId, sku: candidate, isActive: true }).lean();
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const partnerId = (searchParams.get('partnerId') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));

    const query: Record<string, unknown> = {
      companyId: company.id,
      isActive: true,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (partnerId) {
      query.partnerId = partnerId;
    }

    const [total, products, lowStockCount, lowStockPreview] = await Promise.all([
      ProductModel.countDocuments(query),
      ProductModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ProductModel.countDocuments({
        companyId: company.id,
        isActive: true,
        $expr: { $lte: ['$stockQuantity', '$minStockLevel'] },
      }),
      ProductModel.find({
        companyId: company.id,
        isActive: true,
        $expr: { $lte: ['$stockQuantity', '$minStockLevel'] },
      })
        .sort({ stockQuantity: 1, updatedAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currency = company.deliveryPricing?.currency || 'XAF';

    return NextResponse.json({
      products: products.map(mapProduct),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      lowStock: {
        count: lowStockCount,
        preview: lowStockPreview.map(mapProduct),
      },
      currency,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch products',
        code: 'PRODUCTS_FETCH_FAILED',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const contentType = request.headers.get('content-type') || '';
    let imageFile: File | null = null;
    let body: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const maybeFile = formData.get('imageFile');
      imageFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

      body = {
        name: String(formData.get('name') || '').trim(),
        category: String(formData.get('category') || '').trim(),
        price: Number(String(formData.get('price') || '0').trim() || 0),
        stockQuantity: Number(String(formData.get('stockQuantity') || '0').trim() || 0),
        partnerId: String(formData.get('partnerId') || '').trim(),
        warehouseLocation: String(formData.get('warehouseLocation') || '').trim(),
        image: String(formData.get('image') || '').trim(),
      };
    } else {
      body = await request.json();
    }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const sku = await generateUniqueSku(company.id, payload.name);

    let imageUrl = payload.image || '';
    if (imageFile) {
      const uploaded = await uploadToCloudinary(imageFile, {
        folder: `deliverly/products/${company.id}`,
        resourceType: 'image',
      });
      imageUrl = uploaded.secureUrl;
    }

    const now = new Date();
    const productId = randomToken(12);

    const created = await ProductModel.create({
      id: productId,
      companyId: company.id,
      name: payload.name,
      sku,
      category: payload.category || '',
      price: payload.price,
      stockQuantity: payload.stockQuantity,
      minStockLevel: payload.minStockLevel ?? 0,
      partnerId: payload.partnerId || '',
      warehouseLocation: payload.warehouseLocation || '',
      image: imageUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message: 'Product created successfully.',
        product: mapProduct(created.toObject()),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create product',
        code: 'PRODUCT_CREATE_FAILED',
      },
      { status: 500 }
    );
  }
}
