import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from './platform';
import { logger } from './logger';

export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#060810' });
    await SplashScreen.hide();
    logger.info('Native shell initialized');
  } catch (err) {
    logger.logError('Native shell init failed', err);
  }
}
