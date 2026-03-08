import { NextResponse } from 'next/server';
import { connectDb, UserModel } from '@/lib/auth/db';
import { clearCurrentSession, getCurrentSessionUserId } from '@/lib/auth/session';
import { toPublicUser } from '@/lib/auth/user';

export async function GET() {
  await connectDb();

  const userId = await getCurrentSessionUserId();

  if (!userId) {
    await clearCurrentSession();
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await UserModel.findOne({ id: userId }).lean();

  if (!user) {
    await clearCurrentSession();
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
