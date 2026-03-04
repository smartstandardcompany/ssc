import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export function PDFExportButton({ 
  reportType, 
  title, 
  startDate, 
  endDate, 
  branchId, 
  supplierId, 
  customerId,
  variant = 'outline',
  size = 'sm',
  className = '',
  label = 'PDF',
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await api.post('/pdf-exports/generate', {
        report_type: reportType,
        title: title || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        branch_id: branchId || undefined,
        supplier_id: supplierId || undefined,
        customer_id: customerId || undefined,
        include_logo: true,
        include_footer: true,
      }, { responseType: 'blob' });

      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleExport} 
      disabled={loading}
      className={`rounded-xl ${className}`}
      data-testid={`pdf-export-${reportType}-btn`}
    >
      {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <FileDown size={14} className="mr-1" />}
      {label}
    </Button>
  );
}
