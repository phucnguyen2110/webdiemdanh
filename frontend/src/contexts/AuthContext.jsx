import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Define refreshUser first so it can be used in useEffect
    const refreshUser = async () => {
        try {
            const response = await authAPI.getMe();
            const data = response.data || response;

            console.log('📥 Raw API response:', data);

            const newAssignedClasses = data.assignedClasses || data.assigned_classes || [];
            const oldAssignedClasses = user?.assignedClasses || [];

            const userData = {
                id: data.id,
                username: data.username,
                role: data.role,
                // Handle both camelCase and snake_case from backend
                assignedClasses: newAssignedClasses
            };

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('✅ User data refreshed:', userData);

            // Check if assignedClasses changed
            const hasChanged = JSON.stringify(oldAssignedClasses.sort()) !== JSON.stringify(newAssignedClasses.sort());
            if (hasChanged) {
                console.log('🔄 Assigned classes changed! Reloading page...');
                setTimeout(() => window.location.reload(), 500);
            }

            return userData;
        } catch (error) {
            console.error('❌ Failed to refresh user data:', error);
            // If refresh fails, keep current user data
            return user;
        }
    };

    // Check if user is logged in on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (err) {
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // Auto-refresh user data when window gains focus
    useEffect(() => {
        const handleFocus = async () => {
            if (user) {
                console.log('🔄 Window focused - refreshing user data...');
                await refreshUser();
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [user]);

    const login = async (username, password) => {
        try {
            const response = await authAPI.login(username, password);
            const data = response.data || response;

            const userData = {
                id: data.id,
                username: data.username,
                role: data.role, // 'admin' or 'user'
                assignedClasses: data.assignedClasses || [] // Array of class IDs
            };

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            return userData;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Đăng nhập thất bại');
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    const isAdmin = () => {
        return user?.role === 'admin';
    };

    const canAccessClass = (classId) => {
        if (isAdmin()) return true;
        return user?.assignedClasses?.includes(classId);
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAdmin,
        canAccessClass,
        refreshUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
