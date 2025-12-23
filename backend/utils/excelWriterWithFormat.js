import ExcelJS from 'exceljs';

/**
 * Normalize tên để so sánh (loại bỏ dấu, khoảng trắng thừa)
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Format date từ "2025-12-18" hoặc "18/12/2025" thành "18/12"
 */
function formatDateForExcel(dateString) {
    if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}`;
        }
    }

    const parts = dateString.split('/');
    if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
    }

    return dateString;
}

/**
 * Tìm sheet có tên chứa "điểm danh"
 */
function findAttendanceSheet(workbook) {
    const sheetNames = workbook.worksheets.map(ws => ws.name);
    const attendanceSheetName = sheetNames.find(name =>
        normalizeName(name).includes('diem danh')
    );

    if (!attendanceSheetName) {
        return null;
    }

    return workbook.getWorksheet(attendanceSheetName);
}

/**
 * Tìm dòng của thiếu nhi trong sheet
 */
function findStudentRow(worksheet, studentName) {
    const normalizedSearchName = normalizeName(studentName);
    let foundRow = -1;

    // Duyệt qua các dòng
    worksheet.eachRow((row, rowNumber) => {
        if (foundRow !== -1) return; // Already found

        // Kiểm tra cột D (họ và tên đệm) và E (tên)
        const colD = row.getCell(4).value; // Column D (index 4)
        const colE = row.getCell(5).value; // Column E (index 5)

        if (colD) {
            const fullName = colE ? `${colD} ${colE}` : colD;
            const normalizedFullName = normalizeName(String(fullName));

            if (normalizedFullName === normalizedSearchName) {
                foundRow = rowNumber;
                return;
            }
        }

        // Fallback: tìm trong các cột khác
        for (let col = 1; col <= 6; col++) {
            const cell = row.getCell(col);
            if (cell.value) {
                const cellValue = String(cell.value);
                const normalizedCellValue = normalizeName(cellValue);

                if (normalizedCellValue === normalizedSearchName) {
                    foundRow = rowNumber;
                    return;
                }
            }
        }
    });

    return foundRow;
}

/**
 * Tìm cột theo ngày và loại điểm danh
 */
function findDateColumn(worksheet, date, attendanceType) {
    const dateStr = formatDateForExcel(date);

    const patterns = {
        'Học Giáo Lý': ['H', 'HỌC GL', 'HGL', 'HOC GL'],
        'Lễ Thứ 5': ['LỄ T5', 'T5', 'LE T5', 'LT5'],
        'Lễ Chúa Nhật': ['L', 'LỄ CN', 'LCN', 'LE CN', 'CHU NHAT', 'CN']
    };

    const typePatterns = patterns[attendanceType] || [];

    // Tìm dòng header (dòng có nhiều ngày)
    let headerRow = -1;
    for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        let dateCount = 0;

        row.eachCell((cell) => {
            if (cell.value && String(cell.value).match(/\d{1,2}\/\d{1,2}/)) {
                dateCount++;
            }
        });

        if (dateCount >= 3) {
            headerRow = rowNum;
            break;
        }
    }

    if (headerRow === -1) {
        return -1;
    }

    const typeRow = headerRow + 1;
    const headerRowObj = worksheet.getRow(headerRow);
    const typeRowObj = worksheet.getRow(typeRow);

    let lastSeenDate = null;

    // Duyệt qua các cột
    for (let col = 1; col <= worksheet.columnCount; col++) {
        const dateCell = headerRowObj.getCell(col);
        const typeCell = typeRowObj.getCell(col);

        const dateValue = dateCell.value ? String(dateCell.value).trim() : '';
        const typeValue = typeCell.value ? String(typeCell.value).toUpperCase().trim() : '';

        if (dateValue.includes('/')) {
            lastSeenDate = dateValue;
        }

        const hasPattern = typePatterns.some(pattern =>
            typeValue.includes(pattern.toUpperCase())
        );

        if (hasPattern) {
            const normalizedDate = dateValue.split('/').map(n => parseInt(n) || 0).join('/');
            const normalizedSearchDate = dateStr.split('/').map(n => parseInt(n) || 0).join('/');
            const normalizedLastDate = lastSeenDate ? lastSeenDate.split('/').map(n => parseInt(n) || 0).join('/') : null;

            if (dateValue.includes('/') && normalizedDate === normalizedSearchDate) {
                return col;
            }

            if (!dateValue.includes('/') && normalizedLastDate === normalizedSearchDate) {
                return col;
            }
        }
    }

    return -1;
}

/**
 * Ghi điểm danh vào file Excel (GIỮ NGUYÊN FORMAT)
 * @param {string} filePath - Đường dẫn file Excel
 * @param {string} studentName - Tên thiếu nhi
 * @param {string} date - Ngày điểm danh
 * @param {string} attendanceType - Loại điểm danh
 * @param {boolean} isPresent - Có mặt hay không
 * @returns {Object} { success: boolean, message: string }
 */
export async function writeAttendanceWithFormat(filePath, studentName, date, attendanceType, isPresent) {
    try {
        // Đọc file Excel
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        // Tìm sheet điểm danh
        const worksheet = findAttendanceSheet(workbook);
        if (!worksheet) {
            return {
                success: false,
                message: 'Không tìm thấy sheet điểm danh trong file Excel'
            };
        }

        // Tìm dòng của thiếu nhi
        const studentRow = findStudentRow(worksheet, studentName);
        if (studentRow === -1) {
            return {
                success: false,
                message: `Không tìm thấy thiếu nhi "${studentName}" trong sheet`
            };
        }

        // Tìm cột theo ngày và loại điểm danh
        const dateColumn = findDateColumn(worksheet, date, attendanceType);
        if (dateColumn === -1) {
            return {
                success: false,
                message: `Không tìm thấy cột cho ngày ${date} - ${attendanceType}`
            };
        }

        // Ghi giá trị vào ô (GIỮ NGUYÊN FORMAT)
        const cell = worksheet.getRow(studentRow).getCell(dateColumn);
        cell.value = isPresent ? 1 : 0;
        // Không thay đổi style, format của cell

        // Force Excel to recalculate all formulas when opening the file
        workbook.calcProperties = {
            fullCalcOnLoad: true
        };

        // Lưu file (GIỮ NGUYÊN TẤT CẢ FORMAT)
        await workbook.xlsx.writeFile(filePath);

        return {
            success: true,
            message: `Đã ghi điểm danh cho ${studentName} vào ${date} - ${attendanceType}`,
            details: {
                sheet: worksheet.name,
                row: studentRow,
                column: dateColumn
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Lỗi khi ghi file Excel: ${error.message}`
        };
    }
}

export default writeAttendanceWithFormat;
