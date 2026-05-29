'use client';

import { useEffect, useRef, useState } from 'react';

export interface ReverseGeocodeResult {
    city: string;
    country: string | null;
}

export type ReverseGeocodeState = 'idle' | 'loading' | 'ready' | 'error';

export interface UseReverseGeocodeApi {
    state: ReverseGeocodeState;
    location: ReverseGeocodeResult | null;
}

interface BigDataCloudResponse {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
}

function isBigDataCloudResponse(value: unknown): value is BigDataCloudResponse {
    return typeof value === 'object' && value !== null;
}

function pickCityFromResponse(json: unknown): ReverseGeocodeResult | null {
    if (!isBigDataCloudResponse(json)) {
        return null;
    }

    const city =
        (typeof json.city === 'string' && json.city.trim()) ||
        (typeof json.locality === 'string' && json.locality.trim()) ||
        (typeof json.principalSubdivision === 'string' && json.principalSubdivision.trim()) ||
        '';

    if (city === '') {
        return null;
    }

    const country =
        typeof json.countryName === 'string' && json.countryName.trim()
            ? json.countryName.trim()
            : null;

    return { city, country };
}

/** Round to 0.01° so same-city coords reuse the cached result. */
function toGridKey(lat: number, lon: number): string {
    const r = (n: number) => Math.round(n * 100) / 100;

    return `${r(lat)},${r(lon)}`;
}

const cache = new Map<string, ReverseGeocodeResult>();

export function useReverseGeocode(
    coords: { lat: number; lon: number } | null,
): UseReverseGeocodeApi {
    const [state, setState] = useState<ReverseGeocodeState>('idle');
    const [location, setLocation] = useState<ReverseGeocodeResult | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (coords === null) {
            return;
        }

        const gridKey = toGridKey(coords.lat, coords.lon);
        const cached = cache.get(gridKey);

        if (cached !== undefined) {
            setLocation(cached);
            setState('ready');

            return;
        }

        abortRef.current?.abort();

        const controller = new AbortController();
        abortRef.current = controller;

        setState('loading');

        const url =
            `https://api.bigdatacloud.net/data/reverse-geocode-client` +
            `?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=es`;

        async function doFetch(): Promise<void> {
            try {
                const res = await fetch(url, { signal: controller.signal });

                if (!res.ok) {
                    throw new Error(`BigDataCloud responded with status ${res.status}`);
                }

                const json: unknown = await res.json();
                const result = pickCityFromResponse(json);

                if (result !== null) {
                    cache.set(gridKey, result);
                    setLocation(result);
                    setState('ready');
                } else {
                    setState('error');
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }

                console.error('Reverse geocode failed:', err);
                setState('error');
            }
        }

        void doFetch();

        return () => {
            abortRef.current?.abort();
        };
    }, [coords]);

    return { state, location };
}
