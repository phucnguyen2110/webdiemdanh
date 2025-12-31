/**
 * Service Worker Registration
 * Registers and manages the service worker lifecycle
 */

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            // Register the service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000); // Check every hour

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        console.log('🔄 New version available');

                        // Notify user about update
                        if (confirm('Có phiên bản mới! Tải lại trang để cập nhật?')) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }
                    }
                });
            });

            // Handle controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Service Worker controller changed');
                window.location.reload();
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('📨 Message from SW:', event.data);

                if (event.data.type === 'BACKGROUND_SYNC') {
                    // Trigger sync in the app
                    window.dispatchEvent(new CustomEvent('background-sync', {
                        detail: { tag: event.data.tag }
                    }));
                }
            });

            return registration;
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            throw error;
        }
    } else {
        console.warn('⚠️ Service Workers not supported');
        return null;
    }
};

export const unregisterServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.unregister();
            console.log('✅ Service Worker unregistered');
        } catch (error) {
            console.error('❌ Service Worker unregistration failed:', error);
        }
    }
};

export const clearServiceWorkerCache = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return new Promise((resolve, reject) => {
            const messageChannel = new MessageChannel();

            messageChannel.port1.onmessage = (event) => {
                if (event.data.success) {
                    console.log('✅ Service Worker cache cleared');
                    resolve();
                } else {
                    reject(new Error('Failed to clear cache'));
                }
            };

            navigator.serviceWorker.controller.postMessage(
                { type: 'CLEAR_CACHE' },
                [messageChannel.port2]
            );
        });
    }
};

export default {
    registerServiceWorker,
    unregisterServiceWorker,
    clearServiceWorkerCache
};
