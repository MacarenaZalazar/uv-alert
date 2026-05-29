'use client';

import { useEffect, useMemo, useState } from 'react';

import { useGeolocation } from '@/hooks/useGeolocation';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useWeather } from '@/hooks/useWeather';
import { weatherDescriptionEs } from '@/lib/openMeteo';
import type { CurrentWeather } from '@/lib/openMeteo';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uvLabel(uv: number | null): { label: string; className: string } {
    if (uv === null) {
        return { label: 'Sin datos', className: 'bg-slate-200 text-slate-600' };
    }

    if (uv <= 2) {
        return { label: 'Bajo', className: 'bg-green-200 text-green-800' };
    }

    if (uv <= 5) {
        return { label: 'Moderado', className: 'bg-amber-200 text-amber-800' };
    }

    if (uv <= 7) {
        return { label: 'Alto', className: 'bg-orange-200 text-orange-800' };
    }

    if (uv <= 10) {
        return { label: 'Muy alto', className: 'bg-red-200 text-red-800' };
    }

    return { label: 'Extremo', className: 'bg-violet-200 text-violet-900' };
}

function formatTemp(value: number | null): string {
    if (value === null) {
        return '--';
    }

    return `${Math.round(value)}°`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({
    children,
    className = '',
}: {
    readonly children: React.ReactNode;
    readonly className?: string;
}) {
    return (
        <div
            className={`rounded-3xl border border-white bg-white/80 p-6 shadow-lg shadow-violet-200/50 backdrop-blur-sm ${className}`}
        >
            {children}
        </div>
    );
}

interface UvBadgeProps {
    readonly uv: number | null;
}

function UvBadge({ uv }: UvBadgeProps) {
    const { label, className } = uvLabel(uv);
    const displayUv = uv !== null ? uv.toFixed(1) : '--';

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${className}`}
        >
            <span>UV {displayUv}</span>
            <span className="opacity-70">&middot;</span>
            <span>{label}</span>
        </span>
    );
}

interface WeatherCardProps {
    readonly weather: CurrentWeather;
    readonly displayLocation: string;
}

function WeatherCard({ weather, displayLocation }: WeatherCardProps) {
    const description = weatherDescriptionEs(weather.weatherCode, weather.isDay);

    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        const id = setInterval(() => {
            setNow(Date.now());
        }, 30_000);

        return () => {
            clearInterval(id);
        };
    }, []);

    const displayTime = useMemo(() => {
        if (!weather.timezone) {
            return null;
        }

        try {
            return new Intl.DateTimeFormat('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: weather.timezone,
                hour12: false,
            }).format(new Date(now));
        } catch {
            return null;
        }
    }, [weather.timezone, now]);

    const displayDate = useMemo(() => {
        if (!weather.timezone) {
            return null;
        }

        try {
            const raw = new Intl.DateTimeFormat('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: weather.timezone,
            }).format(new Date(now));

            return raw.charAt(0).toUpperCase() + raw.slice(1);
        } catch {
            return null;
        }
    }, [weather.timezone, now]);

    return (
        <Card>
            <p className="text-sm font-medium text-violet-600">{displayLocation}</p>
            {displayTime ? (
                <p className="text-xs text-slate-500 mt-0.5">
                    {displayDate} · {displayTime}
                </p>
            ) : null}
            <div className="mb-4 mt-3 flex items-start justify-between">
                <div>
                    <p className="text-6xl font-bold text-slate-800 leading-none">
                        {formatTemp(weather.temperatureC)}
                    </p>
                    <p className="mt-2 text-base text-slate-600">{description}</p>
                </div>
                <UvBadge uv={weather.uv} />
            </div>
            <div className="flex gap-4 text-sm text-slate-500">
                <span>Sensación: {formatTemp(weather.apparentTemperatureC)}</span>
                {weather.windSpeedKmh !== null && (
                    <span>Viento: {Math.round(weather.windSpeedKmh)} km/h</span>
                )}
            </div>
        </Card>
    );
}

interface SubscribeCardProps {
    readonly onActivate: () => void;
    readonly isLoading: boolean;
    readonly geoDenied: boolean;
    readonly pushDenied: boolean;
    readonly error: string | null;
}

function SubscribeCard({
    onActivate,
    isLoading,
    geoDenied,
    pushDenied,
    error,
}: SubscribeCardProps) {
    return (
        <Card>
            <h2 className="mb-2 text-lg font-semibold text-slate-800">Activar alertas UV</h2>
            <p className="mb-5 text-sm text-slate-500">
                Te pedimos acceso a tu ubicación y permisos de notificación para avisarte cuando el
                índice UV cambia en tu zona.
            </p>

            {geoDenied && (
                <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                    Necesitamos tu ubicación para saber el UV de tu zona. Permitila desde Ajustes
                    del dispositivo.
                </p>
            )}

            {pushDenied && (
                <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                    Bloqueaste las notificaciones. Cambialo desde Ajustes del navegador.
                </p>
            )}

            {error && !geoDenied && !pushDenied && (
                <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                    Error: {error}
                </p>
            )}

            <button
                type="button"
                onClick={onActivate}
                disabled={isLoading || pushDenied}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 font-semibold text-slate-900 shadow-md shadow-amber-300/50 hover:from-amber-500 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50"
            >
                {isLoading ? 'Activando...' : 'Activar alertas UV'}
            </button>
        </Card>
    );
}

interface SubscribedCardProps {
    readonly lat: number;
    readonly lon: number;
    readonly onDeactivate: () => void;
    readonly isLoading: boolean;
}

function SubscribedCard({ lat, lon, onDeactivate, isLoading }: SubscribedCardProps) {
    return (
        <Card>
            <div className="mb-3 flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full bg-green-500" />
                <h2 className="text-lg font-semibold text-green-700">Alertas activas</h2>
            </div>
            <p className="mb-1 text-sm text-slate-600">
                Te avisamos cuando el UV cambie en{' '}
                <span className="font-mono text-slate-800">
                    {lat.toFixed(4)}, {lon.toFixed(4)}
                </span>
                .
            </p>
            <p className="mb-5 text-sm text-slate-500">
                Recibirás alertas cuando supere{' '}
                <span className="font-semibold text-slate-700">3</span> o vuelva a estar seguro.
            </p>
            <button
                type="button"
                onClick={onDeactivate}
                disabled={isLoading}
                className="w-full rounded-2xl bg-violet-100 px-6 py-3 font-semibold text-violet-700 hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 disabled:opacity-50"
            >
                {isLoading ? 'Desactivando...' : 'Desactivar'}
            </button>
        </Card>
    );
}

function IOSInstallGate() {
    return (
        <Card className="border-amber-200">
            <h2 className="mb-3 text-lg font-semibold text-amber-700">Instala la app primero</h2>
            <p className="mb-4 text-sm text-slate-600">
                Para recibir notificaciones push en iOS, tenés que agregar UV Alert a tu pantalla de
                inicio. Requiere iOS 16.4 o superior.
            </p>
            <ol className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                    <span className="font-bold text-amber-500">1.</span>
                    Tocá el botón Compartir{' '}
                    <span className="font-semibold text-slate-800">
                        (cuadrado con flecha hacia arriba)
                    </span>{' '}
                    en Safari.
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-500">2.</span>
                    Bajá y tocá{' '}
                    <span className="font-semibold text-slate-800">
                        &quot;Agregar a pantalla de inicio&quot;
                    </span>
                    .
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-500">3.</span>
                    Tocá <span className="font-semibold text-slate-800">
                        &quot;Agregar&quot;
                    </span>{' '}
                    arriba a la derecha.
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-500">4.</span>
                    Abrí la app desde el ícono nuevo en tu pantalla de inicio.
                </li>
            </ol>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function buildDisplayLocation(
    geocodeCity: string | undefined,
    geocodeCountry: string | null | undefined,
    timezone: string,
    coords: { lat: number; lon: number },
): string {
    if (geocodeCity) {
        return geocodeCountry ? `${geocodeCity}, ${geocodeCountry}` : geocodeCity;
    }

    const segments = timezone.split('/');
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment !== 'UTC') {
        return lastSegment.replace(/_/g, ' ');
    }

    return `${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`;
}

export default function HomePage() {
    const geolocation = useGeolocation();
    const pushSubscription = usePushSubscription(VAPID_PUBLIC_KEY);
    const { weather, state: weatherState } = useWeather(geolocation.coords);
    const { state: geocodeState, location: geocodeLocation } = useReverseGeocode(
        geolocation.coords,
    );

    // iOS detection — must run client-side only (no navigator in SSR)
    const [isIOSAndNotStandalone, setIsIOSAndNotStandalone] = useState(false);
    const [isUnsubscribing, setIsUnsubscribing] = useState(false);
    // pendingSubscribe: user clicked Activate, waiting for geolocation to resolve
    const [pendingSubscribe, setPendingSubscribe] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            ('standalone' in navigator && navigator.standalone === true);

        setIsIOSAndNotStandalone(isIOS && !isStandalone);
    }, []);

    const isUnsupported = useMemo(
        () => pushSubscription.permission === 'unsupported',
        [pushSubscription.permission],
    );

    const isSubscribed = useMemo(
        () => pushSubscription.subscription === 'subscribed',
        [pushSubscription.subscription],
    );

    const isSubscribing = useMemo(
        () =>
            geolocation.status === 'requesting' || pushSubscription.subscription === 'subscribing',
        [geolocation.status, pushSubscription.subscription],
    );

    const geoDenied = useMemo(() => geolocation.status === 'denied', [geolocation.status]);

    const pushDenied = useMemo(
        () => pushSubscription.permission === 'denied',
        [pushSubscription.permission],
    );

    // When pendingSubscribe is true and coords have arrived, fire the subscribe call.
    useEffect(() => {
        if (pendingSubscribe && geolocation.coords) {
            setPendingSubscribe(false);
            void pushSubscription.subscribe(geolocation.coords);
        }
    }, [pendingSubscribe, geolocation.coords, pushSubscription]);

    const handleActivate = async () => {
        setPendingSubscribe(true);
        await geolocation.request();
        // The effect above will pick up coords once state updates.
    };

    const handleDeactivate = async () => {
        setIsUnsubscribing(true);

        try {
            await pushSubscription.unsubscribe();
        } finally {
            setIsUnsubscribing(false);
        }
    };

    const showWeatherCard =
        geolocation.coords !== null && weatherState === 'ready' && weather !== null;

    const displayLocation = useMemo(() => {
        if (!showWeatherCard || !geolocation.coords || !weather) {
            return '';
        }

        const city = geocodeState === 'ready' ? (geocodeLocation?.city ?? '') : '';
        const country = geocodeState === 'ready' ? (geocodeLocation?.country ?? null) : null;

        return buildDisplayLocation(
            city || undefined,
            country,
            weather.timezone,
            geolocation.coords,
        );
    }, [showWeatherCard, geocodeState, geocodeLocation, weather, geolocation.coords]);

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-gradient-to-br from-amber-100 via-amber-50 to-violet-100 p-6 pt-12">
            {/* Header */}
            <div className="mb-2 text-center">
                <h1 className="text-4xl font-bold leading-tight text-slate-800">UV Alert</h1>
                <p className="mt-2 text-base text-slate-600">
                    Te avisamos cuando el índice UV es alto en tu zona
                </p>
            </div>

            {/* VAPID env guard */}
            {VAPID_PUBLIC_KEY === '' && (
                <Card className="border-red-200 bg-red-50/80">
                    <p className="text-sm font-semibold text-red-600">
                        Configuración incompleta. Falta{' '}
                        <span className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span>.
                    </p>
                </Card>
            )}

            {/* Browser support check */}
            {isUnsupported && (
                <Card>
                    <p className="text-sm text-slate-600">
                        Tu navegador no soporta notificaciones push. Probá abriendo esta página en
                        Chrome o Safari (iOS 16.4+) instalada como app.
                    </p>
                </Card>
            )}

            {/* Weather card */}
            {showWeatherCard && <WeatherCard weather={weather} displayLocation={displayLocation} />}

            {/* iOS install-first gate */}
            {!isUnsupported && isIOSAndNotStandalone && <IOSInstallGate />}

            {/* Subscribe / subscribed flow — only when ready */}
            {!isUnsupported && !isIOSAndNotStandalone && (
                <>
                    {isSubscribed && geolocation.coords ? (
                        <SubscribedCard
                            lat={geolocation.coords.lat}
                            lon={geolocation.coords.lon}
                            onDeactivate={handleDeactivate}
                            isLoading={isUnsubscribing}
                        />
                    ) : (
                        <SubscribeCard
                            onActivate={handleActivate}
                            isLoading={isSubscribing || VAPID_PUBLIC_KEY === ''}
                            geoDenied={geoDenied}
                            pushDenied={pushDenied}
                            error={pushSubscription.error ?? geolocation.error}
                        />
                    )}
                </>
            )}

            {/* Footer info card */}
            <Card className="mt-2">
                <p className="mb-2 text-sm text-slate-500">
                    El índice UV se mide del 0 al 11+. Sobre{' '}
                    <span className="font-semibold text-slate-700">3</span> puede dañar la piel sin
                    protección.
                </p>
                <p className="text-xs text-slate-400">
                    Datos:{' '}
                    <a
                        href="https://open-meteo.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-violet-600"
                    >
                        Open-Meteo
                    </a>{' '}
                    &middot; Alertas: cada 5 min
                </p>
                <p className="mt-1 text-xs text-slate-400">
                    <a
                        href="https://github.com/MacarenaZalazar/uv-alert"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-violet-600"
                    >
                        Ver en GitHub
                    </a>
                </p>
            </Card>
        </main>
    );
}
