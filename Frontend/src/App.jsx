import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import { AdminCustomerSupportPage } from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import {
  AdminCommandLayout,
  AdminActiveTripsPage,
  AdminDelayedTripsPage,
  AdminFleetLocationPage,
  DashboardAdminPage,
  RouteControlPage,
  StaffPerformancePage,
  SystemNotificationsPage,
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
import { CongestedRoutesPage, FeedbackAnalyticsPage, RouteEfficiencyPage } from './features/admin/analytics';
import { IncidentReportsPage } from './features/admin/incidents';
import { VehicleIssuesPage } from './features/admin/vehicleIssues';
import { MaintenanceApprovalPage } from './features/admin/maintenanceApproval';
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

          {/* Unified Admin Command Center */}
          <Route
            path="/admin"
            element={(
              <AdminRoute>
                <AdminCommandLayout />
              </AdminRoute>
            )}
          >
            <Route index element={<DashboardAdminPage embedded />} />
            <Route path="dashboard" element={<DashboardAdminPage embedded />} />
            <Route path="fleet/active-trips" element={<AdminActiveTripsPage />} />
            <Route path="fleet/delayed-trips" element={<AdminDelayedTripsPage />} />
            <Route path="fleet/locations" element={<AdminFleetLocationPage />} />
            <Route path="routes" element={<RouteControlPage />} />
            <Route path="users" element={<UserAccountsPage />} />
            <Route path="staff-performance" element={<StaffPerformancePage />} />
            <Route path="priority-verification" element={<AdminPriorityVerificationPage />} />
            <Route path="customer-support" element={<AdminCustomerSupportPage />} />
            <Route path="system-notifications" element={<SystemNotificationsPage />} />
            <Route path="promotions" element={<PromotionManagementPage />} />
            <Route path="promotions/statistics" element={<PromotionStatisticsPage />} />
            <Route path="revenue" element={<RevenueReportsPage />} />
            <Route path="fare-operations" element={<FareOperationsPage />} />
            <Route path="walkin-tickets" element={<WalkInTicketMonitoringPage />} />
            <Route path="passenger-compliance" element={<PassengerCompliancePage />} />
            <Route path="analytics/route-efficiency" element={<RouteEfficiencyPage />} />
            <Route path="analytics/congested-routes" element={<CongestedRoutesPage />} />
            <Route path="analytics/feedback" element={<FeedbackAnalyticsPage />} />
            <Route path="incidents" element={<IncidentReportsPage />} />
            <Route path="vehicle-issues" element={<VehicleIssuesPage />} />
            <Route path="maintenance-approval" element={<MaintenanceApprovalPage />} />
            <Route path="system-monitoring" element={<SystemMonitoringPage />} />
            <Route path="system-monitoring/suspicious" element={<SystemMonitoringPage />} />
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
