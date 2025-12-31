import { useState, useEffect } from 'react';
import networkDetector from '../utils/networkDetector';

export default function OfflineFirstTimeGuide() {
    const [show, setShow] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        // Check if user has seen the guide before
        const hasSeenGuide = localStorage.getItem('hasSeenOfflineGuide');

        // Subscribe to network changes
        const unsubscribe = networkDetector.subscribe((online) => {
            setIsOnline(online);

            // Show guide if offline and haven't seen it before
            if (!online && !hasSeenGuide) {
                setShow(true);
            }
        });

        return unsubscribe;
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('hasSeenOfflineGuide', 'true');
        setShow(false);
    };

    if (!show || isOnline) return null;

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
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div className="card" style={{
                maxWidth: '500px',
                width: '100%',
                animation: 'slideIn 0.3s ease-out'
            }}>
                <div className="card-header" style={{
                    background: 'var(--color-warning)',
                    color: 'white'
                }}>
                    <h3 className="card-title" style={{ color: 'white', marginBottom: '0.5rem' }}>
                        📴 Chế Độ Offline
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9, margin: 0 }}>
                        Hướng dẫn sử dụng khi không có mạng
                    </p>
                </div>

                <div style={{ padding: 'var(--spacing-xl)' }}>
                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-base)',
                            marginBottom: 'var(--spacing-md)',
                            color: 'var(--color-gray-700)'
                        }}>
                            ⚠️ Lưu ý quan trọng:
                        </h4>
                        <div style={{
                            background: 'var(--color-warning-light)',
                            padding: 'var(--spacing-md)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--spacing-md)'
                        }}>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
                                Để sử dụng chế độ offline, bạn cần <strong>kết nối mạng ít nhất 1 lần</strong> để tải dữ liệu lớp học và thiếu nhi.
                            </p>
                        </div>
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-base)',
                            marginBottom: 'var(--spacing-md)',
                            color: 'var(--color-gray-700)'
                        }}>
                            ✅ Sau khi có dữ liệu, bạn có thể:
                        </h4>
                        <ul style={{
                            paddingLeft: '1.5rem',
                            margin: 0,
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-gray-600)'
                        }}>
                            <li style={{ marginBottom: 'var(--spacing-xs)' }}>
                                Điểm danh hoàn toàn offline
                            </li>
                            <li style={{ marginBottom: 'var(--spacing-xs)' }}>
                                Xem danh sách lớp và thiếu nhi
                            </li>
                            <li style={{ marginBottom: 'var(--spacing-xs)' }}>
                                Tất cả dữ liệu sẽ tự động đồng bộ khi có mạng
                            </li>
                        </ul>
                    </div>

                    <div style={{
                        background: 'var(--color-primary-light)',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-primary)'
                        }}>
                            💡 <strong>Mẹo:</strong> Hãy mở app và tải dữ liệu khi có WiFi, sau đó bạn có thể điểm danh offline mọi lúc mọi nơi!
                        </p>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
