import axios from 'axios';
import { savePendingAttendance, cacheClasses, cacheStudents, cacheHistory, getCachedClasses, getCachedStudents, getCachedHistory } from '../utils/offlineStorage';
import networkDetector from '../utils/networkDetector';

// Track last request time for cold start detection
let lastRequestTime = Date.now();
const COLD_START_THRESHOLD = 15 * 60 * 1000; // 15 minutes

// Tạo axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    },
    timeout: 90000 // 90 seconds timeout for cold starts
});

// Helper to check if this might be a cold start
export const isPotentiallyColdStart = () => {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    return timeSinceLastRequest > COLD_START_THRESHOLD;
};

// Request interceptor
api.interceptors.request.use(
    (config) => {
        // Mark if this might be a cold start
        config.metadata = {
            startTime: Date.now(),
            isPotentiallyColdStart: isPotentiallyColdStart()
        };

        // Add authentication headers from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                config.headers['x-user-id'] = user.id;
                config.headers['x-user-role'] = user.role;
                config.headers['x-assigned-classes'] = JSON.stringify(user.assignedClasses || []);
            } catch (err) {
                console.error('Failed to parse user from localStorage:', err);
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        // Update last request time on successful response
        lastRequestTime = Date.now();

        // Log slow requests (potential cold starts)
        const duration = Date.now() - response.config.metadata.startTime;
        if (duration > 5000) {
            console.log(`⏱️ Slow request detected: ${response.config.url} took ${duration}ms`);
        }

        // Handle 304 Not Modified - return cached data or empty object
        if (response.status === 304) {
            console.log('📦 Using cached data (304)');
            return response.data || {};
        }

        return response.data;
    },
    (error) => {
        const message = error.response?.data?.error || 'Đã xảy ra lỗi';
        return Promise.reject(new Error(message));
    }
);

/**
 * Classes API with Offline Support
 */
export const classesAPI = {
    // Upload file Excel và tạo lớp
    upload: async (file, className) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('className', className);

        return api.post('/classes/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    // Lấy danh sách lớp (with caching)
    getAll: async () => {
        try {
            const result = await api.get('/classes');
            // Cache the classes
            if (result.classes) {
                await cacheClasses(result.classes);
            }
            return result;
        } catch (error) {
            // If offline, try to get from cache
            if (!networkDetector.getStatus()) {
                console.log('📴 Offline: Loading classes from cache');
                const cached = await getCachedClasses();
                if (cached && cached.length > 0) {
                    return { classes: cached, fromCache: true };
                }
            }
            throw error;
        }
    },

    // Lấy danh sách thiếu nhi trong lớp (with caching)
    getStudents: async (classId) => {
        try {
            const result = await api.get(`/classes/${classId}/students`);
            // Cache the students
            if (result.students) {
                await cacheStudents(classId, result.students);
            }
            return result;
        } catch (error) {
            // If offline, try to get from cache
            if (!networkDetector.getStatus()) {
                console.log('📴 Offline: Loading students from cache');
                const cached = await getCachedStudents(classId);
                if (cached) {
                    return { students: cached, fromCache: true };
                }
            }
            throw error;
        }
    },

    // Lấy tất cả sheets từ file Excel
    getExcelSheets: (classId) => api.get(`/classes/${classId}/excel`),

    // Cập nhật tên lớp
    update: (classId, className) => api.put(`/classes/${classId}`, { className }),

    // Xóa lớp
    delete: (classId) => api.delete(`/classes/${classId}`)
};

/**
 * Attendance API with Offline Support
 */
export const attendanceAPI = {
    // Lưu điểm danh (with offline support)
    save: async (data) => {
        try {
            // Try to save online first
            const result = await api.post('/attendance', data);
            return result;
        } catch (error) {
            // If offline or network error, save to IndexedDB
            if (!networkDetector.getStatus() || error.message.includes('Network')) {
                console.log('📴 Offline: Saving attendance to local storage');
                await savePendingAttendance(data);

                // Return success response for UI
                return {
                    success: true,
                    offline: true,
                    message: 'Điểm danh đã được lưu offline. Sẽ tự động đồng bộ khi có mạng.'
                };
            }
            // Re-throw other errors
            throw error;
        }
    },

    // Lấy lịch sử điểm danh (with caching)
    getHistory: async (classId, startDate = null, endDate = null) => {
        const params = { classId };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        try {
            const result = await api.get('/attendance/history', { params });
            // Cache the result
            await cacheHistory(classId, result);
            return result;
        } catch (error) {
            // If offline, try to get from cache
            if (!networkDetector.getStatus()) {
                console.log('📴 Offline: Loading history from cache');
                const cached = await getCachedHistory(classId);
                if (cached) {
                    return { ...cached, fromCache: true };
                }
            }
            throw error;
        }
    },

    // Lấy chi tiết buổi điểm danh
    getSession: (sessionId) => api.get(`/attendance/session/${sessionId}`),

    // Xóa buổi điểm danh
    deleteSession: (sessionId) => api.delete(`/attendance/session/${sessionId}`),

    // Xóa điểm danh của từng thiếu nhi trong buổi
    deleteStudentAttendance: (sessionId, studentId) => api.delete(`/attendance/session/${sessionId}/student/${studentId}`),

    // Cập nhật trạng thái điểm danh của một học sinh
    updateStudentStatus: (sessionId, studentId, isPresent) => api.put(`/attendance/session/${sessionId}/student/${studentId}`, { isPresent })
};

/**
 * Export API
 */
export const exportAPI = {
    // Export dữ liệu ra Excel
    exportClass: async (classId, startDate = null, endDate = null) => {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const response = await axios.get(
            `${import.meta.env.VITE_API_URL || '/api'}/export/class/${classId}`,
            {
                params,
                responseType: 'blob'
            }
        );

        // Tạo download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Lấy tên file từ header hoặc tạo tên mặc định
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'DiemDanh.xlsx';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch) {
                fileName = fileNameMatch[1];
            }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    // Export file Excel gốc đã cập nhật với dữ liệu điểm danh
    exportOriginalExcel: async (classId) => {
        const response = await axios.get(
            `${import.meta.env.VITE_API_URL || '/api'}/export/class/${classId}/original`,
            {
                responseType: 'blob'
            }
        );

        // Tạo download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Lấy tên file từ header hoặc tạo tên mặc định
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'FileTong.xlsx';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (fileNameMatch && fileNameMatch[1]) {
                fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''));
            }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};

/**
 * Grades API
 */
export const gradesAPI = {
    // Luu diem (M, 1T, Thi)
    save: (data) => api.post('/grades', data),

    // Lay lich su diem theo lop va hoc ky
    getHistory: (classId, semester = null) => {
        const params = { classId };
        if (semester) params.semester = semester; // HK1 or HK2
        return api.get('/grades/history', { params });
    },

    // Lay chi tiet diem cua mot lop
    getByClass: (classId, semester = null) => {
        const params = {};
        if (semester) params.semester = semester;
        return api.get(`/grades/class/${classId}`, { params });
    },

    // Xoa diem cua mot hoc sinh
    deleteStudentGrade: (gradeId) => api.delete(`/grades/${gradeId}`)
};

/**
 * Students API
 */
export const studentsAPI = {
    // Get QR code for a student
    getQR: (studentId) => api.get(`/students/${studentId}/qr`),

    // Get all QR codes for a class
    getClassQRCodes: (classId) => api.get(`/students/class/${classId}/qr-all`)
};

/**
 * Auth API
 */
export const authAPI = {
    // Login
    login: (username, password) => api.post('/auth/login', { username, password }),

    // Logout
    logout: () => api.post('/auth/logout'),

    // Get current user info (refresh user data)
    getMe: () => api.get('/auth/me')
};

/**
 * Users API (Admin only)
 */
export const usersAPI = {
    // Get all users
    getAll: () => api.get('/users'),

    // Create user
    create: (userData) => api.post('/users', userData),

    // Update user
    update: (userId, userData) => api.put(`/users/${userId}`, userData),

    // Delete user
    delete: (userId) => api.delete(`/users/${userId}`)
};

/**
 * Sync Errors API
 */
export const syncErrorsAPI = {
    // Get resolved attendance IDs for current user
    getMyResolvedAttendanceIds: async (since = null) => {
        try {
            const params = since ? { since } : {};
            const response = await api.get('/sync-errors/my-resolved', { params });
            return response.data?.resolvedAttendanceIds || [];
        } catch (error) {
            console.error('Failed to get resolved attendance IDs:', error);
            return [];
        }
    }
};

export default api;
