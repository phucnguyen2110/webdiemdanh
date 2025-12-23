import { useState, useEffect } from 'react';
import { classesAPI } from '../services/api';

export default function ExcelViewerPage() {
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [sheets, setSheets] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [className, setClassName] = useState('');
    const [isPortrait, setIsPortrait] = useState(window.innerWidth < window.innerHeight);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Load all classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    // Detect orientation changes
    useEffect(() => {
        const handleResize = () => {
            setIsPortrait(window.innerWidth < window.innerHeight);
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    const loadClasses = async () => {
        try {
            const result = await classesAPI.getAll();
            // Transform snake_case to camelCase
            const transformedClasses = (result.classes || []).map(cls => ({
                id: cls.id,
                name: cls.name,
                createdAt: cls.created_at,
                studentsCount: cls.students_count
            }));
            setClasses(transformedClasses);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleClassChange = async (classId) => {
        if (!classId) {
            setSelectedClassId('');
            setSheets([]);
            setClassName('');
            return;
        }

        setSelectedClassId(classId);
        setLoading(true);
        setError('');
        setSheets([]);
        setActiveSheetIndex(0);

        try {
            const result = await classesAPI.getExcelSheets(classId);
            setSheets(result.sheets || []);
            setClassName(result.className || '');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCellValue = (cell) => {
        if (cell === null || cell === undefined) return '';

        // Check if it's a number that could be an Excel date (serial number)
        // Excel dates: Use a higher threshold to avoid converting STT (1,2,3,4...)
        // 40000 = 2009-07-06, reasonable minimum for attendance dates
        // This prevents small numbers like 1,2,3,4 from being converted to 1900 dates
        if (typeof cell === 'number' && cell >= 40000 && cell < 100000) {
            // Check if it looks like a date (no decimals or small decimals)
            const hasSmallDecimal = (cell % 1) < 0.01;
            if (hasSmallDecimal || cell % 1 === 0) {
                try {
                    // Convert Excel serial date to JavaScript date
                    // Excel serial 1 = January 1, 1900
                    // Using UTC to avoid timezone issues
                    const daysFrom1900 = cell - 1; // Excel serial 1 = Jan 1, 1900
                    const millisecondsFrom1900 = daysFrom1900 * 24 * 60 * 60 * 1000;
                    const jsDate = new Date(Date.UTC(1900, 0, 1) + millisecondsFrom1900);

                    // Check if the result is a valid date
                    if (!isNaN(jsDate.getTime())) {
                        // Format as DD/MM/YYYY using UTC methods
                        const day = String(jsDate.getUTCDate()).padStart(2, '0');
                        const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
                        const year = jsDate.getUTCFullYear();
                        return `${day}/${month}/${year}`;
                    }
                } catch (e) {
                    // If conversion fails, return as string
                    return String(cell);
                }
            }
        }

        return String(cell);
    };

    const renderTable = (sheetData) => {
        if (!sheetData || sheetData.length === 0) {
            return (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-gray-400)' }}>
                    Sheet trống
                </div>
            );
        }

        return (
            <div style={{
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 400px)', // Tăng chiều cao bảng
                border: '1px solid var(--color-gray-200)',
                borderRadius: 'var(--radius-md)'
            }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    <tbody>
                        {sheetData.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{
                                background: rowIndex === 0 ? 'var(--color-gray-100)' : 'white'
                            }}>
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            fontWeight: rowIndex === 0 ? '600' : '400',
                                            whiteSpace: 'nowrap',
                                            minWidth: '100px'
                                        }}
                                    >
                                        {formatCellValue(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div style={{
            padding: 'var(--spacing-lg)',
            minHeight: 'calc(100vh - 80px)'
        }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: 'var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: 'var(--spacing-lg)'
            }}>
                <h2 style={{
                    fontSize: 'var(--font-size-xl)',
                    marginBottom: 'var(--spacing-xs)',
                    color: 'var(--color-gray-900)'
                }}>
                    📊 Xem File Excel
                </h2>
                <p style={{
                    color: 'var(--color-gray-500)',
                    fontSize: 'var(--font-size-sm)',
                    margin: 0
                }}>
                    Xem tất cả các sheets trong file Excel đã upload
                </p>
            </div>

            {/* Info Alert about Excel Formulas */}
            <div style={{
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: 'var(--spacing-lg)',
                border: '1px solid #90caf9',
                display: 'flex',
                alignItems: 'start',
                gap: 'var(--spacing-sm)'
            }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>ℹ️</div>
                <div>
                    <strong style={{ color: '#1565c0', display: 'block', marginBottom: 'var(--spacing-xs)' }}>
                        Lưu ý về công thức Excel
                    </strong>
                    <p style={{
                        color: '#1976d2',
                        fontSize: 'var(--font-size-sm)',
                        margin: 0,
                        lineHeight: '1.5'
                    }}>
                        Các cột tổng số (công thức tính toán) sẽ hiển thị giá trị cũ khi xem trên web.
                        Để xem giá trị cập nhật mới nhất, vui lòng tải file Excel về và mở trong Microsoft Excel.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div style={{
                background: 'white',
                padding: 'var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Class Selector */}
                <div className="form-group">
                    <label htmlFor="classSelect" className="form-label">
                        Chọn lớp
                    </label>
                    <select
                        id="classSelect"
                        className="form-select"
                        value={selectedClassId}
                        onChange={(e) => handleClassChange(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    >
                        <option value="">-- Chọn lớp --</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name} ({cls.studentsCount} thiếu nhi)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                        <div className="spinner" style={{ width: '3rem', height: '3rem', margin: '0 auto' }}></div>
                        <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tải file Excel...</p>
                    </div>
                )}

                {/* Sheets Display */}
                {!loading && sheets.length > 0 && (
                    <div style={{ marginTop: 'var(--spacing-lg)', position: 'relative' }}>
                        {/* Mobile Warning Overlay */}
                        {isMobile && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.95)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 9999,
                                padding: 'var(--spacing-xl)'
                            }}>
                                <div style={{
                                    textAlign: 'center',
                                    color: 'white',
                                    maxWidth: '400px'
                                }}>
                                    <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>
                                        💻
                                    </div>
                                    <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'white' }}>
                                        Tính năng chỉ có trên Desktop
                                    </h3>
                                    <p style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.6', marginBottom: 'var(--spacing-xl)' }}>
                                        Tính năng xem file Excel chỉ khả dụng trên máy tính để bàn (Desktop).
                                        Vui lòng sử dụng máy tính hoặc laptop để truy cập tính năng này.
                                    </p>

                                    {/* Navigation buttons */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-sm)'
                                    }}>
                                        <a
                                            href="/files"
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: 'var(--radius-md)',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 'var(--spacing-sm)'
                                            }}
                                        >
                                            📚 Đi tới Quản lý
                                        </a>
                                        <a
                                            href="/attendance"
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: 'var(--radius-md)',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 'var(--spacing-sm)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)'
                                            }}
                                        >
                                            ✅ Đi tới Điểm danh
                                        </a>
                                        <a
                                            href="/"
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: 'var(--radius-md)',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 'var(--spacing-sm)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)'
                                            }}
                                        >
                                            📤 Đi tới Upload
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-lg)' }}>
                            File: {className}
                        </h3>

                        {/* Sheet Tabs */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--spacing-xs)',
                            borderBottom: '2px solid var(--color-gray-200)',
                            marginBottom: 'var(--spacing-lg)',
                            overflowX: 'auto'
                        }}>
                            {sheets.map((sheet, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveSheetIndex(index)}
                                    style={{
                                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                                        border: 'none',
                                        background: activeSheetIndex === index ? 'var(--color-primary)' : 'var(--color-gray-100)',
                                        color: activeSheetIndex === index ? 'white' : 'var(--color-gray-700)',
                                        fontWeight: activeSheetIndex === index ? '600' : '400',
                                        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                                        cursor: 'pointer',
                                        transition: 'all var(--transition-fast)',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (activeSheetIndex !== index) {
                                            e.currentTarget.style.background = 'var(--color-gray-200)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (activeSheetIndex !== index) {
                                            e.currentTarget.style.background = 'var(--color-gray-100)';
                                        }
                                    }}
                                >
                                    📄 {sheet.name}
                                    <span style={{
                                        marginLeft: 'var(--spacing-sm)',
                                        fontSize: 'var(--font-size-xs)',
                                        opacity: 0.8
                                    }}>
                                        ({sheet.rowCount} dòng)
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Active Sheet Content */}
                        {sheets[activeSheetIndex] && (
                            <div>
                                <div style={{
                                    marginBottom: 'var(--spacing-md)',
                                    color: 'var(--color-gray-500)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    <strong>{sheets[activeSheetIndex].name}</strong>
                                    {' • '}
                                    {sheets[activeSheetIndex].rowCount} dòng × {sheets[activeSheetIndex].colCount} cột
                                </div>
                                {renderTable(sheets[activeSheetIndex].data)}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && selectedClassId && sheets.length === 0 && (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        textAlign: 'center',
                        color: 'var(--color-gray-400)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>📂</div>
                        <p>Không tìm thấy file Excel cho lớp này</p>
                    </div>
                )}
            </div>
        </div>
    );
}
