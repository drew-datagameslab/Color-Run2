import type { CapacitorConfig } from '@capacitor/cli';

// Building the Android/iOS apps: the app runs from files on the phone, so it needs the
// address of the Color Run server (server.ts). Deploy in AI Studio, then build with
//   VITE_API_BASE_URL=https://<your-app>.run.app npm run cap:build
// (or put VITE_API_BASE_URL in a local .env file). Without it the phone apps keep
// coins on the device only. The web app in AI Studio does not need it.
const config: CapacitorConfig = {
  appId: 'com.datagameslab.colorrun',
  appName: 'Color_Run',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
