import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { deletePendingAttendance } from '../utils/offlineStorage';
import './SyncMonitorPage.css';

export default function SyncMonitorPage() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('all'); // all, today
    const [loading, setLoading] = useState(true);
    const [selectedErrors, setSelectedErrors] = useState(new Set());
    const [activeLog, setActiveLog] = useState(null); // For the details panel

    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (!isAdmin()) {
            navigate('/');
            return;
        }

        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch from backend API
            const response = await api.get('/sync-errors');
            const backendLogs = response.data?.data?.logs || response.data?.logs || response.data || [];

            // Helper to fix attendance type display
            const fixAttendanceType = (type) => {
                const typeMap = {
                    'Le Thu 5': 'Lễ Thứ 5',
                    'Hoc Giao Ly': 'Học Giáo Lý',
                    'Le Chua Nhat': 'Lễ Chúa Nhật'
                };
                return typeMap[type] || type;
            };

            // Transform backend logs to match frontend format
            const transformedLogs = backendLogs
                .filter(log => !log.resolved) // Only show unresolved errors
                .map(log => ({
                    id: log.id,
                    userId: log.userId,
                    username: log.username,
                    classId: log.classId,
                    className: log.className,
                    attendanceDate: log.attendanceDate,
                    attendanceType: fixAttendanceType(log.attendanceType),
                    attendanceId: log.attendanceId, // Include for deletion
                    error: log.error,
                    timestamp: log.createdAt ? new Date(log.createdAt).getTime() : Date.now(),
                    online: log.isOnline,
                    attendanceRecords: log.attendanceRecords || [],
                    presentCount: log.presentCount || 0,
                    type: 'error'
                }));

            // Sort by timestamp desc
            transformedLogs.sort((a, b) => b.timestamp - a.timestamp);

            setLogs(transformedLogs);

            // Calculate stats
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const last24h = transformedLogs.filter(l => l.timestamp > oneDayAgo).length;

            setStats({
                totalErrors: transformedLogs.length,
                totalSuccesses: 0,
                last24hErrors: last24h,
                last24hSuccesses: 0
            });
            setIsOnline(true);
        } catch (error) {
            console.error('Failed to load sync monitor data:', error);
            setLogs([]);
            setStats({
                totalErrors: 0,
                totalSuccesses: 0,
                last24hErrors: 0,
                last24hSuccesses: 0
            });
            setIsOnline(false);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredLogs = () => {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        if (filter === 'today') {
            return logs.filter(log => log.timestamp > oneDayAgo);
        }

        return logs;
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTimeOnly = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const handleSelectError = (errorId) => {
        const newSelected = new Set(selectedErrors);
        if (newSelected.has(errorId)) {
            newSelected.delete(errorId);
        } else {
            newSelected.add(errorId);
        }
        setSelectedErrors(newSelected);
    };

    const handleSelectAll = (filteredLogs) => {
        if (selectedErrors.size === filteredLogs.length && filteredLogs.length > 0) {
            setSelectedErrors(new Set());
        } else {
            setSelectedErrors(new Set(filteredLogs.map(log => log.id)));
        }
    };

    const handleResolveSelected = async (specificIds = null) => {
        const idsToResolve = specificIds || selectedErrors;
        const size = specificIds ? specificIds.size : idsToResolve.size;

        if (size === 0) {
            alert('Vui lòng chọn ít nhất 1 lỗi');
            return;
        }

        if (!confirm(`Resolve ${size} lỗi?\n\nHành động này sẽ:\n- Mark lỗi là đã xử lý\n- Xóa khỏi hàng chờ sync của user`)) {
            return;
        }

        try {
            setLoading(true);

            for (const errorId of idsToResolve) {
                // Find the error to get attendanceId
                const error = logs.find(l => l.id === errorId);

                await api.patch(`/sync-errors/${errorId}/resolve`);

                if (error?.attendanceId) {
                    // Remove from pending queue
                    await deletePendingAttendance(error.attendanceId);
                }
            }

            await loadData();
            setSelectedErrors(new Set());
            if (activeLog && idsToResolve.has(activeLog.id)) {
                setActiveLog(null);
            }
            // alert(`✅ Đã resolve ${size} lỗi`);
        } catch (error) {
            console.error('Failed to resolve errors:', error);
            alert('❌ Lỗi khi resolve: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = async (specificIds = null) => {
        const idsToDelete = specificIds || selectedErrors;
        const size = specificIds ? specificIds.size : idsToDelete.size;

        if (size === 0) {
            alert('Vui lòng chọn ít nhất 1 lỗi');
            return;
        }

        if (!confirm(`Xóa hoàn toàn ${size} bản ghi lỗi?\n\nHành động này không thể hoàn tác!`)) {
            return;
        }

        try {
            setLoading(true);

            await api.delete('/sync-errors/bulk', {
                data: { ids: Array.from(idsToDelete) }
            });

            await loadData();
            setSelectedErrors(new Set());
            if (activeLog && idsToDelete.has(activeLog.id)) {
                setActiveLog(null);
            }
            // alert(`✅ Đã xóa ${size} lỗi`);
        } catch (error) {
            console.error('Failed to delete errors:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = getFilteredLogs();

    return (
        <div className="sync-monitor-page bg-[#191022] text-white font-display overflow-hidden selection:bg-primary/30 h-full w-full fixed inset-0 z-40 md:static md:h-full md:flex-1 md:w-full md:z-auto dark">
            {/* Note: using fixed inset-0 on mobile to cover navigation, but on desktop we might want it proper. 
                Actually, the user requested full screen like AdminPage.
                Let's use a wrapper that ensures it fills the container.
            */}
            <div className="relative flex flex-col w-full h-full overflow-hidden bg-[#191022]">
                {/* Ambient Background Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px]"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px]"></div>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* Top Bar / Header */}
                    <header className="flex-shrink-0 px-4 md:px-8 py-4 md:py-6 flex flex-wrap items-center justify-between gap-4 glass-panel-dark border-b border-white/5 z-10 sticky top-0">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">Sync Monitor</h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot"></span>
                                    Online
                                </span>
                            </div>
                            <p className="text-white/50 text-xs md:text-sm hidden md:block">Real-time system health and synchronization error logs</p>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <button
                                onClick={() => loadData()}
                                disabled={loading}
                                className="group flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-primary hover:bg-primary/90 border border-primary hover:border-primary/80 shadow-[0_0_20px_rgba(127,13,242,0.3)] transition-all active:scale-95 disabled:opacity-50"
                            >
                                <span className={`material-symbols-outlined text-white text-[18px] md:text-[20px] ${loading ? 'animate-spin' : ''}`}>sync</span>
                                <span className="text-xs md:text-sm font-bold text-white hidden sm:inline">{loading ? 'Syncing...' : 'Force Sync'}</span>
                            </button>
                        </div>
                    </header>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="max-w-[1920px] mx-auto flex flex-col gap-6 md:gap-8 pb-20 md:pb-0">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Stat Card 1 - Total Errors */}
                                <div
                                    className={`glass-card-dark rounded-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group cursor-pointer transition-all ${filter === 'all' ? 'border-red-500/30 bg-red-500/5' : ''}`}
                                    onClick={() => setFilter('all')}
                                >
                                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-red-500">
                                        <span className="material-symbols-outlined text-6xl">error</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-red-200/80 text-sm font-medium">Unresolved Errors</p>
                                        <p className="text-red-400 text-2xl font-bold tracking-tight">{stats?.totalErrors || 0} Issues</p>
                                    </div>
                                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                        <div className="bg-red-500 h-full shadow-[0_0_10px_currentColor]" style={{ width: `${Math.min((stats?.totalErrors || 0) * 5, 100)}%` }}></div>
                                    </div>
                                </div>

                                {/* Stat Card 2 - Last 24h */}
                                <div
                                    className={`glass-card-dark rounded-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group cursor-pointer transition-all ${filter === 'today' ? 'border-amber-400/30 bg-amber-400/5' : ''}`}
                                    onClick={() => setFilter('today')}
                                >
                                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-6xl">history</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white/60 text-sm font-medium">Last 24 Hours</p>
                                        <p className="text-white text-2xl font-bold tracking-tight">{stats?.last24hErrors || 0} New Errors</p>
                                    </div>
                                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                        <div className="bg-amber-400 h-full shadow-[0_0_10px_currentColor]" style={{ width: `${Math.min((stats?.last24hErrors || 0) * 10, 100)}%` }}></div>
                                    </div>
                                </div>

                                {/* Stat Card 3 - Pending Actions */}
                                <div
                                    className="glass-card-dark rounded-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
                                    onClick={() => setSelectedErrors(new Set())}
                                >
                                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-6xl">pending_actions</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white/60 text-sm font-medium">Selected</p>
                                        <p className="text-white text-2xl font-bold tracking-tight">{selectedErrors.size} Records</p>
                                    </div>
                                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                        <div className="bg-primary h-full shadow-[0_0_10px_currentColor]" style={{ width: `${Math.min(selectedErrors.size * 5, 100)}%` }}></div>
                                    </div>
                                </div>

                                {/* Stat Card 4 - System Status */}
                                <div className="glass-card-dark rounded-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-6xl">dns</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white/60 text-sm font-medium">Backend Connection</p>
                                        <p className={`${isOnline ? 'text-emerald-400' : 'text-red-400'} text-2xl font-bold tracking-tight flex items-center gap-2`}>
                                            {isOnline ? 'Online' : 'Offline'}
                                            <span className="material-symbols-outlined text-xl">{isOnline ? 'check_circle' : 'error'}</span>
                                        </p>
                                    </div>
                                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                                        <div className={`${isOnline ? 'bg-emerald-500' : 'bg-red-500'} h-full w-full shadow-[0_0_10px_currentColor]`}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Dashboard Split */}
                            <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px] min-h-[500px]">
                                {/* Left Panel: Error Console */}
                                <div className="flex-1 glass-panel-dark rounded-xl flex flex-col overflow-hidden h-[500px] lg:h-auto">
                                    <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-white">Sync Console</h3>
                                            <span className=" bg-white/10 text-white/60 text-xs px-2 py-1 rounded-md font-mono">
                                                {filteredLogs.length} events
                                            </span>
                                        </div>
                                        {/* Filter Chips & Actions */}
                                        <div className="flex gap-2 items-center">
                                            {selectedErrors.size > 0 ? (
                                                <>
                                                    <button onClick={() => handleResolveSelected()} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-bold border border-emerald-500/30 transition-colors flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">check</span> Resolve ({selectedErrors.size})
                                                    </button>
                                                    <button onClick={() => handleDeleteSelected()} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold border border-red-500/30 transition-colors flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setFilter('all')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filter === 'all'
                                                            ? 'bg-primary/20 text-primary border-primary/20'
                                                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-transparent'
                                                            }`}
                                                    >
                                                        All
                                                    </button>
                                                    <button
                                                        onClick={() => setFilter('today')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filter === 'today'
                                                            ? 'bg-primary/20 text-primary border-primary/20'
                                                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-transparent'
                                                            }`}
                                                    >
                                                        Today
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-2 md:gap-4 px-4 md:px-6 py-3 bg-white/5 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5">
                                        <div className="col-span-1 flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredLogs.length > 0 && selectedErrors.size === filteredLogs.length}
                                                onChange={() => handleSelectAll(filteredLogs)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary cursor-pointer"
                                            />
                                        </div>
                                        <div className="col-span-3 md:col-span-2">Time</div>
                                        <div className="col-span-3 md:col-span-3">Entity</div>
                                        <div className="col-span-5 md:col-span-5">Message</div>
                                        <div className="col-span-1 md:col-span-1 text-right"></div>
                                    </div>
                                    {/* Table Body */}
                                    <div className="overflow-y-auto flex-1 p-2">
                                        <div className="flex flex-col gap-1">
                                            {filteredLogs.length === 0 ? (
                                                <div className="text-center p-8 text-white/30">
                                                    No sync errors found. Ideal state.
                                                </div>
                                            ) : (
                                                filteredLogs.map(log => (
                                                    <div
                                                        key={log.id}
                                                        className={`grid grid-cols-12 gap-2 md:gap-4 px-4 py-3 items-center rounded-lg transition-colors group border cursor-pointer
                                                            ${activeLog?.id === log.id ? 'bg-primary/10 border-primary/30' : 'hover:bg-white/5 border-transparent hover:border-white/5'}`}
                                                        onClick={() => setActiveLog(log)}
                                                    >
                                                        <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedErrors.has(log.id)}
                                                                onChange={() => handleSelectError(log.id)}
                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary cursor-pointer"
                                                            />
                                                        </div>
                                                        <div className="col-span-3 md:col-span-2 text-white/60 text-xs md:text-sm font-mono truncate">
                                                            {formatTimeOnly(log.timestamp)}
                                                        </div>
                                                        <div className="col-span-3 md:col-span-3 flex items-center gap-2 overflow-hidden">
                                                            <div className="size-2 flex-shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                                            <span className="text-white text-xs md:text-sm font-medium truncate" title={log.className}>
                                                                {log.className || log.username || 'Unknown'}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-5 md:col-span-5 text-red-300 text-xs md:text-sm truncate" title={log.error}>
                                                            {log.error}
                                                        </div>
                                                        <div className="col-span-1 md:col-span-1 flex justify-end">
                                                            <button className="text-white/40 hover:text-primary transition-colors">
                                                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Live Feed / Details */}
                                <div className={`glass-panel-dark rounded-xl flex flex-col overflow-hidden lg:w-1/3 lg:h-auto h-[400px] transition-opacity duration-300 ${!activeLog ? 'opacity-70' : 'opacity-100'}`}>
                                    <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-white">
                                            {activeLog ? 'Issue Details' : 'Details'}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {activeLog && (
                                                <span className="animate-pulse size-2 rounded-full bg-red-500"></span>
                                            )}
                                            <span className="text-xs text-white/50 uppercase tracking-widest font-semibold">
                                                {activeLog ? 'Active' : 'Select Item'}
                                            </span>
                                        </div>
                                    </div>

                                    {activeLog ? (
                                        <>
                                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-black/20 text-sm">
                                                <div className="flex flex-col gap-4">
                                                    {/* Meta Info */}
                                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                        <p className="text-xs text-red-200 uppercase tracking-wider mb-1">Error Message</p>
                                                        <p className="text-red-100 font-mono text-xs break-words">{activeLog.error}</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-white/40 text-xs uppercase mb-1">Class</p>
                                                            <p className="text-white font-medium">{activeLog.className || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-white/40 text-xs uppercase mb-1">User</p>
                                                            <p className="text-white font-medium">{activeLog.username || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-white/40 text-xs uppercase mb-1">Date</p>
                                                            <p className="text-white font-medium">{activeLog.attendanceDate || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-white/40 text-xs uppercase mb-1">Type</p>
                                                            <p className="text-white font-medium">{activeLog.attendanceType || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {/* Student List */}
                                                    <div className="mt-2">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-white/40 text-xs uppercase">Attendance Records ({activeLog.attendanceRecords?.length || 0})</p>
                                                            <span className="text-emerald-400 text-xs font-bold">{activeLog.presentCount} Present</span>
                                                        </div>
                                                        <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden max-h-[200px] overflow-y-auto custom-scrollbar">
                                                            {activeLog.attendanceRecords?.map((record, idx) => (
                                                                <div key={idx} className="px-3 py-2 border-b border-white/5 text-xs text-white/80 last:border-0 flex justify-between">
                                                                    <span>{idx + 1}. {record.studentName}</span>
                                                                    <span className="text-emerald-400">✓</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions Footer */}
                                            <div className="p-4 border-t border-white/5 bg-white/5 grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleResolveSelected(new Set([activeLog.id]))}
                                                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-500 text-white border-0 w-full justify-center"
                                                >
                                                    ✅ Resolve
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSelected(new Set([activeLog.id]))}
                                                    className="btn btn-sm bg-red-600 hover:bg-red-500 text-white border-0 w-full justify-center"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-white/30 text-center">
                                            <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">toc</span>
                                            <p className="text-sm">Select an error from the list to view details and take action.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
