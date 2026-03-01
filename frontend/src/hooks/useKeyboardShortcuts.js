import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = [
  // Navigation
  { keys: ['ctrl', '1'], action: 'nav', path: '/dashboard', label: 'Dashboard' },
  { keys: ['ctrl', '2'], action: 'nav', path: '/sales', label: 'Sales' },
  { keys: ['ctrl', '3'], action: 'nav', path: '/expenses', label: 'Expenses' },
  { keys: ['ctrl', '4'], action: 'nav', path: '/customers', label: 'Customers' },
  { keys: ['ctrl', '5'], action: 'nav', path: '/suppliers', label: 'Suppliers' },
  { keys: ['ctrl', '6'], action: 'nav', path: '/stock', label: 'Stock' },
  { keys: ['ctrl', '7'], action: 'nav', path: '/employees', label: 'Employees' },
  { keys: ['ctrl', '8'], action: 'nav', path: '/reports', label: 'Reports' },
  { keys: ['ctrl', '9'], action: 'nav', path: '/analytics', label: 'Analytics' },
  // Actions
  { keys: ['ctrl', 'n'], action: 'event', event: 'shortcut:new-sale', label: 'New Sale' },
  { keys: ['ctrl', 'e'], action: 'event', event: 'shortcut:new-expense', label: 'New Expense' },
  { keys: ['ctrl', 'k'], action: 'event', event: 'shortcut:search', label: 'Quick Search' },
  { keys: ['ctrl', 'shift', 'p'], action: 'nav', path: '/cashier-pos', label: 'Open POS' },
  { keys: ['ctrl', 'shift', 'k'], action: 'nav', path: '/kds', label: 'Kitchen Display' },
  { keys: ['ctrl', 'shift', 'n'], action: 'nav', path: '/notifications', label: 'Notifications' },
  { keys: ['ctrl', 'shift', 's'], action: 'nav', path: '/settings', label: 'Settings' },
  { keys: ['ctrl', '/'], action: 'event', event: 'shortcut:help', label: 'Show Shortcuts' },
  { keys: ['escape'], action: 'event', event: 'shortcut:escape', label: 'Close Dialog' },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e) => {
    // Don't trigger inside inputs/textareas
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    for (const shortcut of SHORTCUTS) {
      const needCtrl = shortcut.keys.includes('ctrl');
      const needShift = shortcut.keys.includes('shift');
      const needAlt = shortcut.keys.includes('alt');
      const key = shortcut.keys.filter(k => k !== 'ctrl' && k !== 'shift' && k !== 'alt')[0];

      if (needCtrl !== (e.ctrlKey || e.metaKey)) continue;
      if (needShift !== e.shiftKey) continue;
      if (needAlt !== e.altKey) continue;
      if (e.key.toLowerCase() !== key && e.key !== key) continue;

      e.preventDefault();
      e.stopPropagation();

      if (shortcut.action === 'nav') {
        navigate(shortcut.path);
      } else if (shortcut.action === 'event') {
        window.dispatchEvent(new CustomEvent(shortcut.event));
      }
      return;
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return SHORTCUTS;
}

export { SHORTCUTS };
