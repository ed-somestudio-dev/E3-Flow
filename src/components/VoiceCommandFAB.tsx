import React, { useState, useRef } from 'react';
import { Mic, Loader2, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useFinance } from '@/lib/finance-context';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { TransactionForm } from '@/pages/TransactionsPage';
import { ReceivableForm } from '@/pages/ReceivablesPage';
import { PayableForm } from '@/pages/PayablesPage';

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
    recognition.interimResults = true;
    
    finalTranscriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Estou ouvindo... Fale sua transação.', {
        position: 'top-center'
      });
      resetStopTimeout();
    };

    recognition.onresult = (event: any) => {
      let finalStr = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        }
      }
      if (finalStr) {
        finalTranscriptRef.current = finalStr;
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

  // --- Smart category mapping from description keywords ---
  const inferCategoryFromDescription = (desc: string, cats: { id: string; name: string; type?: string }[], isIncome: boolean): string | null => {
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const lowerNorm = normalize(desc);

    // Keyword → category name substring mappings (most specific first)
    const keywordMap: { keywords: string[]; categoryPatterns: string[] }[] = [
      // Transporte / Combustível
      { keywords: ['gasolina', 'etanol', 'alcool', 'diesel', 'combustivel', 'posto', 'abastecimento', 'abasteci', 'tanque', 'gnv', 'uber', 'cabify', '99', 'taxi', 'pedagio', 'estacionamento', 'lavagem carro', 'mecanico', 'oficina', 'borracheiro', 'pneu', 'oleo motor', 'ipva', 'licenciamento', 'seguro carro', 'seguro auto', 'multa transito'],
        categoryPatterns: ['transporte', 'combustivel', 'combustível', 'veiculo', 'veículo', 'carro', 'automovel', 'automóvel'] },
      // Alimentação
      { keywords: ['mercado', 'supermercado', 'feira', 'acougue', 'padaria', 'restaurante', 'lanche', 'almoço', 'almoco', 'janta', 'jantar', 'cafe', 'café', 'ifood', 'rappi', 'delivery', 'comida', 'pizza', 'hamburger', 'sushi', 'açaí', 'acai', 'frutas', 'verduras', 'legumes', 'hortifruti', 'quentinha', 'marmita'],
        categoryPatterns: ['alimenta', 'comida', 'mercado', 'refeicao', 'refeição'] },
      // Moradia
      { keywords: ['aluguel', 'condominio', 'condôminio', 'iptu', 'luz', 'energia', 'eletrica', 'agua', 'água', 'gas', 'gás', 'internet', 'wifi', 'telefone', 'celular', 'reforma', 'pedreiro', 'eletricista', 'encanador', 'pintor', 'faxina', 'diarista'],
        categoryPatterns: ['moradia', 'casa', 'habitacao', 'habitação', 'residenci'] },
      // Saúde
      { keywords: ['farmacia', 'farmácia', 'remedio', 'remédio', 'medico', 'médico', 'consulta', 'exame', 'hospital', 'clinica', 'clínica', 'dentista', 'psicólogo', 'psicologo', 'fisioterapia', 'academia', 'plano saude', 'plano saúde', 'convênio', 'convenio', 'vacina', 'cirurgia', 'terapia', 'nutricionista'],
        categoryPatterns: ['saude', 'saúde', 'medic', 'farma'] },
      // Educação
      { keywords: ['escola', 'faculdade', 'curso', 'mensalidade', 'matricula', 'matrícula', 'livro', 'apostila', 'material escolar', 'uniforme', 'creche', 'inglês', 'ingles', 'aula'],
        categoryPatterns: ['educa', 'escola', 'ensino'] },
      // Lazer
      { keywords: ['cinema', 'teatro', 'show', 'ingresso', 'festa', 'viagem', 'hotel', 'pousada', 'parque', 'praia', 'passeio', 'netflix', 'spotify', 'streaming', 'game', 'jogo', 'bar', 'cerveja', 'chopp', 'balada', 'boate', 'assinatura'],
        categoryPatterns: ['lazer', 'entretenimento', 'diversao', 'diversão'] },
      // Pessoal
      { keywords: ['roupa', 'calçado', 'calcado', 'sapato', 'tenis', 'tênis', 'cabelo', 'barba', 'barbearia', 'salão', 'salao', 'manicure', 'maquiagem', 'perfume', 'cosmetico', 'cosmético'],
        categoryPatterns: ['pessoal', 'vestuario', 'vestuário', 'beleza'] },
    ];

    const catType = isIncome ? 'income' : 'expense';
    const filteredCats = cats.filter(c => !c.type || c.type === catType);

    for (const mapping of keywordMap) {
      const hasKeyword = mapping.keywords.some(kw => lowerNorm.includes(normalize(kw)));
      if (hasKeyword) {
        for (const pattern of mapping.categoryPatterns) {
          const found = filteredCats.find(c => normalize(c.name).includes(normalize(pattern)));
          if (found) return found.id;
        }
      }
    }
    return null;
  };

  // --- Deduplicate Android speech recognition repeated segments ---
  const deduplicateTranscript = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.length < 8) return trimmed;
    
    // Strategy: try to find if the text is composed of N identical (or near-identical) repetitions
    // Example: "pagar gasolina 400 reais 29/ pagar gasolina 400 reais 29/" → "pagar gasolina 400 reais 29/"
    const words = trimmed.split(/\s+/);
    
    // Try repetitions of 2, 3, 4, 5
    for (const reps of [2, 3, 4, 5]) {
      if (words.length < reps * 2) continue;
      const chunkSize = Math.floor(words.length / reps);
      if (chunkSize < 2) continue;
      
      const firstChunk = words.slice(0, chunkSize).join(' ');
      let allMatch = true;
      
      for (let i = 1; i < reps; i++) {
        const otherChunk = words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ');
        // Allow fuzzy match (85% similarity at word level)
        const firstWords = firstChunk.split(/\s+/);
        const otherWords = otherChunk.split(/\s+/);
        let matches = 0;
        const minLen = Math.min(firstWords.length, otherWords.length);
        for (let j = 0; j < minLen; j++) {
          if (firstWords[j] === otherWords[j]) matches++;
        }
        if (minLen === 0 || matches / minLen < 0.7) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        // Use the last chunk (often more accurate from speech recognition)
        const lastChunk = words.slice((reps - 1) * chunkSize).join(' ');
        return lastChunk;
      }
    }
    
    return trimmed;
  };

  // --- Number words to digits ---
  const wordsToNumber = (text: string): string => {
    const numberWords: Record<string, number> = {
      'zero': 0, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'meia': 6, 'sete': 7, 'oito': 8, 'nove': 9,
      'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13, 'catorze': 14, 'quatorze': 14,
      'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
      'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50, 'sessenta': 60,
      'setenta': 70, 'oitenta': 80, 'noventa': 90,
      'cem': 100, 'cento': 100, 'duzentos': 200, 'duzentas': 200,
      'trezentos': 300, 'trezentas': 300, 'quatrocentos': 400, 'quatrocentas': 400,
      'quinhentos': 500, 'quinhentas': 500, 'seiscentos': 600, 'seiscentas': 600,
      'setecentos': 700, 'setecentas': 700, 'oitocentos': 800, 'oitocentas': 800,
      'novecentos': 900, 'novecentas': 900,
      'mil': 1000,
    };

    let result = text;
    // Replace compound number phrases like "quatrocentos e cinquenta" → "450"
    // Pattern: number words separated by "e" 
    const numberWordPattern = new RegExp(
      `\\b(${Object.keys(numberWords).join('|')})((?:\\s+e\\s+(?:${Object.keys(numberWords).join('|')}))+)?\\b`,
      'gi'
    );
    
    result = result.replace(numberWordPattern, (fullMatch) => {
      const parts = fullMatch.toLowerCase().split(/\s+e\s+/);
      let total = 0;
      for (const part of parts) {
        const trimPart = part.trim();
        if (trimPart === 'mil') {
          total = total === 0 ? 1000 : total * 1000;
        } else if (numberWords[trimPart] !== undefined) {
          total += numberWords[trimPart];
        }
      }
      return total > 0 ? total.toString() : fullMatch;
    });
    
    return result;
  };

  const processTranscript = (rawText: string) => {
    console.log('[VoiceCommand] Raw transcript:', rawText);

    // Step 0: Deduplicate repeated segments from Android speech recognition
    const text = deduplicateTranscript(rawText);
    console.log('[VoiceCommand] After dedup:', text);

    let lower = text.toLowerCase().trim();
    
    // Step 0.5: Convert number words to digits
    lower = wordsToNumber(lower);
    console.log('[VoiceCommand] After number conversion:', lower);

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
      // Normalize speech recognition artifacts: "29/ 09" → "29/09", "29 / 09" → "29/09"
      remainingText = remainingText.replace(/(\d{1,2})\s*\/\s*(\d{1,2})/g, '$1/$2');

      // Regex rigoroso para Data: 
      // 1: "dia 15"
      // 2: "15 de setembro" ou "15 setembro"
      // 5: "15/09/2026" ou "15/09"
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
       
       // Remove all occurrences of the full match and the numbers to avoid them leaking into description due to speech recognition duplicates
       remainingText = remainingText.split(explicitCurrencyMatch[0]).join(' ');
       const numPart = explicitCurrencyMatch[1] || explicitCurrencyMatch[3];
       if (numPart) {
         remainingText = remainingText.replace(new RegExp(`\\b${numPart}\\b`, 'g'), ' ');
       }
    } else {
       // Se não tem "reais", pega o primeiro número que sobrou no texto (já que a data foi removida)
       const amountMatch = remainingText.match(/(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?/);
       if (amountMatch) {
         const reais = parseInt(amountMatch[1], 10);
         const centavosMatch = amountMatch[2];
         const centavos = centavosMatch ? parseInt(centavosMatch.padEnd(2, '0'), 10) : 0;
         amount = reais + (centavos / 100);
         remainingText = remainingText.split(amountMatch[0]).join(' ');
         remainingText = remainingText.replace(new RegExp(`\\b${amountMatch[1]}\\b`, 'g'), ' ');
       }
    }

    // 4. Descrição (O que sobrou)
    let desc = remainingText
      .replace(/\b(criar|adicionar|conta|de|para|a|pagar|receber|recebi|ganhei|paguei|gastei|comprei|reais|conto|contos)\b/g, ' ')
      .replace(/r\$/g, ' ')
      .replace(/\b(hoje|amanhã|depois de amanhã)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove palavras duplicadas consecutivas (comum em erros de reconhecimento de voz no Android)
    desc = desc.split(/\s+/).filter((word, index, arr) => word !== arr[index - 1]).join(' ');
    
    // Remove leading/trailing single characters and commas
    desc = desc.replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*/g, ' ').trim();
    
    // Fallbacks
    if (desc.length < 3) desc = text.substring(0, 30);
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    console.log('[VoiceCommand] Parsed:', { type, amount, date, desc });

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

    // 5. Smart category inference from description keywords
    const inferredCat = inferCategoryFromDescription(desc, data?.categories || [], isIncome);
    if (inferredCat) {
      defaultCat = inferredCat;
    }

    sessionStorage.removeItem('e3flow_dialog_draft_transactions-form-new');
    sessionStorage.removeItem('e3flow_dialog_draft_payables-form-new');
    sessionStorage.removeItem('e3flow_dialog_draft_receivables-form-new');

    setParsedData({ 
      type, 
      amount, 
      description: desc, 
      date,
      categoryId: defaultCat,
      accountId: defaultAccount,
      contact: ''
    });
    setShowConfirm(true);
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

      <Dialog open={showConfirm} onOpenChange={(o) => {
        setShowConfirm(o);
        if (!o) {
          // Clear ALL persisted form drafts when closing the voice command dialog without saving
          try {
            sessionStorage.removeItem('e3flow_dialog_draft_transactions-form-new');
            sessionStorage.removeItem('e3flow_dialog_draft_payables-form-new');
            sessionStorage.removeItem('e3flow_dialog_draft_receivables-form-new');
          } catch {}
          setParsedData(null);
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Lançamento</DialogTitle>
          </DialogHeader>
          {parsedData && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Classificação Identificada</Label>
                <Select
                  value={parsedData.type}
                  onValueChange={(val: CommandType) => {
                    sessionStorage.removeItem('e3flow_dialog_draft_transactions-form-new');
                    sessionStorage.removeItem('e3flow_dialog_draft_payables-form-new');
                    sessionStorage.removeItem('e3flow_dialog_draft_receivables-form-new');
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

              {parsedData.type === 'expense' || parsedData.type === 'income' ? (
                <TransactionForm
                  tx={null}
                  initialData={{
                    type: parsedData.type as 'expense' | 'income',
                    description: parsedData.description,
                    categoryId: parsedData.categoryId,
                    accountId: parsedData.accountId,
                    amount: parsedData.amount,
                    date: parsedData.date,
                  }}
                  categories={data.categories}
                  accounts={data.accounts}
                  onSave={async (tx) => {
                    try {
                      await addTransaction(tx as any);
                      toast.success('Transação registrada!');
                      setShowConfirm(false);
                      setParsedData(null);
                    } catch (e) {
                      toast.error('Erro ao salvar transação.');
                    }
                  }}
                />
              ) : parsedData.type === 'payable' ? (
                <PayableForm
                  item={null}
                  initialData={{
                    supplier: parsedData.contact,
                    description: parsedData.description,
                    categoryId: parsedData.categoryId,
                    accountId: parsedData.accountId,
                    amount: parsedData.amount,
                    dueDate: parsedData.date,
                  }}
                  categories={data.categories.filter(c => c.type === 'expense')}
                  accounts={data.accounts}
                  onSave={async (p) => {
                    try {
                      await addPayable(p as any);
                      toast.success('Conta a pagar adicionada!');
                      setShowConfirm(false);
                      setParsedData(null);
                    } catch (e) {
                      toast.error('Erro ao salvar conta.');
                    }
                  }}
                />
              ) : (
                <ReceivableForm
                  item={null}
                  initialData={{
                    clientName: parsedData.contact,
                    description: parsedData.description,
                    categoryId: parsedData.categoryId,
                    accountId: parsedData.accountId,
                    amount: parsedData.amount,
                    dueDate: parsedData.date,
                  }}
                  categories={data.categories.filter(c => c.type === 'income')}
                  accounts={data.accounts}
                  onSave={async (r) => {
                    try {
                      await addReceivable(r as any);
                      toast.success('Conta a receber adicionada!');
                      setShowConfirm(false);
                      setParsedData(null);
                    } catch (e) {
                      toast.error('Erro ao salvar recebível.');
                    }
                  }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
