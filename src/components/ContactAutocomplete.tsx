import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useContacts, Contact } from '@/lib/contacts-context';
import { User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelectContact?: (contact: Contact) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Input com sugestões de contatos cadastrados.
 * Filtra contatos por nome enquanto o usuário digita.
 */
export function ContactAutocomplete({
  value,
  onChange,
  onSelectContact,
  placeholder,
  className,
}: ContactAutocompleteProps) {
  const { contacts } = useContacts();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
    ? contacts.filter(c => c.name.toLowerCase().includes(term))
    : contacts
  ).slice(0, 8);

  const showList = open && suggestions.length > 0;

  const select = (c: Contact) => {
    onChange(c.name);
    onSelectContact?.(c);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
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
      />
      {showList && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {contacts.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              Nenhum contato cadastrado. Cadastre em "Contatos".
            </div>
          ) : (
            suggestions.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(c); }}
                onMouseEnter={() => setHighlight(idx)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                  idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                )}
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  {(c.phone || c.email) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {c.phone || c.email}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
