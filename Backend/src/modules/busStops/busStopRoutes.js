import express from 'express';
import BusStopController from './BusStopController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', BusStopController.getBusStops);
router.get('/export/csv', authMiddleware, authorizeRole('ADMIN'), BusStopController.exportStopsCsv);
router.get('/:id', BusStopController.getBusStop);
router.post('/', authMiddleware, authorizeRole('ADMIN'), BusStopController.postBusStop);
router.post('/import', authMiddleware, authorizeRole('ADMIN'), BusStopController.importStops);
router.post('/sync', authMiddleware, authorizeRole('ADMIN'), BusStopController.syncStops);
router.put('/:id', authMiddleware, authorizeRole('ADMIN'), BusStopController.putBusStop);
router.delete('/:id', authMiddleware, authorizeRole('ADMIN'), BusStopController.removeBusStop);

export default router;
