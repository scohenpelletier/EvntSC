import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.evntsc',
  appName: 'EvntSC',
  webDir: 'public',
  "server": {
    "url": "https://evntsc.vercel.app",
    "cleartext": false
  },
  "ios": {
    "contentInset": "always",
    "backgroundColor": "#990000"
  }
};

export default config;
