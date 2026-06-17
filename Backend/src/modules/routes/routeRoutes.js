import express from 'express';
import RouteController from './RouteController.js';

const router = express.Router();

router.get('/nearby', RouteController.nearby);
router.get('/best', RouteController.best);
router.get('/suggestions', RouteController.suggestions);
router.get('/:routeId/live', RouteController.live);
router.get('/:routeId/eta', RouteController.eta);
router.get('/search', RouteController.search);
router.get('/', RouteController.search);

export default router;
