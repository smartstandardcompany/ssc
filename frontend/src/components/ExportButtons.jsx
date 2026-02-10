import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export function ExportButtons({ dataType, label }) {
  const handleExport = async (format) => {
    try {
      toast.loading(`Generating ${format.toUpperCase()}...`);
      const response = await api.post('/export/data', { type: dataType, format }, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${dataType}_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
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
    <div className="flex gap-2" data-testid={`export-${dataType}`}>
      <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} className="h-8 text-xs rounded-full" data-testid={`export-${dataType}-pdf`}>
        <FileText size={14} className="mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => handleExport('excel')} className="h-8 text-xs rounded-full" data-testid={`export-${dataType}-excel`}>
        <FileSpreadsheet size={14} className="mr-1" /> Excel
      </Button>
    </div>
  );
}
