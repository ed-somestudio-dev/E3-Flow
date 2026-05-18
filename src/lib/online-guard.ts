import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// Estado global para manter sincronia sem requisições assíncronas custosas a todo momento
let globalOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function updateGlobalOnlineStatus(status: boolean) {
  globalOnlineStatus = status;
}

// Inicializa o listener de forma persistente e imediata se for plataforma nativa
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  Network.getStatus().then(status => {
    globalOnlineStatus = status.connected;
  }).catch(err => console.warn('[online-guard] Erro ao obter status da rede:', err));
  
  Network.addListener('networkStatusChange', status => {
    globalOnlineStatus = status.connected;
  }).catch(err => console.warn('[online-guard] Erro ao registrar listener de rede:', err));
}

/**
 * Verifica se o dispositivo está online de forma confiável (inclusive no APK).
 * Não bloqueia a execução, apenas retorna o status validado.
 */
export function assertOnline(): boolean {
  return globalOnlineStatus;
}
