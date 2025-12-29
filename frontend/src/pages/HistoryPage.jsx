import { useState, useEffect } from 'react';
import { classesAPI, attendanceAPI, gradesAPI, exportAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';

export default function HistoryPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'grades'
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');

    // Attendance states
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetails, setSessionDetails] = useState(null);

    // Grades states
    const [gradesHistory, setGradesHistory] = useState([]);

    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    // Load danh sách lớp
    useEffect(() => {
        loadClasses();
    }, []);

    // Load lịch sử khi chọn lớp hoặc đổi tab
    useEffect(() => {
        if (selectedClassId) {
            if (activeTab === 'attendance') {
                loadHistory(selectedClassId);
            } else {
                loadGradesHistory(selectedClassId);
            }
        } else {
            setSessions([]);
            setGradesHistory([]);
            setSelectedSession(null);
            setSessionDetails(null);
        }
    }, [selectedClassId, activeTab]);

    const loadClasses = async () => {
        try {
            const result = await classesAPI.getAll();
            // Transform snake_case to camelCase
            const transformedClasses = (result.classes || []).map(cls => ({
                id: cls.id,
                name: cls.name,
                createdAt: cls.created_at,
                studentsCount: cls.students_count
            }));

            // Filter classes by user permission
            const filteredClasses = filterClassesByPermission(transformedClasses, user, false);
            setClasses(filteredClasses);
        } catch (err) {
            setError('Không thể tải danh sách lớp: ' + err.message);
        }
    };

    const loadHistory = async (classId) => {
        setLoading(true);
        setError('');
        try {
            const result = await attendanceAPI.getHistory(classId);
            setSessions(result.sessions);
        } catch (err) {
            setError('Không thể tải lịch sử điểm danh: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadGradesHistory = async (classId) => {
        setLoading(true);
        setError('');
        try {
            const result = await gradesAPI.getHistory(classId);
            setGradesHistory(result.history || []);
        } catch (err) {
            setError('Không thể tải lịch sử điểm: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadSessionDetails = async (sessionId) => {
        setLoadingDetails(true);
        setError('');
        try {
            const result = await attendanceAPI.getSession(sessionId);
            setSessionDetails(result);
            setSelectedSession(sessionId);
        } catch (err) {
            setError('Không thể tải chi tiết buổi điểm danh: ' + err.message);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation(); // Prevent triggering loadSessionDetails

        if (!window.confirm('Bạn có chắc chắn muốn xóa buổi điểm danh này?')) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            await attendanceAPI.deleteSession(sessionId);

            // Refresh session list
            await loadHistory(selectedClassId);

            // Clear details if deleted session was selected
            if (selectedSession === sessionId) {
                setSelectedSession(null);
                setSessionDetails(null);
            }
        } catch (err) {
            setError('Không thể xóa buổi điểm danh: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStudentAttendance = async (sessionId, studentId, studentName, event) => {
        event.stopPropagation();

        if (!window.confirm(`Bạn có chắc chắn muốn xóa điểm danh của em "${studentName}"?`)) {
            return;
        }

        try {
            await attendanceAPI.deleteStudentAttendance(sessionId, studentId);

            // Cập nhật UI local: Chuyển trạng thái sang Vắng (isPresent = false) thay vì xóa khỏi list
            setSessionDetails(prev => ({
                ...prev,
                records: prev.records.map(r =>
                    r.studentId === studentId ? { ...r, isPresent: false } : r
                )
            }));

            // Reload count ở list bên ngoài
            loadHistory(selectedClassId);

        } catch (err) {
            alert('Lỗi xóa điểm danh: ' + err.message);
        }
    };

    const handleExport = async () => {
        if (!selectedClassId) {
            setError('Vui lòng chọn lớp');
            return;
        }

        setExporting(true);
        setError('');
        try {
            await exportAPI.exportClass(selectedClassId);
        } catch (err) {
            setError('Không thể export dữ liệu: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    // Helper function to convert backend format to Vietnamese display
    const formatAttendanceType = (type) => {
        const mapping = {
            'Hoc Giao Ly': 'Học Giáo Lý',
            'Le Thu 5': 'Lễ Thứ 5',
            'Le Chua Nhat': 'Lễ Chúa Nhật'
        };
        return mapping[type] || type;
    };

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card">
                <div className="card-header">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="card-title">📊 Lịch Sử</h2>
                            <p className="card-subtitle">Xem lại lịch sử điểm danh và điểm số</p>
                        </div>
                        <button
                            className="btn btn-success"
                            onClick={handleExport}
                            disabled={!selectedClassId || exporting || (activeTab === 'attendance' && sessions.length === 0)}
                        >
                            {exporting ? (
                                <>
                                    <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                                    Đang export...
                                </>
                            ) : (
                                <>
                                    📥 Tải file Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    borderBottom: '2px solid var(--color-gray-200)',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'attendance' ? '3px solid var(--color-primary)' : '3px solid transparent',
                            color: activeTab === 'attendance' ? 'var(--color-primary)' : 'var(--color-gray-600)',
                            fontWeight: activeTab === 'attendance' ? '600' : '400',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            fontSize: 'var(--font-size-base)'
                        }}
                    >
                        ✅ Điểm danh
                    </button>
                    <button
                        onClick={() => setActiveTab('grades')}
                        style={{
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'grades' ? '3px solid var(--color-primary)' : '3px solid transparent',
                            color: activeTab === 'grades' ? 'var(--color-primary)' : 'var(--color-gray-600)',
                            fontWeight: activeTab === 'grades' ? '600' : '400',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            fontSize: 'var(--font-size-base)',
                            display: 'none' // Hidden
                        }}
                    >
                        📝 Điểm số
                    </button>
                </div>

                {/* Info note */}
                <div style={{
                    background: activeTab === 'attendance'
                        ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
                        : 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-lg)',
                    border: activeTab === 'attendance' ? '1px solid #90caf9' : '1px solid #ffb74d',
                    display: 'flex',
                    alignItems: 'start',
                    gap: 'var(--spacing-sm)'
                }}>
                    <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>ℹ️</div>
                    <div>
                        <strong style={{
                            color: activeTab === 'attendance' ? '#1565c0' : '#e65100',
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)'
                        }}>
                            {activeTab === 'attendance' ? 'Lịch sử điểm danh' : 'Lịch sử điểm số'}
                        </strong>
                        <p style={{
                            color: activeTab === 'attendance' ? '#1976d2' : '#f57c00',
                            fontSize: 'var(--font-size-sm)',
                            margin: 0,
                            lineHeight: '1.5'
                        }}>
                            {activeTab === 'attendance'
                                ? 'Trang này hiển thị tất cả lịch sử điểm danh (cả thủ công và quét mã QR). Bạn có thể xem chi tiết và xóa các buổi điểm danh.'
                                : 'Xem lịch sử các lần chỉnh sửa điểm (M, 1T, Thi) cho từng lớp và học kỳ.'
                            }
                        </p>
                    </div>
                </div>

                {/* Chọn lớp */}
                <div className="form-group">
                    <label htmlFor="classSelect" className="form-label">
                        Chọn lớp
                    </label>
                    <select
                        id="classSelect"
                        className="form-select"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                        <option value="">-- Chọn lớp --</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name} ({cls.studentsCount} thiếu nhi)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Error message */}
                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                {/* Content based on active tab */}
                {activeTab === 'attendance' ? (
                    // ATTENDANCE HISTORY
                    <>
                        {/* Danh sách buổi điểm danh */}
                        {loading ? (
                            <div className="loading-container">
                                <span className="spinner"></span>
                                <p>Đang tải lịch sử...</p>
                            </div>
                        ) : sessions.length > 0 ? (
                            <div className="grid grid-2">
                                {/* Danh sách sessions */}
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                                        Các buổi điểm danh ({sessions.length})
                                    </h3>
                                    <div style={{
                                        maxHeight: '600px',
                                        overflowY: 'auto',
                                        border: '2px solid var(--color-gray-100)',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        {sessions.map((session) => (
                                            <div
                                                key={session.id}
                                                onClick={() => loadSessionDetails(session.id)}
                                                style={{
                                                    padding: 'var(--spacing-md)',
                                                    borderBottom: '1px solid var(--color-gray-100)',
                                                    cursor: 'pointer',
                                                    background: selectedSession === session.id ? 'var(--color-primary-light)' : 'transparent',
                                                    transition: 'background var(--transition-fast)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (selectedSession !== session.id) {
                                                        e.currentTarget.style.background = 'var(--color-gray-50)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (selectedSession !== session.id) {
                                                        e.currentTarget.style.background = 'transparent';
                                                    }
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '600', marginBottom: 'var(--spacing-xs)' }}>
                                                        {formatDate(session.attendanceDate)}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginBottom: 'var(--spacing-xs)' }}>
                                                        {formatAttendanceType(session.attendanceType)}
                                                    </div>
                                                    <div style={{
                                                        fontSize: 'var(--font-size-sm)',
                                                        color: 'var(--color-gray-600)',
                                                        marginBottom: 'var(--spacing-xs)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-xs)'
                                                    }}>
                                                        {session.attendanceMethod === 'qr' ? '📱 Quét mã QR' : '✍️ Thủ công'}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)' }}>
                                                        <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>
                                                            {session.presentCount}
                                                        </span>
                                                        <span style={{ color: 'var(--color-gray-400)' }}>
                                                            {' / '}{session.totalCount} thiếu nhi
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-danger)',
                                                        cursor: 'pointer',
                                                        fontSize: 'var(--font-size-xl)',
                                                        padding: 'var(--spacing-sm)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        transition: 'background var(--transition-fast)'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-danger-light)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    title="Xóa buổi điểm danh"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Chi tiết session */}
                                <div>
                                    {loadingDetails ? (
                                        <div className="loading-container">
                                            <span className="spinner"></span>
                                            <p>Đang tải chi tiết...</p>
                                        </div>
                                    ) : sessionDetails ? (
                                        <>
                                            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                                                Chi tiết buổi điểm danh
                                            </h3>
                                            <div style={{
                                                padding: 'var(--spacing-lg)',
                                                background: 'var(--color-gray-50)',
                                                borderRadius: 'var(--radius-md)',
                                                marginBottom: 'var(--spacing-md)'
                                            }}>
                                                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                                    <strong>Ngày:</strong> {formatDate(sessionDetails.session.attendanceDate)}
                                                </div>
                                                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                                    <strong>Loại:</strong> {formatAttendanceType(sessionDetails.session.attendanceType)}
                                                </div>
                                                <div>
                                                    <strong>Lớp:</strong> {sessionDetails.session.className}
                                                </div>
                                            </div>

                                            <div style={{
                                                maxHeight: '500px',
                                                overflowY: 'auto',
                                                border: '2px solid var(--color-gray-100)',
                                                borderRadius: 'var(--radius-md)'
                                            }}>
                                                {sessionDetails.records.map((record) => (
                                                    <div
                                                        key={record.id}
                                                        style={{
                                                            padding: 'var(--spacing-md)',
                                                            borderBottom: '1px solid var(--color-gray-100)',
                                                            background: record.isPresent ? 'var(--color-success-light)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: 'var(--spacing-md)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                            <span style={{
                                                                fontSize: 'var(--font-size-xl)',
                                                                width: '1.5rem'
                                                            }}>
                                                                {record.isPresent ? '✅' : '❌'}
                                                            </span>
                                                            <span>
                                                                <strong>{record.stt}.</strong> {record.baptismalName ? `${record.baptismalName} ` : ''}{record.fullName}
                                                            </span>
                                                        </div>
                                                        {record.isPresent && (
                                                            <button
                                                                onClick={(e) => handleDeleteStudentAttendance(sessionDetails.session.id, record.studentId, record.fullName, e)}
                                                                className="btn btn-sm btn-danger"
                                                                style={{
                                                                    padding: '0.25rem 0.5rem',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                                title="Xóa lượt điểm danh này"
                                                            >
                                                                🗑️ Xóa
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{
                                            padding: 'var(--spacing-3xl)',
                                            textAlign: 'center',
                                            color: 'var(--color-gray-400)'
                                        }}>
                                            👈 Chọn một buổi điểm danh để xem chi tiết
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : selectedClassId ? (
                            <div className="alert alert-warning">
                                Chưa có buổi điểm danh nào cho lớp này
                            </div>
                        ) : null}
                    </>
                ) : (
                    // GRADES HISTORY
                    <>
                        {loading ? (
                            <div className="loading-container">
                                <span className="spinner"></span>
                                <p>Đang tải lịch sử điểm...</p>
                            </div>
                        ) : gradesHistory.length > 0 ? (
                            <div style={{
                                overflowX: 'auto',
                                border: '2px solid var(--color-gray-100)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-gray-100)' }}>
                                            <th style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'left',
                                                fontWeight: '600'
                                            }}>Thời gian</th>
                                            <th style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'left',
                                                fontWeight: '600'
                                            }}>Học kỳ</th>
                                            <th style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'left',
                                                fontWeight: '600'
                                            }}>Người sửa</th>
                                            <th style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center',
                                                fontWeight: '600',
                                                width: '100px'
                                            }}>Số TN</th>
                                            <th style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center',
                                                fontWeight: '600'
                                            }}>Thay đổi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradesHistory.map((entry, index) => (
                                            <tr key={index} style={{
                                                background: index % 2 === 0 ? 'white' : '#fafafa'
                                            }}>
                                                <td style={{
                                                    padding: 'var(--spacing-md)',
                                                    border: '1px solid var(--color-gray-200)'
                                                }}>
                                                    {new Date(entry.createdAt || entry.created_at).toLocaleString('vi-VN')}
                                                </td>
                                                <td style={{
                                                    padding: 'var(--spacing-md)',
                                                    border: '1px solid var(--color-gray-200)'
                                                }}>{entry.semester || 'HK I'}</td>
                                                <td style={{
                                                    padding: 'var(--spacing-md)',
                                                    border: '1px solid var(--color-gray-200)'
                                                }}>{entry.editorName || entry.editor_name || 'Admin'}</td>
                                                <td style={{
                                                    padding: 'var(--spacing-md)',
                                                    border: '1px solid var(--color-gray-200)',
                                                    textAlign: 'center',
                                                    fontWeight: '600'
                                                }}>{entry.gradesCount || entry.grades_count || 0}</td>
                                                <td style={{
                                                    padding: 'var(--spacing-md)',
                                                    border: '1px solid var(--color-gray-200)',
                                                    textAlign: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        {entry.hasM && <span style={{
                                                            padding: '2px 8px',
                                                            background: '#e3f2fd',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: '#1976d2'
                                                        }}>M</span>}
                                                        {entry.has1T && <span style={{
                                                            padding: '2px 8px',
                                                            background: '#fff3e0',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: '#f57c00'
                                                        }}>1T</span>}
                                                        {entry.hasThi && <span style={{
                                                            padding: '2px 8px',
                                                            background: '#f3e5f5',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            color: '#7b1fa2'
                                                        }}>Thi</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : selectedClassId ? (
                            <div className="alert alert-warning">
                                Chưa có lịch sử điểm nào cho lớp này
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
