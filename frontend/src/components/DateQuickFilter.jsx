import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, X } from 'lucide-react';

const presets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
];

export function DateQuickFilter({ onFilterChange, className = '' }) {
  const [active, setActive] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getRange = (key) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    switch (key) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'yesterday':
        return { start: yesterdayStr, end: yesterdayStr };
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay());
        return { start: d.toISOString().split('T')[0], end: todayStr };
      }
      case 'month': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: first.toISOString().split('T')[0], end: todayStr };
      }
      default:
        return null;
    }
  };

  const handleSelect = (key) => {
    setActive(key);
    if (key === 'all') {
      onFilterChange(null);
    } else if (key === 'custom') {
      if (customStart && customEnd) {
        onFilterChange({ start: customStart, end: customEnd });
      }
    } else {
      onFilterChange(getRange(key));
    }
  };

  const handleCustomChange = (field, val) => {
    const s = field === 'start' ? val : customStart;
    const e = field === 'end' ? val : customEnd;
    if (field === 'start') setCustomStart(val);
    else setCustomEnd(val);
    if (s && e) onFilterChange({ start: s, end: e });
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} data-testid="date-quick-filter">
      <CalendarDays size={16} className="text-muted-foreground shrink-0" />
      <Button
        size="sm"
        variant={active === 'all' ? 'default' : 'outline'}
        className={`h-8 rounded-full text-xs px-3 ${active === 'all' ? 'bg-stone-900 text-white hover:bg-stone-800' : ''}`}
        onClick={() => handleSelect('all')}
        data-testid="date-filter-all"
      >
        All
      </Button>
      {presets.map(p => (
        <Button
          key={p.key}
          size="sm"
          variant={active === p.key ? 'default' : 'outline'}
          className={`h-8 rounded-full text-xs px-3 transition-all ${
            active === p.key ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm' : 'hover:bg-stone-100'
          }`}
          onClick={() => handleSelect(p.key)}
          data-testid={`date-filter-${p.key}`}
        >
          {p.label}
        </Button>
      ))}
      {active === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <Input
            type="date"
            className="h-8 text-xs w-[130px] rounded-full"
            value={customStart}
            onChange={(e) => handleCustomChange('start', e.target.value)}
            data-testid="date-filter-custom-start"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 text-xs w-[130px] rounded-full"
            value={customEnd}
            onChange={(e) => handleCustomChange('end', e.target.value)}
            data-testid="date-filter-custom-end"
          />
        </div>
      )}
      {active !== 'all' && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => handleSelect('all')} data-testid="date-filter-clear">
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
