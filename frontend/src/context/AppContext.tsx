import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserRole, UserSession } from '../types';
import { findNearestMonitoredPlace, getPlacesForZone, MonitoredPlace } from '../utils/operationalZones';
import { playDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';

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
  source: 'citizen_report' | 'sensor_alert' | 'simulation' | 'live_location';
  timestamp?: string;
  report_code?: string;
}

export interface UserLiveLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  nearestPlaceName: string;
  nearestWard: string;
  city: string;
  distanceKm: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  checkedAt: string;
  isGps: boolean;
  advisory: string;
  proximityAlertTriggered?: boolean;
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
  liveLocation: UserLiveLocation | null;
  checkLiveLocation: (manualPlaceName?: string, forceAlert?: boolean) => Promise<UserLiveLocation | null>;
  isLiveTrackingActive: boolean;
  setIsLiveTrackingActive: (active: boolean) => void;
  toggleLiveTracking: () => void;
  liveTrackingStatus: 'active' | 'searching' | 'paused' | 'error';
  proximityThresholdKm: number;
  setProximityThresholdKm: (km: number) => void;
  simulateUserLocation: (placeName: string) => void;
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
  name: 'Manjunath Gowda',
  phone: '+91 94480 55501',
  email: 'manjunath.gowda@gmail.com',
  state: 'Karnataka',
  district: 'Chikkaballapur',
  city: 'Chikkaballapur',
  ward: 'Ward 12',
  ward_no: 'Ward 12',
  ward_name: 'BB Road - Shidlaghatta Circle Underpass Sump (Ward 12)',
  house_no: '#14, Ground Floor, Shidlaghatta Main Road',
  pincode: '562101',
  address: 'Near Shidlaghatta Circle Underpass Sump',
  nearest_spot: 'BB Road - Shidlaghatta Circle Underpass Sump',
  street_id: 28,
  badgeNumber: 'CITIZEN-CKB-01',
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

  // Live location tracking state & continuous GPS engine
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState<boolean>(true);
  const [liveTrackingStatus, setLiveTrackingStatus] = useState<'active' | 'searching' | 'paused' | 'error'>('active');
  const [proximityThresholdKm, setProximityThresholdKm] = useState<number>(1.5);
  const lastAlertTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const [liveLocation, setLiveLocation] = useState<UserLiveLocation | null>(() => {
    const places = getPlacesForZone('Bengaluru');
    const defaultPlace = places[0];
    return {
      latitude: defaultPlace.latitude,
      longitude: defaultPlace.longitude,
      nearestPlaceName: defaultPlace.name,
      nearestWard: defaultPlace.ward_name,
      city: defaultPlace.city,
      distanceKm: 0.15,
      riskLevel: defaultPlace.default_risk,
      checkedAt: new Date().toLocaleTimeString(),
      isGps: false,
      advisory: defaultPlace.advisory,
      proximityAlertTriggered: false
    };
  });

  const toggleLiveTracking = () => {
    setIsLiveTrackingActive(prev => {
      const next = !prev;
      addToast(next ? '🟢 Real-time GPS location tracking resumed' : '⏸️ Real-time GPS tracking paused', 'info');
      return next;
    });
  };

  // Core real-time location evaluator and automatic hazard alert generator
  const processLocationUpdate = (
    lat: number,
    lng: number,
    isGps: boolean,
    accuracy?: number,
    forceAlert: boolean = false
  ): UserLiveLocation => {
    const nearest = findNearestMonitoredPlace(lat, lng, activeCity);
    const nowTime = new Date().toLocaleTimeString();
    const isHazardous = nearest.place.default_risk === 'Critical' || nearest.place.default_risk === 'High';
    const isWithinDangerZone = nearest.distanceKm <= proximityThresholdKm;
    const shouldAlert = forceAlert || (isHazardous && isWithinDangerZone);

    const updated: UserLiveLocation = {
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy ? Math.round(accuracy) : undefined,
      nearestPlaceName: nearest.place.name,
      nearestWard: nearest.place.ward_name,
      city: nearest.place.city,
      distanceKm: nearest.distanceKm,
      riskLevel: nearest.place.default_risk,
      checkedAt: nowTime,
      isGps,
      advisory: nearest.place.advisory,
      proximityAlertTriggered: isHazardous && isWithinDangerZone
    };

    setLiveLocation(updated);
    setLiveTrackingStatus('active');

    if (shouldAlert) {
      const now = Date.now();
      // Throttle loud audio sirens to once every 20 seconds unless explicitly forced
      if (forceAlert || (now - lastAlertTimeRef.current > 20000)) {
        lastAlertTimeRef.current = now;

        // 1. Immediately allocate banner & nowcast to this flood hazard
        setReportedFloodLocation({
          street_name: nearest.place.name,
          ward_name: nearest.place.ward_name,
          city: nearest.place.city,
          severity: nearest.place.default_risk === 'Critical' ? 'red' : 'orange',
          water_depth: nearest.place.default_risk === 'Critical' ? 'Knee Deep (30-45cm)' : 'Ankle Deep (15-20cm)',
          report_type: 'Live GPS Proximity Warning',
          message: `🚨 PROXIMITY HAZARD ALERT: You are ${nearest.distanceKm} km from ${nearest.place.name} (${nearest.place.ward_name}). ${nearest.place.default_risk.toUpperCase()} flood risk detected!`,
          recommendation: nearest.place.advisory,
          source: 'live_location',
          timestamp: nowTime
        });

        // 2. Play pure audible emergency siren tone (NO vibration)
        playDeviceAlertTone(nearest.place.default_risk === 'Critical' ? 'emergency' : 'warning');

        // 3. Trigger native device browser/OS push notification
        triggerDeviceNotification(
          `🚨 LIVE FLOOD PROXIMITY ALERT: ${nearest.place.name}`,
          `Hazard proximity warning: You are ${nearest.distanceKm} km from ${nearest.place.name}. ${nearest.place.default_risk} risk! ${nearest.place.advisory}`
        );

        addToast(
          `🚨 HAZARD IN PROXIMITY: ${nearest.place.name} is ${nearest.distanceKm} km away (${nearest.place.default_risk} Risk). Emergency siren active!`,
          'error'
        );
      }
    }

    return updated;
  };

  // Continuous background GPS tracking via navigator.geolocation.watchPosition
  useEffect(() => {
    if (!isLiveTrackingActive) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setLiveTrackingStatus('paused');
      return;
    }

    if (!('geolocation' in navigator)) {
      setLiveTrackingStatus('error');
      return;
    }

    setLiveTrackingStatus('searching');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        processLocationUpdate(
          pos.coords.latitude,
          pos.coords.longitude,
          true,
          pos.coords.accuracy,
          false
        );
      },
      (err) => {
        console.warn('Geolocation continuous tracking notice:', err);
        setLiveTrackingStatus('error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 10000
      }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isLiveTrackingActive, activeCity, proximityThresholdKm]);

  // Simulate user moving to a specific monitored choke point (for immediate testing)
  const simulateUserLocation = (placeName: string) => {
    const places = getPlacesForZone(activeCity);
    const match = places.find(p => p.name === placeName) || places[0];
    const loc = processLocationUpdate(match.latitude, match.longitude, false, 8, true);
    addToast(`📍 Location simulated at ${match.name}. Live hazard proximity alert triggered!`, 'warning');
    return loc;
  };

  const checkLiveLocation = async (manualPlaceName?: string, forceAlert: boolean = false): Promise<UserLiveLocation | null> => {
    const places = getPlacesForZone(activeCity);

    // If manual place is chosen by user
    if (manualPlaceName) {
      const match = places.find(p => p.name === manualPlaceName) || places[0];
      return processLocationUpdate(match.latitude, match.longitude, false, 10, forceAlert);
    }

    // Direct GPS inquiry
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = processLocationUpdate(
              pos.coords.latitude,
              pos.coords.longitude,
              true,
              pos.coords.accuracy,
              forceAlert
            );
            resolve(loc);
          },
          (err) => {
            console.warn('GPS single reading fallback:', err);
            const defaultPlace = places[0];
            const loc = processLocationUpdate(defaultPlace.latitude, defaultPlace.longitude, false, 25, forceAlert);
            resolve(loc);
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
        );
      } else {
        const defaultPlace = places[0];
        const loc = processLocationUpdate(defaultPlace.latitude, defaultPlace.longitude, false, 25, forceAlert);
        resolve(loc);
      }
    });
  };

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
        liveLocation,
        checkLiveLocation,
        isLiveTrackingActive,
        setIsLiveTrackingActive,
        toggleLiveTracking,
        liveTrackingStatus,
        proximityThresholdKm,
        setProximityThresholdKm,
        simulateUserLocation,
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
