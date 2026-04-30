import { NextResponse } from 'next/server';
import { connectDb } from '@/lib/auth/db';
import { bootstrapWhatsAppConnections } from '@/lib/whatsapp/manager';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_BOOTSTRAP_SECRET || process.env.BILLING_CRON_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    await connectDb();
    await bootstrapWhatsAppConnections();
    return NextResponse.json({ message: 'WhatsApp assistant bootstrap started.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bootstrap WhatsApp assistants', code: 'WHATSAPP_BOOTSTRAP_FAILED' },
      { status: 500 }
    );
  }
}
