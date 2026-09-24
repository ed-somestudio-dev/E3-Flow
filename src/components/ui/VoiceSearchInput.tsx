import React, { useState, useRef, forwardRef } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onVoiceResult?: (text: string) => void;
}

export const VoiceSearchInput = forwardRef<HTMLInputElement, VoiceSearchInputProps>(({ onVoiceResult, className, value, onChange, ...props }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const transcriptRef = useRef('');
  const startedAtRef = useRef(0);

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
      toast.error('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    transcriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
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
        transcriptRef.current += chunk;
        const currentText = transcriptRef.current.trim();
        
        if (onChange) {
          const syntheticEvent = {
            target: { value: currentText }
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      }
      resetStopTimeout();
    };
    
    recognition.onerror = () => {
      setIsListening(false);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (onVoiceResult) {
        onVoiceResult(transcriptRef.current.trim());
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

  return (
    <div className="relative w-full">
      <Input 
        ref={ref}
        value={value}
        onChange={onChange}
        className={`${className || ''} pr-9`} 
        {...props} 
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`absolute right-1 top-1 h-7 w-7 rounded-full ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        title="Buscar por voz"
      >
        <Mic className="h-4 w-4" />
      </Button>
    </div>
  );
});
