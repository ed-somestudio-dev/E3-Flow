import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

import { Capacitor } from '@capacitor/core';

// Registra o Service Worker apenas em produção e fora da plataforma nativa
// Em desenvolvimento (dev server), o SW causa conflitos de cache que quebram o HMR do Vite
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !Capacitor.isNativePlatform() && !isDev) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('[pwa] service worker registrado com sucesso');
    }).catch((err) => {
      console.warn('[pwa] falha ao registrar service worker:', err);
    });
  });
} else if (isDev && 'serviceWorker' in navigator) {
  // Em desenvolvimento, remove qualquer SW antigo que possa estar causando conflitos
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      reg.unregister();
      console.log('[dev] Service worker removido para evitar conflitos de cache');
    }
  });
}
