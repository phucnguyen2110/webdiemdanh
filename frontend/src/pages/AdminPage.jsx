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
        <div className="flex flex-col h-screen w-full mesh-gradient text-gray-900 font-sans overflow-hidden">
            {/* Ambient Background Blobs */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#7f0df2]/10 blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#a855f7]/10 blur-[80px]"></div>
            </div>

            {/* Header */}
            <header className="flex-none px-4 md:px-8 py-6 md:py-8 border-b border-gray-200 glass-card z-10">
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-gray-900 text-2xl md:text-3xl font-black tracking-tight">Quản Lý Người Dùng</h2>
                        <p className="text-gray-600 text-sm font-medium">Quản lý quyền truy cập, vai trò và phân lớp cho giáo lý viên</p>
                    </div>
                </div>
            </header>

            {/* Content Wrapper */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 z-10">
                <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-4 bg-gray-50 p-4 md:p-5 border-b border-gray-200 items-center justify-between">
                        <div className="relative flex-1 min-w-[250px] max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xl">search</span>
                            <input
                                type="text"
                                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-400"
                                placeholder="Tìm kiếm người dùng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Role Filter */}
                            <div className="relative">
                                <select
                                    className="bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-gray-900 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer hover:bg-gray-50"
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                >
                                    <option value="all">Vai trò: Tất cả</option>
                                    <option value="admin">Vai trò: Admin</option>
                                    <option value="user">Vai trò: User</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xl">expand_more</span>
                            </div>

                            {/* Add button */}
                            <button
                                className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5"
                                onClick={() => handleOpenModal()}
                            >
                                <span className="material-symbols-outlined text-xl">add</span>
                                <span className="hidden md:inline">Thêm mới</span>
                            </button>
                        </div>
                    </div>


                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Người dùng</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Vai trò</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Lớp phụ trách</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="text-center p-8 text-gray-600">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center p-8 text-gray-500">Không tìm thấy người dùng nào.</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm border-2 border-primary/20">
                                                        {getInitials(user.fullName || user.username)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-900 font-semibold text-sm">{user.fullName || user.full_name || user.username}</span>
                                                        <span className="text-gray-500 text-xs">{user.username}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                                                    {user.role === 'admin' ? (
                                                        <><span className="material-symbols-outlined text-sm">shield_person</span> Admin</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-sm">person</span> User</>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.role === 'admin' ? (
                                                    <span className="text-gray-500 italic text-sm">Tất cả lớp</span>
                                                ) : (user.assignedClasses?.length > 0 ? (
                                                    <div className="text-gray-700 text-sm">
                                                        {classes.filter(c => user.assignedClasses.includes(c.id)).map(c => c.name).join(', ')}
                                                    </div>
                                                ) : <span className="text-gray-400 text-xs">Chưa phân lớp</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="relative inline-block">
                                                    <button
                                                        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                                        onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                                                    >
                                                        <span className="material-symbols-outlined">more_vert</span>
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    {activeMenuId === user.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors" onClick={() => handleOpenModal(user)}>
                                                                <span className="material-symbols-outlined text-lg">edit</span> Sửa
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors" onClick={() => handleResetPassword(user.id, user.username)}>
                                                                <span className="material-symbols-outlined text-lg">lock_reset</span> Reset MK
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors" onClick={() => handleDelete(user.id, user.username)}>
                                                                <span className="material-symbols-outlined text-lg">delete</span> Xóa
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
                    <div className="md:hidden flex flex-col gap-4 p-4 pb-32">
                        {loading ? (
                            <div className="text-center p-8 text-gray-600">Đang tải...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center p-8 text-gray-500">Không tìm thấy kết quả.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div key={user.id} className="bg-white rounded-xl p-4 shadow-md border border-gray-200 flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm border-2 border-primary/20 flex-shrink-0">
                                        {getInitials(user.fullName || user.username)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h4 className="text-gray-900 font-semibold text-base">{user.fullName || user.full_name || user.username}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                                                {user.role === 'admin' ? (
                                                    <><span className="material-symbols-outlined text-xs">shield_person</span> Admin</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-xs">person</span> User</>
                                                )}
                                            </span>
                                            <span className="text-gray-500 text-xs">@{user.username}</span>
                                        </div>
                                        {user.role === 'user' && user.assignedClasses?.length > 0 && (
                                            <p className="text-gray-600 text-sm flex items-start gap-1.5">
                                                <span className="material-symbols-outlined text-sm mt-0.5">school</span>
                                                <span>{classes.filter(c => user.assignedClasses.includes(c.id)).map(c => c.name).join(', ')}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="relative action-menu-container flex-shrink-0">
                                        <button
                                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                            onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>

                                        {activeMenuId === user.id && (
                                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
                                                <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors" onClick={() => handleOpenModal(user)}>
                                                    <span className="material-symbols-outlined text-base">edit</span> Sửa
                                                </button>
                                                <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors" onClick={() => handleResetPassword(user.id, user.username)}>
                                                    <span className="material-symbols-outlined text-base">lock_reset</span> Reset MK
                                                </button>
                                                <button className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors" onClick={() => handleDelete(user.id, user.username)}>
                                                    <span className="material-symbols-outlined text-base">delete</span> Xóa
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
