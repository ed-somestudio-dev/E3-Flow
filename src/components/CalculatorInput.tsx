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
      // Safe eval: only allow numbers, basic operators, parenthesis and percent
      let sanitized = expression.replace(/[^0-9+\-*/().%]/g, '');
      if (!sanitized) return;

      // 1. Replace A + B% or A - B% (financial calculators style: 100 + 10% = 110)
      sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)%/g, '$1 $2 ($1 * $3 / 100)');
      // 2. Replace A * B% or A / B% (e.g. 50 * 20% = 10)
      sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*([\*/])\s*(\d+(?:\.\d+)?)%/g, '$1 $2 ($3 / 100)');
      // 3. Replace any remaining number% (e.g. 10% = 0.1)
      sanitized = sanitized.replace(/(\d+(?:\.\d+)?)%/g, '($1 / 100)');

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
    ['C', '%', '(', ')'],
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  return (
    <div className="flex gap-1 w-full">
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
          <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10">
            <Calculator className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[290px] md:w-[220px] p-4 md:p-3 pointer-events-auto" align="end">
          <div className="space-y-3 md:space-y-2">
            <div className="bg-muted rounded-md px-3 py-3 md:py-2 text-right font-mono text-lg md:text-sm min-h-[44px] md:min-h-[32px] flex items-center justify-end break-all">
              {display || '0'}
            </div>
            <div className="grid grid-cols-4 gap-1.5 md:gap-1">
              {buttons.map((row, ri) =>
                row.map((btn) => (
                  <Button
                    key={`${ri}-${btn}`}
                    type="button"
                    variant={btn === '=' ? 'default' : ['+', '-', '*', '/', '%'].includes(btn) ? 'secondary' : btn === 'C' ? 'destructive' : 'outline'}
                    size="sm"
                    className="h-11 md:h-9 text-base md:text-sm font-mono w-full"
                    onClick={() => {
                      if (btn === '=') calculate();
                      else if (btn === 'C') clearCalc();
                      else appendToExpression(btn);
                    }}
                  >
                    {btn}
                  </Button>
                ))
              )}
            </div>
            <div className="flex gap-1 pt-1">
              <Button type="button" size="sm" className="w-full h-10 md:h-8 text-xs font-semibold" onClick={useValue}>
                Usar Valor
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
