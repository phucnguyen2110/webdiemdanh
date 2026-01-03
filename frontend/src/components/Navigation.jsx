import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

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
        { path: '/', label: 'Tạo lớp mới', icon: 'cloud_upload' },
        { path: '/files', label: 'Quản lý Lớp', icon: 'folder_open' },
        { path: '/attendance', label: 'Điểm danh', icon: 'check_circle' },
        { path: '/qr-scanner', label: 'Quét QR', icon: 'qr_code_scanner', hideOnMobile: true }, // Merged into Attendance page for mobile
        { path: '/grades', label: 'Nhập điểm', icon: 'edit_note' },
        { path: '/history', label: 'Lịch sử', icon: 'history' },
        { path: '/excel-viewer', label: 'Xem Excel', icon: 'table_view', desktopOnly: true },
        ...(isAdmin() ? [
            { path: '/admin', label: 'Quản lý TK', icon: 'manage_accounts' },
            { path: '/sync-monitor', label: 'Sync Monitor', icon: 'sync_problem' }
        ] : [])
    ];

    // Filter out desktop-only and hidden-on-mobile items
    const navItems = isMobile
        ? allNavItems.filter(item => !item.desktopOnly && !item.hideOnMobile)
        : allNavItems;

    // Mobile Bottom Navigation
    if (isMobile) {
        return (
            <nav style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '80px',
                background: 'rgba(17, 25, 33, 0.95)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '15px', // Environmental safe area
                paddingTop: '10px',
                zIndex: 1000,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.2)'
            }}>
                {/* Simplified Mobile Nav - limited items */}
                {navItems.slice(0, 5).map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                color: isActive ? '#7f0df2' : 'rgba(255, 255, 255, 0.4)',
                                flex: 1,
                                minWidth: 0,
                                position: 'relative'
                            }}
                        >
                            {/* Indicator Glow for active */}
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-25px',
                                    width: '30px',
                                    height: '3px',
                                    background: '#7f0df2',
                                    boxShadow: '0 0 10px #7f0df2',
                                    borderRadius: '4px'
                                }}></div>
                            )}
                            <span className="material-symbols-outlined" style={{
                                fontSize: '24px',
                                transition: 'all 0.3s ease',
                                transform: isActive ? 'scale(1.1)' : 'scale(1)'
                            }}>
                                {item.icon}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: isActive ? '700' : '500',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                padding: '0 2px'
                            }}>
                                {item.label.split(' ')[0]}
                            </span>
                        </Link>
                    )
                })}
                {/* Mobile Logout/Menu */}
                <button onClick={handleLogout} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.4)',
                    flex: 1,
                    minWidth: 0,
                    cursor: 'pointer'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>logout</span>
                    <span style={{ fontSize: '10px', fontWeight: '500' }}>Thoát</span>
                </button>
            </nav>
        );
    }

    // Desktop Sidebar Navigation
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Collapse Toggle Button */}
            <button
                className="sidebar-toggle"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <span className="material-symbols-outlined">
                    chevron_left
                </span>
            </button>

            <div className="sidebar-header">
                {/* Brand */}
                <div className="brand">
                    <div className="logo-container">
                        <div className="logo-overlay"></div>
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="logo-img"
                        />
                    </div>
                    <div className="brand-text">
                        <h1>Xứ Đoàn Giáo Hoàng Phao-lô VI</h1>
                        <p>Giáo xứ Chợ Cầu</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="nav-links">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                title={isCollapsed ? item.label : ''}
                            >
                                <span className="material-symbols-outlined nav-icon">
                                    {item.icon}
                                </span>
                                <span className="nav-text">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Footer / User Info */}
            <div className="sidebar-footer">
                {user && (
                    <div className="user-info">
                        <div className="user-name">
                            {user.username}
                        </div>
                        <div className="user-role">
                            {isAdmin() ? 'Administrator' : 'Giáo Lý Viên'}
                        </div>
                    </div>
                )}
                <button className="logout-btn" onClick={handleLogout} title={isCollapsed ? 'Sign Out' : ''}>
                    <span className="material-symbols-outlined nav-icon">logout</span>
                    <span className="nav-text">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
