import OperationChatService from './operationChat.service.js';
import logger from '../../utils/logger.js';

export class OperationChatController {
  static async listGroups(req, res, next) {
    try {
      const groups = await OperationChatService.listMyGroups(req.user);
      return res.success({ groups, count: groups.length }, 'Operation chat groups retrieved successfully');
    } catch (error) {
      logger.error('List operation chat groups error:', error);
      return next(error);
    }
  }

  static async listMessages(req, res, next) {
    try {
      const messages = await OperationChatService.listMessages(req.params.groupId, req.user, req.query);
      return res.success({ messages, count: messages.length }, 'Operation chat messages retrieved successfully');
    } catch (error) {
      logger.error('List operation chat messages error:', error);
      return next(error);
    }
  }

  static async sendMessage(req, res, next) {
    try {
      const message = await OperationChatService.sendMessage(req.params.groupId, req.user, req.body);
      return res.created({ message }, 'Operation chat message sent successfully');
    } catch (error) {
      logger.error('Send operation chat message error:', error);
      return next(error);
    }
  }

  static async markGroupRead(req, res, next) {
    try {
      const result = await OperationChatService.markGroupRead(req.params.groupId, req.user);
      return res.success(result, 'Operation chat group marked as read');
    } catch (error) {
      logger.error('Mark operation chat group read error:', error);
      return next(error);
    }
  }
}

export default OperationChatController;
