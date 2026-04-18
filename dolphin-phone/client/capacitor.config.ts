import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dolphin.phone',
  appName: 'Dolphin Phone',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true, // Allow HTTP signaling for local testing
    allowNavigation: ['*']
  }
};

export default config;
