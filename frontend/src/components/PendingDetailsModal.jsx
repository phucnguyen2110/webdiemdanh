import { useState, useEffect } from 'react';
import { getPendingAttendanceDetails, deletePendingAttendance } from '../utils/offlineStorage';
import { forceSyncNow } from '../utils/syncManager';

export default function PendingDetailsModal({ isOpen, onClose }) {
    const [pendingList, setPendingList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPendingDetails();
        }
    }, [isOpen]);

    const loadPendingDetails = async () => {
        setLoading(true);
        try {
            const details = await getPendingAttendanceDetails();

            // Deduplicate: Group by classId + attendanceDate + attendanceType
            const grouped = {};
            details.forEach(item => {
                const key = `${item.classId}_${item.attendanceDate}_${item.attendanceType}`;
                if (!grouped[key]) {
                    grouped[key] = item;
                } else {
                    // Merge records and keep earliest timestamp
                    if (item.timestamp < grouped[key].timestamp) {
                        grouped[key].timestamp = item.timestamp;
                        grouped[key].formattedTime = item.formattedTime;
                    }
                    // Keep the first ID for deletion
                    if (!grouped[key].duplicateIds) {
                        grouped[key].duplicateIds = [grouped[key].id];
                    }
                    grouped[key].duplicateIds.push(item.id);
                }
            });

            setPendingList(Object.values(grouped));
        } catch (error) {
            console.error('Failed to load pending details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (item) => {
        const count = item.duplicateIds ? item.duplicateIds.length : 1;
        const message = count > 1
            ? `Bạn có chắc muốn xóa ${count} điểm danh trùng lặp này khỏi hàng đợi?\n\nDữ liệu sẽ bị mất vĩnh viễn và không thể đồng bộ lên hệ thống.`
            : 'Bạn có chắc muốn xóa điểm danh này khỏi hàng đợi?\n\nDữ liệu sẽ bị mất vĩnh viễn và không thể đồng bộ lên hệ thống.';

        if (!confirm(message)) {
            return;
        }

        setDeleting(item.id);
        try {
            // Delete all duplicates if any
            if (item.duplicateIds) {
                for (const id of item.duplicateIds) {
                    await deletePendingAttendance(id);
                }
            } else {
                await deletePendingAttendance(item.id);
            }
            await loadPendingDetails();
        } catch (error) {
            alert('Lỗi khi xóa: ' + error.message);
        } finally {
            setDeleting(null);
        }
    };

    const handleSyncAll = async () => {
        setSyncing(true);
        try {
            await forceSyncNow();
            await loadPendingDetails();
        } catch (error) {
            alert('Lỗi khi đồng bộ: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
        }} onClick={onClose}>
            <div className="card" style={{
                maxWidth: '700px',
                width: '100%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="card-header" style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--spacing-sm)',
                    flexWrap: 'wrap',
                    padding: 'var(--spacing-lg)'
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            marginBottom: '0.5rem'
                        }}>
                            <span style={{
                                fontSize: '1.5rem',
                                lineHeight: 1
                            }}>📋</span>
                            <h3 className="card-title" style={{
                                color: 'white',
                                margin: 0,
                                fontSize: 'clamp(1rem, 4vw, 1.25rem)',
                                fontWeight: '600',
                                lineHeight: 1.2
                            }}>
                                Chi Tiết Chưa Đồng Bộ
                            </h3>
                        </div>
                        <p style={{
                            fontSize: 'var(--font-size-sm)',
                            opacity: 0.9,
                            margin: 0,
                            paddingLeft: 'calc(1.5rem + var(--spacing-sm))'
                        }}>
                            {pendingList.length} điểm danh đang chờ
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.25rem',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            flexShrink: 0,
                            width: '2.5rem',
                            height: '2.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <span className="spinner"></span>
                            <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tải...</p>
                        </div>
                    ) : pendingList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-500)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                            <p>Không có điểm danh nào chờ đồng bộ</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {pendingList.map((item, index) => (
                                <div key={item.id} style={{
                                    border: '1px solid var(--color-gray-200)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--color-gray-50)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: 'var(--spacing-sm)'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-base)',
                                                fontWeight: '600',
                                                color: 'var(--color-gray-800)',
                                                marginBottom: 'var(--spacing-xs)'
                                            }}>
                                                {index + 1}. {item.className}
                                            </div>
                                            <div style={{
                                                fontSize: 'var(--font-size-sm)',
                                                color: 'var(--color-gray-600)',
                                                marginBottom: 'var(--spacing-xs)'
                                            }}>
                                                📅 {item.formattedDate} - {item.attendanceType}
                                            </div>
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-gray-500)'
                                            }}>
                                                🕐 Lưu lúc: {item.formattedTime}
                                            </div>
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-success)',
                                                marginTop: 'var(--spacing-xs)',
                                                fontWeight: '600'
                                            }}>
                                                ✓ {item.records?.filter(r => r.isPresent).length || 0} thiếu nhi có mặt
                                            </div>

                                            {/* Duplicate Warning */}
                                            {item.duplicateIds && item.duplicateIds.length > 1 && (
                                                <div style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    color: 'var(--color-warning)',
                                                    marginTop: 'var(--spacing-xs)',
                                                    fontWeight: '600',
                                                    background: 'rgba(251, 191, 36, 0.1)',
                                                    padding: 'var(--spacing-xs)',
                                                    borderRadius: 'var(--radius-sm)'
                                                }}>
                                                    ⚠️ {item.duplicateIds.length} điểm danh trùng lặp (sẽ xóa tất cả)
                                                </div>
                                            )}

                                            {/* Student List */}
                                            {item.records?.filter(r => r.isPresent).length > 0 && (
                                                <details style={{ marginTop: 'var(--spacing-sm)' }}>
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
                                                        {item.records
                                                            .filter(r => r.isPresent)
                                                            .map((record, idx) => (
                                                                <div key={idx} style={{
                                                                    padding: '0.25rem 0',
                                                                    borderBottom: '1px solid var(--color-gray-100)'
                                                                }}>
                                                                    {idx + 1}. {record.studentName}
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item)}
                                            disabled={deleting === item.id}
                                            className="btn btn-danger btn-sm"
                                            style={{ marginLeft: 'var(--spacing-sm)' }}
                                        >
                                            {deleting === item.id ? (
                                                <span className="spinner" style={{
                                                    width: '0.75rem',
                                                    height: '0.75rem',
                                                    borderWidth: '2px'
                                                }}></span>
                                            ) : (
                                                '🗑️'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {pendingList.length > 0 && (
                    <div style={{
                        padding: 'var(--spacing-lg)',
                        borderTop: '1px solid var(--color-gray-200)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-sm)'
                    }}>
                        <button
                            onClick={handleSyncAll}
                            disabled={syncing}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            {syncing ? (
                                <>
                                    <span className="spinner" style={{
                                        width: '1rem',
                                        height: '1rem',
                                        borderWidth: '2px',
                                        marginRight: 'var(--spacing-xs)'
                                    }}></span>
                                    Đang đồng bộ...
                                </>
                            ) : (
                                `🔄 Đồng bộ tất cả (${pendingList.length})`
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ width: '100%' }}
                        >
                            Đóng
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
