import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

import { Capacitor } from '@capacitor/core';

// Registra o Service Worker apenas se não for plataforma nativa (Capacitor cuida dos assets nativamente)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('[pwa] service worker registrado com sucesso');
    }).catch((err) => {
      console.warn('[pwa] falha ao registrar service worker:', err);
    });
  });
}
