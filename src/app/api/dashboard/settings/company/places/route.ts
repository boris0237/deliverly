import { NextResponse } from 'next/server';
import { CompanyModel, connectDb, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { resolveCountryCodeFromAddress, searchGooglePlaces } from '@/lib/integrations/google-places';

export async function GET(request: Request) {
  try {
    await connectDb();

    const userId = await getCurrentSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await UserModel.findOne({ id: userId }).lean();
    const company = user?.companyId ? await CompanyModel.findOne({ id: user.companyId }).lean() : null;
    const detectedCountryCode = company?.address ? await resolveCountryCodeFromAddress(company.address) : null;
    const fallbackCountryCode = process.env.OSM_DEFAULT_COUNTRY_CODE?.toLowerCase() || null;
    const countryCode = detectedCountryCode || fallbackCountryCode || undefined;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();

    if (query.length < 2) {
      return NextResponse.json({ places: [] });
    }

    const places = await searchGooglePlaces(query, { countryCode });
    return NextResponse.json({ places });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search places', code: 'PLACES_SEARCH_FAILED' },
      { status: 500 }
    );
  }
}
