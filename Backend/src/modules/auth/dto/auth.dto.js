/**
 * DTO for user registration
 */
export const RegisterDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.email && !body.phone) {
      errors.identifier = 'Email or phone is required';
    }

    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        errors.email = 'Invalid email format';
      }
    }

    if (body.phone) {
      const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
      if (!phoneRegex.test(body.phone)) {
        errors.phone = 'Invalid phone format';
      }
    }

    if (!body.fullName || body.fullName.trim().length === 0) {
      errors.fullName = 'Full name is required';
    }

    if (!body.password) {
      errors.password = 'Password is required';
    } else if (body.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(body.password)) {
      errors.password = 'Password must contain uppercase letter';
    } else if (!/[a-z]/.test(body.password)) {
      errors.password = 'Password must contain lowercase letter';
    } else if (!/[0-9]/.test(body.password)) {
      errors.password = 'Password must contain number';
    } else if (!/[@$!%*?&]/.test(body.password)) {
      errors.password = 'Password must contain special character (@$!%*?&)';
    }

    if (!body.confirmPassword || body.password !== body.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for user login
 */
export const LoginDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.identifier) {
      errors.identifier = 'Email or phone is required';
    }

    if (!body.password) {
      errors.password = 'Password is required';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for OTP verification
 */
export const VerifyOtpDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.email && !body.phone) {
      errors.identifier = 'Email or phone is required';
    }

    if (!body.otp || body.otp.length !== 6) {
      errors.otp = 'OTP must be 6 digits';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for verification OTP resend
 */
export const ResendOtpDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.email && !body.phone) {
      errors.identifier = 'Email or phone is required';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for password reset request
 */
export const ForgotPasswordDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.email && !body.phone) {
      errors.identifier = 'Email or phone is required';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for password reset
 */
export const ResetPasswordDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.token) {
      errors.token = 'Reset token is required';
    }

    if (!body.otp || body.otp.length !== 6) {
      errors.otp = 'OTP must be 6 digits';
    }

    if (!body.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (body.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain uppercase letter';
    } else if (!/[a-z]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain lowercase letter';
    } else if (!/[0-9]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain number';
    } else if (!/[@$!%*?&]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain special character (@$!%*?&)';
    }

    if (!body.confirmPassword || body.newPassword !== body.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for change password
 */
export const ChangePasswordDTO = {
  validate: (body) => {
    const errors = {};

    if (!body.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!body.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (body.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain uppercase letter';
    } else if (!/[a-z]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain lowercase letter';
    } else if (!/[0-9]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain number';
    } else if (!/[@$!%*?&]/.test(body.newPassword)) {
      errors.newPassword = 'Password must contain special character (@$!%*?&)';
    }

    if (!body.confirmPassword || body.newPassword !== body.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length === 0 ? null : errors;
  },
};

/**
 * DTO for user response
 */
export const UserResponseDTO = {
  format: (user) => ({
    id: user._id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
    isFirstLogin: user.isFirstLogin,
    walletBalance: user.walletBalance,
  }),
};

/**
 * DTO for auth response
 */
export const AuthResponseDTO = {
  format: (user, token) => ({
    token,
    user: UserResponseDTO.format(user),
  }),
};
