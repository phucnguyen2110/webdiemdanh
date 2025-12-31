/**
 * Sync Error Logger
 * Logs sync errors to backend for admin monitoring
 */

import { authAPI } from '../services/api';

const ERROR_LOG_KEY = 'sync_error_logs';
const MAX_LOCAL_LOGS = 50;

/**
 * Log sync error to backend
 */
export const logSyncError = async (errorData) => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Get class name from cached classes
        let className = null;
        if (errorData.classId) {
            try {
                const { getCachedClasses } = await import('./offlineStorage');
                const cachedClasses = await getCachedClasses();
                const classData = cachedClasses.find(c => c.id === errorData.classId);
                className = classData?.name || null;
            } catch (e) {
                console.error('Failed to get class name:', e);
            }
        }

        const logEntry = {
            userId: user.id,
            username: user.username,
            classId: errorData.classId,
            className: className,
            attendanceDate: errorData.attendanceDate,
            attendanceType: errorData.attendanceType,
            error: errorData.error,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            online: navigator.onLine
        };

        // Save to localStorage first (backup)
        saveToLocalStorage(logEntry);

        // Try to send to backend
        try {
            // TODO: Replace with actual API endpoint when backend is ready
            // await fetch('/api/sync-errors', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('token')}`
            //     },
            //     body: JSON.stringify(logEntry)
            // });

            console.log('📤 Sync error logged:', logEntry);
        } catch (apiError) {
            console.error('Failed to send error log to backend:', apiError);
            // Keep in localStorage for retry later
        }
    } catch (error) {
        console.error('Error logging sync error:', error);
    }
};

/**
 * Save error log to localStorage
 */
const saveToLocalStorage = (logEntry) => {
    try {
        const logs = getLocalLogs();
        logs.unshift(logEntry);

        // Keep only last MAX_LOCAL_LOGS
        const trimmedLogs = logs.slice(0, MAX_LOCAL_LOGS);

        localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmedLogs));
    } catch (error) {
        console.error('Failed to save error log to localStorage:', error);
    }
};

/**
 * Get error logs from localStorage
 */
export const getLocalLogs = () => {
    try {
        const logs = localStorage.getItem(ERROR_LOG_KEY);
        return logs ? JSON.parse(logs) : [];
    } catch (error) {
        console.error('Failed to get error logs:', error);
        return [];
    }
};

/**
 * Clear local error logs
 */
export const clearLocalLogs = () => {
    try {
        localStorage.removeItem(ERROR_LOG_KEY);
        console.log('✅ Local error logs cleared');
    } catch (error) {
        console.error('Failed to clear error logs:', error);
    }
};

/**
 * Get error statistics
 */
export const getErrorStats = () => {
    const logs = getLocalLogs();

    const stats = {
        total: logs.length,
        last24h: 0,
        byClass: {},
        byUser: {}
    };

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    logs.forEach(log => {
        // Count last 24h
        if (log.timestamp > oneDayAgo) {
            stats.last24h++;
        }

        // Count by class
        const classKey = log.classId || 'unknown';
        stats.byClass[classKey] = (stats.byClass[classKey] || 0) + 1;

        // Count by user
        const userKey = log.username || 'unknown';
        stats.byUser[userKey] = (stats.byUser[userKey] || 0) + 1;
    });

    return stats;
};

export default {
    logSyncError,
    getLocalLogs,
    clearLocalLogs,
    getErrorStats
};
