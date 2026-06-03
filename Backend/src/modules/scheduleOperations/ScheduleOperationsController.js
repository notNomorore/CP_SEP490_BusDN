import ScheduleOperationsService from './ScheduleOperationsService.js';
import {
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
}

export default ScheduleOperationsController;
