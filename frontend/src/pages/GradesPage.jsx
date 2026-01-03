import { useState, useEffect } from 'react';
import { classesAPI, gradesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';

export default function GradesPage() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [semester, setSemester] = useState('HK1');
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    // Load students when class changes
    useEffect(() => {
        if (selectedClassId) {
            loadStudentsAndGrades();
        }
    }, [selectedClassId, semester]);

    const loadClasses = async () => {
        try {
            const result = await classesAPI.getAll();
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
            setError(err.message);
        }
    };

    const loadStudentsAndGrades = async () => {
        setLoading(true);
        setError('');
        try {
            // Load students
            console.log('🔍 Fetching students for classId:', selectedClassId);
            const studentsResult = await classesAPI.getStudents(selectedClassId);

            // BE returns array directly or in .students field
            const studentsList = Array.isArray(studentsResult) ? studentsResult : (studentsResult.students || []);

            // Transform to ensure consistent structure
            const transformedStudents = studentsList.map(student => {
                // Remove STT prefix from displayName (e.g. "1. Teresa..." -> "Teresa...")
                let cleanName = student.displayName || student.fullName || student.name || 'Unknown';

                // Remove pattern like "1. ", "2. ", etc.
                cleanName = cleanName.replace(/^\d+\.\s*/, '');

                return {
                    id: student.id,
                    studentId: student.studentId,
                    name: cleanName,
                    fullName: student.fullName,
                    baptismalName: student.baptismalName,
                    displayName: student.displayName,
                    dateOfBirth: student.dateOfBirth
                };
            });

            setStudents(transformedStudents);

            // Load existing grades
            const gradesResult = await gradesAPI.getByClass(selectedClassId, semester);
            const existingGrades = gradesResult.grades || [];

            // Map grades to students
            const gradesMap = {};
            existingGrades.forEach(grade => {
                gradesMap[grade.studentId] = {
                    gradeM: grade.gradeM || grade.grade_m || '',
                    grade1T: grade.grade1T || grade.grade_1t || '',
                    gradeThi: grade.gradeThi || grade.grade_thi || ''
                };
            });

            // Initialize grades for all students
            transformedStudents.forEach(student => {
                if (!gradesMap[student.id]) {
                    gradesMap[student.id] = {
                        gradeM: '',
                        grade1T: '',
                        gradeThi: ''
                    };
                }
            });
            setGrades(gradesMap);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGradeChange = (studentId, gradeType, value) => {
        // Validate: empty or number 0-10
        if (value !== '' && (isNaN(value) || parseFloat(value) < 0 || parseFloat(value) > 10)) {
            return;
        }

        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [gradeType]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Prepare data
            const gradesData = students.map(student => ({
                studentId: student.id,
                studentName: student.name,
                gradeM: grades[student.id]?.gradeM ? parseFloat(grades[student.id].gradeM) : null,
                grade1T: grades[student.id]?.grade1T ? parseFloat(grades[student.id].grade1T) : null,
                gradeThi: grades[student.id]?.gradeThi ? parseFloat(grades[student.id].gradeThi) : null
            }));

            // Save to API
            await gradesAPI.save({
                classId: selectedClassId,
                semester: semester,
                grades: gradesData
            });

            setSuccess('Lưu điểm thành công!');

            // Reload grades
            setTimeout(() => {
                loadStudentsAndGrades();
                setSuccess('');
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Calculate statistics
    const calculateStats = () => {
        if (students.length === 0) return { avg: 0, highest: 0, missing: 0 };

        let totalStudentAvgs = 0;
        let countStudents = 0;
        let highestAvg = 0;
        let missingCount = 0;

        students.forEach(student => {
            const sGrades = grades[student.id] || { gradeM: '', grade1T: '', gradeThi: '' };

            // Check missing (thiếu ít nhất 1 cột điểm)
            const isMissing = !sGrades.gradeM || !sGrades.grade1T || !sGrades.gradeThi;
            if (isMissing) {
                missingCount++;
            }

            // Calculate student average with weighted formula
            // Missing grades treated as 0
            const m = parseFloat(sGrades.gradeM) || 0;
            const t = parseFloat(sGrades.grade1T) || 0;
            const thi = parseFloat(sGrades.gradeThi) || 0;

            // Formula: (Thi*3 + 1T*2 + M*1) / 6
            const studentAvg = (thi * 3 + t * 2 + m) / 6;

            totalStudentAvgs += studentAvg;
            countStudents++;

            if (studentAvg > highestAvg) {
                highestAvg = studentAvg;
            }
        });

        return {
            avg: countStudents > 0 ? (totalStudentAvgs / countStudents).toFixed(2) : 0,
            highest: highestAvg.toFixed(2),
            missing: missingCount
        };
    };

    const stats = calculateStats();

    // Get initials for avatar
    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Get avatar color based on index
    const getAvatarColor = (index) => {
        const colors = [
            'from-blue-100 to-blue-200 text-blue-700',
            'from-purple-100 to-purple-200 text-purple-700',
            'from-orange-100 to-orange-200 text-orange-700',
            'from-pink-100 to-pink-200 text-pink-700',
            'from-teal-100 to-teal-200 text-teal-700',
            'from-green-100 to-green-200 text-green-700',
            'from-indigo-100 to-indigo-200 text-indigo-700',
            'from-red-100 to-red-200 text-red-700'
        ];
        return colors[index % colors.length];
    };

    // Calculate average for a student
    const calculateStudentAverage = (studentId) => {
        const studentGrades = grades[studentId];
        if (!studentGrades) return '0.0';

        const m = parseFloat(studentGrades.gradeM) || 0;
        const t = parseFloat(studentGrades.grade1T) || 0;
        const thi = parseFloat(studentGrades.gradeThi) || 0;

        // Formula: (Thi*3 + 1T*2 + M*1) / 6
        const avg = (thi * 3 + t * 2 + m) / 6;

        return avg.toFixed(2);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50">
            {/* Background Decoration Gradient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-400/5 blur-[120px]"></div>
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[100px]"></div>
                <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-purple-400/10 blur-[100px]"></div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                {/* Header & Filters */}
                <header className="flex-shrink-0 px-8 py-6 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">📝 Quản Lý Điểm</h1>
                            <p className="text-gray-500 text-sm mt-1">Quản lý và ghi nhận điểm số cho thiếu nhi trong học kỳ.</p>
                        </div>
                        {/* Date/Time info */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/50 px-3 py-1.5 rounded-full border border-white/40 backdrop-blur-sm">
                            <span className="material-symbols-outlined text-lg">schedule</span>
                            <span>{new Date().toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>

                    {/* Control Bar: Selectors & Quick Stats */}
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        {/* Filters */}
                        <div className="flex gap-4 items-end flex-wrap">
                            <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-0 md:min-w-[240px]">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Lớp</label>
                                <div className="relative">
                                    <select
                                        className="appearance-none w-full bg-white/60 backdrop-blur-sm border border-gray-200 hover:border-purple-500/50 text-gray-900 text-sm rounded-lg pl-3 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer font-medium shadow-sm truncate"
                                        value={selectedClassId}
                                        onChange={(e) => setSelectedClassId(e.target.value)}
                                    >
                                        <option value="">-- Chọn Lớp --</option>
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name} ({cls.studentsCount} thiếu nhi)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-purple-600">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5 w-48">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Học Kỳ</label>
                                <div className="relative">
                                    <select
                                        className="appearance-none w-full bg-white/60 backdrop-blur-sm border border-gray-200 hover:border-purple-500/50 text-gray-900 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer font-medium shadow-sm"
                                        value={semester}
                                        onChange={(e) => setSemester(e.target.value)}
                                    >
                                        <option value="HK1">Học Kỳ I (HK1)</option>
                                        <option value="HK2">Học Kỳ II (HK2)</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-purple-600">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards (Mini) */}
                        {selectedClassId && students.length > 0 && (
                            <div className="flex gap-3">
                                <div className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-xl flex flex-col shadow-sm min-w-[120px] border border-white/50">
                                    <span className="text-xs text-gray-500 font-medium mb-1">Điểm TB</span>
                                    <span className="text-xl font-bold text-purple-600">{stats.avg}</span>
                                </div>
                                <div className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-xl flex flex-col shadow-sm min-w-[120px] border border-white/50">
                                    <span className="text-xs text-gray-500 font-medium mb-1">Cao nhất</span>
                                    <span className="text-xl font-bold text-green-600">{stats.highest}</span>
                                </div>
                                <div className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-xl flex flex-col shadow-sm min-w-[120px] border-l-4 border-l-red-400 border border-white/50">
                                    <span className="text-xs text-gray-500 font-medium mb-1">Thiếu điểm</span>
                                    <span className="text-xl font-bold text-red-500">{stats.missing}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Error/Success Messages */}
                {error && (
                    <div className="mx-8 mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        ⚠️ {error}
                    </div>
                )}

                {success && (
                    <div className="mx-8 mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                        ✅ {success}
                    </div>
                )}

                {/* Table Section */}
                <div className="flex-1 px-8 pb-24 md:pb-8 overflow-hidden flex flex-col">
                    {/* Loading State */}
                    {loading && (
                        <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm flex-1 flex items-center justify-center border border-white/50">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                                <p className="text-gray-600">Đang tải danh sách...</p>
                            </div>
                        </div>
                    )}

                    {/* Empty State - No class selected */}
                    {!loading && !selectedClassId && (
                        <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm flex-1 flex items-center justify-center border border-white/50">
                            <div className="text-center text-gray-400">
                                <div className="text-6xl mb-4">👆</div>
                                <p>Vui lòng chọn lớp và học kỳ để xem điểm</p>
                            </div>
                        </div>
                    )}

                    {/* Empty State - No students */}
                    {!loading && selectedClassId && students.length === 0 && (
                        <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm flex-1 flex items-center justify-center border border-white/50">
                            <div className="text-center text-gray-400">
                                <div className="text-6xl mb-4">📚</div>
                                <p>Không tìm thấy thiếu nhi trong lớp này</p>
                            </div>
                        </div>
                    )}

                    {/* Students Table */}
                    {!loading && selectedClassId && students.length > 0 && (
                        <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden w-full relative border border-white/50">
                            <div className="overflow-auto flex-1 w-full custom-scrollbar">
                                <style>{`
                                    .custom-scrollbar::-webkit-scrollbar {
                                        width: 6px;
                                        height: 6px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-track {
                                        background: transparent;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb {
                                        background-color: rgba(147, 51, 234, 0.2);
                                        border-radius: 20px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                        background-color: rgba(147, 51, 234, 0.5);
                                    }
                                `}</style>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/50 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[40px] md:w-[60px] min-w-[40px] md:min-w-[60px] text-center sticky left-0 z-20 bg-gray-50/95 backdrop-blur">#</th>
                                            <th className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[140px] md:min-w-[200px] lg:max-w-[350px] lg:w-[350px] sticky left-[40px] md:left-[60px] z-20 bg-gray-50/95 backdrop-blur shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Tên Thiếu Nhi</th>
                                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                                                <div>Miệng</div>
                                                <div className="text-[10px] font-normal opacity-70">(M)</div>
                                            </th>
                                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                                                <div>1 Tiết</div>
                                                <div className="text-[10px] font-normal opacity-70">(1T)</div>
                                            </th>
                                            <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                                                <div>Cuối Kỳ</div>
                                                <div className="text-[10px] font-normal opacity-70">(Thi)</div>
                                            </th>
                                            <th className="p-4 pr-6 text-center text-xs font-semibold text-purple-600 uppercase tracking-wider w-24">TB Giáo Lý</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/50">
                                        {students.map((student, index) => {
                                            const avg = calculateStudentAverage(student.id);
                                            const hasAllGrades = grades[student.id]?.gradeM && grades[student.id]?.grade1T && grades[student.id]?.gradeThi;
                                            const hasMissingGrades = !grades[student.id]?.gradeM || !grades[student.id]?.grade1T || !grades[student.id]?.gradeThi;

                                            return (
                                                <tr key={student.id} className="group hover:bg-white/40 transition-colors">
                                                    <td className="p-2 md:p-3 text-xs md:text-sm text-gray-400 font-mono text-center sticky left-0 z-10 bg-white/95 backdrop-blur group-hover:bg-purple-50/95 transition-colors">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </td>
                                                    <td className="p-2 md:p-3 sticky left-[40px] md:left-[60px] z-10 bg-white/95 backdrop-blur group-hover:bg-purple-50/95 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                        <div className="flex items-center gap-2 md:gap-3">
                                                            <div className={`w-7 h-7 md:w-8 md:h-8 flex-shrink-0 rounded-full bg-gradient-to-br ${getAvatarColor(index)} flex items-center justify-center text-[10px] md:text-xs font-bold`}>
                                                                {getInitials(student.name)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs md:text-sm font-medium text-gray-900 truncate">{student.name}</p>
                                                                <p className="text-[10px] text-gray-400 truncate">MSTN: {student.studentId || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            className={`w-16 text-center ${!grades[student.id]?.gradeM ? 'bg-red-50 border-red-200' : 'bg-white/40 border-gray-200'} border rounded p-1.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none`}
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            step="0.5"
                                                            placeholder="-"
                                                            value={grades[student.id]?.gradeM || ''}
                                                            onChange={(e) => handleGradeChange(student.id, 'gradeM', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            className={`w-16 text-center ${!grades[student.id]?.grade1T ? 'bg-red-50 border-red-200' : 'bg-white/40 border-gray-200'} border rounded p-1.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none`}
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            step="0.5"
                                                            placeholder="-"
                                                            value={grades[student.id]?.grade1T || ''}
                                                            onChange={(e) => handleGradeChange(student.id, 'grade1T', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            className={`w-16 text-center ${!grades[student.id]?.gradeThi ? 'bg-red-50 border-red-200' : 'bg-white/40 border-gray-200'} border rounded p-1.5 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none`}
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            step="0.5"
                                                            placeholder="-"
                                                            value={grades[student.id]?.gradeThi || ''}
                                                            onChange={(e) => handleGradeChange(student.id, 'gradeThi', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-4 pr-6 text-center">
                                                        {avg !== null ? (
                                                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${parseFloat(avg) >= 8 ? 'bg-green-100 text-green-700' :
                                                                parseFloat(avg) >= 6.5 ? 'bg-blue-100 text-blue-700' :
                                                                    parseFloat(avg) >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-red-100 text-red-700'
                                                                }`}>
                                                                {avg}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-bold">
                                                                ---
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile/Tablet Save Button (Inline) */}
                            <div className="lg:hidden p-4 bg-white/50 backdrop-blur-sm border-t border-purple-100">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full bg-purple-600 active:bg-purple-700 text-white rounded-xl py-3 shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    <span className="material-symbols-outlined">{saving ? 'hourglass_empty' : 'save'}</span>
                                    <span className="font-bold">{saving ? 'Đang lưu...' : 'Lưu Điểm'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Floating Action Button (Desktop Only) */}
                {!loading && selectedClassId && students.length > 0 && (
                    <div className="hidden lg:flex absolute bottom-10 right-10 z-50">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-full shadow-lg shadow-purple-600/30 h-14 px-6 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            <span className="material-symbols-outlined">{saving ? 'hourglass_empty' : 'save'}</span>
                            <span className="font-bold text-base">{saving ? 'Đang lưu...' : 'Lưu Điểm'}</span>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
