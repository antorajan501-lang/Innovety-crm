import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import DashboardLayout from './components/layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Interns from './pages/Interns';
import TeamLeaders from './pages/TeamLeaders';
import Teams from './pages/Teams';
import Tasks from './pages/Tasks';
import Attendance from './pages/Attendance';
import AttendanceAudit from './pages/AttendanceAudit';
import Tickets from './pages/Tickets';
import Announcements from './pages/Announcements';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import SiteSettings from './pages/SiteSettings';

// Protected Route wrapper with Role Check
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Role-Based Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interns"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Interns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-leaders"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <TeamLeaders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Teams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute allowedRoles={['INTERN', 'TEAM_LEADER']}>
                  <Attendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance-audit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER']}>
                  <AttendanceAudit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Tickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Announcements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN']}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <SiteSettings />
                </ProtectedRoute>
              }
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
