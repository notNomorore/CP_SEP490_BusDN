import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import { AdminCustomerSupportPage } from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import { UserAccountsPage } from './features/admin';
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

function App() {
  return (
    <Router>
      <AppInitializer>
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<HomePage />} />

          {/* Auth Routes */}
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

          {/* Backward compatibility - old paths */}
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

          {/* Route Feature */}
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchRoutesPage />
              </ProtectedRoute>
            }
          />

          {/* Ticket Feature */}
          {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          {/* Tracking Feature */}
          {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

          {/* Profile Feature */}
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
            element={(
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            )}
          />

          {/* Admin Feature */}
          <Route
            path="/admin/priority-verification"
            element={
              <AdminRoute>
                <AdminPriorityVerificationPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/customer-support"
            element={
              <AdminRoute>
                <AdminCustomerSupportPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={(
              <AdminRoute>
                <UserAccountsPage />
              </AdminRoute>
            )}
          />

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
