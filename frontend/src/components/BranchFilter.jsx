import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import api from '@/lib/api';

export function BranchFilter({ onChange, className = '' }) {
  const [branches, setBranches] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    api.get('/branches').then(res => setBranches(res.data)).catch(() => {});
  }, []);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
    setSelected(next);
    onChange(next);
  };

  const clearAll = () => { setSelected([]); onChange([]); };

  if (branches.length === 0) return null;

  return (
    <div className={`flex gap-2 items-center flex-wrap ${className}`} data-testid="branch-filter">
      {branches.map(b => (
        <Badge
          key={b.id}
          variant={selected.includes(b.id) ? 'default' : 'outline'}
          className={`cursor-pointer text-xs py-1 px-3 transition-all ${selected.includes(b.id) ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
          onClick={() => toggle(b.id)}
          data-testid={`branch-chip-${b.id}`}
        >
          {b.name}
        </Badge>
      ))}
      {selected.length > 0 && (
        <Button size="sm" variant="ghost" onClick={clearAll} className="h-6 text-xs text-muted-foreground" data-testid="clear-branch-filter">
          <X size={12} className="mr-1" />Clear
        </Button>
      )}
    </div>
  );
}
