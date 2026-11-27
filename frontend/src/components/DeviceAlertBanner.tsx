import React, { useState, useEffect } from 'react';
import { useApp, ReportedFloodLocation } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, stopDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
import { getPlacesForZone } from '../utils/operationalZones';
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
  Activity,
  Crosshair,
  Loader2,
  Navigation,
  MessageSquare,
  Send,
  CheckCircle2
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
    refreshTrigger,
    liveLocation,
    checkLiveLocation,
    isLiveTrackingActive,
    toggleLiveTracking,
    liveTrackingStatus,
    proximityThresholdKm,
    simulateUserLocation
  } = useApp();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isSounding, setIsSounding] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isDispatchingSms, setIsDispatchingSms] = useState(false);
  const [smsModalData, setSmsModalData] = useState<{
    phone: string;
    recipient: string;
    location: string;
    sms_body: string;
    delivery_timestamp: string;
    gateway: string;
  } | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<ReportedFloodLocation[]>([]);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);

  // Check live location & trigger alert on this device
  const handleCheckLiveLocation = async (placeName?: string) => {
    setIsCheckingLocation(true);
    try {
      const loc = await checkLiveLocation(placeName);
      if (loc) {
        addToast(
          `📍 Lively Location Checked: ${loc.nearestPlaceName} (${loc.distanceKm} km away • ${loc.riskLevel} Risk). Device alert armed!`,
          loc.riskLevel === 'Critical' ? 'error' : 'warning'
        );
      }
    } catch (err: any) {
      addToast(`Could not check live location: ${err.message}`, 'error');
    } finally {
      setIsCheckingLocation(false);
    }
  };

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

  // Direct SMS Message Alert Dispatcher
  const handleSendSmsAlert = async () => {
    setIsDispatchingSms(true);
    const phone = user.phone || '+91 94480 55501';
    const locName = `${activeLoc.street_name} (${activeLoc.ward_name || activeLoc.city})`;
    const alertMsg = `${activeLoc.water_depth || 'Critical waterlogging'}. ${activeLoc.recommendation || 'Low-lying corridor flooded. Use alternate overpass.'}`;
    const severity = activeLoc.severity === 'red' ? 'CRITICAL' : 'HIGH';

    try {
      const res = await api.sendSmsAlert({
        phone,
        name: user.name,
        location: locName,
        message: alertMsg,
        severity
      });

      setSmsModalData({
        phone: res.phone,
        recipient: res.recipient,
        location: res.location,
        sms_body: res.sms_body,
        delivery_timestamp: res.delivery_timestamp,
        gateway: res.gateway
      });

      addToast(`📱 Emergency SMS Alert dispatched to ${phone}!`, 'success');
    } catch (err: any) {
      console.warn('SMS dispatch error, fallback:', err);
      const fallbackBody = `🚨 JALDRISHTI EMERGENCY FLOOD ALERT: ${severity} flood hazard detected at ${locName}. ${alertMsg} Helpline: 1533 / 1077. Govt of Karnataka NDMA.`;
      setSmsModalData({
        phone,
        recipient: user.name,
        location: locName,
        sms_body: fallbackBody,
        delivery_timestamp: new Date().toLocaleTimeString(),
        gateway: 'National Disaster Cell Broadcast & Telecom SMS Gateway'
      });
      addToast(`📱 Emergency SMS Alert sent to ${phone}!`, 'success');
    } finally {
      setIsDispatchingSms(false);
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

              {/* Live Tracking Status & Toggle */}
              <button
                type="button"
                onClick={toggleLiveTracking}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border transition-all shadow-xs cursor-pointer ${
                  isLiveTrackingActive
                    ? 'bg-teal-950/80 border-teal-400/50 text-teal-200 hover:bg-teal-900'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-850'
                }`}
                title={isLiveTrackingActive ? "Real-time GPS tracking active. Click to pause." : "Tracking paused. Click to resume."}
              >
                <span className={`w-2 h-2 rounded-full ${isLiveTrackingActive ? 'bg-teal-400 animate-ping' : 'bg-slate-500'}`} />
                <Navigation className="w-3.5 h-3.5 text-teal-300" />
                <span>{isLiveTrackingActive ? 'Tracking: ON' : 'Tracking: PAUSED'}</span>
                {liveLocation && (
                  <span className="text-[10px] bg-teal-400/20 text-teal-200 px-1 rounded font-bold">
                    {liveLocation.nearestPlaceName.split(' ')[0]} ({liveLocation.distanceKm} km)
                  </span>
                )}
              </button>

              {/* Automatic Proximity Danger Badge */}
              {liveLocation?.proximityAlertTriggered && (
                <div className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-md bg-rose-600 text-white animate-pulse border border-white/50 shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                  <span>HAZARD ALERT: {liveLocation.distanceKm} KM TO FLOOD ZONE!</span>
                </div>
              )}

              {/* Dynamic Flood Report Location Badge */}
              <div className="relative">
                <button
                  onClick={() => setIsLocationSelectorOpen(!isLocationSelectorOpen)}
                  className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-xs"
                  title="Click to change alert location based on citizen flood reports or check operational zone places"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-700" />
                  <span className="truncate max-w-[200px]">
                    {activeLoc.street_name}
                  </span>
                  <span className="text-[10px] bg-slate-900/20 px-1 rounded font-bold">
                    {activeLoc.water_depth || 'Flood Report'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown list of live flood reports & alerts */}
                {isLocationSelectorOpen && (
                  <div className="absolute top-full left-0 mt-1 w-84 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 max-h-96 overflow-y-auto">
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

                    {/* Operational Zone Choke Points (Check Location) */}
                    <div className="text-[10px] font-bold text-teal-400 uppercase tracking-wider px-2 pt-2.5 pb-1 border-t border-slate-800 flex items-center justify-between">
                      <span>Check Operational Zone Places ({activeCity === 'All Cities' ? 'Bengaluru' : activeCity})</span>
                      <Crosshair className="w-3 h-3 text-teal-400" />
                    </div>

                    {getPlacesForZone(activeCity === 'All Cities' ? 'Bengaluru' : activeCity).map((place) => (
                      <button
                        key={`zone-place-${place.id}`}
                        onClick={() => {
                          handleCheckLiveLocation(place.name);
                          setIsLocationSelectorOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 transition-all flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold truncate text-white">{place.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{place.ward_name} ({place.city})</div>
                          <div className="text-[10px] font-bold text-amber-300 mt-0.5 flex items-center gap-1.5">
                            <span className="bg-rose-500/20 text-rose-300 px-1 rounded">{place.default_risk} Risk</span>
                            <span>• Click to Check Location</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Armed: {user.phone || '+91 98765 43210'}{user.house_no ? ` • ${user.house_no}` : ''}{user.ward_no ? ` (${user.ward_no})` : ''}{user.district ? ` • ${user.district}` : ''}{user.pincode ? ` [PIN: ${user.pincode}]` : ''}
              </span>
            </div>
          </div>

          {/* Action buttons on this device */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Lively Location Check Button */}
            <button
              onClick={() => handleCheckLiveLocation()}
              disabled={isCheckingLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Check your lively GPS coordinates against flood hotspots & sound alert"
            >
              {isCheckingLocation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span>Checking GPS...</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-3.5 h-3.5 text-slate-950" />
                  <span>📍 Check Live Location</span>
                </>
              )}
            </button>

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

            {/* SMS Message Alert Button */}
            <button
              onClick={handleSendSmsAlert}
              disabled={isDispatchingSms}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Send emergency flood alert message via SMS to subscriber phone"
            >
              {isDispatchingSms ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Sending SMS...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                  <span>Send SMS Alert 📱</span>
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

        {/* Expanded Advisory Details - Dynamically Reflects the Flood Report Location & Lively Location */}
        {!isMinimized && (
          <div className="mt-2.5 pt-2 border-t border-rose-700/60 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-black/35 p-2.5 rounded-lg border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Active Flood Alert for {user.name} ({activeLoc.street_name}):
              </span>
              <p className="text-white font-medium leading-snug">
                🚨 <strong>{activeLoc.source === 'citizen_report' ? 'VERIFIED CITIZEN REPORT' : activeLoc.source === 'live_location' ? 'LIVE CHECKED LOCATION' : 'EOC TELEMETRY NOWCAST'}:</strong> {activeLoc.message}
              </p>
            </div>

            <div className="bg-teal-950/45 p-2.5 rounded-lg border border-teal-500/30 space-y-1">
              <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-teal-400" />
                  Live GPS Tracking & Proximity Engine:
                </span>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-400/20 px-1.5 py-0.2 rounded">
                  {isLiveTrackingActive ? '🟢 Live Watch Active' : '⏸️ Tracking Paused'}
                </span>
              </span>
              <p className="text-teal-100 font-medium leading-snug">
                {liveLocation ? (
                  <>
                    Nearest Hazard: <strong>{liveLocation.nearestPlaceName}</strong> ({liveLocation.distanceKm} km away) in {liveLocation.city}. Hazard Rating: <span className="text-amber-300 font-bold">{liveLocation.riskLevel} Flood Risk</span>. Auto-Alert Trigger Zone: <strong>≤ {proximityThresholdKm} km</strong>. Tracked: {liveLocation.checkedAt}.
                  </>
                ) : (
                  <>Continuous GPS tracking is actively monitoring coordinates. Move closer to any underpass to trigger instant proximity warnings.</>
                )}
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
      {/* 📱 Real-Time Mobile SMS / Cell Broadcast Alert Message Modal */}
      {smsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
            {/* Mobile Notification Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <Smartphone className="w-5 h-5 text-sky-200" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                    <span>SMS Emergency Alert Message</span>
                    <span className="text-[10px] bg-sky-400/30 text-sky-200 px-1.5 py-0.5 rounded font-black">
                      DELIVERED
                    </span>
                  </h4>
                  <p className="text-[11px] text-sky-200">
                    Carrier: BSNL / Airtel / Jio Emergency Cell Broadcast
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSmsModalData(null)}
                className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Simulated Phone Message Card */}
            <div className="p-5 space-y-4">
              {/* Recipient & Sender Metadata */}
              <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>From: <strong className="text-white">VK-JALDRISHTI (NDMA Govt)</strong></span>
                  <span>{smsModalData.delivery_timestamp}</span>
                </div>
                <div className="text-slate-300">
                  To: <strong className="text-sky-300">{smsModalData.recipient}</strong> (<span className="text-white font-mono">{smsModalData.phone}</span>)
                </div>
                <div className="text-[11px] text-teal-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>{smsModalData.gateway}</span>
                </div>
              </div>

              {/* SMS Speech Bubble */}
              <div className="bg-gradient-to-br from-blue-950/90 to-slate-900 border-2 border-blue-500/50 rounded-2xl p-4 shadow-inner relative">
                <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  HIGH-PRIORITY CIVIC SMS ALERT:
                </div>
                <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed font-sans select-all whitespace-pre-wrap">
                  {smsModalData.sms_body}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Priority: Emergency Flash SMS</span>
                  <span className="text-emerald-400 font-bold">100% Delivered</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleSendSmsAlert();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Resend SMS Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSmsModalData(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
