import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, classesAPI } from '../services/api';

export default function AdminPage() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [passwordEditable, setPasswordEditable] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        fullName: '',
        role: 'user',
        assignedClasses: []
    });

    // Detect mobile on resize
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isAdmin()) {
            loadUsers();
            loadClasses();
        }
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const response = await usersAPI.getAll();
            // Interceptor already returns response.data, so response = { users: [...] }
            setUsers(response.users || []);
        } catch (err) {
            setError('Không thể tải danh sách người dùng');
            console.error('Load users error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadClasses = async () => {
        try {
            const response = await classesAPI.getAll();
            // Interceptor already returns response.data
            setClasses(response.classes || []);
        } catch (err) {
            console.error('Không thể tải danh sách lớp:', err);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            // Editing existing user
            setEditingUser(user);
            setPasswordEditable(false); // Password disabled by default
            setFormData({
                username: user.username,
                password: '',
                fullName: user.fullName || user.full_name || '',
                role: user.role,
                assignedClasses: user.assignedClasses || []
            });
        } else {
            // Adding new user
            setEditingUser(null);
            setPasswordEditable(true); // Password required for new user
            setFormData({
                username: '',
                password: '',
                fullName: '',
                role: 'user',
                assignedClasses: []
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setFormData({
            username: '',
            password: '',
            role: 'user',
            assignedClasses: []
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingUser) {
                // For editing: only include password if it's being edited and has a value
                const updateData = {
                    username: formData.username,
                    fullName: formData.fullName,
                    role: formData.role,
                    assignedClasses: formData.assignedClasses
                };

                // Only add password if user clicked edit button and entered a value
                if (passwordEditable && formData.password) {
                    updateData.password = formData.password;
                }

                await usersAPI.update(editingUser.id, updateData);
            } else {
                // For creating: password is required
                await usersAPI.create(formData);
            }

            setSuccess(editingUser ? 'Cập nhật thành công!' : 'Thêm người dùng thành công!');
            handleCloseModal();
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể lưu người dùng');
        }
    };

    const handleDelete = async (userId, username) => {
        if (!confirm(`Bạn có chắc muốn xóa người dùng "${username}"?`)) {
            return;
        }

        try {
            await usersAPI.delete(userId);
            setSuccess('Xóa người dùng thành công!');
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể xóa người dùng');
        }
    };

    const handleResetPassword = async (userId, username) => {
        const newPassword = prompt(`Nhập mật khẩu mới cho "${username}":`);

        if (!newPassword) {
            return; // User cancelled
        }

        if (newPassword.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        try {
            await usersAPI.update(userId, { password: newPassword });
            setSuccess(`Đã reset mật khẩu cho "${username}" thành công!`);
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể reset mật khẩu');
        }
    };

    const handleClassToggle = (classId) => {
        setFormData(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.includes(classId)
                ? prev.assignedClasses.filter(id => id !== classId)
                : [...prev.assignedClasses, classId]
        }));
    };

    const getClassNames = (classIds) => {
        if (!classIds || classIds.length === 0) return 'Chưa có lớp';

        const validClassNames = classIds
            .map(id => classes.find(c => c.id === id))
            .filter(c => c) // Valid classes only
            .map(c => c.name);

        if (validClassNames.length === 0) return 'Chưa có lớp';

        return validClassNames.join(', ');
    };

    if (!isAdmin()) {
        return (
            <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
                <div className="alert alert-danger">
                    Bạn không có quyền truy cập trang này
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
            <div className="card">
                <div className="card-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-md)'
                }}>
                    <div>
                        <h1 className="card-title">👥 Quản lý tài khoản</h1>
                        <p className="card-subtitle">Quản lý người dùng và phân quyền lớp học</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleOpenModal()}
                    >
                        ➕ Thêm người dùng
                    </button>
                </div>

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        {success}
                    </div>
                )}

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Đang tải...</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop: Table view */}
                        <div style={{
                            overflowX: 'auto',
                            display: window.innerWidth >= 768 ? 'block' : 'none'
                        }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 'clamp(var(--font-size-xs), 2.5vw, var(--font-size-sm))'
                            }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-gray-100)' }}>
                                        <th style={{
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'left',
                                            border: '1px solid var(--color-gray-200)'
                                        }}>
                                            Tên đăng nhập
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'left',
                                            border: '1px solid var(--color-gray-200)'
                                        }}>
                                            Họ và Tên GLV
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'left',
                                            border: '1px solid var(--color-gray-200)'
                                        }}>
                                            Vai trò
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'left',
                                            border: '1px solid var(--color-gray-200)'
                                        }}>
                                            Lớp được phân công
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-md)',
                                            textAlign: 'center',
                                            border: '1px solid var(--color-gray-200)',
                                            width: '250px'
                                        }}>
                                            Thao tác
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id} style={{
                                            borderBottom: '1px solid var(--color-gray-200)',
                                            transition: 'background var(--transition-fast)'
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-gray-50)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: 'var(--spacing-md)', border: '1px solid var(--color-gray-200)' }}>
                                                {user.username}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-md)', border: '1px solid var(--color-gray-200)' }}>
                                                {user.fullName || user.full_name || '-'}
                                            </td>
                                            <td style={{ padding: 'var(--spacing-md)', border: '1px solid var(--color-gray-200)' }}>
                                                <span style={{
                                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: user.role === 'admin'
                                                        ? 'var(--color-danger-light)'
                                                        : 'var(--color-primary-light)',
                                                    color: user.role === 'admin'
                                                        ? 'var(--color-danger)'
                                                        : 'var(--color-primary)',
                                                    fontWeight: '500',
                                                    fontSize: 'var(--font-size-xs)'
                                                }}>
                                                    {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-md)', border: '1px solid var(--color-gray-200)' }}>
                                                {user.role === 'admin' ? (
                                                    <span style={{ color: 'var(--color-gray-400)', fontStyle: 'italic' }}>
                                                        Tất cả lớp
                                                    </span>
                                                ) : (
                                                    getClassNames(user.assignedClasses)
                                                )}
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-md)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center'
                                            }}>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleOpenModal(user)}
                                                    style={{
                                                        marginRight: 'var(--spacing-xs)',
                                                        background: 'var(--color-primary)',
                                                        color: 'white'
                                                    }}
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleResetPassword(user.id, user.username)}
                                                    style={{
                                                        marginRight: 'var(--spacing-xs)',
                                                        background: 'var(--color-warning)',
                                                        color: 'white'
                                                    }}
                                                >
                                                    🔑 Reset MK
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(user.id, user.username)}
                                                >
                                                    🗑️ Xóa
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: Card view */}
                        <div style={{
                            display: window.innerWidth < 768 ? 'block' : 'none'
                        }}>
                            {users.map(user => (
                                <div key={user.id} className="card" style={{
                                    marginBottom: 'var(--spacing-md)',
                                    padding: 'var(--spacing-md)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: 'var(--spacing-sm)'
                                    }}>
                                        <div>
                                            <h3 style={{
                                                margin: 0,
                                                fontSize: 'var(--font-size-lg)',
                                                marginBottom: 'var(--spacing-xs)'
                                            }}>
                                                {user.username}
                                            </h3>
                                            <div style={{
                                                fontSize: 'var(--font-size-sm)',
                                                color: 'var(--color-gray-600)',
                                                marginBottom: 'var(--spacing-xs)',
                                                fontStyle: 'italic'
                                            }}>
                                                {user.fullName || user.full_name || ''}
                                            </div>
                                            <span style={{
                                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                borderRadius: 'var(--radius-sm)',
                                                background: user.role === 'admin'
                                                    ? 'var(--color-danger-light)'
                                                    : 'var(--color-primary-light)',
                                                color: user.role === 'admin'
                                                    ? 'var(--color-danger)'
                                                    : 'var(--color-primary)',
                                                fontWeight: '500',
                                                fontSize: 'var(--font-size-xs)'
                                            }}>
                                                {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginBottom: 'var(--spacing-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-gray-600)'
                                    }}>
                                        <strong>Lớp:</strong>{' '}
                                        {user.role === 'admin' ? (
                                            <span style={{ fontStyle: 'italic' }}>Tất cả lớp</span>
                                        ) : (
                                            getClassNames(user.assignedClasses)
                                        )}
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        gap: 'var(--spacing-xs)',
                                        flexWrap: 'wrap'
                                    }}>
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => handleOpenModal(user)}
                                            style={{
                                                flex: '1 1 auto',
                                                background: 'var(--color-primary)',
                                                color: 'white',
                                                minWidth: '80px'
                                            }}
                                        >
                                            ✏️ Sửa
                                        </button>
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => handleResetPassword(user.id, user.username)}
                                            style={{
                                                flex: '1 1 auto',
                                                background: 'var(--color-warning)',
                                                color: 'white',
                                                minWidth: '100px'
                                            }}
                                        >
                                            🔑 Reset MK
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDelete(user.id, user.username)}
                                            style={{
                                                flex: '1 1 auto',
                                                minWidth: '80px'
                                            }}
                                        >
                                            🗑️ Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {users.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--spacing-3xl)',
                                color: 'var(--color-gray-400)'
                            }}>
                                Chưa có người dùng nào
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: 'var(--spacing-lg)'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--spacing-lg)'
                        }}>
                            <h2 style={{ margin: 0 }}>
                                {editingUser ? 'Chỉnh sửa người dùng' : '➕ Thêm người dùng'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: 'var(--font-size-2xl)',
                                    cursor: 'pointer',
                                    color: 'var(--color-gray-400)'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    disabled={editingUser !== null}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Họ và Tên Giáo Lý Viên</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Nhập họ và tên"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    Mật khẩu {editingUser && !passwordEditable}
                                    {editingUser && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newState = !passwordEditable;
                                                setPasswordEditable(newState);
                                                // Clear password when disabling edit
                                                if (!newState) {
                                                    setFormData({ ...formData, password: '' });
                                                }
                                            }}
                                            style={{
                                                background: passwordEditable ? 'var(--color-success)' : 'var(--color-primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-xs)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-xs)'
                                            }}
                                            title={passwordEditable ? 'Hủy đổi mật khẩu' : 'Đổi mật khẩu'}
                                        >
                                            {passwordEditable ? '✓ Đang đổi' : '✏️'}
                                        </button>
                                    )}
                                </label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser || passwordEditable}
                                    disabled={editingUser && !passwordEditable}
                                    placeholder={editingUser && passwordEditable ? 'Nhập mật khẩu mới' : (!editingUser ? 'Nhập mật khẩu' : '')}
                                    style={{
                                        background: editingUser && !passwordEditable ? 'var(--color-gray-100)' : 'white',
                                        cursor: editingUser && !passwordEditable ? 'not-allowed' : 'text'
                                    }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Vai trò</label>
                                <select
                                    className="form-select"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="user">👤 User</option>
                                    <option value="admin">👑 Admin</option>
                                </select>
                            </div>

                            {formData.role === 'user' && (
                                <div className="form-group">
                                    <label className="form-label">Lớp được phân công</label>
                                    <div style={{
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        border: '1px solid var(--color-gray-200)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--spacing-sm)'
                                    }}>
                                        {classes.map(cls => (
                                            <div key={cls.id} className="checkbox-group">
                                                <input
                                                    type="checkbox"
                                                    id={`class-${cls.id}`}
                                                    className="checkbox-input"
                                                    checked={formData.assignedClasses.includes(cls.id)}
                                                    onChange={() => handleClassToggle(cls.id)}
                                                />
                                                <label htmlFor={`class-${cls.id}`} className="checkbox-label">
                                                    {cls.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-md)',
                                marginTop: 'var(--spacing-xl)'
                            }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleCloseModal}
                                    style={{ flex: 1 }}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    {editingUser ? 'Cập nhật' : 'Thêm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
