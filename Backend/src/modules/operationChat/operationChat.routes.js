import express from 'express';
import { authMiddleware, authorizeCurrentUserRole } from '../../middleware/authMiddleware.js';
import OperationChatController from './operationChat.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeCurrentUserRole('ADMIN', 'DRIVER', 'BUS_ASSISTANT'));

router.get('/groups', OperationChatController.listGroups);
router.get('/groups/:groupId/messages', OperationChatController.listMessages);
router.post('/groups/:groupId/messages', OperationChatController.sendMessage);
router.patch('/groups/:groupId/read', OperationChatController.markGroupRead);

export default router;
