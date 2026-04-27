import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Caixa de busca com autocomplete: ao digitar, sugere itens da lista
 * (fornecedores/clientes já cadastrados nas contas).
 */
export function SearchAutocomplete({
  value,
  onChange,
  options,
  placeholder,
  className,
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const term = value.trim().toLowerCase();
  const suggestions = (term
    ? options.filter(o => o.toLowerCase().includes(term))
    : options
  ).slice(0, 8);

  const showList = open && suggestions.length > 0;

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && suggestions[highlight]) { e.preventDefault(); select(suggestions[highlight]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-9"
      />
      {showList && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {suggestions.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(name); }}
              onMouseEnter={() => setHighlight(idx)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="font-medium truncate">{name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
