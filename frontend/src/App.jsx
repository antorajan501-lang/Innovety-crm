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
import Employees from './pages/Employees';
import Teams from './pages/Teams';
import Tasks from './pages/Tasks';
import Attendance from './pages/Attendance';
import AttendanceAudit from './pages/AttendanceAudit';
import LeaveManagementPage from './pages/LeaveManagementPage';
import Tickets from './pages/Tickets';
import Announcements from './pages/Announcements';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import SiteSettings from './pages/SiteSettings';
import AssetManagement from './pages/AssetManagement';
import Projects from './pages/Projects';
import WorkLogs from './pages/WorkLogs';
import WorkCalendar from './pages/WorkCalendar';



// Finance & Payroll Pages
import PayrollDashboardPage from './pages/finance/PayrollDashboardPage';
import SalaryTemplatesPage from './pages/finance/SalaryTemplatesPage';
import SalaryStructuresPage from './pages/finance/SalaryStructuresPage';
import PayrollProcessingPage from './pages/finance/PayrollProcessingPage';
import PayslipsPage from './pages/finance/PayslipsPage';
import HolidayCalendarPage from './pages/finance/HolidayCalendarPage';
import PayrollReportsPage from './pages/finance/PayrollReportsPage';
import PayrollSettingsPage from './pages/finance/PayrollSettingsPage';
import EmployeePayrollPage from './pages/finance/EmployeePayrollPage';

import { ThemeProvider } from './context/ThemeContext';
import SuperAdminDashboard from './pages/super-admin/dashboard/SuperAdminDashboard';
import BrandingTheme from './pages/super-admin/branding/BrandingTheme';
import UsersDirectory from './pages/super-admin/users/UsersDirectory';
import TeamDirectory from './pages/super-admin/teams/TeamDirectory';
import AdminManagement from './pages/super-admin/admins/AdminManagement';
import PlatformBuilderDashboard from './pages/super-admin/builder/PlatformBuilderDashboard';
import OrganizationManager from './pages/super-admin/organization/OrganizationManager';
import LeavePolicySettings from './pages/super-admin/LeavePolicySettings';

import ErrorBoundary from './components/common/ErrorBoundary';

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

  if (allowedRoles && allowedRoles.length > 0 && user?.role) {
    const userRoleUpper = String(user.role).toUpperCase();
    const allowedUpper = allowedRoles.map(r => String(r).toUpperCase());
    if (!allowedUpper.includes(userRoleUpper)) {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <DashboardLayout>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </DashboardLayout>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <SocketProvider>
            <Routes>
              {/* Public Auth Route */}
              <Route path="/login" element={<Login />} />

              {/* Super Admin Platform Control Center Routes */}
              <Route
                path="/super-admin"
                element={<Navigate to="/super-admin/dashboard" replace />}
              />
              <Route
                path="/super-admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/branding"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <BrandingTheme />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/users"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <UsersDirectory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/teams"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <TeamDirectory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/admins"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <AdminManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/organization"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <OrganizationManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/leave-policy"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <LeavePolicySettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/platform-builder"
                element={<Navigate to="/super-admin/platform-builder/forms" replace />}
              />
              <Route
                path="/super-admin/platform-builder/dashboard"
                element={<Navigate to="/super-admin/platform-builder/forms" replace />}
              />
              <Route
                path="/super-admin/platform-builder/forms"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <PlatformBuilderDashboard defaultTab="forms" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/platform-builder/menus"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <PlatformBuilderDashboard defaultTab="menus" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/platform-builder/audit"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <PlatformBuilderDashboard defaultTab="audit" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/platform-builder/extensions"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <PlatformBuilderDashboard defaultTab="extensions" />
                  </ProtectedRoute>
                }
              />

              {/* Protected Role-Based Routes */}
              <Route path="/integrations" element={<Navigate to="/" replace />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN']}>
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
                path="/employees"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Employees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Projects />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Teams />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Tasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute allowedRoles={['INTERN', 'TEAM_LEADER', 'EMPLOYEE']}>
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
                path="/leave-management"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN', 'SUPER_ADMIN']}>
                    <LeaveManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/leaves" element={<Navigate to="/leave-management" replace />} />
              <Route path="/operations/leave" element={<Navigate to="/leave-management" replace />} />
              <Route path="/work-calendar" element={<Navigate to="/operations/work-calendar" replace />} />
              <Route
                path="/operations/work-calendar"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN']}>
                    <WorkCalendar />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tickets"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Tickets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/announcements"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Announcements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assets"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
                    <AssetManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']}>
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
              <Route
                path="/worklogs"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN']}>
                    <WorkLogs />
                  </ProtectedRoute>
                }
              />


              {/* Finance & Payroll Module Routes */}
              <Route path="/payroll" element={<Navigate to="/payroll/dashboard" replace />} />
              <Route
                path="/payroll/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <PayrollDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/templates"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <SalaryTemplatesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/structures"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <SalaryStructuresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/processing"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <PayrollProcessingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/payslips"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <PayslipsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/holidays"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <HolidayCalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/reports"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <PayrollReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll/settings"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <PayrollSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-payroll"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN']}>
                    <EmployeePayrollPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
