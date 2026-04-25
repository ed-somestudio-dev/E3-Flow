import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthYearPickerProps {
  /** Currently selected month start (or undefined for no month selected). */
  value?: Date;
  /** Called with startOfMonth and endOfMonth of the selected month. */
  onChange: (from: Date, to: Date) => void;
  /** Whether the trigger should appear in the active (default) variant. */
  active?: boolean;
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function MonthYearPicker({ value, onChange, active }: MonthYearPickerProps) {
  const today = new Date();
  const initial = value ?? today;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(initial.getFullYear());

  const selectedMonth = value?.getMonth();
  const selectedYear = value?.getFullYear();

  const label = value
    ? format(value, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase())
    : 'Mês Atual';

  const pick = (monthIdx: number) => {
    const from = startOfMonth(new Date(viewYear, monthIdx, 1));
    const to = endOfMonth(from);
    onChange(from, to);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) setViewYear((value ?? today).getFullYear());
    }}>
      <PopoverTrigger asChild>
        <Button variant={active ? 'default' : 'outline'} size="sm">
          <CalendarIcon className="h-4 w-4 mr-2" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y - 1)} aria-label="Ano anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">{viewYear}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(y => y + 1)} aria-label="Próximo ano">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_PT.map((m, idx) => {
            const isSelected = selectedMonth === idx && selectedYear === viewYear;
            const isCurrent = today.getMonth() === idx && today.getFullYear() === viewYear;
            return (
              <Button
                key={m}
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-9 text-xs font-normal',
                  !isSelected && isCurrent && 'border border-primary/40 text-primary',
                )}
                onClick={() => pick(idx)}
              >
                {m.slice(0, 3)}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}