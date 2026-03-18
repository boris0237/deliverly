import { NextResponse } from 'next/server';
import { CampaignModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(6, Number(searchParams.get('pageSize') || 10)));
    const query: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ subject: regex }];
    }

    const [total, campaigns] = await Promise.all([
      CampaignModel.countDocuments(query),
      CampaignModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        audienceType: campaign.audienceType,
        totalRecipients: campaign.totalRecipients || 0,
        sentCount: campaign.sentCount || 0,
        failedCount: campaign.failedCount || 0,
        createdAt: campaign.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaigns', code: 'CAMPAIGNS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
