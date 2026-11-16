import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { FeedbackProvider } from './components/Feedback';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Booking from './pages/Booking';
import LiveQueue from './pages/LiveQueue';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ManageStaff from './pages/ManageStaff';

const readUser = () => {
    try {
        const role = localStorage.getItem('userRole');
        return role ? { role, username: localStorage.getItem('username') || '' } : null;
    } catch {
        return null;
    }
};

// Defined outside App so it is not re-created (and its children remounted) on every render.
const ProtectedRoute = ({ user, allowedRoles, children }) => {
    const location = useLocation();
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (!allowedRoles.includes(user.role)) return <Navigate to="/admin" replace />;
    return children;
};

const ScrollToTop = () => {
    const { pathname } = useLocation();
    // Braces matter: newer Chrome returns a Promise from scrollTo(), and an effect
    // must return nothing (or a cleanup function), otherwise React crashes.
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [pathname]);
    return null;
};

function Shell() {
    const [user, setUser] = useState(readUser);
    const { pathname } = useLocation();

    const login = (u) => {
        localStorage.setItem('userRole', u.role);
        localStorage.setItem('username', u.username);
        setUser({ role: u.role, username: u.username });
    };
    const logout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        setUser(null);
    };

    // Keep tabs in sync if someone logs out in another tab.
    useEffect(() => {
        const sync = () => setUser(readUser());
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);

    const fullBleed = pathname === '/' || pathname === '/tracker' || pathname === '/login';

    return (
        <div className="app">
            <ScrollToTop />
            <Navbar user={user} onLogout={logout} />
            <main className={fullBleed ? 'main-bleed' : 'main'}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/book" element={<Booking />} />
                    <Route path="/tracker" element={<LiveQueue />} />
                    <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login onLogin={login} />} />

                    <Route path="/admin" element={
                        <ProtectedRoute user={user} allowedRoles={['WASHER', 'ADMIN']}><Admin user={user} /></ProtectedRoute>
                    } />
                    <Route path="/reports" element={
                        <ProtectedRoute user={user} allowedRoles={['ADMIN']}><Reports /></ProtectedRoute>
                    } />
                    <Route path="/manage-staff" element={
                        <ProtectedRoute user={user} allowedRoles={['ADMIN']}><ManageStaff user={user} /></ProtectedRoute>
                    } />
                    <Route path="/signup" element={
                        <ProtectedRoute user={user} allowedRoles={['ADMIN']}><Signup /></ProtectedRoute>
                    } />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            {pathname !== '/tracker' && <Footer />}
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <Router>
                <FeedbackProvider>
                    <Shell />
                </FeedbackProvider>
            </Router>
        </ErrorBoundary>
    );
}
