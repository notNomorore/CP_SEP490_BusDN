import express from 'express';
import multer from 'multer';
import AdminController from './AdminController.js';
import { authMiddleware, authorizeRole } from '../../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(authMiddleware);
router.use(authorizeRole('ADMIN'));

router.post('/users', AdminController.createManagedUser);
router.post('/users/import', upload.single('file'), AdminController.importManagedUsers);
router.get('/staff-performance', AdminController.getStaffPerformance);
router.get('/routes', AdminController.listRoutes);
router.post('/routes', AdminController.createRoute);
router.get('/routes/:routeId', AdminController.getRouteDetail);
router.put('/routes/:routeId', AdminController.updateRoute);
router.patch('/routes/:routeId', AdminController.updateRoute);
router.patch('/routes/:routeId/suspend', AdminController.suspendRoute);
router.delete('/routes/:routeId', AdminController.deleteRoute);
router.get('/stations', AdminController.listStations);
router.post('/stations', AdminController.createStation);
router.get('/buses', AdminController.listBuses);
router.post('/buses', AdminController.createBus);
router.put('/buses/:busId', AdminController.updateBus);
router.get('/trip-schedules', AdminController.listTripSchedules);
router.post('/trip-schedules', AdminController.createTripSchedule);
router.put('/trip-schedules/:scheduleId', AdminController.updateTripSchedule);
router.get('/drivers', AdminController.listRouteStaff);
router.get('/users', AdminController.listUsers);
router.get('/users/:userId', AdminController.getUserDetail);
router.patch('/users/:userId/lock', AdminController.lockUser);
router.patch('/users/:userId/unlock', AdminController.unlockUser);

export default router;
