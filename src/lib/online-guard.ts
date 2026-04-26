import { toast } from 'sonner';

/**
 * Verifica se o navegador está online antes de executar uma mutação.
 * Mostra um toast amigável e retorna `false` quando offline.
 *
 * Uso:
 *   if (!assertOnline()) return;
 *   await supabase.from(...).insert(...);
 */
export function assertOnline(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    toast.error('Você está offline', {
      description: 'Conecte-se à internet para cadastrar, editar ou excluir.',
    });
    return false;
  }
  return true;
}
