import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
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
  Sparkles,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBack }) => {
  const { user, loginUserSession, addToast } = useApp();

  const [name, setName] = useState(user.name !== 'Public Resident / Commuter' && user.name !== 'Public Resident (Guest)' ? user.name : '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [city, setCity] = useState(user.city || 'Bengaluru');
  const [wardName, setWardName] = useState(user.ward || 'Majestic & Gandhinagar (Ward 94)');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const cityCorridors: Record<string, string[]> = {
    Bengaluru: [
      'Majestic & Gandhinagar (Ward 94)',
      'Silk Board Junction & Outer Ring Road (Ward 176)',
      'Bellandur & Eco-Space Technology Park (Ward 150)',
      'Hebbal Flyover & Airport Expressway (Ward 7)',
      'Koramangala 80ft Road & Sony World (Ward 151)',
      'Marathahalli Multiplex Junction (Ward 85)'
    ],
    Hyderabad: [
      'Tolichowki Flyover & Gachibowli Corridor',
      'Begumpet Railway Underpass & Rasoolpura',
      'Madhapur & Hitec City Cyber Towers'
    ],
    Chennai: [
      'Velachery Main Road & Lake View Underpass',
      'T. Nagar Usman Road & South Boag Corridor',
      'Madipakkam Lake Drainage Choke Point'
    ],
    Pune: [
      'Sinhagad Road & Canal Overflow Sector',
      'Deccan Gymkhana & Sambhaji Bridge Underpass',
      'Shivajinagar Bus Terminal Low Point'
    ],
    Vijayawada: [
      'Benz Circle Drainage Basin',
      'Auto Nagar Industrial Storm Corridor'
    ],
    Mysuru: [
      'Suburban Bus Stand Underpass (Ward 41)',
      'Chamundi Foothills & Nanjangud Road Corridor'
    ]
  };

  useEffect(() => {
    const corridors = cityCorridors[city] || cityCorridors['Bengaluru'];
    if (!corridors.includes(wardName)) {
      setWardName(corridors[0]);
    }
  }, [city]);

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
      const res = await api.registerUser({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: 'citizen',
        city,
        ward_name: wardName,
        alerts_enabled: true,
        sound_alerts_enabled: soundAlerts,
        sms_alerts_enabled: smsAlerts
      });

      loginUserSession(res.user);

      if (soundAlerts) {
        playDeviceAlertTone('chime');
      }

      if (pushAlerts) {
        triggerDeviceNotification(
          `🚨 JalDrishti Device Alerts Active: ${name}`,
          `Device registered for ${wardName} (${city}). Emergency siren and detour alerts are armed.`
        );
      }

      addToast(`Device registered! Emergency alerts armed for ${name}.`, 'success');
      onSuccess();
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
      playDeviceAlertTone('chime');
      addToast(`Logged in as Public Citizen (${res.user.name})`, 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.message || 'Demo login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full py-8 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header - Dedicated to Public Citizens */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-6 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-ping" />
              Public Citizen Flood Alert Portal
            </span>
            <button
              onClick={onBack}
              className="text-xs text-slate-300 hover:text-teal-300 transition-colors font-bold underline flex items-center gap-1"
              title={user.isLoggedIn ? "Back to Dashboard" : "Browse as guest resident"}
            >
              {user.isLoggedIn ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Dashboard</span>
                </>
              ) : (
                <span>Continue as Guest Resident →</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg">
              जल
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-xl tracking-tight text-white">Public Citizen Alert Login</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-400/30">
                  Citizen Portal
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Register your device to receive real-time audible flood sirens, localized choke point warnings & detour alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Public Citizen Registration Form */}
        <form onSubmit={handleCitizenSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
            <Radio className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="leading-relaxed">
              <strong>Device Alert Allocation:</strong> Subscribing registers this browser session & mobile phone number to receive instantaneous audible sirens and cell broadcasts when flooding is detected in your chosen corridor.
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
                Primary Monitored City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
              >
                <option value="Bengaluru">Bengaluru</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Chennai">Chennai</option>
                <option value="Pune">Pune</option>
                <option value="Vijayawada">Vijayawada</option>
                <option value="Mysuru">Mysuru</option>
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
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              Target Monitored Corridor & Underpass Choke Point
            </label>
            <select
              value={wardName}
              onChange={(e) => setWardName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 font-semibold bg-white text-slate-900"
            >
              {(cityCorridors[city] || cityCorridors['Bengaluru']).map((corridor) => (
                <option key={corridor} value={corridor}>
                  {corridor}
                </option>
              ))}
            </select>
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

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Connecting Device...' : 'Register & Arm Device Alerts'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCitizenDemoLogin}
              disabled={isLoading}
              className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              title="One-click citizen login (Ananya Rao)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>⚡ Instant Citizen Demo</span>
            </button>
          </div>

          <div className="pt-2 text-center border-t border-slate-100">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-semibold"
            >
              Just browsing? Continue to Dashboard as Anonymous Resident →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
