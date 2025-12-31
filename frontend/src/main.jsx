import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';
import syncManager from './utils/syncManager';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);

// Register service worker for PWA
if (import.meta.env.PROD) {
    registerServiceWorker().catch(console.error);
}

// Initialize sync manager
console.log('🔄 Sync Manager initialized');
