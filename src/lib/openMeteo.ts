export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export interface UvReading {
    uv: number | null;
    time: string;
    timezone: string;
}

/**
 * Round lat/lon to 0.1° grid (~11 km) for dedup.
 * Two subs in the same city share one Open-Meteo call.
 */
export function gridKey(lat: number, lon: number): string {
    const r = (n: number) => Math.round(n * 10) / 10;

    return `${r(lat).toFixed(1)},${r(lon).toFixed(1)}`;
}

function buildUrl(lat: number, lon: number): string {
    const params = new URLSearchParams({
        latitude: lat.toFixed(1),
        longitude: lon.toFixed(1),
        current: 'uv_index',
        timezone: 'auto',
    });

    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function parseResponse(raw: unknown): Result<UvReading> {
    if (typeof raw !== 'object' || raw === null) {
        return { success: false, error: new Error('Unexpected response shape') };
    }

    const obj = raw as Record<string, unknown>;
    const timezone = typeof obj.timezone === 'string' ? obj.timezone : null;

    if (timezone === null) {
        return { success: false, error: new Error('Missing timezone in response') };
    }

    const current = obj.current;

    if (typeof current !== 'object' || current === null) {
        return { success: false, error: new Error('Missing current block in response') };
    }

    const cur = current as Record<string, unknown>;
    const time = typeof cur.time === 'string' ? cur.time : null;

    if (time === null) {
        return { success: false, error: new Error('Missing current.time in response') };
    }

    const rawUv = cur.uv_index;

    if (rawUv !== null && typeof rawUv !== 'number') {
        return { success: false, error: new Error(`Unexpected uv_index type: ${typeof rawUv}`) };
    }

    return { success: true, data: { uv: rawUv as number | null, time, timezone } };
}

export async function fetchUv(
    lat: number,
    lon: number,
    fetchImpl: typeof fetch = fetch,
): Promise<Result<UvReading>> {
    const r = (n: number) => Math.round(n * 10) / 10;
    const roundedLat = r(lat);
    const roundedLon = r(lon);
    const url = buildUrl(roundedLat, roundedLon);

    try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });

        if (!response.ok) {
            return {
                success: false,
                error: new Error(`Open-Meteo responded with status ${response.status}`),
            };
        }

        let json: unknown;

        try {
            json = await response.json();
        } catch {
            return {
                success: false,
                error: new Error('Failed to parse Open-Meteo response as JSON'),
            };
        }

        return parseResponse(json);
    } catch (err) {
        if (err instanceof Error) {
            return { success: false, error: err };
        }

        return { success: false, error: new Error('Unknown error fetching UV data') };
    }
}
