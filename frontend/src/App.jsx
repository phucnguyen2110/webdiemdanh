import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import UploadPage from './pages/UploadPage';
import FilesPage from './pages/FilesPage';
import ExcelViewerPage from './pages/ExcelViewerPage';
import AttendancePage from './pages/AttendancePage';
import HistoryPage from './pages/HistoryPage';
import QRScannerPage from './pages/QRScannerPage';

function App() {
    return (
        <Router>
            <div style={{ minHeight: '100vh' }}>
                <Navigation />
                <Routes>
                    <Route path="/" element={<UploadPage />} />
                    <Route path="/files" element={<FilesPage />} />
                    <Route path="/excel-viewer" element={<ExcelViewerPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/qr-scanner" element={<QRScannerPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
