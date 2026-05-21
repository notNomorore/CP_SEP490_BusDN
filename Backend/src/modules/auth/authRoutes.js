import express from 'express';
import AuthController from './AuthController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public Auth Routes
 */
router.post('/register', AuthController.register);
router.post('/verify-otp', AuthController.verifyOTP);
router.post('/resend-otp', AuthController.resendOTP);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

/**
 * Protected Auth Routes (requires authentication)
 */
router.get('/me', authMiddleware, AuthController.getCurrentUser);
router.post('/logout', authMiddleware, AuthController.logout);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.post('/change-password', authMiddleware, AuthController.changePassword);

export default router;
