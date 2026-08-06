import PromotionService from './PromotionService.js';
import logger from '../../utils/logger.js';

const DEFAULT_INTERVAL_MS = 60 * 1000;

export const startPromotionNotificationScheduler = ({ io = null, intervalMs = DEFAULT_INTERVAL_MS } = {}) => {
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await PromotionService.dispatchDuePromotionNotifications({ io });
    } catch (error) {
      logger.error('Promotion notification scheduler failed:', error);
    } finally {
      isRunning = false;
    }
  };

  const intervalId = setInterval(runOnce, intervalMs);
  runOnce();

  return () => clearInterval(intervalId);
};

export default startPromotionNotificationScheduler;
