import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.somestudio.e3flow',
  appName: 'E3 Flow',
  webDir: 'dist',
  android: {
    // Permite que getUserMedia() funcione na WebView do Android
    allowMixedContent: true,
  },
  server: {
    // Garante que a WebView seja tratada como contexto seguro para Media APIs
    androidScheme: 'https',
  },
};

export default config;
