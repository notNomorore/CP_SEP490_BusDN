import express from 'express';
import { authMiddleware, authorizeCurrentUserRole } from '../../middleware/authMiddleware.js';
import ScheduleOperationsController from './ScheduleOperationsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeCurrentUserRole('DRIVER', 'BUS_ASSISTANT'));

router.get('/assigned-trips', ScheduleOperationsController.listAssignedTrips);
router.get('/shift-schedule', ScheduleOperationsController.listShiftSchedule);
router.post(
  '/assigned-trips/:assignmentId/inspection/start',
  ScheduleOperationsController.startVehicleInspection
);
router.patch(
  '/assigned-trips/:assignmentId/inspection/ready',
  ScheduleOperationsController.confirmVehicleReady
);
router.post(
  '/assigned-trips/:assignmentId/inspection/issues',
  ScheduleOperationsController.reportVehicleIssue
);

export default router;
