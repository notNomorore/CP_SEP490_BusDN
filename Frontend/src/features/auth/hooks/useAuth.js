import useAuthStore from '../stores/authStore.js';

/**
 * Custom hook to access auth store
 */
export const useAuth = () => {
  const store = useAuthStore();

  return {
    // State
    user: store.user,
    token: store.token,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    error: store.error,

    // Selectors
    isAdmin: store.isAdmin,
    isDriver: store.isDriver,
    isConductor: store.isConductor,
    isPassenger: store.isPassenger,

    // Actions
    login: store.login,
    register: store.register,
    logout: store.logout,
    verifyOTP: store.verifyOTP,
    requestPasswordReset: store.requestPasswordReset,
    resetPassword: store.resetPassword,
    changePassword: store.changePassword,
    updateProfile: store.updateProfile,
    refreshUser: store.refreshUser,
    clearError: store.clearError,
    restoreSession: store.restoreSession,
  };
};

export default useAuth;
