import express from 'express';
import RouteController from './RouteController.js';

const router = express.Router();

router.get('/search', RouteController.search);
router.get('/', RouteController.search);

export default router;
