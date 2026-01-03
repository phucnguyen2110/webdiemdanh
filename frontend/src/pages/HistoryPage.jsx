import { useState, useEffect, useMemo } from 'react';
import { classesAPI, attendanceAPI, gradesAPI, exportAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';
import { invalidateCache } from '../utils/excelCache';

export default function HistoryPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'grades'
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');

    // Attendance states
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null); // Expanded session ID
    const [sessionDetails, setSessionDetails] = useState(null);

    // Grades states
    const [gradesHistory, setGradesHistory] = useState([]);

    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    // Computed stats
    const stats = useMemo(() => {
        if (!sessions.length) return { monthlyAvg: 0, total: 0, bestRate: 0 };
        const total = sessions.length;
        // Simple average calculation
        const totalPresent = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const totalStudents = sessions.reduce((acc, s) => acc + (s.totalCount || 0), 0);
        const avg = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

        // Best attendance
        const best = sessions.reduce((max, s) => {
            const rate = s.totalCount > 0 ? (s.presentCount / s.totalCount) : 0;
            return rate > max ? rate : max;
        }, 0);

        return {
            monthlyAvg: avg,
            total,
            bestRate: Math.round(best * 100)
        };
    }, [sessions]);

    // Group sessions by Date (Day)
    const groupedSessions = useMemo(() => {
        const groups = {};
        sessions.forEach(session => {
            const date = new Date(session.attendanceDate).toDateString(); // Group by date string
            if (!groups[date]) groups[date] = [];
            groups[date].push(session);
        });
        // Sort keys desc (newest first)
        return Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
            date,
            items: groups[date]
        }));
    }, [sessions]);

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
            const transformedClasses = (result.classes || []).map(cls => ({
                id: cls.id,
                name: cls.name,
                createdAt: cls.created_at,
                studentsCount: cls.students_count
            }));
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

    const toggleSessionDetails = async (sessionId) => {
        if (selectedSession === sessionId) {
            setSelectedSession(null); // Collapse
            return;
        }

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

    // Alias for compatibility if needed, but toggle is better for UI
    const loadSessionDetails = toggleSessionDetails;

    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation();
        if (!window.confirm('Bạn có chắc chắn muốn xóa buổi điểm danh này?')) return;
        setLoading(true);
        setError('');
        try {
            await attendanceAPI.deleteSession(sessionId);
            await loadHistory(selectedClassId);
            invalidateCache(selectedClassId);
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

    const handleUpdateStudentStatus = async (sessionId, studentId, isPresent, studentName) => {
        try {
            await attendanceAPI.updateStudentStatus(sessionId, studentId, isPresent);
            setSessionDetails(prev => ({
                ...prev,
                records: prev.records.map(r => r.studentId === studentId ? { ...r, isPresent } : r)
            }));
            setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                    const change = isPresent ? 1 : -1;
                    return { ...s, presentCount: s.presentCount + change };
                }
                return s;
            }));
            invalidateCache(selectedClassId);
        } catch (err) {
            alert(`Lỗi cập nhật trạng thái của em ${studentName}: ` + err.message);
        }
    };

    const handleBulkUpdate = async (targetIsPresent) => {
        if (!sessionDetails) return;
        const recordsToUpdate = sessionDetails.records.filter(r => r.isPresent !== targetIsPresent);
        if (recordsToUpdate.length === 0) {
            alert(targetIsPresent ? 'Tất cả đã có mặt rồi!' : 'Tất cả đã vắng mặt rồi!');
            return;
        }
        const actionName = targetIsPresent ? 'CÓ MẶT' : 'DANG VẮNG';
        if (!window.confirm(`Bạn có chắc muốn chuyển trạng thái ${recordsToUpdate.length} em thành "${actionName}"?`)) return;

        setLoadingDetails(true);
        try {
            await Promise.all(recordsToUpdate.map(record =>
                attendanceAPI.updateStudentStatus(sessionDetails.session.id, record.studentId, targetIsPresent)
            ));
            const result = await attendanceAPI.getSession(sessionDetails.session.id);
            setSessionDetails(result);
            loadHistory(selectedClassId);
            invalidateCache(selectedClassId);
            alert('Đã cập nhật thành công!');
        } catch (err) {
            alert('Có lỗi xảy ra khi cập nhật hàng loạt: ' + err.message);
        } finally {
            setLoadingDetails(false);
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

    const formatDate = (dateString, options = {}) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            ...options,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatAttendanceType = (type) => {
        const mapping = {
            'Hoc Giao Ly': 'Học Giáo Lý',
            'Le Thu 5': 'Lễ Thứ 5',
            'Le Chua Nhat': 'Lễ Chúa Nhật'
        };
        return mapping[type] || type;
    };

    const getSessionInitials = (type) => {
        const mapping = {
            'Hoc Giao Ly': 'H',
            'Học Giáo Lý': 'H',
            'Le Thu 5': 'T5',
            'Lễ Thứ 5': 'T5',
            'Le Chua Nhat': 'L',
            'Lễ Chúa Nhật': 'L'
        };
        return mapping[type] || '??';
    };

    return (
        <div className="flex flex-col h-screen w-full bg-background-dark text-white font-display overflow-hidden">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scroll-smooth">
                {/* Header Section */}
                <header className="flex-none px-4 md:px-8 py-6 border-b border-border-glass bg-[#191022]/50 backdrop-blur-sm z-10">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
                        {/* Title Row */}
                        <div className="flex flex-wrap justify-between items-end gap-4">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-white text-3xl font-black tracking-tight">Lịch Sử Điểm Danh</h2>
                                <p className="text-[#ad90cb] text-sm font-normal">Xem lại lịch sử điểm danh.</p>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={!selectedClassId || exporting}
                                className={`bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 ${(!selectedClassId || exporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">download</span>
                                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                            </button>
                        </div>
                        {/* Stats Widgets - Only show if class selected and sessions available */}
                        {selectedClassId && activeTab === 'attendance' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-surface-glass backdrop-blur-xl border border-border-glass p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-4xl">calendar_month</span>
                                    </div>
                                    <p className="text-[#ad90cb] text-sm font-medium">Trung bình tháng</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-white text-2xl font-bold">{stats.monthlyAvg}%</p>
                                    </div>
                                </div>
                                <div className="bg-surface-glass backdrop-blur-xl border border-border-glass p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-4xl">groups</span>
                                    </div>
                                    <p className="text-[#ad90cb] text-sm font-medium">Tổng buổi</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-white text-2xl font-bold">{stats.total}</p>
                                    </div>
                                </div>
                                <div className="bg-surface-glass backdrop-blur-xl border border-border-glass p-5 rounded-xl flex flex-col gap-1 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-4xl">star</span>
                                    </div>
                                    <p className="text-[#ad90cb] text-sm font-medium">Cao nhất</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-white text-2xl font-bold">{stats.bestRate}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <div className="p-4 md:p-8">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                        {/* Filter Bar */}
                        <div className="bg-surface-glass backdrop-blur-xl border border-white/10 p-4 rounded-xl flex flex-wrap items-center gap-4 shadow-xl shadow-black/20">
                            {/* Class Select */}
                            <div className="w-full sm:w-64">
                                <div className="relative">
                                    <select
                                        className="bg-[#362249]/50 backdrop-blur-lg border border-[#4d3168]/50 w-full pl-3 pr-10 py-2.5 rounded-lg text-white appearance-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm cursor-pointer"
                                        value={selectedClassId}
                                        onChange={(e) => setSelectedClassId(e.target.value)}
                                    >
                                        <option className="bg-[#261834]" value="">-- Chọn lớp --</option>
                                        {classes.map(cls => (
                                            <option className="bg-[#261834]" key={cls.id} value={cls.id}>
                                                {cls.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <span className="material-symbols-outlined text-[#ad90cb]">expand_more</span>
                                    </div>
                                </div>
                            </div>


                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200">
                                {error}
                            </div>
                        )}

                        {/* Content */}
                        {activeTab === 'attendance' ? (
                            <div className="relative flex flex-col gap-8 pl-4">
                                {/* Vertical Line */}
                                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-primary/50 via-[#4d3168] to-transparent"></div>

                                {loading ? (
                                    <div className="ml-14 text-[#ad90cb]">Đang tải...</div>
                                ) : groupedSessions.length > 0 ? (
                                    groupedSessions.map(group => (
                                        <div key={group.date} className="flex flex-col gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#261834] border-2 border-primary shadow-[0_0_10px_rgba(127,13,242,0.5)]">
                                                    <span className="material-symbols-outlined text-white text-sm">today</span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg">{formatDate(group.date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                                            </div>

                                            {group.items.map(session => (
                                                <div
                                                    key={session.id}
                                                    className={`ml-14 bg-surface-glass backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-lg transition-all ${selectedSession === session.id ? 'border-primary/50 ring-1 ring-primary/20' : 'hover:bg-white/5'}`}
                                                >
                                                    {/* Card Summary */}
                                                    <div
                                                        className="p-5 flex flex-wrap justify-between items-center gap-4 cursor-pointer"
                                                        onClick={() => loadSessionDetails(session.id)}
                                                    >
                                                        <div className="flex gap-4 items-center">
                                                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-inner ${session.attendanceMethod === 'qr' ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gradient-to-br from-pink-600 to-orange-500'}`}>
                                                                {getSessionInitials(session.attendanceType)}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-bold text-lg group-hover:text-primary transition-colors">{formatAttendanceType(session.attendanceType)}</h4>
                                                                <div className="flex items-center gap-2 text-[#ad90cb] text-sm">
                                                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                                                    {session.attendanceMethod === 'qr' ? 'Quét QR' : 'Thủ công'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            {selectedSession === session.id && (
                                                                <button
                                                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                                                    className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                                                    title="Xóa buổi này"
                                                                >
                                                                    <span className="material-symbols-outlined">delete</span>
                                                                </button>
                                                            )}
                                                            <div className="flex flex-col items-end min-w-[80px]">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white font-bold text-lg">{session.presentCount}/{session.totalCount}</span>
                                                                </div>
                                                                <span className="text-xs text-[#0bda73] font-medium">
                                                                    {session.totalCount ? Math.round(session.presentCount / session.totalCount * 100) : 0}% Có mặt
                                                                </span>
                                                            </div>
                                                            <button className={`h-8 w-8 rounded-full bg-white/10 flex items-center justify-center transition-colors transform ${selectedSession === session.id ? 'rotate-180' : ''}`}>
                                                                <span className="material-symbols-outlined text-white">expand_more</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Details */}
                                                    {selectedSession === session.id && (
                                                        <div className="bg-black/20 border-t border-white/5 animate-fade-in-up">
                                                            {loadingDetails ? (
                                                                <div className="p-8 text-center text-[#ad90cb]">Đang tải chi tiết...</div>
                                                            ) : sessionDetails ? (
                                                                <div className="p-5">
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <p className="text-sm text-[#ad90cb] font-medium">Danh sách ({sessionDetails.records.length})</p>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => handleBulkUpdate(false)}
                                                                                className="text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
                                                                            >
                                                                                Vắng hết
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleBulkUpdate(true)}
                                                                                className="text-xs bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors border border-green-500/20"
                                                                            >
                                                                                Có hết
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                                        {sessionDetails.records.map(record => (
                                                                            <div
                                                                                key={record.id}
                                                                                className="flex items-center gap-2 p-2 rounded-lg bg-[#261834] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    // Toggle status
                                                                                    handleUpdateStudentStatus(session.id, record.studentId, !record.isPresent, record.fullName);
                                                                                }}
                                                                            >
                                                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${record.isPresent ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                                                    {record.fullName.substring(0, 1)}
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="text-white text-xs font-medium truncate">{record.fullName}</span>
                                                                                    <span className={`text-[10px] font-bold ${record.isPresent ? 'text-green-400' : 'text-red-400'}`}>
                                                                                        {record.isPresent ? 'Có mặt' : 'Vắng'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                ) : selectedClassId ? (
                                    <div className="ml-14 p-8 rounded-xl bg-surface-glass border border-white/10 text-center">
                                        <p className="text-[#ad90cb]">Chưa có dữ liệu điểm danh nào.</p>
                                    </div>
                                ) : (
                                    <div className="ml-14 p-8 rounded-xl bg-surface-glass border border-white/10 text-center">
                                        <p className="text-[#ad90cb]">Vui lòng chọn một lớp để xem lịch sử.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Grades Tab
                            <div className="bg-surface-glass backdrop-blur-xl border border-white/10 p-5 rounded-xl overflow-x-auto">
                                {loading ? (
                                    <div className="text-center text-[#ad90cb] p-4">Đang tải lịch sử điểm...</div>
                                ) : gradesHistory.length > 0 ? (
                                    <table className="w-full text-left text-sm text-[#ad90cb]">
                                        <thead className="text-xs uppercase bg-white/5 text-white">
                                            <tr>
                                                <th className="px-6 py-3 rounded-tl-lg">Thời gian</th>
                                                <th className="px-6 py-3">Học kỳ</th>
                                                <th className="px-6 py-3">Người sửa</th>
                                                <th className="px-6 py-3 text-center">Số TN</th>
                                                <th className="px-6 py-3 rounded-tr-lg text-center">Thay đổi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gradesHistory.map((entry, index) => (
                                                <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-white">
                                                        {new Date(entry.createdAt || entry.created_at).toLocaleString('vi-VN')}
                                                    </td>
                                                    <td className="px-6 py-4">{entry.semester || 'HK I'}</td>
                                                    <td className="px-6 py-4">{entry.editorName || entry.editor_name || 'Admin'}</td>
                                                    <td className="px-6 py-4 text-center">{entry.gradesCount || entry.grades_count || 0}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex gap-2 justify-center">
                                                            {entry.hasM && <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">M</span>}
                                                            {entry.has1T && <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs font-bold border border-orange-500/30">1T</span>}
                                                            {entry.hasThi && <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-xs font-bold border border-purple-500/30">Thi</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="text-center text-[#ad90cb] p-8">
                                        {selectedClassId ? 'Chưa có lịch sử điểm nào.' : 'Vui lòng chọn lớp.'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
