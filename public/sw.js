// uv-alert service worker
// Handles: push, notificationclick, pushsubscriptionchange

const APP_NAME = 'uv-alert';
const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/badge-72.png';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = { title: 'UV alert', body: 'Cambio en el índice UV' };

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (err) {
            try {
                payload = { title: 'UV alert', body: event.data.text() };
            } catch (e) {
                // fallback used above
            }
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || DEFAULT_ICON,
        badge: payload.badge || DEFAULT_BADGE,
        data: { url: payload.url || '/' },
        tag: 'uv-alert',
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(payload.title || 'UV alert', options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        (async () => {
            const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            for (const client of all) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })(),
    );
});

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        (async () => {
            const applicationServerKey = await getStoredAppServerKey();
            const coords = await getStoredCoords();

            if (!applicationServerKey || !coords) {
                return;
            }

            const newSub = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });

            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: newSub.toJSON(),
                    lat: coords.lat,
                    lon: coords.lon,
                }),
            });
        })(),
    );
});

// IndexedDB helpers for subscription recovery
async function getStoredAppServerKey() {
    return readIDB('appServerKey');
}

async function getStoredCoords() {
    return readIDB('coords');
}

function readIDB(key) {
    return new Promise((resolve) => {
        const req = indexedDB.open('uv-alert', 1);

        req.onupgradeneeded = () => {
            req.result.createObjectStore('kv');
        };

        req.onsuccess = () => {
            try {
                const tx = req.result.transaction('kv', 'readonly');
                const store = tx.objectStore('kv');
                const getReq = store.get(key);

                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        };

        req.onerror = () => resolve(null);
    });
}
