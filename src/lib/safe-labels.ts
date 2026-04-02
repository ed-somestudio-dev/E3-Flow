const SAFE_PREPOSITION_LOWER = 'a\u2060\u00A0';
const SAFE_PREPOSITION_UPPER = 'A\u2060\u00A0';

export const SAFE_LABELS = {
  payable: `Conta ${SAFE_PREPOSITION_LOWER}Pagar`,
  payables: `Contas ${SAFE_PREPOSITION_LOWER}Pagar`,
  receivables: `Contas ${SAFE_PREPOSITION_LOWER}Receber`,
  payablesAndReceivables: `Contas ${SAFE_PREPOSITION_LOWER}Pagar/Receber`,
  shortPayable: `${SAFE_PREPOSITION_UPPER}Pagar`,
  shortReceivable: `${SAFE_PREPOSITION_UPPER}Receber`,
  lowerPayables: `contas ${SAFE_PREPOSITION_LOWER}pagar`,
  lowerReceivables: `contas ${SAFE_PREPOSITION_LOWER}receber`,
} as const;