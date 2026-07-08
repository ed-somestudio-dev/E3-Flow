import { useEffect, useRef } from 'react';

/**
 * Força refresh dos dados quando a aba do navegador volta a ficar visível
 * (corrige problema do Chrome mobile que mantém estado antigo após retornar à aba).
 *
 * Estratégia:
 *  - Detecta `visibilitychange` quando a aba volta a ficar visível.
 *  - Detecta `pageshow` com persisted=true (volta do bfcache).
 *  - Se ficou oculta por mais de `staleAfterMs`, recarrega a página (location.reload).
 *  - Caso contrário apenas chama o callback opcional para revalidação leve.
 */
export function useAutoRefresh(opts: { staleAfterMs?: number; onRevalidate?: () => void } = {}) {
  const { staleAfterMs = 60_000, onRevalidate } = opts;
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const elapsed = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        
        // Se houver algum modal aberto, NÃO dê reload nem revalide para blindar a janela de criação contra perda de dados
        if (document.querySelector('[role="dialog"]') || document.querySelector('[role="alertdialog"]')) {
          return;
        }

        if (elapsed > staleAfterMs) {
          window.location.reload();
        } else if (onRevalidate) {
          onRevalidate();
        }
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache restore — sempre recarrega para garantir dados atualizados, exceto se um modal estiver aberto
      if (e.persisted) {
        if (document.querySelector('[role="dialog"]') || document.querySelector('[role="alertdialog"]')) {
          return;
        }
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [staleAfterMs, onRevalidate]);
}
