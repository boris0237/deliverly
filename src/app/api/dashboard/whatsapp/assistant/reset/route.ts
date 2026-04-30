import { NextResponse } from 'next/server';
import { CompanyModel, UserModel, WhatsAppConnectionModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { resetWhatsAppConnection } from '@/lib/whatsapp/manager';

export const runtime = 'nodejs';

async function resolveActor(userId: string) {
  const actor = await UserModel.findOne({ id: userId }).lean();
  if (!actor?.companyId) return null;
  const company = await CompanyModel.findOne({ id: actor.companyId }).lean();
  if (!company) return null;
  return { actor, company };
}

export async function POST() {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const connection = await WhatsAppConnectionModel.findOne({ companyId: resolved.company.id }).lean();
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found', code: 'WHATSAPP_CONNECTION_NOT_FOUND' }, { status: 404 });
    }

    await resetWhatsAppConnection({ companyId: resolved.company.id, connectionId: connection.id });
    const updated = await WhatsAppConnectionModel.findOne({ id: connection.id, companyId: resolved.company.id }).lean();

    return NextResponse.json({
      message: 'WhatsApp assistant reset started.',
      connection: updated
        ? {
            id: updated.id,
            status: updated.status,
            qrCode: updated.qrCode || '',
            phoneNumber: updated.phoneNumber || '',
            displayName: updated.displayName || '',
            lastError: updated.lastError || '',
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset WhatsApp assistant', code: 'WHATSAPP_RESET_FAILED' },
      { status: 500 }
    );
  }
}
