/**
 * Offline Storage Manager using IndexedDB
 * Manages offline data storage and retrieval
 */

const DB_NAME = 'DiemDanhOfflineDB';
const DB_VERSION = 1;

// Store names
const STORES = {
    PENDING_ATTENDANCE: 'pendingAttendance',
    CACHED_CLASSES: 'cachedClasses',
    CACHED_STUDENTS: 'cachedStudents',
    CACHED_HISTORY: 'cachedHistory'
};

/**
 * Initialize IndexedDB
 */
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.PENDING_ATTENDANCE)) {
                const attendanceStore = db.createObjectStore(STORES.PENDING_ATTENDANCE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
                attendanceStore.createIndex('synced', 'synced', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.CACHED_CLASSES)) {
                const classesStore = db.createObjectStore(STORES.CACHED_CLASSES, {
                    keyPath: 'id'
                });
                classesStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.CACHED_STUDENTS)) {
                const studentsStore = db.createObjectStore(STORES.CACHED_STUDENTS, {
                    keyPath: 'classId'
                });
                studentsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.CACHED_HISTORY)) {
                const historyStore = db.createObjectStore(STORES.CACHED_HISTORY, {
                    keyPath: 'classId'
                });
                historyStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            }
        };
    });
};

/**
 * Generic function to add data to a store
 */
const addData = async (storeName, data) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Generic function to update data in a store
 */
const updateData = async (storeName, data) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Generic function to get data from a store
 */
const getData = async (storeName, key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Generic function to get all data from a store
 */
const getAllData = async (storeName) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Generic function to delete data from a store
 */
const deleteData = async (storeName, key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Clear all data from a store
 */
const clearStore = async (storeName) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// ============================================
// PENDING ATTENDANCE OPERATIONS
// ============================================

/**
 * Save attendance data for offline sync
 */
export const savePendingAttendance = async (attendanceData) => {
    const data = {
        ...attendanceData,
        timestamp: Date.now(),
        synced: false
    };
    return addData(STORES.PENDING_ATTENDANCE, data);
};

/**
 * Get all pending attendance records
 */
export const getPendingAttendance = async () => {
    const allData = await getAllData(STORES.PENDING_ATTENDANCE);
    return allData.filter(item => !item.synced);
};

/**
 * Mark attendance as synced
 */
export const markAttendanceSynced = async (id) => {
    const data = await getData(STORES.PENDING_ATTENDANCE, id);
    if (data) {
        data.synced = true;
        data.syncedAt = Date.now();
        await updateData(STORES.PENDING_ATTENDANCE, data);
    }
};

/**
 * Delete synced attendance records older than 7 days
 */
export const cleanupOldAttendance = async () => {
    const allData = await getAllData(STORES.PENDING_ATTENDANCE);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const item of allData) {
        if (item.synced && item.syncedAt < sevenDaysAgo) {
            await deleteData(STORES.PENDING_ATTENDANCE, item.id);
        }
    }
};

/**
 * Delete a specific pending attendance record
 */
export const deletePendingAttendance = async (id) => {
    await deleteData(STORES.PENDING_ATTENDANCE, id);
};

/**
 * Get pending attendance with class details
 */
export const getPendingAttendanceDetails = async () => {
    const pending = await getPendingAttendance();
    const cachedClasses = await getCachedClasses();

    // Map class IDs to class names
    const classMap = {};
    cachedClasses.forEach(cls => {
        classMap[cls.id] = cls.name;
    });

    // Helper to fix attendance type display
    const fixAttendanceType = (type) => {
        const typeMap = {
            'Le Thu 5': 'Lễ Thứ 5',
            'Hoc Giao Ly': 'Học Giáo Lý',
            'Le Chua Nhat': 'Lễ Chúa Nhật'
        };
        return typeMap[type] || type;
    };

    // Add class names and student details to pending records
    const detailedPending = [];

    for (const item of pending) {
        // Get student names - try cache first, then fetch from API
        const studentMap = {};

        try {
            // Try cached students first
            let students = null;
            const cachedStudents = await getCachedStudents(item.classId);

            if (cachedStudents?.students && cachedStudents.students.length > 0) {
                students = cachedStudents.students;
            } else {
                // Cache miss or empty - fetch from API
                try {
                    const { classesAPI } = await import('../services/api');
                    const response = await classesAPI.getStudents(item.classId);
                    students = response.data?.students || response.students || [];
                } catch (apiError) {
                    console.warn('Failed to fetch students from API:', apiError);
                }
            }

            if (students) {
                students.forEach(student => {
                    // Handle different field names from backend
                    const saintName = student.baptismalName || student.saintName || student.saint_name;
                    const fullName = student.fullName || student.full_name;

                    studentMap[student.id] = saintName
                        ? `${saintName} ${fullName}`
                        : fullName;
                });
            }
        } catch (error) {
            console.error('Error getting student names:', error);
        }

        // Map student IDs to names in records
        const recordsWithNames = item.records?.map(record => ({
            ...record,
            studentName: studentMap[record.studentId] || `Thiếu nhi #${record.studentId}`
        })) || [];

        detailedPending.push({
            ...item,
            className: classMap[item.classId] || `Lớp ID: ${item.classId}`,
            attendanceType: fixAttendanceType(item.attendanceType),
            formattedDate: new Date(item.attendanceDate).toLocaleDateString('vi-VN'),
            formattedTime: new Date(item.timestamp).toLocaleString('vi-VN'),
            records: recordsWithNames
        });
    }

    return detailedPending;
};

// ============================================
// CACHED CLASSES OPERATIONS
// ============================================

/**
 * Cache classes data
 */
export const cacheClasses = async (classes) => {
    for (const classItem of classes) {
        const data = {
            ...classItem,
            lastUpdated: Date.now()
        };
        await updateData(STORES.CACHED_CLASSES, data);
    }
};

/**
 * Get cached classes
 */
export const getCachedClasses = async () => {
    return getAllData(STORES.CACHED_CLASSES);
};

/**
 * Get single cached class
 */
export const getCachedClass = async (classId) => {
    return getData(STORES.CACHED_CLASSES, classId);
};

// ============================================
// CACHED STUDENTS OPERATIONS
// ============================================

/**
 * Cache students data for a class
 */
export const cacheStudents = async (classId, students) => {
    const data = {
        classId,
        students,
        lastUpdated: Date.now()
    };
    await updateData(STORES.CACHED_STUDENTS, data);
};

/**
 * Get cached students for a class
 */
export const getCachedStudents = async (classId) => {
    const data = await getData(STORES.CACHED_STUDENTS, classId);
    return data ? data.students : null;
};

// ============================================
// CACHED HISTORY OPERATIONS
// ============================================

/**
 * Cache attendance history for a class
 */
export const cacheHistory = async (classId, history) => {
    const data = {
        classId,
        history,
        lastUpdated: Date.now()
    };
    await updateData(STORES.CACHED_HISTORY, data);
};

/**
 * Get cached history for a class
 */
export const getCachedHistory = async (classId) => {
    const data = await getData(STORES.CACHED_HISTORY, classId);
    return data ? data.history : null;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if cache is stale (older than 1 hour)
 */
export const isCacheStale = (lastUpdated, maxAgeMs = 60 * 60 * 1000) => {
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated > maxAgeMs;
};

/**
 * Clear all offline data
 */
export const clearAllOfflineData = async () => {
    await clearStore(STORES.PENDING_ATTENDANCE);
    await clearStore(STORES.CACHED_CLASSES);
    await clearStore(STORES.CACHED_STUDENTS);
    await clearStore(STORES.CACHED_HISTORY);
};

/**
 * Get storage statistics
 */
export const getStorageStats = async () => {
    const pendingAttendance = await getPendingAttendance();
    const cachedClasses = await getCachedClasses();

    return {
        pendingCount: pendingAttendance.length,
        cachedClassesCount: cachedClasses.length,
        oldestPending: pendingAttendance.length > 0
            ? Math.min(...pendingAttendance.map(a => a.timestamp))
            : null
    };
};

export default {
    // Pending Attendance
    savePendingAttendance,
    getPendingAttendance,
    getPendingAttendanceDetails,
    markAttendanceSynced,
    cleanupOldAttendance,
    deletePendingAttendance,

    // Cached Classes
    cacheClasses,
    getCachedClasses,
    getCachedClass,

    // Cached Students
    cacheStudents,
    getCachedStudents,

    // Cached History
    cacheHistory,
    getCachedHistory,

    // Utilities
    isCacheStale,
    clearAllOfflineData,
    getStorageStats
};
