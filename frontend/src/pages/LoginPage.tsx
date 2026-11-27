import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { playDeviceAlertTone, triggerDeviceNotification } from '../utils/soundAlert';
import {
  User,
  ShieldAlert,
  Smartphone,
  Volume2,
  BellRing,
  CheckCircle2,
  MapPin,
  Building2,
  Radio,
  ArrowRight,
  Phone,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBack }) => {
  const { user, loginUserSession, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'citizen' | 'eoc'>('citizen');

  const [name, setName] = useState(user.name !== 'Public Resident / Commuter' ? user.name : '');
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

  const handleQuickPresetLogin = async (preset: 'citizen' | 'eoc_chief' | 'ward_engineer' | 'admin') => {
    setIsLoading(true);
    try {
      const res = await api.loginUser({ preset });
      loginUserSession(res.user);
      playDeviceAlertTone('chime');
      addToast(`Logged in as ${res.user.name}`, 'success');
      onSuccess();
    } catch (err: any) {
      addToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full py-8 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-3 transition-colors font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-md">
              जल
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-xl tracking-tight text-white">Citizen Flood Alert Registration</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  National Disaster Portal
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Register your device to receive real-time flood sirens, localized underpass warnings & detour alerts.
              </p>
            </div>
          </div>

          {/* Persona Switcher Tabs */}
          <div className="mt-5 flex rounded-xl bg-slate-800/80 p-1 border border-slate-700">
            <button
              onClick={() => setActiveTab('citizen')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'citizen'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Public Citizen / Commuter</span>
            </button>
            <button
              onClick={() => setActiveTab('eoc')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'eoc'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>EOC Command Personnel</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Citizen Registration */}
        {activeTab === 'citizen' && (
          <form onSubmit={handleCitizenSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
              <Radio className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong>Device Alert Allocation:</strong> Subscribing registers this browser session & phone number to receive instantaneous audible sirens and cell broadcasts when flooding is detected in your chosen ward.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-teal-600" />
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
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
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
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  Primary Operational City
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
                  <Mail className="w-3.5 h-3.5 text-teal-600" />
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
                Target Monitored Ward & Underpass Choke Point
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
                <span>High-Decibel Audible Siren on This Device (Web Audio 95% Volume)</span>
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
                onClick={() => handleQuickPresetLogin('citizen')}
                disabled={isLoading}
                className="w-full sm:w-auto py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>⚡ Instant Demo</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: EOC Official Sign In */}
        {activeTab === 'eoc' && (
          <div className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Official Operations Access:</strong> EOC personnel and ward engineers can evaluate hydrological nowcasts, inject storm simulations, update drainage maintenance, and broadcast live alerts to citizens.
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickPresetLogin('eoc_chief')}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    RS
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-teal-900">
                      Commander R. Sharma
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      EOC Chief of Operations • NDMA Command Central
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-100 px-2.5 py-1 rounded border border-teal-200">
                  Sign In →
                </span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickPresetLogin('ward_engineer')}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    PK
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-blue-900">
                      Er. Praveen Kumar
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ward Maintenance Engineer • BTM Layout & Silk Board
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded border border-blue-200">
                  Sign In →
                </span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickPresetLogin('admin')}
                className="w-full p-4 rounded-xl border border-slate-200 hover:border-slate-500 hover:bg-slate-50 transition-all text-left flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    SA
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      System Administrator (Root Operations)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Headquarters Control • Hydraulic Model Tuning
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2.5 py-1 rounded">
                  Sign In →
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
