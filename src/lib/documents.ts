import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { generatePixBRCode } from './pix';
import { fmt, fmtDate } from './format';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface PixSettings {
  pixKey: string;
  pixKeyType?: string;
  beneficiaryName: string;
  beneficiaryCity: string;
  beneficiaryDocument?: string;
  receiptStampUrl?: string;
}

export interface ChargeData {
  id: string;
  clientName: string;
  description: string;
  amount: number;
  dueDate: string;
}

import { Receivable } from './types';

async function pixDataUrl(brcode: string): Promise<string> {
  return QRCode.toDataURL(brcode, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
}

// ---------- Charge (boleto PIX) ----------

async function renderChargeOnDoc(doc: jsPDF, charge: ChargeData, pix: PixSettings) {
  const brcode = generatePixBRCode({
    pixKey: pix.pixKey,
    amount: charge.amount,
    beneficiaryName: pix.beneficiaryName,
    beneficiaryCity: pix.beneficiaryCity,
    txid: charge.id.replace(/-/g, '').substring(0, 25),
    description: charge.description,
  });
  const qr = await pixDataUrl(brcode);

  const w = doc.internal.pageSize.getWidth();
  let y = 50;

  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(15, 23, 42);
  doc.text('CobranÃ§a PIX', w / 2, y, { align: 'center' });
  y += 30;

  doc.setLineWidth(0.5).setDrawColor(200);
  doc.line(40, y, w - 40, y);
  y += 25;

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42);
  doc.text('BeneficiÃ¡rio', 40, y); y += 16;
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.text(pix.beneficiaryName, 40, y); y += 14;
  if (pix.beneficiaryDocument) { doc.text(`Doc: ${pix.beneficiaryDocument}`, 40, y); y += 14; }
  doc.text(pix.beneficiaryCity, 40, y); y += 24;

  doc.setFont('helvetica', 'bold');
  doc.text('Pagador', 40, y); y += 16;
  doc.setFont('helvetica', 'normal');
  doc.text(charge.clientName, 40, y); y += 24;

  doc.setFont('helvetica', 'bold');
  doc.text('DescriÃ§Ã£o', 40, y); y += 16;
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(charge.description, w - 80);
  doc.text(descLines, 40, y); y += descLines.length * 14 + 10;

  doc.setFillColor(245, 248, 250);
  doc.rect(40, y, w - 80, 60, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text('Valor', 55, y + 22);
  doc.text('Vencimento', 55, y + 44);
  doc.setFont('helvetica', 'normal').setFontSize(14);
  doc.text(fmt(charge.amount), w - 55, y + 22, { align: 'right' });
  doc.setFontSize(12);
  doc.text(fmtDate(charge.dueDate), w - 55, y + 44, { align: 'right' });
  y += 80;

  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Pague com PIX â€“ escaneie o QR Code', w / 2, y, { align: 'center' });
  y += 12;
  doc.addImage(qr, 'PNG', (w - 180) / 2, y, 180, 180);
  y += 195;

  doc.setFont('helvetica', 'bold').setFontSize(10);
  doc.text('PIX Copia e Cola:', 40, y); y += 12;
  doc.setFont('courier', 'normal').setFontSize(8);
  const codeLines = doc.splitTextToSize(brcode, w - 80);
  doc.text(codeLines, 40, y); y += codeLines.length * 9 + 16;

  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(120);
  doc.text('Documento gerado automaticamente. Confira os dados antes de efetuar o pagamento.', w / 2, y, { align: 'center' });
}

export async function generateChargePDF(charge: ChargeData, pix: PixSettings): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  await renderChargeOnDoc(doc, charge, pix);
  return doc.output('blob');
}

export async function generateChargesPDF(charges: ChargeData[], pix: PixSettings): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  for (let i = 0; i < charges.length; i++) {
    if (i > 0) doc.addPage();
    await renderChargeOnDoc(doc, charges[i], pix);
  }
  return doc.output('blob');
}

export async function generateChargePNG(charge: ChargeData, pix: PixSettings): Promise<Blob> {
  const brcode = generatePixBRCode({
    pixKey: pix.pixKey,
    amount: charge.amount,
    beneficiaryName: pix.beneficiaryName,
    beneficiaryCity: pix.beneficiaryCity,
    txid: charge.id.replace(/-/g, '').substring(0, 25),
    description: charge.description,
  });
  const qr = await pixDataUrl(brcode);
  return renderCardPNG({
    title: 'CobranÃ§a PIX',
    accent: '#0ea5e9',
    rows: [
      ['BeneficiÃ¡rio', pix.beneficiaryName],
      ['Pagador', charge.clientName],
      ['DescriÃ§Ã£o', charge.description],
      ['Vencimento', fmtDate(charge.dueDate)],
    ],
    amount: charge.amount,
    qr,
    footer: 'Escaneie o QR Code com o app do seu banco',
    copyText: brcode,
  });
}

// ---------- Receipt ----------

export interface ReceiptData {
  id: string;
  clientName: string;
  description: string;
  amount: number;
  receivedDate: string;
  accountName: string;
}

export async function generateReceiptPDF(receipt: ReceiptData, pix: PixSettings | null): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 60;

  doc.setFont('helvetica', 'bold').setFontSize(22);
  doc.text('RECIBO', w / 2, y, { align: 'center' });
  y += 18;
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.text(`NÂº ${receipt.id.substring(0, 8).toUpperCase()}`, w / 2, y, { align: 'center' });
  y += 30;
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(fmt(receipt.amount), w / 2, y, { align: 'center' });
  y += 30;

  doc.setLineWidth(0.5).line(40, y, w - 40, y);
  y += 24;

  doc.setFont('helvetica', 'normal').setFontSize(11);
  const beneficiary = pix?.beneficiaryName || 'BeneficiÃ¡rio';
  const intro = `Recebemos de ${receipt.clientName} a importÃ¢ncia de ${fmt(receipt.amount)} (${valorPorExtenso(receipt.amount)}), referente a "${receipt.description}", creditado em ${receipt.accountName} na data de ${fmtDate(receipt.receivedDate)}.`;
  const introLines = doc.splitTextToSize(intro, w - 80);
  doc.text(introLines, 40, y); y += introLines.length * 16 + 30;

  doc.text('Para clareza, firmo o presente recibo.', 40, y); y += 50;

  // Carimbo / assinatura (se configurado)
  if (pix?.receiptStampUrl) {
    try {
      const stampData = await loadImageAsDataUrl(pix.receiptStampUrl);
      const stampW = 140;
      const stampH = 70;
      doc.addImage(stampData, 'PNG', (w - stampW) / 2, y - 20, stampW, stampH);
      y += stampH - 10;
    } catch (e) {
      console.warn('NÃ£o foi possÃ­vel carregar o carimbo:', e);
    }
  }

  // Linha de assinatura
  doc.line(w / 2 - 120, y, w / 2 + 120, y);
  y += 14;
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(beneficiary, w / 2, y, { align: 'center' });
  if (pix?.beneficiaryDocument) {
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(pix.beneficiaryDocument, w / 2, y, { align: 'center' });
  }

  return doc.output('blob');
}

export async function generateReceiptPNG(receipt: ReceiptData, pix: PixSettings | null): Promise<Blob> {
  return renderCardPNG({
    title: 'Recibo',
    accent: '#10b981',
    rows: [
      ['Pagador', receipt.clientName],
      ['BeneficiÃ¡rio', pix?.beneficiaryName || 'â€”'],
      ['DescriÃ§Ã£o', receipt.description],
      ['Conta de crÃ©dito', receipt.accountName],
      ['Data', fmtDate(receipt.receivedDate)],
      ['NÂº', receipt.id.substring(0, 8).toUpperCase()],
    ],
    amount: receipt.amount,
    footer: 'Pagamento confirmado',
    stampUrl: pix?.receiptStampUrl,
  });
}

// Carrega imagem externa e converte para data URL (necessÃ¡rio para incluir no PDF)
async function loadImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:image')) return url;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: `stamp_cache_${url}` });
      if (value) return value;
    } catch {}
  }

  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---------- PNG renderer (canvas) ----------

interface CardOptions {
  title: string;
  accent: string;
  rows: [string, string][];
  amount: number;
  qr?: string;
  footer?: string;
  copyText?: string;
  stampUrl?: string;
}

async function renderCardPNG(opts: CardOptions): Promise<Blob> {
  const W = 720;
  const padding = 40;
  const rowHeight = 56;
  const headerH = 110;
  const amountH = 90;
  const qrH = opts.qr ? 280 : 0;
  const copyH = opts.copyText ? 80 : 0;
  const stampH = opts.stampUrl ? 110 : 0;
  const footerH = 50;
  const rowsH = opts.rows.length * rowHeight;
  const H = headerH + amountH + rowsH + qrH + copyH + stampH + footerH + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = opts.accent;
  ctx.fillRect(0, 0, W, 8);

  let y = padding + 20;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(opts.title, W / 2, y);
  y += 40;

  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillStyle = opts.accent;
  ctx.fillText(fmt(opts.amount), W / 2, y);
  y += 50;

  // Rows
  ctx.textAlign = 'left';
  for (const [label, value] of opts.rows) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), padding, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = '18px Arial, sans-serif';
    const valueLines = wrapText(ctx, value, W - padding * 2);
    ctx.fillText(valueLines[0] || '', padding, y + 24);
    y += rowHeight;
  }

  // QR
  if (opts.qr) {
    const qrSize = 240;
    const img = await loadImage(opts.qr);
    ctx.drawImage(img, (W - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 20;
  }

  // Copy text
  if (opts.copyText) {
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, opts.copyText, W - padding * 2);
    for (const line of lines.slice(0, 4)) {
      ctx.fillText(line, W / 2, y);
      y += 16;
    }
    y += 10;
  }

  // Carimbo / assinatura
  if (opts.stampUrl) {
    try {
      const img = await loadImage(opts.stampUrl);
      const maxW = 200, maxH = 90;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      ctx.drawImage(img, (W - drawW) / 2, y, drawW, drawH);
      y += maxH + 10;
    } catch {/* ignore */}
  }

  // Footer
  if (opts.footer) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.footer, W / 2, H - padding);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  let finalSrc = src;
  
  if (Capacitor.isNativePlatform() && src.startsWith('http')) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: `stamp_cache_${src}` });
      if (value) finalSrc = value;
    } catch {}
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    // habilita CORS para imagens externas (carimbo armazenado no Supabase Storage)
    if (finalSrc.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = finalSrc;
  });
}

// ---------- Download / share helpers ----------

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareBlob(blob: Blob, filename: string, title: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });

      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        url: writeResult.uri,
        dialogTitle: 'Compartilhar',
      });
      return true;
    } catch (e) {
      console.error('Erro ao compartilhar nativo:', e);
      return false;
    }
  }

  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Simple Brazilian Portuguese number-to-words for currency
function valorPorExtenso(n: number): string {
  const reais = Math.floor(n);
  const centavos = Math.round((n - reais) * 100);
  const reaisExt = numero(reais);
  let result = `${reaisExt} ${reais === 1 ? 'real' : 'reais'}`;
  if (centavos > 0) result += ` e ${numero(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return result;
}

function numero(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0) return 'menos ' + numero(-n);
  const u = ['', 'um', 'dois', 'trÃªs', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const e10 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  if (n === 100) return 'cem';
  if (n < 10) return u[n];
  if (n < 20) return e10[n - 10];
  if (n < 100) {
    const dz = Math.floor(n / 10), un = n % 10;
    return un ? `${d[dz]} e ${u[un]}` : d[dz];
  }
  if (n < 1000) {
    const ce = Math.floor(n / 100), rest = n % 100;
    return rest ? `${c[ce]} e ${numero(rest)}` : c[ce];
  }
  if (n < 1_000_000) {
    const mil = Math.floor(n / 1000), rest = n % 1000;
    const milPart = mil === 1 ? 'mil' : `${numero(mil)} mil`;
    if (rest === 0) return milPart;
    return rest < 100 ? `${milPart} e ${numero(rest)}` : `${milPart}, ${numero(rest)}`;
  }
  return n.toString();
}
// ---------- Receivables Report ----------
export async function generateReceivablesReportPDF(receivables: Receivable[], pix: PixSettings | null): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 50;

  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(15, 23, 42);
  doc.text('Relatório de Contas a Receber', w / 2, y, { align: 'center' });
  y += 30;

  if (receivables.length > 0 && receivables[0].clientName) {
    const clients = Array.from(new Set(receivables.map(r => r.clientName)));
    doc.setFont('helvetica', 'normal').setFontSize(12);
    doc.text(`Cliente(s): ${clients.join(', ')}`, 40, y);
    y += 20;
  }

  doc.setLineWidth(0.5).setDrawColor(200);
  doc.line(40, y, w - 40, y);
  y += 25;

  // Table Header
  doc.setFont('helvetica', 'bold').setFontSize(10);
  doc.text('Vencimento', 40, y);
  doc.text('Descrição', 120, y);
  doc.text('Status', w - 150, y);
  doc.text('Valor', w - 40, y, { align: 'right' });
  y += 15;
  doc.line(40, y, w - 40, y);
  y += 20;

  doc.setFont('helvetica', 'normal').setFontSize(10);
  let total = 0;

  for (const r of receivables) {
    total += r.amount;
    const statusTxt = r.status === 'received' ? 'Recebido' : r.status === 'overdue' ? 'Vencida' : 'Pendente';
    doc.text(fmtDate(r.dueDate), 40, y);
    const descLines = doc.splitTextToSize(r.description, w - 300);
    doc.text(descLines, 120, y);
    doc.text(statusTxt, w - 150, y);
    doc.text(fmt(r.amount), w - 40, y, { align: 'right' });
    y += descLines.length * 12 + 8;

    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 50;
    }
  }

  doc.line(40, y, w - 40, y);
  y += 25;
  
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text('Total:', w - 150, y);
  doc.text(fmt(total), w - 40, y, { align: 'right' });
  y += 40;

  const beneficiary = pix?.beneficiaryName || 'Beneficiário';
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(`Relatório gerado em ${fmtDate(new Date().toISOString())} por ${beneficiary}`, w / 2, y, { align: 'center' });

  return doc.output('blob');
}

export async function generateReceivablesReportPNG(receivables: Receivable[], pix: PixSettings | null): Promise<Blob> {
  const total = receivables.reduce((sum, r) => sum + r.amount, 0);
  const rows = receivables.map(r => [
    fmtDate(r.dueDate) + ' - ' + (r.status === 'received' ? '(Pago)' : r.status === 'overdue' ? '(Atraso)' : '(Pendente)'),
    r.description + ' - ' + fmt(r.amount)
  ] as [string, string]);
  
  return renderCardPNG({
    title: 'Relatório de Contas',
    accent: '#3b82f6',
    rows: rows,
    amount: total,
    footer: `Gerado em ${fmtDate(new Date().toISOString())} por ${pix?.beneficiaryName || 'Beneficiário'}`,
  });
}

