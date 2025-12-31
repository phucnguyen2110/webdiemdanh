/**
 * Network Detector
 * Detects online/offline status and notifies listeners
 */

class NetworkDetector {
    constructor() {
        this.listeners = [];
        this.isOnline = navigator.onLine;
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners(false);
        });
    }

    /**
     * Subscribe to network status changes
     * @param {Function} callback - Called with (isOnline) when status changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.listeners.push(callback);

        // Immediately call with current status
        callback(this.isOnline);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(isOnline) {
        this.listeners.forEach(callback => {
            try {
                callback(isOnline);
            } catch (error) {
                console.error('Error in network listener:', error);
            }
        });
    }

    /**
     * Get current online status
     */
    getStatus() {
        return this.isOnline;
    }

    /**
     * Check if actually online by pinging a server
     * @param {string} url - URL to ping (default: current API)
     * @returns {Promise<boolean>}
     */
    async checkConnectivity(url = null) {
        if (!navigator.onLine) {
            return false;
        }

        try {
            const pingUrl = url || `${import.meta.env.VITE_API_URL || '/api'}/health`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(pingUrl, {
                method: 'HEAD',
                cache: 'no-cache',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Create singleton instance
const networkDetector = new NetworkDetector();

export default networkDetector;

// Export convenience functions
export const isOnline = () => networkDetector.getStatus();
export const subscribeToNetworkChanges = (callback) => networkDetector.subscribe(callback);
export const checkConnectivity = (url) => networkDetector.checkConnectivity(url);
