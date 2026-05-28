'use client';

import { useCallback, useEffect, useState } from 'react';

export type PushPermissionState = 'idle' | 'unsupported' | 'denied' | 'default' | 'granted';
export type SubscriptionState = 'idle' | 'subscribing' | 'subscribed' | 'unsubscribed' | 'error';

export interface UsePushSubscriptionApi {
    permission: PushPermissionState;
    subscription: SubscriptionState;
    error: string | null;
    subscribe: (coords: { lat: number; lon: number }) => Promise<void>;
    unsubscribe: () => Promise<void>;
}

const DB_NAME = 'uv-alert';
const STORE_NAME = 'kv';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (padded.length % 4)) % 4);
    const decoded = atob(padded + padding);
    const buffer = new ArrayBuffer(decoded.length);
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
    }

    return bytes;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);

        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function writeIDB(key: string, value: unknown): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function deleteIDB(key: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function clearIDB(): Promise<void> {
    await deleteIDB('appServerKey');
    await deleteIDB('coords');
}

function isPushSupported(): boolean {
    return (
        typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    );
}

function mapNotificationPermission(p: NotificationPermission): PushPermissionState {
    if (p === 'granted') {
        return 'granted';
    }

    if (p === 'denied') {
        return 'denied';
    }

    return 'default';
}

export function usePushSubscription(vapidPublicKey: string): UsePushSubscriptionApi {
    const [permission, setPermission] = useState<PushPermissionState>('idle');
    const [subscription, setSubscription] = useState<SubscriptionState>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isPushSupported()) {
            setPermission('unsupported');
            setSubscription('idle');

            return;
        }

        setPermission(mapNotificationPermission(Notification.permission));

        navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => {
                setSubscription(sub ? 'subscribed' : 'unsubscribed');
            })
            .catch(() => {
                setSubscription('unsubscribed');
            });
    }, []);

    const subscribe = useCallback(
        async (coords: { lat: number; lon: number }): Promise<void> => {
            if (!isPushSupported()) {
                setPermission('unsupported');

                return;
            }

            setSubscription('subscribing');
            setError(null);

            const granted = await Notification.requestPermission();

            setPermission(mapNotificationPermission(granted));

            if (granted !== 'granted') {
                setSubscription('error');
                setError('Notification permission not granted');

                return;
            }

            try {
                const reg = await navigator.serviceWorker.ready;
                const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });

                const res = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: sub.toJSON(),
                        lat: coords.lat,
                        lon: coords.lon,
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Subscribe API returned ${res.status}`);
                }

                await writeIDB('appServerKey', applicationServerKey);
                await writeIDB('coords', coords);

                setSubscription('subscribed');
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Unknown error during subscribe';

                setError(message);
                setSubscription('error');
            }
        },
        [vapidPublicKey],
    );

    const unsubscribe = useCallback(async (): Promise<void> => {
        setError(null);

        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();

            if (!sub) {
                setSubscription('unsubscribed');

                return;
            }

            const res = await fetch('/api/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });

            if (!res.ok) {
                throw new Error(`Unsubscribe API returned ${res.status}`);
            }

            await sub.unsubscribe();
            await clearIDB();

            setSubscription('unsubscribed');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error during unsubscribe';

            setError(message);
        }
    }, []);

    return { permission, subscription, error, subscribe, unsubscribe };
}
