import React, { createContext, useContext, useState } from 'react';
import { UserRole, UserSession } from '../types';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface AppContextType {
  portal: 'eoc' | 'public';
  setPortal: (p: 'eoc' | 'public') => void;
  activeCity: string;
  setActiveCity: (city: string) => void;
  user: UserSession;
  setUserRole: (role: UserRole) => void;
  scenario: string;
  setScenario: (sc: string) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  notifications: ToastMessage[];
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

const defaultUser: UserSession = {
  role: 'eoc_chief',
  name: 'Commander R. Sharma',
  city: 'Bengaluru',
  ward: 'Central Command EOC',
  badgeNumber: 'NDMA-KA-092'
};

const citizenUser: UserSession = {
  role: 'citizen',
  name: 'Public Citizen / Commuter',
  city: 'Bengaluru',
  ward: 'Citywide Monitored Wards',
  badgeNumber: 'CITIZEN-PORTAL'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portal, setPortalState] = useState<'eoc' | 'public'>(() => {
    return (localStorage.getItem('jaldrishti_portal') as 'eoc' | 'public') || 'eoc';
  });
  const [activeCity, setActiveCity] = useState<string>('All Cities');

  const setPortal = (p: 'eoc' | 'public') => {
    setPortalState(p);
    localStorage.setItem('jaldrishti_portal', p);
    if (p === 'public') {
      setUser(citizenUser);
    } else {
      setUser(defaultUser);
    }
  };
  const [user, setUser] = useState<UserSession>(() => {
    const savedPortal = localStorage.getItem('jaldrishti_portal');
    return savedPortal === 'public' ? citizenUser : defaultUser;
  });
  const [scenario, setScenario] = useState<string>('monsoon_heavy');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [notifications, setNotifications] = useState<ToastMessage[]>([
    {
      id: 'init-1',
      message: 'Urban Flood Nowcasting System active: Real-time telemetry connected.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const setUserRole = (role: UserRole) => {
    if (role === 'ward_engineer') {
      setUser({
        role,
        name: 'Er. Praveen Kumar',
        city: 'Bengaluru',
        ward: 'BTM Layout & Silk Board',
        badgeNumber: 'BBMP-EE-104'
      });
      addToast('Switched to Ward Engineer View', 'info');
    } else if (role === 'admin') {
      setUser({
        role,
        name: 'System Admin',
        city: 'All Cities',
        badgeNumber: 'SYS-ROOT-01'
      });
      addToast('Switched to Administrator View', 'info');
    } else {
      setUser(defaultUser);
      addToast('Switched to EOC Commander View', 'info');
    }
  };

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [newToast, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(t => t.id !== newToast.id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setNotifications(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        portal,
        setPortal,
        activeCity,
        setActiveCity,
        user,
        setUserRole,
        scenario,
        setScenario,
        refreshTrigger,
        triggerRefresh,
        notifications,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
