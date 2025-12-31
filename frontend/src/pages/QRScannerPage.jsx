import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import { classesAPI, attendanceAPI } from '../services/api';
import { invalidateCache } from '../utils/excelCache';
import { validateAttendance, getValidationHint, getAllowedAttendanceTypes } from '../utils/attendanceValidation';

export default function QRScannerPage() {
    const { canAccessClass } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [attendanceType, setAttendanceType] = useState('Học Giáo Lý');
    const [scannedStudents, setScannedStudents] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const processingStudents = useRef(new Set()); // Track students being processed

    useEffect(() => {
        loadClasses();
    }, []);

    // Auto-select valid attendance type when date changes
    useEffect(() => {
        const allowedTypes = getAllowedAttendanceTypes(attendanceDate);
        if (allowedTypes.length > 0 && !allowedTypes.includes(attendanceType)) {
            // Current type is not allowed, select first allowed type
            setAttendanceType(allowedTypes[0]);
        }
    }, [attendanceDate]);

    // Clear messages when form fields change
    useEffect(() => {
        setError('');
        setSuccess('');
    }, [selectedClassId, attendanceDate, attendanceType]);

    const loadClasses = async () => {
        try {
            const response = await classesAPI.getAll();
            setClasses(response.classes || response || []);
        } catch (err) {
            setError('Không thể tải danh sách lớp: ' + err.message);
        }
    };

    const startScanning = async () => {
        if (!selectedClassId) {
            setError('Vui lòng chọn lớp');
            return;
        }

        // Validate date and attendance type
        const validation = validateAttendance(attendanceDate, attendanceType);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }

        setError('');
        setSuccess('');
        setScanning(true);
        // Initialization will happen in useEffect when 'scanning' becomes true
    };

    const stopScanning = async () => {
        setScanning(false);
        setSuccess(''); // Clear previous scan messages
        processingStudents.current.clear(); // Clear processing set when stopping

        // Save all scanned students at once
        if (scannedStudents.length > 0) {
            try {
                const saveResponse = await attendanceAPI.save({
                    classId: parseInt(selectedClassId),
                    attendanceDate,
                    attendanceType: convertAttendanceType(attendanceType),
                    records: Array.from(
                        new Map(
                            scannedStudents.map(s => [s.studentId, {
                                studentId: s.studentId,
                                isPresent: true
                            }])
                        ).values()
                    ),
                    attendanceMethod: 'qr'
                });

                // Check Excel write results
                if (saveResponse.excelWriteResults && saveResponse.excelWriteResults.length > 0) {
                    const successCount = saveResponse.excelWriteResults.filter(r => r.success).length;

                    if (successCount === 0) {
                        // Excel write failed - show error
                        const formattedDate = formatVietnameseDate(attendanceDate);
                        setError(`❌ Không thể điểm danh thành công do trong file Excel của lớp không có cột điểm danh ${formattedDate} - ${attendanceType}`);
                    } else {
                        setSuccess(`✅ Đã lưu điểm danh cho ${scannedStudents.length} thiếu nhi`);
                        // Invalidate Excel cache for this class
                        invalidateCache(selectedClassId);
                    }
                }
            } catch (err) {
                setError(`Lỗi khi lưu điểm danh: ${err.message}`);
            }
        }
        // Cleanup will happen in useEffect
    };

    // Effect to handle scanner lifecycle
    useEffect(() => {
        let html5QrCode = null;

        const initScanner = async () => {
            if (scanning) {
                // Wait for DOM to update
                await new Promise(r => setTimeout(r, 100));

                try {
                    // Check if element exists
                    if (!document.getElementById("qr-reader")) {
                        console.error("qr-reader element not found");
                        setError("Lỗi khởi tạo: Không tìm thấy khung camera");
                        setScanning(false);
                        return;
                    }

                    html5QrCode = new Html5Qrcode("qr-reader");
                    html5QrCodeRef.current = html5QrCode;

                    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                    // Try back camera specifically for mobile
                    try {
                        await html5QrCode.start(
                            { facingMode: { exact: "environment" } },
                            config,
                            onScanSuccess,
                            onScanError
                        );
                    } catch (err) {
                        // Fallback to any camera if back camera fails
                        console.log("Back camera failed, trying any camera...", err);
                        await html5QrCode.start(
                            { facingMode: "environment" },
                            config,
                            onScanSuccess,
                            onScanError
                        );
                    }
                } catch (err) {
                    console.error("Failed to start scanner:", err);
                    let errorMessage = '❌ Không thể khởi động camera\n';

                    if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission'))) {
                        errorMessage += 'Vui lòng cấp quyền truy cập camera và thử lại.';
                    } else if (err.name === 'NotFoundError') {
                        errorMessage += 'Không tìm thấy camera trên thiết bị.';
                    } else {
                        errorMessage += `Lỗi: ${err.message || 'Không xác định'}`;
                    }

                    setError(errorMessage);
                    setScanning(false);
                }
            } else {
                // Cleanup if scanning is false but instance exists
                if (html5QrCodeRef.current) {
                    try {
                        if (html5QrCodeRef.current.isScanning) {
                            await html5QrCodeRef.current.stop();
                        }
                        html5QrCodeRef.current.clear();
                    } catch (e) {
                        console.error("Error stopping scanner:", e);
                    }
                    html5QrCodeRef.current = null;
                }
            }
        };

        initScanner();

        // Cleanup on unmount or dependency change
        return () => {
            if (html5QrCodeRef.current) {
                try {
                    html5QrCodeRef.current.stop().catch(e => console.error(e));
                    html5QrCodeRef.current.clear().catch(e => console.error(e));
                } catch (e) {
                    // ignore
                }
            }
        };
    }, [scanning]);

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Clear previous messages
        setError('');
        setSuccess('');

        try {
            const html5QrCode = new Html5Qrcode("qr-reader-file");
            const imageDataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            const result = await html5QrCode.scanFile(file, true);
            await onScanSuccess(result);

            // Clear file input
            event.target.value = '';
        } catch (err) {
            setError(`Không thể đọc mã QR từ ảnh: ${err.message || 'Ảnh không chứa mã QR hợp lệ'}`);
        }
    };

    const formatVietnameseDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return `${days[date.getDay()]}, ${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
    };

    // Helper function to convert Vietnamese to non-diacritics for backend
    const convertAttendanceType = (type) => {
        const mapping = {
            'Học Giáo Lý': 'Hoc Giao Ly',
            'Lễ Thứ 5': 'Le Thu 5',
            'Lễ Chúa Nhật': 'Le Chua Nhat'
        };
        return mapping[type] || type;
    };

    const scannedStudentsRef = useRef([]);

    // Keep ref in sync with state
    useEffect(() => {
        scannedStudentsRef.current = scannedStudents;
    }, [scannedStudents]);

    const onScanSuccess = async (decodedText) => {
        try {
            const studentData = JSON.parse(decodedText);

            // Check if this student is already being processed
            if (processingStudents.current.has(studentData.studentId)) {
                return;
            }

            // Check if already scanned (using Ref for up-to-date list)
            if (scannedStudentsRef.current.find(s => s.studentId === studentData.studentId)) {
                // Already scanned, just ignore silently to avoid message spam
                return;
            }

            // Mark as processing
            processingStudents.current.add(studentData.studentId);

            try {
                // Validate: Check if student belongs to selected class
                const response = await classesAPI.getStudents(selectedClassId);
                const classStudents = response.students || response || [];
                const studentInClass = classStudents.find(s => s.id === studentData.studentId);

                if (!studentInClass) {
                    setError(`❌ Thiếu nhi "${studentData.studentName}" không thuộc lớp đã chọn!`);
                    return;
                }

                // Add to scanned list (don't save yet - will save all when stopping)
                setScannedStudents(prev => [...prev, {
                    ...studentData,
                    scannedAt: new Date().toLocaleTimeString('vi-VN')
                }]);

                setError(''); // Clear any previous error
                setSuccess(`✅ ${studentData.studentName} - Đã quét thành công`);
            } finally {
                // Always remove from processing set
                processingStudents.current.delete(studentData.studentId);
            }
        } catch (err) {
            setError(`Lỗi khi điểm danh: ${err.message}`);
        }
    };

    const onScanError = (errorMessage) => {
        // Ignore scan errors (too frequent)
    };

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">📱 Điểm Danh Bằng QR Code</h2>
                    <p className="card-subtitle">Quét mã QR của thiếu nhi để điểm danh</p>
                </div>

                {!scanning ? (
                    <form onSubmit={(e) => { e.preventDefault(); startScanning(); }} style={{ padding: 'var(--spacing-lg)' }}>
                        {/* Class selector */}
                        <div className="form-group">
                            <label htmlFor="classSelect" className="form-label">
                                Chọn Lớp <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <select
                                id="classSelect"
                                className="form-input"
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                                <option value="">-- Chọn lớp --</option>
                                {classes.filter(c => canAccessClass(c.id)).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="form-group">
                            <label htmlFor="attendanceDate" className="form-label">
                                Ngày Điểm Danh
                            </label>
                            <input
                                type="date"
                                id="attendanceDate"
                                className="form-input"
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                            />
                            {attendanceDate && (
                                <>
                                    <p style={{
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-primary)',
                                        marginTop: 'var(--spacing-xs)',
                                        fontWeight: '500'
                                    }}>
                                        📅 {formatVietnameseDate(attendanceDate)}
                                    </p>
                                    <p style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: getAllowedAttendanceTypes(attendanceDate).length === 0 ? 'var(--color-danger)' : 'var(--color-success)',
                                        marginTop: 'var(--spacing-xs)',
                                        fontWeight: '600'
                                    }}>
                                        {getValidationHint(attendanceDate)}
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Type */}
                        <div className="form-group">
                            <label htmlFor="attendanceType" className="form-label">
                                Loại Điểm Danh
                            </label>
                            <select
                                id="attendanceType"
                                className="form-input"
                                value={attendanceType}
                                onChange={(e) => setAttendanceType(e.target.value)}
                                disabled={getAllowedAttendanceTypes(attendanceDate).length === 0}
                            >
                                {getAllowedAttendanceTypes(attendanceDate).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                                {getAllowedAttendanceTypes(attendanceDate).length === 0 && (
                                    <option value="">-- Ngày không hợp lệ --</option>
                                )}
                            </select>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            📷 Bắt Đầu Quét QR
                        </button>


                    </form>
                ) : (
                    <div style={{ padding: 'var(--spacing-lg)' }}>
                        {/* QR Scanner */}
                        <div id="qr-reader" style={{ width: '100%', marginBottom: 'var(--spacing-lg)' }}></div>

                        {/* Scanned list */}
                        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <h4>Đã điểm danh: {scannedStudents.length} thiếu nhi</h4>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 'var(--spacing-md)' }}>
                                {scannedStudents.map((student, idx) => (
                                    <div key={idx} className="alert alert-success" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                        ✅ {student.baptismalName} {student.studentName}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={stopScanning} className="btn btn-secondary" style={{ width: '100%' }}>
                            ⏹️ Dừng Quét
                        </button>
                    </div>
                )}

                {/* Messages */}
                {error && (
                    <div className="alert alert-danger" style={{
                        margin: 'var(--spacing-lg)',
                        whiteSpace: 'pre-line',
                        textAlign: 'left'
                    }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="alert alert-success" style={{ margin: 'var(--spacing-lg)' }}>
                        {success}
                    </div>
                )}
            </div>
        </div>
    );
}
