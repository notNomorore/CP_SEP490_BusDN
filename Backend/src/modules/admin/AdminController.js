import mongoose from 'mongoose';
import AdminModel from './AdminModel.js';
import logger from '../../utils/logger.js';

const ALLOWED_MANAGED_ROLES = new Set(['DRIVER', 'CONDUCTOR', 'STAFF']);

const validateManagedUserPayload = (payload) => {
  const errors = {};
  const { fullName, email, phone, role, password, confirmPassword } = payload;

  if (!fullName || fullName.trim().length === 0) errors.fullName = 'Full name is required';
  if (!email && !phone) errors.identifier = 'Email or phone is required';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email format';
  if (phone && !/^(\+84|0)[0-9]{9,10}$/.test(phone)) errors.phone = 'Invalid phone format';
  if (!ALLOWED_MANAGED_ROLES.has(role)) errors.role = 'Role must be DRIVER, CONDUCTOR, or STAFF';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[A-Z]/.test(password)) errors.password = 'Password must contain uppercase letter';
  else if (!/[a-z]/.test(password)) errors.password = 'Password must contain lowercase letter';
  else if (!/[0-9]/.test(password)) errors.password = 'Password must contain number';
  else if (!/[@$!%*?&]/.test(password)) errors.password = 'Password must contain special character (@$!%*?&)';

  if (!confirmPassword || confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return Object.keys(errors).length ? errors : null;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export class AdminController {
  static async createManagedUser(req, res, next) {
    try {
      const validationErrors = validateManagedUserPayload(req.body);
      if (validationErrors) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
      }

      const existingUser = await AdminModel.findUserByIdentifier({ email: req.body.email, phone: req.body.phone });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email or phone already registered' });
      }

      const user = await AdminModel.createManagedUser({
        email: req.body.email?.toLowerCase(),
        phone: req.body.phone || undefined,
        fullName: req.body.fullName.trim(),
        password: req.body.password,
        role: req.body.role,
        status: 'ACTIVE',
        isVerified: true,
        isFirstLogin: true,
        staffMetrics: {
          completedTrips: 0,
          incidents: 0,
          onTimeRate: 100,
          performanceScore: 100,
          lastActivityAt: new Date(),
        },
        activityReports: [{
          type: 'ACCOUNT_CREATED',
          message: `Account created for ${req.body.role.toLowerCase()} role and permissions assigned by administrator.`,
          createdAt: new Date(),
        }],
      });

      return res.status(201).json({ success: true, message: 'Managed account created successfully', user });
    } catch (error) {
      logger.error('Create managed user error:', error);
      next(error);
    }
  }

  static async getStaffPerformance(req, res, next) {
    try {
      const [summary, staffMembers] = await Promise.all([
        AdminModel.getStaffPerformanceSummary(),
        AdminModel.findStaffPerformanceUsers(),
      ]);

      return res.json({
        success: true,
        message: 'Staff performance statistics retrieved successfully',
        summary: {
          staffCount: summary.staffCount || 0,
          totalCompletedTrips: summary.totalCompletedTrips || 0,
          totalIncidents: summary.totalIncidents || 0,
          averageOnTimeRate: Math.round(summary.averageOnTimeRate || 0),
        },
        staffMembers,
      });
    } catch (error) {
      logger.error('Get staff performance error:', error);
      next(error);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const options = AdminModel.buildUserQueryOptions(req.query);
      const result = await AdminModel.findUsers(options);
      return res.json({ success: true, message: 'Users retrieved successfully', ...result });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  }

  static async getUserDetail(req, res, next) {
    try {
      const user = await AdminModel.findUserById(req.params.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User detail retrieved successfully', user });
    } catch (error) {
      logger.error('Get user detail error:', error);
      next(error);
    }
  }

  static async lockUser(req, res, next) {
    try {
      const { userId } = req.params;
      if (!isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
      const lockedUntil = req.body.lockedUntil ? new Date(req.body.lockedUntil) : null;
      const user = await AdminModel.lockUserById(userId, { reason: req.body.reason, lockedUntil });
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User account locked successfully', user });
    } catch (error) {
      logger.error('Lock user error:', error);
      next(error);
    }
  }

  static async unlockUser(req, res, next) {
    try {
      const user = await AdminModel.unlockUserById(req.params.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
      return res.json({ success: true, message: 'User account unlocked successfully', user });
    } catch (error) {
      logger.error('Unlock user error:', error);
      next(error);
    }
  }
}

export default AdminController;
