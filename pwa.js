// pwa.js - Progressive Web App features
class PWAManager {
    constructor() {
        if (typeof window === 'undefined') {
            return;
        }
        this.offlineQueueKey = 'pwa_offline_queue';
        this.indexedDBUnavailable = typeof indexedDB === 'undefined';
        this.backgroundSyncSupported = false;
        this.initServiceWorker();
        this.initOfflineSync();
        this.initPushNotifications();
        this.initBarcodeScanner();
    }

    async initServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            this.swRegistration = registration;
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        this.notifyUpdate();
                    }
                });
            });
        } catch (error) {
            console.error('ServiceWorker registration failed:', error);
        }
    }

    notifyUpdate() {
        if (document.visibilityState === 'visible') {
            console.info('New version available. Refresh for latest updates.');
        }
    }

    initOfflineSync() {
        if (typeof window === 'undefined') return;
        window.addEventListener('online', () => {
            this.syncOfflineData().catch(error => {
                console.error('Offline sync failed', error);
            });
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
                .then(registration => {
                    this.backgroundSyncSupported = 'sync' in registration;
                    return registration;
                })
                .then(() => this.syncOfflineData())
                .catch(error => {
                    console.warn('ServiceWorker ready check failed', error);
                });
        } else {
            this.syncOfflineData().catch(error => {
                console.error('Offline sync failed', error);
            });
        }
    }

    async syncOfflineData() {
        const offlineData = await this.getOfflineData();
        for (const entry of offlineData) {
            if (!entry || !entry.id) continue;
            try {
                await this.uploadToServer(entry);
                await this.removeFromOfflineStorage(entry.id);
            } catch (error) {
                console.error('Sync failed for entry:', entry.id, error);
                await this.requestBackgroundSync();
            }
        }
    }

    async getOfflineData() {
        const combined = [];
        const dbEntries = await this.readIndexedDBQueue();
        if (dbEntries.length) {
            combined.push(...dbEntries);
        }
        const localEntries = this.readLocalQueue();
        if (localEntries.length) {
            combined.push(...localEntries);
        }
        return combined;
    }

    async addToOfflineQueue(entry) {
        if (!entry) return null;
        const queuedEntry = {
            ...entry,
            id: entry.id ?? `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            queuedAt: new Date().toISOString()
        };

        const stored = await this.storeInIndexedDB(queuedEntry);
        if (!stored) {
            const queue = this.readLocalQueue();
            queue.push(queuedEntry);
            this.writeLocalQueue(queue);
        }

        if (navigator.onLine) {
            this.syncOfflineData().catch(error => console.error('Immediate sync failed', error));
        } else {
            await this.requestBackgroundSync();
        }

        return queuedEntry;
    }

    async removeFromOfflineStorage(id) {
        await this.removeFromIndexedDB(id);
        const queue = this.readLocalQueue();
        const filtered = queue.filter(item => item.id !== id);
        this.writeLocalQueue(filtered);
    }

    async uploadToServer(entry) {
        if (typeof fetch !== 'function') {
            return;
        }
        await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify(entry),
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async initPushNotifications() {
        if (typeof Notification === 'undefined') {
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const subscription = await this.subscribeToPush();
                if (subscription) {
                    await this.sendSubscriptionToServer(subscription);
                }
            }
        } catch (error) {
            console.error('Push notification setup failed', error);
        }
    }

    async subscribeToPush() {
        if (!this.swRegistration || !this.swRegistration.pushManager) {
            return null;
        }
        try {
            return await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: undefined
            });
        } catch (error) {
            console.warn('Push subscription failed', error);
            return null;
        }
    }

    async sendSubscriptionToServer(subscription) {
        if (typeof fetch !== 'function') {
            return;
        }
        try {
            await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
        } catch (error) {
            console.warn('Failed to register push subscription', error);
        }
    }

    initBarcodeScanner() {
        if (typeof window === 'undefined') return;
        if ('BarcodeDetector' in window) {
            try {
                this.barcodeDetector = new window.BarcodeDetector({
                    formats: ['qr_code', 'code_128', 'code_39']
                });
            } catch (error) {
                console.warn('Barcode detector initialization failed', error);
                this.barcodeDetector = null;
            }
        }
    }

    async scanBarcode(videoElement) {
        if (!this.barcodeDetector) return null;
        try {
            const barcodes = await this.barcodeDetector.detect(videoElement);
            return barcodes.map(barcode => ({
                type: barcode.format,
                data: barcode.rawValue
            }));
        } catch (error) {
            console.error('Barcode scanning failed:', error);
            return null;
        }
    }

    async openSyncDB() {
        if (this.indexedDBUnavailable) {
            return null;
        }
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('winery-sync', 1);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('pending')) {
                        db.createObjectStore('pending', { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    this.indexedDBUnavailable = true;
                    reject(request.error);
                };
            } catch (error) {
                this.indexedDBUnavailable = true;
                reject(error);
            }
        });
    }

    async readIndexedDBQueue() {
        try {
            const db = await this.openSyncDB();
            if (!db) {
                return [];
            }
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('pending', 'readonly');
                const store = tx.objectStore('pending');
                const request = store.getAll();
                request.onsuccess = () => {
                    resolve(request.result ?? []);
                    db.close();
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
        } catch (error) {
            if (!this.indexedDBUnavailable) {
                console.warn('IndexedDB unavailable for offline queue', error);
            }
            return [];
        }
    }

    async storeInIndexedDB(entry) {
        try {
            const db = await this.openSyncDB();
            if (!db) {
                return false;
            }
            await new Promise((resolve, reject) => {
                const tx = db.transaction('pending', 'readwrite');
                const store = tx.objectStore('pending');
                const request = store.put(entry);
                request.onsuccess = () => {
                    resolve();
                    db.close();
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
            return true;
        } catch (error) {
            if (!this.indexedDBUnavailable) {
                console.warn('Failed to store offline entry in IndexedDB', error);
            }
            return false;
        }
    }

    async removeFromIndexedDB(id) {
        try {
            const db = await this.openSyncDB();
            if (!db) {
                return;
            }
            await new Promise((resolve, reject) => {
                const tx = db.transaction('pending', 'readwrite');
                const store = tx.objectStore('pending');
                const request = store.delete(id);
                request.onsuccess = () => {
                    resolve();
                    db.close();
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
        } catch (error) {
            if (!this.indexedDBUnavailable) {
                console.warn('Failed to remove offline entry from IndexedDB', error);
            }
        }
    }

    readLocalQueue() {
        if (typeof localStorage === 'undefined') {
            return [];
        }
        try {
            const stored = localStorage.getItem(this.offlineQueueKey);
            if (!stored) {
                return [];
            }
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Failed to read offline queue from localStorage', error);
            return [];
        }
    }

    writeLocalQueue(queue) {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            localStorage.setItem(this.offlineQueueKey, JSON.stringify(queue));
        } catch (error) {
            console.warn('Failed to write offline queue to localStorage', error);
        }
    }

    async requestBackgroundSync() {
        if (!('serviceWorker' in navigator)) {
            return;
        }
        try {
            const registration = await navigator.serviceWorker.ready;
            const supportsSync = 'sync' in registration;
            this.backgroundSyncSupported = supportsSync;
            if (supportsSync) {
                await registration.sync.register('sync-data');
            }
        } catch (error) {
            console.warn('Background sync registration failed', error);
        }
    }
}

if (typeof window !== 'undefined') {
    window.PWAManager = PWAManager;
}
