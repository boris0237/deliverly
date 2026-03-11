import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, PartnerModel, UserModel, WhatsAppConnectionModel, WhatsAppGroupBindingModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { connectWhatsAppConnection, disconnectWhatsAppConnection } from '@/lib/whatsapp/manager';

const connectSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
});

async function resolveActor(userId: string) {
  const actor = await UserModel.findOne({ id: userId }).lean();
  if (!actor?.companyId) return null;
  const company = await CompanyModel.findOne({ id: actor.companyId }).lean();
  if (!company) return null;
  return { actor, company };
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const queryPage = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const queryPageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const search = (searchParams.get('search') || '').trim();

    const groupQuery: Record<string, unknown> = { companyId: resolved.company.id };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      groupQuery.$or = [{ groupName: regex }, { groupJid: regex }];
    }

    const [connection, totalGroups, mappedGroups, activeMappedGroups, bindings, partners] = await Promise.all([
      WhatsAppConnectionModel.findOne({ companyId: resolved.company.id }).sort({ createdAt: -1 }).lean(),
      WhatsAppGroupBindingModel.countDocuments(groupQuery),
      WhatsAppGroupBindingModel.countDocuments({
        companyId: resolved.company.id,
        partnerId: { $exists: true, $nin: ['', null] },
      }),
      WhatsAppGroupBindingModel.countDocuments({
        companyId: resolved.company.id,
        partnerId: { $exists: true, $nin: ['', null] },
        isActive: true,
      }),
      WhatsAppGroupBindingModel.find(groupQuery)
        .sort({ updatedAt: -1 })
        .skip((queryPage - 1) * queryPageSize)
        .limit(queryPageSize)
        .lean(),
      PartnerModel.find({ companyId: resolved.company.id, isActive: true }).select({ _id: 0, id: 1, name: 1 }).lean(),
    ]);

    return NextResponse.json({
      connection: connection
        ? {
            id: connection.id,
            displayName: connection.displayName || '',
            phoneNumber: connection.phoneNumber || '',
            status: connection.status || 'disconnected',
            qrCode: connection.qrCode || '',
            lastError: connection.lastError || '',
            lastSeenAt: connection.lastSeenAt || null,
          }
        : null,
      groups: bindings.map((binding) => ({
        id: binding.id,
        groupJid: binding.groupJid,
        groupName: binding.groupName,
        partnerId: binding.partnerId || '',
        isActive: binding.isActive !== false,
        notifyOnStatusUpdates: binding.notifyOnStatusUpdates !== false,
        lastInboundAt: binding.lastInboundAt || null,
        lastOutboundAt: binding.lastOutboundAt || null,
      })),
      partners: partners.map((partner) => ({ id: partner.id, name: partner.name })),
      metrics: {
        mappedGroups,
        activeMappedGroups,
      },
      pagination: {
        page: queryPage,
        pageSize: queryPageSize,
        total: totalGroups,
        totalPages: Math.max(1, Math.ceil(totalGroups / queryPageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch WhatsApp assistant', code: 'WHATSAPP_ASSISTANT_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const existing = await WhatsAppConnectionModel.findOne({ companyId: resolved.company.id }).lean();
    const connectionId = existing?.id || randomToken(12);
    const displayName = parsed.data.displayName || resolved.company.name || 'Deliverly Assistant';
    if (!existing) {
      await WhatsAppConnectionModel.create({
        id: connectionId,
        companyId: resolved.company.id,
        ownerUserId: userId,
        displayName,
        status: 'connecting',
      });
    } else {
      await WhatsAppConnectionModel.updateOne(
        { id: existing.id },
        {
          $set: {
            status: 'connecting',
            displayName,
            lastError: '',
            updatedAt: new Date(),
          },
        }
      );
    }

    await connectWhatsAppConnection({ companyId: resolved.company.id, connectionId });
    const updated = await WhatsAppConnectionModel.findOne({ id: connectionId }).lean();

    return NextResponse.json({
      message: 'WhatsApp assistant connection started.',
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
    console.error('Error connecting WhatsApp assistant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect WhatsApp assistant', code: 'WHATSAPP_CONNECT_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const resolved = await resolveActor(userId);
    if (!resolved) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const existing = await WhatsAppConnectionModel.findOne({ companyId: resolved.company.id }).lean();
    if (!existing) {
      return NextResponse.json({ error: 'Connection not found', code: 'WHATSAPP_CONNECTION_NOT_FOUND' }, { status: 404 });
    }

    await disconnectWhatsAppConnection({ companyId: resolved.company.id, connectionId: existing.id });
    return NextResponse.json({ message: 'WhatsApp assistant disconnected.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect WhatsApp assistant', code: 'WHATSAPP_DISCONNECT_FAILED' },
      { status: 500 }
    );
  }
}
