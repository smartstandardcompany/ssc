import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * AdvancedSearch - A reusable search/filter component for data tables
 * 
 * Props:
 * - onSearch: (filters) => void - Callback with filter object
 * - config: { 
 *     searchFields: ['name', 'description'], // Fields to search in text
 *     filters: [
 *       { key: 'category', label: 'Category', type: 'select', options: [{value: 'x', label: 'X'}] },
 *       { key: 'status', label: 'Status', type: 'select', options: [...] },
 *       { key: 'amount', label: 'Amount', type: 'range' },
 *       { key: 'date', label: 'Date', type: 'dateRange' }
 *     ],
 *     placeholder: 'Search...'
 *   }
 * - className: string
 */
export function AdvancedSearch({ onSearch, config = {}, className = '' }) {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

  const {
    searchFields = [],
    filters: filterConfig = [],
    placeholder = 'Search...'
  } = config;

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const triggerSearch = () => {
    const searchFilters = {
      text: searchText,
      searchFields,
      ...filters
    };
    onSearch(searchFilters);
    updateActiveFilters();
  };

  const updateActiveFilters = () => {
    const active = [];
    if (searchText) {
      active.push({ key: 'text', label: `"${searchText}"`, value: searchText });
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== 'all') {
        const filterDef = filterConfig.find(f => f.key === key);
        if (filterDef) {
          if (filterDef.type === 'select') {
            const option = filterDef.options?.find(o => o.value === value);
            active.push({ key, label: `${filterDef.label}: ${option?.label || value}`, value });
          } else if (filterDef.type === 'range') {
            if (value.min || value.max) {
              active.push({ key, label: `${filterDef.label}: ${value.min || '0'} - ${value.max || '∞'}`, value });
            }
          } else if (filterDef.type === 'dateRange') {
            if (value.start || value.end) {
              active.push({ key, label: `${filterDef.label}: ${value.start || 'Start'} to ${value.end || 'End'}`, value });
            }
          }
        }
      }
    });
    setActiveFilters(active);
  };

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    // Auto-apply: trigger search immediately for select filters
    const searchFilters = { text: searchText, searchFields, ...next };
    onSearch(searchFilters);
    // Update active filter badges
    setTimeout(() => updateActiveFilters(), 10);
  };

  const handleRangeChange = (key, field, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const clearFilter = (key) => {
    if (key === 'text') {
      setSearchText('');
    } else {
      setFilters(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setTimeout(triggerSearch, 10);
  };

  const clearAll = () => {
    setSearchText('');
    setFilters({});
    onSearch({ text: '', searchFields });
    setActiveFilters([]);
  };

  const applyFilters = () => {
    triggerSearch();
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="advanced-search">
      {/* Main search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 pr-4"
            data-testid="search-input"
          />
        </div>
        {filterConfig.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-1"
            data-testid="toggle-filters-btn"
          >
            <Filter size={14} />
            Filters
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && filterConfig.length > 0 && (
        <div className="p-4 border rounded-xl bg-stone-50/50 space-y-4" data-testid="filters-panel">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filterConfig.map(filter => (
              <div key={filter.key}>
                <Label className="text-xs text-muted-foreground mb-1 block">{filter.label}</Label>
                
                {filter.type === 'select' && (
                  <Select
                    value={filters[filter.key] || 'all'}
                    onValueChange={(v) => handleFilterChange(filter.key, v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="h-9" data-testid={`filter-${filter.key}`}>
                      <SelectValue placeholder={`Select ${filter.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filter.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {filter.type === 'range' && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      className="h-9"
                      value={filters[filter.key]?.min || ''}
                      onChange={(e) => handleRangeChange(filter.key, 'min', e.target.value)}
                      data-testid={`filter-${filter.key}-min`}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      className="h-9"
                      value={filters[filter.key]?.max || ''}
                      onChange={(e) => handleRangeChange(filter.key, 'max', e.target.value)}
                      data-testid={`filter-${filter.key}-max`}
                    />
                  </div>
                )}

                {filter.type === 'dateRange' && (
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      className="h-9"
                      value={filters[filter.key]?.start || ''}
                      onChange={(e) => handleRangeChange(filter.key, 'start', e.target.value)}
                      data-testid={`filter-${filter.key}-start`}
                    />
                    <Input
                      type="date"
                      className="h-9"
                      value={filters[filter.key]?.end || ''}
                      onChange={(e) => handleRangeChange(filter.key, 'end', e.target.value)}
                      data-testid={`filter-${filter.key}-end`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} data-testid="clear-all-filters">
              Clear All
            </Button>
            <Button size="sm" onClick={applyFilters} data-testid="apply-filters-btn">
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {activeFilters.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center" data-testid="active-filters">
          <span className="text-xs text-muted-foreground">Active:</span>
          {activeFilters.map(filter => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="gap-1 text-xs cursor-pointer hover:bg-secondary/80"
              onClick={() => clearFilter(filter.key)}
            >
              {filter.label}
              <X size={12} />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={clearAll}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to filter data based on AdvancedSearch filters
 */
export function applySearchFilters(data, filters) {
  if (!data || !Array.isArray(data)) return [];
  
  return data.filter(item => {
    // Text search across specified fields
    if (filters.text && filters.searchFields?.length > 0) {
      const searchLower = filters.text.toLowerCase();
      const matchesText = filters.searchFields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchLower);
        }
        if (typeof value === 'number') {
          return value.toString().includes(filters.text);
        }
        return false;
      });
      if (!matchesText) return false;
    }

    // Apply other filters
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'text' || key === 'searchFields' || !value || value === '') continue;

      // Range filter
      if (typeof value === 'object' && (value.min !== undefined || value.max !== undefined)) {
        const itemValue = parseFloat(item[key]) || 0;
        if (value.min && itemValue < parseFloat(value.min)) return false;
        if (value.max && itemValue > parseFloat(value.max)) return false;
      }
      // Date range filter
      else if (typeof value === 'object' && (value.start || value.end)) {
        const itemDate = new Date(item[key]);
        if (value.start && itemDate < new Date(value.start)) return false;
        if (value.end && itemDate > new Date(value.end + 'T23:59:59')) return false;
      }
      // Exact match filter (case-insensitive, with startsWith fallback for categories)
      else if (typeof value === 'string' && value !== 'all') {
        const itemVal = String(item[key] || '');
        if (itemVal.toLowerCase() !== value.toLowerCase() && !itemVal.toLowerCase().startsWith(value.toLowerCase())) return false;
      }
    }

    return true;
  });
}
