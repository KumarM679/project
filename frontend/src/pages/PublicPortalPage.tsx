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
  UserCheck
} from 'lucide-react';

interface PublicPortalPageProps {
  onSwitchToEOC: () => void;
}

export const PublicPortalPage: React.FC<PublicPortalPageProps> = ({ onSwitchToEOC }) => {
  const { activeCity, setActiveCity, addToast, refreshTrigger, triggerRefresh } = useApp();
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [citizenReports, setCitizenReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);

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
      api.getCitizenReports({ city: activeCity })
    ])
      .then(([alertsRes, streetsRes, reportsRes]) => {
        if (isMounted) {
          setAlerts(alertsRes.alerts);
          setStreets(streetsRes.streets);
          setCitizenReports(reportsRes.reports);
          if (streetsRes.streets.length > 0 && !selectedStreetName) {
            setSelectedStreetName(streetsRes.streets[0].name);
            setWardName(streetsRes.streets[0].ward_name);
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
      setIsReportModalOpen(false);
      setDescription('');
      triggerRefresh();
    } catch (err: any) {
      addToast(`Submission error: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // High priority alerts broadcasted by EOC Commander to the public
  const broadcastedAlerts = alerts.filter(
    (a) => a.target_audience.includes('Public') || a.status === 'Broadcasted to Citizens' || a.severity === 'red'
  );

  const emergencyActiveCount = broadcastedAlerts.length;
  const severeFloodedStreets = streets.filter((s) => s.risk_analysis && s.risk_analysis.risk_score >= 60);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      {/* Top Citizen Header Bar */}
      <header className="sticky top-0 z-40 bg-[#071328] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          <div className="flex items-center gap-3">
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

      {/* EMERGENCY BROADCAST BANNER (PASSED BY EOC COMMANDER) */}
      {broadcastedAlerts.length > 0 && (
        <div className="bg-rose-600 text-white px-4 py-3 shadow-inner">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-full bg-white/20 animate-ping">
                <AlertTriangle className="w-4 h-4 text-white" />
              </span>
              <div>
                <strong className="font-black uppercase tracking-wider text-rose-100 mr-2">
                  🚨 EOC COMMANDER LIVE BROADCAST:
                </strong>
                <span>
                  {broadcastedAlerts[0].title} — {broadcastedAlerts[0].recommendation}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveBroadcastModal(broadcastedAlerts[0])}
              className="self-start sm:self-auto px-3 py-1 bg-white text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-xs"
            >
              View Official Cell Broadcast
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Quick Safety Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="civic-card p-4 border-l-4 border-l-rose-600">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Active Public Alerts
            </span>
            <div className="text-2xl font-black text-rose-600">{emergencyActiveCount} Warnings</div>
            <span className="text-xs text-slate-500 mt-1 block">Broadcasted by Municipal EOC</span>
          </div>

          <div className="civic-card p-4 border-l-4 border-l-amber-500">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Flooded Corridors to Avoid
            </span>
            <div className="text-2xl font-black text-amber-700">{severeFloodedStreets.length} Roads</div>
            <span className="text-xs text-slate-500 mt-1 block">Severe waterlogging reported</span>
          </div>

          <div className="civic-card p-4 border-l-4 border-l-teal-600">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Emergency Toll-Free Helpline
            </span>
            <div className="text-2xl font-black text-teal-800 font-mono">1533 / 1077</div>
            <span className="text-xs text-slate-500 mt-1 block">24x7 Flood Rescue & Dewatering</span>
          </div>

          <div className="civic-card p-4 bg-teal-50/60 border-l-4 border-l-teal-500 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider block mb-1">
                Citizen Incident Reporting
              </span>
              <p className="text-xs text-teal-800">Spotted waterlogging in your street?</p>
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

        {/* Section 1: LIVE BROADCASTED EMERGENCY ALERTS (MESSAGE ALERT PASS TO PUBLIC) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Official Emergency Flood Alerts (Passed by EOC Commander)
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Live automated & commander-verified alerts
            </span>
          </div>

          <div className="space-y-3.5">
            {broadcastedAlerts.length === 0 ? (
              <div className="civic-card p-6 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-bold text-sm text-slate-800">No Critical Public Alerts in this Region</h4>
                <p className="text-xs mt-1">
                  Arterial roads in {activeCity} are currently operating with safe drainage clearances.
                </p>
              </div>
            ) : (
              broadcastedAlerts.map((alert) => {
                const isCritical = alert.severity === 'red';
                return (
                  <div
                    key={alert.id}
                    className={`civic-card p-5 border-l-4 transition-all ${
                      isCritical ? 'border-l-rose-600 bg-rose-50/20' : 'border-l-orange-500 bg-orange-50/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isCritical ? 'bg-rose-600 text-white animate-pulse' : 'bg-orange-500 text-white'
                            }`}
                          >
                            {isCritical ? 'EMERGENCY AVOID' : 'HIGH ADVISORY'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-600">{alert.alert_code}</span>
                          <span className="text-xs text-slate-500">
                            Issued: {alert.timestamp}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900">{alert.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {alert.city} • {alert.ward_name}
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveBroadcastModal(alert)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs self-start"
                      >
                        <Radio className="w-3.5 h-3.5 text-teal-600" />
                        <span>View Cell Broadcast Message</span>
                      </button>
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

        {/* Section 2: NEIGHBORHOOD ROAD SAFETY CLEARANCE STATUS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Neighborhood Road Clearance & Inundation Status
              </h2>
            </div>
            <span className="text-xs text-slate-500">Real-time commuter check</span>
          </div>

          <div className="civic-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-4">Monitored Corridor</th>
                    <th className="py-2.5 px-4">City & Ward</th>
                    <th className="py-2.5 px-4">Road Clearance Status</th>
                    <th className="py-2.5 px-4">Water Depth Risk</th>
                    <th className="py-2.5 px-4">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {streets.map((st) => {
                    const score = st.risk_analysis ? st.risk_analysis.risk_score : 50;
                    const isSevere = score >= 65;
                    const isModerate = score >= 35 && score < 65;
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
                            {isSevere ? '⚠️ Heavy Waterlogging' : isModerate ? '⚡ Moderate Puddles' : '✅ Clear / Passable'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {isSevere ? '40 - 65 cm (Submerged)' : isModerate ? '15 - 30 cm' : '< 10 cm (Normal)'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {isSevere
                            ? 'Do not attempt in low-clearance vehicles. Use detour.'
                            : isModerate
                            ? 'Slow driving advised. Lane 1 waterlogged.'
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

        {/* Section 3: COMMUNITY CROWDSOURCED FLOOD REPORTS FEED */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Community Flood Reports Verified by Citizens
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
            {citizenReports.slice(0, 6).map((report) => (
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
                  <span className="text-slate-400 text-[11px]">Reported by {report.citizen_name || 'Citizen'}</span>
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

        {/* Section 4: EMERGENCY MONSOON SAFETY GUIDELINES */}
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
