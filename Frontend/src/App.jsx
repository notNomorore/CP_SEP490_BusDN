import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import {
  AdminCustomerSupportPage,
  LostItemCaseStatusPage,
  MyFeedbackPage,
  ReportLostItemPage,
  SubmitFeedbackPage,
} from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import { ETicketPage, MyTicketsPage, ValidateTicketPage } from './features/tickets';
import { TravelHistoryPage } from './features/travelHistory';
import { RouteControlPage, UserAccountsPage } from './features/admin';
import {
  LoginPage,
  RegisterPage,
  RegisterVerifyOtpPage,
  ProtectedRoute,
  PublicRoute,
  AdminRoute,
} from './features/auth';
import { ProfilePage } from './features/profile';

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
          <Route
            path="/buy-tickets"
            element={
              <ProtectedRoute>
                <MyTicketsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-tickets"
            element={
              <ProtectedRoute>
                <MyTicketsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              <ProtectedRoute>
                <ETicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conductor/validate-qr"
            element={
              <ProtectedRoute>
                <ValidateTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/travel-history"
            element={
              <ProtectedRoute>
                <TravelHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/submit-feedback"
            element={
              <ProtectedRoute>
                <SubmitFeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-feedback"
            element={
              <ProtectedRoute>
                <MyFeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report-lost-item"
            element={
              <ProtectedRoute>
                <ReportLostItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lost-item-cases"
            element={
              <ProtectedRoute>
                <LostItemCaseStatusPage />
              </ProtectedRoute>
            }
          />

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
            path="/admin/routes"
            element={
              <AdminRoute>
                <RouteControlPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserAccountsPage />
              </AdminRoute>
            }
          />
        </Routes>
      </AppInitializer>
    </Router>
  );
}

export default App;
