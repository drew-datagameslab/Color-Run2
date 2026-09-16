import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.datagameslab.colorrun',
  appName: 'Color_Run',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
