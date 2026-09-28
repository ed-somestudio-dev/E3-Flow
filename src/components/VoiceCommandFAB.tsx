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
    // CRITICAL: continuous must be false on Android Chrome to prevent duplicate final results.
    // With continuous:true, Android produces multiple isFinal results for the same utterance,
    // causing text triplication like "gasolina gasolina gasolina".
    recognition.continuous = false;
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
      // With continuous:false, there's typically only one result.
      // We take the best (longest) final transcript available.
      let bestFinal = '';
      let hasInterim = false;
      
      for (let i = 0; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          // Keep the longest final result (in case Android still produces duplicates)
          if (transcript.length > bestFinal.length) {
            bestFinal = transcript;
          }
        } else {
          hasInterim = true;
        }
      }
      
      if (bestFinal) {
        finalTranscriptRef.current = bestFinal;
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

    // 1. Tipo — detect and REMOVE the verb from the text
    const typePatterns: { pattern: RegExp; type: CommandType }[] = [
      { pattern: /\b(recebi|ganhei|entrou)\b/, type: 'income' },
      { pattern: /\b(receber|receita|vou receber|vai entrar)\b/, type: 'receivable' },
      { pattern: /\b(paguei|gastei|comprei|saiu)\b/, type: 'expense' },
      { pattern: /\b(pagar|conta|gastar|comprar|vou pagar|vou gastar|vou comprar)\b/, type: 'payable' },
    ];
    
    let type: CommandType = 'payable';
    for (const tp of typePatterns) {
      if (tp.pattern.test(lower)) {
        type = tp.type;
        break;
      }
    }

    // Build a working copy — we'll progressively strip matched tokens
    let work = lower;

    // 2. Data — extract date and strip the ENTIRE matched phrase from work text
    let date = new Date().toISOString().split('T')[0];
    const d = new Date();

    // Ordered from most specific to least specific
    const dateExtractors: { pattern: RegExp; extract: (m: RegExpMatchArray) => Date | null }[] = [
      // "depois de amanhã"
      { pattern: /\b(?:para\s+)?depois\s+de\s+amanhã\b/, extract: () => { const x = new Date(); x.setDate(x.getDate() + 2); return x; } },
      // "amanhã"
      { pattern: /\b(?:para\s+|pra\s+)?amanhã\b/, extract: () => { const x = new Date(); x.setDate(x.getDate() + 1); return x; } },
      // "ontem"
      { pattern: /\bontem\b/, extract: () => { const x = new Date(); x.setDate(x.getDate() - 1); return x; } },
      // "hoje"
      { pattern: /\bhoje\b/, extract: () => new Date() },
      // "semana que vem"
      { pattern: /\b(?:na\s+)?semana\s+que\s+vem\b/, extract: () => { const x = new Date(); x.setDate(x.getDate() + 7); return x; } },
      // "mês que vem"
      { pattern: /\b(?:no\s+)?m[eê]s\s+que\s+vem\b/, extract: () => { const x = new Date(); x.setMonth(x.getMonth() + 1); return x; } },
      // "15 de setembro de 2026" / "15 de setembro" / "15 setembro"
      { pattern: /\b(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?\b/, extract: (m) => {
        const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        const monthStr = m[2] === 'marco' ? 'março' : m[2];
        const mi = months.indexOf(monthStr);
        if (mi === -1) return null;
        const day = parseInt(m[1], 10);
        let year = m[3] ? parseInt(m[3], 10) : d.getFullYear();
        if (year < 100) year += 2000;
        return new Date(year, mi, day);
      }},
      // "dia 15"
      { pattern: /\b(?:no\s+)?dia\s+(\d{1,2})\b/, extract: (m) => {
        const day = parseInt(m[1], 10);
        let month = d.getMonth();
        if (day < d.getDate() - 3) month += 1;
        return new Date(d.getFullYear(), month, day);
      }},
      // "29/09/2026" or "29/09"  (after space normalization)
      { pattern: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, extract: (m) => {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        let year = m[3] ? parseInt(m[3], 10) : d.getFullYear();
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      }},
    ];

    // Normalize slash spacing before date extraction: "29/ 09" → "29/09"
    work = work.replace(/(\d{1,2})\s*\/\s*(\d{1,2})/g, '$1/$2');

    for (const de of dateExtractors) {
      const m = work.match(de.pattern);
      if (m) {
        const parsed = de.extract(m);
        if (parsed && !isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0];
          work = work.replace(m[0], ' ');
          break;
        }
      }
    }

    // 3. Valor — extract amount and strip the ENTIRE matched phrase
    let amount = 0;
    
    // Try explicit currency first: "R$ 400", "400 reais", "R$ 50,90", "50 e 90 centavos"
    const currencyPatterns: RegExp[] = [
      // "R$ 400" / "R$400" / "r$ 400,50"
      /r\$\s*(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?/,
      // "400 reais" / "400 reais e 50 centavos" / "400,50 reais"
      /(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?\s*(?:reais|real|r\$|conto|contos)/,
      // "reais 400" (sometimes speech puts currency first)
      /(?:reais|real)\s*(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?/,
    ];

    let amountExtracted = false;
    for (const cp of currencyPatterns) {
      const m = work.match(cp);
      if (m) {
        const reais = parseInt(m[1], 10);
        const centStr = m[2];
        const centavos = centStr ? parseInt(centStr.padEnd(2, '0'), 10) : 0;
        amount = reais + (centavos / 100);
        // Remove the full match AND any stray occurrences of the number
        work = work.replace(m[0], ' ');
        if (m[1]) work = work.replace(new RegExp(`\\b${m[1]}\\b`, 'g'), ' ');
        amountExtracted = true;
        break;
      }
    }

    if (!amountExtracted) {
      // Fallback: take first remaining number (date was already removed)
      const numMatch = work.match(/(\d+)(?:\s*(?:e|,|\.)\s*(\d{1,2}))?/);
      if (numMatch) {
        const reais = parseInt(numMatch[1], 10);
        const centStr = numMatch[2];
        const centavos = centStr ? parseInt(centStr.padEnd(2, '0'), 10) : 0;
        amount = reais + (centavos / 100);
        work = work.replace(numMatch[0], ' ');
        if (numMatch[1]) work = work.replace(new RegExp(`\\b${numMatch[1]}\\b`, 'g'), ' ');
      }
    }

    // 4. Descrição — strip ALL noise words then clean up
    // All words that should NEVER appear in the description
    const noiseWords = [
      // Command verbs
      'criar', 'adicionar', 'lançar', 'lancar', 'registrar', 'anotar', 'marcar',
      // Type verbs
      'pagar', 'paguei', 'gastei', 'comprei', 'comprar', 'gastar',
      'receber', 'recebi', 'ganhei', 'receita',
      'vou', 'vai', 'entrou', 'saiu',
      // Currency words
      'reais', 'real', 'r\\$', 'conto', 'contos', 'centavos',
      // Date words
      'hoje', 'amanhã', 'amanha', 'ontem',
      'depois', 'semana', 'mês', 'mes', 'vem',
      'dia', 'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
      // Prepositions / articles / connectors
      'de', 'do', 'da', 'dos', 'das',
      'no', 'na', 'nos', 'nas',
      'para', 'pra', 'pro', 'por',
      'com', 'em', 'ao', 'à',
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
      'e', 'ou', 'que',
      // Common noise
      'conta', 'valor', 'total',
    ];
    
    // Build a single regex to strip all noise words (whole words only)
    const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
    let desc = work
      .replace(noiseRegex, ' ')
      .replace(/r\$/gi, ' ')
      // Remove any remaining standalone numbers (leftover from imperfect extraction)
      .replace(/\b\d+\b/g, ' ')
      // Remove punctuation artifacts
      .replace(/[,;:!?]/g, ' ')
      // Remove slash artifacts (leftover from dates like "29/")
      .replace(/\d*\s*\/\s*\d*/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove duplicate consecutive words (common in Android speech recognition)
    desc = desc.split(/\s+/).filter((word, index, arr) => word !== arr[index - 1]).join(' ');
    
    // Remove leading/trailing single characters, commas, prepositions
    desc = desc.replace(/^[\s,.\-]+|[\s,.\-]+$/g, '').trim();
    // If only 1-2 char words remain, try harder
    if (desc.split(/\s+/).every(w => w.length <= 2)) desc = '';
    
    // Fallback: if nothing useful remains, use the original text cleaned minimally
    if (desc.length < 2) {
      desc = text
        .replace(/\b\d+\b/g, '')
        .replace(/\b(pagar|receber|recebi|paguei|gastei|comprei|reais|amanhã|hoje|ontem)\b/gi, '')
        .replace(/r\$/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 40);
    }
    if (desc.length < 2) desc = text.substring(0, 30);
    
    // Capitalize first letter
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
