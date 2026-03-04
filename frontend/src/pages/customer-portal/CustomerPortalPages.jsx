import { useEffect, useState } from 'react';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, ShoppingBag, FileText, CreditCard, Gift, LogOut, Store, 
  Calendar, DollarSign, TrendingUp, ChevronRight, RefreshCw, Download,
  Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

function CustomerPortalLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    const customerData = localStorage.getItem('customer_data');
    
    if (!token) {
      navigate('/customer-portal');
      return;
    }
    
    if (customerData) {
      setCustomer(JSON.parse(customerData));
    }
  }, [navigate]);

  const handleLogout = async () => {
    const token = localStorage.getItem('customer_token');
    try {
      await api.post(`/customer-portal/logout?token=${token}`);
    } catch {}
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_data');
    navigate('/customer-portal');
    toast.success('Logged out successfully');
  };

  const navItems = [
    { path: '/customer-portal/dashboard', icon: User, label: 'Overview' },
    { path: '/customer-portal/orders', icon: ShoppingBag, label: 'Orders' },
    { path: '/customer-portal/statements', icon: FileText, label: 'Statements' },
    { path: '/customer-portal/invoices', icon: CreditCard, label: 'Invoices' },
    { path: '/customer-portal/loyalty', icon: Gift, label: 'Loyalty' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <header className="bg-white dark:bg-stone-800 border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Store className="text-white" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-stone-800 dark:text-white">Customer Portal</h1>
              <p className="text-xs text-stone-500">{customer?.name || 'Loading...'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="customer-logout-btn">
            <LogOut size={16} className="mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-stone-800 border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' 
                      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

export function CustomerPortalDashboard() {
  const [profile, setProfile] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const [profileRes, ordersRes] = await Promise.all([
        api.get(`/customer-portal/profile?token=${token}`),
        api.get(`/customer-portal/orders?token=${token}&limit=5`),
      ]);
      setProfile(profileRes.data);
      setRecentOrders(ordersRes.data.orders || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <CustomerPortalLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
        </div>
      </CustomerPortalLayout>
    );
  }

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-white" data-testid="customer-welcome">
            Welcome, {profile?.name}!
          </h2>
          <p className="text-stone-500">Here's your account summary</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600">Credit Balance</p>
                  <p className="text-xl font-bold text-emerald-700" data-testid="credit-balance">
                    SAR {(profile?.credit_balance || 0).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="text-emerald-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600">Loyalty Points</p>
                  <p className="text-xl font-bold text-purple-700" data-testid="loyalty-points">
                    {(profile?.loyalty_points || 0).toLocaleString()}
                  </p>
                </div>
                <Gift className="text-purple-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600">Loyalty Tier</p>
                  <p className="text-xl font-bold text-amber-700" data-testid="loyalty-tier">
                    {profile?.loyalty_tier || 'Bronze'}
                  </p>
                </div>
                <TrendingUp className="text-amber-500" size={24} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600">Member Since</p>
                  <p className="text-lg font-bold text-blue-700">
                    {profile?.member_since ? format(new Date(profile.member_since), 'MMM yyyy') : '-'}
                  </p>
                </div>
                <Calendar className="text-blue-500" size={24} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Link to="/customer-portal/orders">
              <Button variant="ghost" size="sm">
                View All <ChevronRight size={14} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <ShoppingBag className="mx-auto mb-2 text-stone-300" size={32} />
                No orders yet
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="text-emerald-600" size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{order.description || 'Order'}</p>
                        <p className="text-xs text-stone-500">
                          {order.date ? format(new Date(order.date), 'dd MMM yyyy') : '-'} • {order.branch_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">SAR {order.total?.toLocaleString() || 0}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.payment_mode}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerPortalLayout>
  );
}

export function CustomerPortalOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const fetchOrders = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    setLoading(true);
    try {
      const res = await api.get(`/customer-portal/orders?token=${token}&page=${page}&limit=20`);
      setOrders(res.data.orders || []);
      setTotalPages(res.data.total_pages || 1);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-white" data-testid="orders-title">
          Order History
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto mb-3 text-stone-300" size={48} />
              <p className="text-stone-500">No orders found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <ShoppingBag className="text-emerald-600" size={24} />
                        </div>
                        <div>
                          <p className="font-medium">{order.description || `Order #${order.id.slice(-6)}`}</p>
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                            <Calendar size={12} />
                            {order.date ? format(new Date(order.date), 'dd MMM yyyy, h:mm a') : '-'}
                            <span>•</span>
                            {order.branch_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-600">SAR {order.total?.toLocaleString()}</p>
                        <Badge variant={order.payment_mode === 'credit' ? 'secondary' : 'default'}>
                          {order.payment_mode}
                        </Badge>
                      </div>
                    </div>
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-stone-500 mb-2">Items:</p>
                        <div className="flex flex-wrap gap-2">
                          {order.items.map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {item.name || item.item_name} x{item.quantity || 1}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-stone-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </CustomerPortalLayout>
  );
}

export function CustomerPortalStatements() {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchStatement();
  }, []);

  const fetchStatement = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    setLoading(true);
    try {
      let url = `/customer-portal/statements?token=${token}`;
      if (dateRange.start) url += `&start_date=${dateRange.start}`;
      if (dateRange.end) url += `&end_date=${dateRange.end}`;
      
      const res = await api.get(url);
      setStatement(res.data);
    } catch (error) {
      toast.error('Failed to load statement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-stone-800 dark:text-white" data-testid="statements-title">
            Account Statement
          </h2>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="px-3 py-2 border rounded-lg text-sm"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              className="px-3 py-2 border rounded-lg text-sm"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
            <Button size="sm" onClick={fetchStatement}>
              <RefreshCw size={14} className="mr-1" /> Filter
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : (
          <>
            {/* Balance Summary */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">Current Balance</p>
                    <p className="text-3xl font-bold text-emerald-700" data-testid="current-balance">
                      SAR {(statement?.current_balance || 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="text-emerald-300" size={48} />
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {!statement?.transactions || statement.transactions.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    <FileText className="mx-auto mb-2 text-stone-300" size={32} />
                    No transactions found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-stone-50">
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Debit</th>
                          <th className="px-3 py-2 text-right">Credit</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.transactions.map((t, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="px-3 py-2 text-stone-500">
                              {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-3 py-2">{t.description}</td>
                            <td className="px-3 py-2 text-right text-red-600">
                              {t.debit > 0 ? `SAR ${t.debit.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600">
                              {t.credit > 0 ? `SAR ${t.credit.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              SAR {(t.balance || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CustomerPortalLayout>
  );
}

export function CustomerPortalInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await api.get(`/customer-portal/invoices?token=${token}`);
      setInvoices(res.data.invoices || []);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-white" data-testid="invoices-title">
          Invoices
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="mx-auto mb-3 text-stone-300" size={48} />
              <p className="text-stone-500">No invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <FileText className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <p className="font-medium">Invoice #{invoice.invoice_number || invoice.id.slice(-6)}</p>
                        <p className="text-sm text-stone-500">
                          {invoice.date ? format(new Date(invoice.date), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">SAR {invoice.total?.toLocaleString()}</p>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status || 'issued'}
                      </Badge>
                    </div>
                  </div>
                  {invoice.vat > 0 && (
                    <p className="text-xs text-stone-500 mt-2">
                      Includes VAT: SAR {invoice.vat.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}

export function CustomerPortalLoyalty() {
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyalty();
  }, []);

  const fetchLoyalty = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;

    try {
      const res = await api.get(`/customer-portal/loyalty?token=${token}`);
      setLoyalty(res.data);
    } catch (error) {
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <CustomerPortalLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
        </div>
      </CustomerPortalLayout>
    );
  }

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-white" data-testid="loyalty-title">
          Loyalty Program
        </h2>

        {/* Points & Tier */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Your Points</p>
                  <p className="text-4xl font-bold text-purple-700" data-testid="loyalty-points-value">
                    {(loyalty?.current_points || 0).toLocaleString()}
                  </p>
                </div>
                <Gift className="text-purple-300" size={48} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Current Tier</p>
                  <p className="text-4xl font-bold text-amber-700" data-testid="loyalty-tier-value">
                    {loyalty?.current_tier || 'Bronze'}
                  </p>
                  {loyalty?.next_tier && (
                    <p className="text-xs text-amber-600 mt-1">
                      {loyalty.points_to_next_tier} pts to {loyalty.next_tier}
                    </p>
                  )}
                </div>
                <TrendingUp className="text-amber-300" size={48} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier Benefits */}
        {loyalty?.tier_benefits && loyalty.tier_benefits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {loyalty.tier_benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="text-green-500" size={16} />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Points History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Points History</CardTitle>
          </CardHeader>
          <CardContent>
            {!loyalty?.history || loyalty.history.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <Clock className="mx-auto mb-2 text-stone-300" size={32} />
                No points history yet
              </div>
            ) : (
              <div className="space-y-3">
                {loyalty.history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        item.type === 'earn' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {item.type === 'earn' ? (
                          <TrendingUp className="text-green-600" size={14} />
                        ) : (
                          <Gift className="text-red-600" size={14} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.description || (item.type === 'earn' ? 'Points Earned' : 'Points Redeemed')}</p>
                        <p className="text-xs text-stone-500">
                          {item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold ${item.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'earn' ? '+' : '-'}{item.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerPortalLayout>
  );
}

export default CustomerPortalLayout;
