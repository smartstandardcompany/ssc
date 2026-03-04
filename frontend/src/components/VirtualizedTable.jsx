import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * VirtualizedTable - A high-performance table component for large datasets
 * Uses virtual scrolling to render only visible rows
 * 
 * @param {Array} data - Array of data objects to display
 * @param {Array} columns - Column definitions: { key, header, width?, render?, align? }
 * @param {number} rowHeight - Height of each row in pixels (default: 48)
 * @param {number} maxHeight - Max height of table container (default: 500)
 * @param {Function} onRowClick - Optional click handler for rows
 * @param {string} emptyMessage - Message when no data
 */
export function VirtualizedTable({
  data = [],
  columns = [],
  rowHeight = 48,
  maxHeight = 500,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  headerClassName = '',
  rowClassName = '',
}) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const handleRowClick = useCallback((item, index) => {
    if (onRowClick) {
      onRowClick(item, index);
    }
  }, [onRowClick]);

  if (data.length === 0) {
    return (
      <div className={`border rounded-lg ${className}`}>
        <table className="w-full text-sm">
          <thead className={`bg-stone-50 dark:bg-stone-800 sticky top-0 z-10 ${headerClassName}`}>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`px-3 py-3 text-${col.align || 'left'} font-medium text-stone-600 dark:text-stone-300 border-b`}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="px-4 py-12 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Fixed Header */}
      <div className={`bg-stone-50 dark:bg-stone-800 ${headerClassName}`}>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`px-3 py-3 text-${col.align || 'left'} font-medium text-stone-600 dark:text-stone-300 border-b`}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: maxHeight - 48 }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="w-full text-sm table-fixed" style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    className={`border-b hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => handleRowClick(item, virtualRow.index)}
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key || colIdx}
                        className={`px-3 py-2 text-${col.align || 'left'} truncate`}
                        style={{ width: col.width }}
                      >
                        {col.render ? col.render(item[col.key], item, virtualRow.index) : item[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with count */}
      <div className="px-3 py-2 text-xs text-muted-foreground bg-stone-50 dark:bg-stone-800 border-t">
        Showing {data.length.toLocaleString()} rows
      </div>
    </div>
  );
}

/**
 * useVirtualList - Hook for creating virtualized lists
 * Returns virtualizer instance for custom implementations
 */
export function useVirtualList({ count, parentRef, estimateSize = 48, overscan = 5 }) {
  return useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });
}
