import React, { createContext, useContext, useState } from 'react';
import { UserRole, UserSession } from '../types';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export interface ReportedFloodLocation {
  street_name: string;
  ward_name: string;
  city: string;
  severity: 'red' | 'orange' | 'yellow' | string;
  water_depth?: string;
  report_type?: string;
  message?: string;
  recommendation?: string;
  source: 'citizen_report' | 'sensor_alert' | 'simulation';
  timestamp?: string;
  report_code?: string;
}

interface AppContextType {
  portal: 'eoc' | 'public';
  setPortal: (p: 'eoc' | 'public') => void;
  activeCity: string;
  setActiveCity: (city: string) => void;
  user: UserSession;
  setUserRole: (role: UserRole) => void;
  loginUserSession: (userData: UserSession) => void;
  logoutUserSession: () => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  scenario: string;
  setScenario: (sc: string) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  notifications: ToastMessage[];
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  reportedFloodLocation: ReportedFloodLocation | null;
  setReportedFloodLocation: (loc: ReportedFloodLocation | null) => void;
}

const defaultUser: UserSession = {
  id: 2,
  role: 'eoc_chief',
  name: 'Commander R. Sharma',
  phone: '+91 98000 00001',
  email: 'r.sharma@eoc.gov.in',
  city: 'Bengaluru',
  ward: 'Central Command EOC',
  ward_name: 'Central Command EOC',
  badgeNumber: 'NDMA-KA-092',
  alerts_enabled: true,
  sound_alerts_enabled: true,
  sms_alerts_enabled: true,
  isLoggedIn: false
};

const citizenUser: UserSession = {
  id: 1,
  role: 'citizen',
  name: 'Ananya Rao',
  phone: '+91 98765 43210',
  email: 'ananya.rao@gmail.com',
  city: 'Bengaluru',
  ward: 'Majestic & Gandhinagar (Ward 94)',
  ward_name: 'Majestic & Gandhinagar (Ward 94)',
  street_id: 1,
  badgeNumber: 'CITIZEN-KA-01',
  alerts_enabled: true,
  sound_alerts_enabled: true,
  sms_alerts_enabled: true,
  isLoggedIn: false
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portal, setPortalState] = useState<'eoc' | 'public'>(() => {
    return (localStorage.getItem('jaldrishti_portal') as 'eoc' | 'public') || 'public';
  });
  const [activeCity, setActiveCity] = useState<string>('All Cities');
  const [isAuthModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [reportedFloodLocation, setReportedFloodLocation] = useState<ReportedFloodLocation | null>(null);

  // By default, require user login/registration first before showing dashboard
  const [user, setUser] = useState<UserSession>(() => {
    try {
      const isAuthActive = sessionStorage.getItem('jaldrishti_auth_active');
      const savedUser = localStorage.getItem('jaldrishti_user');
      if (isAuthActive === 'true' && savedUser) {
        const parsed = JSON.parse(savedUser);
        return { ...parsed, isLoggedIn: true };
      }
    } catch {}
    const savedPortal = localStorage.getItem('jaldrishti_portal');
    const base = savedPortal === 'eoc' ? defaultUser : citizenUser;
    return { ...base, isLoggedIn: false };
  });

  const setPortal = (p: 'eoc' | 'public') => {
    setPortalState(p);
    localStorage.setItem('jaldrishti_portal', p);
    if (p === 'public') {
      if (user.role !== 'citizen') {
        const citizenProfile: UserSession = {
          ...citizenUser,
          isLoggedIn: user.isLoggedIn
        };
        setUser(citizenProfile);
        localStorage.setItem('jaldrishti_user', JSON.stringify(citizenProfile));
      }
    } else {
      if (user.role === 'citizen') {
        const commanderProfile: UserSession = {
          ...defaultUser,
          isLoggedIn: user.isLoggedIn
        };
        setUser(commanderProfile);
        localStorage.setItem('jaldrishti_user', JSON.stringify(commanderProfile));
      }
    }
  };

  const loginUserSession = (userData: UserSession) => {
    const updated: UserSession = {
      ...userData,
      isLoggedIn: true
    };
    setUser(updated);
    localStorage.setItem('jaldrishti_user', JSON.stringify(updated));
    sessionStorage.setItem('jaldrishti_auth_active', 'true');
    if (userData.role === 'citizen') {
      setPortalState('public');
      localStorage.setItem('jaldrishti_portal', 'public');
    } else {
      setPortalState('eoc');
      localStorage.setItem('jaldrishti_portal', 'eoc');
    }
    if (userData.city && userData.city !== 'All Cities') {
      setActiveCity(userData.city);
    }
    addToast(`Signed in successfully as ${userData.name}!`, 'success');
  };

  const logoutUserSession = () => {
    const guestUser: UserSession = {
      ...citizenUser,
      name: 'Public Resident (Guest)',
      phone: '',
      isLoggedIn: false
    };
    setUser(guestUser);
    localStorage.removeItem('jaldrishti_user');
    sessionStorage.removeItem('jaldrishti_auth_active');
    addToast('Signed out. Please register or sign in to access the dashboard.', 'info');
  };
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
        loginUserSession,
        logoutUserSession,
        isAuthModalOpen,
        setAuthModalOpen,
        scenario,
        setScenario,
        refreshTrigger,
        triggerRefresh,
        notifications,
        addToast,
        removeToast,
        reportedFloodLocation,
        setReportedFloodLocation,
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
