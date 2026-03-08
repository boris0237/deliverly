import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, connectDb, ExpenseModel, PartnerModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const EXPENSE_CATEGORIES = ['fuel', 'maintenance', 'salaries', 'equipment', 'other'] as const;
const EXPENSE_TARGET_TYPES = ['partner', 'user', 'vehicle', 'other'] as const;

const createExpenseSchema = z.object({
  amount: z.number().min(0),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.string().trim().min(1),
  targetType: z.enum(EXPENSE_TARGET_TYPES),
  targetId: z.string().trim().optional(),
  targetLabel: z.string().trim().max(140).optional(),
  description: z.string().trim().max(500).optional(),
  receipt: z.string().trim().max(500).optional(),
});

async function resolveCurrentCompanyId(userId: string): Promise<string | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company.id;
}

function mapExpense(expense: any) {
  return {
    id: expense.id,
    companyId: expense.companyId,
    amount: Number(expense.amount || 0),
    category: expense.category,
    date: expense.date,
    targetType: expense.targetType || 'other',
    targetId: expense.targetId || '',
    targetLabel: expense.targetLabel || '',
    description: expense.description || '',
    receipt: expense.receipt || '',
    createdBy: expense.createdBy || '',
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

async function resolveTargetLabel(companyId: string, targetType: string, targetId: string, fallbackLabel: string) {
  if (!targetId) return fallbackLabel;
  if (targetType === 'partner') {
    const partner = await PartnerModel.findOne({ companyId, id: targetId, isActive: true }).lean();
    if (!partner) return null;
    return partner.name || fallbackLabel;
  }
  if (targetType === 'user') {
    const user = await UserModel.findOne({ companyId, id: targetId, isActive: true }).lean();
    if (!user) return null;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || fallbackLabel;
  }
  return fallbackLabel;
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCurrentCompanyId(currentUserId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const search = (searchParams.get('search') || '').trim();
    const category = (searchParams.get('category') || '').trim();
    const targetType = (searchParams.get('targetType') || '').trim();
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();

    const query: Record<string, unknown> = { companyId };
    if (EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) query.category = category;
    if (EXPENSE_TARGET_TYPES.includes(targetType as (typeof EXPENSE_TARGET_TYPES)[number])) query.targetType = targetType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ description: regex }, { targetLabel: regex }, { category: regex }];
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) {
        const start = new Date(dateFrom);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          dateFilter.$gte = start;
        }
      }
      if (dateTo) {
        const end = new Date(dateTo);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }
      }
      if (dateFilter.$gte || dateFilter.$lte) query.date = dateFilter;
    }

    const [total, expenses] = await Promise.all([
      ExpenseModel.countDocuments(query),
      ExpenseModel.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      expenses: expenses.map(mapExpense),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch expenses', code: 'EXPENSES_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCurrentCompanyId(currentUserId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const payload = parsed.data;
    const parsedDate = new Date(payload.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
    }

    const targetId = payload.targetId?.trim() || '';
    const resolvedTargetLabel = await resolveTargetLabel(companyId, payload.targetType, targetId, payload.targetLabel?.trim() || '');
    if (resolvedTargetLabel === null) {
      return NextResponse.json({ error: 'Invalid target', code: 'INVALID_TARGET' }, { status: 400 });
    }

    const created = await ExpenseModel.create({
      id: randomToken(12),
      companyId,
      amount: payload.amount,
      category: payload.category,
      date: parsedDate,
      targetType: payload.targetType,
      targetId,
      targetLabel: resolvedTargetLabel || '',
      description: payload.description || '',
      receipt: payload.receipt || '',
      createdBy: currentUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ message: 'Expense created successfully.', expense: mapExpense(created.toObject()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create expense', code: 'EXPENSE_CREATE_FAILED' },
      { status: 500 }
    );
  }
}

