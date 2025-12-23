import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classesAPI, attendanceAPI } from '../services/api';

export default function AttendancePage() {
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [students, setStudents] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [attendanceType, setAttendanceType] = useState('Học Giáo Lý');
    const [checkedStudents, setCheckedStudents] = useState({});

    const [loading, setLoading] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load danh sách lớp khi component mount
    useEffect(() => {
        loadClasses();
    }, []);

    // Clear messages when date or attendance type changes
    useEffect(() => {
        setSuccess('');
        setError('');
    }, [attendanceDate, attendanceType]);

    // Load danh sách thiếu nhi khi chọn lớp
    useEffect(() => {
        if (selectedClassId) {
            loadStudents(selectedClassId);
        } else {
            setStudents([]);
            setCheckedStudents({});
        }
    }, [selectedClassId]);

    const loadClasses = async () => {
        try {
            const result = await classesAPI.getAll();
            setClasses(result.classes);
        } catch (err) {
            setError('Không thể tải danh sách lớp: ' + err.message);
        }
    };

    const loadStudents = async (classId) => {
        setLoadingStudents(true);
        setError('');
        try {
            const result = await classesAPI.getStudents(classId);
            setStudents(result.students);

            // Initialize all students as unchecked
            const initialChecked = {};
            result.students.forEach(student => {
                initialChecked[student.id] = false;
            });
            setCheckedStudents(initialChecked);
        } catch (err) {
            setError('Không thể tải danh sách thiếu nhi: ' + err.message);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleCheckboxChange = (studentId) => {
        setCheckedStudents(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    const handleCheckAll = () => {
        const allChecked = {};
        students.forEach(student => {
            allChecked[student.id] = true;
        });
        setCheckedStudents(allChecked);
    };

    const handleUncheckAll = () => {
        const allUnchecked = {};
        students.forEach(student => {
            allUnchecked[student.id] = false;
        });
        setCheckedStudents(allUnchecked);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedClassId) {
            setError('Vui lòng chọn lớp');
            return;
        }

        if (students.length === 0) {
            setError('Không có thiếu nhi để điểm danh');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Tạo records array
            const records = students.map(student => ({
                studentId: student.id,
                isPresent: checkedStudents[student.id] || false
            }));

            const presentCount = records.filter(r => r.isPresent).length;

            const response = await attendanceAPI.save({
                classId: parseInt(selectedClassId),
                attendanceDate,
                attendanceType,
                records,
                attendanceMethod: 'manual'
            });

            // Check Excel write results
            if (response.excelWriteResults && response.excelWriteResults.length > 0) {
                const successCount = response.excelWriteResults.filter(r => r.success).length;
                const failCount = response.excelWriteResults.length - successCount;

                if (failCount === 0) {
                    // All success
                    setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} em có mặt)\n📊 Đã ghi vào Excel thành công!`);
                } else if (successCount === 0) {
                    // All failed - show only error, not success
                    const formattedDate = formatVietnameseDate(attendanceDate);
                    setError(`❌ Không thể điểm danh thành công do trong file Excel của lớp không có cột điểm danh ${formattedDate} - ${attendanceType}`);
                } else {
                    // Partial success
                    setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} em có mặt)\n⚠️ Excel: ${successCount}/${response.excelWriteResults.length} em được ghi thành công.`);
                }
            } else {
                // No Excel file or no write attempted
                setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} em có mặt)`);
            }

            // Reset checked state only if not error
            if (!error) {
                handleUncheckAll();
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatVietnameseDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return `${days[date.getDay()]}, ${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
    };

    const presentCount = Object.values(checkedStudents).filter(Boolean).length;

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 className="card-title">✅ Điểm Danh Thiếu Nhi</h2>
                        <p className="card-subtitle">Chọn lớp và đánh dấu các em có mặt</p>
                    </div>
                    <button
                        onClick={() => navigate('/qr-scanner')}
                        className="btn btn-primary"
                        type="button"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        📱 Điểm Danh QR
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Chọn lớp, ngày, loại */}
                    <div className="grid grid-2">
                        <div className="form-group">
                            <label htmlFor="classSelect" className="form-label">
                                Lớp <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <select
                                id="classSelect"
                                className="form-select"
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">-- Chọn lớp --</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name} ({cls.studentsCount} em)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="attendanceDate" className="form-label">
                                Ngày điểm danh <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <input
                                type="date"
                                id="attendanceDate"
                                className="form-input"
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                                disabled={loading}
                            />
                            {attendanceDate && (
                                <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-primary)',
                                    marginTop: 'var(--spacing-xs)',
                                    fontWeight: '500'
                                }}>
                                    📅 {formatVietnameseDate(attendanceDate)}
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="attendanceType" className="form-label">
                                Loại điểm danh <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <select
                                id="attendanceType"
                                className="form-select"
                                value={attendanceType}
                                onChange={(e) => setAttendanceType(e.target.value)}
                                disabled={loading}
                            >
                                <option value="Học Giáo Lý">Học Giáo Lý</option>
                                <option value="Lễ Thứ 5">Lễ Thứ 5</option>
                                <option value="Lễ Chúa Nhật">Lễ Chúa Nhật</option>
                            </select>
                        </div>
                    </div>

                    {/* Danh sách thiếu nhi */}
                    {loadingStudents ? (
                        <div className="loading-container">
                            <span className="spinner"></span>
                            <p>Đang tải danh sách thiếu nhi...</p>
                        </div>
                    ) : students.length > 0 ? (
                        <>
                            {/* Quick actions */}
                            <div className="flex gap-md" style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={handleCheckAll}
                                    disabled={loading}
                                >
                                    ✓ Có mặt tất cả
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleUncheckAll}
                                    disabled={loading}
                                >
                                    ✗ Bỏ chọn tất cả
                                </button>
                                <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
                                    <span style={{ color: 'var(--color-success)' }}>{presentCount}</span>
                                    <span style={{ color: 'var(--color-gray-400)' }}> / {students.length}</span>
                                </div>
                            </div>

                            {/* Students list */}
                            <div style={{
                                maxHeight: '500px',
                                overflowY: 'auto',
                                border: '2px solid var(--color-gray-100)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-lg)'
                            }}>
                                {students.map((student) => (
                                    <label
                                        key={student.id}
                                        className="checkbox-group"
                                        style={{
                                            borderBottom: '1px solid var(--color-gray-100)',
                                            background: checkedStudents[student.id] ? 'var(--color-success-light)' : 'transparent'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox-input"
                                            checked={checkedStudents[student.id] || false}
                                            onChange={() => handleCheckboxChange(student.id)}
                                            disabled={loading}
                                        />
                                        <span className="checkbox-label">
                                            <strong>{student.stt}.</strong> {student.baptismalName} {student.fullName}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    ) : selectedClassId ? (
                        <div className="alert alert-warning">
                            Không có thiếu nhi trong lớp này
                        </div>
                    ) : null}

                    {/* Error message */}
                    {error && (
                        <div className="alert alert-danger">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="alert alert-success" style={{ whiteSpace: 'pre-line' }}>
                            {success}
                        </div>
                    )}

                    {/* Submit button */}
                    {students.length > 0 && (
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading || presentCount === 0}
                            style={{ width: '100%' }}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    💾 Lưu điểm danh {presentCount > 0 ? `(${presentCount} em)` : ''}
                                </>
                            )}
                        </button>
                    )}

                    {/* Hint message when no students selected */}
                    {students.length > 0 && presentCount === 0 && !loading && !success && !error && (
                        <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-md)' }}>
                            ⚠️ Vui lòng chọn ít nhất 1 em để lưu điểm danh
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
