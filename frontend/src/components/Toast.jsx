import { useEffect } from 'react';

export default function Toast({ type, message, onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto dismiss after 5 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

    const isSuccess = type === 'success';
    const icon = isSuccess ? 'check_circle' : 'error';
    const title = isSuccess ? 'Thành công!' : 'Lỗi!';

    return (
        <div
            className={`toast ${isSuccess ? 'toast-success' : 'toast-error'}`}
            onClick={onClose}
        >
            <span className="material-symbols-outlined toast-icon">{icon}</span>
            <div className="toast-content">
                <div className="toast-title">{title}</div>
                <div className="toast-message">{message}</div>
            </div>
            <button
                className="toast-close"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            >
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    );
}
