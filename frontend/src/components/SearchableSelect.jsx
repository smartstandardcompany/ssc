import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Building2 } from 'lucide-react';

export function SearchableSelect({ items, value, onChange, placeholder = 'Search...', labelKey = 'name', valueKey = 'id', renderItem, className = '' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = items.filter(item =>
    (item[labelKey] || '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = items.find(item => item[valueKey] === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`} data-testid="searchable-select">
      <div
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-all bg-background hover:border-emerald-400 ${open ? 'ring-2 ring-emerald-400 border-emerald-400' : 'border-input'}`}
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium truncate">{selected[labelKey]}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); }} className="text-muted-foreground hover:text-foreground ml-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground w-full">
            <Search size={14} />
            <span className="text-sm">{placeholder}</span>
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-64 overflow-hidden" data-testid="searchable-dropdown">
          <div className="p-2 border-b sticky top-0 bg-popover">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="pl-8 h-9 text-sm"
                autoFocus
                data-testid="searchable-input"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setSearch(''); }} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">No results found</div>
            )}
            {filtered.map(item => (
              <button
                key={item[valueKey]}
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(item[valueKey]); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${value === item[valueKey] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium' : ''}`}
                data-testid={`select-option-${item[valueKey]}`}
              >
                {renderItem ? renderItem(item) : (
                  <>
                    <Building2 size={14} className="text-muted-foreground shrink-0" />
                    <span className="truncate">{item[labelKey]}</span>
                    {item.current_credit > 0 && (
                      <span className="ml-auto text-xs text-red-500 font-mono shrink-0">SAR {item.current_credit?.toFixed(0)}</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
