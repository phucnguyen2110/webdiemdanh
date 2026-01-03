import { useState, useEffect } from 'react';
import { subscribeToNetworkChanges } from '../utils/networkDetector';
import { subscribeToSync, forceSyncNow, getSyncStatus } from '../utils/syncManager';
import { getStorageStats } from '../utils/offlineStorage';
import PendingDetailsModal from './PendingDetailsModal';

export default function OfflineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        // Subscribe to network changes
        const unsubscribeNetwork = subscribeToNetworkChanges((online) => {
            setIsOnline(online);
        });

        // Subscribe to sync events
        const unsubscribeSync = subscribeToSync((event) => {
            if (event.type === 'sync_start') {
                setIsSyncing(true);
                setSyncProgress(null);
            } else if (event.type === 'sync_progress') {
                setSyncProgress(event);
            } else if (event.type === 'sync_complete') {
                setIsSyncing(false);
                setSyncProgress(null);
                setLastSyncResult(event.results);
                updatePendingCount();

                // Clear result after 5 seconds
                setTimeout(() => setLastSyncResult(null), 5000);
            } else if (event.type === 'sync_error') {
                setIsSyncing(false);
                setSyncProgress(null);
            }
        });

        // Update pending count periodically
        updatePendingCount();
        const interval = setInterval(updatePendingCount, 10000); // Every 10 seconds

        return () => {
            unsubscribeNetwork();
            unsubscribeSync();
            clearInterval(interval);
        };
    }, []);

    const updatePendingCount = async () => {
        try {
            const stats = await getStorageStats();
            setPendingCount(stats.pendingCount);
        } catch (error) {
            console.error('Failed to get storage stats:', error);
        }
    };

    const handleSyncNow = async () => {
        if (!isOnline || isSyncing) return;

        try {
            await forceSyncNow();
        } catch (error) {
            console.error('Sync failed:', error);
        }
    };

    // Don't show anything if online and no pending data
    if (isOnline && pendingCount === 0 && !isSyncing && !lastSyncResult) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '350px'
        }}
            className="offline-status-container"
        >
            {/* Main Status Card */}
            <div
                style={{
                    background: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
                    color: 'white',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    cursor: pendingCount > 0 ? 'pointer' : 'default'
                }}
                onClick={() => pendingCount > 0 && setShowDetails(!showDetails)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <div style={{ fontSize: '1.5rem' }}>
                        {isOnline ? '🟢' : '🔴'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>
                            {isOnline ? 'Đang Online' : 'Chế độ Offline'}
                        </div>
                        {pendingCount > 0 && (
                            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                {pendingCount} điểm danh chưa đồng bộ
                            </div>
                        )}
                        {isSyncing && syncProgress && (
                            <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                                Đang đồng bộ... {syncProgress.current}/{syncProgress.total}
                            </div>
                        )}
                    </div>
                    {pendingCount > 0 && (
                        <div style={{
                            background: 'rgba(255,255,255,0.3)',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {pendingCount}
                        </div>
                    )}
                </div>

                {/* Sync Progress Bar */}
                {isSyncing && syncProgress && (
                    <div style={{
                        marginTop: 'var(--spacing-sm)',
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: 'var(--radius-sm)',
                        height: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            background: 'white',
                            height: '100%',
                            width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                )}

                {/* Last Sync Result */}
                {lastSyncResult && (
                    <div style={{
                        marginTop: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-xs)',
                        opacity: 0.9
                    }}>
                        {lastSyncResult.failed > 0 ? (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                padding: 'var(--spacing-sm)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                                <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                                    ⚠️ Đồng bộ {lastSyncResult.success}/{lastSyncResult.success + lastSyncResult.failed}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>
                                    {lastSyncResult.failed} thất bại - Vui lòng liên hệ Admin
                                </div>
                            </div>
                        ) : (
                            <div>
                                ✅ Đã đồng bộ {lastSyncResult.success} điểm danh
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Details Panel */}
            {showDetails && pendingCount > 0 && (
                <div style={{
                    marginTop: 'var(--spacing-sm)',
                    background: 'white',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid var(--color-gray-200)'
                }}>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        marginBottom: 'var(--spacing-sm)',
                        color: 'var(--color-gray-700)'
                    }}>
                        <strong>Dữ liệu chưa đồng bộ:</strong>
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-gray-600)',
                        marginBottom: 'var(--spacing-md)'
                    }}>
                        • {pendingCount} buổi điểm danh
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-xs)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        <button
                            className="btn btn-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setModalOpen(true);
                            }}
                            style={{
                                flex: 1,
                                background: 'var(--color-primary)',
                                color: 'white'
                            }}
                        >
                            📋 Xem chi tiết
                        </button>
                    </div>

                    {/* Sync Error Warning */}
                    {lastSyncResult && lastSyncResult.failed > 0 && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: 'var(--spacing-sm)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            marginBottom: 'var(--spacing-sm)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-danger)'
                        }}>
                            <div style={{ fontWeight: '600', marginBottom: 'var(--spacing-xs)' }}>
                                ⚠️ Có lỗi khi đồng bộ
                            </div>
                            <div style={{ opacity: 0.9 }}>
                                {lastSyncResult.failed} điểm danh thất bại. Vui lòng liên hệ Admin để được hỗ trợ.
                            </div>
                        </div>
                    )}

                    {isOnline && (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleSyncNow}
                            disabled={isSyncing}
                            style={{ width: '100%' }}
                        >
                            {isSyncing ? (
                                <>
                                    <span className="spinner" style={{
                                        width: '1rem',
                                        height: '1rem',
                                        borderWidth: '2px',
                                        marginRight: 'var(--spacing-xs)'
                                    }} />
                                    Đang đồng bộ...
                                </>
                            ) : (
                                '🔄 Đồng bộ ngay'
                            )}
                        </button>
                    )}

                    {!isOnline && (
                        <div style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-warning)',
                            textAlign: 'center',
                            padding: 'var(--spacing-sm)',
                            background: 'var(--color-warning-light)',
                            borderRadius: 'var(--radius-sm)'
                        }}>
                            ⚠️ Sẽ tự động đồng bộ khi có mạng
                        </div>
                    )}
                </div>
            )}

            {/* Pending Details Modal */}
            <PendingDetailsModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    updatePendingCount();
                }}
            />
        </div>
    );
}
