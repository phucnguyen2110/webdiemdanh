import { useState, useEffect } from 'react';

/**
 * Smart Loading Component for Render Cold Start
 * Shows appropriate messages based on loading duration
 */
export default function SmartLoading({ message = 'Đang tải...', isFirstRequest = false }) {
    const [elapsed, setElapsed] = useState(0);
    const [currentTip, setCurrentTip] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const tips = [
        '💡 Mẹo: Bạn có thể điểm danh bằng QR Code để nhanh hơn!',
        '💡 Mẹo: Sử dụng tính năng "Chọn tất cả" để điểm danh nhanh!',
        '💡 Mẹo: File Excel sẽ tự động cập nhật sau khi điểm danh!',
        '💡 Mẹo: Bạn có thể xem lịch sử điểm danh ở trang "Lịch sử"!',
        '💡 Mẹo: Dữ liệu được lưu an toàn trên cloud!'
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Rotate tips every 5 seconds
        const tipTimer = setInterval(() => {
            setCurrentTip(prev => (prev + 1) % tips.length);
        }, 5000);

        return () => clearInterval(tipTimer);
    }, []);

    const getLoadingMessage = () => {
        if (!isFirstRequest) {
            return message;
        }

        if (elapsed < 5) {
            return '🔄 Đang kết nối đến server...';
        } else if (elapsed < 15) {
            return '⏰ Server đang khởi động (có thể mất 30-60 giây)...';
        } else if (elapsed < 30) {
            return '⏳ Vui lòng đợi thêm chút nữa...';
        } else if (elapsed < 45) {
            return '🚀 Sắp xong rồi...';
        } else {
            return '⌛ Gần hoàn thành...';
        }
    };

    const getProgressPercentage = () => {
        if (!isFirstRequest) return 50;

        // Estimate: cold start takes ~50 seconds
        const maxTime = 60;
        return Math.min((elapsed / maxTime) * 100, 95);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)',
            minHeight: isMobile ? '250px' : '300px'
        }}>
            {/* Spinner */}
            <div style={{
                width: isMobile ? '50px' : '60px',
                height: isMobile ? '50px' : '60px',
                border: '4px solid var(--color-gray-200)',
                borderTop: '4px solid var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: 'var(--spacing-lg)'
            }}></div>

            {/* Main Message */}
            <div style={{
                fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-lg)',
                fontWeight: '600',
                color: 'var(--color-gray-700)',
                marginBottom: 'var(--spacing-sm)',
                textAlign: 'center',
                padding: '0 var(--spacing-sm)'
            }}>
                {getLoadingMessage()}
            </div>

            {/* Progress Bar (for cold start) */}
            {isFirstRequest && elapsed > 3 && (
                <div style={{
                    width: '100%',
                    maxWidth: isMobile ? '300px' : '400px',
                    marginTop: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-md)',
                    padding: '0 var(--spacing-sm)'
                }}>
                    <div style={{
                        width: '100%',
                        height: isMobile ? '6px' : '8px',
                        background: 'var(--color-gray-200)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${getProgressPercentage()}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))',
                            transition: 'width 0.5s ease',
                            borderRadius: '4px'
                        }}></div>
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-gray-500)',
                        textAlign: 'center',
                        marginTop: 'var(--spacing-xs)'
                    }}>
                        {elapsed}s / ~60s
                    </div>
                </div>
            )}

            {/* Cold Start Explanation */}
            {isFirstRequest && elapsed > 10 && (
                <div style={{
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: 'var(--radius-md)',
                    padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                    maxWidth: isMobile ? '100%' : '500px',
                    fontSize: isMobile ? '0.8rem' : 'var(--font-size-sm)',
                    color: '#856404',
                    margin: '0 var(--spacing-sm)',
                    marginTop: 'var(--spacing-md)'
                }}>
                    <strong>ℹ️ Tại sao lâu vậy?</strong>
                    <p style={{
                        margin: 'var(--spacing-xs) 0 0 0',
                        lineHeight: '1.5'
                    }}>
                        Server đang ở chế độ ngủ để tiết kiệm tài nguyên.
                        Lần đầu truy cập sau 15 phút sẽ mất 30-60 giây để khởi động.
                        Các lần sau sẽ nhanh hơn nhiều!
                    </p>
                </div>
            )}

            {/* Tips */}
            {elapsed > 5 && (
                <div style={{
                    padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
                    background: 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: isMobile ? '100%' : '500px',
                    textAlign: 'center',
                    fontSize: isMobile ? '0.8rem' : 'var(--font-size-sm)',
                    color: 'var(--color-gray-600)',
                    animation: 'fadeIn 0.5s ease',
                    margin: '0 var(--spacing-sm)',
                    marginTop: 'var(--spacing-lg)'
                }}>
                    {tips[currentTip]}
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
