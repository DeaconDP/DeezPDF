import { registerSW } from 'virtual:pwa-register';
import { logger } from './logger';

export function setupPWA(): void {
  registerSW({
    onNeedRefresh() {
      logger.info('New version available');
    },
    onOfflineReady() {
      logger.info('App ready for offline use');
    },
  });
}
