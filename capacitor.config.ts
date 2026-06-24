import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.deac.deezpdf',
  appName: 'DeezPDF Reader',
  webDir: 'dist',
  ios: {
    scheme: 'DeezPDF',
    contentInset: 'automatic',
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#080b10',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080b10',
    },
  },
};

export default config;
