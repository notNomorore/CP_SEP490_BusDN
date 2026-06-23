import CustomerSupportService from './CustomerSupportService.js';
import {
  CreateSupportCaseDTO,
  FoundItemCaseResponseDTO,
  RespondSupportCaseDTO,
  SupportCaseResponseDTO,
  UpdateFoundItemCaseDTO,
} from './customerSupport.dto.js';
import logger from '../../utils/logger.js';

export class CustomerSupportController {
  static async createCase(req, res, next) {
    try {
      const body = {
        ...req.body,
        lostItem: typeof req.body.lostItem === 'string'
          ? JSON.parse(req.body.lostItem || '{}')
          : req.body.lostItem,
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

  static async listMyLostItemCases(req, res, next) {
    try {
      const cases = await CustomerSupportService.listMyLostItemCases(req.user.userId);
      return res.json({
        success: true,
        data: cases,
        meta: { total: cases.length },
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
      return res.json({ success: true, data: supportCase });
    } catch (error) {
      logger.error('Get passenger lost item case error:', error);
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

  static async listFoundItemCases(req, res, next) {
    try {
      const result = await CustomerSupportService.listFoundItemCases(req.query);

      return res.json({
        success: true,
        data: result.items.map((incident) => FoundItemCaseResponseDTO.format(incident)),
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List found item cases error:', error);
      next(error);
    }
  }

  static async getFoundItemCaseDetail(req, res, next) {
    try {
      const incident = await CustomerSupportService.getFoundItemCaseById(req.params.caseId);

      return res.json({
        success: true,
        data: FoundItemCaseResponseDTO.format(incident),
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
}

export default CustomerSupportController;
