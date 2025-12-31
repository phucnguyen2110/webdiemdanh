import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { deletePendingAttendance } from '../utils/offlineStorage';

export default function SyncMonitorPage() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('all'); // all, errors
    const [loading, setLoading] = useState(true);
    const [selectedErrors, setSelectedErrors] = useState(new Set());

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
            // Filter out resolved errors
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
        } catch (error) {
            console.error('Failed to load sync monitor data:', error);
            setLogs([]);
            setStats({
                totalErrors: 0,
                totalSuccesses: 0,
                last24hErrors: 0,
                last24hSuccesses: 0
            });
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

    const handleSelectError = (errorId) => {
        const newSelected = new Set(selectedErrors);
        if (newSelected.has(errorId)) {
            newSelected.delete(errorId);
        } else {
            newSelected.add(errorId);
        }
        setSelectedErrors(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedErrors.size === filteredLogs.length) {
            setSelectedErrors(new Set());
        } else {
            setSelectedErrors(new Set(filteredLogs.map(log => log.id)));
        }
    };

    const handleResolveSelected = async () => {
        if (selectedErrors.size === 0) {
            alert('Vui lòng chọn ít nhất 1 lỗi');
            return;
        }

        if (!confirm(`Resolve ${selectedErrors.size} lỗi?\n\nHành động này sẽ:\n- Mark lỗi là đã xử lý\n- Xóa khỏi hàng chờ sync của user`)) {
            return;
        }

        try {
            setLoading(true);

            // Call API to resolve errors
            for (const errorId of selectedErrors) {
                // Find the error to get attendanceId
                const error = logs.find(l => l.id === errorId);

                await api.patch(`/sync-errors/${errorId}/resolve`);

                if (error?.attendanceId) {
                    // Remove from pending queue
                    await deletePendingAttendance(error.attendanceId);
                }
            }

            // Reload data
            await loadData();
            setSelectedErrors(new Set());
            alert(`✅ Đã resolve ${selectedErrors.size} lỗi`);
        } catch (error) {
            console.error('Failed to resolve errors:', error);
            alert('❌ Lỗi khi resolve: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedErrors.size === 0) {
            alert('Vui lòng chọn ít nhất 1 lỗi');
            return;
        }

        if (!confirm(`Xóa ${selectedErrors.size} lỗi?\n\nHành động này không thể hoàn tác!`)) {
            return;
        }

        try {
            setLoading(true);

            // Call API to delete errors
            await api.delete('/sync-errors/bulk', {
                data: { ids: Array.from(selectedErrors) }
            });

            // Reload data
            await loadData();
            setSelectedErrors(new Set());
            alert(`✅ Đã xóa ${selectedErrors.size} lỗi`);
        } catch (error) {
            console.error('Failed to delete errors:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = getFilteredLogs();

    if (loading) {
        return (
            <div className="container" style={{ paddingTop: '2rem', textAlign: 'center' }}>
                <span className="spinner"></span>
                <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tải...</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">🔍 Sync Error Monitor</h2>
                    <p className="card-subtitle">Theo dõi lỗi đồng bộ từ tất cả users</p>
                </div>

                {/* Statistics */}
                {stats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--color-gray-50)',
                        borderBottom: '1px solid var(--color-gray-200)'
                    }}>
                        <div style={{
                            padding: 'var(--spacing-sm)',
                            background: 'white',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-gray-200)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)', marginBottom: '0.25rem' }}>
                                Tổng Lỗi
                            </div>
                            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '700', color: 'var(--color-danger)' }}>
                                {stats.totalErrors}
                            </div>
                        </div>

                        <div style={{
                            padding: 'var(--spacing-sm)',
                            background: 'white',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-gray-200)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)', marginBottom: '0.25rem' }}>
                                24h Qua
                            </div>
                            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '700', color: 'var(--color-warning)' }}>
                                {stats.last24hErrors}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters and Actions */}
                <div style={{
                    padding: 'var(--spacing-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-sm)',
                    borderBottom: '1px solid var(--color-gray-200)'
                }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                        <button
                            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('all')}
                            style={{ fontSize: 'var(--font-size-xs)' }}
                        >
                            Tất cả ({logs.length})
                        </button>
                        <button
                            className={`btn btn-sm ${filter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('today')}
                            style={{ fontSize: 'var(--font-size-xs)' }}
                        >
                            📅 Hôm nay ({stats?.last24hErrors || 0})
                        </button>
                    </div>

                    {/* Bulk Actions */}
                    {selectedErrors.size > 0 && (
                        <div style={{
                            padding: 'var(--spacing-sm)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            gap: 'var(--spacing-xs)',
                            alignItems: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-primary)' }}>
                                {selectedErrors.size} đã chọn
                            </span>
                            <button
                                className="btn btn-sm btn-success"
                                onClick={handleResolveSelected}
                                style={{ fontSize: 'var(--font-size-xs)' }}
                            >
                                ✅ Resolve
                            </button>
                            <button
                                className="btn btn-sm btn-danger"
                                onClick={handleDeleteSelected}
                                style={{ fontSize: 'var(--font-size-xs)' }}
                            >
                                🗑️ Xóa
                            </button>
                            <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setSelectedErrors(new Set())}
                                style={{ fontSize: 'var(--font-size-xs)' }}
                            >
                                ✖️ Bỏ chọn
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={handleSelectAll}
                            style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                            disabled={filteredLogs.length === 0}
                        >
                            {selectedErrors.size === filteredLogs.length && filteredLogs.length > 0 ? '☐ Bỏ chọn tất cả' : '☑️ Chọn tất cả'}
                        </button>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={loadData}
                            style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                {/* Logs List - Mobile Friendly */}
                <div style={{ padding: 'var(--spacing-md)' }}>
                    {filteredLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                            <p>Không có lỗi đồng bộ nào</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            {filteredLogs.map((log, index) => (
                                <div key={log.id || index} style={{
                                    border: '2px solid var(--color-danger)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-sm)',
                                    background: 'rgba(239, 68, 68, 0.05)',
                                    position: 'relative'
                                }}>
                                    {/* Checkbox */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 'var(--spacing-sm)',
                                        left: 'var(--spacing-sm)'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedErrors.has(log.id)}
                                            onChange={() => handleSelectError(log.id)}
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: 'var(--spacing-xs)',
                                        flexWrap: 'wrap',
                                        gap: 'var(--spacing-xs)',
                                        paddingLeft: '2rem' // Space for checkbox
                                    }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '600',
                                            color: 'var(--color-danger)'
                                        }}>
                                            ❌ LỖI ĐỒNG BỘ
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-gray-600)'
                                        }}>
                                            {formatDate(log.timestamp)}
                                        </div>
                                    </div>

                                    <div style={{
                                        fontSize: 'var(--font-size-sm)',
                                        marginBottom: 'var(--spacing-xs)'
                                    }}>
                                        <strong>{log.className || `ID: ${log.classId}` || 'N/A'}</strong>
                                    </div>

                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-gray-600)',
                                        display: 'grid',
                                        gridTemplateColumns: 'auto 1fr',
                                        gap: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)'
                                    }}>
                                        <span>👤</span>
                                        <span>{log.username || 'N/A'}</span>
                                        <span>📅</span>
                                        <span>{log.attendanceDate || 'N/A'}</span>
                                        <span>📝</span>
                                        <span>{log.attendanceType || 'N/A'}</span>
                                        <span>{log.online ? '🟢' : '🔴'}</span>
                                        <span>{log.online ? 'Online' : 'Offline'}</span>
                                    </div>

                                    {log.error && (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-danger)',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            padding: 'var(--spacing-xs)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginTop: 'var(--spacing-xs)',
                                            wordBreak: 'break-word'
                                        }}>
                                            <strong>Lỗi:</strong> {log.error}
                                        </div>
                                    )}

                                    {/* Student List */}
                                    {log.attendanceRecords?.length > 0 && (
                                        <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-success)',
                                                fontWeight: '600',
                                                marginBottom: 'var(--spacing-xs)'
                                            }}>
                                                ✓ {log.presentCount} thiếu nhi có mặt
                                            </div>
                                            <details style={{ marginTop: 'var(--spacing-xs)' }}>
                                                <summary style={{
                                                    cursor: 'pointer',
                                                    fontSize: 'var(--font-size-xs)',
                                                    color: 'var(--color-primary)',
                                                    fontWeight: '500',
                                                    userSelect: 'none'
                                                }}>
                                                    📋 Xem danh sách
                                                </summary>
                                                <div style={{
                                                    marginTop: 'var(--spacing-xs)',
                                                    paddingLeft: 'var(--spacing-md)',
                                                    maxHeight: '200px',
                                                    overflowY: 'auto',
                                                    fontSize: 'var(--font-size-xs)',
                                                    color: 'var(--color-gray-700)'
                                                }}>
                                                    {log.attendanceRecords.map((record, idx) => (
                                                        <div key={idx} style={{
                                                            padding: '0.25rem 0',
                                                            borderBottom: '1px solid var(--color-gray-100)'
                                                        }}>
                                                            {idx + 1}. {record.studentName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
