import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore.js';

const OPERATIONS_ROLES = ['DRIVER', 'CONDUCTOR', 'BUS_ASSISTANT'];

/**
 * Protected Route - requires authentication
 */
export const ProtectedRoute = ({ children, allowFirstLogin = false }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!allowFirstLogin && user?.isFirstLogin && OPERATIONS_ROLES.includes(user.role)) {
    return <Navigate to="/auth/force-change-password" replace />;
  }

  return children;
};

/**
 * Admin Route - requires admin role
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (user?.isFirstLogin && OPERATIONS_ROLES.includes(user.role)) {
    return <Navigate to="/auth/force-change-password" replace />;
  }

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * Driver Route - requires driver role
 */
export const DriverRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isDriver, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (user?.isFirstLogin && OPERATIONS_ROLES.includes(user.role)) {
    return <Navigate to="/auth/force-change-password" replace />;
  }

  if (!isDriver()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * Operations Route - requires driver or bus assistant role
 */
export const OperationsRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isDriver, isBusAssistant } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!isDriver() && !isBusAssistant()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * Public Route - only for non-authenticated users
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin() ? '/admin/dashboard' : '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
