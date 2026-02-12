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
  const [companyInfo, setCompanyInfo] = useState({ company_name: 'Smart Standard Company', address_line1: '', address_line2: '', city: '', country: '', phone: '', email: '', cr_number: '', vat_number: '', vat_enabled: false, vat_rate: 15 });
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const [emailRes, waRes, prefRes, coRes] = await Promise.all([
        api.get('/settings/email').catch(() => ({ data: null })),
        api.get('/settings/whatsapp').catch(() => ({ data: null })),
        api.get('/settings/notifications').catch(() => ({ data: null })),
        api.get('/settings/company').catch(() => ({ data: null })),
      ]);
      if (emailRes.data) setEmailSettings(prev => ({ ...prev, ...emailRes.data }));
      if (waRes.data) setWhatsappSettings(prev => ({ ...prev, ...waRes.data }));
      if (prefRes.data) setNotifPrefs(prev => ({ ...prev, ...prefRes.data }));
      if (coRes.data) setCompanyInfo(prev => ({ ...prev, ...coRes.data }));
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
            <TabsTrigger value="email"><Mail size={14} className="mr-2" />Email</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageCircle size={14} className="mr-2" />WhatsApp</TabsTrigger>
            <TabsTrigger value="notifications"><Bell size={14} className="mr-2" />Alerts</TabsTrigger>
            <TabsTrigger value="import"><Upload size={14} className="mr-2" />Import Data</TabsTrigger>
            <TabsTrigger value="backup"><Database size={14} className="mr-2" />Backup</TabsTrigger>
            <TabsTrigger value="deploy"><Shield size={14} className="mr-2" />Deploy</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
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
            <div className="space-y-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Company Information & Address</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This information appears on letters, payslips, invoices and reports.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Label>Company Name</Label><Input value={companyInfo.company_name} onChange={(e) => setCompanyInfo({ ...companyInfo, company_name: e.target.value })} /></div>
                    <div><Label>Address Line 1</Label><Input value={companyInfo.address_line1} onChange={(e) => setCompanyInfo({ ...companyInfo, address_line1: e.target.value })} placeholder="Building, Street" /></div>
                    <div><Label>Address Line 2</Label><Input value={companyInfo.address_line2} onChange={(e) => setCompanyInfo({ ...companyInfo, address_line2: e.target.value })} placeholder="Area, District" /></div>
                    <div><Label>City</Label><Input value={companyInfo.city} onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })} /></div>
                    <div><Label>Country</Label><Input value={companyInfo.country} onChange={(e) => setCompanyInfo({ ...companyInfo, country: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={companyInfo.phone} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={companyInfo.email} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} /></div>
                    <div><Label>CR Number</Label><Input value={companyInfo.cr_number} onChange={(e) => setCompanyInfo({ ...companyInfo, cr_number: e.target.value })} placeholder="Commercial Registration" /></div>
                    <div><Label>VAT Number</Label><Input value={companyInfo.vat_number} onChange={(e) => setCompanyInfo({ ...companyInfo, vat_number: e.target.value })} /></div>
                    <div className="col-span-2 flex items-center gap-4 p-3 bg-stone-50 rounded-xl border">
                      <Checkbox checked={companyInfo.vat_enabled} onCheckedChange={(v) => setCompanyInfo({ ...companyInfo, vat_enabled: v })} />
                      <Label>Enable VAT Calculation on Dashboard</Label>
                      {companyInfo.vat_enabled && <Input type="number" value={companyInfo.vat_rate} onChange={(e) => setCompanyInfo({ ...companyInfo, vat_rate: e.target.value })} className="w-20 h-8" />}
                      {companyInfo.vat_enabled && <span className="text-sm text-muted-foreground">%</span>}
                    </div>
                  </div>
                  <Button onClick={async () => {
                    try { await api.post('/settings/company', companyInfo); toast.success('Company info saved'); }
                    catch { toast.error('Failed'); }
                  }} className="rounded-xl">Save Company Info</Button>
                </CardContent>
              </Card>
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Company Logo</CardTitle></CardHeader>
                <CardContent>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
                    <Button variant="outline" className="rounded-xl" asChild><span><Upload size={14} className="mr-2" />Upload Logo</span></Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">Appears on payslips, letters and reports.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <div className="space-y-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Import Data from Excel/CSV</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Upload your existing data from Excel (.xlsx) or CSV files. Download the template first, fill in your data, then upload.</p>
                  
                  {['customers', 'suppliers', 'employees', 'items', 'branches', 'sales', 'expenses_import'].map(type => (
                    <div key={type} className="flex items-center justify-between p-4 border rounded-xl hover:bg-stone-50 transition-all">
                      <div>
                        <div className="font-medium capitalize text-sm">{type}</div>
                        <div className="text-xs text-muted-foreground">
                          {type === 'customers' && 'name, phone, email'}
                          {type === 'suppliers' && 'name, category, phone, email, credit_limit'}
                          {type === 'employees' && 'name, document_id, phone, email, position, salary'}
                          {type === 'items' && 'name, unit_price, category'}
                          {type === 'branches' && 'name, location'}
                          {type === 'sales' && 'date, sale_type, amount, discount, payment_mode, notes'}
                          {type === 'expenses_import' && 'date, category, description, amount, payment_mode'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={async () => {
                          try {
                            const res = await api.get(`/import/template/${type}`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([res.data]));
                            const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${type}_template.xlsx`);
                            document.body.appendChild(link); link.click(); link.remove();
                          } catch { toast.error('Failed'); }
                        }}><Download size={14} className="mr-1" />Template</Button>
                        <label className="cursor-pointer">
                          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0]; if (!file) return;
                            try {
                              toast.loading('Importing...');
                              const form = new FormData(); form.append('file', file); form.append('data_type', type);
                              const res = await api.post('/import/data', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                              toast.dismiss();
                              toast.success(res.data.message);
                              if (res.data.errors?.length > 0) toast.warning(`${res.data.errors.length} errors`);
                            } catch (err) { toast.dismiss(); toast.error(err.response?.data?.detail || 'Import failed'); }
                            e.target.value = '';
                          }} />
                          <Button size="sm" className="rounded-xl text-xs" asChild><span><Upload size={14} className="mr-1" />Upload</span></Button>
                        </label>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
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

          <TabsContent value="deploy">
            <div className="space-y-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Deploy to Your Website</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Follow these steps to deploy SSC Track on your own website/server:</p>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 1: Save Code to GitHub</h3>
                      <p className="text-xs text-muted-foreground">In the Emergent chat, click <strong>"Save to Github"</strong> button. This pushes all your code to a GitHub repository.</p>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 2: Setup MongoDB Atlas (Free)</h3>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Go to <a href="https://www.mongodb.com/atlas" target="_blank" rel="noreferrer" className="text-primary underline">mongodb.com/atlas</a></li>
                        <li>Create free account → Create free cluster (M0)</li>
                        <li>Click Connect → Get connection string</li>
                      </ol>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 3: Deploy (Choose One)</h3>
                      <div className="space-y-3 mt-2">
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="font-medium text-xs">Option A: Railway.app (Easiest)</div>
                          <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal">
                            <li>Go to <a href="https://railway.app" target="_blank" rel="noreferrer" className="text-primary underline">railway.app</a> → Sign in with GitHub</li>
                            <li>Click "New Project" → "Deploy from GitHub Repo"</li>
                            <li>Select your repo → Set environment variables</li>
                          </ol>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="font-medium text-xs">Option B: VPS (DigitalOcean/Hetzner)</div>
                          <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal">
                            <li>Get a VPS ($5-10/mo) → Install Docker</li>
                            <li>Clone your GitHub repo</li>
                            <li>Run: docker-compose up</li>
                            <li>Point your domain to the server IP</li>
                          </ol>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="font-medium text-xs">Option C: Your Existing Website</div>
                          <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal">
                            <li>Your hosting needs to support Node.js + Python</li>
                            <li>Upload code via FTP/SSH</li>
                            <li>Install dependencies and run</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 4: Set Environment Variables</h3>
                      <div className="bg-stone-800 text-stone-100 p-3 rounded-lg text-xs font-mono space-y-1 mt-2">
                        <p>MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/ssctrack</p>
                        <p>DB_NAME=ssctrack</p>
                        <p>SECRET_KEY=your-secret-key-here</p>
                        <p>REACT_APP_BACKEND_URL=https://yourdomain.com</p>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-orange-50 border-orange-200">
                      <h3 className="font-semibold text-sm mb-2 text-orange-800">Step 5: Import Your Data</h3>
                      <p className="text-xs text-orange-700">After deploying, go to Settings → Import Data tab to upload your existing data from Excel files.</p>
                    </div>
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
