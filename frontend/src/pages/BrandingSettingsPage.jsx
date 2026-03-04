import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Palette, FileText, Save, RefreshCw, Eye, Upload, Image } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/pdf-exports/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBranding(prev => ({ ...prev, logo_url: res.data.logo_url }));
      toast.success('Logo uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
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

  const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

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

        {/* Live Preview Card */}
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {branding.logo_url ? (
                  <img 
                    src={`${API_BASE}${branding.logo_url}`} 
                    alt="Logo" 
                    className="w-14 h-14 rounded-lg object-contain bg-white border shadow-sm"
                    data-testid="branding-logo-preview"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/70 border border-dashed border-stone-300 flex items-center justify-center">
                    <Image size={20} className="text-stone-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: branding.primary_color }}>
                    {branding.company_name}
                  </h2>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{branding.company_address || 'Company Address'}</p>
                  <p className="text-xs text-stone-500">
                    {[branding.company_phone, branding.company_email, branding.company_vat && `VAT: ${branding.company_vat}`]
                      .filter(Boolean)
                      .join(' | ') || 'Contact Info'}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handlePreview} data-testid="preview-pdf-btn">
                <Eye size={14} className="mr-1" /> Preview PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload size={18} /> Company Logo
            </CardTitle>
            <CardDescription>Upload your company logo for PDF report headers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {branding.logo_url ? (
                <img 
                  src={`${API_BASE}${branding.logo_url}`} 
                  alt="Current logo" 
                  className="w-20 h-20 rounded-xl object-contain bg-white border shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center">
                  <Image size={28} className="text-stone-400" />
                </div>
              )}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="logo-file-input"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="upload-logo-btn"
                >
                  {uploading ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Upload size={14} className="mr-1" />}
                  {uploading ? 'Uploading...' : branding.logo_url ? 'Change Logo' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB recommended.</p>
              </div>
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
