// pwa.js - Progressive Web App features
class PWAManager {
    constructor() {
        if (typeof window === 'undefined') {
            return;
        }
        this.offlineQueueKey = 'pwa_offline_queue';
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
            this.syncOfflineData();
        });
    }

    async syncOfflineData() {
        const offlineData = await this.getOfflineData();
        for (const entry of offlineData) {
            try {
                await this.uploadToServer(entry);
                await this.removeFromOfflineStorage(entry.id);
            } catch (error) {
                console.error('Sync failed for entry:', entry.id, error);
            }
        }
    }

    async getOfflineData() {
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
            console.warn('Failed to load offline queue', error);
            return [];
        }
    }

    async addToOfflineQueue(entry) {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const queue = await this.getOfflineData();
        queue.push(entry);
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(queue));
    }

    async removeFromOfflineStorage(id) {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const queue = await this.getOfflineData();
        const filtered = queue.filter(item => item.id !== id);
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(filtered));
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
}

if (typeof window !== 'undefined') {
    window.PWAManager = PWAManager;
}
