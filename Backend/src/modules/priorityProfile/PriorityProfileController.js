import PriorityProfileService from './PriorityProfileService.js';
import {
  RegisterPriorityProfileDTO,
  SubmitPriorityProfileDTO,
  UploadPriorityDocumentsDTO,
  VerifyPriorityProfileDTO,
  PriorityProfileResponseDTO,
} from './priorityProfile.dto.js';
import logger from '../../utils/logger.js';

export class PriorityProfileController {
  static async listRequests(req, res, next) {
    try {
      const result = await PriorityProfileService.listRequests(req.query);

      return res.json({
        success: true,
        data: result.items.map((user) => PriorityProfileResponseDTO.format(user)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List priority profile requests error:', error);
      next(error);
    }
  }

  static async getRequestDetail(req, res, next) {
    try {
      const user = await PriorityProfileService.getRequestById(req.params.requestId);

      return res.json({
        success: true,
        data: PriorityProfileResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Get priority request detail error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async verifyRequest(req, res, next) {
    try {
      const validationErrors = VerifyPriorityProfileDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const user = await PriorityProfileService.verifyRequest(
        req.params.requestId,
        req.body,
        req.user.userId
      );

      return res.json({
        success: true,
        message: `Priority profile ${req.body.status.toLowerCase()} successfully`,
        data: PriorityProfileResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Verify priority profile request error:', error);

      if (
        error.message.includes('not found')
        || error.message.includes('without uploaded documents')
        || error.message.includes('cannot be verified again')
        || error.message.includes('Processed priority profile request')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async getStatus(req, res, next) {
    try {
      const user = await PriorityProfileService.getProfile(req.user.userId);

      return res.json({
        success: true,
        data: PriorityProfileResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Get priority profile status error:', error);
      next(error);
    }
  }

  static async listMyRequests(req, res, next) {
    try {
      const requests = await PriorityProfileService.listPassengerRequests(req.user.userId);

      return res.json({
        success: true,
        data: requests.map((request) => PriorityProfileResponseDTO.format(request)),
      });
    } catch (error) {
      logger.error('List passenger priority profile requests error:', error);
      next(error);
    }
  }

  static async register(req, res, next) {
    try {
      const validationErrors = RegisterPriorityProfileDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const user = await PriorityProfileService.registerProfile(req.user.userId, req.body);

      return res.status(201).json({
        success: true,
        message: 'Priority profile submitted for verification',
        data: PriorityProfileResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Register priority profile error:', error);

      if (error.message.includes('still active') || error.message.includes('pending review')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async submit(req, res, next) {
    try {
      const validationErrors = SubmitPriorityProfileDTO.validate(req.body, req.files);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const request = await PriorityProfileService.submitProfile(
        req.user.userId,
        req.body,
        req.files
      );

      return res.status(201).json({
        success: true,
        message: 'Priority profile submitted for verification',
        data: PriorityProfileResponseDTO.format(request),
      });
    } catch (error) {
      logger.error('Submit priority profile error:', error);

      if (error.message.includes('still active') || error.message.includes('pending review')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async uploadDocuments(req, res, next) {
    try {
      const validationErrors = UploadPriorityDocumentsDTO.validate(req.body, req.files);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const user = await PriorityProfileService.uploadDocuments(
        req.user.userId,
        req.body.documentType,
        req.files
      );

      return res.status(201).json({
        success: true,
        message: 'Verification documents uploaded successfully',
        data: PriorityProfileResponseDTO.format(user),
      });
    } catch (error) {
      logger.error('Upload priority documents error:', error);

      if (
        error.message.includes('must be registered')
        || error.message.includes('cannot be changed')
        || error.message.includes('Only JPG')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }
}

export default PriorityProfileController;
