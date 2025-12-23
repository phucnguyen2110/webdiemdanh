import XLSX from 'xlsx';

/**
 * Export dữ liệu điểm danh ra file Excel
 * @param {Object} classInfo - Thông tin lớp {id, name}
 * @param {Array} students - Danh sách thiếu nhi
 * @param {Array} sessions - Danh sách buổi điểm danh với records
 * @returns {Buffer} Excel file buffer
 */
export function exportAttendanceToExcel(classInfo, students, sessions) {
    // Tạo workbook mới
    const workbook = XLSX.utils.book_new();

    // === SHEET 1: Tổng hợp điểm danh ===
    const summaryData = [];

    // Header
    const header = ['STT', 'Họ và Tên'];
    sessions.forEach(session => {
        const dateStr = new Date(session.attendanceDate).toLocaleDateString('vi-VN');
        header.push(`${dateStr}\n${session.attendanceType}`);
    });
    summaryData.push(header);

    // Tạo map để tra cứu nhanh
    const sessionRecordsMap = {};
    sessions.forEach(session => {
        sessionRecordsMap[session.id] = {};
        session.records.forEach(record => {
            sessionRecordsMap[session.id][record.studentId] = record.isPresent;
        });
    });

    // Dữ liệu từng thiếu nhi
    students.forEach(student => {
        const row = [student.stt, student.fullName];

        sessions.forEach(session => {
            const isPresent = sessionRecordsMap[session.id][student.id];
            row.push(isPresent ? 'X' : '');
        });

        summaryData.push(row);
    });

    // Thêm dòng thống kê
    summaryData.push([]);
    const statsRow = ['', 'Tổng có mặt'];
    sessions.forEach(session => {
        const presentCount = session.records.filter(r => r.isPresent).length;
        statsRow.push(presentCount);
    });
    summaryData.push(statsRow);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths
    summarySheet['!cols'] = [
        { wch: 5 },  // STT
        { wch: 25 }, // Họ tên
        ...sessions.map(() => ({ wch: 15 })) // Các cột ngày
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng hợp');

    // === SHEET 2: Chi tiết từng buổi ===
    const detailData = [];

    sessions.forEach((session, index) => {
        if (index > 0) {
            detailData.push([]); // Empty row between sessions
        }

        const dateStr = new Date(session.attendanceDate).toLocaleDateString('vi-VN');
        detailData.push([`Ngày: ${dateStr} - ${session.attendanceType}`]);
        detailData.push(['STT', 'Họ và Tên', 'Có mặt']);

        session.records.forEach(record => {
            detailData.push([
                record.stt,
                record.fullName,
                record.isPresent ? 'Có' : 'Vắng'
            ]);
        });

        const presentCount = session.records.filter(r => r.isPresent).length;
        const totalCount = session.records.length;
        detailData.push([]);
        detailData.push(['', 'Tổng kết:', `${presentCount}/${totalCount} em có mặt`]);
    });

    const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
    detailSheet['!cols'] = [
        { wch: 5 },  // STT
        { wch: 25 }, // Họ tên
        { wch: 10 }  // Có mặt
    ];

    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Chi tiết');

    // Convert workbook to buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return excelBuffer;
}

/**
 * Tạo tên file Excel
 * @param {string} className - Tên lớp
 * @returns {string} Tên file
 */
export function generateExcelFileName(className) {
    const date = new Date().toISOString().split('T')[0];
    const sanitizedClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
    return `DiemDanh_${sanitizedClassName}_${date}.xlsx`;
}
