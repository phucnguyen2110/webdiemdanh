/**
 * Sync Manager
 * Handles automatic synchronization of offline data when online
 */

import {
    getPendingAttendance,
    markAttendanceSynced,
    cleanupOldAttendance,
    deletePendingAttendance
} from './offlineStorage';
import networkDetector from './networkDetector';
import { attendanceAPI, syncErrorsAPI } from '../services/api';
import { invalidateCache } from './excelCache';
import { logSyncError, logSyncSuccess } from './syncLogger';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncListeners = [];
        this.autoSyncEnabled = true;
        this.syncInterval = null;

        // Load failed items from localStorage (persistent across reloads)
        const storedFailed = localStorage.getItem('sync_failed_items');
        this.failedItems = storedFailed ? new Set(JSON.parse(storedFailed)) : new Set();

        this.setupNetworkListener();
    }

    setupNetworkListener() {
        // Auto-sync when coming back online
        networkDetector.subscribe((isOnline) => {
            if (isOnline && this.autoSyncEnabled) {
                console.log('📡 Network restored, starting auto-sync...');
                setTimeout(() => this.syncAll(), 1000); // Delay 1s to ensure stable connection
            }
        });

        // Periodic sync every 5 minutes when online
        this.syncInterval = setInterval(() => {
            if (networkDetector.getStatus() && this.autoSyncEnabled) {
                this.syncAll();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Subscribe to sync events
     * @param {Function} callback - Called with sync status updates
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.syncListeners.push(callback);
        return () => {
            this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(event) {
        this.syncListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    /**
     * Sync all pending data
     * @returns {Promise<Object>} Sync results
     */
    async syncAll() {
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return { skipped: true };
        }

        if (!networkDetector.getStatus()) {
            console.log('📴 Offline, cannot sync');
            return { offline: true };
        }

        this.isSyncing = true;
        this.notifyListeners({ type: 'sync_start' });

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        try {
            // Step 1: Cleanup resolved attendance items
            console.log('🧹 Checking for resolved errors...');
            try {
                const resolvedIds = await syncErrorsAPI.getMyResolvedAttendanceIds();
                if (resolvedIds.length > 0) {
                    console.log(`🗑️ Found ${resolvedIds.length} resolved errors from server:`, resolvedIds);

                    for (const rawId of resolvedIds) {
                        // Ensure ID is a number (IndexedDB keys are numbers)
                        const attendanceId = Number(rawId);

                        if (isNaN(attendanceId)) {
                            console.warn(`⚠️ Invalid attendance ID received: ${rawId}`);
                            continue;
                        }

                        console.log(`🗑️ Deleting resolved pending attendance #${attendanceId}`);
                        await deletePendingAttendance(attendanceId);

                        // Also remove from failed items
                        if (this.failedItems.has(attendanceId)) {
                            this.failedItems.delete(attendanceId);
                            console.log(`✅ Removed #${attendanceId} from failed items list`);
                        }
                    }
                    // Update localStorage
                    localStorage.setItem('sync_failed_items', JSON.stringify(Array.from(this.failedItems)));
                    console.log(`✅ Cleanup complete. Remaining failed items: ${this.failedItems.size}`);
                }
            } catch (cleanupError) {
                console.error('Failed to cleanup resolved items:', cleanupError);
                // Continue with sync even if cleanup fails
            }

            // Step 2: Get all pending attendance
            const pendingAttendance = await getPendingAttendance();

            if (pendingAttendance.length === 0) {
                console.log('✅ No pending data to sync');
                this.notifyListeners({ type: 'sync_complete', results });
                return results;
            }

            console.log(`🔄 Syncing ${pendingAttendance.length} pending attendance records...`);

            // Sync each attendance record
            for (const attendance of pendingAttendance) {
                try {
                    // Skip if this item has already failed
                    if (this.failedItems.has(attendance.id)) {
                        console.log(`⏭️ Skipping already-failed item ${attendance.id}`);
                        continue;
                    }

                    // Remove internal fields before sending to API
                    const { id, timestamp, synced, syncedAt, ...attendanceData } = attendance;

                    // Call API to save attendance
                    await attendanceAPI.save(attendanceData);

                    // Mark as synced
                    await markAttendanceSynced(id);

                    // Invalidate Excel cache for this class
                    if (attendanceData.classId) {
                        invalidateCache(attendanceData.classId);
                        console.log(`💾 Excel cache invalidated for class ${attendanceData.classId}`);
                    }

                    // Log success
                    await logSyncSuccess({
                        classId: attendanceData.classId,
                        attendanceDate: attendanceData.attendanceDate,
                        attendanceType: attendanceData.attendanceType,
                        recordCount: attendanceData.records?.length || 0
                    });

                    results.success++;
                    this.notifyListeners({
                        type: 'sync_progress',
                        current: results.success + results.failed,
                        total: pendingAttendance.length
                    });

                    console.log(`✅ Synced attendance ${id}`);
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        id: attendance.id,
                        error: error.message
                    });
                    console.error(`❌ Failed to sync attendance ${attendance.id}:`, error);

                    // Mark this item as failed to prevent retry
                    this.failedItems.add(attendance.id);
                    localStorage.setItem('sync_failed_items', JSON.stringify(Array.from(this.failedItems)));

                    // Log error for admin monitoring (only once)
                    await logSyncError({
                        classId: attendance.classId,
                        attendanceDate: attendance.attendanceDate,
                        attendanceType: attendance.attendanceType,
                        error: error.message,
                        attendanceId: attendance.id,
                        records: attendance.records || [] // Include student records
                    });

                    // If network error, stop syncing
                    if (error.message.includes('Network') || error.message.includes('fetch')) {
                        console.log('🔌 Network error detected, stopping sync');
                        break;
                    }
                }
            }

            // Cleanup old synced records
            await cleanupOldAttendance();

            console.log(`✅ Sync complete: ${results.success} success, ${results.failed} failed`);
            this.notifyListeners({ type: 'sync_complete', results });

            return results;
        } catch (error) {
            console.error('❌ Sync error:', error);
            this.notifyListeners({ type: 'sync_error', error: error.message });
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Enable/disable auto-sync
     */
    setAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
        console.log(`🔄 Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            autoSyncEnabled: this.autoSyncEnabled,
            isOnline: networkDetector.getStatus()
        };
    }

    /**
     * Force sync now
     */
    async forceSyncNow() {
        console.log('🔄 Force sync triggered');
        return this.syncAll();
    }

    /**
     * Clear failed items list to allow retry
     */
    clearFailedItems() {
        const count = this.failedItems.size;
        this.failedItems.clear();
        localStorage.removeItem('sync_failed_items');
        console.log(`🔄 Cleared ${count} failed items - they can be retried now`);
        return count;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}

// Create singleton instance
const syncManager = new SyncManager();

export default syncManager;

// Export convenience functions
export const syncAll = () => syncManager.syncAll();
export const forceSyncNow = () => syncManager.forceSyncNow();
export const subscribeToSync = (callback) => syncManager.subscribe(callback);
export const setAutoSync = (enabled) => syncManager.setAutoSync(enabled);
export const getSyncStatus = () => syncManager.getSyncStatus();
