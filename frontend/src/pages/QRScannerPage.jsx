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

    // UI State for success popup (auto hide)
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [lastScannedName, setLastScannedName] = useState('');

    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const processingStudents = useRef(new Set()); // Track students being processed
    const fileInputRef = useRef(null);

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

    // Auto hide success popup
    useEffect(() => {
        if (success) {
            setShowSuccessPopup(true);
            const timer = setTimeout(() => setShowSuccessPopup(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

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

                    // Responsive qrbox based on viewport
                    const qrboxFunction = function (viewfinderWidth, viewfinderHeight) {
                        const minEdgePercentage = 0.7; // 70%
                        const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
                        const boxSize = Math.floor(minDimension * minEdgePercentage);
                        return {
                            width: boxSize,
                            height: boxSize
                        };
                    };

                    const config = {
                        fps: 10,
                        qrbox: qrboxFunction,
                        aspectRatio: 1.0
                    };

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
            // Note: Html5Qrcode needs a container to scan file, we can reuse qr-reader or create a temp one.
            // But scanFile acts on the instance. If we are scanning, we can use the instance.
            // If not scanning, we need a new instance.

            // To simplify, we will only allow upload if we have an instance or create a temp one.
            // The library supports scanFile without a started scanner but needs an instance.
            // We'll create a temporary instance if one doesn't exist, attached to a dummy div or just try without element.
            // Actually Html5Qrcode constructor requires element ID.

            // We'll use the existing qr-reader div if available, or fail.
            // In layout below, qr-reader is always present in scanning mode.
            // If setup mode, we don't support file scan yet (logic limitation).
            // Let's assume we are in scanning mode if button is visible.

            let scanner = html5QrCodeRef.current;
            if (!scanner) {
                // Should not happen if button is only visible in scanning mode
                const html5QrCode = new Html5Qrcode("qr-reader");
                scanner = html5QrCode;
            }

            const result = await scanner.scanFile(file, true);
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

                setLastScannedName(studentData.studentName);

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

    // Get class name
    const selectedClass = classes.find(c => c.id == selectedClassId);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative mesh-gradient text-gray-900 min-h-screen">
            {/* Decorative background blob */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

            <div className={`flex-1 overflow-y-auto z-10 p-4 lg:p-10 pb-24 lg:pb-10`}>
                <div className={`max-w-7xl mx-auto flex flex-col gap-4 lg:gap-6 ${!scanning ? 'min-h-[calc(100vh-160px)] justify-center items-center' : ''}`}>

                    {!scanning ? (
                        /* Setup Form Mode - Centered & Focused */
                        <div className="w-full max-w-lg animate-fade-in-up">
                            {/* Centered Header for Setup */}
                            <div className="text-center mb-6 lg:mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                                    <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                                    Điểm Danh QR
                                </div>
                                <h2 className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tight mb-2">
                                    Chuẩn Bị Điểm Danh
                                </h2>
                                <p className="text-sm lg:text-base text-gray-600 px-4">
                                    Vui lòng chọn thông tin lớp và ngày để bắt đầu
                                </p>
                            </div>

                            <div className="glass-card p-6 lg:p-8 rounded-2xl lg:rounded-3xl relative overflow-hidden mx-2 lg:mx-0">
                                {/* Decorative top gradient line */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-400 to-blue-400"></div>

                                <form onSubmit={(e) => { e.preventDefault(); startScanning(); }} className="flex flex-col gap-5 lg:gap-6 pt-2">
                                    <div className="form-group mb-0">
                                        <label htmlFor="classSelect" className="block text-sm font-bold text-gray-700 mb-2">
                                            Chọn Lớp <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                                <span className="material-symbols-outlined text-gray-400">school</span>
                                            </div>
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                                                <span className="material-symbols-outlined text-gray-400">expand_more</span>
                                            </div>
                                            <select
                                                id="classSelect"
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium text-sm lg:text-base text-gray-900 appearance-none outline-none"
                                                value={selectedClassId}
                                                onChange={(e) => setSelectedClassId(e.target.value)}
                                            >
                                                <option value="" className="text-gray-900 bg-white">-- Chọn lớp --</option>
                                                {classes.filter(c => canAccessClass(c.id)).map(c => (
                                                    <option key={c.id} value={c.id} className="text-gray-900 bg-white">
                                                        {c.name} {c.students_count !== undefined ? `(${c.students_count} thiếu nhi)` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group mb-0">
                                        <label htmlFor="attendanceDate" className="block text-sm font-bold text-gray-700 mb-2">
                                            Ngày Điểm Danh
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                id="attendanceDate"
                                                style={{ colorScheme: 'light' }}
                                                className="w-full pl-4 lg:pl-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium text-sm lg:text-base text-left text-gray-900 outline-none"
                                                value={attendanceDate}
                                                onChange={(e) => setAttendanceDate(e.target.value)}
                                            />
                                        </div>
                                        {attendanceDate && (
                                            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                                                <span className="material-symbols-outlined text-primary text-lg mt-0.5 shrink-0">info</span>
                                                <div className="text-sm">
                                                    <p className="font-semibold text-primary">
                                                        {formatVietnameseDate(attendanceDate)}
                                                    </p>
                                                    <p className={`mt-1 font-medium ${getAllowedAttendanceTypes(attendanceDate).length === 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                                        {getValidationHint(attendanceDate)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group mb-0">
                                        <label htmlFor="attendanceType" className="block text-sm font-bold text-gray-700 mb-2">
                                            Loại Điểm Danh
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                                <span className="material-symbols-outlined text-gray-400">category</span>
                                            </div>
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                                                <span className="material-symbols-outlined text-gray-400">expand_more</span>
                                            </div>
                                            <select
                                                id="attendanceType"
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-medium text-sm lg:text-base text-gray-900 appearance-none outline-none"
                                                value={attendanceType}
                                                onChange={(e) => setAttendanceType(e.target.value)}
                                                disabled={getAllowedAttendanceTypes(attendanceDate).length === 0}
                                            >
                                                {getAllowedAttendanceTypes(attendanceDate).map(type => (
                                                    <option key={type} value={type} className="text-gray-900 bg-white">{type}</option>
                                                ))}
                                                {getAllowedAttendanceTypes(attendanceDate).length === 0 && (
                                                    <option value="" className="text-gray-900 bg-white">-- Ngày không hợp lệ --</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="mt-2 lg:mt-4 w-full py-3.5 lg:py-4 px-6 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-indigo-800 text-white rounded-xl font-bold text-base lg:text-lg shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 group"
                                    >
                                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">qr_code_scanner</span>
                                        Bắt Đầu Quét
                                    </button>
                                </form>

                                {error && (
                                    <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-3 animate-pulse">
                                        <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Scanner Mode - Full Width Dashboard */
                        <>
                            {/* Standard Header for Scanner View */}
                            <div className="flex flex-col gap-2 animate-fade-in-down">
                                <div className="flex flex-wrap justify-between items-end gap-3">
                                    <div className="flex-1">
                                        <nav className="flex items-center gap-2 text-xs lg:text-sm mb-1">
                                            <span className="text-gray-500">Giáo Lý</span>
                                            <span className="text-gray-700">/</span>
                                            <span className="text-primary font-medium">QR</span>
                                        </nav>
                                        <h2 className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tight">
                                            Đang Quét
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className="px-2 lg:px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs lg:text-sm font-bold border border-gray-200">
                                                {selectedClass?.name}
                                            </span>
                                            <span className="px-2 lg:px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs lg:text-sm font-bold border border-blue-200 truncate max-w-[150px]">
                                                {attendanceType}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={stopScanning}
                                        className="shrink-0 glass-button px-4 lg:px-6 py-2 lg:py-2.5 rounded-xl flex items-center gap-2 text-xs lg:text-sm font-bold text-red-600 hover:text-white hover:bg-red-500 transition-all border-red-100 hover:border-red-500 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-lg">stop_circle</span>
                                        <span className="hidden sm:inline">Dừng & Lưu</span>
                                        <span className="sm:hidden">Dừng</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mt-2 h-full min-h-[500px] animate-fade-in-up">
                                {/* Left Column: Camera Viewport */}
                                <div className="flex-grow lg:w-2/3 flex flex-col gap-4">
                                    <div className="relative w-full aspect-square md:aspect-video bg-black rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/20 group">
                                        {/* Camera Feed - ID is Critical */}
                                        <div id="qr-reader" className="w-full h-full object-cover"></div>

                                        {/* Overlays always on top */}
                                        <div className="absolute inset-0 pointer-events-none z-10">
                                            {/* Scanning Reticle */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="relative w-56 h-56 lg:w-64 lg:h-64 border-2 border-white/30 rounded-2xl overflow-hidden">
                                                    {/* Corners */}
                                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                                                    {/* Scanning Laser Animation */}
                                                    <div className="absolute w-full h-8 bg-gradient-to-b from-primary/50 to-transparent shadow-[0_0_20px_rgba(127,13,242,0.8)] scan-anim"></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Success Popup */}
                                        {showSuccessPopup && (
                                            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-max max-w-[90%]">
                                                <div className="glass-card px-4 py-3 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl flex items-center gap-3 lg:gap-4 shadow-xl animate-bounce duration-[2000ms] border-l-4 border-green-500 scale-90 lg:scale-100">
                                                    <div className="bg-green-500/10 text-green-500 rounded-full p-2">
                                                        <span className="material-symbols-outlined text-xl lg:text-2xl font-bold block">check_circle</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs lg:text-sm font-bold text-gray-600 uppercase tracking-wide opacity-70">Đã điểm danh</p>
                                                        <p className="text-base lg:text-lg font-black text-gray-900 truncate max-w-[150px] lg:max-w-xs">{lastScannedName}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Camera Controls */}
                                        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4 z-20 pointer-events-auto">
                                            {/* Upload Image */}
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="size-12 lg:size-14 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center transition-all border border-white/20 shadow-lg group"
                                                title="Tải ảnh QR từ thư viện"
                                            >
                                                <span className="material-symbols-outlined text-xl lg:text-2xl text-white group-hover:scale-110 transition-transform">image</span>
                                            </button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    </div>

                                    {/* Instructional Text */}
                                    <div className="flex justify-between items-center px-4 py-3 glass-card border border-gray-200 rounded-xl">
                                        <p className="text-gray-700 text-xs lg:text-sm flex items-center gap-2 font-medium">
                                            <span className="material-symbols-outlined text-primary text-base">qr_code_scanner</span>
                                            <span className="mobile-hide">Di chuyển camera để mã QR nằm trong khung vuông.</span>
                                            <span className="desktop-hide">Quét mã QR vào khung</span>
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                            </span>
                                            <span className="text-[10px] lg:text-xs font-bold text-red-500 uppercase tracking-wider">Live</span>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="glass-panel p-4 rounded-xl border-l-4 border-red-500 bg-red-50 text-red-700 flex items-center gap-3 shadow-sm">
                                            <span className="material-symbols-outlined shrink-0">warning</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm uppercase opacity-80">Lỗi Quét</p>
                                                <p className="text-sm font-medium break-words">{error}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Recently Scanned - Collapsible or small on User request but here kept as column */}
                                <div className="w-full lg:w-1/3 flex flex-col h-[400px] lg:h-auto">
                                    <div className="glass-card h-full rounded-2xl lg:rounded-3xl flex flex-col overflow-hidden shadow-xl">
                                        <div className="p-4 lg:p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-indigo-600"></span>
                                                <h3 className="font-bold text-gray-900 text-sm lg:text-base">Đã Quét</h3>
                                            </div>
                                            <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                                                {scannedStudents.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3 custom-scrollbar">
                                            {scannedStudents.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3 opacity-60">
                                                    <div className="size-16 rounded-full bg-white/5 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-3xl text-gray-600">qr_code_2</span>
                                                    </div>
                                                    <p className="text-sm font-medium">Chưa có thiếu nhi nào</p>
                                                </div>
                                            ) : (
                                                [...scannedStudents].reverse().map((student, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 shadow-sm hover:bg-white/10 transition-all group">
                                                        <div className="flex items-center justify-center size-8 lg:size-10 rounded-full shrink-0 bg-gradient-to-br from-primary to-purple-600 text-white font-bold text-xs lg:text-sm shadow-md">
                                                            {student.studentName.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs lg:text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                                                                {student.baptismalName} {student.studentName}
                                                            </p>
                                                            <p className="text-[10px] lg:text-xs text-gray-400 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[10px] opacity-50">badge</span>
                                                                {student.studentId}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="px-1.5 lg:px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[10px]">check</span>
                                                                <span className="hidden sm:inline">HIỆN DIỆN</span>
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">{student.scannedAt}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-white/10 bg-black/20">
                                            <button
                                                onClick={stopScanning}
                                                className="w-full py-3 rounded-xl text-sm font-bold text-primary hover:text-white hover:bg-primary transition-all border border-primary/20 hover:border-primary flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-lg">save</span>
                                                Hoàn Tất & Lưu
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
