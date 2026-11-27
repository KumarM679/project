import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
import {
  OPERATIONAL_ZONES,
  getPlacesForZone,
  findNearestMonitoredPlace
} from '../utils/operationalZones';
import {
  User,
  Smartphone,
  Volume2,
  BellRing,
  MapPin,
  Building2,
  X,
  Radio,
  ArrowRight,
  Phone,
  Mail,
  Sparkles,
  Crosshair,
  Loader2
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginUserSession, addToast, checkLiveLocation } = useApp();

  // Citizen registration form state
  const [name, setName] = useState(user.name !== 'Public Resident / Commuter' && user.name !== 'Public Resident (Guest)' ? user.name : '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [city, setCity] = useState(user.city || 'Bengaluru');
  const [wardName, setWardName] = useState(user.ward || 'Silk Board Junction Low-Lying Underpass');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Update places list when city changes
  useEffect(() => {
    const places = getPlacesForZone(city);
    if (!places.some(p => p.name === wardName)) {
      setWardName(places[0]?.name || '');
    }
  }, [city]);

  // Real-time GPS location detector
  const handleDetectLiveLocation = () => {
    if (!('geolocation' in navigator)) {
      addToast('Geolocation is not supported by your browser', 'warning');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const nearest = findNearestMonitoredPlace(pos.coords.latitude, pos.coords.longitude);
        setCity(nearest.place.city);
        setWardName(nearest.place.name);
        playDeviceAlertTone('chime');
        addToast(`📍 Lively Location Detected: ${nearest.place.name} in ${nearest.place.city} (${nearest.distanceKm} km away)`, 'success');
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        const defaultPlace = getPlacesForZone(city)[0];
        setWardName(defaultPlace.name);
        addToast(`📍 Defaulted to ${defaultPlace.name} in ${city}`, 'info');
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  };

  if (!isOpen) return null;

  const handleCitizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Please enter your full name', 'error');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      addToast('Please enter a valid 10-digit mobile phone number', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const places = getPlacesForZone(city);
      const matchedPlace = places.find(p => p.name === wardName) || places[0];

      const res = await api.registerUser({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: 'citizen',
        city,
        ward_name: `${matchedPlace.name} (${matchedPlace.ward_name})`,
        alerts_enabled: true,
        sound_alerts_enabled: soundAlerts,
        sms_alerts_enabled: smsAlerts
      });

      loginUserSession(res.user);

      // Check live location so alert is immediately active on device
      await checkLiveLocation(matchedPlace.name);

      if (soundAlerts) {
        playDeviceAlertTone('chime');
      }

      if (pushAlerts) {
        triggerDeviceNotification(
          `🚨 JalDrishti Device Alerts Active: ${name}`,
          `Device registered for ${matchedPlace.name} (${city}). Emergency audible sirens armed.`
        );
      }

      addToast(`Device registered! Emergency alerts armed for ${name}.`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Registration failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitizenDemoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await api.loginUser({ preset: 'citizen' });
      loginUserSession(res.user);
      await checkLiveLocation('Silk Board Junction Low-Lying Underpass');
      playDeviceAlertTone('chime');
      addToast(`Logged in as Public Citizen (${res.user.name})`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Demo login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
              जल
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">Public Citizen Alert Settings</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-400/30">
                  Citizen Portal
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Register or update your phone number and device preferences to receive audible flood warnings.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleCitizenSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <Radio className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong>Device Alert Allocation:</strong> Alerts, loud siren warnings, and cell broadcasts will be allocated directly to this device for your chosen corridor.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ananya Rao"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                Mobile Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Operational Zone <span className="text-rose-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
              >
                {OPERATIONAL_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone} (Operational Zone)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-medium text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                Target Monitored Corridor & Underpass Choke Point in {city} <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleDetectLiveLocation}
                disabled={isLocating}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
                title="Detect nearest monitored choke point using browser GPS"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Detecting GPS...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3 h-3 text-blue-600" />
                    <span>📍 Detect My Live Location</span>
                  </>
                )}
              </button>
            </div>
            <select
              value={wardName}
              onChange={(e) => setWardName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
            >
              {getPlacesForZone(city).map((place) => (
                <option key={place.id} value={place.name}>
                  {place.name} ({place.ward_name}) — [{place.default_risk} Risk]
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Exact synchronized monitored places in the <strong>{city} Operational Zone</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
              Active Notification Signals on This Device:
            </span>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Volume2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Audible Siren Alarm on This Device (No Vibration)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={pushAlerts}
                onChange={(e) => setPushAlerts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <BellRing className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <span>Native Browser & OS Push Notifications</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Cell Broadcast & SMS Warning Priority</span>
            </label>
          </div>

          {/* Submit & Quick Demo Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Updating Device...' : 'Save & Arm Alerts'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCitizenDemoLogin}
              disabled={isLoading}
              className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center justify-center gap-1.5"
              title="Instant demo profile (Ananya Rao)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>⚡ Instant Demo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
