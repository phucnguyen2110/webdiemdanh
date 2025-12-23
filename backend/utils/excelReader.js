import XLSX from 'xlsx';
import { readFileSync } from 'fs';

/**
 * Convert Excel serial date to DD/MM/YYYY format
 * @param {number} serial - Excel serial date number
 * @returns {string} Date in DD/MM/YYYY format
 */
function excelSerialToDate(serial) {
    if (!serial || isNaN(serial)) return serial;

    // Nếu không phải số, trả về nguyên giá trị
    if (typeof serial !== 'number') return serial;

    // Use XLSX's built-in date parser for accurate conversion
    const dateObj = XLSX.SSF.parse_date_code(serial);

    if (!dateObj) return serial;

    const day = String(dateObj.d).padStart(2, '0');
    const month = String(dateObj.m).padStart(2, '0');
    const year = dateObj.y;

    return `${day}/${month}/${year}`;
}

/**
 * Process cell value - convert Excel serial dates to readable format
 * @param {any} value - Cell value
 * @param {number} colIndex - Column index (0-based)
 * @returns {any} Processed value
 */
function processCellValue(value, colIndex) {
    // Auto-detect Excel serial dates
    // Excel dates are typically between 1 (1/1/1900) and 100000 (year 2173)
    if (typeof value === 'number' && value > 1 && value < 100000) {
        // Check if it looks like a date (no decimals or small decimals)
        const hasSmallDecimal = (value % 1) < 0.01;
        if (hasSmallDecimal || value % 1 === 0) {
            // Likely a date - convert it
            return excelSerialToDate(value);
        }
    }
    return value;
}

/**
 * Đọc tất cả các sheets từ file Excel
 * @param {string} filePath - Đường dẫn tới file Excel
 * @returns {Array} Mảng các sheets với tên và dữ liệu
 */
export function readAllSheets(filePath) {
    try {
        // Đọc file Excel
        const fileBuffer = readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Lấy tất cả sheets
        const sheets = [];

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];

            // Convert sheet sang mảng 2D
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,  // Trả về mảng 2D thay vì objects
                defval: ''  // Giá trị mặc định cho ô trống
            });

            // Process data - convert Excel serial dates
            const data = rawData.map(row =>
                row.map((cell, colIndex) => processCellValue(cell, colIndex))
            );

            sheets.push({
                name: sheetName,
                data: data,
                rowCount: data.length,
                colCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0
            });
        }

        return sheets;

    } catch (error) {
        throw new Error(`Lỗi khi đọc file Excel: ${error.message}`);
    }
}

/**
 * Đọc một sheet cụ thể từ file Excel
 * @param {string} filePath - Đường dẫn tới file Excel
 * @param {string} sheetName - Tên sheet cần đọc
 * @returns {Object} Dữ liệu của sheet
 */
export function readSheet(filePath, sheetName) {
    try {
        const fileBuffer = readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        if (!workbook.SheetNames.includes(sheetName)) {
            throw new Error(`Sheet "${sheetName}" không tồn tại trong file`);
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: ''
        });

        // Process data - convert Excel serial dates
        const data = rawData.map(row =>
            row.map((cell, colIndex) => processCellValue(cell, colIndex))
        );

        return {
            name: sheetName,
            data: data,
            rowCount: data.length,
            colCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0
        };

    } catch (error) {
        throw new Error(`Lỗi khi đọc sheet: ${error.message}`);
    }
}

/**
 * Lấy danh sách tên các sheets trong file Excel
 * @param {string} filePath - Đường dẫn tới file Excel
 * @returns {Array} Mảng tên các sheets
 */
export function getSheetNames(filePath) {
    try {
        const fileBuffer = readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        return workbook.SheetNames;
    } catch (error) {
        throw new Error(`Lỗi khi đọc danh sách sheets: ${error.message}`);
    }
}
