/**
 * Sugere a data de vencimento de uma nova conta (a pagar ou a receber)
 * com base no histórico de vencimentos do mesmo contato.
 *
 * Regras:
 * 1. Considera apenas vencimentos dentro da janela [hoje, hoje + maxDays].
 *    Se houver algum, usa o mais distante dentro dessa janela (mesmo ciclo).
 *    Isso evita que parcelas futuras (ex.: 12ª parcela daqui a 1 ano) sejam sugeridas.
 * 2. Caso não exista nenhum vencimento na janela, usa o dia do mês do vencimento
 *    de referência (o mais recente já passado; ou, se todos forem futuros
 *    além da janela, o mais próximo) e calcula a próxima ocorrência desse dia
 *    a partir de hoje — que sempre fica dentro de ~31 dias.
 */
export const MAX_DUE_DATE_SUGGESTION_DAYS = 45;

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function suggestDueDateFromHistory(
  dueDates: (string | null | undefined)[],
  maxDays: number = MAX_DUE_DATE_SUGGESTION_DAYS,
): string | null {
  const valid = dueDates
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d))
    .map(d => d.slice(0, 10))
    .sort();

  if (valid.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + maxDays);

  const todayStr = toISODate(today);
  const limitStr = toISODate(limit);

  // 1) Vencimento existente dentro da janela de até `maxDays` dias
  const inWindow = valid.filter(d => d >= todayStr && d <= limitStr);
  if (inWindow.length > 0) return inWindow[inWindow.length - 1];

  // 2) Próxima ocorrência do mesmo dia do mês da data de referência
  const past = valid.filter(d => d < todayStr);
  const reference = past.length > 0 ? past[past.length - 1] : valid[0];
  const referenceDay = parseInt(reference.slice(8, 10), 10);

  let year = today.getFullYear();
  let month = today.getMonth(); // 0-based
  if (referenceDay < today.getDate()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return toISODate(new Date(year, month, Math.min(referenceDay, lastDayOfMonth)));
}
