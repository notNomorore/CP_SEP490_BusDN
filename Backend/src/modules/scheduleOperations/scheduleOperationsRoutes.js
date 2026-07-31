import express from 'express';
import { authMiddleware, authorizeCurrentUserRole } from '../../middleware/authMiddleware.js';
import OperationChatController from '../operationChat/operationChat.controller.js';
import ScheduleOperationsController from './ScheduleOperationsController.js';
import { uploadIncidentEvidence } from './scheduleOperationsUpload.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeCurrentUserRole('DRIVER', 'BUS_ASSISTANT'));

router.get('/assigned-trips', ScheduleOperationsController.listAssignedTrips);
router.get('/assigned-trips/:assignmentId', ScheduleOperationsController.getAssignedTripDetail);
router.get('/shift-schedule', ScheduleOperationsController.listShiftSchedule);
router.get('/operation-notifications', ScheduleOperationsController.listOperationNotifications);
router.get('/operation-chat/groups', OperationChatController.listGroups);
router.get('/operation-chat/groups/:groupId/messages', OperationChatController.listMessages);
router.post('/operation-chat/groups/:groupId/messages', OperationChatController.sendMessage);
router.patch('/operation-chat/groups/:groupId/read', OperationChatController.markGroupRead);
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
  uploadIncidentEvidence,
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
