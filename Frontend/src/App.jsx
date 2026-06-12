import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import { AdminCustomerSupportPage } from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import {
  AdminCommandLayout,
  DashboardAdminPage,
  RouteControlPage,
  StaffPerformancePage,
  UserAccountsPage,
} from './features/admin';
import { ScheduleOperationsPage } from './features/scheduleOperations';
import {
  LoginPage,
  RegisterPage,
  RegisterVerifyOtpPage,
  ProtectedRoute,
  OperationsRoute,
  PublicRoute,
  AdminRoute,
} from './features/auth';
import { ProfilePage } from './features/profile';
import {
  PromotionManagementPage,
  PromotionStatisticsPage,
} from './features/admin/promotions';
import { RevenueReportsPage } from './features/admin/revenue';
import { RouteEfficiencyPage } from './features/admin/analytics';
import { IncidentReportsPage } from './features/admin/incidents';
import { SystemMonitoringPage } from './features/admin/systemMonitoring';
import { FareOperationsPage } from './features/admin/fareOperations';
import { WalkInTicketMonitoringPage } from './features/admin/walkInTickets';
import { PassengerCompliancePage } from './features/admin/passengerCompliance';

function App() {
  return (
    <Router>
      <AppInitializer>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/auth/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/verify-otp"
            element={
              <PublicRoute>
                <RegisterVerifyOtpPage />
              </PublicRoute>
            }
          />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchRoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/priority-profile"
            element={
              <ProtectedRoute>
                <PriorityProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Ticket Feature */}
          {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          {/* Tracking Feature */}
          {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

          <Route
            path="/profile"
            element={(
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            )}
          />

          {/* Unified Admin Command Center */}
          <Route
            element={(
              <AdminRoute>
                <AdminCommandLayout />
              </AdminRoute>
            )}
          >
            <Route path="/admin/dashboard" element={<DashboardAdminPage embedded />} />
            <Route path="/admin/routes" element={<RouteControlPage />} />
            <Route path="/admin/users" element={<UserAccountsPage />} />
            <Route path="/admin/staff-performance" element={<StaffPerformancePage />} />
            <Route path="/admin/priority-verification" element={<AdminPriorityVerificationPage />} />
            <Route path="/admin/customer-support" element={<AdminCustomerSupportPage />} />
            <Route path="/admin/promotions" element={<PromotionManagementPage />} />
            <Route path="/admin/promotions/statistics" element={<PromotionStatisticsPage />} />
            <Route path="/admin/revenue" element={<RevenueReportsPage />} />
            <Route path="/admin/fare-operations" element={<FareOperationsPage />} />
            <Route path="/admin/walkin-tickets" element={<WalkInTicketMonitoringPage />} />
            <Route path="/admin/passenger-compliance" element={<PassengerCompliancePage />} />
            <Route path="/admin/analytics/route-efficiency" element={<RouteEfficiencyPage />} />
            <Route path="/admin/incidents" element={<IncidentReportsPage />} />
            <Route path="/admin/system-monitoring" element={<SystemMonitoringPage />} />
            <Route path="/admin/system-monitoring/suspicious" element={<SystemMonitoringPage />} />
          </Route>

          {/* Driver and Bus Assistant Feature */}
          <Route
            path="/operations/schedule"
            element={(
              <OperationsRoute>
                <ScheduleOperationsPage />
              </OperationsRoute>
            )}
          />
        </Routes>
      </AppInitializer>
    </Router>
  );
}

export default App;
