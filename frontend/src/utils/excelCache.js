/**
 * Excel Cache Manager
 * Manages localStorage caching for Excel data with timestamp validation
 */

const CACHE_PREFIX = 'excel_cache_';
const TIMESTAMP_PREFIX = 'excel_timestamp_';
const MAX_CACHED_CLASSES = 5;

/**
 * Get cached Excel data for a class
 * @param {number} classId 
 * @returns {Object|null} Cached data or null if not found/expired
 */
export const getCachedExcel = (classId) => {
    try {
        const cacheKey = `${CACHE_PREFIX}${classId}`;
        const timestampKey = `${TIMESTAMP_PREFIX}${classId}`;

        const cachedData = localStorage.getItem(cacheKey);
        const cachedTimestamp = localStorage.getItem(timestampKey);

        if (!cachedData || !cachedTimestamp) {
            return null;
        }

        return {
            data: JSON.parse(cachedData),
            timestamp: cachedTimestamp
        };
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
};

/**
 * Save Excel data to cache
 * @param {number} classId 
 * @param {Object} excelData 
 * @param {string} timestamp 
 */
export const setCachedExcel = (classId, excelData, timestamp) => {
    try {
        const cacheKey = `${CACHE_PREFIX}${classId}`;
        const timestampKey = `${TIMESTAMP_PREFIX}${classId}`;

        // Save data and timestamp
        localStorage.setItem(cacheKey, JSON.stringify(excelData));
        localStorage.setItem(timestampKey, timestamp);

        // Cleanup old caches
        cleanupOldCaches(classId);
    } catch (error) {
        console.error('Error saving cache:', error);
        // If quota exceeded, clear all caches and try again
        if (error.name === 'QuotaExceededError') {
            clearAllCaches();
            try {
                localStorage.setItem(cacheKey, JSON.stringify(excelData));
                localStorage.setItem(timestampKey, timestamp);
            } catch (retryError) {
                console.error('Failed to save cache even after cleanup:', retryError);
            }
        }
    }
};

/**
 * Invalidate cache for a specific class
 * @param {number} classId 
 */
export const invalidateCache = (classId) => {
    try {
        const cacheKey = `${CACHE_PREFIX}${classId}`;
        const timestampKey = `${TIMESTAMP_PREFIX}${classId}`;

        localStorage.removeItem(cacheKey);
        localStorage.removeItem(timestampKey);

        console.log(`Cache invalidated for class ${classId}`);
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
};

/**
 * Clear all Excel caches
 */
export const clearAllCaches = () => {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(CACHE_PREFIX) || key.startsWith(TIMESTAMP_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log('All Excel caches cleared');
    } catch (error) {
        console.error('Error clearing caches:', error);
    }
};

/**
 * Cleanup old caches, keeping only the most recent MAX_CACHED_CLASSES
 * @param {number} currentClassId - The class being cached now (keep this one)
 */
const cleanupOldCaches = (currentClassId) => {
    try {
        const keys = Object.keys(localStorage);
        const timestampKeys = keys.filter(key => key.startsWith(TIMESTAMP_PREFIX));

        if (timestampKeys.length <= MAX_CACHED_CLASSES) {
            return; // No cleanup needed
        }

        // Get all cached classes with their timestamps
        const cachedClasses = timestampKeys.map(key => {
            const classId = parseInt(key.replace(TIMESTAMP_PREFIX, ''));
            const timestamp = localStorage.getItem(key);
            return { classId, timestamp, timestampKey: key };
        });

        // Sort by timestamp (oldest first)
        cachedClasses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Remove oldest caches, but keep current class
        const toRemove = cachedClasses.length - MAX_CACHED_CLASSES;
        for (let i = 0; i < toRemove; i++) {
            const { classId } = cachedClasses[i];
            if (classId !== currentClassId) {
                invalidateCache(classId);
            }
        }
    } catch (error) {
        console.error('Error cleaning up old caches:', error);
    }
};

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export const getCacheStats = () => {
    try {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

        let totalSize = 0;
        cacheKeys.forEach(key => {
            const value = localStorage.getItem(key);
            totalSize += value ? value.length : 0;
        });

        return {
            cachedClasses: cacheKeys.length,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            maxClasses: MAX_CACHED_CLASSES
        };
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return null;
    }
};
