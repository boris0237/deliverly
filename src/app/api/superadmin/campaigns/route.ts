import { NextResponse } from 'next/server';
import {
  CampaignModel,
  CampaignRecipientModel,
  CompanyModel,
  PartnerModel,
  UserModel,
  connectDb,
} from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { sendBulkMailWithMailjetResults } from '@/lib/auth/mailjet';
import { randomToken } from '@/lib/auth/crypto';

type AudienceKey = 'all' | 'users' | 'drivers' | 'partners' | 'admins' | 'managers' | 'companies' | 'import';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function resolveRecipients(input: {
  audience: AudienceKey;
  companyIds?: string[];
  importEmails?: string[];
  importRows?: Array<{ email: string; name?: string; companyName?: string }>;
}) {
  const { audience, companyIds, importEmails } = input;

  if (audience === 'partners') {
    const partners = await PartnerModel.find({ email: { $ne: '' } })
      .select({ _id: 0, name: 1, email: 1 })
      .lean();
    return partners
      .filter((partner) => partner.email)
      .map((partner) => ({ email: normalizeEmail(String(partner.email)), name: String(partner.name || '') }));
  }

  if (audience === 'companies') {
    const query = companyIds?.length ? { id: { $in: companyIds } } : {};
    const companies = await CompanyModel.find(query).select({ _id: 0, id: 1, name: 1, ownerUserId: 1 }).lean();
    const ownerIds = companies.map((company) => company.ownerUserId).filter(Boolean);
    const owners = await UserModel.find({ id: { $in: ownerIds } })
      .select({ _id: 0, id: 1, email: 1, firstName: 1, lastName: 1 })
      .lean();
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    return companies
      .map((company) => {
        const owner = ownerById.get(company.ownerUserId || '');
        return owner?.email
          ? {
              email: normalizeEmail(String(owner.email)),
              name: company.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim(),
              companyName: company.name || '',
              companyId: company.id,
            }
          : null;
      })
      .filter(Boolean) as Array<{ email: string; name: string; companyId: string }>;
  }

  if (audience === 'import') {
    const rows = input.importRows || [];
    if (rows.length) {
      return rows
        .map((row) => ({
          email: normalizeEmail(String(row.email)),
          name: String(row.name || ''),
          companyName: String(row.companyName || ''),
        }))
        .filter((row) => row.email.includes('@'));
    }
    const recipients = (importEmails || [])
      .map((email) => normalizeEmail(String(email)))
      .filter((email) => email.includes('@'));
    return recipients.map((email) => ({ email }));
  }

  const roleFilter =
    audience === 'drivers'
      ? { role: 'driver' }
      : audience === 'admins'
      ? { role: 'admin' }
      : audience === 'managers'
      ? { role: 'manager' }
      : {};

  const users = await UserModel.find(roleFilter)
    .select({ _id: 0, email: 1, firstName: 1, lastName: 1 })
    .lean();

  return users
    .filter((user) => user.email)
    .map((user) => ({
      email: normalizeEmail(String(user.email)),
      name: `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim(),
    }));
}

export async function GET() {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const [usersCount, driversCount, adminsCount, managersCount, partnersCount, companiesCount] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ role: 'driver' }),
      UserModel.countDocuments({ role: 'admin' }),
      UserModel.countDocuments({ role: 'manager' }),
      PartnerModel.countDocuments({}),
      CompanyModel.countDocuments({}),
    ]);

    return NextResponse.json({
      counts: {
        all: usersCount + partnersCount,
        users: usersCount,
        drivers: driversCount,
        admins: adminsCount,
        managers: managersCount,
        partners: partnersCount,
        companies: companiesCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaign stats', code: 'CAMPAIGN_STATS_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const payload = await request.json();
    const subject = String(payload.subject || '').trim();
    const html = String(payload.html || '').trim();
    const text = String(payload.text || '').trim() || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const audience = String(payload.audience || 'all') as AudienceKey;
    const companyIds = Array.isArray(payload.companyIds) ? payload.companyIds : [];
    const importEmails = Array.isArray(payload.importEmails) ? payload.importEmails : [];
    const importRows = Array.isArray(payload.importRows) ? payload.importRows : [];
    const templateId = String(payload.templateId || '').trim();

    if (!subject || !html) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const recipients = await resolveRecipients({ audience, companyIds, importEmails, importRows });
    const unique = new Map<string, {
      companyName?: string;
      companyId?: string; email: string; name?: string 
}>();
    for (const recipient of recipients) {
      if (!recipient.email) continue;
      unique.set(recipient.email, recipient);
    }

    const finalRecipients = Array.from(unique.values());
    if (finalRecipients.length === 0) {
      return NextResponse.json({ error: 'No recipients', code: 'NO_RECIPIENTS' }, { status: 400 });
    }

    const campaignId = randomToken(12);
    await CampaignModel.create({
      id: campaignId,
      createdBy: currentUserId,
      audienceType: audience,
      subject,
      html,
      text,
      status: 'queued',
      totalRecipients: finalRecipients.length,
      templateId,
    });
    await CampaignRecipientModel.insertMany(
      finalRecipients.map((recipient) => ({
        id: randomToken(12),
        campaignId,
        email: recipient.email,
        name: recipient.name || '',
        companyName: recipient.companyName || '',
        companyId: recipient.companyId || '',
      }))
    );

    return NextResponse.json({
      ok: true,
      status: 'queued',
      queued: finalRecipients.length,
      campaignId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send campaign', code: 'CAMPAIGN_SEND_FAILED' },
      { status: 500 }
    );
  }
}
