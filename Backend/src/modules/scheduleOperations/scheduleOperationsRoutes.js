import express from 'express';
import { authMiddleware, authorizeCurrentUserRole } from '../../middleware/authMiddleware.js';
import ScheduleOperationsController from './ScheduleOperationsController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeCurrentUserRole('DRIVER', 'BUS_ASSISTANT'));

router.get('/assigned-trips', ScheduleOperationsController.listAssignedTrips);
router.get('/shift-schedule', ScheduleOperationsController.listShiftSchedule);
router.patch(
  '/assigned-trips/:assignmentId/accept',
  ScheduleOperationsController.acceptAssignedTrip
);
router.patch(
  '/assigned-trips/:assignmentId/reject',
  ScheduleOperationsController.rejectAssignedTrip
);
router.patch(
  '/assigned-trips/:assignmentId/start',
  ScheduleOperationsController.startTrip
);
router.patch(
  '/assigned-trips/:assignmentId/complete',
  ScheduleOperationsController.completeTrip
);
router.patch(
  '/assigned-trips/:assignmentId/gps-sync',
  ScheduleOperationsController.syncTripGps
);
router.get(
  '/assigned-trips/:assignmentId/incidents',
  ScheduleOperationsController.listOperationIncidents
);
router.post(
  '/assigned-trips/:assignmentId/incidents',
  ScheduleOperationsController.reportOperationIncident
);
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
