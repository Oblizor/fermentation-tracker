const CACHE_NAME = 'winery-v2.0';
const assetPaths = [
    'index.html',
    'style.css',
    'enhanced-styles.css',
    'enhanced-dashboard.html',
    'batchManager.js',
    'labIntegration.js',
    'productionPlanner.js',
    'complianceManager.js',
    'aiAnalytics.js',
    'apiIntegration.js',
    'pwa.js',
    'app.js',
    'tanks.json',
    'manifest.json'
];

const baseScope = (self.registration && self.registration.scope)
    ? self.registration.scope
    : new URL('./', self.location.href).toString();
const urlsToCache = assetPaths.map(path => new URL(path, baseScope).toString());

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    return networkResponse;
                });
            })
    );
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('winery-sync', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function syncData() {
    const db = await openDB();
    const tx = db.transaction('pending', 'readonly');
    const store = tx.objectStore('pending');
    const pending = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
    });

    for (const item of pending) {
        try {
            await fetch('/api/sync', {
                method: 'POST',
                body: JSON.stringify(item),
                headers: { 'Content-Type': 'application/json' }
            });
            await new Promise((resolve, reject) => {
                const deleteTx = db.transaction('pending', 'readwrite');
                const deleteRequest = deleteTx.objectStore('pending').delete(item.id);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
            });
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
}
