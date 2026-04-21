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
      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Cloud className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sincronizado</span>
      </div>
    );
  }

  return null;
}