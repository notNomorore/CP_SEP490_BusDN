import express from 'express';
import RouteRecommendationController from './routeRecommendation.controller.js';

const router = express.Router();

router.get('/geocode', RouteRecommendationController.geocode);
router.get('/', RouteRecommendationController.recommend);

export default router;
