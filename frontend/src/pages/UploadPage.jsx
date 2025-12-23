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

            // Reset form
            setFile(null);
            setClassName('');
            document.getElementById('file-input').value = '';

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

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="card-header">
                    <h2 className="card-title">📤 Upload Danh Sách Thiếu Nhi</h2>
                    <p className="card-subtitle">Tải lên file Excel chứa danh sách thiếu nhi</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Tên lớp */}
                    <div className="form-group">
                        <label htmlFor="className" className="form-label">
                            Tên Lớp <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="className"
                            className="form-input"
                            placeholder="VD: Thiếu Nhi 1A, Thiếu Nhi 2A..."
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* File upload */}
                    <div className="form-group">
                        <label className="form-label">
                            File Excel <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <div className="file-upload">
                            <input
                                type="file"
                                id="file-input"
                                className="file-upload-input"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                            <label htmlFor="file-input" className="file-upload-label">
                                <div>
                                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📁</div>
                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                        {file ? file.name : 'Chọn file Excel'}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-400)' }}>
                                        Định dạng: .xlsx, .xls (tối đa 5MB)
                                    </div>
                                </div>
                            </label>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-400)', marginTop: 'var(--spacing-sm)' }}>
                            💡 File Excel cần có cột "STT" và "Họ tên"
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="alert alert-danger">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="alert alert-success">
                            {success}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        style={{ width: '100%' }}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span>
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                📤 Upload
                            </>
                        )}
                    </button>
                </form>

                {/* Hướng dẫn */}
                <div style={{
                    marginTop: 'var(--spacing-xl)',
                    padding: 'var(--spacing-lg)',
                    background: 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-sm)' }}>
                        📋 Hướng dẫn chuẩn bị file Excel:
                    </h4>
                    <ul style={{ paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
                        <li>File cần có ít nhất 2 cột: <strong>STT</strong> và <strong>Họ tên</strong></li>
                        <li>Dòng đầu tiên là tiêu đề cột</li>
                        <li>Các dòng tiếp theo là danh sách thiếu nhi</li>
                        <li>Tên lớp phải là duy nhất (không trùng với lớp đã có)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
