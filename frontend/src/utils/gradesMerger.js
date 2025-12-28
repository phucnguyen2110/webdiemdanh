/**
 * Grades Merger Utilities
 * Xu ly merge diem (M, 1T, Thi) vao Excel sheets
 * Tuong tu nhu attendance merger
 */

// Normalize student name for matching
const normalizeStudentName = (name) => {
    if (!name) return '';

    let normalized = String(name).trim();

    // Remove baptismal name prefix (e.g., "Isave Nguyễn Gia An" -> "Nguyễn Gia An")
    // Common baptismal names pattern: word followed by space and Vietnamese name
    const baptismalPattern = /^[A-Za-z]+\s+/;
    normalized = normalized.replace(baptismalPattern, '');

    // Normalize to lowercase and remove extra spaces
    normalized = normalized.toLowerCase().replace(/\s+/g, ' ');

    // Remove Vietnamese diacritics for better matching
    normalized = normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd');

    return normalized;
};

/**
 * Tim sheet diem theo hoc ky (HK1 hoac HK2)
 * Pattern: "Diem HK1" hoac "Diem HK2"
 */
const findGradeSheet = (sheets, semester) => {
    const normalizedPattern = `diem ${semester.toLowerCase()}`;

    return sheets.find(sheet => {
        const normalizedName = sheet.name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/đ/g, 'd')
            .trim(); // Add trim to remove extra spaces

        return normalizedName.includes(normalizedPattern);
    });
};

/**
 * Tim header row trong sheet diem
 * Tim dong chua "STT", "MSTN", hoac "Ho va Ten"
 */
const findHeaderRow = (sheet) => {
    if (!sheet.data || sheet.data.length === 0) return -1;

    for (let rowIndex = 0; rowIndex < Math.min(15, sheet.data.length); rowIndex++) {
        const row = sheet.data[rowIndex];
        const rowText = row.join('|').toUpperCase();

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
 * Tim row index cua hoc sinh theo ten
 * Excel structure: 
 * - Column A (0): STT
 * - Column B (1): Tên Thánh (Baptismal name)
 * - Column C (2): Họ và Tên part 1
 * - Column D (3): Họ và Tên part 2
 */
const findStudentRow = (sheet, studentName, headerRowIndex) => {
    const normalizedTarget = normalizeStudentName(studentName);

    // Start from row after header
    for (let rowIndex = headerRowIndex + 1; rowIndex < sheet.data.length; rowIndex++) {
        const row = sheet.data[rowIndex];

        // Primary: Check columns C+D (index 2+3) - Main name columns
        const cellName2 = row[2]; // Column C
        const cellName3 = row[3]; // Column D
        const combinedName23 = `${cellName2 || ''} ${cellName3 || ''}`.trim();
        const normalizedCombined23 = normalizeStudentName(combinedName23);

        if (normalizedCombined23 === normalizedTarget) {
            return rowIndex;
        }

        // Fallback 1: Check column B (index 1) - Baptismal name column
        const cellName1 = row[1];
        const normalizedCell1 = normalizeStudentName(cellName1);
        if (normalizedCell1 === normalizedTarget) {
            return rowIndex;
        }

        // Fallback 2: Check columns D+E (index 3+4) - Alternative split
        const cellName4 = row[4];
        const combinedName34 = `${cellName3 || ''} ${cellName4 || ''}`.trim();
        const normalizedCombined34 = normalizeStudentName(combinedName34);
        if (normalizedCombined34 === normalizedTarget) {
            return rowIndex;
        }
    }

    return -1; // Not found
};

/**
 * Tim column index cho loai diem (M, 1T, Thi)
 * Priority 1: Fixed column positions (G=6, H=7, I=8)
 * Priority 2: Pattern matching in header
 */
const findGradeColumn = (sheet, headerRowIndex, gradeType) => {
    // Priority 1: Use fixed column positions
    // G (index 6) = M, H (index 7) = 1T, I (index 8) = Thi
    const fixedColumns = {
        'M': 6,    // Column G
        '1T': 7,   // Column H
        'Thi': 8   // Column I
    };

    const fixedCol = fixedColumns[gradeType];
    if (fixedCol !== undefined) {
        const headerRow = sheet.data[headerRowIndex];
        if (headerRow && headerRow.length > fixedCol) {
            return fixedCol;
        }
    }

    // Priority 2: Fallback to pattern matching
    const headerRow = sheet.data[headerRowIndex];

    const patterns = {
        'M': ['M', 'MIENG', 'DIEM MIENG', 'MIỆNG', 'ĐIỂM MIỆNG'],
        '1T': ['1T', '1 TIET', 'DIEM 1 TIET', 'DIEM 1T', '1 TIẾT', 'ĐIỂM 1 TIẾT'],
        'Thi': ['THI', 'DIEM THI', 'CUOI KY', 'CUOI KI', 'ĐIỂM THI', 'CUỐI KỲ', 'CUỐI KÌ']
    };

    const searchPatterns = patterns[gradeType] || [];

    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        const cellValue = String(headerRow[colIndex] || '')
            .toUpperCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        if (searchPatterns.some(pattern => {
            const normalizedPattern = pattern
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return cellValue.includes(normalizedPattern);
        })) {
            return colIndex;
        }
    }

    return -1;
};

/**
 * Merge grade data vao Excel sheets
 * @param {Array} sheets - Original Excel sheets
 * @param {Array} gradesData - Grade data from API
 * @returns {Array} Sheets with grades filled in
 */
export const mergeGradesIntoExcel = (sheets, gradesData) => {
    if (!sheets || sheets.length === 0) {
        return sheets;
    }

    if (!gradesData || gradesData.length === 0) {
        return sheets; // No grades data to fill
    }

    // Clone sheets to avoid mutation
    const updatedSheets = sheets.map(sheet => ({
        ...sheet,
        data: sheet.data.map(row => [...row])
    }));

    // Group grades by semester
    const gradesBySemester = {};
    gradesData.forEach(grade => {
        if (!gradesBySemester[grade.semester]) {
            gradesBySemester[grade.semester] = [];
        }
        gradesBySemester[grade.semester].push(grade);
    });

    // Process each semester
    Object.keys(gradesBySemester).forEach(semester => {
        const semesterGrades = gradesBySemester[semester];

        // Find the grade sheet for this semester
        const gradeSheet = findGradeSheet(updatedSheets, semester);

        if (!gradeSheet || !gradeSheet.data || gradeSheet.data.length === 0) {
            return;
        }

        const headerRowIndex = findHeaderRow(gradeSheet);
        if (headerRowIndex === -1) {
            return;
        }

        const colM = findGradeColumn(gradeSheet, headerRowIndex, 'M');
        const col1T = findGradeColumn(gradeSheet, headerRowIndex, '1T');
        const colThi = findGradeColumn(gradeSheet, headerRowIndex, 'Thi');

        semesterGrades.forEach(grade => {
            const rowIndex = findStudentRow(gradeSheet, grade.studentName, headerRowIndex);

            if (rowIndex === -1) {
                return;
            }

            if (colM !== -1 && grade.gradeM !== null && grade.gradeM !== undefined) {
                gradeSheet.data[rowIndex][colM] = grade.gradeM;
            }

            if (col1T !== -1 && grade.grade1T !== null && grade.grade1T !== undefined) {
                gradeSheet.data[rowIndex][col1T] = grade.grade1T;
            }

            if (colThi !== -1 && grade.gradeThi !== null && grade.gradeThi !== undefined) {
                gradeSheet.data[rowIndex][colThi] = grade.gradeThi;
            }
        });
    });

    return updatedSheets;
};

/**
 * Get grade statistics
 */
export const getGradeStats = (gradesData) => {
    if (!gradesData || gradesData.length === 0) {
        return {
            totalStudents: 0,
            averageM: 0,
            average1T: 0,
            averageThi: 0
        };
    }

    let totalM = 0, countM = 0;
    let total1T = 0, count1T = 0;
    let totalThi = 0, countThi = 0;

    gradesData.forEach(grade => {
        if (grade.gradeM !== null && grade.gradeM !== undefined) {
            totalM += parseFloat(grade.gradeM);
            countM++;
        }
        if (grade.grade1T !== null && grade.grade1T !== undefined) {
            total1T += parseFloat(grade.grade1T);
            count1T++;
        }
        if (grade.gradeThi !== null && grade.gradeThi !== undefined) {
            totalThi += parseFloat(grade.gradeThi);
            countThi++;
        }
    });

    return {
        totalStudents: gradesData.length,
        averageM: countM > 0 ? (totalM / countM).toFixed(2) : 0,
        average1T: count1T > 0 ? (total1T / count1T).toFixed(2) : 0,
        averageThi: countThi > 0 ? (totalThi / countThi).toFixed(2) : 0
    };
};
