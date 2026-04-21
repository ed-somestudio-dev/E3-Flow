import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra o Service Worker apenas em produção e fora de iframes (preview do Lovable).
// Isso garante PWA instalável + cache offline de assets, sem interferir no preview.
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  window.self === window.top
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[pwa] falha ao registrar service worker:', err);
    });
  });
}
