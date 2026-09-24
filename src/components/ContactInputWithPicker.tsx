import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { VoiceSearchInput } from '@/components/ui/VoiceSearchInput';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useContacts, Contact } from '@/lib/contacts-context';
import { removeAccents } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}

export function ContactInputWithPicker({ value, onChange, placeholder = 'Nome do cliente' }: Props) {
  const { contacts } = useContacts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete dropdown
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useMemo(() => {
    const term = removeAccents(value.trim().toLowerCase());
    if (!term) return [];
    const seen = new Set<string>();
    const result: Contact[] = [];

    for (const c of contacts) {
      const name = c.name?.trim();
      if (!name) continue;
      const key = removeAccents(name.toLowerCase());
      if (seen.has(key)) continue;

      if (key.includes(term)) {
        seen.add(key);
        result.push(c);
        if (result.length >= 6) break;
      }
    }
    return result;
  }, [contacts, value]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && document.activeElement === inputRef.current);
  }, [value, suggestions.length]);

  const filtered = useMemo(() => {
    const term = removeAccents(search.trim().toLowerCase());
    const seen = new Set<string>();
    const result: Contact[] = [];

    for (const c of contacts) {
      const name = c.name?.trim();
      if (!name) continue;
      const key = removeAccents(name.toLowerCase());
      if (seen.has(key)) continue;

      if (!term || key.includes(term) || (c.phone && c.phone.includes(term))) {
        seen.add(key);
        result.push(c);
      }
    }
    return result;
  }, [contacts, search]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <VoiceSearchInput
            ref={inputRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSuggestions && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              {suggestions.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onMouseDown={() => pick(c.name)}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => { setSearch(''); setOpen(true); }}
          title="Selecionar da agenda"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>

      {/* Contact picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Contato</DialogTitle>
          </DialogHeader>
          <VoiceSearchInput
            placeholder="Buscar contato..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto space-y-1 mt-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {contacts.length === 0 ? 'Nenhum contato cadastrado' : 'Nenhum contato encontrado'}
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                  onClick={() => pick(c.name)}
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  {(c.phone || c.email) && (
                    <p className="text-xs text-muted-foreground">
                      {[c.phone, c.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
