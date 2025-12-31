/**
 * Sync Logger - Logs both errors and successes
 * Logs sync events to backend for admin monitoring
 */

import api from '../services/api';

const ERROR_LOG_KEY = 'sync_error_logs';
const SUCCESS_LOG_KEY = 'sync_success_logs';
const MAX_LOCAL_LOGS = 50;

/**
 * Save log to localStorage
 */
const saveToLocalStorage = (storageKey, logEntry) => {
    try {
        const logs = JSON.parse(localStorage.getItem(storageKey) || '[]');
        logs.unshift(logEntry);

        // Keep only last MAX_LOCAL_LOGS
        const trimmedLogs = logs.slice(0, MAX_LOCAL_LOGS);

        localStorage.setItem(storageKey, JSON.stringify(trimmedLogs));
    } catch (error) {
        console.error('Failed to save log to localStorage:', error);
    }
};

/**
 * Get class name from cache
 */
const getClassName = async (classId) => {
    if (!classId) return null;

    try {
        const { getCachedClasses } = await import('./offlineStorage');
        const cachedClasses = await getCachedClasses();
        const classData = cachedClasses.find(c => c.id === classId);
        return classData?.name || null;
    } catch (e) {
        console.error('Failed to get class name:', e);
        return null;
    }
};

/**
 * Log sync error to backend
 */
export const logSyncError = async (errorData) => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const className = await getClassName(errorData.classId);

        // Create unique key for this error
        const errorKey = `${errorData.attendanceId}_${errorData.classId}_${errorData.attendanceDate}_${errorData.attendanceType}`;

        // Check if we've already logged this error recently (within 1 hour)
        const loggedErrors = JSON.parse(localStorage.getItem('logged_sync_errors') || '{}');
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        // Clean up old entries
        Object.keys(loggedErrors).forEach(key => {
            if (loggedErrors[key] < oneHourAgo) {
                delete loggedErrors[key];
            }
        });

        // Check if this error was already logged
        if (loggedErrors[errorKey] && loggedErrors[errorKey] > oneHourAgo) {
            console.log('⏭️ Error already logged recently, skipping:', errorKey);
            return;
        }

        const logEntry = {
            userId: user.id,
            username: user.username,
            classId: errorData.classId,
            className: className,
            attendanceDate: errorData.attendanceDate,
            attendanceType: errorData.attendanceType,
            error: errorData.error,
            timestamp: now,
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            type: 'error'
        };

        // Save to localStorage first (backup)
        saveToLocalStorage(ERROR_LOG_KEY, logEntry);

        // Send to backend using axios (includes auth automatically)
        try {
            await api.post('/sync-errors', {
                classId: errorData.classId,
                attendanceDate: errorData.attendanceDate,
                attendanceType: errorData.attendanceType,
                attendanceId: errorData.attendanceId,
                error: errorData.error,
                userAgent: navigator.userAgent,
                online: navigator.onLine,
                records: errorData.records || [] // Include student records
            });

            // Mark this error as logged
            loggedErrors[errorKey] = now;
            localStorage.setItem('logged_sync_errors', JSON.stringify(loggedErrors));

            console.log('📤 Sync error logged to backend');
        } catch (apiError) {
            console.error('Failed to send error log to backend:', apiError);
        }
    } catch (error) {
        console.error('Error logging sync error:', error);
    }
};

/**
 * Log sync success to backend
 */
export const logSyncSuccess = async (successData) => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const className = await getClassName(successData.classId);

        const logEntry = {
            userId: user.id,
            username: user.username,
            classId: successData.classId,
            className: className,
            attendanceDate: successData.attendanceDate,
            attendanceType: successData.attendanceType,
            recordCount: successData.recordCount || 0,
            timestamp: Date.now(),
            type: 'success'
        };

        // Save to localStorage
        saveToLocalStorage(SUCCESS_LOG_KEY, logEntry);

        console.log('✅ Sync success logged:', logEntry);
    } catch (error) {
        console.error('Error logging sync success:', error);
    }
};

/**
 * Get error logs from localStorage
 */
export const getLocalLogs = (type = 'error') => {
    try {
        const key = type === 'error' ? ERROR_LOG_KEY : SUCCESS_LOG_KEY;
        const logs = localStorage.getItem(key);
        return logs ? JSON.parse(logs) : [];
    } catch (error) {
        console.error('Failed to get logs:', error);
        return [];
    }
};

/**
 * Get all logs (both error and success)
 */
export const getAllLogs = () => {
    const errors = getLocalLogs('error');
    const successes = getLocalLogs('success');

    // Combine and sort by timestamp
    return [...errors, ...successes].sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Clear local logs
 */
export const clearLocalLogs = (type = 'all') => {
    try {
        if (type === 'all' || type === 'error') {
            localStorage.removeItem(ERROR_LOG_KEY);
        }
        if (type === 'all' || type === 'success') {
            localStorage.removeItem(SUCCESS_LOG_KEY);
        }
        console.log('✅ Local logs cleared');
    } catch (error) {
        console.error('Failed to clear logs:', error);
    }
};

/**
 * Get log statistics
 */
export const getErrorStats = () => {
    const errors = getLocalLogs('error');
    const successes = getLocalLogs('success');

    const stats = {
        totalErrors: errors.length,
        totalSuccesses: successes.length,
        last24hErrors: 0,
        last24hSuccesses: 0,
        byClass: {},
        byUser: {}
    };

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Count errors
    errors.forEach(log => {
        if (log.timestamp > oneDayAgo) {
            stats.last24hErrors++;
        }

        const classKey = log.className || log.classId || 'unknown';
        stats.byClass[classKey] = (stats.byClass[classKey] || 0) + 1;

        const userKey = log.username || 'unknown';
        stats.byUser[userKey] = (stats.byUser[userKey] || 0) + 1;
    });

    // Count successes
    successes.forEach(log => {
        if (log.timestamp > oneDayAgo) {
            stats.last24hSuccesses++;
        }
    });

    return stats;
};

export default {
    logSyncError,
    logSyncSuccess,
    getLocalLogs,
    getAllLogs,
    clearLocalLogs,
    getErrorStats
};
