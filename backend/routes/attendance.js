import express from 'express';
import { body, validationResult, query } from 'express-validator';
import {
    attendanceSessionsDB,
    attendanceRecordsDB,
    classesDB,
    studentsDB
} from '../database.js';
import { writeAttendanceWithFormat } from '../utils/excelWriterWithFormat.js';
import { existsSync } from 'fs';

const router = express.Router();

/**
 * POST /api/attendance
 * Lưu điểm danh
 */
router.post('/',
    [
        body('classId').isInt().withMessage('Class ID không hợp lệ'),
        body('attendanceDate').isDate().withMessage('Ngày điểm danh không hợp lệ'),
        body('attendanceType')
            .isIn(['Học Giáo Lý', 'Thánh Lễ', 'Lễ Thứ 5', 'Lễ Chúa Nhật'])
            .withMessage('Loại điểm danh không hợp lệ'),
        body('records').isArray().withMessage('Dữ liệu điểm danh không hợp lệ'),
        body('records.*.studentId').isInt().withMessage('Student ID không hợp lệ'),
        body('records.*.isPresent').isBoolean().withMessage('Trạng thái có mặt không hợp lệ')
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

            const { classId, attendanceDate, attendanceType, records, attendanceMethod = 'manual' } = req.body;

            // Kiểm tra lớp có tồn tại không
            const classInfo = await classesDB.getById(classId);
            if (!classInfo) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy lớp'
                });
            }

            // Tạo session điểm danh
            const sessionId = await attendanceSessionsDB.create(classId, attendanceDate, attendanceType, attendanceMethod);

            // Lưu chi tiết điểm danh
            await attendanceRecordsDB.createBulk(sessionId, records);

            // Ghi vào file Excel nếu có
            const excelResults = [];
            try {
                console.log('Excel file path:', classInfo.excel_file_path);
                console.log('File exists:', classInfo.excel_file_path && existsSync(classInfo.excel_file_path));

                if (classInfo.excel_file_path && existsSync(classInfo.excel_file_path)) {
                    for (const record of records) {
                        // Chỉ ghi những em có mặt
                        if (record.isPresent) {
                            // Lấy thông tin thiếu nhi
                            const students = await studentsDB.getByClassId(classId);
                            const student = students.find(s => s.id === record.studentId);

                            if (student) {
                                console.log(`Writing attendance for ${student.fullName}, date: ${attendanceDate}, type: ${attendanceType}`);
                                const result = await writeAttendanceWithFormat(
                                    classInfo.excel_file_path,
                                    student.fullName,
                                    attendanceDate,
                                    attendanceType,
                                    record.isPresent
                                );
                                console.log('Write result:', result);
                                excelResults.push({
                                    student: student.fullName,
                                    ...result
                                });
                            }
                        }
                    }
                }
            } catch (excelError) {
                console.error('Error writing to Excel:', excelError);
                // Don't fail the request if Excel write fails
            }

            res.json({
                success: true,
                sessionId: sessionId,
                message: 'Đã lưu điểm danh thành công',
                excelWriteResults: excelResults.length > 0 ? excelResults : undefined
            });

        } catch (error) {
            console.error('Error saving attendance:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi khi lưu điểm danh'
            });
        }
    }
);

/**
 * GET /api/attendance/history
 * Lấy lịch sử điểm danh
 * Query params: classId (required), startDate (optional), endDate (optional)
 */
router.get('/history',
    [
        query('classId').isInt().withMessage('Class ID không hợp lệ'),
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

            const { classId, startDate, endDate } = req.query;

            // Kiểm tra lớp có tồn tại không
            const classInfo = await classesDB.getById(classId);
            if (!classInfo) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy lớp'
                });
            }

            const sessions = await attendanceSessionsDB.getByClassId(classId, startDate, endDate);

            res.json({
                success: true,
                className: classInfo.name,
                sessions: sessions
            });

        } catch (error) {
            console.error('Error getting attendance history:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi khi lấy lịch sử điểm danh'
            });
        }
    }
);

/**
 * GET /api/attendance/session/:sessionId
 * Lấy chi tiết một buổi điểm danh
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Lấy thông tin session
        const session = await attendanceSessionsDB.getById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy buổi điểm danh'
            });
        }

        // Lấy chi tiết điểm danh
        const records = await attendanceRecordsDB.getBySessionId(sessionId);

        res.json({
            success: true,
            session: {
                id: session.id,
                attendanceDate: session.attendanceDate,
                attendanceType: session.attendanceType,
                className: session.className,
                classId: session.classId
            },
            records: records
        });

    } catch (error) {
        console.error('Error getting session details:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy chi tiết điểm danh'
        });
    }
});

/**
 * DELETE /api/attendance/session/:sessionId
 * Xóa buổi điểm danh
 */
router.delete('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Kiểm tra session có tồn tại không
        const session = await attendanceSessionsDB.getById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy buổi điểm danh'
            });
        }

        // Xóa session (records sẽ tự động xóa do CASCADE)
        await attendanceSessionsDB.delete(sessionId);

        res.json({
            success: true,
            message: 'Đã xóa buổi điểm danh thành công'
        });

    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi xóa buổi điểm danh'
        });
    }
});

export default router;
