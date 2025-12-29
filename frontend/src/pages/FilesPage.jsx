import { useState, useEffect } from 'react';
import { classesAPI, exportAPI, studentsAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import qrIcon from '../assets/qr-icon.png';

const sortClassesByName = (classes) => {
    const getLevelWeight = (name) => {
        const n = name.toLowerCase();
        if (n.includes('chiên con')) return 1;
        if (n.includes('ấu nhi')) return 2;
        if (n.includes('thiếu nhi')) return 3;
        if (n.includes('nghĩa sĩ')) return 4;
        if (n.includes('hiệp sĩ')) return 5;
        if (n.includes('dự trưởng')) return 6;
        if (n.includes('huynh trưởng')) return 7;
        return 99; // Other
    };

    const getNumber = (name) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    const getSubClass = (name) => {
        // Matches number followed by letter(s), capturing the letter
        // e.g. "1A" -> "A", "2B" -> "B"
        const match = name.match(/\d+\s*([a-zA-Z]+)/);
        if (match && match[1]) {
            return match[1].toUpperCase().charCodeAt(0);
        }
        return 0;
    };

    return [...classes].sort((a, b) => {
        // 1. Sort by Level (Chien Con, Au Nhi, etc.)
        const weightA = getLevelWeight(a.name);
        const weightB = getLevelWeight(b.name);
        if (weightA !== weightB) return weightA - weightB;

        // 2. Sort by Grade Number (1, 2, 3...)
        const numA = getNumber(a.name);
        const numB = getNumber(b.name);
        if (numA !== numB) return numA - numB;

        // 3. Sort by Sub-class Letter (A, B, C...)
        const subA = getSubClass(a.name);
        const subB = getSubClass(b.name);
        if (subA !== subB) return subA - subB;

        // 4. Final fallback to string comparison
        return a.name.localeCompare(b.name);
    });
};

export default function FilesPage() {
    const { isAdmin, canAccessClass } = useAuth();
    const [classes, setClasses] = useState([]);
    const [teacherMap, setTeacherMap] = useState({});
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

    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [matchedClassIds, setMatchedClassIds] = useState(new Set());
    const [matchedStudentIds, setMatchedStudentIds] = useState(new Set());

    // Load all classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    // If Admin, load users to map teachers to classes
    useEffect(() => {
        if (isAdmin()) {
            loadTeachers();
        }
    }, [isAdmin()]);

    // Handle search when term changes with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim()) {
                performSearch(searchTerm);
            } else {
                setMatchedClassIds(new Set());
                setMatchedStudentIds(new Set());
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, classes]);

    const performSearch = async (term) => {
        if (!term.trim() || classes.length === 0) return;

        setIsSearching(true);
        const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

        try {
            const newMatchedClassIds = new Set();
            const newMatchedStudentIds = new Set();

            const chunkSize = 3;
            for (let i = 0; i < classes.length; i += chunkSize) {
                const chunk = classes.slice(i, i + chunkSize);

                await Promise.all(chunk.map(async (cls) => {
                    let classStudents = students[cls.id];

                    if (!classStudents) {
                        try {
                            const res = await classesAPI.getStudents(cls.id);
                            classStudents = res.students || [];
                            setStudents(prev => ({ ...prev, [cls.id]: classStudents }));
                        } catch (err) {
                            console.error(`Failed to fetch students for class ${cls.name}`, err);
                            classStudents = [];
                        }
                    }

                    let classHasMatch = false;
                    classStudents.forEach(s => {
                        const name = s.name || s.fullName || '';
                        const baptismal = s.baptismalName || '';
                        const id = s.studentId || '';

                        const isMatch = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").includes(normalizedTerm) ||
                            baptismal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").includes(normalizedTerm) ||
                            id.toLowerCase().includes(normalizedTerm);

                        if (isMatch) {
                            newMatchedStudentIds.add(s.id);
                            classHasMatch = true;
                        }
                    });

                    if (classHasMatch) {
                        newMatchedClassIds.add(cls.id);
                    }
                }));
            }

            setMatchedClassIds(newMatchedClassIds);
            setMatchedStudentIds(newMatchedStudentIds);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const isClassVisible = (classId) => {
        if (!searchTerm.trim()) return true;
        return matchedClassIds.has(classId);
    };

    const isStudentVisible = (studentId) => {
        if (!searchTerm.trim()) return true;
        return matchedStudentIds.has(studentId);
    };

    const shouldExpandClass = (classId) => {
        if (searchTerm.trim() && matchedClassIds.has(classId)) return true;
        return expandedClassId === classId;
    };

    const loadTeachers = async () => {
        try {
            const result = await usersAPI.getAll();
            const users = result.users || [];
            const map = {};
            users.forEach(user => {
                if (user.assignedClasses && Array.isArray(user.assignedClasses)) {
                    user.assignedClasses.forEach(classId => {
                        map[classId] = user.fullName || user.username;
                    });
                }
            });
            setTeacherMap(map);
        } catch (err) {
            console.error('Failed to load teachers map:', err);
        }
    };

    const loadClasses = async () => {
        try {
            setLoading(true);
            setError('');
            const result = await classesAPI.getAll();
            const transformedClasses = (result.classes || []).map(cls => ({
                id: cls.id,
                name: cls.name,
                createdAt: cls.created_at,
                studentsCount: cls.students_count,
                teacherName: cls.teacher_name || cls.teacherName
            }));
            setClasses(sortClassesByName(transformedClasses));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setIsFirstLoad(false);
        }
    };

    const loadStudents = async (classId) => {
        if (students[classId]) return;
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
            setClasses(prev => sortClassesByName(prev.map(c =>
                c.id === classId ? { ...c, name: trimmedName } : c
            )));
            setEditingClassId(null);
            setEditingClassName('');
        } catch (err) {
            const errorMessage = err.message || 'Đã xảy ra lỗi';
            if (errorMessage.toLowerCase().includes('duplicate') ||
                errorMessage.toLowerCase().includes('exists')) {
                alert(`Tên lớp "${trimmedName}" đã tồn tại. Vui lòng chọn tên khác.`);
            } else {
                alert(`Lỗi khi cập nhật: ${errorMessage}`);
            }
        } finally {
            setUpdateLoading(null);
        }
    };

    const handleExportExcel = async (classId) => {
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
            setClasses(prev => prev.filter(c => c.id !== classId));
            setStudents(prev => {
                const newStudents = { ...prev };
                delete newStudents[classId];
                return newStudents;
            });
            if (expandedClassId === classId) setExpandedClassId(null);
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
            setSelectedStudentQR({ ...student, qrCode: response.qrCode });
        } catch (err) {
            alert(`Lỗi khi tạo mã QR: ${err.message}`);
            setQrModalOpen(false);
        } finally {
            setQrLoading(false);
        }
    };

    const handleDownloadQR = () => {
        if (!selectedStudentQR || !selectedStudentQR.qrCode) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const qrSize = 400;
        const textHeight = 100;
        canvas.width = qrSize;
        canvas.height = qrSize + textHeight;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, qrSize, qrSize);
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            const classItem = classes.find(c =>
                students[c.id]?.some(s => s.id === selectedStudentQR.id)
            );
            const className = classItem ? classItem.name : '';
            ctx.font = 'bold 20px Arial';
            const studentName = `${selectedStudentQR.baptismalName || ''} ${selectedStudentQR.fullName}`.trim();
            ctx.fillText(studentName, qrSize / 2, qrSize + 35);
            if (className) {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#666';
                ctx.fillText(className, qrSize / 2, qrSize + 65);
            }
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
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
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
                <div className="card-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <h2 className="card-title">📚 Quản Lý Lớp Học</h2>
                        <p className="card-subtitle">Xem và quản lý tất cả các lớp đã upload</p>
                    </div>

                    {/* Search Bar */}
                    <div style={{ flexGrow: 1, maxWidth: '400px', position: 'relative' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Tìm thiếu nhi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                paddingRight: '40px',
                                marginBottom: 0
                            }}
                        />
                        {isSearching && (
                            <div className="spinner" style={{
                                width: '1.2rem',
                                height: '1.2rem',
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                borderWidth: '2px',
                                borderTopColor: 'var(--color-primary)'
                            }}></div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ margin: 'var(--spacing-lg)' }}>
                        {error}
                    </div>
                )}

                {/* Main List */}
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
                        {!searchTerm && (
                            <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-gray-500)' }}>
                                Tổng số: <strong>{classes.length}</strong> lớp
                            </div>
                        )}

                        {searchTerm && matchedClassIds.size === 0 && !isSearching && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-500)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>�</div>
                                Không tìm thấy kết quả nào cho "{searchTerm}"
                            </div>
                        )}

                        {classes.filter(cls => isClassVisible(cls.id)).map(classItem => (
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
                                        background: shouldExpandClass(classItem.id) ? 'var(--color-gray-50)' : 'white',
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
                                                    if (e.key === 'Enter') handleSaveEdit(classItem.id);
                                                    else if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                autoFocus
                                                style={{ marginBottom: 'var(--spacing-xs)' }}
                                            />
                                        ) : (
                                            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-xs)' }}>
                                                {classItem.name}
                                                {(classItem.teacherName || teacherMap[classItem.id]) && (
                                                    <span>{' - '}{classItem.teacherName || teacherMap[classItem.id]}</span>
                                                )}
                                            </h3>
                                        )}
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)' }}>
                                            <span>👥 {classItem.studentsCount} thiếu nhi</span>
                                            <span style={{ margin: '0 var(--spacing-sm)' }}>•</span>
                                            <span>📅 {formatDate(classItem.createdAt)}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {editingClassId === classItem.id ? (
                                            <>
                                                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleSaveEdit(classItem.id); }} disabled={updateLoading === classItem.id}>
                                                    {updateLoading === classItem.id ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span> : '💾 Lưu'}
                                                </button>
                                                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }} style={{ background: 'var(--color-gray-200)' }}>❌ Hủy</button>
                                            </>
                                        ) : (
                                            canAccessClass(classItem.id) && (
                                                <>
                                                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleStartEdit(classItem.id, classItem.name); }} style={{ background: 'var(--color-primary)', color: 'white' }}>
                                                        ✏️<span className="mobile-hide"> Sửa</span>
                                                    </button>
                                                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(classItem.id, classItem.name); }} disabled={deleteLoading === classItem.id}>
                                                        {deleteLoading === classItem.id ? <span className="spinner" style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }}></span> : <>🗑️<span className="mobile-hide"> Xóa</span></>}
                                                    </button>
                                                    <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleExportExcel(classItem.id); }} disabled={exportLoading === classItem.id}>
                                                        {exportLoading === classItem.id ? <span className="spinner" style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }}></span> : <>📥<span className="mobile-hide"> Tải file Excel</span></>}
                                                    </button>
                                                </>
                                            )
                                        )}
                                        <div style={{ fontSize: '1.25rem', color: 'var(--color-gray-400)', marginLeft: 'var(--spacing-xs)' }}>
                                            {shouldExpandClass(classItem.id) ? '▼' : '▶'}
                                        </div>
                                    </div>
                                </div>

                                {shouldExpandClass(classItem.id) && (
                                    <div style={{ padding: 'var(--spacing-lg)', background: 'var(--color-gray-50)', borderTop: '1px solid var(--color-gray-200)' }}>
                                        {students[classItem.id] ? (
                                            <>
                                                <h4 style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-base)' }}>Danh sách thiếu nhi:</h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--spacing-sm)', maxHeight: '400px', overflowY: 'auto', padding: 'var(--spacing-sm)', background: 'white', borderRadius: 'var(--radius-md)' }}>
                                                    {students[classItem.id]
                                                        .filter(student => isStudentVisible(student.id))
                                                        .map(student => (
                                                            <div key={student.id} style={{ padding: 'var(--spacing-sm)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <span style={{ fontWeight: '500', color: 'var(--color-gray-500)' }}>{student.stt}.</span> {student.baptismalName} {student.fullName}
                                                                </div>
                                                                <button onClick={() => handleShowQR(student)} className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Xem mã QR">
                                                                    <img src={qrIcon} alt="QR" style={{ width: '20px', height: '20px' }} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {students[classItem.id].length > 0 && students[classItem.id].filter(s => isStudentVisible(s.id)).length === 0 && (
                                                        <div style={{ fontStyle: 'italic', color: 'var(--color-gray-500)', padding: '1rem' }}>Không tìm thấy thiếu nhi nào trong lớp này khớp với từ khóa.</div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                                                <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto' }}></div>
                                                <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-gray-500)' }}>Đang tải danh sách...</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {qrModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setQrModalOpen(false)}>
                    <div className="card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div className="card-header">
                            <h3 className="card-title">📱 Mã QR Điểm Danh</h3>
                            {selectedStudentQR && <p className="card-subtitle">{selectedStudentQR.baptismalName} {selectedStudentQR.fullName}</p>}
                        </div>
                        <div style={{ padding: 'var(--spacing-xl)' }}>
                            {qrLoading ? (
                                <div style={{ padding: '3rem' }}>
                                    <span className="spinner"></span>
                                    <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tạo mã QR...</p>
                                </div>
                            ) : selectedStudentQR?.qrCode ? (
                                <>
                                    <img src={selectedStudentQR.qrCode} alt="QR Code" style={{ width: '100%', maxWidth: '300px', border: '2px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)' }} />
                                    <p style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)' }}>Quét mã này để điểm danh</p>
                                </>
                            ) : null}
                        </div>
                        <div style={{ padding: 'var(--spacing-lg)', borderTop: '1px solid var(--color-gray-200)', display: 'flex', gap: 'var(--spacing-md)' }}>
                            <button onClick={handleDownloadQR} className="btn btn-primary" style={{ flex: 1 }} disabled={!selectedStudentQR?.qrCode}>📥 Tải Xuống</button>
                            <button onClick={() => setQrModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
