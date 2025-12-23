import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { classesAPI, attendanceAPI } from '../services/api';

export default function QRScannerPage() {
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

    useEffect(() => {
        loadClasses();
    }, []);

    // Clear messages when form fields change
    useEffect(() => {
        setError('');
        setSuccess('');
    }, [selectedClassId, attendanceDate, attendanceType]);

    const loadClasses = async () => {
        try {
            const response = await classesAPI.getAll();
            // Transform snake_case to camelCase
            const transformedClasses = (response.classes || response || []).map(cls => ({
                id: cls.id,
                name: cls.name,
                createdAt: cls.created_at,
                studentsCount: cls.students_count
            }));
            setClasses(transformedClasses);
        } catch (err) {
            setError('Không thể tải danh sách lớp: ' + err.message);
        }
    };

    const startScanning = async () => {
        if (!selectedClassId) {
            setError('Vui lòng chọn lớp');
            return;
        }

        setError('');
        setSuccess('');
        setScanning(true);

        let html5QrCode = null;
        let cameraStarted = false;

        try {
            html5QrCode = new Html5Qrcode("qr-reader");
            html5QrCodeRef.current = html5QrCode;

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            // Try different camera configurations
            const cameraConfigs = [
                { facingMode: { exact: "environment" } }, // Back camera
                { facingMode: "user" },                   // Front camera
                { facingMode: { ideal: "environment" } }  // Any camera
            ];

            for (let i = 0; i < cameraConfigs.length && !cameraStarted; i++) {
                try {
                    console.log(`Trying camera config ${i + 1}:`, cameraConfigs[i]);
                    await html5QrCode.start(
                        cameraConfigs[i],
                        config,
                        onScanSuccess,
                        onScanError
                    );
                    cameraStarted = true;
                    console.log('Camera started successfully');
                } catch (err) {
                    console.log(`Camera config ${i + 1} failed:`, err.message);
                    if (i === cameraConfigs.length - 1) {
                        // Last attempt failed, throw the error
                        throw err;
                    }
                }
            }

        } catch (err) {
            console.error('Camera error:', err);
            let errorMessage = '❌ Không thể khởi động camera\n\n';

            if (err.name === 'NotAllowedError' || err.message.includes('Permission')) {
                errorMessage += '📷 Vui lòng cho phép truy cập camera:\n';
                errorMessage += '1. Nhấn vào biểu tượng 🔒 hoặc ⓘ trên thanh địa chỉ\n';
                errorMessage += '2. Chọn "Cho phép" camera\n';
                errorMessage += '3. Tải lại trang và thử lại';
            } else if (err.name === 'NotFoundError') {
                errorMessage += '📷 Không tìm thấy camera trên thiết bị này.\n';
                errorMessage += 'Vui lòng sử dụng tính năng "Tải ảnh QR" bên dưới.';
            } else if (err.name === 'NotReadableError') {
                errorMessage += '📷 Camera đang được sử dụng bởi ứng dụng khác.\n';
                errorMessage += 'Vui lòng đóng các ứng dụng khác và thử lại.';
            } else {
                errorMessage += `Lỗi: ${err.message || 'Không xác định'}\n`;
                errorMessage += 'Vui lòng thử tải lại trang hoặc sử dụng tính năng "Tải ảnh QR".';
            }

            setError(errorMessage);
            setScanning(false);
        }
    };

    const stopScanning = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }
        setScanning(false);
    };

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

    const onScanSuccess = async (decodedText) => {
        try {
            const studentData = JSON.parse(decodedText);

            // Validate: Check if student belongs to selected class
            const response = await classesAPI.getStudents(selectedClassId);
            const classStudents = response.students || response || [];
            const studentInClass = classStudents.find(s => s.id === studentData.studentId);

            if (!studentInClass) {
                setError(`❌ Thiếu nhi "${studentData.studentName}" không thuộc lớp đã chọn!`);
                return;
            }

            // Check if already scanned
            if (scannedStudents.find(s => s.studentId === studentData.studentId)) {
                setSuccess(`✅ ${studentData.studentName} đã được điểm danh rồi`);
                return;
            }

            // Save attendance
            const saveResponse = await attendanceAPI.save({
                classId: parseInt(selectedClassId),
                attendanceDate,
                attendanceType: convertAttendanceType(attendanceType),
                records: [{
                    studentId: studentData.studentId,
                    isPresent: true
                }],
                attendanceMethod: 'qr'
            });

            // Check Excel write results
            if (saveResponse.excelWriteResults && saveResponse.excelWriteResults.length > 0) {
                const successCount = saveResponse.excelWriteResults.filter(r => r.success).length;

                if (successCount === 0) {
                    // Excel write failed - show error
                    const formattedDate = formatVietnameseDate(attendanceDate);
                    setError(`❌ Không thể điểm danh thành công do trong file Excel của lớp không có cột điểm danh ${formattedDate} - ${attendanceType}`);
                    return;
                }
            }

            setScannedStudents(prev => [...prev, studentData]);
            setSuccess(`✅ Đã điểm danh: ${studentData.studentName}`);
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
                                className="form-select"
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                                <option value="">-- Chọn lớp --</option>
                                {classes.map(c => (
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
                                <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-primary)',
                                    marginTop: 'var(--spacing-xs)',
                                    fontWeight: '500'
                                }}>
                                    📅 {formatVietnameseDate(attendanceDate)}
                                </p>
                            )}
                        </div>

                        {/* Type */}
                        <div className="form-group">
                            <label htmlFor="attendanceType" className="form-label">
                                Loại Điểm Danh
                            </label>
                            <select
                                id="attendanceType"
                                className="form-select"
                                value={attendanceType}
                                onChange={(e) => setAttendanceType(e.target.value)}
                            >
                                <option value="Lễ Chúa Nhật">Lễ Chúa Nhật</option>
                                <option value="Lễ Thứ 5">Lễ Thứ 5</option>
                                <option value="Học Giáo Lý">Học Giáo Lý</option>
                            </select>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            📷 Bắt Đầu Quét QR
                        </button>

                        <div style={{
                            margin: 'var(--spacing-md) 0',
                            textAlign: 'center',
                            color: 'var(--color-gray-500)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            hoặc
                        </div>

                        <label
                            htmlFor="qr-file-upload"
                            className="btn btn-secondary"
                            style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer' }}
                        >
                            📁 Chọn Ảnh QR Từ Thư Viện
                        </label>
                        <input
                            id="qr-file-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <div id="qr-reader-file" style={{ display: 'none' }}></div>
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
