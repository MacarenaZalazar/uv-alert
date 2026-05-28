'use client';

import { useEffect, useMemo, useState } from 'react';

import { useGeolocation } from '@/hooks/useGeolocation';
import { usePushSubscription } from '@/hooks/usePushSubscription';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-slate-700 bg-slate-900/60 p-6 ${className}`}>
            {children}
        </div>
    );
}

function IOSInstallGate() {
    return (
        <Card>
            <h2 className="mb-3 text-lg font-semibold text-amber-400">Instala la app primero</h2>
            <p className="mb-4 text-sm text-slate-300">
                Para recibir notificaciones push en iOS, tenés que agregar UV Alert a tu pantalla de
                inicio. Requiere iOS 16.4 o superior.
            </p>
            <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2">
                    <span className="font-bold text-amber-400">1.</span>
                    Tocá el botón Compartir{' '}
                    <span className="font-semibold text-slate-100">
                        (cuadrado con flecha hacia arriba)
                    </span>{' '}
                    en Safari.
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-400">2.</span>
                    Bajá y tocá{' '}
                    <span className="font-semibold text-slate-100">
                        "Agregar a pantalla de inicio"
                    </span>
                    .
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-400">3.</span>
                    Tocá <span className="font-semibold text-slate-100">"Agregar"</span> arriba a la
                    derecha.
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-amber-400">4.</span>
                    Abrí la app desde el ícono nuevo en tu pantalla de inicio.
                </li>
            </ol>
        </Card>
    );
}

interface SubscribeCardProps {
    onActivate: () => void;
    isLoading: boolean;
    geoDenied: boolean;
    pushDenied: boolean;
    error: string | null;
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
            <h2 className="mb-3 text-lg font-semibold text-slate-100">Activar alertas UV</h2>
            <p className="mb-5 text-sm text-slate-400">
                Te pedimos acceso a tu ubicación y permisos de notificación para avisarte cuando el
                índice UV cambia en tu zona.
            </p>

            {geoDenied && (
                <p className="mb-4 rounded-xl bg-red-900/40 p-3 text-sm text-red-300">
                    Necesitamos tu ubicación para saber el UV de tu zona. Permitila desde Ajustes
                    del dispositivo.
                </p>
            )}

            {pushDenied && (
                <p className="mb-4 rounded-xl bg-red-900/40 p-3 text-sm text-red-300">
                    Bloqueaste las notificaciones. Cambialo desde Ajustes del navegador.
                </p>
            )}

            {error && !geoDenied && !pushDenied && (
                <p className="mb-4 rounded-xl bg-red-900/40 p-3 text-sm text-red-300">
                    Error: {error}
                </p>
            )}

            <button
                type="button"
                onClick={onActivate}
                disabled={isLoading || pushDenied}
                className="w-full rounded-xl bg-amber-500 px-6 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
                {isLoading ? 'Activando…' : 'Activar notificaciones'}
            </button>
        </Card>
    );
}

interface SubscribedCardProps {
    lat: number;
    lon: number;
    onDeactivate: () => void;
    isLoading: boolean;
}

function SubscribedCard({ lat, lon, onDeactivate, isLoading }: SubscribedCardProps) {
    return (
        <Card>
            <div className="mb-4 flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-green-400" />
                <h2 className="text-lg font-semibold text-green-400">Notificaciones activas</h2>
            </div>
            <p className="mb-2 text-sm text-slate-300">
                Listo. Te vamos a avisar cuando el UV cambie en{' '}
                <span className="font-mono text-slate-100">
                    {lat.toFixed(4)}, {lon.toFixed(4)}
                </span>
                .
            </p>
            <p className="mb-5 text-sm text-slate-400">
                Te avisamos cuando supera <span className="font-semibold text-slate-100">3</span> (o
                vuelve a estar seguro).
            </p>
            <button
                type="button"
                onClick={onDeactivate}
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-300 hover:border-slate-400 hover:text-slate-100 disabled:opacity-50"
            >
                {isLoading ? 'Desactivando…' : 'Desactivar notificaciones'}
            </button>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HomePage() {
    const geolocation = useGeolocation();
    const pushSubscription = usePushSubscription(VAPID_PUBLIC_KEY);

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

    return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-100">UV Alert</h1>
                <p className="mt-2 text-sm text-slate-400">
                    Te avisamos cuando el índice UV es alto en tu zona
                </p>
            </div>

            {/* VAPID env guard */}
            {VAPID_PUBLIC_KEY === '' && (
                <Card className="border-red-700 bg-red-900/30">
                    <p className="text-sm font-semibold text-red-300">
                        Configuración incompleta. Falta{' '}
                        <span className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span>.
                    </p>
                </Card>
            )}

            {/* Browser support check */}
            {isUnsupported && (
                <Card>
                    <p className="text-sm text-slate-300">
                        Tu navegador no soporta notificaciones push. Probá abriendo esta página en
                        Chrome o Safari (iOS 16.4+) instalada como app.
                    </p>
                </Card>
            )}

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
            <Card>
                <p className="mb-2 text-sm text-slate-400">
                    El índice UV se mide del 1 al 11+. Sobre{' '}
                    <span className="font-semibold text-slate-200">3</span> puede dañar la piel sin
                    protección.
                </p>
                <p className="text-xs text-slate-500">
                    Datos:{' '}
                    <a
                        href="https://open-meteo.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-slate-300"
                    >
                        Open-Meteo
                    </a>{' '}
                    · Frecuencia: cada 5 min
                </p>
                <p className="mt-2 text-xs text-slate-500">
                    <a
                        href="https://github.com/MacarenaZalazar/uv-alert"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-slate-300"
                    >
                        Ver en GitHub
                    </a>
                </p>
            </Card>
        </main>
    );
}
