import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { api } from './api/client';
import type { Street, DrainageRecord } from './types';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { DrainageModal } from './components/DrainageModal';
import { DeviceAlertBanner } from './components/DeviceAlertBanner';
import { AuthModal } from './components/AuthModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { RainfallPage } from './pages/RainfallPage';
import { FloodMapPage } from './pages/FloodMapPage';
import { StreetRiskAnalysisPage } from './pages/StreetRiskAnalysisPage';
import { DrainagePage } from './pages/DrainagePage';
import { AlertsPage } from './pages/AlertsPage';
import { MunicipalResponsePage } from './pages/MunicipalResponsePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PublicPortalPage } from './pages/PublicPortalPage';
import { LoginPage } from './pages/LoginPage';

export const App: React.FC = () => {
  const { activeCity, refreshTrigger, triggerRefresh, portal, setPortal, user, loginUserSession, isAuthModalOpen, setAuthModalOpen } = useApp();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  const [streetsList, setStreetsList] = useState<Street[]>([]);

  // Modals state
  const [isDrainageModalOpen, setIsDrainageModalOpen] = useState<boolean>(false);
  const [editDrainageRecord, setEditDrainageRecord] = useState<DrainageRecord | null>(null);

  // Navigation target street id
  const [targetStreetId, setTargetStreetId] = useState<number | undefined>(undefined);

  // Fetch streets & active alerts count
  useEffect(() => {
    let isMounted = true;
    api
      .getStreets({ city: activeCity })
      .then((res) => {
        if (isMounted) setStreetsList(res.streets);
      })
      .catch((err) => console.error('Streets fetch error:', err));

    api
      .getAlerts({ city: activeCity, status: 'Active' })
      .then((res) => {
        if (isMounted) setActiveAlertsCount(res.count);
      })
      .catch((err) => console.error('Alerts count fetch error:', err));

    return () => {
      isMounted = false;
    };
  }, [activeCity, refreshTrigger]);

  const handleNavigate = (tab: string, streetId?: number) => {
    if (streetId) {
      setTargetStreetId(streetId);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditDrainage = (record: DrainageRecord) => {
    setEditDrainageRecord(record);
    setIsDrainageModalOpen(true);
  };

  const handleCloseDrainageModal = () => {
    setIsDrainageModalOpen(false);
    setEditDrainageRecord(null);
  };

  // FIRST VIEW: Show Login Page first until user logs in or registers
  if (!user.isLoggedIn) {
    return (
      <div className="min-h-screen w-screen bg-[#070e1e] flex flex-col items-center justify-center font-sans p-4 overflow-y-auto">
        <LoginPage
          onSuccess={() => {
            setCurrentTab('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBack={() => {
            // Guest mode entry
            loginUserSession({
              id: 1,
              role: 'citizen',
              name: 'Public Resident (Guest)',
              phone: '+91 98765 43210',
              email: 'guest@jaldrishti.gov.in',
              city: activeCity === 'All Cities' ? 'Bengaluru' : activeCity,
              ward: 'Majestic & Gandhinagar (Ward 94)',
              ward_name: 'Majestic & Gandhinagar (Ward 94)',
              alerts_enabled: true,
              sound_alerts_enabled: true,
              sms_alerts_enabled: true,
              isLoggedIn: true
            });
            setCurrentTab('dashboard');
          }}
        />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Deep Navy-Blue Civic Tech Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setTargetStreetId(undefined);
          setCurrentTab(tab);
        }}
        activeAlertsCount={activeAlertsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          currentTab={currentTab}
          onOpenDrainageModal={() => {
            setEditDrainageRecord(null);
            setIsDrainageModalOpen(true);
          }}
        />

        {/* Emergency Alert Allocated to Connected Public User Device */}
        <DeviceAlertBanner onNavigate={handleNavigate} />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto pb-12">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigate={handleNavigate}
              onOpenDrainageModal={() => {
                setEditDrainageRecord(null);
                setIsDrainageModalOpen(true);
              }}
            />
          )}

          {currentTab === 'rainfall' && <RainfallPage />}

          {currentTab === 'flood-map' && (
            <FloodMapPage
              onNavigateToRisk={(id) => handleNavigate('risk-analysis', id)}
            />
          )}

          {currentTab === 'risk-analysis' && (
            <StreetRiskAnalysisPage initialStreetId={targetStreetId} />
          )}

          {currentTab === 'drainage' && (
            <DrainagePage
              onOpenCreateModal={() => {
                setEditDrainageRecord(null);
                setIsDrainageModalOpen(true);
              }}
              onEditRecord={handleOpenEditDrainage}
            />
          )}

          {currentTab === 'alerts' && <AlertsPage />}

          {currentTab === 'municipal-response' && (
            <MunicipalResponsePage streetsList={streetsList} />
          )}

          {currentTab === 'analytics' && <AnalyticsPage />}

          {currentTab === 'login' && (
            <LoginPage
              onSuccess={() => handleNavigate('dashboard')}
              onBack={() => handleNavigate('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Floating Toast Notification Stack */}
      <ToastContainer />

      {/* Drainage CRUD Modal */}
      <DrainageModal
        isOpen={isDrainageModalOpen}
        onClose={handleCloseDrainageModal}
        onSuccess={triggerRefresh}
        editRecord={editDrainageRecord}
        streetsList={streetsList}
      />

      {/* User Login & Alert Subscription Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};
