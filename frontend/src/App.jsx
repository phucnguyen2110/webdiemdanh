import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import OfflineStatus from './components/OfflineStatus';
import OfflineFirstTimeGuide from './components/OfflineFirstTimeGuide';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import FilesPage from './pages/FilesPage';
import ExcelViewerPage from './pages/ExcelViewerPage';
import AttendancePage from './pages/AttendancePage';
import GradesPage from './pages/GradesPage';
import HistoryPage from './pages/HistoryPage';
import QRScannerPage from './pages/QRScannerPage';
import AdminPage from './pages/AdminPage';
import SyncMonitorPage from './pages/SyncMonitorPage';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    {/* Public route */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes */}
                    <Route path="/*" element={
                        <ProtectedRoute>
                            <div style={{ minHeight: '100vh' }}>
                                <Navigation />
                                <OfflineStatus />
                                <OfflineFirstTimeGuide />
                                <Routes>
                                    <Route path="/" element={<UploadPage />} />
                                    <Route path="/files" element={<FilesPage />} />
                                    <Route path="/excel-viewer" element={<ExcelViewerPage />} />
                                    <Route path="/attendance" element={<AttendancePage />} />
                                    <Route path="/grades" element={<GradesPage />} />
                                    <Route path="/qr-scanner" element={<QRScannerPage />} />
                                    <Route path="/history" element={<HistoryPage />} />

                                    {/* Admin-only routes */}
                                    <Route path="/admin" element={
                                        <ProtectedRoute adminOnly>
                                            <AdminPage />
                                        </ProtectedRoute>
                                    } />
                                    <Route path="/sync-monitor" element={
                                        <ProtectedRoute adminOnly>
                                            <SyncMonitorPage />
                                        </ProtectedRoute>
                                    } />
                                </Routes>
                            </div>
                        </ProtectedRoute>
                    } />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
