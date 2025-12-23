import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Normalize tên để so sánh (loại bỏ dấu, khoảng trắng thừa)
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/đ/g, 'd')  // Convert đ to d
        .replace(/Đ/g, 'd')  // Convert Đ to d
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Format date từ "2025-12-18" hoặc "18/12/2025" thành "18/12"
 */
function formatDateForExcel(dateString) {
    // Handle YYYY-MM-DD format (from API)
    if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`; // "2025-12-18" → "18/12"
        }
    }

    // Handle DD/MM/YYYY format
    const parts = dateString.split('/');
    if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`; // "18/12/2025" → "18/12"
    }

    return dateString;
}

/**
 * Tìm sheet có tên chứa "điểm danh"
 */
function findAttendanceSheet(workbook) {
    const sheetNames = workbook.SheetNames;

    // Tìm sheet có chứa "điểm danh" (case-insensitive)
    const attendanceSheetName = sheetNames.find(name =>
        normalizeName(name).includes('diem danh')
    );

    if (!attendanceSheetName) {
        return null;
    }

    return {
        name: attendanceSheetName,
        sheet: workbook.Sheets[attendanceSheetName]
    };
}

/**
 * Tìm dòng của thiếu nhi trong sheet
 */
function findStudentRow(sheet, studentName) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const normalizedSearchName = normalizeName(studentName);

    // Duyệt qua các dòng
    for (let row = range.s.r; row <= range.e.r; row++) {
        // Kiểm tra cột D (họ và tên đệm) và E (tên)
        const colDCell = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })]; // Column D
        const colECell = sheet[XLSX.utils.encode_cell({ r: row, c: 4 })]; // Column E

        if (colDCell && colDCell.v) {
            // Ghép cột D và E để tạo tên đầy đủ
            const fullName = colECell && colECell.v
                ? `${colDCell.v} ${colECell.v}`
                : colDCell.v;

            const normalizedFullName = normalizeName(fullName);

            // So sánh tên đầy đủ
            if (normalizedFullName === normalizedSearchName) {
                return row;
            }
        }

        // Fallback: tìm trong các cột khác (cho trường hợp tên không tách)
        for (let col = 0; col <= Math.min(5, range.e.c); col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = sheet[cellAddress];

            if (cell && cell.v) {
                const cellValue = String(cell.v);
                const normalizedCellValue = normalizeName(cellValue);

                // So sánh tên
                if (normalizedCellValue === normalizedSearchName) {
                    return row;
                }
            }
        }
    }

    return -1;
}

/**
 * Tìm cột theo ngày và loại điểm danh
 * Logic: 
 * 1. Tự động phát hiện dòng header (tìm dòng có nhiều ngày)
 * 2. Tìm cột có ngày khớp và loại khớp ngay bên dưới
 * 3. Nếu cột không có ngày (trống), dùng ngày từ cột gần nhất bên trái
 */
function findDateColumn(sheet, date, attendanceType) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const dateStr = formatDateForExcel(date);

    const patterns = {
        'Học Giáo Lý': ['H', 'HỌC GL', 'HGL', 'HOC GL'],
        'Lễ Thứ 5': ['LỄ T5', 'T5', 'LE T5', 'LT5'],
        'Lễ Chúa Nhật': ['L', 'LỄ CN', 'LCN', 'LE CN', 'CHU NHAT', 'CN']
    };

    const typePatterns = patterns[attendanceType] || [];

    // Bước 1: Tìm dòng header (dòng có nhiều ngày)
    let headerRow = -1;
    for (let row = range.s.r; row <= Math.min(range.s.r + 20, range.e.r); row++) {
        let dateCount = 0;
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
            if (cell && cell.v && String(cell.v).match(/\d{1,2}\/\d{1,2}/)) {
                dateCount++;
            }
        }
        // Nếu dòng có >= 3 ngày, coi là header
        if (dateCount >= 3) {
            headerRow = row;
            break;
        }
    }

    if (headerRow === -1) {
        return -1; // Không tìm thấy header
    }

    const typeRow = headerRow + 1; // Dòng loại điểm danh ngay bên dưới

    // Bước 2: Duyệt qua các cột để tìm ngày + loại
    let lastSeenDate = null;

    for (let col = range.s.c; col <= range.e.c; col++) {
        const dateCell = sheet[XLSX.utils.encode_cell({ r: headerRow, c: col })];
        const typeCell = sheet[XLSX.utils.encode_cell({ r: typeRow, c: col })];

        const dateValue = dateCell?.v ? String(dateCell.v).trim() : '';
        const typeValue = typeCell?.v ? String(typeCell.v).toUpperCase().trim() : '';

        // Nếu có ngày, lưu lại
        if (dateValue.includes('/')) {
            lastSeenDate = dateValue;
        }

        // Kiểm tra loại điểm danh
        const hasPattern = typePatterns.some(pattern =>
            typeValue.includes(pattern.toUpperCase())
        );

        if (hasPattern) {
            // So sánh ngày (hỗ trợ cả 7/9 và 07/09)
            const normalizedDate = dateValue.split('/').map(n => parseInt(n) || 0).join('/');
            const normalizedSearchDate = dateStr.split('/').map(n => parseInt(n) || 0).join('/');
            const normalizedLastDate = lastSeenDate ? lastSeenDate.split('/').map(n => parseInt(n) || 0).join('/') : null;

            // Case 1: Cột này có ngày và khớp
            if (dateValue.includes('/') && normalizedDate === normalizedSearchDate) {
                return col;
            }

            // Case 2: Cột này không có ngày, dùng ngày gần nhất bên trái
            if (!dateValue.includes('/') && normalizedLastDate === normalizedSearchDate) {
                return col;
            }
        }
    }

    return -1;
}

/**
 * Ghi điểm danh vào file Excel
 * @param {string} filePath - Đường dẫn file Excel
 * @param {string} studentName - Tên thiếu nhi
 * @param {string} date - Ngày điểm danh (format: DD/MM/YYYY)
 * @param {string} attendanceType - Loại điểm danh
 * @param {boolean} isPresent - Có mặt hay không
 * @returns {Object} { success: boolean, message: string }
 */
export function writeAttendance(filePath, studentName, date, attendanceType, isPresent) {
    try {
        // Đọc file Excel
        const fileBuffer = readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Tìm sheet điểm danh
        const attendanceSheetInfo = findAttendanceSheet(workbook);
        if (!attendanceSheetInfo) {
            return {
                success: false,
                message: 'Không tìm thấy sheet điểm danh trong file Excel'
            };
        }

        const sheet = attendanceSheetInfo.sheet;

        // Tìm dòng của thiếu nhi
        const studentRow = findStudentRow(sheet, studentName);
        if (studentRow === -1) {
            return {
                success: false,
                message: `Không tìm thấy thiếu nhi "${studentName}" trong sheet`
            };
        }

        // Tìm cột theo ngày và loại điểm danh
        const dateColumn = findDateColumn(sheet, date, attendanceType);
        if (dateColumn === -1) {
            return {
                success: false,
                message: `Không tìm thấy cột cho ngày ${date} - ${attendanceType}`
            };
        }

        // Ghi giá trị vào ô
        const cellAddress = XLSX.utils.encode_cell({ r: studentRow, c: dateColumn });
        if (!sheet[cellAddress]) {
            sheet[cellAddress] = {};
        }
        sheet[cellAddress].v = isPresent ? 1 : 0;
        sheet[cellAddress].t = 'n'; // number type

        // Lưu file
        XLSX.writeFile(workbook, filePath);

        return {
            success: true,
            message: `Đã ghi điểm danh cho ${studentName} vào ${date} - ${attendanceType}`,
            details: {
                sheet: attendanceSheetInfo.name,
                row: studentRow,
                column: dateColumn,
                cell: cellAddress
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Lỗi khi ghi file Excel: ${error.message}`
        };
    }
}

/**
 * Ghi điểm danh cho nhiều thiếu nhi cùng lúc
 */
export async function writeAttendanceBulk(filePath, attendanceData) {
    const results = [];

    for (const data of attendanceData) {
        const result = writeAttendance(
            filePath,
            data.studentName,
            data.date,
            data.attendanceType,
            data.isPresent
        );
        results.push({
            studentName: data.studentName,
            ...result
        });
    }

    return results;
}
