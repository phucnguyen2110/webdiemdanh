import { useState, useEffect } from 'react';
import { classesAPI } from '../services/api';

export default function UploadPage() {
    const [file, setFile] = useState(null);
    const [className, setClassName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [existingClasses, setExistingClasses] = useState([]);

    // Load existing classes on mount
    useEffect(() => {
        loadExistingClasses();
    }, []);

    const loadExistingClasses = async () => {
        try {
            const result = await classesAPI.getAll();
            setExistingClasses(result.classes || []);
        } catch (err) {
            console.error('Failed to load existing classes:', err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError('');
        }
    };

    const handleClassNameChange = (e) => {
        setClassName(e.target.value);
        if (error) setError('');
        if (success) setSuccess('');
    };

    const handleReset = () => {
        setFile(null);
        setClassName('');
        setError('');
        setSuccess('');
        const fileInput = document.getElementById('file-upload-input');
        if (fileInput) fileInput.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!file) {
            setError('Vui lòng chọn file Excel');
            return;
        }

        const trimmedClassName = className.trim();
        if (!trimmedClassName) {
            setError('Vui lòng nhập tên lớp');
            return;
        }

        // Check for duplicate class name (case-insensitive)
        const isDuplicate = existingClasses.some(cls =>
            cls.name.toLowerCase() === trimmedClassName.toLowerCase()
        );

        if (isDuplicate) {
            setError(`Tên lớp "${trimmedClassName}" đã tồn tại. Vui lòng chọn tên khác.`);
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const result = await classesAPI.upload(file, trimmedClassName);
            setSuccess(`✅ Đã tạo lớp "${result.className}" với ${result.studentsCount} thiếu nhi`);

            // Reset form (partial)
            setFile(null);
            setClassName('');
            if (document.getElementById('file-upload-input')) {
                document.getElementById('file-upload-input').value = '';
            }

            // Reload existing classes
            await loadExistingClasses();

        } catch (err) {
            // Handle backend errors
            const errorMessage = err.message || 'Đã xảy ra lỗi';
            if (errorMessage.toLowerCase().includes('duplicate') ||
                errorMessage.toLowerCase().includes('exists') ||
                errorMessage.toLowerCase().includes('đã tồn tại')) {
                setError(`Tên lớp "${trimmedClassName}" đã tồn tại. Vui lòng chọn tên khác.`);
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate duplicate warning for visual feedback
    const isDuplicate = className.trim() && existingClasses.some(cls =>
        cls.name.toLowerCase() === className.trim().toLowerCase()
    );

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#191022] text-white dark">
            <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                <div className="px-4 md:px-8 lg:px-12 py-8 w-full h-full overflow-y-auto custom-scrollbar">
                    {/* Breadcrumbs */}
                    <div className="flex flex-wrap gap-2 mb-6 items-center">
                        <span className="text-gray-500 hover:text-primary text-sm font-medium transition-colors cursor-pointer">Home</span>
                        <span className="material-symbols-outlined text-gray-400 text-sm">chevron_right</span>
                        <span className="text-gray-500 hover:text-primary text-sm font-medium transition-colors cursor-pointer">Classes</span>
                        <span className="material-symbols-outlined text-gray-400 text-sm">chevron_right</span>
                        <span className="text-primary font-semibold text-sm bg-primary/10 px-2 py-0.5 rounded-md">New Class</span>
                    </div>

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Tạo Lớp Mới</h1>
                            <p className="text-gray-400 text-base font-normal">Khởi tạo lớp mới và import danh sách thiếu nhi.</p>
                        </div>
                    </div>

                    {/* Main Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
                        {/* Left Column: Form & Upload */}
                        <div className="md:col-span-2 flex flex-col gap-6">
                            {/* Class Details Section */}
                            <div className="bg-[#191022]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">edit_note</span>
                                    Thông Tin Lớp
                                </h2>
                                <div className="grid grid-cols-1 gap-6">
                                    <label className="flex flex-col w-full">
                                        <span className="text-gray-300 text-sm font-medium pb-2">Tên Lớp <span className="text-red-500">*</span></span>
                                        <div className="relative group">
                                            <input
                                                className={`form-input flex w-full rounded-xl border ${isDuplicate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-white/10 focus:border-primary focus:ring-primary/10'} bg-white/5 px-4 h-12 text-base outline-none focus:ring-4 transition-all placeholder:text-gray-500 text-white`}
                                                placeholder="VD: Thiếu Nhi 1A, Thiếu Nhi 2A..."
                                                type="text"
                                                value={className}
                                                onChange={handleClassNameChange}
                                                disabled={loading}
                                            />
                                            {/* Validation Icon */}
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden group-focus-within:block">
                                                {isDuplicate ? (
                                                    <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
                                                ) : className.trim() ? (
                                                    <span className="material-symbols-outlined text-[20px] text-green-500">check_circle</span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <span className={`text-xs mt-1.5 ml-1 ${isDuplicate ? 'text-red-500' : 'text-gray-400'}`}>
                                            {isDuplicate ? 'Tên lớp này đã tồn tại.' : 'Tên lớp phải là duy nhất trong năm học.'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Upload Section */}
                            <div className="bg-[#191022]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">upload_file</span>
                                    Import Danh Sách
                                </h2>
                                {/* Drag & Drop Zone */}
                                <div className="relative group cursor-pointer">
                                    <input
                                        id="file-upload-input"
                                        accept=".xlsx, .xls"
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                        type="file"
                                        onChange={handleFileChange}
                                        disabled={loading}
                                    />
                                    <div className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed ${file ? 'border-primary bg-primary/5' : 'border-white/10 bg-white/5'} hover:bg-white/10 hover:border-primary transition-all duration-300 px-6 py-12 text-center group-hover:scale-[1.01]`}>
                                        <div className="size-16 rounded-full bg-white/10 flex items-center justify-center shadow-sm text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                                            <span className="material-symbols-outlined text-4xl">
                                                {file ? 'description' : 'cloud_upload'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <p className="text-white text-lg font-bold leading-tight">
                                                {file ? file.name : 'Click hoặc kéo thả file Excel vào đây'}
                                            </p>
                                            <p className="text-gray-400 text-sm max-w-sm">
                                                {file ? `Kích thước: ${(file.size / 1024).toFixed(2)} KB` : 'Hỗ trợ file .xlsx hoặc .xls (tối đa 5MB)'}
                                            </p>
                                        </div>
                                        {!file && (
                                            <button className="mt-2 flex items-center justify-center rounded-lg h-9 px-4 bg-primary text-white text-sm font-semibold shadow-md shadow-primary/20 group-hover:shadow-primary/40 transition-shadow pointer-events-none">
                                                Browse Files
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            {error && (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-100/50 text-red-600 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30 flex items-center gap-3">
                                    <span className="material-symbols-outlined">error</span>
                                    <span className="font-medium text-sm">{error}</span>
                                </div>
                            )}
                            {success && (
                                <div className="p-4 rounded-xl bg-green-50 border border-green-100/50 text-green-600 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900/30 flex items-center gap-3">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span className="font-medium text-sm">{success}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={loading}
                                    className="px-6 py-3 rounded-xl text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-8 py-3 rounded-xl bg-primary hover:bg-primary-light text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner w-5 h-5 border-2 border-white/30 border-t-white"></span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">add</span>
                                            Tạo Lớp
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Right Column: Instructions Sidebar */}
                        <div className="md:col-span-1 mt-8 md:mt-0">
                            <div className="bg-[#191022]/60 backdrop-blur-xl border border-white/10 sticky top-6 rounded-2xl p-0 overflow-hidden shadow-xl border-t-4 border-t-primary">
                                <div className="bg-white/5 p-5 border-b border-white/10">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">lightbulb</span>
                                        Hướng Dẫn Import
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Làm theo các bước sau để đảm bảo import thành công.</p>
                                </div>
                                <div className="p-5 flex flex-col gap-6">
                                    {/* Download Template */}
                                    <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-800/30 p-4 flex items-start gap-3">
                                        <div className="bg-white dark:bg-green-900/50 p-2 rounded-lg shadow-sm">
                                            <span className="material-symbols-outlined text-green-600 dark:text-green-400">table_view</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Cần file mẫu?</p>
                                            <a href="/Template.xlsx" download="Template.xlsx" className="text-sm text-green-700 dark:text-green-400 font-semibold hover:underline flex items-center gap-1">
                                                Download Template
                                                <span className="material-symbols-outlined text-[16px]">download</span>
                                            </a>
                                        </div>
                                    </div>
                                    {/* Checklist */}
                                    <div className="flex flex-col gap-4">
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 text-primary">
                                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Cột Bắt Buộc</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">File cần có cột "STT" và "Họ tên" ở dòng tiêu đề.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 text-primary">
                                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Định dạng</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Sử dụng file Excel (.xlsx, .xls).</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 text-primary">
                                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Không Dòng Trống</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Xóa các dòng trống giữa danh sách.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
