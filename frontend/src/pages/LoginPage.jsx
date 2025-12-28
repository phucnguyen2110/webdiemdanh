import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--color-gray-50) 0%, var(--color-primary-light) 100%)',
            padding: 'var(--spacing-md)'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: 'clamp(var(--spacing-lg), 5vw, var(--spacing-2xl))'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        <h1 style={{
                            fontSize: 'clamp(var(--font-size-2xl), 6vw, var(--font-size-3xl))',
                            margin: 0,
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Quản Lý Thiếu Nhi
                        </h1>
                    </div>
                    <p style={{
                        color: 'var(--color-gray-400)',
                        fontSize: 'clamp(var(--font-size-xs), 3vw, var(--font-size-sm))'
                    }}>
                        Đăng nhập để tiếp tục
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="username">
                            Tên đăng nhập
                        </label>
                        <input
                            id="username"
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                            placeholder="Nhập tên đăng nhập"
                            style={{
                                fontSize: 'clamp(var(--font-size-sm), 3.5vw, var(--font-size-base))'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">
                            Mật khẩu
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Nhập mật khẩu"
                            style={{
                                fontSize: 'clamp(var(--font-size-sm), 3.5vw, var(--font-size-base))'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                className="checkbox-input"
                                checked={rememberMe}
                                onChange={handleRememberMeChange}
                            />
                            <label
                                htmlFor="rememberMe"
                                className="checkbox-label"
                                style={{
                                    fontSize: 'clamp(var(--font-size-xs), 3.5vw, var(--font-size-sm))'
                                }}
                            >
                                💾 Nhớ tài khoản
                            </label>
                        </div>
                        <p style={{
                            fontSize: 'clamp(10px, 2.5vw, var(--font-size-xs))',
                            color: 'var(--color-gray-400)',
                            marginTop: 'var(--spacing-xs)',
                            marginLeft: 'clamp(var(--spacing-lg), 5vw, var(--spacing-xl))'
                        }}>
                            Tài khoản sẽ được lưu trên thiết bị này
                        </p>
                    </div>

                    {error && (
                        <div
                            className="alert alert-danger"
                            style={{
                                marginBottom: 'var(--spacing-lg)',
                                fontSize: 'clamp(var(--font-size-xs), 3vw, var(--font-size-sm))'
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%',
                            fontSize: 'clamp(var(--font-size-sm), 3.5vw, var(--font-size-base))',
                            padding: 'clamp(var(--spacing-sm), 3vw, var(--spacing-md)) var(--spacing-lg)'
                        }}
                    >
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}
