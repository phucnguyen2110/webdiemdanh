import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Khởi tạo database
const dbPath = join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Promisify database operations
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

/**
 * Khởi tạo database schema
 */
export async function initializeDatabase() {
  // Enable foreign keys
  await run('PRAGMA foreign_keys = ON');

  // Tạo bảng classes (lớp học)
  await run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      excel_file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tạo bảng students (thiếu nhi)
  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      stt INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    )
  `);

  // Tạo bảng attendance_sessions (buổi điểm danh)
  await run(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      attendance_date DATE NOT NULL,
      attendance_type TEXT NOT NULL CHECK(attendance_type IN ('Học Giáo Lý', 'Lễ Thứ 5', 'Lễ Chúa Nhật')),
      attendance_method TEXT DEFAULT 'manual' CHECK(attendance_method IN ('manual', 'qr')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    )
  `);

  // Tạo bảng attendance_records (chi tiết điểm danh)
  await run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      is_present BOOLEAN NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add attendance_method column if it doesn't exist
  try {
    await run(`
      ALTER TABLE attendance_sessions 
      ADD COLUMN attendance_method TEXT DEFAULT 'manual' CHECK(attendance_method IN ('manual', 'qr'))
    `);
    console.log('✅ Migration: Added attendance_method column');
  } catch (err) {
    // Column already exists, ignore error
    if (!err.message.includes('duplicate column name')) {
      console.error('Migration warning:', err.message);
    }
  }

  // Tạo indexes để tăng tốc query
  await run('CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id)');
  await run('CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(attendance_date)');
  await run('CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id)');

  console.log('✅ Database initialized successfully');
}

/**
 * Database helper functions
 */

// Classes
export const classesDB = {
  // Tạo lớp mới
  create: async (name, excelFilePath = null) => {
    const result = await run(
      'INSERT INTO classes (name, excel_file_path) VALUES (?, ?)',
      [name, excelFilePath]
    );
    return result.lastID;
  },

  // Lấy tất cả lớp
  getAll: async () => {
    const rows = await all(`
      SELECT 
        c.id,
        c.name,
        c.created_at,
        COUNT(s.id) as students_count
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return rows;
  },

  // Lấy lớp theo ID
  getById: async (id) => {
    return await get('SELECT * FROM classes WHERE id = ?', [id]);
  },

  // Cập nhật tên lớp
  update: async (id, name) => {
    return await run('UPDATE classes SET name = ? WHERE id = ?', [name, id]);
  },

  // Xóa lớp
  delete: async (id) => {
    return await run('DELETE FROM classes WHERE id = ?', [id]);
  }
};

// Students
export const studentsDB = {
  // Tạo nhiều học sinh cùng lúc (bulk insert)
  createBulk: async (classId, students) => {
    await run('BEGIN TRANSACTION');
    try {
      for (const student of students) {
        await run(
          'INSERT INTO students (class_id, stt, baptismal_name, full_name, date_of_birth) VALUES (?, ?, ?, ?, ?)',
          [classId, student.stt, student.baptismalName, student.fullName, student.dateOfBirth]
        );
      }
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  },

  // Lấy tất cả học sinh trong lớp
  getByClassId: async (classId) => {
    return await all(`
      SELECT id, stt, baptismal_name as baptismalName, full_name as fullName, date_of_birth as dateOfBirth
      FROM students
      WHERE class_id = ?
      ORDER BY stt ASC
    `, [classId]);
  },

  // Lấy thông tin một học sinh
  getById: async (studentId) => {
    return await get(`
      SELECT id, class_id as classId, stt, baptismal_name as baptismalName, full_name as fullName, date_of_birth as dateOfBirth
      FROM students
      WHERE id = ?
    `, [studentId]);
  },

  // Xóa tất cả học sinh trong lớp
  deleteByClassId: async (classId) => {
    return await run('DELETE FROM students WHERE class_id = ?', [classId]);
  }
};

// Attendance Sessions
export const attendanceSessionsDB = {
  // Tạo buổi điểm danh mới
  create: async (classId, attendanceDate, attendanceType, attendanceMethod = 'manual') => {
    const result = await run(`
      INSERT INTO attendance_sessions (class_id, attendance_date, attendance_type, attendance_method)
      VALUES (?, ?, ?, ?)
    `, [classId, attendanceDate, attendanceType, attendanceMethod]);
    return result.lastID;
  },

  // Lấy lịch sử điểm danh theo lớp
  getByClassId: async (classId, startDate = null, endDate = null) => {
    let query = `
      SELECT 
        s.id,
        s.attendance_date as attendanceDate,
        s.attendance_type as attendanceType,
        s.created_at as createdAt,
        COUNT(CASE WHEN r.is_present = 1 THEN 1 END) as presentCount,
        COUNT(r.id) as totalCount
      FROM attendance_sessions s
      LEFT JOIN attendance_records r ON s.id = r.session_id
      WHERE s.class_id = ? AND s.attendance_method = 'manual'
    `;

    const params = [classId];

    if (startDate) {
      query += ' AND s.attendance_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND s.attendance_date <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY s.id ORDER BY s.attendance_date DESC';

    return await all(query, params);
  },

  // Lấy chi tiết buổi điểm danh
  getById: async (sessionId) => {
    return await get(`
      SELECT 
        s.id,
        s.attendance_date as attendanceDate,
        s.attendance_type as attendanceType,
        s.created_at as createdAt,
        c.name as className,
        c.id as classId
      FROM attendance_sessions s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ?
    `, [sessionId]);
  },

  // Xóa session (records sẽ tự động xóa do ON DELETE CASCADE)
  delete: async (sessionId) => {
    return await run('DELETE FROM attendance_sessions WHERE id = ?', [sessionId]);
  }
};

// Attendance Records
export const attendanceRecordsDB = {
  // Tạo nhiều bản ghi điểm danh cùng lúc
  createBulk: async (sessionId, records) => {
    await run('BEGIN TRANSACTION');
    try {
      for (const record of records) {
        await run(`
          INSERT INTO attendance_records (session_id, student_id, is_present)
          VALUES (?, ?, ?)
        `, [sessionId, record.studentId, record.isPresent ? 1 : 0]);
      }
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  },

  // Lấy chi tiết điểm danh theo session
  getBySessionId: async (sessionId) => {
    return await all(`
      SELECT 
        r.id,
        r.student_id as studentId,
        r.is_present as isPresent,
        st.stt,
        st.baptismal_name as baptismalName,
        st.full_name as fullName
      FROM attendance_records r
      JOIN students st ON r.student_id = st.id
      WHERE r.session_id = ?
      ORDER BY st.stt ASC
    `, [sessionId]);
  }
};

export default db;
