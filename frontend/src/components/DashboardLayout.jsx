import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Store, Users, Truck, Receipt, BarChart3, LogOut, Shield, CreditCard, FileText, Tags, UserCheck, FileWarning, Bell, User as UserIcon } from 'lucide-react';
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

  const adminNav = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/sales', icon: ShoppingCart, label: 'Sales' },
    { path: '/branches', icon: Store, label: 'Branches' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers' },
    { path: '/supplier-payments', icon: Receipt, label: 'Supplier Payments' },
    { path: '/expenses', icon: Receipt, label: 'Expenses' },
    { path: '/employees', icon: UserCheck, label: 'Employees' },
    { path: '/documents', icon: FileWarning, label: 'Documents' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/credit-report', icon: CreditCard, label: 'Credit Report' },
    { path: '/supplier-report', icon: FileText, label: 'Supplier Report' },
    { path: '/category-report', icon: Tags, label: 'Category Report' },
    { path: '/users', icon: Shield, label: 'Users', adminOnly: true },
  ];

  const employeeNav = [
    { path: '/my-portal', icon: UserIcon, label: 'My Portal' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
  ];

  const navItems = isEmployee ? employeeNav : adminNav;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-card border-r border-border fixed h-full overflow-y-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary font-outfit" data-testid="app-title">DataEntry Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">{isEmployee ? 'Employee Portal' : 'Sales & Expense Tracker'}</p>
        </div>

        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            if (item.adminOnly && user.role !== 'admin') return null;
            return (
              <Link key={item.path} to={item.path} data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary hover:text-foreground'}`}>
                <Icon size={18} strokeWidth={2} />
                {item.label}
                {item.path === '/notifications' && unreadCount > 0 && (
                  <Badge className="ml-auto bg-error text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">{unreadCount}</Badge>
                )}
              </Link>
            );
          })}

          {/* Leave Approvals for admin */}
          {!isEmployee && (
            <Link to="/leave-approvals" data-testid="nav-leave-approvals"
              className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${location.pathname === '/leave-approvals' ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary hover:text-foreground'}`}>
              <Bell size={18} strokeWidth={2} />
              Leave Approvals
            </Link>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium" data-testid="user-name">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize text-xs">{user.role}</Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button" className="w-full">
            <LogOut size={16} className="mr-2" />Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
