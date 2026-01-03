import { useState, useEffect } from 'react';
import { classesAPI, gradesAPI } from '../services/api';
import { getCachedExcel, setCachedExcel } from '../utils/excelCache';
import { mergeAttendanceIntoExcel, getAttendanceStats, isPresent, getAttendanceCellColor } from '../utils/excelMerger';
import { mergeGradesIntoExcel, getGradeStats } from '../utils/gradesMerger';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';

export default function ExcelViewerPage() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [sheets, setSheets] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [className, setClassName] = useState('');
    const [isPortrait, setIsPortrait] = useState(window.innerWidth < window.innerHeight);
    const [isFromCache, setIsFromCache] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [attendanceStats, setAttendanceStats] = useState(null);
    const [gradeStats, setGradeStats] = useState(null);

    // Load all classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    // Detect orientation changes
    useEffect(() => {
        const handleResize = () => {
            setIsPortrait(window.innerWidth < window.innerHeight);
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

            // Filter classes by user permission
            const filteredClasses = filterClassesByPermission(transformedClasses, user, false);
            setClasses(filteredClasses);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleClassChange = async (classId) => {
        if (!classId) {
            setSelectedClassId('');
            setSheets([]);
            setClassName('');
            setIsFromCache(false);
            setLastUpdated(null);
            setGradeStats(null);
            return;
        }

        setSelectedClassId(classId);
        setLoading(true);
        setError('');
        setSheets([]);
        setActiveSheetIndex(0);
        setIsFromCache(false);

        try {
            const cached = getCachedExcel(classId);

            if (cached) {

                // Step 2: Fetch to check timestamp (lightweight - backend optimized)
                const result = await classesAPI.getExcelSheets(classId);

                // Step 3: Compare timestamps
                if (cached.timestamp === result.lastUpdated) {

                    // FIX: Always start with clean sheets and re-merge access data
                    // Use result.sheets (if available) or rawSheets from cache
                    let baseSheets = result.sheets || cached.data.rawSheets || cached.data.sheets || [];

                    // Merge FRESH attendance data
                    let mergedSheets = baseSheets;
                    if (result.attendanceData) {
                        mergedSheets = mergeAttendanceIntoExcel(baseSheets, result.attendanceData);
                    } else if (cached.data.attendanceData) {
                        // Fallback to cached attendance if result doesn't have it (unlikely)
                        mergedSheets = mergeAttendanceIntoExcel(baseSheets, cached.data.attendanceData);
                    }

                    // Fetch fresh grades data (grades change frequently)
                    let gradesData = [];
                    try {
                        const [gradesHK1, gradesHK2] = await Promise.all([
                            gradesAPI.getByClass(classId, 'HK1').catch(err => {
                                console.warn('⚠️ Could not fetch HK1 grades:', err.message);
                                return { grades: [] };
                            }),
                            gradesAPI.getByClass(classId, 'HK2').catch(err => {
                                console.warn('⚠️ Could not fetch HK2 grades:', err.message);
                                return { grades: [] };
                            })
                        ]);

                        gradesData = [
                            ...(gradesHK1.grades || []),
                            ...(gradesHK2.grades || [])
                        ];
                    } catch (gradeErr) {
                        console.warn('⚠️ Could not fetch grades:', gradeErr.message);
                    }

                    // Merge fresh grades into sheets
                    if (gradesData.length > 0) {
                        mergedSheets = mergeGradesIntoExcel(mergedSheets, gradesData);
                    }

                    setSheets(mergedSheets);
                    setClassName(cached.data.className || '');
                    setLastUpdated(cached.timestamp);
                    setIsFromCache(true);

                    // Use cached attendance stats
                    if (cached.data.attendanceStats) {
                        setAttendanceStats(cached.data.attendanceStats);
                    }

                    // Calculate fresh grade stats
                    if (gradesData.length > 0) {
                        const gradeStatsData = getGradeStats(gradesData);
                        setGradeStats(gradeStatsData);
                    }

                    setLoading(false);
                    return;
                } else {
                }
            }

            const result = await classesAPI.getExcelSheets(classId);

            // Fetch grades data for all semesters
            let gradesData = [];
            try {
                // Fetch both HK1 and HK2 separately to ensure we get all data
                const [gradesHK1, gradesHK2] = await Promise.all([
                    gradesAPI.getByClass(classId, 'HK1').catch(err => {
                        console.warn('⚠️ Could not fetch HK1 grades:', err.message);
                        return { grades: [] };
                    }),
                    gradesAPI.getByClass(classId, 'HK2').catch(err => {
                        console.warn('⚠️ Could not fetch HK2 grades:', err.message);
                        return { grades: [] };
                    })
                ]);

                gradesData = [
                    ...(gradesHK1.grades || []),
                    ...(gradesHK2.grades || [])
                ];
            } catch (gradeErr) {
                console.warn('⚠️ Could not fetch grades:', gradeErr.message);
            }

            // Merge attendance data into sheets
            let mergedSheets = result.attendanceData
                ? mergeAttendanceIntoExcel(result.sheets || [], result.attendanceData)
                : result.sheets || [];

            // Merge grades data into sheets
            if (gradesData.length > 0) {
                mergedSheets = mergeGradesIntoExcel(mergedSheets, gradesData);
            }

            setSheets(mergedSheets);
            setClassName(result.className || '');
            setLastUpdated(result.lastUpdated);

            // Calculate attendance stats
            let attendStats = null;
            if (result.attendanceData) {
                attendStats = getAttendanceStats(result.attendanceData);
                setAttendanceStats(attendStats);
            }

            // Calculate grade stats
            let gradeStatsData = null;
            if (gradesData.length > 0) {
                gradeStatsData = getGradeStats(gradesData);
                setGradeStats(gradeStatsData);
            }

            // Step 5: Save to cache (with merged data and stats)
            if (result.lastUpdated) {
                const dataToCache = {
                    ...result,
                    rawSheets: result.sheets, // Store CLEAN sheets
                    sheets: mergedSheets,  // Save merged sheets (for offline use)
                    attendanceStats: attendStats,  // Save calculated stats
                    gradeStats: gradeStatsData  // Save grade stats
                };
                setCachedExcel(classId, dataToCache, result.lastUpdated);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (selectedClassId) {
            // Force reload by invalidating cache
            const { invalidateCache } = require('../utils/excelCache');
            invalidateCache(selectedClassId);
            handleClassChange(selectedClassId);
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

        // Find STT column by searching through all rows
        let sttColumnIndex = -1;
        for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
            const row = sheetData[rowIndex];
            const colIndex = row.findIndex(cell => {
                const cellValue = formatCellValue(cell);
                return cellValue && cellValue.toString().trim().toUpperCase() === 'STT';
            });
            if (colIndex !== -1) {
                sttColumnIndex = colIndex;
                break; // Found STT, stop searching
            }
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
                                {row.map((cell, cellIndex) => {
                                    const cellValue = formatCellValue(cell);
                                    const isAttendanceMark = isPresent(cellValue);
                                    // Don't highlight if this is the STT column
                                    const isSttColumn = cellIndex === sttColumnIndex;

                                    return (
                                        <td
                                            key={cellIndex}
                                            style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-gray-200)',
                                                whiteSpace: rowIndex === 0 ? 'pre-line' : 'nowrap',
                                                minWidth: '100px',
                                                background: isAttendanceMark && rowIndex > 0 && !isSttColumn
                                                    ? getAttendanceCellColor(cellValue)
                                                    : 'inherit',
                                                color: isAttendanceMark && !isSttColumn ? '#28a745' : 'inherit',
                                                fontWeight: isAttendanceMark && !isSttColumn ? '700' : (rowIndex === 0 ? '600' : '400'),
                                                textAlign: 'left'
                                            }}
                                        >
                                            {cellValue}
                                        </td>
                                    );
                                })}
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

                {/* Cache Status & Refresh Button */}
                {selectedClassId && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: isFromCache ? '#e8f5e9' : '#f5f5f5',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isFromCache ? '#4caf50' : '#e0e0e0'}`
                    }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                            {isFromCache && (
                                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                            )}
                            <span style={{
                                fontSize: 'var(--font-size-sm)',
                                color: isFromCache ? '#2e7d32' : '#666'
                            }}>
                                {isFromCache ? 'Loaded from cache (instant)' : 'Loaded from server'}
                                {lastUpdated && (
                                    <span style={{ marginLeft: 'var(--spacing-xs)', color: '#999' }}>
                                        • Updated: {new Date(lastUpdated).toLocaleString('vi-VN')}
                                    </span>
                                )}
                            </span>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="btn btn-secondary"
                            style={{
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                fontSize: 'var(--font-size-sm)',
                                whiteSpace: 'nowrap'
                            }}
                            disabled={loading}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                )}

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
