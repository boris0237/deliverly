import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyModel, UserModel, WhatsAppConnectionModel, WhatsAppGroupBindingModel, connectDb } from '@/lib/auth/db';
import { emitWhatsAppRealtimeEvent } from '@/lib/realtime/socket-server';

const updateBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  partnerId: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  notifyOnStatusUpdates: z.boolean().optional(),
});

async function resolveActor(userId: string) {
  const actor = await UserModel.findOne({ id: userId }).lean();
  if (!actor?.companyId) return null;
  const company = await CompanyModel.findOne({ id: actor.companyId }).lean();
  if (!company) return null;
  return { actor, company };
}

export async function PATCH(request: Request) {
  try {
    await connectDb();
    const { getCurrentSessionUserId } = await import('@/lib/auth/session');
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = updateBindingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const existing = await WhatsAppGroupBindingModel.findOne({
      id: parsed.data.bindingId,
      companyId: resolved.company.id,
    }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'Group binding not found', code: 'WHATSAPP_GROUP_BINDING_NOT_FOUND' }, { status: 404 });
    }

    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.partnerId !== undefined) {
      const normalizedPartnerId = String(parsed.data.partnerId || '').trim();
      setPayload.partnerId = normalizedPartnerId;
      if (parsed.data.isActive === undefined && normalizedPartnerId) {
        setPayload.isActive = true;
      }
    }
    if (parsed.data.isActive !== undefined) setPayload.isActive = parsed.data.isActive;
    if (parsed.data.notifyOnStatusUpdates !== undefined) setPayload.notifyOnStatusUpdates = parsed.data.notifyOnStatusUpdates;

    await WhatsAppGroupBindingModel.updateOne({ id: existing.id }, { $set: setPayload });
    const updated = await WhatsAppGroupBindingModel.findOne({ id: existing.id }).lean();
    emitWhatsAppRealtimeEvent({
      companyId: resolved.company.id,
      connectionId: String(existing.connectionId || ''),
      type: 'groups',
    });
    return NextResponse.json({
      message: 'Group binding updated.',
      binding: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update group binding', code: 'WHATSAPP_GROUP_BINDING_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await connectDb();
    const { getCurrentSessionUserId } = await import('@/lib/auth/session');
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const connection = await WhatsAppConnectionModel.findOne({ companyId: resolved.company.id }).lean();
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found', code: 'WHATSAPP_CONNECTION_NOT_FOUND' }, { status: 404 });
    }

    const { connectWhatsAppConnection, syncWhatsAppGroups } = await import('@/lib/whatsapp/manager');
    await connectWhatsAppConnection({ companyId: resolved.company.id, connectionId: connection.id });
    const startedAt = Date.now();
    let ready = false;
    while (Date.now() - startedAt < 25000) {
      const fresh = await WhatsAppConnectionModel.findOne({ id: connection.id, companyId: resolved.company.id })
        .select({ status: 1 })
        .lean();
      if (fresh?.status === 'connected') {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) {
      return NextResponse.json(
        { error: 'WhatsApp connection is not ready yet', code: 'WHATSAPP_NOT_READY' },
        { status: 409 }
      );
    }
    await syncWhatsAppGroups({ companyId: resolved.company.id, connectionId: connection.id });
    emitWhatsAppRealtimeEvent({
      companyId: resolved.company.id,
      connectionId: connection.id,
      type: 'groups',
    });
    return NextResponse.json({ message: 'Group sync started.' });
  } catch (error) {
    console.error('Error syncing WhatsApp groups:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync groups', code: 'WHATSAPP_GROUP_SYNC_FAILED' },
      { status: 500 }
    );
  }
}
