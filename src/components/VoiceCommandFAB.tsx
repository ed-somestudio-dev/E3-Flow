import React, { useState, useRef } from 'react';
import { Mic, Loader2, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useFinance } from '@/lib/finance-context';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type CommandType = 'payable' | 'receivable' | 'expense' | 'income';

export function VoiceCommandFAB() {
  const [isListening, setIsListening] = useState(false);
  const [parsedData, setParsedData] = useState<{ 
    type: CommandType, 
    amount: number, 
    description: string, 
    date: string,
    categoryId: string,
    accountId: string,
    contact: string 
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isContactFocused, setIsContactFocused] = useState(false);
  const [isListeningContact, setIsListeningContact] = useState(false);
  const recognitionRef = useRef<any>(null);
  const contactRecognitionRef = useRef<any>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const startedAtRef = useRef(0);
  const { data, addPayable, addReceivable, addTransaction } = useFinance();

  const startListeningContact = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListeningContact(true);
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (parsedData) {
        setParsedData({ ...parsedData, contact: text });
      }
    };

    recognition.onerror = () => setIsListeningContact(false);
    recognition.onend = () => setIsListeningContact(false);

    contactRecognitionRef.current = recognition;
    recognition.start();
  };

  const resetStopTimeout = () => {
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (!isHoldingRef.current) {
      stopTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, 3000);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Reconhecimento de voz não suportado neste navegador. Tente pelo Google Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    
    finalTranscriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Estou ouvindo... Fale sua transação.', {
        position: 'top-center'
      });
      resetStopTimeout();
    };

    recognition.onresult = (event: any) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript + ' ';
        }
      }
      if (chunk) {
        finalTranscriptRef.current += chunk;
      }
      resetStopTimeout();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (event.error !== 'aborted') {
        toast.error('Não consegui ouvir. Tente novamente.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (finalTranscriptRef.current.trim()) {
        processTranscript(finalTranscriptRef.current.trim());
      } else {
        toast.error('Nenhuma voz detectada.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isHoldingRef.current = true;
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    if (!isListening) {
      startedAtRef.current = Date.now();
      startListening();
    }
  };

  const handlePointerUp = () => {
    isHoldingRef.current = false;
    if (isListening) {
      resetStopTimeout();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isListening && Date.now() - startedAtRef.current > 500) {
      recognitionRef.current?.stop();
    }
  };

  const processTranscript = (text: string) => {
    const lower = text.toLowerCase();
    
    // 1. Tipo
    const isReceivableFuture = lower.includes('receber') || lower.includes('receita');
    const isReceivableNow = lower.includes('recebi') || lower.includes('ganhei');
    const isPayableNow = lower.includes('paguei') || lower.includes('gastei') || lower.includes('comprei');
    
    let type: CommandType = 'payable';
    if (isReceivableNow) type = 'income';
    else if (isReceivableFuture) type = 'receivable';
    else if (isPayableNow) type = 'expense';

    let remainingText = lower;

    // 2. Data (Extrair e remover primeiro para não confundir com valor)
    let date = new Date().toISOString().split('T')[0];
    const d = new Date();
    
    if (remainingText.includes('amanhã') && !remainingText.includes('depois de amanhã')) {
      d.setDate(d.getDate() + 1);
      date = d.toISOString().split('T')[0];
      remainingText = remainingText.replace('amanhã', '');
    } else if (remainingText.includes('depois de amanhã')) {
      d.setDate(d.getDate() + 2);
      date = d.toISOString().split('T')[0];
      remainingText = remainingText.replace('depois de amanhã', '');
    } else {
      // Regex rigoroso para Data: 
      // 1: "dia 15"
      // 2: "15 de setembro" ou "15 setembro"
      // 5: "15/09/2026"
      const dateRegex = /(?:dia\s+(\d{1,2}))|(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?|(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
      const dateMatch = remainingText.match(dateRegex);
      
      if (dateMatch) {
        const fullMatch = dateMatch[0];
        const day = parseInt(dateMatch[1] || dateMatch[2] || dateMatch[5], 10);
        const monthStr = dateMatch[3];
        const monthNumStr = dateMatch[6];
        const yearStr = dateMatch[4] || dateMatch[7];
        
        let month = d.getMonth();
        let year = d.getFullYear();
        
        if (monthStr) {
           const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
           const m = monthStr === 'marco' ? 'março' : monthStr;
           const idx = months.findIndex(x => x === m);
           if (idx !== -1) month = idx;
        } else if (monthNumStr) {
           month = parseInt(monthNumStr, 10) - 1;
        } else {
           // Só o dia ("dia 15")
           if (day < d.getDate() - 3) {
             month += 1; // Se o dia já passou há mais de 3 dias, joga pro mês que vem
           }
        }
        
        if (yearStr) {
           let y = parseInt(yearStr, 10);
           if (y < 100) y += 2000;
           year = y;
        }
        
        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
          // Remove a data do texto para não confundir com dinheiro!
          remainingText = remainingText.replace(fullMatch, ' ');
        }
      }
    }

    // 3. Valor (Extrair do texto que sobrou)
    let amount = 0;
    // Tenta achar com identificador explícito primeiro (ex: "R$ 50", "50 reais")
    const explicitCurrencyMatch = remainingText.match(/(?:r\$|reais|R\$)\s*(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?|(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?\s*(?:reais|r\$|conto|contos)/);
    
    if (explicitCurrencyMatch) {
       const reais = parseInt(explicitCurrencyMatch[1] || explicitCurrencyMatch[3], 10);
       const centavosMatch = explicitCurrencyMatch[2] || explicitCurrencyMatch[4];
       const centavos = centavosMatch ? parseInt(centavosMatch.padEnd(2, '0'), 10) : 0;
       amount = reais + (centavos / 100);
       remainingText = remainingText.replace(explicitCurrencyMatch[0], ' ');
    } else {
       // Se não tem "reais", pega o primeiro número que sobrou no texto (já que a data foi removida)
       const amountMatch = remainingText.match(/(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?/);
       if (amountMatch) {
         const reais = parseInt(amountMatch[1], 10);
         const centavosMatch = amountMatch[2];
         const centavos = centavosMatch ? parseInt(centavosMatch.padEnd(2, '0'), 10) : 0;
         amount = reais + (centavos / 100);
         remainingText = remainingText.replace(amountMatch[0], ' ');
       }
    }

    // 4. Descrição (O que sobrou)
    let desc = remainingText
      .replace(/\b(criar|adicionar|conta|de|para|a|pagar|receber|recebi|ganhei|paguei|gastei|comprei|reais)\b/g, ' ')
      .replace(/r\$/g, ' ')
      .replace(/\b(hoje|amanhã|depois de amanhã)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Fallbacks
    if (desc.length < 3) desc = text.substring(0, 30);
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    // Default bindings (from Settings)
    const prefAccount = localStorage.getItem('defaultVoiceAccount');
    const prefExpCat = localStorage.getItem('defaultVoiceExpenseCat');
    const prefIncCat = localStorage.getItem('defaultVoiceIncomeCat');

    const defaultAccount = prefAccount === 'none' 
      ? '' 
      : (prefAccount && prefAccount !== 'auto') 
        ? prefAccount 
        : (data?.accounts?.[0]?.id || '');
      
    const isIncome = type === 'income' || type === 'receivable';
    
    let defaultCat = '';
    if (isIncome) {
       defaultCat = prefIncCat === 'none'
         ? ''
         : (prefIncCat && prefIncCat !== 'auto') 
           ? prefIncCat 
           : (data?.categories?.find(c => c.type === 'income')?.id || '');
    } else {
       defaultCat = prefExpCat === 'none'
         ? ''
         : (prefExpCat && prefExpCat !== 'auto') 
           ? prefExpCat 
           : (data?.categories?.find(c => c.type === 'expense')?.id || '');
    }

    setParsedData({ 
      type, 
      amount, 
      description: desc, 
      date,
      categoryId: defaultCat,
      accountId: defaultAccount,
      contact: 'Fornecedor ou Cliente não informado'
    });
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    
    try {
      if (parsedData.type === 'payable') {
        await addPayable({
          description: parsedData.description,
          supplier: parsedData.contact,
          amount: parsedData.amount,
          dueDate: parsedData.date,
          status: 'pending',
          categoryId: parsedData.categoryId,
          accountId: parsedData.accountId
        } as any);
        toast.success('Conta a pagar adicionada!');
      } else if (parsedData.type === 'receivable') {
        await addReceivable({
          description: parsedData.description,
          clientName: parsedData.contact,
          amount: parsedData.amount,
          dueDate: parsedData.date,
          status: 'pending',
          categoryId: parsedData.categoryId,
          accountId: parsedData.accountId
        } as any);
        toast.success('Conta a receber adicionada!');
      } else if (parsedData.type === 'expense') {
        if (!parsedData.accountId) {
          toast.error('Selecione uma conta bancária.');
          return;
        }
        await addTransaction({
          type: 'expense',
          description: parsedData.description,
          amount: parsedData.amount,
          date: parsedData.date,
          categoryId: parsedData.categoryId,
          accountId: parsedData.accountId,
        } as any);
        toast.success('Despesa (Transação) registrada!');
      } else if (parsedData.type === 'income') {
        if (!parsedData.accountId) {
          toast.error('Selecione uma conta bancária.');
          return;
        }
        await addTransaction({
          type: 'income',
          description: parsedData.description,
          amount: parsedData.amount,
          date: parsedData.date,
          categoryId: parsedData.categoryId,
          accountId: parsedData.accountId,
        } as any);
        toast.success('Receita (Transação) registrada!');
      }
      
      setShowConfirm(false);
      setParsedData(null);
    } catch (error) {
      console.error('Erro ao salvar comando de voz:', error);
      toast.error('Erro ao salvar. Verifique se os dados estão preenchidos.');
    }
  };

  return (
    <>
      <Button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        size="icon"
        title="Comando de Voz"
        className={`fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-[99] transition-all duration-300 ${isListening ? 'bg-destructive hover:bg-destructive/90 animate-pulse' : 'bg-primary hover:bg-primary/90'}`}
      >
        {isListening ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Mic className="h-6 w-6 text-white" />}
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Lançamento</DialogTitle>
          </DialogHeader>
          {parsedData && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={parsedData.type}
                  onValueChange={(val: CommandType) => {
                    const isIncome = val === 'income' || val === 'receivable';
                    const newCat = data?.categories?.find(c => c.type === (isIncome ? 'income' : 'expense'))?.id || parsedData.categoryId;
                    setParsedData({ ...parsedData, type: val, categoryId: newCat });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payable">Conta a Pagar (Futuro)</SelectItem>
                    <SelectItem value="receivable">Conta a Receber (Futuro)</SelectItem>
                    <SelectItem value="expense">Transação - Despesa (Agora)</SelectItem>
                    <SelectItem value="income">Transação - Receita (Agora)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input 
                  value={parsedData.description} 
                  onChange={e => setParsedData({ ...parsedData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2 relative">
                <Label>{(parsedData.type === 'receivable' || parsedData.type === 'income') ? 'Cliente' : 'Fornecedor'}</Label>
                <div className="relative flex items-center">
                  <Input 
                    value={parsedData.contact} 
                    onChange={e => setParsedData({ ...parsedData, contact: e.target.value })}
                    onFocus={() => setIsContactFocused(true)}
                    onBlur={() => setTimeout(() => setIsContactFocused(false), 200)}
                    placeholder="Nome do cliente ou fornecedor"
                    className="pr-10"
                  />
                  <button 
                    type="button"
                    onClick={isListeningContact ? () => contactRecognitionRef.current?.stop() : startListeningContact}
                    className={`absolute right-2 p-1 rounded-full transition-colors ${isListeningContact ? 'text-destructive' : 'text-muted-foreground hover:text-primary'}`}
                  >
                    {isListeningContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
                
                {isContactFocused && data?.contacts && (
                  <div className="absolute z-[100] top-[60px] left-0 w-full max-h-48 overflow-y-auto bg-popover text-popover-foreground border rounded-md shadow-md">
                    {data.contacts
                      .filter(c => c.name.toLowerCase().includes(parsedData.contact.toLowerCase()))
                      .slice(0, 10) // Show max 10 to not overwhelm UI
                      .map(contact => (
                        <div 
                          key={contact.id} 
                          onClick={() => {
                            setParsedData({ ...parsedData, contact: contact.name });
                            setIsContactFocused(false);
                          }}
                          className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        >
                          {contact.name}
                        </div>
                    ))}
                    {data.contacts.filter(c => c.name.toLowerCase().includes(parsedData.contact.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground italic">Nenhum contato encontrado. Será usado o texto digitado.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={parsedData.amount} 
                    onChange={e => setParsedData({ ...parsedData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{parsedData.type === 'expense' || parsedData.type === 'income' ? 'Data' : 'Vencimento'}</Label>
                  <Input 
                    type="date" 
                    value={parsedData.date} 
                    onChange={e => setParsedData({ ...parsedData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={parsedData.categoryId}
                  onValueChange={(val) => setParsedData({ ...parsedData, categoryId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.categories
                      ?.filter(c => c.type === (parsedData.type === 'income' || parsedData.type === 'receivable' ? 'income' : 'expense'))
                      .map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta / Carteira</Label>
                <Select
                  value={parsedData.accountId}
                  onValueChange={(val) => setParsedData({ ...parsedData, accountId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.accounts?.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} className="gap-2">
              <Check className="h-4 w-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
