/**
 * Excel Merger Utilities - UPDATED LOGIC
 * Handle 2-row headers: Row 1 = dates, Row 2 = types
 */

/**
 * Normalize student name for matching
 */
const normalizeStudentName = (name) => {
    if (!name) return '';
    return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Parse date from header cell
 * Supports formats: "28/12", "28/12/2025", etc.
 */
const parseDateFromHeader = (headerText) => {
    if (!headerText) return null;

    const text = String(headerText).trim();

    // Match DD/MM or DD/MM/YYYY
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) return null;

    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);

    return { day, month };
};

/**
 * Check if header matches attendance type
 * Patterns:
 * - Học Giáo Lý: "Hoc GL", "H", "HGL"
 * - Lễ Thứ 5: "Le T5", "T5", "LT5"
 * - Lễ Chúa Nhật: "Le CN", "CN", "LCN"
 */
const matchesAttendanceType = (headerText, attendanceType) => {
    if (!headerText) return false;

    const text = String(headerText).toUpperCase().trim();

    // Normalize attendance type from backend
    const typePatterns = {
        'Hoc Giao Ly': ['HOC GL', 'H', 'HGL', 'HOC GIAO LY'],
        'Le Thu 5': ['LE T5', 'T5', 'LT5', 'LE THU 5'],
        'Le Chua Nhat': ['LE CN', 'CN', 'LCN', 'LE CHUA NHAT']
    };

    const patterns = typePatterns[attendanceType] || [];
    return patterns.some(pattern => text.includes(pattern));
};

/**
 * Find column index for specific date and attendance type
 * Headers may span 2 rows: Row 1 = dates (28/12), Row 2 = types (H, T5, CN)
 */
const findAttendanceColumn = (sheet, headerRowIndex, targetDate, attendanceType) => {
    const targetDay = new Date(targetDate).getDate();
    const targetMonth = new Date(targetDate).getMonth() + 1;

    console.log(`🔍 Looking for: day=${targetDay}, month=${targetMonth}, type="${attendanceType}"`);

    const headerRow = sheet.data[headerRowIndex];
    const typeRow = sheet.data[headerRowIndex + 1]; // Next row may contain types

    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        const headerCell = headerRow[colIndex];

        // Parse date from header
        const dateInfo = parseDateFromHeader(headerCell);
        if (!dateInfo) continue;

        // Check if date matches
        if (dateInfo.day === targetDay && dateInfo.month === targetMonth) {
            // Check if type matches in same cell OR next row
            const typeCell = typeRow ? typeRow[colIndex] : '';

            if (matchesAttendanceType(headerCell, attendanceType) ||
                matchesAttendanceType(typeCell, attendanceType)) {
                return colIndex;
            }
        }
    }

    return -1; // Not found
};

/**
 * Find the actual header row (may not be row 0)
 * Looks for row containing "STT", "MSTN", or "Họ và Tên"
 */
const findHeaderRow = (sheet) => {
    if (!sheet.data || sheet.data.length === 0) return -1;

    for (let rowIndex = 0; rowIndex < Math.min(15, sheet.data.length); rowIndex++) {
        const row = sheet.data[rowIndex];
        const rowText = row.join('|').toUpperCase();

        // Check for common header patterns
        if (rowText.includes('STT') ||
            rowText.includes('MSTN') ||
            rowText.includes('HỌ VÀ TÊN') ||
            rowText.includes('HO VA TEN')) {
            return rowIndex;
        }
    }

    return 0; // Fallback to first row
};

/**
 * Find row index for specific student name
 * Starts searching AFTER header row (skip header + type row)
 */
const findStudentRow = (sheet, studentName, headerRowIndex) => {
    const normalizedTarget = normalizeStudentName(studentName);

    // Start from 2 rows after header (skip header + type row)
    for (let rowIndex = headerRowIndex + 2; rowIndex < sheet.data.length; rowIndex++) {
        const row = sheet.data[rowIndex];

        // Check column 1 (Họ và Tên) - index 1
        // Also check columns 3-4 in case name is split
        const cellName1 = row[1];
        const cellName3 = row[3];
        const cellName4 = row[4];

        // Try full name in column 1
        const normalizedCell1 = normalizeStudentName(cellName1);
        if (normalizedCell1 === normalizedTarget) {
            return rowIndex;
        }

        // Try combined name from columns 3+4
        const combinedName = `${cellName3 || ''} ${cellName4 || ''}`.trim();
        const normalizedCombined = normalizeStudentName(combinedName);
        if (normalizedCombined === normalizedTarget) {
            return rowIndex;
        }
    }

    return -1; // Not found
};

/**
 * Find attendance sheet by name pattern
 */
const findAttendanceSheet = (sheets) => {
    const normalizedPattern = 'diem danh';

    return sheets.find(sheet => {
        const normalizedName = sheet.name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/đ/g, 'd');

        return normalizedName.includes(normalizedPattern);
    });
};

/**
 * Fill attendance data into existing Excel columns
 * @param {Array} sheets - Original Excel sheets
 * @param {Array} attendanceData - Attendance sessions data
 * @returns {Array} Sheets with attendance filled in
 */
export const mergeAttendanceIntoExcel = (sheets, attendanceData) => {
    if (!sheets || sheets.length === 0) {
        return sheets;
    }

    if (!attendanceData || attendanceData.length === 0) {
        return sheets; // No attendance data to fill
    }

    // Clone sheets to avoid mutation
    const updatedSheets = sheets.map(sheet => ({
        ...sheet,
        data: sheet.data.map(row => [...row])
    }));

    // Find the attendance sheet
    const attendanceSheet = findAttendanceSheet(updatedSheets);

    if (!attendanceSheet) {
        console.warn('⚠️ Attendance sheet not found (looking for sheet with "diem danh" in name)');
        console.log('📋 Available sheets:', updatedSheets.map(s => s.name));
        return updatedSheets;
    }

    console.log(`✅ Found attendance sheet: "${attendanceSheet.name}"`);

    if (!attendanceSheet.data || attendanceSheet.data.length === 0) {
        console.warn('⚠️ Attendance sheet is empty');
        return updatedSheets;
    }

    // Find the actual header row
    const headerRowIndex = findHeaderRow(attendanceSheet);
    if (headerRowIndex === -1) {
        console.warn('⚠️ Could not find header row in attendance sheet');
        return updatedSheets;
    }

    console.log(`✅ Found header row at index ${headerRowIndex}`);
    const headerRow = attendanceSheet.data[headerRowIndex];
    const typeRow = attendanceSheet.data[headerRowIndex + 1];
    console.log('📋 Header row (all columns):', headerRow);
    console.log('📋 Type row (all columns):', typeRow);

    // Process each attendance session
    attendanceData.forEach(session => {
        // Find column for this date + type
        const colIndex = findAttendanceColumn(attendanceSheet, headerRowIndex, session.date, session.type);

        if (colIndex === -1) {
            console.warn(`⚠️ Column not found for ${session.date} - ${session.type}`);
            return;
        }

        const headerCell = headerRow[colIndex];
        const typeCell = typeRow ? typeRow[colIndex] : '';
        console.log(`✅ Found column ${colIndex} (date: "${headerCell}", type: "${typeCell}") for ${session.date} - ${session.type}`);

        // Fill attendance for each student
        session.records.forEach(record => {
            if (!record.isPresent) return; // Only mark present students

            // Find student row
            const rowIndex = findStudentRow(attendanceSheet, record.studentName, headerRowIndex);

            if (rowIndex === -1) {
                console.warn(`⚠️ Student not found: ${record.studentName}`);
                return;
            }

            // Fill "1" in the cell
            attendanceSheet.data[rowIndex][colIndex] = '1';
            console.log(`✓ Marked ${record.studentName} present at row ${rowIndex}, col ${colIndex}`);
        });
    });

    return updatedSheets;
};

/**
 * Get attendance statistics from data
 */
export const getAttendanceStats = (attendanceData) => {
    if (!attendanceData || attendanceData.length === 0) {
        return {
            totalSessions: 0,
            totalStudents: 0,
            averageAttendance: 0,
            totalPresent: 0,
            totalRecords: 0
        };
    }

    const totalSessions = attendanceData.length;

    const allStudents = new Set();
    let totalPresent = 0;
    let totalRecords = 0;

    attendanceData.forEach(session => {
        session.records.forEach(record => {
            allStudents.add(normalizeStudentName(record.studentName));
            totalRecords++;
            if (record.isPresent) {
                totalPresent++;
            }
        });
    });

    const averageAttendance = totalRecords > 0
        ? Math.round((totalPresent / totalRecords) * 100)
        : 0;

    return {
        totalSessions,
        totalStudents: allStudents.size,
        averageAttendance,
        totalPresent,
        totalRecords
    };
};

/**
 * Check if a cell value indicates presence
 */
export const isPresent = (cellValue) => {
    if (!cellValue) return false;
    const val = String(cellValue).trim();
    return val === '1' || val === '✓' || val.toLowerCase() === 'x';
};

/**
 * Get color for cell based on value
 */
export const getAttendanceCellColor = (value) => {
    if (isPresent(value)) return '#d4edda'; // Light green
    return '#fff'; // White
};
