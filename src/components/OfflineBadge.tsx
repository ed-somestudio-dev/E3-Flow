import { useOnlineStatus } from '@/hooks/use-online-status';
import { CloudOff, Cloud } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Badge no header indicando status de conexão.
 * Quando offline, mostra "Offline" em destaque.
 * Quando volta online após estar offline, mostra "Sincronizado" por alguns segundos.
 */
export function OfflineBadge() {
  const online = useOnlineStatus();
  const [showSynced, setShowSynced] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowSynced(false);
    } else if (wasOffline) {
      setShowSynced(true);
      const t = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  if (!online) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-destructive/10 text-destructive">
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    );
  }

  if (showSynced) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary">
        <Cloud className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sincronizado</span>
      </div>
    );
  }

  return null;
}

/**
 * Banner full-width abaixo do header avisando que cadastros/edições estão
 * desabilitados enquanto offline. Aparece somente quando navigator.onLine === false.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="flex items-start gap-2 px-4 py-2 bg-destructive/10 text-destructive text-xs sm:text-sm border-b border-destructive/20">
      <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <strong>Modo offline.</strong> Você pode visualizar os últimos dados sincronizados, mas cadastrar, editar e excluir está desabilitado até a conexão voltar.
      </div>
    </div>
  );
}