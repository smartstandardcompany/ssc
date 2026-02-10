import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export function DateFilter({ onFilterChange }) {
  const [period, setPeriod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePeriodChange = (val) => {
    setPeriod(val);
    const now = new Date();
    let start = null, end = null;

    if (val === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (val === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (val === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    onFilterChange({ start, end, period: val });
  };

  const handleCustomDate = (field, val) => {
    if (field === 'start') setCustomStart(val);
    else setCustomEnd(val);
    const s = field === 'start' ? val : customStart;
    const e = field === 'end' ? val : customEnd;
    if (s && e) {
      onFilterChange({ start: new Date(s), end: new Date(e + 'T23:59:59'), period: 'custom' });
    }
  };

  return (
    <div className="flex gap-3 items-end flex-wrap" data-testid="date-filter">
      <div>
        <Label className="text-xs">Period</Label>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[130px] h-9" data-testid="period-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {period === 'custom' && (
        <>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-9 w-[140px]" value={customStart} onChange={(e) => handleCustomDate('start', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-9 w-[140px]" value={customEnd} onChange={(e) => handleCustomDate('end', e.target.value)} />
          </div>
        </>
      )}
    </div>
  );
}
