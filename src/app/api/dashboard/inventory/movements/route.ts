import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyMemberModel, CompanyModel, connectDb, ProductModel, StockMovementModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const createMovementSchema = z.object({
  productId: z.string().trim().min(1),
  type: z.enum(['entry', 'exit']),
  quantity: z.number().int().min(1),
  reason: z.string().trim().max(240).optional(),
});

type ResolvedCompany = { id: string };

async function resolveCurrentCompany(userId: string): Promise<ResolvedCompany | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return null;

  if (user.companyId) {
    const existingCompany = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (existingCompany) return existingCompany;
  }

  const companyId = randomToken(12);
  const companyName = `${user.firstName}'s Company`;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

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
    billing: {
      planId: '',
      planName: 'Starter',
      status: 'trialing',
      interval: 'trial',
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
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
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const productId = (searchParams.get('productId') || '').trim();
    const type = (searchParams.get('type') || '').trim();

    const query: Record<string, unknown> = { companyId: company.id };
    if (productId) query.productId = productId;
    if (type === 'entry' || type === 'exit') query.type = type;

    const [total, movements] = await Promise.all([
      StockMovementModel.countDocuments(query),
      StockMovementModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const productIds = Array.from(new Set(movements.map((movement) => movement.productId)));
    const products = await ProductModel.find({ id: { $in: productIds }, companyId: company.id }).lean();
    const productMap = new Map(products.map((product) => [product.id, product]));

    return NextResponse.json({
      movements: movements.map((movement) => {
        const product = productMap.get(movement.productId);
        return {
          id: movement.id,
          productId: movement.productId,
          productName: product?.name || '',
          productSku: product?.sku || '',
          type: movement.type,
          quantity: movement.quantity,
          previousStock: movement.previousStock,
          newStock: movement.newStock,
          reason: movement.reason || '',
          performedBy: movement.performedBy,
          createdAt: movement.createdAt,
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch stock movements',
        code: 'STOCK_MOVEMENTS_FETCH_FAILED',
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

    const body = await request.json();
    const parsed = createMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;

    const product = await ProductModel.findOne({ id: payload.productId, companyId: company.id, isActive: true }).lean();
    if (!product) {
      return NextResponse.json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
    }

    const previousStock = product.stockQuantity || 0;
    const delta = payload.type === 'entry' ? payload.quantity : -payload.quantity;
    const nextStock = previousStock + delta;

    if (nextStock < 0) {
      return NextResponse.json({ error: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' }, { status: 400 });
    }

    await ProductModel.updateOne(
      { id: product.id, companyId: company.id },
      { $set: { stockQuantity: nextStock, updatedAt: new Date() } }
    );

    await StockMovementModel.create({
      id: randomToken(12),
      companyId: company.id,
      productId: product.id,
      type: payload.type,
      quantity: payload.quantity,
      previousStock,
      newStock: nextStock,
      reason: payload.reason || '',
      performedBy: userId,
      createdAt: new Date(),
    });

    return NextResponse.json({
      message: 'Stock movement recorded successfully.',
      stockQuantity: nextStock,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create stock movement',
        code: 'STOCK_MOVEMENT_CREATE_FAILED',
      },
      { status: 500 }
    );
  }
}
