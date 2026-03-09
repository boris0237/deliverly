import { NextResponse } from 'next/server';
import { CompanyModel, RemittanceModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function resolveCompanyId(userId: string): Promise<string | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company.id;
}

export async function DELETE(_: Request, context: { params: Promise<{ remittanceId: string }> }) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCompanyId(userId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { remittanceId } = await context.params;
    const existing = await RemittanceModel.findOne({ id: remittanceId, companyId }).lean();
    if (!existing) return NextResponse.json({ error: 'Remittance not found', code: 'REMITTANCE_NOT_FOUND' }, { status: 404 });

    await RemittanceModel.deleteOne({ id: remittanceId, companyId });
    return NextResponse.json({ message: 'Remittance deleted successfully.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete remittance', code: 'REMITTANCE_DELETE_FAILED' },
      { status: 500 }
    );
  }
}

