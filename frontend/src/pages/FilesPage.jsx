import { useState, useEffect } from 'react';
import { classesAPI, exportAPI, studentsAPI, isPotentiallyColdStart } from '../services/api';
import qrIcon from '../assets/qr-icon.png';
import SmartLoading from '../components/SmartLoading';

export default function FilesPage() {
    const [classes, setClasses] = useState([]);
    const [expandedClassId, setExpandedClassId] = useState(null);
    const [students, setStudents] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [editingClassId, setEditingClassId] = useState(null);
    const [editingClassName, setEditingClassName] = useState('');
    const [updateLoading, setUpdateLoading] = useState(null);
    const [exportLoading, setExportLoading] = useState(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [selectedStudentQR, setSelectedStudentQR] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Load all classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            setLoading(true);
            setError('');
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
            setError(err.message);
        } finally {
            setLoading(false);
            setIsFirstLoad(false);
        }
    };

    const loadStudents = async (classId) => {
        if (students[classId]) {
            // Already loaded
            return;
        }

        try {
            const result = await classesAPI.getStudents(classId);
            setStudents(prev => ({
                ...prev,
                [classId]: result.students || []
            }));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleToggleExpand = async (classId) => {
        if (expandedClassId === classId) {
            setExpandedClassId(null);
        } else {
            setExpandedClassId(classId);
            await loadStudents(classId);
        }
    };

    const handleStartEdit = (classId, currentName) => {
        setEditingClassId(classId);
        setEditingClassName(currentName);
    };

    const handleCancelEdit = () => {
        setEditingClassId(null);
        setEditingClassName('');
    };

    const handleSaveEdit = async (classId) => {
        const trimmedName = editingClassName.trim();

        if (!trimmedName) {
            alert('Tên lớp không được để trống');
            return;
        }

        // Check if class name already exists (case-insensitive)
        const isDuplicate = classes.some(c =>
            c.id !== classId && c.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (isDuplicate) {
            alert(`Tên lớp "${trimmedName}" đã tồn tại. Vui lòng chọn tên khác.`);
            return;
        }

        try {
            setUpdateLoading(classId);
            await classesAPI.update(classId, trimmedName);

            // Update state
            setClasses(prev => prev.map(c =>
                c.id === classId ? { ...c, name: trimmedName } : c
            ));

            setEditingClassId(null);
            setEditingClassName('');
        } catch (err) {
            // Handle backend errors
            const errorMessage = err.message || 'Đã xảy ra lỗi';
            if (errorMessage.toLowerCase().includes('duplicate') ||
                errorMessage.toLowerCase().includes('exists') ||
                errorMessage.toLowerCase().includes('đã tồn tại')) {
                alert(`Tên lớp "${trimmedName}" đã tồn tại. Vui lòng chọn tên khác.`);
            } else {
                alert(`Lỗi khi cập nhật: ${errorMessage}`);
            }
        } finally {
            setUpdateLoading(null);
        }
    };

    const handleExportExcel = async (classId, className) => {
        try {
            setExportLoading(classId);
            await exportAPI.exportOriginalExcel(classId);
        } catch (err) {
            setError(`Không thể tải file Excel: ${err.message}`);
        } finally {
            setExportLoading(null);
        }
    };

    const handleDelete = async (classId, className) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"?\n\nToàn bộ dữ liệu thiếu nhi và điểm danh của lớp này sẽ bị xóa vĩnh viễn.`)) {
            return;
        }

        try {
            setDeleteLoading(classId);
            await classesAPI.delete(classId);

            // Remove from state
            setClasses(prev => prev.filter(c => c.id !== classId));
            setStudents(prev => {
                const newStudents = { ...prev };
                delete newStudents[classId];
                return newStudents;
            });

            if (expandedClassId === classId) {
                setExpandedClassId(null);
            }
        } catch (err) {
            alert(`Lỗi khi xóa lớp: ${err.message}`);
        } finally {
            setDeleteLoading(null);
        }
    };

    const handleShowQR = async (student) => {
        try {
            setQrLoading(true);
            setQrModalOpen(true);
            const response = await studentsAPI.getQR(student.id);
            setSelectedStudentQR({
                ...student,
                qrCode: response.qrCode
            });
        } catch (err) {
            alert(`Lỗi khi tạo mã QR: ${err.message}`);
            setQrModalOpen(false);
        } finally {
            setQrLoading(false);
        }
    };

    const handleDownloadQR = () => {
        if (!selectedStudentQR || !selectedStudentQR.qrCode) return;

        // Create a canvas to draw QR code with text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size (QR code + text area)
        const qrSize = 400;
        const textHeight = 100;
        canvas.width = qrSize;
        canvas.height = qrSize + textHeight;

        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Load and draw QR code image
        const img = new Image();
        img.onload = () => {
            // Draw QR code
            ctx.drawImage(img, 0, 0, qrSize, qrSize);

            // Draw text below QR code
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';

            // Get class name
            const classItem = classes.find(c =>
                students[c.id]?.some(s => s.id === selectedStudentQR.id)
            );
            const className = classItem ? classItem.name : '';

            // Line 1: Baptismal Name + Full Name
            ctx.font = 'bold 20px Arial';
            const studentName = `${selectedStudentQR.baptismalName || ''} ${selectedStudentQR.fullName}`.trim();
            ctx.fillText(studentName, qrSize / 2, qrSize + 35);

            // Line 2: Class Name
            if (className) {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#666';
                ctx.fillText(className, qrSize / 2, qrSize + 65);
            }

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `QR_${selectedStudentQR.baptismalName || ''}_${selectedStudentQR.fullName}_${className}.png`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            });
        };

        img.src = selectedStudentQR.qrCode;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="container" style={{ paddingTop: '2rem', textAlign: 'center' }}>
                <div className="spinner" style={{ width: '3rem', height: '3rem', margin: '2rem auto' }}></div>
                <p>Đang tải danh sách lớp...</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📚 Quản Lý Lớp Học</h2>
                    <p className="card-subtitle">Xem và quản lý tất cả các lớp đã upload</p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ margin: 'var(--spacing-lg)' }}>
                        {error}
                    </div>
                )}

                {classes.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-gray-400)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>📂</div>
                        <p>Chưa có lớp nào được tạo</p>
                        <p style={{ fontSize: 'var(--font-size-sm)' }}>
                            Hãy upload file Excel để tạo lớp mới
                        </p>
                    </div>
                ) : (
                    <div style={{ padding: 'var(--spacing-lg)' }}>
                        <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-gray-500)' }}>
                            Tổng số: <strong>{classes.length}</strong> lớp
                        </div>

                        {classes.map(classItem => (
                            <div
                                key={classItem.id}
                                style={{
                                    border: '1px solid var(--color-gray-200)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--spacing-md)',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Class Header */}
                                <div
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        background: expandedClassId === classItem.id ? 'var(--color-gray-50)' : 'white',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--spacing-sm)',
                                        cursor: 'pointer',
                                        flexWrap: 'wrap'
                                    }}
                                    onClick={() => handleToggleExpand(classItem.id)}
                                >
                                    <div style={{ flex: 1 }}>
                                        {editingClassId === classItem.id ? (
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={editingClassName}
                                                onChange={(e) => setEditingClassName(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveEdit(classItem.id);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                                autoFocus
                                                style={{ marginBottom: 'var(--spacing-xs)' }}
                                            />
                                        ) : (
                                            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-xs)' }}>
                                                {classItem.name}
                                            </h3>
                                        )}
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)' }}>
                                            <span>👥 {classItem.studentsCount} thiếu nhi</span>
                                            <span style={{ margin: '0 var(--spacing-sm)' }}>•</span>
                                            <span>📅 {formatDate(classItem.createdAt)}</span>
                                        </div>
                                    </div>

                                    {/* Buttons Container - Responsive */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 'var(--spacing-xs)',
                                        flexWrap: 'wrap',
                                        alignItems: 'center'
                                    }}>
                                        {editingClassId === classItem.id ? (
                                            <>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveEdit(classItem.id);
                                                    }}
                                                    disabled={updateLoading === classItem.id}
                                                >
                                                    {updateLoading === classItem.id ? (
                                                        <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                                                    ) : (
                                                        '💾 Lưu'
                                                    )}
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancelEdit();
                                                    }}
                                                    style={{ background: 'var(--color-gray-200)' }}
                                                >
                                                    ❌ Hủy
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEdit(classItem.id, classItem.name);
                                                    }}
                                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                                >
                                                    ✏️<span className="mobile-hide"> Sửa</span>
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(classItem.id, classItem.name);
                                                    }}
                                                    disabled={deleteLoading === classItem.id}
                                                >
                                                    {deleteLoading === classItem.id ? (
                                                        <span className="spinner" style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }}></span>
                                                    ) : (
                                                        <>🗑️<span className="mobile-hide"> Xóa</span></>
                                                    )}
                                                </button>
                                                <button
                                                    className="btn btn-success btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleExportExcel(classItem.id, classItem.name);
                                                    }}
                                                    disabled={exportLoading === classItem.id}
                                                >
                                                    {exportLoading === classItem.id ? (
                                                        <span className="spinner" style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }}></span>
                                                    ) : (
                                                        <>📥<span className="mobile-hide"> Tải file Excel</span></>
                                                    )}
                                                </button>
                                            </>
                                        )}

                                        {/* Expand arrow */}
                                        <div style={{
                                            fontSize: '1.25rem',
                                            color: 'var(--color-gray-400)',
                                            marginLeft: 'var(--spacing-xs)'
                                        }}>
                                            {expandedClassId === classItem.id ? '▼' : '▶'}
                                        </div>
                                    </div>
                                </div>

                                {/* Student List (Expanded) */}
                                {expandedClassId === classItem.id && (
                                    <div style={{
                                        padding: 'var(--spacing-lg)',
                                        background: 'var(--color-gray-50)',
                                        borderTop: '1px solid var(--color-gray-200)'
                                    }}>
                                        {students[classItem.id] ? (
                                            <>
                                                <h4 style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-base)' }}>
                                                    Danh sách thiếu nhi:
                                                </h4>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                                    gap: 'var(--spacing-sm)',
                                                    maxHeight: '400px',
                                                    overflowY: 'auto',
                                                    padding: 'var(--spacing-sm)',
                                                    background: 'white',
                                                    borderRadius: 'var(--radius-md)'
                                                }}>
                                                    {students[classItem.id].map(student => (
                                                        <div
                                                            key={student.id}
                                                            style={{
                                                                padding: 'var(--spacing-sm)',
                                                                background: 'var(--color-gray-50)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                fontSize: 'var(--font-size-sm)',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <div>
                                                                <span style={{ fontWeight: '500', color: 'var(--color-gray-500)' }}>
                                                                    {student.stt}.
                                                                </span>{' '}
                                                                {student.baptismalName} {student.fullName}
                                                            </div>
                                                            <button
                                                                onClick={() => handleShowQR(student)}
                                                                className="btn btn-sm"
                                                                style={{
                                                                    padding: '0.25rem 0.5rem',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                title="Xem mã QR"
                                                            >
                                                                <img src={qrIcon} alt="QR" style={{ width: '20px', height: '20px' }} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                                <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto' }}></div>
                                                <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-gray-500)' }}>
                                                    Đang tải danh sách...
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* QR Code Modal */}
            {qrModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setQrModalOpen(false)}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: '400px',
                            width: '90%',
                            textAlign: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-header">
                            <h3 className="card-title">📱 Mã QR Điểm Danh</h3>
                            {selectedStudentQR && (
                                <p className="card-subtitle">
                                    {selectedStudentQR.baptismalName} {selectedStudentQR.fullName}
                                </p>
                            )}
                        </div>

                        <div style={{ padding: 'var(--spacing-xl)' }}>
                            {qrLoading ? (
                                <div style={{ padding: '3rem' }}>
                                    <span className="spinner"></span>
                                    <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tạo mã QR...</p>
                                </div>
                            ) : selectedStudentQR?.qrCode ? (
                                <>
                                    <img
                                        src={selectedStudentQR.qrCode}
                                        alt="QR Code"
                                        style={{
                                            width: '100%',
                                            maxWidth: '300px',
                                            border: '2px solid var(--color-gray-200)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-md)'
                                        }}
                                    />
                                    <p style={{
                                        marginTop: 'var(--spacing-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-gray-500)'
                                    }}>
                                        Quét mã này để điểm danh
                                    </p>
                                </>
                            ) : null}
                        </div>

                        <div style={{
                            padding: 'var(--spacing-lg)',
                            borderTop: '1px solid var(--color-gray-200)',
                            display: 'flex',
                            gap: 'var(--spacing-md)'
                        }}>
                            <button
                                onClick={handleDownloadQR}
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!selectedStudentQR?.qrCode}
                            >
                                📥 Tải Xuống
                            </button>
                            <button
                                onClick={() => setQrModalOpen(false)}
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
