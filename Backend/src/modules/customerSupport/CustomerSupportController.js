import CustomerSupportService from './CustomerSupportService.js';
import {
  CreateSupportCaseDTO,
  RespondSupportCaseDTO,
  SupportCaseResponseDTO,
} from './customerSupport.dto.js';
import logger from '../../utils/logger.js';

export class CustomerSupportController {
  static async createCase(req, res, next) {
    try {
      const validationErrors = CreateSupportCaseDTO.validate(req.body);

      if (validationErrors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      const supportCase = await CustomerSupportService.createCase(req.user.userId, req.body);

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
      const result = await CustomerSupportService.listCases(req.query);

      return res.json({
        success: true,
        data: result.items.map((supportCase) => SupportCaseResponseDTO.format(supportCase)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List support cases error:', error);
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
        data: SupportCaseResponseDTO.format(supportCase),
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
}

export default CustomerSupportController;
