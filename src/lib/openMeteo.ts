export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export interface UvReading {
    uv: number | null;
    time: string;
    timezone: string;
}

export interface CurrentWeather {
    uv: number | null;
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    weatherCode: number | null;
    windSpeedKmh: number | null;
    isDay: boolean | null;
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

function buildUvUrl(lat: number, lon: number): string {
    const params = new URLSearchParams({
        latitude: lat.toFixed(1),
        longitude: lon.toFixed(1),
        current: 'uv_index',
        timezone: 'auto',
    });

    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function buildWeatherUrl(lat: number, lon: number): string {
    const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        current: 'uv_index,temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
        timezone: 'auto',
    });

    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

const WMO_DESCRIPTIONS: Record<number, string> = {
    0: 'Despejado',
    1: 'Parcialmente nublado',
    2: 'Parcialmente nublado',
    3: 'Parcialmente nublado',
    45: 'Niebla',
    48: 'Niebla',
    51: 'Llovizna',
    53: 'Llovizna',
    55: 'Llovizna',
    56: 'Llovizna helada',
    57: 'Llovizna helada',
    61: 'Lluvia',
    63: 'Lluvia',
    65: 'Lluvia',
    66: 'Lluvia helada',
    67: 'Lluvia helada',
    71: 'Nieve',
    73: 'Nieve',
    75: 'Nieve',
    77: 'Granos de nieve',
    80: 'Chaparrones',
    81: 'Chaparrones',
    82: 'Chaparrones',
    85: 'Chaparrones de nieve',
    86: 'Chaparrones de nieve',
    95: 'Tormenta',
    96: 'Tormenta con granizo',
    99: 'Tormenta con granizo',
};

export function weatherDescriptionEs(code: number | null, _isDay: boolean | null): string {
    if (code === null) {
        return 'Sin datos';
    }

    return WMO_DESCRIPTIONS[code] ?? 'Sin datos';
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
    const url = buildUvUrl(roundedLat, roundedLon);

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

function parseWeatherResponse(raw: unknown): Result<CurrentWeather> {
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

    const toNumOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);

    const rawIsDay = cur.is_day;
    const isDay: boolean | null = rawIsDay === 1 ? true : rawIsDay === 0 ? false : null;

    return {
        success: true,
        data: {
            uv: toNumOrNull(cur.uv_index),
            temperatureC: toNumOrNull(cur.temperature_2m),
            apparentTemperatureC: toNumOrNull(cur.apparent_temperature),
            weatherCode: toNumOrNull(cur.weather_code),
            windSpeedKmh: toNumOrNull(cur.wind_speed_10m),
            isDay,
            time,
            timezone,
        },
    };
}

export async function fetchCurrentWeather(
    lat: number,
    lon: number,
    fetchImpl: typeof fetch = fetch,
): Promise<Result<CurrentWeather>> {
    const url = buildWeatherUrl(lat, lon);

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
                error: new Error('Failed to parse Open-Meteo weather response as JSON'),
            };
        }

        return parseWeatherResponse(json);
    } catch (err) {
        if (err instanceof Error) {
            return { success: false, error: err };
        }

        return { success: false, error: new Error('Unknown error fetching weather data') };
    }
}
