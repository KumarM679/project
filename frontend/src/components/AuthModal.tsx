import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
import {
  OPERATIONAL_ZONES,
  getPlacesForZone,
  findNearestMonitoredPlace,
  ZONE_LOCATION_METADATA,
  INDIAN_STATES
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
  Crosshair,
  Loader2,
  Home,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginUserSession, addToast, checkLiveLocation } = useApp();

  // Form State
  const [name, setName] = useState(
    user.name !== 'Public Resident / Commuter' && user.name !== 'Public Resident (Guest)' ? user.name : ''
  );
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');

  // Detailed Location State
  const [city, setCity] = useState(user.city || 'Chikkaballapur');
  const [state, setState] = useState(user.state || 'Karnataka');
  const [district, setDistrict] = useState(user.district || 'Chikkaballapur');
  const [wardNo, setWardNo] = useState(user.ward_no || 'Ward 12');
  const [wardName, setWardName] = useState(user.ward_name || 'BB Road - Shidlaghatta Circle Underpass Sump');
  const [houseNo, setHouseNo] = useState(user.house_no || '');
  const [pincode, setPincode] = useState(user.pincode || '562101');
  const [address, setAddress] = useState(user.address || '');

  // Alert preferences
  const [soundAlerts, setSoundAlerts] = useState(user.sound_alerts_enabled !== false);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(user.sms_alerts_enabled !== false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Sync with current user whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setName(user.name !== 'Public Resident / Commuter' && user.name !== 'Public Resident (Guest)' ? user.name : '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setCity(user.city || 'Chikkaballapur');
      setState(user.state || 'Karnataka');
      setDistrict(user.district || 'Chikkaballapur');
      setWardNo(user.ward_no || 'Ward 12');
      setWardName(user.ward_name || 'BB Road - Shidlaghatta Circle Underpass Sump');
      setHouseNo(user.house_no || '');
      setPincode(user.pincode || '562101');
      setAddress(user.address || '');
    }
  }, [isOpen, user]);

  // Auto-sync location metadata when City changes
  useEffect(() => {
    const meta = ZONE_LOCATION_METADATA[city];
    if (meta) {
      if (!user.state || user.city !== city) setState(meta.state);
      if (!user.district || user.city !== city) setDistrict(meta.district);
      if (!user.pincode || user.city !== city) setPincode(meta.defaultPincode);
      if (!user.ward_no || user.city !== city) setWardNo(meta.defaultWardNo);
    }
    const places = getPlacesForZone(city);
    if (!places.some((p) => p.name === wardName)) {
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
        const meta = ZONE_LOCATION_METADATA[nearest.place.city];
        if (meta) {
          setState(meta.state);
          setDistrict(meta.district);
          setPincode(meta.defaultPincode);
          setWardNo(meta.defaultWardNo);
        }
        addToast(
          `📍 Lively Location Detected: ${nearest.place.name} in ${nearest.place.city} (${nearest.distanceKm} km away)`,
          'success'
        );
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      const matchedPlace = places.find((p) => p.name === wardName) || places[0];

      const res = await api.registerUser({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: 'citizen',
        state: state.trim() || 'Karnataka',
        district: district.trim() || city,
        city: city.trim(),
        ward_no: wardNo.trim() || 'Ward 12',
        ward_name: `${matchedPlace.name} (${wardNo || matchedPlace.ward_name})`,
        house_no: houseNo.trim(),
        pincode: pincode.trim(),
        address: address.trim(),
        nearest_spot: matchedPlace.name,
        street_id: matchedPlace.id,
        alerts_enabled: true,
        sound_alerts_enabled: soundAlerts,
        sms_alerts_enabled: smsAlerts
      });

      loginUserSession(res.user);
      await checkLiveLocation(matchedPlace.name, false, true);

      addToast(`Location and alert subscription profile updated successfully!`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Profile update failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const currentZoneMeta = ZONE_LOCATION_METADATA[city] || ZONE_LOCATION_METADATA['Chikkaballapur'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg">
              जल
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-xl tracking-tight text-white">Resident Location & Siren Settings</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/25 text-blue-300 border border-blue-400/30">
                  Civic Profile
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Manage your address details (State, District, City, Ward No, House No, PIN) and audible sirens.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Active Corridor Telemetry:</strong> Flood warnings and loud sirens are calculated using terrain slope and drainage bottlenecks nearest to your registered address.
            </div>
          </div>

          {/* Personal Info */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Resident Identity
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Manjunath Gowda"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
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
                  placeholder="+91 94480 55501"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-medium text-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="border border-blue-200 rounded-2xl p-4 bg-blue-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                Residential Location (District, State, City, House No, PIN Code, Ward)
              </span>
              <button
                type="button"
                onClick={handleDetectLiveLocation}
                disabled={isLocating}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-blue-300 transition-all cursor-pointer"
                title="Detect GPS location"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Detecting...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3 h-3 text-blue-600" />
                    <span>📍 GPS Fill</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  State <span className="text-rose-500">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  District <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Chikkaballapur or Bengaluru Urban"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  City / Operational Zone <span className="text-rose-500">*</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-bold bg-white text-slate-900"
                >
                  {OPERATIONAL_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone} (Operational Zone)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 562101"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ward No / Division <span className="text-rose-500">*</span>
                </label>
                <select
                  value={wardNo}
                  onChange={(e) => setWardNo(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
                >
                  {currentZoneMeta.wards.map((w) => (
                    <option key={w.wardNo} value={w.wardNo}>
                      {w.wardNo} - {w.wardName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Home className="w-3.5 h-3.5 text-blue-600" />
                  House No / Flat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  placeholder="e.g. #24/A, Ground Floor"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Street Address / Landmark (Optional)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Near Shidlaghatta Circle Underpass Sump, Main Road"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-medium text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Target Monitored Corridor in {city} <span className="text-rose-500">*</span>
              </label>
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
            </div>
          </div>

          {/* Active Alert Signals */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
              Active Sirens & Notifications:
            </span>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Volume2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Audible Siren Alarm (Piercing Loudness, No Vibration)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Cell Broadcast & SMS Priority</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? 'Saving...' : 'Save & Arm Siren Settings'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
