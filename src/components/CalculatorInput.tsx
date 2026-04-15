import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calculator } from 'lucide-react';

interface CalculatorInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CalculatorInput({ value, onChange, placeholder, className }: CalculatorInputProps) {
  const [calcOpen, setCalcOpen] = useState(false);
  const [display, setDisplay] = useState('');
  const [expression, setExpression] = useState('');

  const appendToExpression = (char: string) => {
    const newExpr = expression + char;
    setExpression(newExpr);
    setDisplay(newExpr);
  };

  const clearCalc = () => {
    setExpression('');
    setDisplay('');
  };

  const calculate = () => {
    try {
      // Safe eval: only allow numbers and basic operators
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      if (!sanitized) return;
      const result = Function('"use strict";return (' + sanitized + ')')();
      if (typeof result === 'number' && isFinite(result)) {
        const formatted = parseFloat(result.toFixed(2)).toString();
        setDisplay(formatted);
        setExpression(formatted);
        onChange(formatted);
      }
    } catch {
      setDisplay('Erro');
    }
  };

  const useValue = () => {
    if (display && !isNaN(parseFloat(display))) {
      onChange(parseFloat(display).toFixed(2));
      setCalcOpen(false);
      setExpression('');
      setDisplay('');
    }
  };

  const buttons = [
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  return (
    <div className="flex gap-1">
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <Popover open={calcOpen} onOpenChange={setCalcOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0">
            <Calculator className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-3 pointer-events-auto" align="end">
          <div className="space-y-2">
            <div className="bg-muted rounded-md px-3 py-2 text-right font-mono text-sm min-h-[32px]">
              {display || '0'}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {buttons.map((row, ri) =>
                row.map((btn) => (
                  <Button
                    key={`${ri}-${btn}`}
                    type="button"
                    variant={btn === '=' ? 'default' : ['+', '-', '*', '/'].includes(btn) ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9 text-sm font-mono"
                    onClick={() => btn === '=' ? calculate() : appendToExpression(btn)}
                  >
                    {btn}
                  </Button>
                ))
              )}
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="flex-1 text-xs" onClick={clearCalc}>
                Limpar
              </Button>
              <Button type="button" size="sm" className="flex-1 text-xs" onClick={useValue}>
                Usar Valor
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
