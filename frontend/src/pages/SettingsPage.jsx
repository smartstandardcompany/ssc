import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageCircle, Bell, Send, Upload, Download, Database, Shield } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [emailSettings, setEmailSettings] = useState({ smtp_host: '', smtp_port: 587, username: '', password: '', from_email: '', use_tls: true });
  const [whatsappSettings, setWhatsappSettings] = useState({ account_sid: '', auth_token: '', phone_number: '', recipient_number: '', enabled: true });
  const [notifPrefs, setNotifPrefs] = useState({ email_daily_sales: false, email_document_expiry: true, email_leave_updates: false, whatsapp_daily_sales: false, whatsapp_document_expiry: false });
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const [emailRes, waRes, prefRes] = await Promise.all([
        api.get('/settings/email').catch(() => ({ data: null })),
        api.get('/settings/whatsapp').catch(() => ({ data: null })),
        api.get('/settings/notifications').catch(() => ({ data: null })),
      ]);
      if (emailRes.data) setEmailSettings(prev => ({ ...prev, ...emailRes.data }));
      if (waRes.data) setWhatsappSettings(prev => ({ ...prev, ...waRes.data }));
      if (prefRes.data) setNotifPrefs(prev => ({ ...prev, ...prefRes.data }));
    } catch {}
    finally { setLoading(false); }
  };

  const saveEmail = async () => {
    try { await api.post('/settings/email', emailSettings); toast.success('Email settings saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const testEmailSend = async () => {
    try {
      const res = await api.post('/settings/email/test', { to_email: testEmail || undefined });
      toast.success(res.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Test failed'); }
  };

  const saveWhatsapp = async () => {
    try { await api.post('/settings/whatsapp', whatsappSettings); toast.success('WhatsApp settings saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const testWhatsapp = async () => {
    try {
      const res = await api.post('/settings/whatsapp/test');
      toast.success(res.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Test failed'); }
  };

  const savePrefs = async () => {
    try { await api.post('/settings/notifications', notifPrefs); toast.success('Preferences saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const sendDailyReport = async () => {
    try {
      const res = await api.post('/send-daily-report');
      toast.success(res.data.message);
      if (res.data.details) res.data.details.forEach(d => toast.info(d));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleLogoUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/settings/upload-logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="settings-title">Settings</h1>
          <p className="text-muted-foreground">Configure email, WhatsApp, notifications & company settings</p>
        </div>

        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email"><Mail size={14} className="mr-2" />Email (SMTP)</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageCircle size={14} className="mr-2" />WhatsApp</TabsTrigger>
            <TabsTrigger value="notifications"><Bell size={14} className="mr-2" />Notifications</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="backup"><Database size={14} className="mr-2" />Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Email SMTP Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Configure your email server to send notifications. Common providers: Gmail (smtp.gmail.com:587), Outlook (smtp-mail.outlook.com:587), SendGrid (smtp.sendgrid.net:587)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>SMTP Host *</Label><Input value={emailSettings.smtp_host} placeholder="smtp.gmail.com" data-testid="smtp-host" onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })} /></div>
                  <div><Label>SMTP Port</Label><Input type="number" value={emailSettings.smtp_port} data-testid="smtp-port" onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })} /></div>
                  <div><Label>Username / Email *</Label><Input value={emailSettings.username} placeholder="your@email.com" data-testid="smtp-user" onChange={(e) => setEmailSettings({ ...emailSettings, username: e.target.value })} /></div>
                  <div><Label>Password / App Password *</Label><Input type="password" value={emailSettings.password} placeholder="••••••••" data-testid="smtp-pass" onChange={(e) => setEmailSettings({ ...emailSettings, password: e.target.value })} /></div>
                  <div><Label>From Email</Label><Input value={emailSettings.from_email} placeholder="noreply@company.com" onChange={(e) => setEmailSettings({ ...emailSettings, from_email: e.target.value })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={emailSettings.use_tls} onCheckedChange={(v) => setEmailSettings({ ...emailSettings, use_tls: v })} />
                      <Label>Use TLS</Label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveEmail} className="rounded-full" data-testid="save-email">Save Email Settings</Button>
                  <div className="flex gap-2 items-center">
                    <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" className="w-48 h-9" />
                    <Button variant="outline" onClick={testEmailSend} className="rounded-full" data-testid="test-email"><Send size={14} className="mr-2" />Send Test</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">WhatsApp (Twilio) Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Get your Twilio credentials from <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-primary underline">console.twilio.com</a>. Enable WhatsApp sandbox in Twilio first.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Account SID *</Label><Input value={whatsappSettings.account_sid} placeholder="ACxxxxxxxxxx" data-testid="twilio-sid" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, account_sid: e.target.value })} /></div>
                  <div><Label>Auth Token *</Label><Input type="password" value={whatsappSettings.auth_token} placeholder="••••••••" data-testid="twilio-token" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, auth_token: e.target.value })} /></div>
                  <div><Label>WhatsApp Number (from Twilio) *</Label><Input value={whatsappSettings.phone_number} placeholder="+14155238886" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, phone_number: e.target.value })} /></div>
                  <div><Label>Your WhatsApp Number *</Label><Input value={whatsappSettings.recipient_number} placeholder="+971xxxxxxxxx" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, recipient_number: e.target.value })} /></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveWhatsapp} className="rounded-full" data-testid="save-whatsapp">Save WhatsApp Settings</Button>
                  <Button variant="outline" onClick={testWhatsapp} className="rounded-full" data-testid="test-whatsapp"><Send size={14} className="mr-2" />Send Test</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">Choose what notifications to send via email and WhatsApp</p>
                
                <div className="space-y-4">
                  <h3 className="font-medium text-sm flex items-center gap-2"><Mail size={16} />Email Notifications</h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_daily_sales} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_daily_sales: v })} /><Label>Daily Sales Summary</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_document_expiry} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_document_expiry: v })} /><Label>Document Expiry Alerts</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_leave_updates} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_leave_updates: v })} /><Label>Leave Request Updates</Label></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm flex items-center gap-2"><MessageCircle size={16} />WhatsApp Notifications</h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.whatsapp_daily_sales} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, whatsapp_daily_sales: v })} /><Label>Daily Sales Summary</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.whatsapp_document_expiry} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, whatsapp_document_expiry: v })} /><Label>Document Expiry Alerts</Label></div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={savePrefs} className="rounded-full" data-testid="save-prefs">Save Preferences</Button>
                  <Button variant="outline" onClick={sendDailyReport} className="rounded-full" data-testid="send-report"><Send size={14} className="mr-2" />Send Daily Report Now</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Company Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Company Logo (for payslips)</Label>
                  <div className="mt-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
                      <Button variant="outline" className="rounded-full" asChild><span><Upload size={14} className="mr-2" />Upload Logo</span></Button>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Upload your company logo (PNG/JPG). It will appear on payslips and exported documents.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup">
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><Database size={18} />Database Backup</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Download a complete backup of all your data as a JSON file. Save it to OneDrive, Google Drive, or any safe location.</p>
                  <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                    <div className="flex items-start gap-3">
                      <Shield size={20} className="text-success mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">What's included in backup:</p>
                        <p className="text-xs text-muted-foreground mt-1">All users, branches, customers, suppliers, sales, invoices, expenses, employees, salary payments, leaves, documents, categories, cash transfers, items, recurring expenses, settings, and notifications.</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={async () => {
                    try {
                      toast.loading('Generating backup...');
                      const res = await api.get('/backup/database', { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `dataentry_backup_${new Date().toISOString().slice(0,10)}.json`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      toast.dismiss();
                      toast.success('Backup downloaded! Save it to OneDrive or safe location.');
                    } catch { toast.dismiss(); toast.error('Backup failed'); }
                  }} className="rounded-full" data-testid="download-backup-btn">
                    <Download size={18} className="mr-2" />Download Full Backup
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader><CardTitle className="font-outfit">MongoDB Atlas Setup Guide</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">For production deployment, use MongoDB Atlas (free tier available):</p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Go to <a href="https://www.mongodb.com/atlas" target="_blank" rel="noreferrer" className="text-primary underline">mongodb.com/atlas</a> and create a free account</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Create a free cluster (M0 - 512MB free forever)</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Click "Connect" then "Connect your application"</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Copy the connection string</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">5.</span> Set it as MONGO_URL in your deployment environment</li>
                  </ol>
                  <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                    <p className="text-xs text-info">MongoDB Atlas free tier includes automatic daily backups, so your data is always safe!</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
