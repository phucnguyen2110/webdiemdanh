import axios from 'axios';

// Track last request time for cold start detection
let lastRequestTime = Date.now();
const COLD_START_THRESHOLD = 15 * 60 * 1000; // 15 minutes

// Tạo axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json'
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

        return response.data;
    },
    (error) => {
        const message = error.response?.data?.error || 'Đã xảy ra lỗi';
        return Promise.reject(new Error(message));
    }
);

/**
 * Classes API
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

    // Lấy danh sách lớp
    getAll: () => api.get('/classes'),

    // Lấy danh sách thiếu nhi trong lớp
    getStudents: (classId) => api.get(`/classes/${classId}/students`),

    // Lấy tất cả sheets từ file Excel
    getExcelSheets: (classId) => api.get(`/classes/${classId}/excel`),

    // Cập nhật tên lớp
    update: (classId, className) => api.put(`/classes/${classId}`, { className }),

    // Xóa lớp
    delete: (classId) => api.delete(`/classes/${classId}`)
};

/**
 * Attendance API
 */
export const attendanceAPI = {
    // Lưu điểm danh
    save: (data) => api.post('/attendance', data),

    // Lấy lịch sử điểm danh
    getHistory: (classId, startDate = null, endDate = null) => {
        const params = { classId };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        return api.get('/attendance/history', { params });
    },

    // Lấy chi tiết buổi điểm danh
    getSession: (sessionId) => api.get(`/attendance/session/${sessionId}`),

    // Xóa buổi điểm danh
    deleteSession: (sessionId) => api.delete(`/attendance/session/${sessionId}`)
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
 * Students API
 */
export const studentsAPI = {
    // Get QR code for a student
    getQR: (studentId) => api.get(`/students/${studentId}/qr`),

    // Get all QR codes for a class
    getClassQRCodes: (classId) => api.get(`/students/class/${classId}/qr-all`)
};

export default api;
