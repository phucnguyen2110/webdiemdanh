import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, classesAPI } from '../services/api';
import Toast from '../components/Toast';
import './AdminPage.css';

export default function AdminPage() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all'); // all, admin, user
    const [activeMenuId, setActiveMenuId] = useState(null); // ID of user with open menu

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

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeMenuId && !event.target.closest('.action-menu-container')) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenuId]);

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
            setClasses(response.classes || []);
        } catch (err) {
            console.error('Không thể tải danh sách lớp:', err);
        }
    };

    const handleOpenModal = (user = null) => {
        setActiveMenuId(null); // Close menu if open
        if (user) {
            setEditingUser(user);
            setPasswordEditable(false);
            setFormData({
                username: user.username,
                password: '',
                fullName: user.fullName || user.full_name || '',
                role: user.role,
                assignedClasses: user.assignedClasses || []
            });
        } else {
            setEditingUser(null);
            setPasswordEditable(true);
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
                const updateData = {
                    username: formData.username,
                    fullName: formData.fullName,
                    role: formData.role,
                    assignedClasses: formData.assignedClasses
                };

                if (passwordEditable && formData.password) {
                    updateData.password = formData.password;
                }

                await usersAPI.update(editingUser.id, updateData);
            } else {
                await usersAPI.create(formData);
            }

            setSuccess(editingUser ? 'Đã cập nhật!' : 'Đã thêm người dùng!');
            handleCloseModal();
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể lưu người dùng');
        }
    };

    const handleDelete = async (userId, username) => {
        setActiveMenuId(null);
        if (!confirm(`Bạn có chắc muốn xóa người dùng "${username}"?`)) {
            return;
        }

        try {
            await usersAPI.delete(userId);
            setSuccess('Đã xóa người dùng!');
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Không thể xóa người dùng');
        }
    };

    const handleResetPassword = async (userId, username) => {
        setActiveMenuId(null);
        const newPassword = prompt(`Nhập mật khẩu mới cho "${username}":`);

        if (!newPassword) return;

        if (newPassword.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        try {
            await usersAPI.update(userId, { password: newPassword });
            setSuccess(`Đã reset mật khẩu cho "${username}"!`);
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

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (user.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;
        return matchesSearch && matchesRole;
    });

    if (!isAdmin()) {
        return (
            <div className="container" style={{ paddingTop: '2rem' }}>
                <div className="alert alert-danger">
                    Bạn không có quyền truy cập trang này
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-wrapper">
            {/* Header */}
            <header className="admin-header">
                {/* Breadcrumbs */}
                <div className="breadcrumb">
                    <span className="breadcrumb-item">Dashboard</span>
                    <span className="breadcrumb-divider">/</span>
                    <span className="breadcrumb-item breadcrumb-active">Quản lý người dùng</span>
                </div>

                <div>
                    <h2 className="admin-title">Quản Lý Người Dùng</h2>
                    <p className="admin-subtitle">Quản lý quyền truy cập, vai trò và phân lớp cho giáo lý viên.</p>
                </div>
            </header>

            {/* Glass Panel Content */}
            <div className="admin-content-wrapper">
                <div className="glass-panel-container">
                    {/* Toolbar */}
                    <div className="admin-toolbar">
                        <div className="search-box">
                            <span className="material-symbols-outlined search-icon">search</span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Tìm kiếm người dùng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Filter Button */}
                            <div className="filter-btn">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_list</span>
                                <span>Lọc</span>
                            </div>
                            <div className="divider-vertical"></div>

                            {/* Role Filter */}
                            <div className="relative">
                                <select
                                    className="role-select"
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                >
                                    <option value="all">Vai trò: Tất cả</option>
                                    <option value="admin">Vai trò: Admin</option>
                                    <option value="user">Vai trò: User</option>
                                </select>
                            </div>
                            <div className="divider-vertical"></div>

                            {/* Add button */}
                            <button className="btn-add btn-add-desktop" onClick={() => handleOpenModal()}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                                <span>Thêm mới</span>
                            </button>
                        </div>
                    </div>


                    {/* Desktop Table View */}
                    <div className="admin-table-container custom-scrollbar">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Người dùng</th>
                                    <th>Vai trò</th>
                                    <th>Lớp phụ trách</th>
                                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="text-center p-8">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center p-8 text-slate-400">Không tìm thấy người dùng nào.</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="user-info">
                                                    <div className="avatar">
                                                        {getInitials(user.fullName || user.username)}
                                                    </div>
                                                    <div className="user-details">
                                                        <span className="user-name">{user.fullName || user.full_name || user.username}</span>
                                                        <span className="user-email">{user.username}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                                                    {user.role === 'admin' ? (
                                                        <><span className="material-symbols-outlined text-[14px]">shield_person</span> Admin</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-[14px]">person</span> User</>
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                {user.role === 'admin' ? (
                                                    <span className="text-slate-500 italic">Tất cả lớp</span>
                                                ) : (user.assignedClasses?.length > 0 ? (
                                                    <div className="assigned-classes">
                                                        {classes.filter(c => user.assignedClasses.includes(c.id)).map(c => c.name).join(', ')}
                                                    </div>
                                                ) : <span className="text-slate-500 text-xs">Chưa phân lớp</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="relative action-menu-container" style={{ display: 'inline-block' }}>
                                                    <button
                                                        className="action-btn"
                                                        onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                                                    >
                                                        <span className="material-symbols-outlined">more_vert</span>
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    {activeMenuId === user.id && (
                                                        <div className="dropdown-menu">
                                                            <button className="dropdown-item" onClick={() => handleOpenModal(user)}>
                                                                <span className="material-symbols-outlined">edit</span> Sửa
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => handleResetPassword(user.id, user.username)}>
                                                                <span className="material-symbols-outlined">lock_reset</span> Reset MK
                                                            </button>
                                                            <button className="dropdown-item text-danger" onClick={() => handleDelete(user.id, user.username)}>
                                                                <span className="material-symbols-outlined">delete</span> Xóa
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List View */}
                    <div className="mobile-list">
                        {loading ? (
                            <div className="text-center p-8 text-slate-400">Đang tải...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center p-8 text-slate-400">Không tìm thấy kết quả.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div key={user.id} className="glass-card mobile-card">
                                    <div className="avatar">
                                        {getInitials(user.fullName || user.username)}
                                    </div>

                                    <div className="mobile-user-content">
                                        <div className="mobile-user-header">
                                            <h4 className="user-name">{user.fullName || user.full_name || user.username}</h4>
                                        </div>
                                        <div className="mobile-user-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                                                {user.role === 'admin' ? 'Admin' : 'User'}
                                            </span>
                                            <p className="user-email">{user.username}</p>
                                        </div>
                                        {user.role === 'user' && user.assignedClasses?.length > 0 && (
                                            <p className="mobile-classes-text">
                                                {classes.filter(c => user.assignedClasses.includes(c.id)).map(c => c.name).join(', ')}
                                            </p>
                                        )}
                                    </div>

                                    <div className="relative action-menu-container">
                                        <button
                                            className="action-btn"
                                            onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>

                                        {activeMenuId === user.id && (
                                            <div className="dropdown-menu">
                                                <button className="dropdown-item" onClick={() => handleOpenModal(user)}>
                                                    <span className="material-symbols-outlined">edit</span> Sửa
                                                </button>
                                                <button className="dropdown-item" onClick={() => handleResetPassword(user.id, user.username)}>
                                                    <span className="material-symbols-outlined">lock_reset</span> Reset MK
                                                </button>
                                                <button className="dropdown-item text-danger" onClick={() => handleDelete(user.id, user.username)}>
                                                    <span className="material-symbols-outlined">delete</span> Xóa
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile FAB */}
            <button className="fab" onClick={() => handleOpenModal()}>
                <span className="material-symbols-outlined">add</span>
            </button>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingUser ? 'Sửa Người Dùng' : 'Thêm Người Dùng'}</h2>
                            <button onClick={handleCloseModal} className="modal-close-btn">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="modal-form-group">
                                    <label className="modal-label">Tên đăng nhập</label>
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                        disabled={editingUser !== null}
                                        placeholder="Nhập tên đăng nhập"
                                    />
                                </div>

                                <div className="modal-form-group">
                                    <label className="modal-label">Họ và tên</label>
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Nhập họ và tên hiển thị"
                                    />
                                </div>

                                <div className="modal-form-group">
                                    <label className="modal-label modal-label-flex">
                                        <span>Mật khẩu</span>
                                        {editingUser && (
                                            <span
                                                className="password-toggle-link"
                                                onClick={() => {
                                                    const newState = !passwordEditable;
                                                    setPasswordEditable(newState);
                                                    if (!newState) setFormData({ ...formData, password: '' });
                                                }}
                                            >
                                                {passwordEditable ? 'Hủy đổi mật khẩu' : 'Đổi mật khẩu'}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="password"
                                        className="modal-input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser || passwordEditable}
                                        disabled={editingUser && !passwordEditable}
                                        placeholder={editingUser && !passwordEditable ? 'Nhấn "Đổi mật khẩu" để nhập mới' : 'Nhập mật khẩu (tối thiểu 6 ký tự)'}
                                    />
                                </div>

                                <div className="modal-form-group">
                                    <label className="modal-label">Vai trò</label>
                                    <select
                                        className="modal-select"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="user">User - Giáo lý viên</option>
                                        <option value="admin">Admin - Quản trị viên</option>
                                    </select>
                                </div>

                                {formData.role === 'user' && (
                                    <div className="modal-form-group">
                                        <label className="modal-label">Lớp phụ trách</label>
                                        <div className="classes-container custom-scrollbar">
                                            {classes.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                                                    Chưa có lớp nào
                                                </div>
                                            ) : (
                                                classes.map(cls => (
                                                    <div key={cls.id} className="class-checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            id={`cls-${cls.id}`}
                                                            className="class-checkbox"
                                                            checked={formData.assignedClasses.includes(cls.id)}
                                                            onChange={() => handleClassToggle(cls.id)}
                                                        />
                                                        <label htmlFor={`cls-${cls.id}`} className="class-label">{cls.name}</label>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={handleCloseModal} className="modal-btn-cancel">Hủy</button>
                                <button type="submit" className="modal-btn-submit">
                                    {editingUser ? 'Cập nhật' : 'Thêm mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <div className="toast-container">
                {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}
                {error && <Toast type="error" message={error} onClose={() => setError('')} />}
            </div>
        </div>
    );
}
