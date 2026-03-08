import { NextResponse } from 'next/server';
import { clearCurrentSession } from '@/lib/auth/session';

export async function POST() {
  await clearCurrentSession();
  return NextResponse.json({ success: true });
}
