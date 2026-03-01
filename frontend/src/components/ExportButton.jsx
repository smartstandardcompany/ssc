import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function ExportButton({ dataType, label, className }) {
  const [showDialog, setShowDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await api.post('/export/data', { type: dataType, format }, { responseType: 'blob' });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const mime = format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}_report.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${label || dataType} exported as ${format.toUpperCase()}`);
      setShowDialog(false);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowDialog(true)} className={className} data-testid={`export-${dataType}-btn`}>
        <Download size={14} className="mr-1.5" />Export
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xs" data-testid={`export-dialog-${dataType}`}>
          <DialogHeader>
            <DialogTitle className="font-outfit text-base">Export {label || dataType}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => handleExport('excel')} disabled={exporting} data-testid={`export-${dataType}-excel`}>
              <FileSpreadsheet size={24} className="text-emerald-600" />
              <span className="text-xs">Excel (.xlsx)</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => handleExport('pdf')} disabled={exporting} data-testid={`export-${dataType}-pdf`}>
              <FileText size={24} className="text-red-600" />
              <span className="text-xs">PDF</span>
            </Button>
          </div>
          {exporting && <p className="text-xs text-center text-muted-foreground animate-pulse">Generating report...</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
