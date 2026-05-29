'use client';

import { useEffect, useRef, useState } from 'react';
import type { CurrentWeather } from '@/lib/openMeteo';

export type WeatherState = 'idle' | 'loading' | 'ready' | 'error';

export interface UseWeatherApi {
    state: WeatherState;
    weather: CurrentWeather | null;
    error: string | null;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useWeather(coords: { lat: number; lon: number } | null): UseWeatherApi {
    const [state, setState] = useState<WeatherState>('idle');
    const [weather, setWeather] = useState<CurrentWeather | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (coords === null) {
            return;
        }

        const { lat, lon } = coords;

        async function doFetch(): Promise<void> {
            abortRef.current?.abort();

            const controller = new AbortController();
            abortRef.current = controller;

            setState('loading');
            setError(null);

            try {
                const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = (await res.json()) as CurrentWeather;
                setWeather(data);
                setState('ready');
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }

                setError(err instanceof Error ? err.message : 'Error desconocido');
                setState('error');
            }
        }

        void doFetch();

        const intervalId = setInterval(() => {
            void doFetch();
        }, REFRESH_INTERVAL_MS);

        return () => {
            clearInterval(intervalId);
            abortRef.current?.abort();
        };
    }, [coords]);

    return { state, weather, error };
}
