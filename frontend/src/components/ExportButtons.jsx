import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export function ExportButtons({ dataType, label, startDate, endDate, filters, data, filename, columns }) {
  const handleExport = async (format) => {
    try {
      toast.loading(`Generating ${format.toUpperCase()}...`);

      // If inline data is provided, export directly (legacy usage)
      if (data && columns) {
        const csvContent = [columns.join(','), ...data.map(row => columns.map(c => JSON.stringify(row[c] ?? '')).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.dismiss();
        toast.success('CSV downloaded');
        return;
      }

      // API-based export with date filtering
      const payload = { type: dataType, format };
      if (startDate) payload.start_date = startDate;
      if (endDate) payload.end_date = endDate;
      if (filters) payload.filters = filters;
      const response = await api.post('/export/data', payload, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateSuffix = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_${startDate}` : '';
      link.setAttribute('download', `${dataType}_report${dateSuffix}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.dismiss();
      toast.error('Export failed');
    }
  };

  return (
    <div className="flex gap-2" data-testid={`export-${dataType || 'data'}`}>
      <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} className="h-8 text-xs rounded-full" data-testid={`export-${dataType || 'data'}-pdf`}>
        <FileText size={14} className="mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => handleExport('excel')} className="h-8 text-xs rounded-full" data-testid={`export-${dataType || 'data'}-excel`}>
        <FileSpreadsheet size={14} className="mr-1" /> Excel
      </Button>
    </div>
  );
}
