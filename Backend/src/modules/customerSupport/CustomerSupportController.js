import CustomerSupportService from './CustomerSupportService.js';
import LostAndFoundMatchingService from './LostAndFoundMatchingService.js';
import {
  CreateSupportCaseDTO,
  AssignFeedbackDTO,
  CorrectiveActionDTO,
  FoundItemCaseResponseDTO,
  FeedbackAdminActionDTO,
  InternalNoteDTO,
  LostFoundMatchResponseDTO,
  MatchReviewDTO,
  PassengerLostItemCaseResponseDTO,
  PassengerFeedbackReplyDTO,
  RespondSupportCaseDTO,
  SupportCaseResponseDTO,
  UpdateFoundItemCaseDTO,
  UpdateLostItemCaseDTO,
} from './customerSupport.dto.js';
import logger from '../../utils/logger.js';

export class CustomerSupportController {
  static formatAdminLostItemCase({ sourceType, record }) {
    return sourceType === 'PASSENGER_LOST_ITEM'
      ? PassengerLostItemCaseResponseDTO.format(record)
      : FoundItemCaseResponseDTO.format(record);
  }

  static async createCase(req, res, next) {
    try {
      let lostItem = req.body.lostItem;
      if (typeof lostItem === 'string') {
        try {
          lostItem = JSON.parse(lostItem || '{}');
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Lost item details must be valid JSON',
          });
        }
      }

      const body = {
        ...req.body,
        lostItem,
      };
      const validationErrors = CreateSupportCaseDTO.validate(body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.createCase(
        req.user.userId,
        body,
        req.files || []
      );

      return res.status(201).json({
        success: true,
        message: 'Support case submitted successfully',
        data: SupportCaseResponseDTO.format(supportCase),
      });
    } catch (error) {
      logger.error('Create support case error:', error);
      next(error);
    }
  }

  static async listCases(req, res, next) {
    try {
      const result = await CustomerSupportService.listCases(req.query, req.user.userId);

      return res.json({
        success: true,
        data: result.items.map((supportCase) => SupportCaseResponseDTO.format(supportCase, { includeInternal: true })),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List support cases error:', error);
      next(error);
    }
  }

  static async listMyFeedback(req, res, next) {
    try {
      const result = await CustomerSupportService.listMyFeedback(req.user.userId, req.query);

      return res.json({
        success: true,
        data: result.items.map((supportCase) => SupportCaseResponseDTO.format(supportCase)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List passenger feedback error:', error);
      next(error);
    }
  }

  static async getMyFeedback(req, res, next) {
    try {
      const supportCase = await CustomerSupportService.getMyFeedback(req.user.userId, req.params.caseId);

      return res.json({
        success: true,
        data: SupportCaseResponseDTO.format(supportCase),
      });
    } catch (error) {
      logger.error('Get passenger feedback error:', error);

      if (error.statusCode === 404 || error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'Feedback not found',
        });
      }

      next(error);
    }
  }

  static async addPassengerFeedbackReply(req, res, next) {
    try {
      const validationErrors = PassengerFeedbackReplyDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.addPassengerFeedbackReply(
        req.user.userId,
        req.params.caseId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Feedback reply submitted successfully',
        data: SupportCaseResponseDTO.format(supportCase),
      });
    } catch (error) {
      logger.error('Passenger feedback reply error:', error);

      if (error.statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async listMyLostItemCases(req, res, next) {
    try {
      const cases = await CustomerSupportService.listMyLostItemCases(req.user.userId);

      return res.json({
        success: true,
        data: cases,
        meta: {
          total: cases.length,
        },
      });
    } catch (error) {
      logger.error('List passenger lost item cases error:', error);
      next(error);
    }
  }

  static async getMyLostItemCase(req, res, next) {
    try {
      const supportCase = await CustomerSupportService.getMyLostItemCase(
        req.user.userId,
        req.params.caseId
      );

      return res.json({
        success: true,
        data: supportCase,
      });
    } catch (error) {
      logger.error('Get passenger lost item case error:', error);

      if (error.statusCode === 404 || error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'Lost item case not found',
        });
      }

      next(error);
    }
  }

  static async getCaseDetail(req, res, next) {
    try {
      const supportCase = await CustomerSupportService.getCaseById(req.params.caseId);

      return res.json({
        success: true,
        data: SupportCaseResponseDTO.format(supportCase),
      });
    } catch (error) {
      logger.error('Get support case detail error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async respondToComplaint(req, res, next) {
    try {
      const validationErrors = RespondSupportCaseDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.respondToComplaint(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Complaint response recorded successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Respond to complaint error:', error);

      if (error.message.includes('Only complaint')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async listFoundItemCases(req, res, next) {
    try {
      const result = await CustomerSupportService.listAdminLostItemCases(req.query);

      return res.json({
        success: true,
        data: result.items.map((item) => CustomerSupportController.formatAdminLostItemCase(item)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List found item cases error:', error);
      next(error);
    }
  }

  static async getFoundItemCaseDetail(req, res, next) {
    try {
      const item = await CustomerSupportService.getAdminLostItemCaseById(req.params.caseId);

      return res.json({
        success: true,
        data: CustomerSupportController.formatAdminLostItemCase(item),
      });
    } catch (error) {
      logger.error('Get found item case detail error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async updateFoundItemCase(req, res, next) {
    try {
      const validationErrors = UpdateFoundItemCaseDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const incident = await CustomerSupportService.updateFoundItemCase(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Lost item case updated successfully',
        data: FoundItemCaseResponseDTO.format(incident),
      });
    } catch (error) {
      logger.error('Update found item case error:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async listPotentialMatches(req, res, next) {
    try {
      const result = await LostAndFoundMatchingService.listMatches(req.query);

      return res.json({
        success: true,
        data: result.items.map((match) => LostFoundMatchResponseDTO.format(match)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List lost-found matches error:', error);
      next(error);
    }
  }

  static async getPotentialMatch(req, res, next) {
    try {
      const match = await LostAndFoundMatchingService.getMatchById(req.params.matchId);

      return res.json({
        success: true,
        data: LostFoundMatchResponseDTO.format(match),
      });
    } catch (error) {
      logger.error('Get lost-found match error:', error);
      next(error);
    }
  }

  static async confirmPotentialMatch(req, res, next) {
    try {
      const validationErrors = MatchReviewDTO.validateConfirm(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const match = await LostAndFoundMatchingService.confirmMatch(
        req.params.matchId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Potential match confirmed successfully',
        data: LostFoundMatchResponseDTO.format(match),
      });
    } catch (error) {
      logger.error('Confirm lost-found match error:', error);
      next(error);
    }
  }

  static async rejectPotentialMatch(req, res, next) {
    try {
      const validationErrors = MatchReviewDTO.validateReject(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const match = await LostAndFoundMatchingService.rejectMatch(
        req.params.matchId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Potential match rejected successfully',
        data: LostFoundMatchResponseDTO.format(match),
      });
    } catch (error) {
      logger.error('Reject lost-found match error:', error);
      next(error);
    }
  }

  static async startReturnProcess(req, res, next) {
    try {
      const validationErrors = MatchReviewDTO.validateStartReturn(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const match = await LostAndFoundMatchingService.startReturn(
        req.params.matchId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Return process started successfully',
        data: LostFoundMatchResponseDTO.format(match),
      });
    } catch (error) {
      logger.error('Start lost-found return error:', error);
      next(error);
    }
  }

  static async completeReturnProcess(req, res, next) {
    try {
      const validationErrors = MatchReviewDTO.validateCompleteReturn(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const match = await LostAndFoundMatchingService.completeReturn(
        req.params.matchId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Item return completed successfully',
        data: LostFoundMatchResponseDTO.format(match),
      });
    } catch (error) {
      logger.error('Complete lost-found return error:', error);
      next(error);
    }
  }

  static async updateLostItemCase(req, res, next) {
    try {
      const validationErrors = UpdateLostItemCaseDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.updateLostItemCase(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Lost item case updated successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Update lost item case error:', error);

      if (error.message.includes('Only lost item')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async assignFeedback(req, res, next) {
    try {
      const validationErrors = AssignFeedbackDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.assignFeedback(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Feedback assignment updated successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Assign feedback error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async updateFeedback(req, res, next) {
    try {
      const validationErrors = FeedbackAdminActionDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.updateFeedback(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.json({
        success: true,
        message: 'Feedback ticket updated successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Update feedback error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async previewCaseNotification(req, res, next) {
    try {
      const preview = await CustomerSupportService.previewFeedbackNotification(
        req.params.caseId,
        req.user.userId,
        req.method === 'GET' ? req.query : req.body
      );

      return res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      logger.error('Preview case notification error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async addInternalNote(req, res, next) {
    try {
      const validationErrors = InternalNoteDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.addInternalNote(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: 'Internal note added successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Add internal note error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async addCorrectiveAction(req, res, next) {
    try {
      const validationErrors = CorrectiveActionDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.addCorrectiveAction(
        req.params.caseId,
        req.user.userId,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: 'Corrective action recorded successfully',
        data: SupportCaseResponseDTO.format(supportCase, { includeInternal: true }),
      });
    } catch (error) {
      logger.error('Add corrective action error:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }

  static async getFeedbackAnalytics(req, res, next) {
    try {
      const analytics = await CustomerSupportService.getFeedbackAnalytics();

      return res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Feedback analytics error:', error);
      next(error);
    }
  }
}

export default CustomerSupportController;
