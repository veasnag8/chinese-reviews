import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chinesereview.app',
  appName: 'Chinese Review',
  webDir: 'public',
  server: {
    url: 'https://chinese-reviews.vercel.app',
    cleartext: false,
  },
};

export default config;
