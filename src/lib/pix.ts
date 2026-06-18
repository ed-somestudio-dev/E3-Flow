// PIX BR Code (EMV) generator – padrão Banco Central do Brasil
// Gera o "copia e cola" usado em QR Codes PIX estáticos.

function pad2(n: number) { return n.toString().padStart(2, '0'); }

function tlv(id: string, value: string): string {
  return `${id}${pad2(value.length)}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitize(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 .,@\-_/+]/g, '')
    .substring(0, max)
    .trim();
}

export interface PixPayload {
  pixKey: string;
  pixKeyType?: string;
  amount: number;
  beneficiaryName: string;
  beneficiaryCity: string;
  txid?: string;
  description?: string;
}

export function generatePixBRCode({
  pixKey, pixKeyType, amount, beneficiaryName, beneficiaryCity, txid, description,
}: PixPayload): string {
  let formattedPixKey = pixKey;
  if (pixKeyType === 'phone' || (pixKey.match(/^\d{10,11}$/) && !pixKeyType)) {
    formattedPixKey = formattedPixKey.replace(/[^\d+]/g, '');
    if (!formattedPixKey.startsWith('+')) {
      if (formattedPixKey.length === 10 || formattedPixKey.length === 11) {
        formattedPixKey = `+55${formattedPixKey}`;
      } else if (!formattedPixKey.startsWith('55') && formattedPixKey.length > 0) {
        formattedPixKey = `+${formattedPixKey}`;
      } else if (formattedPixKey.startsWith('55')) {
        formattedPixKey = `+${formattedPixKey}`;
      }
    }
  }

  // EMV TLV usa length de 2 dígitos (00–99). O merchantAccount inteiro precisa caber em 99 chars,
  // senão o pad2 estoura e o QR Code vira "parâmetros inválidos" no app do banco.
  const safePixKey = sanitize(formattedPixKey, 77); // 99 - 4 (tag+len GUI) - 14 ("br.gov.bcb.pix") - 4 (tag+len key) = 77 max
  const baseMerchant = tlv('00', 'br.gov.bcb.pix') + tlv('01', safePixKey);
  const remainingForDesc = 99 - baseMerchant.length - 4; // 4 = tag '02' + length de 2 dígitos
  const safeDesc = description && remainingForDesc > 0
    ? sanitize(description, Math.min(72, remainingForDesc))
    : '';
  const merchantAccount = baseMerchant + (safeDesc ? tlv('02', safeDesc) : '');

  const safeTxid = sanitize(txid || '***', 25) || '***';
  const additionalData = tlv('05', safeTxid);

  const payloadWithoutCrc =
    tlv('00', '01') +                          // Payload format indicator
    tlv('26', merchantAccount) +               // Merchant account info (PIX)
    tlv('52', '0000') +                        // Merchant category code
    tlv('53', '986') +                         // Currency – BRL
    tlv('54', amount.toFixed(2)) +             // Amount
    tlv('58', 'BR') +                          // Country
    tlv('59', sanitize(beneficiaryName, 25)) + // Beneficiary name
    tlv('60', sanitize(beneficiaryCity, 15)) + // City
    tlv('62', additionalData) +                // Additional data (txid)
    '6304';                                    // CRC field marker

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}
