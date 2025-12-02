import { CapacitorConfig } from '@capacitor/cli';

const isProduction = process.env.NODE_ENV === 'production';

console.log(`Capacitor config: Setting androidScheme to ${isProduction ? 'https' : 'http'}`);

const config: CapacitorConfig = {
  appId: 'com.vermillion.entryexit',
  appName: 'EntryExit Mobile',
  webDir: 'dist/frontend-mobile/browser',
  server: {
    androidScheme: isProduction ? 'https' : 'http',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
