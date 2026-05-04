import { toast } from 'sonner';

/**
 * Verifica se o navegador está online.
 * Não bloqueia mais a execução, apenas retorna o status.
 */
export function assertOnline(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return true;
}
