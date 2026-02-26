import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Store, Users, Truck, Receipt, BarChart3, LogOut, Shield, CreditCard, FileText, Tags, UserCheck, FileWarning, Bell, User as UserIcon, Settings, ArrowLeftRight, FileInput, AlertTriangle, Handshake, HelpCircle, Building2, Package, ChefHat, CalendarClock, ArrowDownUp, Activity } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

export const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isEmployee = user.role === 'employee';

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        setUnreadCount(res.data.count);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
    window.location.reload();
  };

  const allNav = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'operator'], perm: 'dashboard' },
    { path: '/pos', icon: ShoppingCart, label: 'Quick Entry', roles: ['admin', 'manager', 'operator', 'employee'], perm: 'sales' },
    { path: '/sales', icon: ShoppingCart, label: 'Sales', roles: ['admin', 'manager', 'operator'], perm: 'sales' },
    { path: '/invoices', icon: FileInput, label: 'Invoices', roles: ['admin', 'manager', 'operator'], perm: 'invoices' },
    { path: '/branches', icon: Store, label: 'Branches', roles: ['admin', 'manager'], perm: 'branches' },
    { path: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'operator'], perm: 'customers' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['admin', 'manager'], perm: 'suppliers' },
    { path: '/supplier-payments', icon: Receipt, label: 'Supplier Payments', roles: ['admin', 'manager'], perm: 'supplier_payments' },
    { path: '/expenses', icon: Receipt, label: 'Expenses', roles: ['admin', 'manager'], perm: 'expenses' },
    { path: '/cash-transfers', icon: ArrowLeftRight, label: 'Cash Transfers', roles: ['admin', 'manager'], perm: 'cash_transfers' },
    { path: '/fines', icon: AlertTriangle, label: 'Fines & Penalties', roles: ['admin', 'manager'], perm: 'fines' },
    { path: '/partners', icon: Handshake, label: 'Partners', roles: ['admin'], perm: 'partners' },
    { path: '/company-loans', icon: Building2, label: 'Company Loans', roles: ['admin'], perm: 'partners' },
    { path: '/bank-statements', icon: FileText, label: 'Bank Statements', roles: ['admin'], perm: 'reports' },
    { path: '/reconciliation', icon: ArrowDownUp, label: 'Reconciliation', roles: ['admin'], perm: 'reports' },
    { path: '/employees', icon: UserCheck, label: 'Employees', roles: ['admin', 'manager'], perm: 'employees' },
    { path: '/stock', icon: Package, label: 'Stock', roles: ['admin', 'manager'], perm: 'stock' },
    { path: '/kitchen', icon: ChefHat, label: 'Kitchen', roles: ['admin', 'manager', 'operator'], perm: 'kitchen' },
    { path: '/schedule', icon: CalendarClock, label: 'Schedule', roles: ['admin', 'manager'], perm: 'shifts' },
    { path: '/documents', icon: FileWarning, label: 'Documents', roles: ['admin', 'manager'], perm: 'documents' },
    { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'manager'], perm: 'reports' },
    { path: '/credit-report', icon: CreditCard, label: 'Credit Report', roles: ['admin', 'manager'], perm: 'credit_report' },
    { path: '/supplier-report', icon: FileText, label: 'Supplier Report', roles: ['admin', 'manager'], perm: 'supplier_report' },
    { path: '/category-report', icon: Tags, label: 'Category Report', roles: ['admin', 'manager'], perm: 'reports' },
    { path: '/settings', icon: Settings, label: 'Settings', roles: ['admin'], perm: 'settings' },
    { path: '/help', icon: HelpCircle, label: 'Help & Guide', roles: ['admin', 'manager', 'operator'] },
    { path: '/users', icon: Shield, label: 'Users', roles: ['admin'], perm: 'users' },
  ];

  const employeeNav = [
    { path: '/my-portal', icon: UserIcon, label: 'My Portal' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
  ];

  const userPerms = user.permissions || [];
  const navItems = isEmployee ? employeeNav : allNav.filter(item => {
    // Admin sees everything
    if (user.role === 'admin') return true;
    // Check role first
    if (item.roles && !item.roles.includes(user.role || 'operator')) return false;
    // If user has custom permissions set, filter by those
    if (userPerms.length > 0 && item.perm) return userPerms.includes(item.perm);
    return true;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-white border-r border-stone-100 fixed h-full overflow-y-auto shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SSC" className="w-11 h-11 rounded-xl object-contain" />
            <div>
              <h1 className="text-lg font-bold font-outfit bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent" data-testid="app-title">SSC Track</h1>
              <p className="text-xs text-stone-400">{isEmployee ? 'Employee Portal' : 'Smart Standard Company'}</p>
            </div>
          </div>
        </div>

        <nav className="px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-l-[3px] border-orange-500 shadow-sm' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {item.label}
                {item.path === '/notifications' && unreadCount > 0 && (
                  <Badge className="ml-auto bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full shadow-sm">{unreadCount}</Badge>
                )}
              </Link>
            );
          })}

          {!isEmployee && (
            <Link to="/leave-approvals" data-testid="nav-leave-approvals"
              className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${location.pathname === '/leave-approvals' ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-l-[3px] border-orange-500 shadow-sm' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'}`}>
              <Bell size={18} strokeWidth={1.8} />
              Leave Approvals
            </Link>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-stone-100 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate" data-testid="user-name">{user.name}</p>
              <p className="text-xs text-stone-400 truncate">{user.email}</p>
            </div>
            <Badge className="bg-orange-50 text-orange-600 border-orange-200 capitalize text-xs">{user.role}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button" className="w-full rounded-xl border-stone-200 text-stone-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all">
            <LogOut size={15} className="mr-2" />Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 bg-gradient-to-br from-[#FDFBF7] to-[#FFF8F0]">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
