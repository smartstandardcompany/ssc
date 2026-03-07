import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores';

const VisibilityContext = createContext({
  hide_financials: false,
  hide_profit: false,
  hide_analytics: false,
  hide_reports: false,
  hide_supplier_credit: false,
  hide_employee_salary: false,
  loaded: false,
});

export function VisibilityProvider({ children }) {
  const { user } = useAuthStore();
  const [visibility, setVisibility] = useState({
    hide_financials: false,
    hide_profit: false,
    hide_analytics: false,
    hide_reports: false,
    hide_supplier_credit: false,
    hide_employee_salary: false,
    loaded: false,
  });

  useEffect(() => {
    if (!user) return;
    api.get('/access-policies/my-visibility')
      .then(res => setVisibility({ ...res.data, loaded: true }))
      .catch(() => setVisibility(prev => ({ ...prev, loaded: true })));
  }, [user]);

  return (
    <VisibilityContext.Provider value={visibility}>
      {children}
    </VisibilityContext.Provider>
  );
}

export function useVisibility() {
  return useContext(VisibilityContext);
}
