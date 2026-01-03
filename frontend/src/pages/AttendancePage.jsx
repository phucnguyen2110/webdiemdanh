import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { classesAPI, attendanceAPI } from '../services/api';
import { invalidateCache } from '../utils/excelCache';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';
import { validateAttendance, getValidationHint, getAllowedAttendanceTypes } from '../utils/attendanceValidation';
import './AttendancePage.css';

export default function AttendancePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
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

    // Auto-select valid attendance type when date changes
    useEffect(() => {
        const allowedTypes = getAllowedAttendanceTypes(attendanceDate);
        if (allowedTypes.length > 0 && !allowedTypes.includes(attendanceType)) {
            // Current type is not allowed, select first allowed type
            setAttendanceType(allowedTypes[0]);
        }
    }, [attendanceDate]);

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

            // Clear any previous errors
            setError('');
        } catch (err) {
            // Check if this is an offline error with no cache
            if (err.message.includes('Đã xảy ra lỗi') || err.message.includes('Network')) {
                setError('📴 Chế độ Offline: Chưa có dữ liệu lớp học được lưu. Vui lòng kết nối mạng ít nhất 1 lần để tải danh sách lớp.');
            } else {
                setError('Không thể tải danh sách lớp: ' + err.message);
            }
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
            // Check if this is an offline error with no cache
            if (err.message.includes('Đã xảy ra lỗi') || err.message.includes('Network')) {
                setError('📴 Chế độ Offline: Chưa có dữ liệu thiếu nhi được lưu cho lớp này. Vui lòng kết nối mạng ít nhất 1 lần để tải danh sách.');
            } else {
                setError('Không thể tải danh sách thiếu nhi: ' + err.message);
            }
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

    const setStudentStatus = (studentId, status) => {
        setCheckedStudents(prev => ({
            ...prev,
            [studentId]: status
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

    // Helper function to convert Vietnamese to non-diacritics for backend
    const convertAttendanceType = (type) => {
        const mapping = {
            'Học Giáo Lý': 'Hoc Giao Ly',
            'Lễ Thứ 5': 'Le Thu 5',
            'Lễ Chúa Nhật': 'Le Chua Nhat'
        };
        return mapping[type] || type;
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

        // Validate date and attendance type
        const validation = validateAttendance(attendanceDate, attendanceType);
        if (!validation.valid) {
            setError(validation.error);
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
                attendanceType: convertAttendanceType(attendanceType),
                records,
                attendanceMethod: 'manual'
            });

            // Check if this was saved offline
            if (response.offline) {
                setSuccess(`📴 Đã lưu điểm danh OFFLINE! (${presentCount}/${students.length} thiếu nhi có mặt)\n\n🔄 Dữ liệu sẽ tự động đồng bộ lên hệ thống khi có mạng.\n\n💡 Bạn có thể tiếp tục điểm danh offline, tất cả sẽ được sync sau.`);
            } else {
                // Online save - check Excel write results
                if (response.excelWriteResults && response.excelWriteResults.length > 0) {
                    const successCount = response.excelWriteResults.filter(r => r.success).length;
                    const failCount = response.excelWriteResults.length - successCount;

                    if (failCount === 0) {
                        // All success
                        setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} thiếu nhi có mặt)\n📊 Đã ghi vào Excel thành công!`);
                    } else if (successCount === 0) {
                        // All failed - show only error, not success
                        const formattedDate = formatVietnameseDate(attendanceDate);
                        setError(`❌ Không thể điểm danh thành công do trong file Excel của lớp không có cột điểm danh ${formattedDate} - ${attendanceType}`);
                    } else {
                        // Partial success
                        setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} thiếu nhi có mặt)\n⚠️ Excel: ${successCount}/${response.excelWriteResults.length} thiếu nhi được ghi thành công.`);
                    }
                } else {
                    // No Excel file or no write attempted
                    setSuccess(`✅ Đã lưu điểm danh thành công! (${presentCount}/${students.length} thiếu nhi có mặt)`);
                }
            }

            // Reset checked state only if not error
            if (!error) {
                handleUncheckAll();
            }

            // Invalidate Excel cache for this class (only if online)
            if (!response.offline) {
                invalidateCache(selectedClassId);
                console.log('💾 Excel cache invalidated for class', selectedClassId);
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

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[parts.length - 1][0] + parts[0][0]).toUpperCase();
    };

    const presentCount = Object.values(checkedStudents).filter(Boolean).length;
    const allowedTypes = getAllowedAttendanceTypes(attendanceDate);

    // Dynamic styles
    const colors = {
        primary: '#7f0df2',
        backgroundLight: '#f7f5f8',
        backgroundDark: '#191022',
        glassBorder: 'rgba(255, 255, 255, 0.5)'
    };

    return (
        <div className="flex h-full w-full flex-col relative overflow-hidden bg-[#f7f5f8] dark:bg-[#191022] text-slate-900 dark:text-slate-100 font-sans">
            {/* Ambient Background Blobs */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#7f0df2]/10 blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#a855f7]/10 blur-[80px]"></div>
            </div>

            {/* Header Section */}
            <header className="flex-none p-4 md:p-6 pb-2 z-10">
                <div className="flex flex-col gap-4 md:gap-6">
                    {/* Top Row: Title & Actions */}
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                Điểm Danh Thiếu Nhi
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 text-sm md:text-base">
                                <span className="material-symbols-outlined text-lg">calendar_today</span>
                                {attendanceDate ? formatVietnameseDate(attendanceDate) : 'Chọn ngày'}
                                {selectedClassId && (
                                    <>
                                        <span className="mx-1">•</span>
                                        <span className="material-symbols-outlined text-lg">school</span>
                                        {classes.find(c => c.id.toString() === selectedClassId)?.name || 'Lớp'}
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate('/qr-scanner')}
                                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all border border-slate-200 dark:border-slate-700"
                            >
                                <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                                <span className="hidden sm:inline">QR Scan</span>
                            </button>
                            {students.length > 0 && (
                                <button
                                    onClick={handleCheckAll}
                                    type="button"
                                    className="flex items-center gap-2 h-10 px-4 md:px-5 rounded-xl bg-[#7f0df2]/10 text-[#7f0df2] dark:text-[#a855f7] font-bold text-sm hover:bg-[#7f0df2]/20 transition-all border border-[#7f0df2]/20"
                                >
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    <span className="hidden sm:inline">Có Mặt Tất Cả</span>
                                    <span className="inline sm:hidden">Tất Cả</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Controls Row (Glassmorphic Container) */}
                    <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-end gap-4 shadow-sm z-20">
                        {/* Class Select */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Lớp Học</label>
                            <div className="relative group">
                                <select
                                    className="w-full h-11 pl-4 pr-10 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-[#7f0df2]/50 focus:border-[#7f0df2] transition-all appearance-none cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 outline-none"
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">-- Chọn lớp --</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.name} ({cls.studentsCount} thiếu nhi)
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* Date Picker */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Ngày</label>
                            <div className="relative group">
                                <input
                                    type="date"
                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-[#7f0df2]/50 focus:border-[#7f0df2] transition-all cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 outline-none"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    disabled={loading}
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">event</span>
                                </div>
                            </div>
                        </div>

                        {/* Session Select (Attendance Type) */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Loại Điểm Danh</label>
                            <div className="relative group">
                                <select
                                    className="w-full h-11 pl-4 pr-10 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-[#7f0df2]/50 focus:border-[#7f0df2] transition-all appearance-none cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 outline-none"
                                    value={attendanceType}
                                    onChange={(e) => setAttendanceType(e.target.value)}
                                    disabled={loading || allowedTypes.length === 0}
                                >
                                    {allowedTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                    {allowedTypes.length === 0 && (
                                        <option value="">-- Ngày không hợp lệ --</option>
                                    )}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined">expand_more</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </header>

            {/* Scrollable Student List */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 pb-24 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 custom-scrollbar z-0" id="student-list">
                {/* Feedback Messages */}
                {error && (
                    <div className="glass-card rounded-xl p-4 bg-red-50/50 border-l-4 border-red-500 text-red-700 mb-4 animate-fade-in flex items-start gap-3 col-span-full">
                        <span className="material-symbols-outlined text-red-500">error</span>
                        <div>{error}</div>
                    </div>
                )}
                {success && (
                    <div className="glass-card rounded-xl p-4 bg-green-50/50 border-l-4 border-full-green text-green-700 mb-4 animate-fade-in flex items-start gap-3 col-span-full">
                        <span className="material-symbols-outlined text-green-600">check_circle</span>
                        <div className="whitespace-pre-line">{success}</div>
                    </div>
                )}

                {loadingStudents ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 col-span-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7f0df2] mb-4"></div>
                        <p>Đang tải danh sách...</p>
                    </div>
                ) : students.length > 0 ? (
                    students.map((student) => (
                        <div key={student.id} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-4 group hover:bg-white/60 dark:hover:bg-slate-800/70 transition-all duration-300">
                            {/* Student Info */}
                            <div className="flex items-center gap-4 w-full">
                                <div className="size-12 rounded-full bg-[#7f0df2]/10 flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-600 shadow-sm text-[#7f0df2] font-bold text-lg">
                                    {getInitials(student.fullName)}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#7f0df2] transition-colors">
                                        {student.stt}. {student.baptismalName} {student.fullName}
                                    </h3>
                                    {/* <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full w-fit">
                                        ID: {student.id}
                                    </span> */}
                                </div>
                            </div>

                            {/* Status Controls */}
                            <div className="flex items-center justify-between w-full gap-4">
                                <div className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 w-full justify-center">
                                    <label className="cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            className="peer sr-only"
                                            name={`status-${student.id}`}
                                            checked={!!checkedStudents[student.id]}
                                            onChange={() => setStudentStatus(student.id, true)}
                                        />
                                        <div className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${checkedStudents[student.id] ? 'bg-[#7f0df2] text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50'}`}>
                                            <span className="material-symbols-outlined text-[18px] hidden sm:block">check</span>
                                            Có mặt
                                        </div>
                                    </label>
                                    <label className="cursor-pointer flex-1">
                                        <input
                                            type="radio"
                                            className="peer sr-only"
                                            name={`status-${student.id}`}
                                            checked={!checkedStudents[student.id]}
                                            onChange={() => setStudentStatus(student.id, false)}
                                        />
                                        <div className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${!checkedStudents[student.id] ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50'}`}>
                                            <span className="material-symbols-outlined text-[18px] hidden sm:block">close</span>
                                            Vắng
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    ))
                ) : selectedClassId ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 col-span-full">
                        <span className="material-symbols-outlined text-4xl mb-2">school</span>
                        <p>Không có thiếu nhi trong lớp này</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60 col-span-full">
                        <span className="material-symbols-outlined text-6xl mb-4">arrow_upward</span>
                        <p>Chọn lớp để bắt đầu điểm danh</p>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Bar */}
            <div className={`absolute bottom-0 w-full glass-panel border-t border-white/50 dark:border-white/10 px-4 md:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-transform duration-300 ${students.length > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="flex gap-4 md:gap-6 text-sm font-medium w-full md:w-auto justify-center md:justify-start">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="size-2 rounded-full bg-slate-400"></span>
                        <span>Tổng: <span className="font-bold">{students.length}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-[#7f0df2]">
                        <span className="size-2 rounded-full bg-[#7f0df2]"></span>
                        <span>Có mặt: <span className="font-bold">{presentCount}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-500">
                        <span className="size-2 rounded-full bg-rose-500"></span>
                        <span>Vắng: <span className="font-bold">{students.length - presentCount}</span></span>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading || presentCount === 0}
                    className="w-full md:w-auto px-8 h-12 rounded-xl bg-[#7f0df2] disabled:bg-slate-300 hover:bg-[#5e0ab5] text-white font-bold shadow-lg shadow-[#7f0df2]/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <span className="material-symbols-outlined">save</span>
                    )}
                    {loading ? 'Đang lưu...' : 'Lưu Điểm Danh'}
                </button>
            </div>
        </div>
    );
}
