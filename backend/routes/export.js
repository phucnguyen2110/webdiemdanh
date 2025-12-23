import express from 'express';
import { query, validationResult } from 'express-validator';
import {
    classesDB,
    studentsDB,
    attendanceSessionsDB,
    attendanceRecordsDB
} from '../database.js';
import { exportAttendanceToExcel, generateExcelFileName } from '../utils/excelExporter.js';

const router = express.Router();

/**
 * GET /api/export/class/:classId
 * Export dữ liệu điểm danh ra Excel
 * Query params: startDate (optional), endDate (optional)
 */
router.get('/class/:classId',
    [
        query('startDate').optional().isDate().withMessage('Ngày bắt đầu không hợp lệ'),
        query('endDate').optional().isDate().withMessage('Ngày kết thúc không hợp lệ')
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }

            const { classId } = req.params;
            const { startDate, endDate } = req.query;

            // Kiểm tra lớp có tồn tại không
            const classInfo = await classesDB.getById(classId);
            if (!classInfo) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy lớp'
                });
            }

            // Lấy danh sách thiếu nhi
            const students = await studentsDB.getByClassId(classId);

            // Lấy lịch sử điểm danh
            const sessions = await attendanceSessionsDB.getByClassId(classId, startDate, endDate);

            if (sessions.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Không có dữ liệu điểm danh để export'
                });
            }

            // Lấy chi tiết từng buổi điểm danh
            const sessionsWithRecords = [];
            for (const session of sessions) {
                const records = await attendanceRecordsDB.getBySessionId(session.id);
                sessionsWithRecords.push({
                    ...session,
                    records: records
                });
            }

            // Export ra Excel
            const excelBuffer = exportAttendanceToExcel(classInfo, students, sessionsWithRecords);

            // Tạo tên file
            const fileName = generateExcelFileName(classInfo.name);

            // Set headers và gửi file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(excelBuffer);

        } catch (error) {
            console.error('Error exporting attendance:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi khi export dữ liệu'
            });
        }
    }
);

/**
 * GET /api/export/class/:classId/original
 * Export file Excel gốc đã được cập nhật với tất cả dữ liệu điểm danh
 */
router.get('/class/:classId/original', async (req, res) => {
    try {
        const { classId } = req.params;

        // Kiểm tra lớp có tồn tại không
        const classInfo = await classesDB.getById(classId);
        if (!classInfo) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy lớp'
            });
        }

        // Import các module cần thiết
        const { readFileSync, existsSync, readdirSync } = await import('fs');
        const { join, dirname } = await import('path');
        const { fileURLToPath } = await import('url');

        let excelFilePath = classInfo.excel_file_path;

        // Nếu không có excelFilePath, tìm trong thư mục uploads
        if (!excelFilePath) {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const uploadsDir = join(__dirname, '..', 'uploads', 'excel');

            if (existsSync(uploadsDir)) {
                const files = readdirSync(uploadsDir);
                // Tìm file chứa tên lớp (case-insensitive)
                const className = classInfo.name.toLowerCase();
                const matchingFile = files.find(f =>
                    f.toLowerCase().includes(className) &&
                    (f.endsWith('.xlsx') || f.endsWith('.xls'))
                );

                if (matchingFile) {
                    excelFilePath = join(uploadsDir, matchingFile);
                    console.log(`Auto-discovered Excel file: ${excelFilePath}`);
                }
            }
        }

        // Kiểm tra có file Excel không
        if (!excelFilePath) {
            return res.status(404).json({
                success: false,
                error: 'Lớp này không có file Excel. Vui lòng upload file Excel trước khi export.'
            });
        }

        // Kiểm tra file có tồn tại không
        if (!existsSync(excelFilePath)) {
            return res.status(404).json({
                success: false,
                error: `File Excel không tồn tại tại: ${excelFilePath}`
            });
        }

        // Lấy tất cả sessions điểm danh
        const sessions = await attendanceSessionsDB.getByClassId(classId);

        // Ghi từng session vào Excel
        if (sessions && sessions.length > 0) {
            const { writeAttendanceWithFormat } = await import('../utils/excelWriterWithFormat.js');

            for (const session of sessions) {
                const records = await attendanceRecordsDB.getBySessionId(session.id);

                // Ghi vào Excel cho từng thiếu nhi
                for (const record of records) {
                    if (record.isPresent) {
                        try {
                            await writeAttendanceWithFormat(
                                excelFilePath,
                                record.fullName,
                                session.attendanceDate,
                                session.attendanceType,
                                record.isPresent
                            );
                        } catch (err) {
                            console.error(`Error writing attendance for ${record.fullName}:`, err.message);
                            // Continue với records khác
                        }
                    }
                }
            }
        }

        // Đọc file (đã cập nhật hoặc gốc nếu không có sessions)
        const fileBuffer = readFileSync(excelFilePath);

        // Tạo tên file
        const fileName = `${classInfo.name}_Updated_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Set headers và gửi file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.send(fileBuffer);

    } catch (error) {
        console.error('Error exporting original Excel:', error);
        res.status(500).json({
            success: false,
            error: `Lỗi khi export file Excel: ${error.message}`
        });
    }
});

export default router;
