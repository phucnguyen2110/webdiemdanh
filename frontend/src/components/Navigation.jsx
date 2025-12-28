import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navigation() {
    const location = useLocation();
    const { user, isAdmin, logout } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Detect mobile on resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            logout();
        }
    };

    const allNavItems = [
        { path: '/', label: '📤 Upload', icon: '📤', shortLabel: 'Upload' },
        { path: '/files', label: '📚 Quản lý', icon: '📚', shortLabel: 'Quản lý' },
        { path: '/excel-viewer', label: '📊 Xem Excel', icon: '📊', shortLabel: 'Excel', desktopOnly: true },
        { path: '/attendance', label: '✅ Điểm danh', icon: '✅', shortLabel: 'Điểm danh' },
        { path: '/grades', label: '📝 Nhập điểm', icon: '📝', shortLabel: 'Nhập điểm' },
        { path: '/history', label: '📜 Lịch sử', icon: '📜', shortLabel: 'Lịch sử' },
        ...(isAdmin() ? [{ path: '/admin', label: '👥 Quản lý TK', icon: '👥', shortLabel: 'Admin' }] : [])
    ];

    // Filter out desktop-only items on mobile
    const navItems = isMobile
        ? allNavItems.filter(item => !item.desktopOnly)
        : allNavItems;

    return (
        <nav style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            boxShadow: 'var(--shadow-lg)',
            marginBottom: 'var(--spacing-xl)'
        }}>
            <div className="container">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--spacing-md) 0',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-md)'
                }}>
                    {/* Logo */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        fontSize: 'clamp(1rem, 4vw, 1.5rem)',
                        fontWeight: '700',
                        color: 'var(--color-white)',
                        whiteSpace: 'nowrap'
                    }}>
                        <img
                            src="/logo.png"
                            alt="Logo Thiếu Nhi Thánh Thể"
                            style={{
                                height: '32px',
                                width: 'auto',
                                objectFit: 'contain'
                            }}
                        />
                        <span>Quản Lý Thiếu Nhi</span>
                    </div>

                    {/* Nav Links */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-xs)',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end'
                    }}>
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    style={{
                                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--color-white)',
                                        textDecoration: 'none',
                                        fontWeight: '500',
                                        fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                                        background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                                        transition: 'background var(--transition-fast)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-xs)',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                >
                                    <span>{item.icon}</span>
                                    <span className="nav-label">{item.shortLabel}</span>
                                </Link>
                            );
                        })}

                        {/* User Info & Logout */}
                        {user && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                marginLeft: 'var(--spacing-md)',
                                paddingLeft: 'var(--spacing-md)',
                                borderLeft: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                                <div style={{
                                    color: 'white',
                                    fontSize: 'var(--font-size-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-xs)'
                                }}>
                                    <span>{user.username}</span>
                                    {isAdmin() && (
                                        <span style={{
                                            background: 'var(--color-warning)',
                                            color: 'var(--color-gray-800)',
                                            padding: '2px 6px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: '600'
                                        }}>
                                            ADMIN
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        border: 'none',
                                        padding: 'var(--spacing-xs) var(--spacing-md)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: '500',
                                        transition: 'all var(--transition-fast)',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                                >
                                    🚪 Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
