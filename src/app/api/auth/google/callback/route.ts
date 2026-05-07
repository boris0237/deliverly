import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BillingPlanModel, CompanyMemberModel, CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { hashPassword, randomToken } from '@/lib/auth/crypto';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { getDefaultPathForRole } from '@/lib/auth/access';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_STATE_COOKIE = 'deliverly_google_oauth_state';

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

const getAppUrl = (request: Request) => {
  const fallbackOrigin = new URL(request.url).origin;
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
};

const redirectToLogin = (request: Request, code: string) => {
  const loginUrl = new URL('/auth/login', getAppUrl(request));
  loginUrl.searchParams.set('error', code);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
};

const splitName = (profile: GoogleUserInfo) => {
  if (profile.given_name || profile.family_name) {
    return {
      firstName: (profile.given_name || profile.name || 'Utilisateur').trim(),
      lastName: (profile.family_name || '').trim(),
    };
  }

  const parts = (profile.name || profile.email.split('@')[0] || 'Utilisateur').trim().split(/\s+/);
  return {
    firstName: parts[0] || 'Utilisateur',
    lastName: parts.slice(1).join(' ') || '-',
  };
};

const createTrialCompanyForGoogleUser = async (profile: GoogleUserInfo) => {
  const companyId = randomToken(12);
  const userId = randomToken(12);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const starterPlan = await BillingPlanModel.findOne({ isActive: true, name: /starter/i }).lean();
  const { firstName, lastName } = splitName(profile);
  const companyName = `${firstName}'s Company`;

  await CompanyModel.create({
    id: companyId,
    name: companyName,
    ownerUserId: null,
    logo: '',
    address: '',
    businessHours: {
      open: '09:00',
      close: '18:00',
      days: [1, 2, 3, 4, 5],
    },
    billing: {
      planId: starterPlan?.id || '',
      planName: starterPlan?.name || 'Starter',
      status: 'trialing',
      interval: 'trial',
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
    isActive: true,
  });

  const user = await UserModel.create({
    id: userId,
    email: profile.email.toLowerCase().trim(),
    passwordHash: hashPassword(randomToken(32)),
    authProvider: 'google',
    googleId: profile.sub,
    firstName,
    lastName,
    avatar: profile.picture || '',
    companyId,
    role: 'admin',
    isActive: true,
    emailVerified: true,
    emailVerifiedAt: now,
    lastLoginAt: now,
  });

  await CompanyModel.updateOne({ id: companyId }, { $set: { ownerUserId: userId, updatedAt: now } });
  await CompanyMemberModel.create({
    id: randomToken(12),
    companyId,
    userId,
    role: 'admin',
    isActive: true,
  });

  return user.toObject();
};

export async function GET(request: Request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return redirectToLogin(request, 'GOOGLE_AUTH_NOT_CONFIGURED');
    }

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const error = requestUrl.searchParams.get('error');
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;

    if (error) return redirectToLogin(request, 'GOOGLE_AUTH_CANCELLED');
    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectToLogin(request, 'GOOGLE_AUTH_INVALID_STATE');
    }

    await connectDb();

    const appUrl = getAppUrl(request);
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return redirectToLogin(request, 'GOOGLE_AUTH_TOKEN_FAILED');
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: 'no-store',
    });
    const profile = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!userInfoResponse.ok || !profile.sub || !profile.email || profile.email_verified === false) {
      return redirectToLogin(request, 'GOOGLE_AUTH_EMAIL_NOT_VERIFIED');
    }

    const email = profile.email.toLowerCase().trim();
    const now = new Date();
    let user = await UserModel.findOne({ $or: [{ googleId: profile.sub }, { email }] }).lean();

    if (user && !user.isActive) {
      return redirectToLogin(request, 'ACCOUNT_DISABLED');
    }

    if (user) {
      const { firstName, lastName } = splitName(profile);
      const currentAvatar = String(user.avatar || '');
      const shouldUseGoogleAvatar =
        Boolean(profile.picture) &&
        (!currentAvatar ||
          currentAvatar.includes('api.dicebear.com') ||
          currentAvatar.includes('googleusercontent.com'));

      await UserModel.updateOne(
        { id: user.id },
        {
          $set: {
            googleId: profile.sub,
            authProvider: user.authProvider || 'google',
            avatar: shouldUseGoogleAvatar ? profile.picture : currentAvatar,
            firstName: user.firstName || firstName,
            lastName: user.lastName || lastName,
            emailVerified: true,
            emailVerifiedAt: user.emailVerifiedAt || now,
            lastLoginAt: now,
            updatedAt: now,
          },
        }
      );
      user = await UserModel.findOne({ id: user.id }).lean();
    } else {
      user = await createTrialCompanyForGoogleUser(profile);
    }

    if (!user) {
      return redirectToLogin(request, 'GOOGLE_AUTH_FAILED');
    }

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    const redirectUrl = new URL(getDefaultPathForRole(user.role), appUrl);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    return redirectToLogin(request, 'GOOGLE_AUTH_FAILED');
  }
}
