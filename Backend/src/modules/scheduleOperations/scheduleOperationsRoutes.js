import express from 'express';
import { authMiddleware, authorizeCurrentUserRole } from '../../middleware/authMiddleware.js';
import ScheduleOperationsController from './ScheduleOperationsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeCurrentUserRole('DRIVER', 'BUS_ASSISTANT'));

router.get('/assigned-trips', ScheduleOperationsController.listAssignedTrips);
router.get('/shift-schedule', ScheduleOperationsController.listShiftSchedule);

export default router;
