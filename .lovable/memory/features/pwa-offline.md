---
name: PWA e Modo Offline
description: PWA instalável, cache de leitura offline em IndexedDB, indicador de status de conexão
type: feature
---
# PWA + Offline

- App é instalável como PWA (`public/manifest.webmanifest`, `public/sw.js`, ícones em `public/icon-{192,512}.png` + `apple-touch-icon.png`).
- SW é registrado em `src/main.tsx` SOMENTE em produção e fora de iframes (evita poluir preview do Lovable).
- SW faz network-first para HTML e cache-first para assets estáticos. NUNCA cacheia chamadas a Supabase (origem diferente) nem `/auth` ou `/~oauth`.
- Snapshot de leitura offline: `src/lib/offline-store.ts` (IndexedDB via `idb`). `finance-context` salva snapshot a cada `fetchAll` bem-sucedido e restaura automaticamente quando offline.
- Hook `useOnlineStatus` + componente `OfflineBadge` no header mostram status; ao voltar online, `fetchAll` é re-disparado.
- Importante: cadastros offline ainda NÃO são suportados (mutações tocam saldo + faturas + RPC encadeados — exigiria refatoração maior). Hoje o offline é leitura confiável + indicador claro de conexão.
