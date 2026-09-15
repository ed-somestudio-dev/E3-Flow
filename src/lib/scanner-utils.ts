export interface ParsedPixData {
  raw: string;
  pixKey?: string;
  amount?: number;
  beneficiaryName?: string;
  description?: string;
}

export interface ParsedBoletoData {
  raw: string;
  cleanBarcode: string;
  amount?: number;
  dueDate?: string; // YYYY-MM-DD
}

/**
 * Classifica se o texto lido é uma Chave/QR Code PIX ou Código de Barras / Linha Digitável de Boleto.
 */
export function detectScannedType(text: string): 'pix' | 'barcode' | 'unknown' {
  const clean = text.trim();
  if (!clean) return 'unknown';

  const digitsOnly = clean.replace(/[\s\.\-\/\:]/g, '');

  // 1. Payload EMV PIX (000201...) ou contém domínio / keywords de PIX
  if (
    clean.startsWith('000201') ||
    clean.toLowerCase().includes('br.gov.bcb.pix') ||
    clean.toLowerCase().includes('pix.bcb.gov.br') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)
  ) {
    return 'pix';
  }

  // 2. E-mail como chave PIX
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return 'pix';
  }

  // 3. Linha Digitável de Boleto (47 ou 48 dígitos) ou Código de Barras Febraban (44 dígitos)
  if (/^\d{43,48}$/.test(digitsOnly)) {
    return 'barcode';
  }

  // 4. CPF (11 dígitos), CNPJ (14 dígitos) ou Telefone (10 ou 11 dígitos com ou sem +55) => Chave PIX
  if (/^\d{10,14}$/.test(digitsOnly)) {
    return 'pix';
  }

  // 5. URL genérica / QR Code web
  if (/^https?:\/\//i.test(clean)) {
    return 'pix';
  }

  return 'unknown';
}

/**
 * Decodifica payload EMV PIX (QR Code Copia e Cola do Banco Central)
 * Extrai a chave PIX, valor da transação e recebedor se disponíveis.
 */
export function parsePixEMV(payload: string): ParsedPixData {
  const clean = payload.trim();
  const result: ParsedPixData = { raw: clean };

  if (!clean.startsWith('000201')) {
    result.pixKey = clean;
    return result;
  }

  // Leitor de tags EMV TLV (Tag-Length-Value)
  let pos = 0;
  while (pos < clean.length) {
    const tag = clean.substring(pos, pos + 2);
    const lenStr = clean.substring(pos + 2, pos + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || pos + 4 + len > clean.length) break;

    const value = clean.substring(pos + 4, pos + 4 + len);
    pos += 4 + len;

    if (tag === '26') {
      // Informações da conta merchant (PIX)
      let subPos = 0;
      while (subPos < value.length) {
        const subTag = value.substring(subPos, subPos + 2);
        const subLen = parseInt(value.substring(subPos + 2, subPos + 4), 10);
        if (isNaN(subLen) || subPos + 4 + subLen > value.length) break;
        const subValue = value.substring(subPos + 4, subPos + 4 + subLen);
        subPos += 4 + subLen;

        if (subTag === '01') {
          result.pixKey = subValue;
        } else if (subTag === '02') {
          result.description = subValue;
        }
      }
    } else if (tag === '54') {
      // Valor do pagamento
      const amt = parseFloat(value);
      if (!isNaN(amt) && amt > 0) {
        result.amount = amt;
      }
    } else if (tag === '59') {
      // Nome do Recebedor
      result.beneficiaryName = value.trim();
    } else if (tag === '62') {
      // Informações adicionais
      let subPos = 0;
      while (subPos < value.length) {
        const subTag = value.substring(subPos, subPos + 2);
        const subLen = parseInt(value.substring(subPos + 2, subPos + 4), 10);
        if (isNaN(subLen) || subPos + 4 + subLen > value.length) break;
        const subValue = value.substring(subPos + 4, subPos + 4 + subLen);
        subPos += 4 + subLen;

        if (subTag === '02' && !result.description) {
          result.description = subValue;
        }
      }
    }
  }

  // Se não foi possível isolar a chave interna, utiliza a string Copia e Cola completa
  if (!result.pixKey) {
    result.pixKey = clean;
  }

  return result;
}

/**
 * Decodifica linha digitável ou código de barras de Boleto (Febraban)
 * Extrai a data de vencimento e o valor total se presentes.
 */
export function parseBoleto(text: string): ParsedBoletoData {
  const clean = text.trim();
  const digits = clean.replace(/[\s\.\-]/g, '');
  const result: ParsedBoletoData = { raw: clean, cleanBarcode: digits };

  if (digits.length === 47 || digits.length === 44) {
    let factorStr = '';
    let amountStr = '';

    if (digits.length === 47) {
      factorStr = digits.substring(33, 37);
      amountStr = digits.substring(37, 47);
    } else if (digits.length === 44) {
      factorStr = digits.substring(5, 9);
      amountStr = digits.substring(9, 19);
    }

    const factor = parseInt(factorStr, 10);
    if (!isNaN(factor) && factor > 0) {
      // Data base Febraban: 07/10/1997. Para fatores após 22/02/2025 (reset BACEN), fator 1000 = 22/02/2025.
      let baseDate = new Date(1997, 9, 7); // Oct 7 1997
      if (factor >= 1000) {
        let dueDateObj = new Date(baseDate.getTime() + factor * 86400000);
        
        // Se a data calculada ficar antes de 2025 e o fator for menor que 3000, ajusta para o novo ciclo BACEN (pós 2025)
        if (dueDateObj.getFullYear() < 2025 && factor <= 3000) {
          const resetBaseDate = new Date(2022, 4, 29); // 2022-05-29
          dueDateObj = new Date(resetBaseDate.getTime() + factor * 86400000);
        }

        const yyyy = dueDateObj.getFullYear();
        const mm = String(dueDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dueDateObj.getDate()).padStart(2, '0');
        result.dueDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    const rawAmount = parseInt(amountStr, 10);
    if (!isNaN(rawAmount) && rawAmount > 0) {
      result.amount = rawAmount / 100;
    }
  }

  return result;
}

// ── Funções Auxiliares para Converter Código Físico (44) em Linha Digitável ──

function mod10(block: string): number {
  let sum = 0;
  let multiplier = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    let prod = parseInt(block[i], 10) * multiplier;
    sum += Math.floor(prod / 10) + (prod % 10);
    multiplier = multiplier === 2 ? 1 : 2;
  }
  let rem = sum % 10;
  return rem === 0 ? 0 : 10 - rem;
}

function mod11Arrecadacao(block: string): number {
  let sum = 0;
  let multiplier = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    sum += parseInt(block[i], 10) * multiplier;
    multiplier++;
    if (multiplier > 9) multiplier = 2;
  }
  let rem = sum % 11;
  if (rem === 0 || rem === 1) return 0;
  return 11 - rem;
}

/**
 * Converte um código de barras físico (44 dígitos) para a linha digitável correspondente
 * (47 dígitos para boletos de cobrança, 48 dígitos para guias de arrecadação).
 */
export function formatBarcodeToLinhaDigitavel(barcode: string): string {
  const clean = barcode.replace(/\D/g, '');
  if (clean.length !== 44) return barcode; // Só converte se for o código físico original

  if (clean[0] === '8') {
    // Guia de Arrecadação (48 dígitos)
    const isMod10 = clean[2] === '6' || clean[2] === '7';
    let linha = '';
    for (let i = 0; i < 4; i++) {
      const block = clean.substr(i * 11, 11);
      const digit = isMod10 ? mod10(block) : mod11Arrecadacao(block);
      linha += block + digit;
    }
    return linha;
  } else {
    // Boleto de Cobrança (47 dígitos)
    const bank = clean.substr(0, 3);
    const currency = clean.substr(3, 1);
    const dv = clean.substr(4, 1);
    const factor = clean.substr(5, 4);
    const amount = clean.substr(9, 10);
    const freeField = clean.substr(19, 25);

    const block1 = bank + currency + freeField.substr(0, 5);
    const dv1 = mod10(block1);
    const field1 = block1 + dv1;

    const block2 = freeField.substr(5, 10);
    const dv2 = mod10(block2);
    const field2 = block2 + dv2;

    const block3 = freeField.substr(15, 10);
    const dv3 = mod10(block3);
    const field3 = block3 + dv3;

    return field1 + field2 + field3 + dv + factor + amount;
  }
}
