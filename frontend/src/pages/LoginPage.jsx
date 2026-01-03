import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    // Load saved credentials on mount
    useEffect(() => {
        const savedUsername = localStorage.getItem('rememberedUsername');
        const savedPassword = localStorage.getItem('rememberedPassword');

        if (savedUsername && savedPassword) {
            setUsername(savedUsername);
            setPassword(savedPassword);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);

            // Save credentials if remember me is checked
            if (rememberMe) {
                localStorage.setItem('rememberedUsername', username);
                localStorage.setItem('rememberedPassword', password);
            } else {
                // Clear saved credentials if not checked
                localStorage.removeItem('rememberedUsername');
                localStorage.removeItem('rememberedPassword');
            }

            navigate('/');
        } catch (err) {
            setError(err.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleRememberMeChange = (e) => {
        const checked = e.target.checked;
        setRememberMe(checked);

        // If unchecking, clear saved credentials immediately
        if (!checked) {
            localStorage.removeItem('rememberedUsername');
            localStorage.removeItem('rememberedPassword');
        }
    };

    return (
        <div className="login-page-wrapper">
            {/* Background Elements */}
            <div className="login-bg-gradient"></div>
            <div className="login-bg-pattern"></div>
            <div className="login-orb login-orb-1"></div>
            <div className="login-orb login-orb-2"></div>

            {/* Glass Card */}
            <div className="login-card">
                <div className="login-card-line"></div>

                {/* Header */}
                <div className="login-header">
                    <div className="login-icon-box">
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'white' }}>
                            school
                        </span>
                    </div>
                    <h1 className="login-title">Quản Lý Thiếu Nhi</h1>
                    <p className="login-subtitle">Đăng nhập để tiếp tục quản lý</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {/* Username */}
                    <div className="login-form-group">
                        <label className="login-label" htmlFor="username">Username</label>
                        <div className="login-input-wrapper">
                            <div className="login-input-icon">
                                <span className="material-symbols-outlined">person</span>
                            </div>
                            <input
                                id="username"
                                type="text"
                                className="login-input"
                                placeholder="Nhập tên đăng nhập"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="login-form-group">
                        <label className="login-label" htmlFor="password">Password</label>
                        <div className="login-input-wrapper">
                            <div className="login-input-icon">
                                <span className="material-symbols-outlined">lock</span>
                            </div>
                            <input
                                id="password"
                                type={isPasswordVisible ? "text" : "password"}
                                className="login-input"
                                placeholder="Nhập mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="login-input-action"
                                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                tabIndex="-1"
                            >
                                <span className="material-symbols-outlined">
                                    {isPasswordVisible ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="login-options">
                        <label className="login-toggle">
                            <input
                                type="checkbox"
                                className="login-toggle-input"
                                checked={rememberMe}
                                onChange={handleRememberMeChange}
                            />
                            <div className="login-toggle-track">
                                <div className="login-toggle-thumb"></div>
                            </div>
                            <span className="login-toggle-label">Nhớ tài khoản</span>
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="login-alert login-alert-error" style={{ marginTop: '1.5rem', marginBottom: '0' }}>
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading}
                    >
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>

                {/* Footer */}
                <div className="login-footer">
                    <p>
                        Chưa có tài khoản?{' '}
                        <a href="https://zalo.me/0708216986" target="_blank" rel="noopener noreferrer" className="login-link">Liên hệ Admin</a>
                    </p>
                </div>
            </div>

            {/* Version / Branding */}
            <div style={{
                position: 'fixed',
                bottom: '1rem',
                textAlign: 'center',
                width: '100%',
                opacity: 0.5,
                fontSize: '0.75rem',
                color: 'var(--login-text-muted)',
                pointerEvents: 'none'
            }}>
                Xứ Đoàn Giáo Hoàng Phao-lô VI - Giáo xứ Chợ Cầu
            </div>
        </div>
    );
}
