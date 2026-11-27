import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
  Send
} from 'lucide-react';

interface DeviceAlertBannerProps {
  onNavigate: (tab: string) => void;
}

export const DeviceAlertBanner: React.FC<DeviceAlertBannerProps> = ({ onNavigate }) => {
  const { portal, addToast, user, setAuthModalOpen } = useApp();
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasPlayedInitial, setHasPlayedInitial] = useState(false);
  const [isSounding, setIsSounding] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Play a subtle civic chime when public user view is first opened
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

  const handlePlaySiren = () => {
    if (isSounding) {
      stopDeviceAlertTone();
      setIsSounding(false);
      addToast('Emergency siren silenced', 'info');
    } else {
      setIsSounding(true);
      playDeviceAlertTone('emergency');
      addToast(`🔊 Maximum-Decibel Emergency Siren Sounding on ${user.name}'s Device!`, 'warning');
      setTimeout(() => setIsSounding(false), 4500);
    }
  };

  const handleSendNotification = async () => {
    setIsDispatching(true);
    const wardName = user.ward_name || user.ward || 'Majestic & Gandhinagar (Ward 94)';
    const phone = user.phone || '+91 98765 43210';
    const alertMsg = `🚨 EMERGENCY FLOOD ALERT for ${user.name}: Critical pooling at ${wardName}. Desilting team active. Maintain 20 km/h crawl speed.`;

    try {
      // 1. Dispatch through backend API for logging and cell subscriber queue
      await api.dispatchUserAlert({
        phone,
        name: user.name,
        ward_name: wardName,
        custom_message: alertMsg
      }).catch(err => console.warn('Backend dispatch log:', err));

      // 2. Audible tone if enabled
      if (user.sound_alerts_enabled !== false) {
        playDeviceAlertTone('warning');
      }

      // 3. Trigger native browser push notification
      const success = await triggerDeviceNotification(
        `🚨 JalDrishti Device Alert: ${user.name}`,
        alertMsg
      );

      if (success) {
        addToast(`🔔 Emergency Alert dispatched directly to ${user.name} (${phone})!`, 'success');
      } else {
        addToast(`Alert sent to ${phone}! Allow browser notifications for background popups.`, 'info');
      }
    } catch (err: any) {
      addToast(`Dispatch issue: ${err.message}`, 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <aside aria-label="Emergency Flood Advisory" className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white shadow-md border-b-2 border-rose-500 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Header & Status Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
            <span className="p-1.5 rounded-lg bg-rose-600/90 text-white animate-pulse flex-shrink-0 shadow-sm">
              <Radio className="w-4 h-4" />
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider bg-rose-500/40 border border-rose-300/40 px-2 py-0.5 rounded text-rose-100 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-amber-300" />
                Alert Allocated to: <strong className="text-white underline decoration-amber-400">{user.name}</strong>
              </span>

              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Device: Armed ({user.phone || '+91 98765 43210'})
              </span>

              <span className="text-xs font-bold text-amber-200 truncate hidden md:inline">
                {user.ward_name || user.ward || 'Majestic KSR Railway Underpass'}
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
              title="Test emergency loud alarm siren on this device"
            >
              {isSounding ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Silence Siren ✕</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>Sound Loud Siren 🔊</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold bg-rose-700/60 hover:bg-rose-700 text-rose-100 border border-rose-400/40 shadow-xs transition-colors"
              title="Edit alert subscription profile & phone number"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden md:inline">Alert Profile</span>
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

        {/* Expanded Advisory Details */}
        {!isMinimized && (
          <div className="mt-2.5 pt-2 border-t border-rose-700/60 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/10 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                Live Message Alert Allocated to {user.name} ({user.phone || 'This Device'}):
              </span>
              <p className="text-white font-medium leading-snug">
                🚨 <strong>EOC COMMANDER LIVE EMERGENCY ADVISORY:</strong> MODERATE RISK at {user.ward_name || user.ward || 'Majestic KSR Railway Underpass'} — Minor curb pooling expected at low spots. Ward desilting crew on watch.
              </p>
            </div>

            <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Recommended Commuter Action & Detour:
              </span>
              <p className="text-emerald-100 font-medium leading-snug">
                Maintain 20 km/h crawl speed. Avoid curbside pooling near {user.ward_name ? user.ward_name.split('(')[0] : 'Majestic'} low points. Take elevated corridors if storm water accumulates.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
