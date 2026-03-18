export type GooglePlaceSuggestion = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type SearchOptions = {
  countryCode?: string;
};

type NominatimPlace = {
  place_id: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    hamlet?: string;
  };
};

export async function searchGooglePlaces(query: string, options: SearchOptions = {}): Promise<GooglePlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const userAgent = process.env.OSM_USER_AGENT || 'Delivoo/1.0 (contact: support@deliverly.app)';
  const contactEmail = process.env.OSM_CONTACT_EMAIL;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    'accept-language': 'fr,en',
  });
  if (options.countryCode) {
    params.set('countrycodes', options.countryCode.toLowerCase());
  }
  if (contactEmail) params.set('email', contactEmail);

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed (${response.status})`);
  }

  const data = (await response.json()) as NominatimPlace[];
  if (!Array.isArray(data)) return [];

  return data
    .filter((place) => place?.lat != null && place?.lon != null)
    .map((place) => {
      const address = place.display_name || '';
      const fallbackName =
        place.name ||
        place.address?.neighbourhood ||
        place.address?.suburb ||
        place.address?.city ||
        place.address?.town ||
        place.address?.village ||
        place.address?.hamlet ||
        address.split(',')[0] ||
        'Zone';

      return {
        placeId: String(place.place_id),
        name: fallbackName,
        address,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
      };
    });
}

export async function resolveCountryCodeFromAddress(address: string): Promise<string | null> {
  const q = address.trim();
  if (!q) return null;

  const userAgent = process.env.OSM_USER_AGENT || 'Delivoo/1.0 (contact: support@deliverly.app)';
  const contactEmail = process.env.OSM_CONTACT_EMAIL;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
  });
  if (contactEmail) params.set('email', contactEmail);

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ address?: { country_code?: string } }>;
  const countryCode = data?.[0]?.address?.country_code;
  return countryCode ? String(countryCode).toLowerCase() : null;
}
