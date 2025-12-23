import { useState, useEffect } from 'react';
import { classesAPI, attendanceAPI, exportAPI } from '../services/api';

export default function HistoryPage() {
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetails, setSessionDetails] = useState(null);

    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    // Load danh sách lớp
    useEffect(() => {
        loadClasses();
    }, []);

    // Load lịch sử khi chọn lớp
    useEffect(() => {
        if (selectedClassId) {
            loadHistory(selectedClassId);
        } else {
            setSessions([]);
            setSelectedSession(null);
            setSessionDetails(null);
        }
    }, [selectedClassId]);

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
            setClasses(transformedClasses);
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
                            <h2 className="card-title">📊 Lịch Sử Điểm Danh</h2>
                            <p className="card-subtitle">Xem lại các buổi điểm danh đã lưu</p>
                        </div>
                        <button
                            className="btn btn-success"
                            onClick={handleExport}
                            disabled={!selectedClassId || exporting || sessions.length === 0}
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

                {/* Info note - Chỉ lưu điểm danh thủ công */}
                <div style={{
                    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-lg)',
                    border: '1px solid #90caf9',
                    display: 'flex',
                    alignItems: 'start',
                    gap: 'var(--spacing-sm)'
                }}>
                    <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>ℹ️</div>
                    <div>
                        <strong style={{ color: '#1565c0', display: 'block', marginBottom: 'var(--spacing-xs)' }}>
                            Lưu ý về lịch sử điểm danh
                        </strong>
                        <p style={{
                            color: '#1976d2',
                            fontSize: 'var(--font-size-sm)',
                            margin: 0,
                            lineHeight: '1.5'
                        }}>
                            Trang này chỉ hiển thị lịch sử điểm danh thủ công. Điểm danh bằng QR Code không được lưu vào lịch sử.
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
                                                    gap: 'var(--spacing-md)'
                                                }}
                                            >
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
            </div>
        </div>
    );
}
