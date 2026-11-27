import React, { useState, useEffect } from 'react';
import { useApp, ReportedFloodLocation } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, stopDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
import {
  Radio,
  Volume2,
  VolumeX,
  BellRing,
  Smartphone,
  ChevronDown,
  ChevronUp,
  MapPin,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  Camera,
  Activity
} from 'lucide-react';

interface DeviceAlertBannerProps {
  onNavigate: (tab: string) => void;
}

export const DeviceAlertBanner: React.FC<DeviceAlertBannerProps> = ({ onNavigate }) => {
  const {
    portal,
    addToast,
    user,
    setAuthModalOpen,
    reportedFloodLocation,
    setReportedFloodLocation,
    activeCity,
    refreshTrigger
  } = useApp();

  const [isMinimized, setIsMinimized] = useState(false);
  const [hasPlayedInitial, setHasPlayedInitial] = useState(false);
  const [isSounding, setIsSounding] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<ReportedFloodLocation[]>([]);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);

  // Fetch flood reports & active alerts to dynamically populate the alert location
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.getCitizenReports({ city: activeCity }).catch(() => ({ reports: [] })),
      api.getAlerts({ city: activeCity }).catch(() => ({ alerts: [] }))
    ]).then(([repRes, alertRes]) => {
      if (!isMounted) return;

      const list: ReportedFloodLocation[] = [];

      // 1. Add citizen crowdsourced reports (most urgent ground truth)
      if (repRes.reports && repRes.reports.length > 0) {
        repRes.reports.forEach((r: any) => {
          list.push({
            street_name: r.street_name,
            ward_name: r.ward_name,
            city: r.city,
            severity: r.water_depth?.toLowerCase().includes('waist') || r.water_depth?.toLowerCase().includes('deep') ? 'red' : 'orange',
            water_depth: r.water_depth,
            report_type: r.report_type,
            message: `📸 CITIZEN FLOOD REPORT: ${r.report_type} (${r.water_depth}) reported by ${r.citizen_name || 'Resident'}: ${r.description || 'Water accumulation obstructing traffic.'}`,
            recommendation: `High water depth detected. Divert around ${r.street_name} and use designated detour corridors.`,
            source: 'citizen_report',
            timestamp: r.created_at || 'Just Now',
            report_code: r.report_code
          });
        });
      }

      // 2. Add active flood alerts from hydrological telemetry
      if (alertRes.alerts && alertRes.alerts.length > 0) {
        alertRes.alerts.forEach((a: any) => {
          list.push({
            street_name: a.street_name,
            ward_name: a.ward_name,
            city: a.city,
            severity: a.severity || 'orange',
            water_depth: `${a.water_level_cm || 35} cm water depth`,
            report_type: 'Telemetry Flood Alert',
            message: `🚨 EOC NOWCAST ADVISORY (${a.severity?.toUpperCase() || 'MODERATE'}): ${a.message || 'Storm runoff accumulation across lanes.'}`,
            recommendation: a.recommended_action || 'Proceed at 20 km/h crawl speed or use elevated overpass.',
            source: 'sensor_alert',
            timestamp: a.alert_time || 'Live Nowcast',
            report_code: a.alert_code
          });
        });
      }

      // Default fallback location if no reports exist in this city
      if (list.length === 0) {
        list.push({
          street_name: user.ward_name ? user.ward_name.split('(')[0].trim() : 'Majestic KSR Railway Underpass',
          ward_name: user.ward_name || 'Central Ward 94',
          city: activeCity === 'All Cities' ? 'Bengaluru' : activeCity,
          severity: 'yellow',
          water_depth: 'Ankle Deep (15-20cm)',
          report_type: 'Baseline Watch Corridor',
          message: 'MODERATE RISK: Minor curb pooling expected during heavy monsoon downpours.',
          recommendation: 'Maintain cautious speed and avoid curbside low depressions.',
          source: 'sensor_alert',
          timestamp: 'Standard Watch'
        });
      }

      setAvailableLocations(list);

      // Automatically update alert location by the latest flood report if not explicitly pinned
      if (!reportedFloodLocation || list.length > 0) {
        // If current selection is not in the new list, pick the most recent/severe report
        const currentStillValid = reportedFloodLocation && list.some(l => l.street_name === reportedFloodLocation.street_name);
        if (!currentStillValid) {
          setReportedFloodLocation(list[0]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeCity, refreshTrigger]);

  // Subtle audio chime on initial citizen portal opening
  useEffect(() => {
    if (portal === 'public' && !hasPlayedInitial) {
      setHasPlayedInitial(true);
      if (user.sound_alerts_enabled !== false) {
        playDeviceAlertTone('chime');
      }
    }
  }, [portal, hasPlayedInitial, user.sound_alerts_enabled]);

  if (portal !== 'public') {
    return null;
  }

  // Active flood report details
  const activeLoc: ReportedFloodLocation = reportedFloodLocation || availableLocations[0] || {
    street_name: 'Majestic KSR Railway Underpass',
    ward_name: 'Ward 94 Corridor',
    city: 'Bengaluru',
    severity: 'orange',
    water_depth: 'Knee Deep (30-45cm)',
    report_type: 'Waterlogged Road',
    message: 'MODERATE RISK: Water accumulation detected at underpass low spots.',
    recommendation: 'Crawl speed 20 km/h or detour via elevated flyover.',
    source: 'sensor_alert',
    timestamp: 'Live'
  };

  const handlePlaySiren = () => {
    if (isSounding) {
      stopDeviceAlertTone();
      setIsSounding(false);
      addToast('Emergency alarm silenced', 'info');
    } else {
      setIsSounding(true);
      // Play pure audible siren tone - NO vibration
      playDeviceAlertTone('emergency');
      addToast(`🔊 Audible Emergency Siren Sounding for ${activeLoc.street_name}!`, 'warning');
      setTimeout(() => setIsSounding(false), 4400);
    }
  };

  const handleSendNotification = async () => {
    setIsDispatching(true);
    const phone = user.phone || '+91 98765 43210';
    const alertMsg = `🚨 EMERGENCY FLOOD ALERT: ${activeLoc.water_depth || 'Critical waterlogging'} at ${activeLoc.street_name} (${activeLoc.ward_name}). ${activeLoc.recommendation}`;

    try {
      // 1. Dispatch through backend API for logging
      await api.dispatchUserAlert({
        phone,
        name: user.name,
        ward_name: `${activeLoc.street_name} - ${activeLoc.ward_name}`,
        custom_message: alertMsg
      }).catch(err => console.warn('Backend dispatch:', err));

      // 2. Play warning audible tone
      if (user.sound_alerts_enabled !== false) {
        playDeviceAlertTone('warning');
      }

      // 3. Trigger native browser push notification
      const success = await triggerDeviceNotification(
        `🚨 JalDrishti Device Alert: ${activeLoc.street_name}`,
        alertMsg
      );

      if (success) {
        addToast(`🔔 Emergency notification dispatched for ${activeLoc.street_name} to ${user.name} (${phone})!`, 'success');
      } else {
        addToast(`Alert sent for ${activeLoc.street_name} to ${phone}!`, 'info');
      }
    } catch (err: any) {
      addToast(`Dispatch issue: ${err.message}`, 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  const isCritical = activeLoc.severity === 'red';

  return (
    <aside aria-label="Emergency Flood Advisory" className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 text-white shadow-md border-b-2 border-rose-500 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Header & Status Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
            <span className={`p-1.5 rounded-lg text-white shadow-sm flex-shrink-0 animate-pulse ${isCritical ? 'bg-red-600' : 'bg-rose-600'}`}>
              <Radio className="w-4 h-4" />
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider bg-rose-500/40 border border-rose-300/40 px-2 py-0.5 rounded text-rose-100 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-amber-300" />
                Alert Allocated to: <strong className="text-white underline decoration-amber-400">{user.name}</strong>
              </span>

              {/* Dynamic Flood Report Location Badge */}
              <div className="relative">
                <button
                  onClick={() => setIsLocationSelectorOpen(!isLocationSelectorOpen)}
                  className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-xs"
                  title="Click to change alert location based on citizen flood reports"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-700" />
                  <span className="truncate max-w-[220px]">
                    {activeLoc.street_name}
                  </span>
                  <span className="text-[10px] bg-slate-900/20 px-1 rounded font-bold">
                    {activeLoc.water_depth || 'Flood Report'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown list of live flood reports & alerts */}
                {isLocationSelectorOpen && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 max-h-80 overflow-y-auto">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between border-b border-slate-800">
                      <span>Live Flood Reports & Hotspots</span>
                      <span className="text-amber-400">{availableLocations.length} active</span>
                    </div>

                    {availableLocations.map((loc, idx) => (
                      <button
                        key={`${loc.street_name}-${idx}`}
                        onClick={() => {
                          setReportedFloodLocation(loc);
                          setIsLocationSelectorOpen(false);
                          addToast(`Alert location changed to ${loc.street_name}`, 'info');
                          playDeviceAlertTone('chime');
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start gap-2 ${
                          activeLoc.street_name === loc.street_name
                            ? 'bg-rose-900/60 text-white border border-rose-500'
                            : 'hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        {loc.source === 'citizen_report' ? (
                          <Camera className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold truncate text-white">{loc.street_name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{loc.ward_name} ({loc.city})</div>
                          <div className="text-[10px] font-bold text-amber-300 mt-0.5">
                            {loc.water_depth || loc.report_type} • {loc.timestamp}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Armed: {user.phone || '+91 98765 43210'}
              </span>
            </div>
          </div>

          {/* Action buttons on this device */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePlaySiren}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black shadow-md transition-all active:scale-95 ${
                isSounding
                  ? 'bg-rose-500 text-white animate-pulse border border-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
              title="Test audible siren alarm on this device (No vibration)"
            >
              {isSounding ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Silence Sound ✕</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>Sound Alarm 🔊</span>
                </>
              )}
            </button>

            <button
              onClick={handleSendNotification}
              disabled={isDispatching}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-xs transition-transform active:scale-95"
              title="Dispatch emergency alert directly to this subscriber device"
            >
              <BellRing className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Push Alert</span>
            </button>

            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold bg-rose-800/70 hover:bg-rose-800 text-rose-100 border border-rose-500/40 shadow-xs transition-colors"
              title="Edit alert subscription profile & phone number"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden md:inline">Alert Settings</span>
            </button>

            <button
              onClick={() => onNavigate('alerts')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs transition-colors"
              title="View all municipal flood risk advisories"
            >
              <span className="hidden sm:inline">Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-md text-rose-200 hover:text-white hover:bg-white/10 transition-colors"
              title={isMinimized ? 'Expand full alert message' : 'Minimize alert banner'}
            >
              {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Advisory Details - Dynamically Reflects the Flood Report Location */}
        {!isMinimized && (
          <div className="mt-2.5 pt-2 border-t border-rose-700/60 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div className="bg-black/35 p-2.5 rounded-lg border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Active Flood Report Allocated to {user.name} ({activeLoc.street_name}):
              </span>
              <p className="text-white font-medium leading-snug">
                🚨 <strong>{activeLoc.source === 'citizen_report' ? 'VERIFIED CITIZEN REPORT' : 'EOC TELEMETRY NOWCAST'}:</strong> {activeLoc.message}
              </p>
            </div>

            <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Recommended Commuter Action & Detour:
              </span>
              <p className="text-emerald-100 font-medium leading-snug">
                {activeLoc.recommendation}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
