import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.daymark.focus',
  appName: '昼刻',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#f5f6f8',
  android: {
    backgroundColor: '#f5f6f8',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#f5f6f8',
    contentInset: 'automatic',
  },
};

export default config;
