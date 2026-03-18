import { NextResponse } from 'next/server';
import { CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

export async function GET() {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await UserModel.findOne({ id: currentUserId }).lean();
    if (!user?.companyId) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const company = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const billing = company.billing;
    const endDate = billing?.trialEndsAt || billing?.currentPeriodEnd || null;
    const expired = endDate ? new Date(endDate).getTime() < Date.now() : false;

    return NextResponse.json({
      status: billing?.status || 'inactive',
      endDate,
      expired,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch billing status', code: 'BILLING_STATUS_FAILED' },
      { status: 500 }
    );
  }
}
