import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';
import FareOperationsController from './fareOperations.controller.js';
import {
  validateFareMatrixPayload,
  validateMonthlyPassPricingPayload,
  validateObjectIdParam,
  validatePriorityDiscountPayload,
  validateStatusPayload,
} from './fareOperations.validators.js';

const router = express.Router();

router.use(authMiddleware, authorizeRole('ADMIN'));

router.get('/matrix', asyncHandler(FareOperationsController.listFareMatrix));
router.post('/matrix', validateRequest(validateFareMatrixPayload), asyncHandler(FareOperationsController.createFareMatrix));
router.put('/matrix/:id', validateRequest(validateObjectIdParam, 'params'), validateRequest(validateFareMatrixPayload), asyncHandler(FareOperationsController.updateFareMatrix));
router.patch('/matrix/:id/status', validateRequest(validateObjectIdParam, 'params'), validateRequest(validateStatusPayload), asyncHandler(FareOperationsController.updateFareMatrixStatus));
router.delete('/matrix/:id', validateRequest(validateObjectIdParam, 'params'), asyncHandler(FareOperationsController.deleteFareMatrix));

router.get('/monthly-pass-pricing', asyncHandler(FareOperationsController.listMonthlyPassPricing));
router.post('/monthly-pass-pricing', validateRequest(validateMonthlyPassPricingPayload), asyncHandler(FareOperationsController.createMonthlyPassPricing));
router.put('/monthly-pass-pricing/:id', validateRequest(validateObjectIdParam, 'params'), validateRequest(validateMonthlyPassPricingPayload), asyncHandler(FareOperationsController.updateMonthlyPassPricing));
router.patch('/monthly-pass-pricing/:id/status', validateRequest(validateObjectIdParam, 'params'), validateRequest(validateStatusPayload), asyncHandler(FareOperationsController.updateMonthlyPassPricingStatus));
router.delete('/monthly-pass-pricing/:id', validateRequest(validateObjectIdParam, 'params'), asyncHandler(FareOperationsController.deleteMonthlyPassPricing));

router.get('/priority-discounts', asyncHandler(FareOperationsController.listPriorityDiscounts));
router.post('/priority-discounts', validateRequest(validatePriorityDiscountPayload), asyncHandler(FareOperationsController.createPriorityDiscount));
router.put('/priority-discounts/:id', validateRequest(validateObjectIdParam, 'params'), validateRequest(validatePriorityDiscountPayload), asyncHandler(FareOperationsController.updatePriorityDiscount));
router.patch('/priority-discounts/:id/status', validateRequest(validateObjectIdParam, 'params'), validateRequest(validateStatusPayload), asyncHandler(FareOperationsController.updatePriorityDiscountStatus));
router.delete('/priority-discounts/:id', validateRequest(validateObjectIdParam, 'params'), asyncHandler(FareOperationsController.deletePriorityDiscount));

router.post('/calculate/one-way', asyncHandler(FareOperationsController.calculateOneWayFare));
router.post('/calculate/monthly-pass', asyncHandler(FareOperationsController.calculateMonthlyPassPrice));

export default router;
