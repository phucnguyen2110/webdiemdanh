import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { classesDB, studentsDB } from '../database.js';
import { parseExcelFile, validateExcelFile } from '../utils/excelParser.js';
import { readAllSheets } from '../utils/excelReader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Cấu hình multer để upload file
// Tạo thư mục uploads nếu chưa tồn tại
const uploadsDir = join(__dirname, '..', 'uploads', 'excel');
if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Tạo tên file unique: timestamp_originalname
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

/**
 * POST /api/classes/upload
 * Upload file Excel và tạo lớp mới
 */
router.post('/upload',
    upload.single('file'),
    body('className').trim().notEmpty().withMessage('Tên lớp không được để trống'),
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

            const { className } = req.body;
            const file = req.file;

            // Validate file
            const fileValidation = validateExcelFile(file);
            if (!fileValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: fileValidation.error
                });
            }

            // Parse Excel file from saved file
            let students;
            try {
                const { readFileSync } = await import('fs');
                const fileBuffer = readFileSync(file.path);
                students = parseExcelFile(fileBuffer);
            } catch (error) {
                // Delete uploaded file if parsing fails
                unlinkSync(file.path);
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            // Tạo lớp mới với đường dẫn file
            let classId;
            try {
                classId = await classesDB.create(className, file.path);
            } catch (error) {
                // Delete uploaded file if class creation fails
                unlinkSync(file.path);
                if (error.message.includes('UNIQUE')) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tên lớp đã tồn tại. Vui lòng chọn tên khác.'
                    });
                }
                throw error;
            }

            // Lưu danh sách thiếu nhi
            await studentsDB.createBulk(classId, students);

            res.json({
                success: true,
                classId: classId,
                className: className,
                studentsCount: students.length
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server khi xử lý file'
            });
        }
    }
);

/**
 * GET /api/classes
 * Lấy danh sách tất cả các lớp
 */
router.get('/', async (req, res) => {
    try {
        const classes = await classesDB.getAll();

        res.json({
            success: true,
            classes: classes.map(c => ({
                id: c.id,
                name: c.name,
                studentsCount: c.students_count,
                createdAt: c.created_at
            }))
        });
    } catch (error) {
        console.error('Error getting classes:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy danh sách lớp'
        });
    }
});

/**
 * GET /api/classes/:classId/students
 * Lấy danh sách thiếu nhi trong lớp
 */
router.get('/:classId/students', async (req, res) => {
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

        const students = await studentsDB.getByClassId(classId);

        res.json({
            success: true,
            className: classInfo.name,
            students: students
        });
    } catch (error) {
        console.error('Error getting students:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy danh sách thiếu nhi'
        });
    }
});

/**
 * PUT /api/classes/:classId
 * C?p nh?t t�n l?p
 */
router.put('/:classId',
    body('className').trim().notEmpty().withMessage('T�n l?p kh�ng du?c d? tr?ng'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: errors.array()[0].msg
                });
            }

            const { classId } = req.params;
            const { className } = req.body;

            const classInfo = await classesDB.getById(classId);
            if (!classInfo) {
                return res.status(404).json({
                    success: false,
                    error: 'Kh�ng t�m th?y l?p'
                });
            }

            await classesDB.update(classId, className);

            res.json({
                success: true,
                message: '�� c?p nh?t t�n l?p th�nh c�ng'
            });

        } catch (error) {
            console.error('Error updating class:', error);
            if (error.message.includes('UNIQUE')) {
                return res.status(400).json({
                    success: false,
                    error: 'T�n l?p d� t?n t?i. Vui l�ng ch?n t�n kh�c.'
                });
            }
            res.status(500).json({
                success: false,
                error: 'L?i khi c?p nh?t l?p'
            });
        }
    }
);

/**
 * DELETE /api/classes/:classId
 * Xóa lớp (và tất cả dữ liệu liên quan)
 */
router.delete('/:classId', async (req, res) => {
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

        // Xóa file Excel nếu tồn tại
        if (classInfo.excel_file_path && existsSync(classInfo.excel_file_path)) {
            try {
                unlinkSync(classInfo.excel_file_path);
            } catch (err) {
                console.error('Error deleting Excel file:', err);
            }
        }

        await classesDB.delete(classId);

        res.json({
            success: true,
            message: 'Đã xóa lớp thành công'
        });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi xóa lớp'
        });
    }
});

/**
 * GET /api/classes/:classId/excel
 * Lấy tất cả sheets từ file Excel đã upload
 */
router.get('/:classId/excel', async (req, res) => {
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

        // Kiểm tra file Excel có tồn tại không
        if (!classInfo.excel_file_path) {
            return res.status(404).json({
                success: false,
                error: 'Lớp này không có file Excel'
            });
        }

        if (!existsSync(classInfo.excel_file_path)) {
            return res.status(404).json({
                success: false,
                error: 'File Excel không tồn tại trên server'
            });
        }

        // Đọc tất cả sheets
        const sheets = readAllSheets(classInfo.excel_file_path);

        res.json({
            success: true,
            className: classInfo.name,
            sheets: sheets
        });

    } catch (error) {
        console.error('Error reading Excel file:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi đọc file Excel'
        });
    }
});

export default router;
