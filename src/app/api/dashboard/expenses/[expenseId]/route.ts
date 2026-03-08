import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyModel, connectDb, ExpenseModel, PartnerModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const EXPENSE_CATEGORIES = ['fuel', 'maintenance', 'salaries', 'equipment', 'other'] as const;
const EXPENSE_TARGET_TYPES = ['partner', 'user', 'vehicle', 'other'] as const;

const updateExpenseSchema = z
  .object({
    amount: z.number().min(0).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    date: z.string().trim().optional(),
    targetType: z.enum(EXPENSE_TARGET_TYPES).optional(),
    targetId: z.string().trim().optional(),
    targetLabel: z.string().trim().max(140).optional(),
    description: z.string().trim().max(500).optional(),
    receipt: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No update payload provided' });

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

export async function PUT(request: Request, context: { params: Promise<{ expenseId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCurrentCompanyId(currentUserId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { expenseId } = await context.params;
    const existing = await ExpenseModel.findOne({ id: expenseId, companyId }).lean();
    if (!existing) return NextResponse.json({ error: 'Expense not found', code: 'EXPENSE_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const payload = parsed.data;
    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.amount !== undefined) setPayload.amount = payload.amount;
    if (payload.category !== undefined) setPayload.category = payload.category;
    if (payload.description !== undefined) setPayload.description = payload.description;
    if (payload.receipt !== undefined) setPayload.receipt = payload.receipt;

    if (payload.date !== undefined) {
      const parsedDate = new Date(payload.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
      }
      setPayload.date = parsedDate;
    }

    const nextTargetType = payload.targetType !== undefined ? payload.targetType : existing.targetType || 'other';
    const nextTargetId = payload.targetId !== undefined ? payload.targetId.trim() : existing.targetId || '';
    const fallbackTargetLabel = payload.targetLabel !== undefined ? payload.targetLabel.trim() : existing.targetLabel || '';

    if (payload.targetType !== undefined) setPayload.targetType = nextTargetType;
    if (payload.targetId !== undefined) setPayload.targetId = nextTargetId;
    if (payload.targetLabel !== undefined) setPayload.targetLabel = fallbackTargetLabel;

    if (payload.targetType !== undefined || payload.targetId !== undefined || payload.targetLabel !== undefined) {
      const resolvedTargetLabel = await resolveTargetLabel(companyId, nextTargetType, nextTargetId, fallbackTargetLabel);
      if (resolvedTargetLabel === null) {
        return NextResponse.json({ error: 'Invalid target', code: 'INVALID_TARGET' }, { status: 400 });
      }
      setPayload.targetLabel = resolvedTargetLabel || '';
      setPayload.targetId = nextTargetId;
      setPayload.targetType = nextTargetType;
    }

    await ExpenseModel.updateOne({ id: expenseId, companyId }, { $set: setPayload });
    const updated = await ExpenseModel.findOne({ id: expenseId, companyId }).lean();
    if (!updated) return NextResponse.json({ error: 'Expense not found', code: 'EXPENSE_NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ message: 'Expense updated successfully.', expense: mapExpense(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update expense', code: 'EXPENSE_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ expenseId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCurrentCompanyId(currentUserId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { expenseId } = await context.params;
    const existing = await ExpenseModel.findOne({ id: expenseId, companyId }).lean();
    if (!existing) return NextResponse.json({ error: 'Expense not found', code: 'EXPENSE_NOT_FOUND' }, { status: 404 });

    await ExpenseModel.deleteOne({ id: expenseId, companyId });
    return NextResponse.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete expense', code: 'EXPENSE_DELETE_FAILED' },
      { status: 500 }
    );
  }
}

