import XLSX from 'xlsx';

/**
 * Convert Excel serial date to DD/MM/YYYY format
 * @param {number} serial - Excel serial date number
 * @returns {string} Date in DD/MM/YYYY format
 */
function excelSerialToDate(serial) {
    if (!serial || isNaN(serial)) return '';

    // Use XLSX's built-in date parser for accurate conversion
    const dateObj = XLSX.SSF.parse_date_code(serial);

    if (!dateObj) return '';

    const day = String(dateObj.d).padStart(2, '0');
    const month = String(dateObj.m).padStart(2, '0');
    const year = dateObj.y;

    return `${day}/${month}/${year}`;
}

/**
 * Parse file Excel và trích xuất danh sách thiếu nhi
 * @param {Buffer} fileBuffer - Buffer của file Excel
 * @returns {Array} Danh sách thiếu nhi với format [{stt, baptismalName, fullName, dateOfBirth}]
 */
export function parseExcelFile(fileBuffer) {
    try {
        // Đọc workbook từ buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Lấy sheet đầu tiên
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet sang JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length === 0) {
            throw new Error('File Excel trống');
        }

        // Tìm header row (dòng chứa "STT" hoặc "Họ tên")
        let headerRowIndex = -1;
        let sttColIndex = -1;
        let baptismalNameColIndex = 2; // Cột C (index 2) - Tên Thánh
        let nameColIndex = -1;
        let dateOfBirthColIndex = 5; // Cột F (index 5) - Ngày sinh
        let hasSecondNameColumn = false;

        for (let i = 0; i < Math.min(15, rawData.length); i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            for (let j = 0; j < row.length; j++) {
                const cellValue = String(row[j] || '').toLowerCase().trim();

                // Tìm cột STT
                if (cellValue.includes('stt') || cellValue === 'số tt') {
                    headerRowIndex = i;
                    sttColIndex = j;
                }

                // Tìm cột tên - hỗ trợ nhiều biến thể
                if (cellValue.includes('họ') && cellValue.includes('tên') ||
                    cellValue.includes('họ và tên') ||
                    cellValue.includes('tên') && j > 0 ||
                    cellValue === 'họ tên') {
                    nameColIndex = j;
                }
            }

            if (headerRowIndex !== -1 && sttColIndex !== -1 && nameColIndex !== -1) {
                break;
            }
        }

        // Nếu không tìm thấy header, giả định cột 0 là STT, cột 1 là Họ tên
        if (headerRowIndex === -1) {
            headerRowIndex = 0;
            sttColIndex = 0;
            nameColIndex = 1;
        }

        // Kiểm tra xem tên có bị tách thành 2 cột không
        if (nameColIndex !== -1 && rawData.length > headerRowIndex + 1) {
            let countWithSecondCol = 0;
            let samplesChecked = 0;
            const maxSamples = 5;

            for (let i = headerRowIndex + 1; i < rawData.length && samplesChecked < maxSamples; i++) {
                const sampleRow = rawData[i];
                if (!sampleRow || sampleRow.length === 0 || !sampleRow[nameColIndex]) {
                    continue;
                }

                samplesChecked++;

                // Kiểm tra cột tiếp theo có dữ liệu không
                if (sampleRow[nameColIndex + 1] &&
                    String(sampleRow[nameColIndex + 1]).trim() !== '') {
                    countWithSecondCol++;
                }
            }

            // Nếu > 50% mẫu có cột thứ 2, coi như tên bị tách
            if (countWithSecondCol > samplesChecked / 2) {
                hasSecondNameColumn = true;
            }
        }

        // Parse dữ liệu từ dòng sau header
        const students = [];
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];

            // Skip empty rows
            if (!row || row.length === 0) {
                continue;
            }

            // Skip nếu không có dữ liệu ở cột tên
            if (!row[nameColIndex] || String(row[nameColIndex]).trim() === '') {
                continue;
            }

            // Lấy STT
            const stt = row[sttColIndex] ? parseInt(row[sttColIndex]) : i - headerRowIndex;

            // Skip nếu STT không hợp lệ
            if (isNaN(stt)) {
                continue;
            }

            // Lấy tên thánh (cột C - index 2)
            const baptismalName = row[baptismalNameColIndex] ?
                String(row[baptismalNameColIndex]).trim() : '';

            // Ghép tên từ 1 hoặc 2 cột
            let fullName;
            if (hasSecondNameColumn && row[nameColIndex + 1]) {
                fullName = `${String(row[nameColIndex]).trim()} ${String(row[nameColIndex + 1]).trim()}`.trim();
            } else {
                fullName = String(row[nameColIndex]).trim();
            }

            // Skip nếu tên trống sau khi ghép
            if (!fullName || fullName === '') {
                continue;
            }

            // Lấy ngày sinh (cột F - index 5) và convert từ Excel serial
            let dateOfBirth = '';
            if (row[dateOfBirthColIndex]) {
                const dobValue = row[dateOfBirthColIndex];
                // Nếu là số (Excel serial date)
                if (typeof dobValue === 'number') {
                    dateOfBirth = excelSerialToDate(dobValue);
                } else {
                    // Nếu đã là string, giữ nguyên
                    dateOfBirth = String(dobValue).trim();
                }
            }

            students.push({
                stt: stt,
                baptismalName: baptismalName,
                fullName: fullName,
                dateOfBirth: dateOfBirth
            });
        }

        if (students.length === 0) {
            throw new Error('Không tìm thấy dữ liệu thiếu nhi trong file Excel');
        }

        return students;

    } catch (error) {
        throw new Error(`Lỗi khi đọc file Excel: ${error.message}`);
    }
}

/**
 * Validate file Excel
 * @param {Object} file - Multer file object
 * @returns {Object} {valid: boolean, error: string}
 */
export function validateExcelFile(file) {
    if (!file) {
        return { valid: false, error: 'Không có file được upload' };
    }

    // Check file extension
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
        return { valid: false, error: 'File phải có định dạng .xlsx hoặc .xls' };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        return { valid: false, error: 'File không được vượt quá 5MB' };
    }

    return { valid: true };
}
