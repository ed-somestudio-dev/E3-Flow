import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { updateGlobalOnlineStatus } from '@/lib/online-guard';

/**
 * Acompanha o estado da conexão de rede de forma confiável em ambientes Nativos (Capacitor) e Web.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let mounted = true;

    if (Capacitor.isNativePlatform()) {
      // 1. Obtém status atual nativo
      Network.getStatus().then(status => {
        if (mounted) {
          setOnline(status.connected);
          updateGlobalOnlineStatus(status.connected);
        }
      });

      // 2. Registra listener nativo
      const listenerPromise = Network.addListener('networkStatusChange', status => {
        if (mounted) {
          setOnline(status.connected);
          updateGlobalOnlineStatus(status.connected);
        }
      });

      return () => {
        mounted = false;
        listenerPromise.then(l => l.remove()).catch(console.warn);
      };
    } else {
      // Fallback para Web padrão
      const handleOnline = () => {
        setOnline(true);
        updateGlobalOnlineStatus(true);
      };
      
      const handleOffline = () => {
        setOnline(false);
        updateGlobalOnlineStatus(false);
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        mounted = false;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return online;
}