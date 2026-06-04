import { Receivable } from './types';

export interface OFXTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'OTHER';
  amount: number;
  date: string; // YYYY-MM-DD
  memo: string;
}

export interface MatchCandidate {
  receivable: Receivable;
  score: number;
  reasons: string[];
}

export function parseOFX(text: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Clean carriage returns and split by statement transaction block
  const cleanText = text.replace(/\r/g, '');
  const parts = cleanText.split(/<STMTTRN>/i);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].split(/<\/STMTTRN>/i)[0];
    
    const getTagValue = (tag: string): string => {
      const regex = new RegExp(`<${tag}>([^<\\n]*)`, 'i');
      const match = part.match(regex);
      return match ? match[1].trim() : '';
    };
    
    const trntype = getTagValue('TRNTYPE');
    const trnamtStr = getTagValue('TRNAMT');
    const dtposted = getTagValue('DTPOSTED');
    const fitid = getTagValue('FITID');
    const memo = getTagValue('MEMO');
    
    if (!trnamtStr || !dtposted) continue;
    
    // Replace comma with dot for decimal parsing if necessary
    const amount = parseFloat(trnamtStr.replace(',', '.'));
    
    // Parse date (typically YYYYMMDD...)
    const dateMatch = dtposted.match(/^(\d{4})(\d{2})(\d{2})/);
    let date = '';
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    } else {
      date = new Date().toISOString().split('T')[0];
    }
    
    transactions.push({
      id: fitid || `ofx-tx-${Math.random().toString(36).substring(7)}`,
      type: trntype === 'CREDIT' ? 'CREDIT' : trntype === 'DEBIT' ? 'DEBIT' : 'OTHER',
      amount: Math.abs(amount),
      date,
      memo: memo || 'Sem descrição'
    });
  }
  
  return transactions;
}

const normalize = (str: string): string => 
  str.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .replace(/[^a-z0-9 ]/g, "")
     .trim();

export function getMatchCandidates(
  ofxTx: OFXTransaction,
  receivables: Receivable[]
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const normMemo = normalize(ofxTx.memo);

  // Filter only pending or overdue receivables
  const pending = receivables.filter(r => r.status === 'pending' || r.status === 'overdue');

  for (const r of pending) {
    let score = 0;
    const reasons: string[] = [];

    // 1) Amount Match (crucial for bank reconciliation)
    const amountDiff = Math.abs(r.amount - ofxTx.amount);
    if (amountDiff < 0.009) {
      score += 100;
      reasons.push('Valor idêntico');
    } else {
      // Skip if amount doesn't match at all (typical reconciliation requires exact match)
      continue;
    }

    // 2) Date proximity
    const txDate = new Date(ofxTx.date + 'T12:00:00');
    const dueDate = new Date(r.dueDate + 'T12:00:00');
    const diffTime = Math.abs(txDate.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      score += 40;
      reasons.push('Mesma data de vencimento');
    } else if (diffDays <= 3) {
      score += 30;
      reasons.push(`Vencimento próximo (${diffDays} dias)`);
    } else if (diffDays <= 7) {
      score += 20;
      reasons.push(`Vencimento próximo (${diffDays} dias)`);
    } else if (diffDays <= 15) {
      score += 10;
      reasons.push('Mesma quinzena');
    } else if (diffDays <= 30) {
      score += 5;
      reasons.push('Vencimento no mesmo mês (30 dias)');
    }

    // 3) Client name overlap
    if (r.clientName) {
      const normClient = normalize(r.clientName);
      if (normClient.length > 2 && normMemo.includes(normClient)) {
        score += 50;
        reasons.push('Nome do cliente idêntico no extrato');
      } else {
        // Word matches (excluding common short prepositions)
        const clientWords = normClient.split(' ').filter(w => w.length > 3);
        let wordMatches = 0;
        for (const w of clientWords) {
          if (normMemo.includes(w)) {
            score += 15;
            wordMatches++;
          }
        }
        if (wordMatches > 0) {
          reasons.push(`${wordMatches} termo(s) do nome do cliente no extrato`);
        }
      }
    }

    // 4) Description overlap
    if (r.description) {
      const normDesc = normalize(r.description);
      if (normDesc.length > 2 && normMemo.includes(normDesc)) {
        score += 30;
        reasons.push('Descrição compatível no extrato');
      }
    }

    if (score > 0) {
      candidates.push({ receivable: r, score, reasons });
    }
  }

  // Sort candidates by score descending
  return candidates.sort((a, b) => b.score - a.score);
}
