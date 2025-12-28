/**
 * Filter classes based on user permissions
 * @param {Array} classes - All classes from API
 * @param {Object} user - Current user object
 * @param {boolean} showAll - Force show all classes (for FilesPage)
 * @returns {Array} Filtered classes
 */
export const filterClassesByPermission = (classes, user, showAll = false) => {
    // If showAll flag is true (FilesPage), return all classes
    if (showAll) {
        return classes;
    }

    // If no user, return empty array
    if (!user) {
        return [];
    }

    // Admin sees all classes
    if (user.role === 'admin') {
        return classes;
    }

    // Regular user sees:
    // 1. Classes assigned to them
    // 2. Classes created by them (if backend provides createdBy field)
    const assignedClassIds = user.assignedClasses || [];

    return classes.filter(cls => {
        // Check if class is assigned to user
        const isAssigned = assignedClassIds.includes(cls.id);

        // Check if class was created by user (if createdBy field exists)
        const isCreatedByUser = cls.createdBy === user.id || cls.created_by === user.id;

        return isAssigned || isCreatedByUser;
    });
};
