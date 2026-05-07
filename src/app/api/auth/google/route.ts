import { NextResponse } from 'next/server';
import { randomToken } from '@/lib/auth/crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_STATE_COOKIE = 'deliverly_google_oauth_state';

const getAppUrl = (request: Request) => {
  const fallbackOrigin = new URL(request.url).origin;
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
};

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(new URL('/auth/login?error=GOOGLE_AUTH_NOT_CONFIGURED', request.url));
  }

  const appUrl = getAppUrl(request);
  const state = randomToken(24);
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const authorizationUrl = new URL(GOOGLE_AUTH_URL);

  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}

