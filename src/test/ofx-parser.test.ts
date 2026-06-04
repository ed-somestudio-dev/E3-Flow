import { describe, it, expect } from 'vitest';
import { parseOFX, getMatchCandidates } from '../lib/ofx-parser';
import { Receivable } from '../lib/types';

const mockOfxText = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <BANKTRANLIST>
      <DTSTART>20260601000000[-3:BRT]</DTSTART>
      <DTEND>20260630235959[-3:BRT]</DTEND>
      <STMTTRN>
        <TRNTYPE>CREDIT</TRNTYPE>
        <DTPOSTED>20260604120000[-3:BRT]</DTPOSTED>
        <TRNAMT>150.00</TRNAMT>
        <FITID>tx123456</FITID>
        <CHECKNUM>000001</CHECKNUM>
        <MEMO>PIX RECEBIDO JOAO DA SILVA</MEMO>
      </STMTTRN>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20260605120000[-3:BRT]</DTPOSTED>
        <TRNAMT>-50.00</TRNAMT>
        <FITID>tx789012</FITID>
        <CHECKNUM>000002</CHECKNUM>
        <MEMO>PAGAMENTO SUPERMERCADO</MEMO>
      </STMTTRN>
    </BANKTRANLIST>
  </BANKMSGSRSV1>
</OFX>
`;

describe('OFX Parser & Matcher', () => {
  it('should parse credit and debit transactions correctly', () => {
    const transactions = parseOFX(mockOfxText);
    
    expect(transactions).toHaveLength(2);
    
    const credit = transactions.find(t => t.id === 'tx123456');
    expect(credit).toBeDefined();
    expect(credit?.type).toBe('CREDIT');
    expect(credit?.amount).toBe(150.00);
    expect(credit?.date).toBe('2026-06-04');
    expect(credit?.memo).toBe('PIX RECEBIDO JOAO DA SILVA');
    
    const debit = transactions.find(t => t.id === 'tx789012');
    expect(debit).toBeDefined();
    expect(debit?.type).toBe('DEBIT');
    expect(debit?.amount).toBe(50.00); // stores positive absolute amount
    expect(debit?.date).toBe('2026-06-05');
  });

  it('should rank match candidates by score', () => {
    const parsed = parseOFX(mockOfxText);
    const creditTx = parsed.find(t => t.type === 'CREDIT')!;
    
    const receivables: Receivable[] = [
      {
        id: 'rec1',
        clientName: 'João da Silva',
        description: 'Venda de serviços',
        categoryId: 'cat1',
        amount: 150.00,
        dueDate: '2026-06-04',
        status: 'pending'
      },
      {
        id: 'rec2',
        clientName: 'Maria Antônia',
        description: 'Venda de produtos',
        categoryId: 'cat1',
        amount: 150.00,
        dueDate: '2026-06-15',
        status: 'pending'
      },
      {
        id: 'rec3',
        clientName: 'João da Silva',
        description: 'Outro recebível',
        categoryId: 'cat1',
        amount: 300.00, // different amount, should not match
        dueDate: '2026-06-04',
        status: 'pending'
      }
    ];
    
    const candidates = getMatchCandidates(creditTx, receivables);
    
    // rec1 should be the top match candidate (exact amount + exact date + client name match)
    expect(candidates).toHaveLength(2); // rec1 and rec2 (rec3 has different amount and is excluded)
    
    const first = candidates[0];
    expect(first.receivable.id).toBe('rec1');
    expect(first.score).toBeGreaterThan(100);
    expect(first.reasons).toContain('Valor idêntico');
    expect(first.reasons).toContain('Mesma data de vencimento');
    expect(first.reasons).toContain('Nome do cliente idêntico no extrato');
    
    const second = candidates[1];
    expect(second.receivable.id).toBe('rec2');
    expect(second.reasons).toContain('Valor idêntico');
    expect(second.reasons).not.toContain('Nome do cliente idêntico no extrato');
  });
});
