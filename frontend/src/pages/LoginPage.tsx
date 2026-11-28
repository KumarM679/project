import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { setMuteAllAudio, stopDeviceAlertTone } from '../utils/soundAlert';
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
  Radio,
  ArrowRight,
  Phone,
  Mail,
  ArrowLeft,
  Crosshair,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBack }) => {
  const { user, loginUserSession, addToast, checkLiveLocation } = useApp();

  // Mode: 'signin' (Log In) vs 'signup' (Register with full location)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign In State
  const [loginIdentifier, setLoginIdentifier] = useState(user.phone || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up / Registration State
  const [name, setName] = useState(
    user.name !== 'Public Resident / Commuter' && user.name !== 'Public Resident (Guest)' ? user.name : ''
  );
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');

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
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Strictly mute and silence all audio while on the login page
  useEffect(() => {
    setMuteAllAudio(true);
    stopDeviceAlertTone();
    return () => {
      setMuteAllAudio(false);
    };
  }, []);

  // Auto-sync location metadata when City / Operational Zone changes
  useEffect(() => {
    const meta = ZONE_LOCATION_METADATA[city];
    if (meta) {
      setState(meta.state);
      setDistrict(meta.district);
      setPincode(meta.defaultPincode);
      setWardNo(meta.defaultWardNo);
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
          `📍 Lively Location Detected: ${nearest.place.name} in ${nearest.place.city}, ${meta?.district || ''} (${nearest.distanceKm} km away)`,
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

  // Sign In / Log In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      addToast('Please enter your Registered Mobile Phone Number or Email', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.loginUser({
        identifier: loginIdentifier.trim(),
        phone: loginIdentifier.trim(),
        email: loginIdentifier.trim(),
        password: loginPassword.trim() || undefined
      });

      loginUserSession(res.user);

      // Silently initialize live location coordinates without blasting alarm or sound
      const targetSpot = res.user.nearest_spot || res.user.ward_name || res.user.ward || 'BB Road - Shidlaghatta Circle Underpass Sump';
      await checkLiveLocation(targetSpot, false, true);

      setMuteAllAudio(false);
      addToast(`Signed in successfully as ${res.user.name}!`, 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.message || 'Login failed. Please check your credentials or create an account.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up / Registration Handler with Full Location Details
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Please enter your Full Name', 'error');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      addToast('Please enter a valid 10-digit mobile phone number', 'error');
      return;
    }
    if (!houseNo.trim()) {
      addToast('Please enter your House / Flat / Building No', 'warning');
    }

    setIsLoading(true);
    try {
      const places = getPlacesForZone(city);
      const matchedPlace = places.find((p) => p.name === wardName) || places[0];

      const res = await api.registerUser({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: password.trim() || 'preset',
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

      // Silently arm live location without triggering sirens on registration
      await checkLiveLocation(matchedPlace.name, false, true);

      setMuteAllAudio(false);
      addToast(
        `Registered successfully! Alert telemetry active for ${houseNo ? houseNo + ', ' : ''}${city} (${pincode}).`,
        'success'
      );
      onSuccess();
    } catch (err: any) {
      addToast(err.message || 'Registration failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const currentZoneMeta = ZONE_LOCATION_METADATA[city] || ZONE_LOCATION_METADATA['Chikkaballapur'];

  return (
    <div className="min-h-full py-8 px-4 flex items-center justify-center font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden transition-all">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider bg-amber-400/15 border border-amber-400/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-ping" />
              Public Citizen Emergency Flood Alert System
            </span>
            {user.isLoggedIn && (
              <button
                onClick={onBack}
                className="text-xs text-slate-300 hover:text-teal-300 transition-colors font-bold underline flex items-center gap-1 cursor-pointer"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl flex-shrink-0">
              जल
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-2xl tracking-tight text-white">JalDrishti Civic Portal</h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/25 text-blue-300 border border-blue-400/30">
                  Citizen Edition
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Connect your device to receive real-time audible flood sirens, waterlogging depth nowcasts & localized detour alerts.
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs (Sign In vs Sign Up) */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setAuthMode('signin')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Sign In (Existing Resident)</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Sign Up (Full Location Register)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: SIGN IN (LOG IN) PAGE                                             */}
        {/* ========================================================================= */}
        {authMode === 'signin' && (
          <form onSubmit={handleSignIn} className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Registered Device Access:</strong> Sign in with your registered mobile phone number or email to arm your device with live siren telemetry and receive notifications for your local ward.
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Mobile Phone Number or Registered Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. +91 94480 55501 or citizen@example.com"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold text-slate-900 bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the phone number or email you used when creating your resident flood alert account.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    Security PIN / Password (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400">Leave blank for quick SMS OTP access</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter 4-digit PIN or password (or leave empty)"
                    className="w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? 'Authenticating Device...' : 'Sign In & Access Live Sirens'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  New Resident in this City? Create Account with Full Location Details →
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: SIGN UP (CREATE ACCOUNT WITH FULL LOCATION DETAILS)               */}
        {/* ========================================================================= */}
        {authMode === 'signup' && (
          <form onSubmit={handleSignUp} className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
              <Radio className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="leading-relaxed">
                <strong>Full Location Verification:</strong> Provide your exact State, District, City, Ward No, House No, and PIN Code so the hydrological telemetry engine can arm precise, audible flood alerts for your exact residence.
              </div>
            </div>

            {/* Personal Details */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                1. Resident Identity Credentials
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

                <div>
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    Account Password / PIN
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set security PIN or password"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-medium text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Comprehensive Location Details */}
            <div className="border border-blue-200 rounded-2xl p-4 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  2. Full Residential Location Details (District, State, City, House No, PIN Code, Ward)
                </span>
                <button
                  type="button"
                  onClick={handleDetectLiveLocation}
                  disabled={isLocating}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-2xs transition-all cursor-pointer"
                  title="Detect GPS location"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      <span>Detecting GPS...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="w-3 h-3 text-blue-600" />
                      <span>📍 Auto-Fill via GPS</span>
                    </>
                  )}
                </button>
              </div>

              {/* State & District Grid */}
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
              </div>

              {/* City & PIN Code Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    PIN Code (Postal Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 562101 or 560068"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Ward No & House No Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ward No / Division <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
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
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Home className="w-3.5 h-3.5 text-blue-600" />
                    House No / Door No / Flat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={houseNo}
                    onChange={(e) => setHouseNo(e.target.value)}
                    placeholder="e.g. #24/A, Ground Floor, Sri Krishna Nilaya"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Full Street Address / Landmark */}
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
            </div>

            {/* Active Device Notification Preferences */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
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
                <span>Audible Siren Alarm on This Device (Piercing Loudness, No Vibration)</span>
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

            {/* Registration Actions */}
            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? 'Registering Residence...' : 'Create Account & Arm Device Sirens'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Already have an account? Sign In here →
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
