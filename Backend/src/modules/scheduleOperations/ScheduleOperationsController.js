import ScheduleOperationsService from './ScheduleOperationsService.js';
import {
  OperationIncidentResponseDTO,
  ShiftAssignmentResponseDTO,
  VehicleInspectionResponseDTO,
} from './scheduleOperations.dto.js';
import logger from '../../utils/logger.js';

export class ScheduleOperationsController {
  static async listAssignedTrips(req, res, next) {
    try {
      const assignments = await ScheduleOperationsService.listAssignedTrips(
        req.user.userId,
        req.user.role,
        req.query
      );

      return res.success(
        {
          trips: assignments.map((assignment) => (
            ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role)
          )),
          count: assignments.length,
        },
        'Assigned trips retrieved successfully'
      );
    } catch (error) {
      logger.error('List assigned trips error:', error);
      next(error);
    }
  }

  static async listShiftSchedule(req, res, next) {
    try {
      const assignments = await ScheduleOperationsService.listShiftSchedule(
        req.user.userId,
        req.user.role,
        req.query
      );

      return res.success(
        {
          shifts: assignments.map((assignment) => (
            ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role)
          )),
          count: assignments.length,
        },
        'Shift schedule retrieved successfully'
      );
    } catch (error) {
      logger.error('List shift schedule error:', error);
      next(error);
    }
  }

  static async startVehicleInspection(req, res, next) {
    try {
      const inspection = await ScheduleOperationsService.startVehicleInspection(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      return res.success(
        VehicleInspectionResponseDTO.format(inspection),
        'Vehicle inspection started successfully'
      );
    } catch (error) {
      logger.error('Start vehicle inspection error:', error);
      next(error);
    }
  }

  static async confirmVehicleReady(req, res, next) {
    try {
      const inspection = await ScheduleOperationsService.confirmVehicleReady(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      return res.success(
        VehicleInspectionResponseDTO.format(inspection),
        'Vehicle readiness confirmed successfully'
      );
    } catch (error) {
      logger.error('Confirm vehicle ready error:', error);
      next(error);
    }
  }

  static async reportVehicleIssue(req, res, next) {
    try {
      const inspection = await ScheduleOperationsService.reportVehicleIssue(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      return res.success(
        VehicleInspectionResponseDTO.format(inspection),
        'Vehicle issue reported successfully'
      );
    } catch (error) {
      logger.error('Report vehicle issue error:', error);
      next(error);
    }
  }

  static async acceptAssignedTrip(req, res, next) {
    try {
      const assignment = await ScheduleOperationsService.acceptAssignedTrip(
        req.user.userId,
        req.user.role,
        req.params.assignmentId
      );

      await ScheduleOperationsService.attachInspectionRecords([assignment]);

      return res.success(
        ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role),
        'Assigned trip accepted successfully'
      );
    } catch (error) {
      logger.error('Accept assigned trip error:', error);
      next(error);
    }
  }

  static async rejectAssignedTrip(req, res, next) {
    try {
      const assignment = await ScheduleOperationsService.rejectAssignedTrip(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      await ScheduleOperationsService.attachInspectionRecords([assignment]);

      return res.success(
        ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role),
        'Assigned trip rejected successfully'
      );
    } catch (error) {
      logger.error('Reject assigned trip error:', error);
      next(error);
    }
  }

  static async startTrip(req, res, next) {
    try {
      const assignment = await ScheduleOperationsService.startTrip(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      await ScheduleOperationsService.attachInspectionRecords([assignment]);

      return res.success(
        ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role),
        'Trip started successfully'
      );
    } catch (error) {
      logger.error('Start trip error:', error);
      next(error);
    }
  }

  static async completeTrip(req, res, next) {
    try {
      const assignment = await ScheduleOperationsService.completeTrip(
        req.user.userId,
        req.user.role,
        req.params.assignmentId
      );

      await ScheduleOperationsService.attachInspectionRecords([assignment]);

      return res.success(
        ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role),
        'Trip completed successfully'
      );
    } catch (error) {
      logger.error('Complete trip error:', error);
      next(error);
    }
  }

  static async syncTripGps(req, res, next) {
    try {
      const assignment = await ScheduleOperationsService.syncTripGps(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      await ScheduleOperationsService.attachInspectionRecords([assignment]);

      return res.success(
        ShiftAssignmentResponseDTO.format(assignment, req.user.userId, req.user.role),
        'Trip GPS synced successfully'
      );
    } catch (error) {
      logger.error('Sync trip GPS error:', error);
      next(error);
    }
  }

  static async reportOperationIncident(req, res, next) {
    try {
      const incident = await ScheduleOperationsService.reportOperationIncident(
        req.user.userId,
        req.user.role,
        req.params.assignmentId,
        req.body
      );

      return res.success(
        OperationIncidentResponseDTO.format(incident),
        'Operation incident reported successfully'
      );
    } catch (error) {
      logger.error('Report operation incident error:', error);
      next(error);
    }
  }

  static async listOperationIncidents(req, res, next) {
    try {
      const incidents = await ScheduleOperationsService.listOperationIncidents(
        req.user.userId,
        req.user.role,
        req.params.assignmentId
      );

      return res.success(
        {
          incidents: incidents.map((incident) => OperationIncidentResponseDTO.format(incident)),
          count: incidents.length,
        },
        'Operation incidents retrieved successfully'
      );
    } catch (error) {
      logger.error('List operation incidents error:', error);
      next(error);
    }
  }
}

export default ScheduleOperationsController;
