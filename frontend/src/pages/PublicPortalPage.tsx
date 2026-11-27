import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { FloodAlert, Street, CitizenReport } from '../types';
import {
  ShieldAlert,
  AlertTriangle,
  Radio,
  MapPin,
  Send,
  PhoneCall,
  CheckCircle2,
  ThumbsUp,
  Camera,
  PlusCircle,
  HelpCircle,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Building,
  UserCheck,
  Droplets,
  CloudRain,
  Eye,
  Filter,
  Megaphone,
  Bell,
  Truck,
  Wrench
} from 'lucide-react';
import { playDeviceAlertTone } from '../utils/soundAlert';

interface PublicPortalPageProps {
  onSwitchToEOC: () => void;
}

export const PublicPortalPage: React.FC<PublicPortalPageProps> = ({ onSwitchToEOC }) => {
  const { activeCity, setActiveCity, addToast, refreshTrigger, triggerRefresh, setReportedFloodLocation } = useApp();
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [citizenReports, setCitizenReports] = useState<CitizenReport[]>([]);
  const [rainfallSummary, setRainfallSummary] = useState<{
    intensity: number;
    accumulation24h: number;
    station: string;
    forecast: number;
  }>({
    intensity: 45.2,
    accumulation24h: 84.0,
    station: 'IMD / Municipal Automated Weather Station',
    forecast: 52.0
  });
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');

  // Spotlight alert selected for the dedicated Emergency Advisory section
  const [spotlightAlertId, setSpotlightAlertId] = useState<number | undefined>(undefined);

  // Citizen report submission modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedStreetName, setSelectedStreetName] = useState('');
  const [wardName, setWardName] = useState('');
  const [waterDepth, setWaterDepth] = useState('Knee Deep (30-45cm)');
  const [reportType, setReportType] = useState('Waterlogged Road');
  const [description, setDescription] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cell broadcast preview modal for citizens
  const [activeBroadcastModal, setActiveBroadcastModal] = useState<FloodAlert | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.getAlerts({ city: activeCity }),
      api.getStreets({ city: activeCity }),
      api.getCitizenReports({ city: activeCity }),
      api.getRainfall(activeCity)
    ])
      .then(([alertsRes, streetsRes, reportsRes, rainRes]) => {
        if (isMounted) {
          const fetchedAlerts = alertsRes.alerts || [];
          setAlerts(fetchedAlerts);
          setStreets(streetsRes.streets || []);
          setCitizenReports(reportsRes.reports || []);

          if (rainRes.readings && rainRes.readings.length > 0) {
            const rd = rainRes.readings[0];
            setRainfallSummary({
              intensity: rd.current_intensity_mm_hr,
              accumulation24h: rd.accumulation_24h,
              station: rd.station_name,
              forecast: rd.forecast_next_2h_mm_hr
            });
          }

          if (streetsRes.streets && streetsRes.streets.length > 0 && !selectedStreetName) {
            setSelectedStreetName(streetsRes.streets[0].name);
            setWardName(streetsRes.streets[0].ward_name);
          }

          // Pick spotlight alert (e.g. Majestic or first active alert)
          if (fetchedAlerts.length > 0) {
            const majesticAlert = fetchedAlerts.find((a) =>
              a.street_name.toLowerCase().includes('majestic')
            );
            if (majesticAlert) {
              setSpotlightAlertId(majesticAlert.id);
            } else {
              setSpotlightAlertId(fetchedAlerts[0].id);
            }
          }

          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Public portal fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCity, refreshTrigger]);

  const handleUpvote = async (reportId: number) => {
    try {
      const res = await api.upvoteCitizenReport(reportId);
      addToast('Thank you! Your verification helps the EOC respond faster.', 'success');
      setCitizenReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, upvotes: res.upvotes } : r))
      );
    } catch (err: any) {
      addToast(`Could not confirm report: ${err.message}`, 'error');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStreetName || !description) {
      addToast('Please enter the street name and description', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const targetStreet = streets.find((s) => s.name === selectedStreetName);
      const res = await api.submitCitizenReport({
        street_name: selectedStreetName,
        ward_name: wardName || targetStreet?.ward_name || 'Central Ward',
        city: activeCity === 'All Cities' ? 'Bengaluru' : activeCity,
        latitude: targetStreet?.latitude || 12.9716,
        longitude: targetStreet?.longitude || 77.5946,
        report_type: reportType,
        water_depth: waterDepth,
        description,
        citizen_name: citizenName || 'Civic Resident',
        phone_masked: phone ? phone.replace(/(\d{2})\d{5}(\d{3})/, '$1*****$2') : '+91 98*** **412'
      });

      addToast(`Report submitted! EOC Dispatch Ref: ${res.report_code}`, 'success');

      // Dynamically update the system-wide device alert location based on this new flood report
      setReportedFloodLocation({
        street_name: selectedStreetName,
        ward_name: wardName || targetStreet?.ward_name || 'Central Ward',
        city: activeCity === 'All Cities' ? 'Bengaluru' : activeCity,
        severity: waterDepth.includes('Waist') || waterDepth.includes('Deep') ? 'red' : 'orange',
        water_depth: waterDepth,
        report_type: reportType,
        message: `📸 CITIZEN FLOOD REPORT: ${reportType} (${waterDepth}) at ${selectedStreetName}. ${description}`,
        recommendation: `Heavy water accumulation reported. Maintain crawl speed or detour around ${selectedStreetName}.`,
        source: 'citizen_report',
        timestamp: 'Just Reported',
        report_code: res.report_code
      });
      playDeviceAlertTone('warning');

      setIsReportModalOpen(false);
      setDescription('');
      triggerRefresh();
    } catch (err: any) {
      addToast(`Submission error: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter public alerts: Include any active or broadcasted alerts
  const publicAlerts = alerts.filter((a) => {
    if (a.status === 'Resolved') return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  // Identify current spotlight alert for the dedicated section
  const currentSpotlightAlert =
    alerts.find((a) => a.id === spotlightAlertId) || alerts[0];

  const emergencyAlertCount = alerts.filter((a) => a.status !== 'Resolved').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      {/* Top Citizen Header Bar */}
      <header className="sticky top-0 z-40 bg-[#071328] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">JalDrishti Public Safety</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Citizen Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Official Urban Flood Emergency Broadcast & Commuter Route Safety
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* City Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold">City:</span>
              <select
                value={activeCity}
                onChange={(e) => setActiveCity(e.target.value)}
                className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400"
              >
                <option value="All Cities">All Cities</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Chennai">Chennai</option>
                <option value="Pune">Pune</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>

            {/* Portal Switcher Button */}
            <button
              onClick={onSwitchToEOC}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
              title="Switch to Municipal Emergency Operations Command View"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>EOC Commander Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Quick Safety Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="civic-card p-4 border-l-4 border-l-rose-600">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Active Public Alerts
            </span>
            <div className="text-2xl font-black text-rose-600">{emergencyAlertCount} Advisories</div>
            <span className="text-xs text-slate-500 mt-1 block">Broadcasted by Municipal EOC</span>
          </div>

          <div className="civic-card p-4 border-l-4 border-l-blue-500">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Live Rainfall Telemetry
            </span>
            <div className="text-2xl font-black text-blue-700 font-mono">
              {rainfallSummary.intensity} mm/h
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              24h Total: {rainfallSummary.accumulation24h} mm • Next 2h: {rainfallSummary.forecast} mm/h
            </span>
          </div>

          <div className="civic-card p-4 border-l-4 border-l-teal-600">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              24x7 Flood Rescue Helpline
            </span>
            <div className="text-2xl font-black text-teal-800 font-mono">1533 / 1077</div>
            <span className="text-xs text-slate-500 mt-1 block">Toll-Free Municipal Control Room</span>
          </div>

          <div className="civic-card p-4 bg-teal-50/60 border-l-4 border-l-teal-500 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider block mb-1">
                Citizen Incident Reporting
              </span>
              <p className="text-xs text-teal-800">Spotted flooding or choked drains?</p>
            </div>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Report Flooded Road</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DEDICATED SECTION: EOC COMMANDER LIVE EMERGENCY ADVISORY & MESSAGE ALERTS */}
        {/* ========================================================================= */}
        <section className="civic-card p-6 border-l-4 border-l-rose-600 bg-white shadow-md">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1 rounded bg-rose-100 text-rose-700 animate-pulse">
                  <Radio className="w-4 h-4" />
                </span>
                <span className="text-xs font-black tracking-wider uppercase text-rose-700">
                  Official Disaster Operations Directive
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                  LIVE BROADCAST TO CITIZENS
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                🚨 EOC COMMANDER LIVE EMERGENCY ADVISORY
              </h2>
              <p className="text-xs text-slate-500">
                Direct cell broadcast message and civic safety instructions passed from the Emergency Operations Command Center.
              </p>
            </div>

            {/* Location Corridor Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Select Corridor Advisory:
              </span>
              <select
                value={spotlightAlertId || ''}
                onChange={(e) => setSpotlightAlertId(Number(e.target.value))}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 max-w-xs"
              >
                {alerts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.city}: {a.street_name} ({a.severity.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentSpotlightAlert ? (
            <div className="mt-5 space-y-4">
              {/* Highlighted Broadcast Header Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 via-slate-50 to-rose-50 border border-rose-200 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-black ${
                        currentSpotlightAlert.severity === 'red'
                          ? 'bg-rose-600 text-white animate-pulse'
                          : currentSpotlightAlert.severity === 'orange'
                          ? 'bg-orange-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {currentSpotlightAlert.severity === 'red'
                        ? '🔴 CRITICAL INUNDATION WARNING'
                        : currentSpotlightAlert.severity === 'orange'
                        ? '🟠 HIGH ADVISORY WARNING'
                        : '🟡 MODERATE RISK WATCH'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
                      {currentSpotlightAlert.alert_code}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Risk Score: <strong>{Math.round(currentSpotlightAlert.risk_score)}/100</strong>
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 mt-1">
                    {currentSpotlightAlert.title}
                  </h3>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span>
                      {currentSpotlightAlert.street_name} • {currentSpotlightAlert.ward_name} ({currentSpotlightAlert.city})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 text-right">
                  <span className="text-[11px] text-slate-500">
                    Broadcast Issued: <strong>{currentSpotlightAlert.timestamp}</strong>
                  </span>
                  <button
                    onClick={() => setActiveBroadcastModal(currentSpotlightAlert)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors whitespace-nowrap"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>View Mobile Cell Broadcast (SMS)</span>
                  </button>
                </div>
              </div>

              {/* Message Alert Passed to Public (Featured Quote Card) */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="text-teal-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Megaphone className="w-4 h-4" />
                    Message Alert Passed to Public Users
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Target Audience: Registered Citizens within 1.5km Radius
                  </span>
                </div>

                <blockquote className="text-sm font-semibold text-slate-100 leading-relaxed font-sans pl-2 border-l-2 border-teal-400">
                  "{currentSpotlightAlert.message}"
                </blockquote>

                <div className="p-3 rounded-lg bg-teal-950/60 border border-teal-800/80 text-xs text-teal-200 flex items-start gap-2.5 mt-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-teal-300 font-bold uppercase tracking-wider text-[11px] block mb-0.5">
                      Recommended Civic Safety Detour & Action:
                    </strong>
                    <span>{currentSpotlightAlert.recommendation}</span>
                  </div>
                </div>
              </div>

              {/* On-Ground Operations & Emergency Resources Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">QRT Emergency Crews</span>
                    <strong className="text-slate-900 text-xs">Assigned & On Patrol</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Heavy Dewatering Equipment</span>
                    <strong className="text-teal-800 text-xs">High-Capacity Diesel Pumps Standby</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Instant Citizen Helpline</span>
                    <strong className="text-rose-700 text-xs font-mono font-bold">Dial 1533 or 1077</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No active emergency advisories in this metropolitan zone.
            </div>
          )}
        </section>

        {/* Section 2: ALL LIVE FLOOD RISK WARNINGS & ADVISORIES FEED */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                All Verified Public Flood Advisories ({publicAlerts.length})
              </h2>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Filter by Threat:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="all">All Severities ({alerts.length})</option>
                <option value="red">🔴 Critical Severe Only</option>
                <option value="orange">🟠 High Advisory Only</option>
                <option value="yellow">🟡 Moderate Watch</option>
              </select>
            </div>
          </div>

          <div className="space-y-3.5">
            {publicAlerts.length === 0 ? (
              <div className="civic-card p-6 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-bold text-sm text-slate-800">No Critical Public Alerts in this Region</h4>
                <p className="text-xs mt-1">
                  Arterial roads in {activeCity} are currently operating with safe drainage clearances.
                </p>
              </div>
            ) : (
              publicAlerts.slice(0, 10).map((alert) => {
                const isCritical = alert.severity === 'red';
                const isSelected = alert.id === spotlightAlertId;
                return (
                  <div
                    key={alert.id}
                    className={`civic-card p-5 border-l-4 transition-all ${
                      isSelected
                        ? 'ring-2 ring-rose-500/40 bg-rose-50/30'
                        : isCritical
                        ? 'border-l-rose-600 bg-rose-50/10'
                        : alert.severity === 'orange'
                        ? 'border-l-orange-500 bg-orange-50/10'
                        : 'border-l-amber-400 bg-amber-50/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isCritical
                                ? 'bg-rose-600 text-white animate-pulse'
                                : alert.severity === 'orange'
                                ? 'bg-orange-500 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {isCritical
                              ? '🔴 EMERGENCY AVOID'
                              : alert.severity === 'orange'
                              ? '🟠 HIGH ADVISORY'
                              : '🟡 MODERATE WATCH'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-600">
                            {alert.alert_code}
                          </span>
                          <span className="text-xs text-slate-500">Issued: {alert.timestamp}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                            ✓ EOC Verified Alert
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900">{alert.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {alert.city} • {alert.ward_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSpotlightAlertId(alert.id);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          View in Directive Section ↑
                        </button>
                        <button
                          onClick={() => setActiveBroadcastModal(alert)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                        >
                          <Radio className="w-3.5 h-3.5 text-teal-600" />
                          <span>SMS Broadcast</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold text-slate-900 block mb-1">EOC Message to Public:</span>
                      {alert.message}
                    </div>

                    <div className="mt-2.5 p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Recommended Safety Detour:</strong> {alert.recommendation}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Section 3: NEIGHBORHOOD ROAD SAFETY CLEARANCE STATUS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Neighborhood Road Clearance & Inundation Status
              </h2>
            </div>
            <span className="text-xs text-slate-500">Total {streets.length} Corridors Checked</span>
          </div>

          <div className="civic-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-4">Monitored Corridor</th>
                    <th className="py-2.5 px-4">City & Ward</th>
                    <th className="py-2.5 px-4">Road Clearance Status</th>
                    <th className="py-2.5 px-4">Estimated Water Depth</th>
                    <th className="py-2.5 px-4">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {streets.map((st) => {
                    const score = st.risk_analysis ? st.risk_analysis.risk_score : 30;
                    const isSevere = score >= 55;
                    const isModerate = score >= 28 && score < 55;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{st.name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {st.city} • {st.ward_name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                              isSevere
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isModerate
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isSevere
                              ? '⚠️ Heavy Waterlogging'
                              : isModerate
                              ? '⚡ Moderate Watch / Pooling'
                              : '✅ Clear / Passable'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {isSevere ? '40 - 65 cm (Submerged)' : isModerate ? '15 - 30 cm' : '< 10 cm (Normal)'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {isSevere
                            ? 'Do not attempt in low-clearance vehicles. Use detour.'
                            : isModerate
                            ? 'Slow driving advised. Lane 1 water accumulation.'
                            : 'Standard traffic flow. Normal road condition.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 4: COMMUNITY CROWDSOURCED FLOOD REPORTS FEED */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Community Flood Reports Verified by Citizens ({citizenReports.length} Reports)
              </h2>
            </div>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>+ Post New Report</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {citizenReports.map((report) => (
              <div key={report.id} className="civic-card p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {report.report_code}
                    </span>
                    <span className="text-[11px] text-slate-400">{report.created_at || 'Today'}</span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900">{report.street_name}</h4>
                  <div className="text-xs text-slate-500 mb-2">
                    {report.city} • {report.ward_name}
                  </div>

                  <div className="p-2 rounded bg-slate-50 border border-slate-200 text-xs mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700">{report.report_type}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {report.water_depth}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] line-clamp-2">{report.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Reported by {report.citizen_name || 'Citizen'}
                  </span>
                  <button
                    onClick={() => handleUpvote(report.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors"
                    title="Confirm this flood incident"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{report.upvotes} Confirmed</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: EMERGENCY MONSOON SAFETY GUIDELINES */}
        <section className="civic-card p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm text-white">Citizen Urban Flood Safety Checklist</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <strong className="text-white block mb-1">1. Turn Around, Don’t Drown:</strong>
              Never drive or walk through flooded underpasses or moving floodwaters. Just 30cm of moving water can float a passenger car.
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <strong className="text-white block mb-1">2. Electrical Hazard Precautions:</strong>
              Stay far away from fallen power cables, submerged feeder pillars, and metallic light poles to prevent electrocution.
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <strong className="text-white block mb-1">3. Immediate Municipal Help:</strong>
              If stranded, call 1533 (Municipal Stormwater Operations) or 1077 (Disaster Control). QRT diesel pumps are mobilized automatically.
            </div>
          </div>
        </section>
      </main>

      {/* Citizen Report Submission Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#071328] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-400" />
                <h4 className="font-bold text-sm">Report Waterlogged Road / Clogged Drain</h4>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Flooded Location</label>
                <select
                  value={selectedStreetName}
                  onChange={(e) => {
                    setSelectedStreetName(e.target.value);
                    const st = streets.find((s) => s.name === e.target.value);
                    if (st) setWardName(st.ward_name);
                  }}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 bg-white"
                >
                  {streets.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.city}: {s.name} ({s.ward_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Water Depth Observed</label>
                  <select
                    value={waterDepth}
                    onChange={(e) => setWaterDepth(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 bg-white"
                  >
                    <option value="Ankle Deep (10-15cm)">Ankle Deep (10-15cm)</option>
                    <option value="Knee Deep (30-45cm)">Knee Deep (30-45cm)</option>
                    <option value="Waist Deep (60-80cm)">Waist Deep (60-80cm)</option>
                    <option value="Submerged Vehicles (>1m)">Submerged Vehicles (&gt;1m)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Incident Category</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 bg-white"
                  >
                    <option value="Waterlogged Road">Waterlogged Road</option>
                    <option value="Clogged Storm Drain">Clogged Storm Drain</option>
                    <option value="Submerged Underpass">Submerged Underpass</option>
                    <option value="Manhole Overflow">Manhole Overflow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Landmark</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Near petrol bunk underpass, water accumulation rising rapidly. Silt covering storm drain grate."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    placeholder="e.g. Anand Kumar"
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile No (for SMS Confirmation)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Incident Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Cell Broadcast Modal for Citizens */}
      {activeBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#071328] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-400 animate-pulse" />
                <h4 className="font-bold text-sm">Disaster Cell Broadcast Message</h4>
              </div>
              <button onClick={() => setActiveBroadcastModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 text-white font-mono text-xs leading-relaxed space-y-2 border border-slate-800 shadow-inner">
                <div className="text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>[GOVT OF {activeBroadcastModal.city.toUpperCase()} - NDMA / EOC NOWCAST]</span>
                </div>
                <div className="font-bold text-white text-sm">
                  {activeBroadcastModal.title}
                </div>
                <div className="text-slate-200">
                  {activeBroadcastModal.message}
                </div>
                <div className="text-teal-300 font-semibold border-t border-slate-800 pt-2">
                  Emergency Detour: {activeBroadcastModal.recommendation}
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  Helpline: 1533 / 1077 • JalDrishti Citizen Disaster Hub
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                This emergency alert was authorized and passed directly by the Municipal EOC Commander to citizens within the {activeBroadcastModal.ward_name} catchment.
              </div>

              <button
                onClick={() => setActiveBroadcastModal(null)}
                className="w-full py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
