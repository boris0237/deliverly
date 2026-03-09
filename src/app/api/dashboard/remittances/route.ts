import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, DeliveryModel, PartnerModel, RemittanceModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

const createSchema = z.object({
  partnerId: z.string().trim().min(1),
  amount: z.number().positive(),
  remittanceDate: z.string().trim().min(1),
  note: z.string().trim().max(500).optional(),
});

async function resolveCompanyId(userId: string): Promise<string | null> {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company.id;
}

async function computePartnerBalances(companyId: string) {
  const partners = await PartnerModel.find({ companyId, isActive: true }).lean();
  const deliveryRows = await DeliveryModel.aggregate([
    { $match: { companyId, status: 'delivered', collectFromCustomer: true, partnerId: { $ne: '' } } },
    {
      $group: {
        _id: '$partnerId',
        collected: { $sum: { $ifNull: ['$orderValue', 0] } },
        due: {
          $sum: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: ['$orderValue', 0] },
                  { $add: [{ $ifNull: ['$deliveryFee', 0] }, { $ifNull: ['$partnerExtraCharge', 0] }] },
                ],
              },
            ],
          },
        },
      },
    },
  ]);
  const remittanceRows = await RemittanceModel.aggregate([
    { $match: { companyId } },
    { $group: { _id: '$partnerId', remitted: { $sum: '$amount' } } },
  ]);

  const deliveryByPartner = new Map(deliveryRows.map((row) => [String(row._id || ''), row]));
  const remittedByPartner = new Map(remittanceRows.map((row) => [String(row._id || ''), Number(row.remitted || 0)]));

  const partnerBalances = partners.map((partner) => {
    const key = String(partner.id || '');
    const d = deliveryByPartner.get(key);
    const collected = Number(d?.collected || 0);
    const due = Number(d?.due || 0);
    const remitted = Number(remittedByPartner.get(key) || 0);
    const balance = Math.max(0, due - remitted);
    return {
      partnerId: key,
      partnerName: String(partner.name || '-'),
      collected,
      due,
      remitted,
      balance,
    };
  });

  return partnerBalances.sort((a, b) => b.balance - a.balance);
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCompanyId(userId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10') || 10));
    const partnerId = (searchParams.get('partnerId') || '').trim();
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const partnerBalances = await computePartnerBalances(companyId);
    const partnersById = new Map(partnerBalances.map((item) => [item.partnerId, item.partnerName]));

    const historyQuery: Record<string, unknown> = { companyId };
    if (partnerId) historyQuery.partnerId = partnerId;

    const [total, rawHistory] = await Promise.all([
      RemittanceModel.countDocuments(historyQuery),
      RemittanceModel.find(historyQuery)
        .sort({ remittanceDate: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const history = rawHistory
      .map((row) => ({
        id: row.id,
        partnerId: String(row.partnerId || ''),
        partnerName: partnersById.get(String(row.partnerId || '')) || '-',
        amount: Number(row.amount || 0),
        currency: String(row.currency || 'XAF').toUpperCase(),
        remittanceDate: row.remittanceDate,
        note: String(row.note || ''),
        createdAt: row.createdAt,
      }))
      .filter((row) => {
        if (!search) return true;
        return row.partnerName.toLowerCase().includes(search) || row.note.toLowerCase().includes(search);
      });

    const summary = partnerBalances.reduce(
      (acc, item) => ({
        collected: acc.collected + item.collected,
        remitted: acc.remitted + item.remitted,
        balance: acc.balance + item.balance,
      }),
      { collected: 0, remitted: 0, balance: 0 }
    );

    return NextResponse.json({
      summary,
      partners: partnerBalances,
      history,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch remittances', code: 'REMITTANCES_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const userId = await getCurrentSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const companyId = await resolveCompanyId(userId);
    if (!companyId) return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });

    const payload = parsed.data;
    const partner = await PartnerModel.findOne({ companyId, id: payload.partnerId, isActive: true }).lean();
    if (!partner) return NextResponse.json({ error: 'Partner not found', code: 'PARTNER_NOT_FOUND' }, { status: 404 });

    const remittanceDate = new Date(payload.remittanceDate);
    if (Number.isNaN(remittanceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
    }

    const partnerBalances = await computePartnerBalances(companyId);
    const current = partnerBalances.find((item) => item.partnerId === payload.partnerId);
    const currentBalance = Number(current?.balance || 0);
    if (payload.amount > currentBalance) {
      return NextResponse.json({ error: 'Amount exceeds partner balance', code: 'REMITTANCE_EXCEEDS_BALANCE' }, { status: 400 });
    }

    const company = await CompanyModel.findOne({ id: companyId }).lean();
    const currency = String(company?.deliveryPricing?.currency || 'XAF').toUpperCase();
    const created = await RemittanceModel.create({
      id: randomToken(12),
      companyId,
      partnerId: payload.partnerId,
      amount: payload.amount,
      currency,
      note: payload.note || '',
      remittanceDate,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: 'Remittance created successfully.',
      remittance: {
        id: created.id,
        partnerId: created.partnerId,
        amount: Number(created.amount || 0),
        currency: String(created.currency || currency),
        note: String(created.note || ''),
        remittanceDate: created.remittanceDate,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create remittance', code: 'REMITTANCE_CREATE_FAILED' },
      { status: 500 }
    );
  }
}

