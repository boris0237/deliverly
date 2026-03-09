import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CompanyModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { emitDriverLocationRealtimeEvent } from '@/lib/realtime/socket-server';

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await UserModel.findOne({ id: currentUserId }).lean();
    if (!user?.companyId) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    if (String(user.role || '') !== 'driver') {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }
    const company = await CompanyModel.findOne({ id: user.companyId }).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const payload = parsed.data;
    const updatedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    if (Number.isNaN(updatedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp', code: 'INVALID_INPUT' }, { status: 400 });
    }

    await UserModel.updateOne(
      { id: user.id, companyId: company.id },
      {
        $set: {
          currentLocation: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            updatedAt,
          },
          updatedAt: new Date(),
        },
      }
    );

    emitDriverLocationRealtimeEvent({
      companyId: company.id,
      driverId: user.id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      updatedAt: updatedAt.toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update location',
        code: 'DRIVER_LOCATION_UPDATE_FAILED',
      },
      { status: 500 }
    );
  }
}

