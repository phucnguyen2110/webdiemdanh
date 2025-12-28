import { useState, useEffect } from 'react';
import { classesAPI, gradesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { filterClassesByPermission } from '../utils/classFilter';

export default function GradesPage() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [semester, setSemester] = useState('HK1');
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load classes on mount
    useEffect(() => {
        loadClasses();
    }, []);

    // Load students when class changes
    useEffect(() => {
        if (selectedClassId) {
            loadStudentsAndGrades();
        }
    }, [selectedClassId, semester]);

    const loadClasses = async () => {
        try {
            const result = await classesAPI.getAll();
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

    const loadStudentsAndGrades = async () => {
        setLoading(true);
        setError('');
        try {
            // Load students
            console.log('🔍 Fetching students for classId:', selectedClassId);
            const studentsResult = await classesAPI.getStudents(selectedClassId);

            // BE returns array directly or in .students field
            const studentsList = Array.isArray(studentsResult) ? studentsResult : (studentsResult.students || []);



            // Transform to ensure consistent structure
            const transformedStudents = studentsList.map(student => {
                // Remove STT prefix from displayName (e.g. "1. Teresa..." -> "Teresa...")
                let cleanName = student.displayName || student.fullName || student.name || 'Unknown';

                // Remove pattern like "1. ", "2. ", etc.
                cleanName = cleanName.replace(/^\d+\.\s*/, '');

                return {
                    id: student.id,
                    studentId: student.studentId,
                    name: cleanName,
                    fullName: student.fullName,
                    baptismalName: student.baptismalName,
                    displayName: student.displayName,
                    dateOfBirth: student.dateOfBirth
                };
            });

            setStudents(transformedStudents);

            // Load existing grades
            const gradesResult = await gradesAPI.getByClass(selectedClassId, semester);
            const existingGrades = gradesResult.grades || [];

            // Map grades to students
            const gradesMap = {};
            existingGrades.forEach(grade => {
                gradesMap[grade.studentId] = {
                    gradeM: grade.gradeM || grade.grade_m || '',
                    grade1T: grade.grade1T || grade.grade_1t || '',
                    gradeThi: grade.gradeThi || grade.grade_thi || ''
                };
            });

            // Initialize grades for all students
            transformedStudents.forEach(student => {
                if (!gradesMap[student.id]) {
                    gradesMap[student.id] = {
                        gradeM: '',
                        grade1T: '',
                        gradeThi: ''
                    };
                }
            });
            setGrades(gradesMap);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGradeChange = (studentId, gradeType, value) => {
        // Validate: empty or number 0-10
        if (value !== '' && (isNaN(value) || parseFloat(value) < 0 || parseFloat(value) > 10)) {
            return;
        }

        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [gradeType]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Prepare data
            const gradesData = students.map(student => ({
                studentId: student.id,
                studentName: student.name,
                gradeM: grades[student.id]?.gradeM ? parseFloat(grades[student.id].gradeM) : null,
                grade1T: grades[student.id]?.grade1T ? parseFloat(grades[student.id].grade1T) : null,
                gradeThi: grades[student.id]?.gradeThi ? parseFloat(grades[student.id].gradeThi) : null
            }));

            // Save to API
            await gradesAPI.save({
                classId: selectedClassId,
                semester: semester,
                grades: gradesData
            });

            setSuccess('Lưu điểm thành công!');

            // Reload grades
            setTimeout(() => {
                loadStudentsAndGrades();
                setSuccess('');
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
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
                    📝 Quản Lý Điểm
                </h2>
                <p style={{
                    color: 'var(--color-gray-500)',
                    fontSize: 'var(--font-size-sm)',
                    margin: 0
                }}>
                    Quản lý điểm cho thiếu nhi
                </p>
            </div>

            {/* Content */}
            <div style={{
                background: 'white',
                padding: 'var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Class and Semester Selection */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <div className="form-group">
                        <label htmlFor="classSelect" className="form-label">
                            Chọn Lớp
                        </label>
                        <select
                            id="classSelect"
                            className="form-select"
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                        >
                            <option value="">-- Chọn Lớp --</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name} ({cls.studentsCount} thiếu nhi)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="semesterSelect" className="form-label">
                            Học Kỳ
                        </label>
                        <select
                            id="semesterSelect"
                            className="form-select"
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                        >
                            <option value="HK1">Học Kỳ I (HK1)</option>
                            <option value="HK2">Học Kỳ II (HK2)</option>
                        </select>
                    </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-md)' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-md)' }}>
                        {success}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                        <div className="spinner" style={{ width: '3rem', height: '3rem', margin: '0 auto' }}></div>
                        <p style={{ marginTop: 'var(--spacing-md)' }}>Đang tải danh sách...</p>
                    </div>
                )}

                {/* Students Table */}
                {!loading && selectedClassId && students.length > 0 && (
                    <>
                        <div style={{
                            overflowX: 'auto',
                            marginBottom: 'var(--spacing-lg)',
                            WebkitOverflowScrolling: 'touch',
                            position: 'relative'
                        }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                                minWidth: '800px'
                            }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-gray-100)' }}>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '50px',
                                            fontWeight: '600',
                                            position: 'sticky',
                                            left: 0,
                                            background: 'var(--color-gray-100)',
                                            zIndex: 10
                                        }}>STT</th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '180px',
                                            maxWidth: '180px',
                                            fontWeight: '600',
                                            position: 'sticky',
                                            left: '50px',
                                            background: 'var(--color-gray-100)',
                                            zIndex: 10
                                        }}>Họ và Tên</th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '90px',
                                            fontWeight: '600'
                                        }}>MSTN</th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '95px',
                                            fontWeight: '600'
                                        }}>Ngày sinh</th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '110px',
                                            fontWeight: '600'
                                        }}>
                                            <div>M</div>
                                            <div style={{ fontSize: '0.7em', fontWeight: '400', opacity: 0.7 }}>(Miệng)</div>
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '110px',
                                            fontWeight: '600'
                                        }}>
                                            <div>1T</div>
                                            <div style={{ fontSize: '0.7em', fontWeight: '400', opacity: 0.7 }}>(1 Tiết)</div>
                                        </th>
                                        <th style={{
                                            padding: 'var(--spacing-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'center',
                                            width: '110px',
                                            fontWeight: '600'
                                        }}>
                                            <div>Thi</div>
                                            <div style={{ fontSize: '0.7em', fontWeight: '400', opacity: 0.7 }}>(Cuối kỳ)</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, index) => (
                                        <tr key={student.id} style={{
                                            background: index % 2 === 0 ? 'white' : '#fafafa'
                                        }}>
                                            <td style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center',
                                                fontWeight: '500',
                                                position: 'sticky',
                                                left: 0,
                                                background: index % 2 === 0 ? 'white' : '#fafafa',
                                                zIndex: 9
                                            }}>{index + 1}</td>
                                            <td style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-gray-200)',
                                                width: '180px',
                                                maxWidth: '180px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                textAlign: 'center',
                                                position: 'sticky',
                                                left: '50px',
                                                background: index % 2 === 0 ? 'white' : '#fafafa',
                                                zIndex: 9
                                            }} title={student.name}>
                                                {student.name}
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center',
                                                color: 'var(--color-gray-600)'
                                            }}>{student.studentId || '-'}</td>
                                            <td style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center',
                                                color: 'var(--color-gray-600)'
                                            }}>{student.dateOfBirth || '-'}</td>
                                            <td style={{
                                                padding: 'var(--spacing-xs)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center'
                                            }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.5"
                                                    value={grades[student.id]?.gradeM || ''}
                                                    onChange={(e) => handleGradeChange(student.id, 'gradeM', e.target.value)}
                                                    style={{
                                                        width: '90px',
                                                        padding: '8px',
                                                        border: '1px solid var(--color-gray-300)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        textAlign: 'center',
                                                        fontSize: '0.875rem',
                                                        transition: 'border-color 0.2s',
                                                        outline: 'none'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-300)'}
                                                />
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-xs)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center'
                                            }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.5"
                                                    value={grades[student.id]?.grade1T || ''}
                                                    onChange={(e) => handleGradeChange(student.id, 'grade1T', e.target.value)}
                                                    style={{
                                                        width: '90px',
                                                        padding: '8px',
                                                        border: '1px solid var(--color-gray-300)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        textAlign: 'center',
                                                        fontSize: '0.875rem',
                                                        transition: 'border-color 0.2s',
                                                        outline: 'none'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-300)'}
                                                />
                                            </td>
                                            <td style={{
                                                padding: 'var(--spacing-xs)',
                                                border: '1px solid var(--color-gray-200)',
                                                textAlign: 'center'
                                            }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    step="0.5"
                                                    value={grades[student.id]?.gradeThi || ''}
                                                    onChange={(e) => handleGradeChange(student.id, 'gradeThi', e.target.value)}
                                                    style={{
                                                        width: '90px',
                                                        padding: '8px',
                                                        border: '1px solid var(--color-gray-300)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        textAlign: 'center',
                                                        fontSize: '0.875rem',
                                                        transition: 'border-color 0.2s',
                                                        outline: 'none'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-300)'}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Save Button */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 'var(--spacing-md)'
                        }}>
                            <div style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-gray-600)'
                            }}>
                                Tổng số: <strong>{students.length}</strong> thiếu nhi
                            </div>
                            <button
                                onClick={handleSave}
                                className="btn btn-primary"
                                disabled={saving}
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-xl)',
                                    fontSize: 'var(--font-size-base)',
                                    minWidth: '150px'
                                }}
                            >
                                {saving ? '⏳ Đang lưu...' : '💾 Lưu điểm'}
                            </button>
                        </div>
                    </>
                )}

                {/* Empty State */}
                {!loading && selectedClassId && students.length === 0 && (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        textAlign: 'center',
                        color: 'var(--color-gray-400)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>📚</div>
                        <p>Không tìm thấy thiếu nhi trong lớp này</p>
                    </div>
                )}

                {!selectedClassId && (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        textAlign: 'center',
                        color: 'var(--color-gray-400)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>👆</div>
                        <p>Vui lòng chọn lớp và học kỳ để thấy điểm</p>
                    </div>
                )}
            </div>
        </div>
    );
}
