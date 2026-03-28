export interface Coordinates {
    lat: number;
    lng: number;
}

/**
 * Geocode a free-text query (address, place name, or Singapore postal code)
 * to WGS84 lat/lng using the OneMap public search API (no API key required).
 */
export async function geocodeQuery(query: string): Promise<Coordinates | null> {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`OneMap geocoding failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.results?.length) {
        return null;
    }

    const first = data.results[0];
    const lat = parseFloat(first.LATITUDE);
    const lng = parseFloat(first.LONGITUDE);

    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }

    return { lat, lng };
}
