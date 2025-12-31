/**
 * Attendance Validation Helper
 * Validates attendance date and type combinations
 */

/**
 * Get day of week from date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {number} - Day of week (0 = Sunday, 4 = Thursday, etc.)
 */
export const getDayOfWeek = (dateStr) => {
    const date = new Date(dateStr);
    return date.getDay();
};

/**
 * Get Vietnamese day name
 * @param {number} dayOfWeek - Day of week (0-6)
 * @returns {string} - Vietnamese day name
 */
export const getVietnameseDayName = (dayOfWeek) => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[dayOfWeek];
};

/**
 * Get allowed attendance types for a specific date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Array} - Array of allowed attendance types
 */
export const getAllowedAttendanceTypes = (dateStr) => {
    const dayOfWeek = getDayOfWeek(dateStr);

    switch (dayOfWeek) {
        case 0: // Chủ Nhật
            return ['Lễ Chúa Nhật', 'Học Giáo Lý'];
        case 4: // Thứ 5
            return ['Lễ Thứ 5'];
        default:
            return []; // Không được điểm danh các ngày khác
    }
};

/**
 * Validate attendance date and type combination
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} attendanceType - Attendance type
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateAttendance = (dateStr, attendanceType) => {
    if (!dateStr) {
        return { valid: false, error: 'Vui lòng chọn ngày điểm danh' };
    }

    if (!attendanceType) {
        return { valid: false, error: 'Vui lòng chọn loại điểm danh' };
    }

    const dayOfWeek = getDayOfWeek(dateStr);
    const dayName = getVietnameseDayName(dayOfWeek);
    const allowedTypes = getAllowedAttendanceTypes(dateStr);

    // Check if this day allows attendance
    if (allowedTypes.length === 0) {
        return {
            valid: false,
            error: `❌ Không thể điểm danh vào ${dayName}!\n\nChỉ được điểm danh vào:\n• Thứ Năm (Lễ Thứ 5)\n• Chủ Nhật (Lễ Chúa Nhật hoặc Học Giáo Lý)`
        };
    }

    // Check if selected type is allowed for this day
    if (!allowedTypes.includes(attendanceType)) {
        const allowedTypesStr = allowedTypes.join(' hoặc ');
        return {
            valid: false,
            error: `❌ Không thể chọn "${attendanceType}" vào ${dayName}!\n\nVào ${dayName} chỉ được chọn:\n• ${allowedTypesStr}`
        };
    }

    return { valid: true, error: null };
};

/**
 * Get validation message for UI display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} - Validation hint message
 */
export const getValidationHint = (dateStr) => {
    if (!dateStr) return '';

    const dayOfWeek = getDayOfWeek(dateStr);
    const dayName = getVietnameseDayName(dayOfWeek);
    const allowedTypes = getAllowedAttendanceTypes(dateStr);

    if (allowedTypes.length === 0) {
        return `⚠️ ${dayName}: Hiện tại chưa được hỗ trợ điểm danh`;
    }

    const allowedTypesStr = allowedTypes.join(' hoặc ');
    return `✅ ${dayName}: Chỉ được chọn ${allowedTypesStr}`;
};

export default {
    getDayOfWeek,
    getVietnameseDayName,
    getAllowedAttendanceTypes,
    validateAttendance,
    getValidationHint
};
