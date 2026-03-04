import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Palette, FileText, Save, RefreshCw, Eye } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function BrandingSettingsPage() {
  const [branding, setBranding] = useState({
    company_name: 'SSC Track',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_vat: '',
    logo_url: '',
    primary_color: '#10B981',
    footer_text: 'Thank you for your business!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(false);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const res = await api.get('/pdf-exports/branding');
      setBranding(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/pdf-exports/branding', branding);
      toast.success('Branding settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const res = await api.post('/pdf-exports/generate', {
        report_type: 'pnl',
        title: 'Sample P&L Report',
        include_logo: true,
        include_footer: true,
      }, { responseType: 'blob' });
      
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to generate preview');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="branding-title">
            <Palette className="text-emerald-500" />
            Branding Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize your company branding for PDF exports and reports
          </p>
        </div>

        {/* Preview Card */}
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: branding.primary_color }}>
                  {branding.company_name}
                </h2>
                <p className="text-sm text-stone-600">{branding.company_address || 'Company Address'}</p>
                <p className="text-xs text-stone-500">
                  {[branding.company_phone, branding.company_email, branding.company_vat && `VAT: ${branding.company_vat}`]
                    .filter(Boolean)
                    .join(' | ') || 'Contact Info'}
                </p>
              </div>
              <Button variant="outline" onClick={handlePreview}>
                <Eye size={14} className="mr-1" /> Preview PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 size={18} /> Company Information
            </CardTitle>
            <CardDescription>This information appears on all exported PDFs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={branding.company_name}
                  onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                  placeholder="Your Company Name"
                  data-testid="company-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_vat">VAT Number</Label>
                <Input
                  id="company_vat"
                  value={branding.company_vat}
                  onChange={(e) => setBranding({ ...branding, company_vat: e.target.value })}
                  placeholder="VAT123456789"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_address">Address</Label>
              <Textarea
                id="company_address"
                value={branding.company_address}
                onChange={(e) => setBranding({ ...branding, company_address: e.target.value })}
                placeholder="123 Business Street, City, Country"
                rows={2}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Phone</Label>
                <Input
                  id="company_phone"
                  value={branding.company_phone}
                  onChange={(e) => setBranding({ ...branding, company_phone: e.target.value })}
                  placeholder="+966 50 000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={branding.company_email}
                  onChange={(e) => setBranding({ ...branding, company_email: e.target.value })}
                  placeholder="info@company.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette size={18} /> Appearance
            </CardTitle>
            <CardDescription>Customize the look of your exports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    placeholder="#10B981"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL (optional)</Label>
                <Input
                  id="logo_url"
                  value={branding.logo_url}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                  placeholder="https://yoursite.com/logo.png"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText size={18} /> Footer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <Input
                id="footer_text"
                value={branding.footer_text}
                onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })}
                placeholder="Thank you for your business!"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchBranding}>
            <RefreshCw size={14} className="mr-1" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-branding-btn">
            {saving ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Save size={14} className="mr-1" />}
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
