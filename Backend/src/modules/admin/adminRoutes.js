import express from 'express';
import AdminController from './AdminController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRole('ADMIN'));

router.post('/users', AdminController.createManagedUser);
router.get('/staff-performance', AdminController.getStaffPerformance);
router.get('/users', AdminController.listUsers);
router.get('/users/:userId', AdminController.getUserDetail);
router.patch('/users/:userId/lock', AdminController.lockUser);
router.patch('/users/:userId/unlock', AdminController.unlockUser);

export default router;
