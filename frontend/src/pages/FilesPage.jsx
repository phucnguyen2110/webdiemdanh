import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classesAPI, exportAPI, studentsAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import chienConIcon from '../assets/scarves/chien_con.png';
import auNhiIcon from '../assets/scarves/au_nhi.png';
import thieuNhiIcon from '../assets/scarves/thieu_nhi.png';
import nghiaSiIcon from '../assets/scarves/nghia_si.png';
import hiepSiIcon from '../assets/scarves/hiep_si.png';
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
        const match = name.match(/\d+\s*([a-zA-Z]+)/);
        if (match && match[1]) {
            return match[1].toUpperCase().charCodeAt(0);
        }
        return 0;
    };

    return [...classes].sort((a, b) => {
        const weightA = getLevelWeight(a.name);
        const weightB = getLevelWeight(b.name);
        if (weightA !== weightB) return weightA - weightB;

        const numA = getNumber(a.name);
        const numB = getNumber(b.name);
        if (numA !== numB) return numA - numB;

        const subA = getSubClass(a.name);
        const subB = getSubClass(b.name);
        if (subA !== subB) return subA - subB;

        return a.name.localeCompare(b.name);
    });
};

export default function FilesPage() {
    const { isAdmin, canAccessClass, user } = useAuth();
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [teacherMap, setTeacherMap] = useState({});
    const [students, setStudents] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [updateLoading, setUpdateLoading] = useState(null);
    const [exportLoading, setExportLoading] = useState(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [selectedStudentQR, setSelectedStudentQR] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);

    // View Students Modal State
    const [viewClassId, setViewClassId] = useState(null);

    // Edit State
    const [editingClassId, setEditingClassId] = useState(null);
    const [editingClassName, setEditingClassName] = useState('');

    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [matchedClassIds, setMatchedClassIds] = useState(new Set());
    const [matchedStudentIds, setMatchedStudentIds] = useState(new Set());

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        if (isAdmin()) {
            loadTeachers();
        }
    }, [isAdmin]); // Fixed dependency array

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

                    if (classHasMatch || cls.name.toLowerCase().includes(normalizedTerm)) {
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

    const loadTeachers = async () => {
        try {
            const result = await usersAPI.getAll();
            const users = result.users || [];
            const map = {};
            users.forEach(user => {
                if (user.assignedClasses && Array.isArray(user.assignedClasses)) {
                    user.assignedClasses.forEach(classId => {
                        if (!map[classId]) map[classId] = [];
                        map[classId].push(user.fullName || user.username);
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

    const handleViewStudents = async (classId) => {
        setViewClassId(classId);
        await loadStudents(classId);
    };

    const handleStartEdit = (classId, currentName) => {
        setEditingClassId(classId);
        setEditingClassName(currentName);
    };

    const handleSaveEdit = async (classId) => {
        const trimmedName = editingClassName.trim();
        if (!trimmedName) return alert('Tên lớp không được để trống');

        const isDuplicate = classes.some(c => c.id !== classId && c.name.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) return alert(`Tên lớp "${trimmedName}" đã tồn tại.`);

        try {
            setUpdateLoading(classId);
            await classesAPI.update(classId, trimmedName);
            setClasses(prev => sortClassesByName(prev.map(c => c.id === classId ? { ...c, name: trimmedName } : c)));
            setEditingClassId(null);
            setEditingClassName('');
        } catch (err) {
            alert(`Lỗi khi cập nhật: ${err.message}`);
        } finally {
            setUpdateLoading(null);
        }
    };

    const handleDelete = async (classId, className) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"?\n\nDữ liệu sẽ bị xóa vĩnh viễn.`)) return;

        try {
            setDeleteLoading(classId);
            await classesAPI.delete(classId);
            setClasses(prev => prev.filter(c => c.id !== classId));
            if (viewClassId === classId) setViewClassId(null);
        } catch (err) {
            alert(`Lỗi khi xóa lớp: ${err.message}`);
        } finally {
            setDeleteLoading(null);
        }
    };

    const handleExportExcel = async (classId) => {
        try {
            setExportLoading(classId);
            await exportAPI.exportOriginalExcel(classId);
        } catch (err) {
            alert(`Không thể tải file Excel: ${err.message}`);
        } finally {
            setExportLoading(null);
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
        if (!selectedStudentQR?.qrCode) return;

        const className = classes.find(c => c.id === viewClassId)?.name || 'Lớp';
        const studentName = `${selectedStudentQR.baptismalName || ''} ${selectedStudentQR.fullName}`.trim();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            const padding = 40;
            const extraBottom = 200; // Space for text
            const canvasSize = 1000; // High res

            canvas.width = canvasSize;
            canvas.height = canvasSize + extraBottom;

            // Fill white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw QR Code scaled
            ctx.drawImage(img, padding, padding, canvasSize - (padding * 2), canvasSize - (padding * 2));

            // Text configuration
            ctx.font = 'bold 42px Inter, sans-serif';
            ctx.fillStyle = '#111827'; // gray-900
            ctx.textAlign = 'center';

            // Draw Name
            ctx.fillText(studentName, canvasSize / 2, canvasSize + 50);

            // Draw Class Name
            ctx.font = 'bold 40px Inter, sans-serif';
            ctx.fillStyle = '#4B5563'; // gray-600
            ctx.fillText(className, canvasSize / 2, canvasSize + 150);

            // Create download link
            const link = document.createElement('a');
            link.download = `QR_${className}_${studentName}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            link.remove();
        };

        img.crossOrigin = 'anonymous';
        img.src = selectedStudentQR.qrCode;
    };



    // Helper to get class style and icon based on name
    const getClassStyle = (className) => {
        const name = className.toLowerCase();
        if (name.includes('chiên con')) return { bg: 'bg-pink-100', text: 'text-pink-700', iconImg: chienConIcon };
        if (name.includes('ấu nhi')) return { bg: 'bg-green-100', text: 'text-green-700', iconImg: auNhiIcon };
        if (name.includes('thiếu nhi')) return { bg: 'bg-blue-100', text: 'text-blue-700', iconImg: thieuNhiIcon };
        if (name.includes('nghĩa sĩ')) return { bg: 'bg-yellow-100', text: 'text-yellow-700', iconImg: nghiaSiIcon };
        if (name.includes('hiệp sĩ')) return { bg: 'bg-amber-100', text: 'text-amber-900', iconImg: hiepSiIcon };
        if (name.includes('dự trưởng')) return { bg: 'bg-red-100', text: 'text-red-700', icon: 'local_police' };
        if (name.includes('huynh trưởng')) return { bg: 'bg-red-100', text: 'text-red-700', icon: 'supervisor_account' };

        // Fallback for others - cycle using existing logic if needed or just default
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'school' };
    };

    const getTeachers = (classItem) => {
        const fromMap = teacherMap[classItem.id];
        if (fromMap && fromMap.length > 0) return fromMap;
        if (classItem.teacherName) return classItem.teacherName.split(',').map(t => t.trim());
        return [];
    };

    const totalStudents = classes.reduce((sum, cls) => sum + (cls.studentsCount || 0), 0);
    const currentDate = new Date().toLocaleDateString('en-GB');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="mesh-gradient min-h-[calc(100vh-80px)] text-[#140d1c] overflow-hidden flex flex-col relative font-display">
            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto relative scroll-smooth p-4 md:p-8 w-full max-w-[1600px] mx-auto">
                {/* Stats Overview */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
                            Xin chào, {user?.fullName || user?.username || 'User'}! 👋
                        </h2>
                        <p className="text-sm text-gray-500">Hôm nay là {currentDate}. Quản lý các lớp giáo lý của bạn.</p>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 w-full md:max-w-md">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-primary group-focus-within:text-primary-dark">search</span>
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-3 border-none rounded-full bg-white/50 focus:bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all text-sm"
                                placeholder="Tìm kiếm thiếu nhi..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isSearching && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <div className="spinner w-4 h-4 border-2"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Stat Card 1 */}
                    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 bg-gradient-to-br from-primary/10 to-transparent w-32 h-32 rounded-full blur-xl group-hover:bg-primary/20 transition-all"></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                                <span className="material-symbols-outlined text-2xl">school</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Tổng số lớp</p>
                        <h3 className="text-3xl font-black text-gray-800 mt-1">{classes.length}</h3>
                    </div>
                    {/* Stat Card 2 */}
                    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 bg-gradient-to-br from-purple-500/10 to-transparent w-32 h-32 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                                <span className="material-symbols-outlined text-2xl">groups</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Tổng số thiếu nhi</p>
                        <h3 className="text-3xl font-black text-gray-800 mt-1">{totalStudents}</h3>
                    </div>
                    {/* Stat Card 3 - Placeholder for attendance or other metric */}
                    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 bg-gradient-to-br from-pink-500/10 to-transparent w-32 h-32 rounded-full blur-xl group-hover:bg-pink-500/20 transition-all"></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-pink-50 rounded-xl text-pink-600">
                                <span className="material-symbols-outlined text-2xl">calendar_today</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Năm học</p>
                        <h3 className="text-3xl font-black text-gray-800 mt-1">
                            {(() => {
                                const now = new Date();
                                const year = now.getFullYear();
                                const month = now.getMonth() + 1;
                                return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
                            })()}
                        </h3>
                    </div>
                </section>

                {/* Mobile Search Bar */}
                <div className="lg:hidden mb-8">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-primary group-focus-within:text-primary-dark">search</span>
                        </div>
                        <input
                            className="block w-full pl-10 pr-3 py-3 border-none rounded-full bg-white/50 focus:bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all text-sm"
                            placeholder="Tìm kiếm thiếu nhi..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {isSearching && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                <div className="spinner w-4 h-4 border-2"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Classes Grid */}
                <section className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">grid_view</span>
                            Danh sách lớp
                        </h3>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center gap-2 font-medium text-sm"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Thêm lớp mới
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                            <p className="text-red-700">{error}</p>
                        </div>
                    )}

                    {classes.length === 0 ? (
                        <div className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-8">
                            <div className="bg-primary/10 p-6 rounded-full mb-6 text-primary">
                                <span className="material-symbols-outlined text-6xl">folder_open</span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Chưa có lớp nào</h3>
                            <p className="text-gray-500 mb-8 max-w-sm">Bạn chưa tạo lớp nào. Hãy upload file Excel để bắt đầu.</p>
                            <button onClick={() => navigate('/')} className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl shadow-lg shadow-primary/30 transition-all font-semibold flex items-center gap-2">
                                <span className="material-symbols-outlined">add_circle</span>
                                Upload lớp mới
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                            {classes.filter(cls => isClassVisible(cls.id)).map((classItem, index) => {
                                const style = getClassStyle(classItem.name); // Use the new style helper
                                const isEditing = editingClassId === classItem.id;
                                const teachers = getTeachers(classItem);
                                const hasMultipleTeachers = teachers.length > 1;

                                // Calculate filtered matches if search is active
                                const matchedStudents = searchTerm && students[classItem.id]
                                    ? students[classItem.id].filter(s => matchedStudentIds.has(s.id))
                                    : [];
                                const hasMatches = matchedStudents.length > 0;

                                return (
                                    <div key={classItem.id} className="glass-card rounded-2xl p-5 flex flex-col gap-4 group relative h-full">

                                        <div className="flex justify-between items-start">
                                            <div className={`${style.bg} ${style.text} p-2 rounded-lg`}>
                                                {style.iconImg ? (
                                                    <img src={style.iconImg} alt="Icon" className="w-8 h-8 object-contain mix-blend-multiply" />
                                                ) : (
                                                    <span className="material-symbols-outlined">{style.icon}</span>
                                                )}
                                            </div>

                                            {canAccessClass(classItem.id) && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleStartEdit(classItem.id, classItem.name)}
                                                        className="p-1 text-gray-400 hover:text-primary transition-colors rounded hover:bg-gray-100"
                                                        title="Sửa tên"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(classItem.id, classItem.name)}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                                                        title="Xóa lớp"
                                                        disabled={deleteLoading === classItem.id}
                                                    >
                                                        {deleteLoading === classItem.id ?
                                                            <span className="spinner w-4 h-4 border-2"></span> :
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        }
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            {isEditing ? (
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        className="form-input flex-1 py-1 px-2 text-sm"
                                                        value={editingClassName}
                                                        onChange={(e) => setEditingClassName(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(classItem.id);
                                                            if (e.key === 'Escape') setEditingClassId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => handleSaveEdit(classItem.id)} className="text-green-600 hover:text-green-800">
                                                        <span className="material-symbols-outlined">check</span>
                                                    </button>
                                                    <button onClick={() => setEditingClassId(null)} className="text-red-600 hover:text-red-800">
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <h4 className="font-bold text-lg text-gray-800 truncate" title={classItem.name}>
                                                    {classItem.name}
                                                </h4>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                Tạo ngày: {new Date(classItem.createdAt).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>

                                        {/* Search Matches Display */}
                                        {hasMatches && (
                                            <div className="mt-3 bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col gap-3">
                                                {/* Teachers (GLV) Display in Search Mode */}
                                                <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                                                    {(teachers.length > 0 ? teachers : ['Chưa gán']).map((teacher, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <div className="bg-white/80 rounded-full w-6 h-6 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 border border-primary/20">
                                                                {teacher.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-600" title={teacher}>
                                                                {teacher}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <p className="text-xs font-bold text-primary flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">person_search</span>
                                                    Tìm thấy {matchedStudents.length} kết quả
                                                </p>
                                                <div className="flex flex-col gap-1">
                                                    {matchedStudents.map(s => (
                                                        <div key={s.id} className="text-xs text-gray-700 bg-white p-1.5 rounded-md border border-gray-100 shadow-sm flex items-center gap-2 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => {
                                                            handleViewStudents(classItem.id);
                                                        }}>
                                                            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                                                                {s.stt}
                                                            </span>
                                                            <span className="flex-1" title={`${s.baptismalName} ${s.fullName}`}>
                                                                {s.baptismalName} <span className="font-semibold">{s.fullName}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Standard Buttons (hidden if matches found) */}
                                        {!hasMatches && (
                                            <>
                                                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent w-full"></div>

                                                <div className="flex items-center justify-between mt-auto">
                                                    {/* Teachers list */}
                                                    <div className="flex flex-col gap-2 relative z-10 w-full min-w-0 pr-2">
                                                        {(teachers.length > 0 ? teachers : ['Chưa gán']).map((teacher, idx) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                                    {teacher.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-xs font-medium text-gray-600 truncate" title={teacher}>
                                                                    {teacher}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Vertical divider/connector */}
                                                    {hasMultipleTeachers && (
                                                        <div className="w-px self-stretch bg-gray-200 mx-2"></div>
                                                    )}

                                                    <div className="flex flex-col justify-center shrink-0">
                                                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap self-center">
                                                            {classItem.studentsCount} Thiếu Nhi
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => handleViewStudents(classItem.id)}
                                                        className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">visibility</span> Xem
                                                    </button>
                                                    <button
                                                        onClick={() => handleExportExcel(classItem.id)}
                                                        className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-1"
                                                        disabled={exportLoading === classItem.id}
                                                    >
                                                        {exportLoading === classItem.id ? (
                                                            <span className="spinner w-3 h-3 border-2"></span>
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined text-sm">ios_share</span> Excel
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add New Placeholder */}
                            <div
                                onClick={() => navigate('/')}
                                className="border-2 border-dashed border-primary/30 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 bg-white/30 hover:bg-white/50 cursor-pointer transition-all min-h-[220px]"
                            >
                                <div className="bg-primary/10 text-primary p-3 rounded-full">
                                    <span className="material-symbols-outlined">add</span>
                                </div>
                                <p className="font-medium text-primary text-sm">Thêm lớp mới</p>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* View Students Modal */}
            {viewClassId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewClassId(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Danh sách thiếu nhi</h3>
                                <p className="text-sm text-gray-500">Lớp: {classes.find(c => c.id === viewClassId)?.name}</p>
                            </div>
                            <button onClick={() => setViewClassId(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {!students[viewClassId] ? (
                                <div className="flex justify-center p-8">
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {students[viewClassId].filter(s => isStudentVisible(s.id)).map(student => (
                                            <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-primary/30 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                        {student.stt}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-800 text-sm" title={`${student.baptismalName} ${student.fullName}`}>
                                                            {student.baptismalName} {student.fullName}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">{student.studentId}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleShowQR(student)}
                                                    className="p-2 text-gray-400 hover:text-primary hover:bg-white rounded-lg transition-all"
                                                    title="Xem mã QR"
                                                >
                                                    <img src={qrIcon} alt="QR" className="w-5 h-5 opacity-70" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {students[viewClassId].length === 0 && (
                                        <p className="text-center text-gray-500 py-8">Danh sách trống</p>
                                    )}
                                    {students[viewClassId].length > 0 && students[viewClassId].filter(s => isStudentVisible(s.id)).length === 0 && (
                                        <p className="text-center text-gray-500 py-8">Không tìm thấy kết quả phù hợp</p>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button onClick={() => setViewClassId(null)} className="btn btn-secondary">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQrModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 text-center border-b">
                            <h3 className="text-xl font-bold text-gray-800">Mã QR Điểm Danh</h3>
                            {selectedStudentQR && (
                                <div className="mt-1">
                                    <p className="text-sm text-gray-600 font-medium">{selectedStudentQR.baptismalName} {selectedStudentQR.fullName}</p>
                                    <p className="text-sm text-gray-600 font-medium">{classes.find(c => c.id === viewClassId)?.name}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center bg-gray-50">
                            {qrLoading ? (
                                <div className="spinner w-12 h-12 border-4"></div>
                            ) : selectedStudentQR?.qrCode ? (
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                    <img src={selectedStudentQR.qrCode} alt="QR Code" className="w-full max-w-[200px]" />
                                </div>
                            ) : null}
                            <p className="text-xs text-gray-400 mt-4 text-center w-full">Quét mã này để điểm danh</p>
                        </div>

                        <div className="p-4 border-t flex gap-3">
                            <button
                                onClick={handleDownloadQR}
                                className="flex-1 btn btn-primary flex justify-center items-center gap-2"
                                disabled={!selectedStudentQR?.qrCode}
                            >
                                <span className="material-symbols-outlined">download</span> Tải Xuống
                            </button>
                            <button onClick={() => setQrModalOpen(false)} className="flex-1 btn btn-secondary">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
