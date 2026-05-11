import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra o Service Worker para garantir PWA instalável + cache offline de assets.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('[pwa] service worker registrado com sucesso');
    }).catch((err) => {
      console.warn('[pwa] falha ao registrar service worker:', err);
    });
  });
}
