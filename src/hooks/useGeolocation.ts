'use client';

import { useCallback, useState } from 'react';

export type GeolocationStatus =
    | 'idle'
    | 'requesting'
    | 'granted'
    | 'denied'
    | 'unsupported'
    | 'error';

export interface GeolocationState {
    status: GeolocationStatus;
    coords: { lat: number; lon: number } | null;
    error: string | null;
}

export interface UseGeolocationApi extends GeolocationState {
    request: () => Promise<void>;
}

const GEO_OPTIONS: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 10_000,
    maximumAge: 5 * 60 * 1_000,
};

export function useGeolocation(): UseGeolocationApi {
    const [state, setState] = useState<GeolocationState>({
        status: 'idle',
        coords: null,
        error: null,
    });

    const request = useCallback(async (): Promise<void> => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState({ status: 'unsupported', coords: null, error: null });

            return;
        }

        setState((prev) => ({ ...prev, status: 'requesting', error: null }));

        return new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setState({
                        status: 'granted',
                        coords: {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude,
                        },
                        error: null,
                    });
                    resolve();
                },
                (err) => {
                    if (err.code === err.PERMISSION_DENIED) {
                        setState({ status: 'denied', coords: null, error: err.message });
                    } else {
                        setState({ status: 'error', coords: null, error: err.message });
                    }

                    resolve();
                },
                GEO_OPTIONS,
            );
        });
    }, []);

    return { ...state, request };
}
