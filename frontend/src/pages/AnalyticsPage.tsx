import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import {
  FileDown,
  Printer,
  MapPin,
  AlertTriangle,
  Layers,
  Droplets,
  Clock,
  Building2,
  TrendingUp,
  CheckCircle2,
  Truck,
  ArrowDownRight,
  ShieldAlert,
  Compass,
  Activity
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { activeCity, addToast, refreshTrigger } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Location-specific analytics state
  const [selectedStreetId, setSelectedStreetId] = useState<number | undefined>(undefined);
  const [locationReport, setLocationReport] = useState<any>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Fetch macro analytics
  useEffect(() => {
    let isMounted = true;
    api
      .getAnalytics()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Analytics fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Fetch location-specific analytics when selectedStreetId or activeCity changes
  useEffect(() => {
    let isMounted = true;
    setLocationLoading(true);

    api
      .getLocationReport({ street_id: selectedStreetId, city: activeCity })
      .then((res) => {
        if (isMounted) {
          setLocationReport(res);
          if (!selectedStreetId && res.street?.id) {
            setSelectedStreetId(res.street.id);
          }
          setLocationLoading(false);
        }
      })
      .catch((err) => {
        console.error('Location analytics fetch error:', err);
        if (isMounted) setLocationLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStreetId, activeCity, refreshTrigger]);

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    if (!locationReport?.street?.id) {
      addToast('Please select a valid location first', 'warning');
      return;
    }

    try {
      setIsExportingPdf(true);
      const streetId = locationReport.street.id;
      const streetName = locationReport.street.name;
      const city = locationReport.street.city;

      const pdfUrl = api.getLocationReportPdfUrl(streetId, city);

      // Trigger download
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to generate PDF (${response.statusText})`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = streetName.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Hydro_Analytics_Report_${cleanName}_${city}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      addToast(`Downloaded official PDF report for ${streetName}`, 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      addToast(`PDF export failed: ${err.message}`, 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintView = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Compiling multi-city hydro-informatics analytics...</p>
      </div>
    );
  }

  // Filter available streets by activeCity if selected
  const availableStreets =
    locationReport?.all_streets?.filter(
      (s: any) => activeCity === 'All Cities' || s.city.toLowerCase() === activeCity.toLowerCase()
    ) || locationReport?.all_streets || [];

  const st = locationReport?.street;
  const dr = locationReport?.drainage;
  const rf = locationReport?.rainfall;
  const risk = locationReport?.risk;
  const hotspot = locationReport?.hotspot_info;
  const incidents = locationReport?.incidents || [];

  const riskScore = risk ? Math.round(risk.risk_score) : 65;
  const blockagePct = dr ? Math.round(dr.current_blockage_pct || 25) : 25;
  const totalPumpsForLoc = incidents.reduce((sum: number, inc: any) => sum + (inc.dewatering_pumps_deployed || 0), 0);
  const totalSuctionForLoc = incidents.reduce((sum: number, inc: any) => sum + (inc.suction_vehicles_count || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Hydro-Informatics & Location Analytics</h2>
          </div>
          <p className="text-xs text-slate-500">
            Real-time drainage telemetry, historical flood recurrence patterns, and downloadable executive dossiers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap no-print">
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !st}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all disabled:opacity-50"
            title="Download formal executive PDF report for the selected location"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download Location PDF'}</span>
          </button>

          <button
            onClick={handlePrintView}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Print or Save current page layout as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* LOCATION SPOTLIGHT DOSSIER & PDF EXPORT CONTROLS */}
      <div className="civic-card p-6 border-l-4 border-l-teal-600 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Location Risk & Trend Dossier
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              {st ? `${st.name} (${st.city})` : 'Select a Location to View Deep Analytics'}
            </h3>
            <span className="text-xs text-slate-500">
              {st?.ward_name ? `${st.ward_name} (Ward #${st.ward_no}) • ${st.road_type || 'Arterial Corridor'}` : ''}
            </span>
          </div>

          {/* Location Selector Dropdown */}
          <div className="flex items-center gap-2 no-print">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Select Location:</span>
            <select
              value={selectedStreetId || ''}
              onChange={(e) => setSelectedStreetId(Number(e.target.value))}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 max-w-xs"
            >
              {availableStreets.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.city}: {s.name} ({s.ward_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {locationLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading telemetry & hydrological data...</span>
          </div>
        ) : st ? (
          <div className="mt-5 space-y-5">
            {/* Top Stat Pills Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Evaluated Flood Hazard
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      riskScore >= 80
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : riskScore >= 55
                        ? 'bg-orange-100 text-orange-800 border border-orange-200'
                        : riskScore >= 30
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {risk?.risk_level || 'Moderate'}
                  </span>
                  <span className="text-base font-black font-mono text-slate-900">{riskScore}/100</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Real-Time Rainfall Load
                </span>
                <div className="text-base font-black text-blue-700 font-mono">
                  {rf?.current_intensity_mm_hr || 0} mm/h
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  24h Cumulative: {rf?.accumulation_24h || 0} mm
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Drain Choke Ratio
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-base font-black font-mono ${
                      blockagePct > 50 ? 'text-rose-700' : blockagePct > 25 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {blockagePct}% Blocked
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Silt Depth: {dr?.silt_depth_cm || 0} cm
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Emergency Resources
                </span>
                <div className="text-base font-black text-teal-800 font-mono">
                  {totalPumpsForLoc} Diesel Pumps
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {totalSuctionForLoc} Suction Tankers Deployed
                </span>
              </div>
            </div>

            {/* Deep Breakdown: Geography, Hydraulics, and Recurrence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Col 1: Topography */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2.5 flex items-center gap-1.5 text-xs">
                  <Compass className="w-3.5 h-3.5 text-teal-600" />
                  <span>Topography & Catchment Profile</span>
                </h4>
                <ul className="space-y-1.5 text-slate-600">
                  <li className="flex justify-between">
                    <span>Elevation MSL:</span>
                    <strong className="text-slate-900 font-mono">{st.elevation_meters || 910} m</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Slope Gradient:</span>
                    <strong className="text-slate-900 font-mono">{st.slope_gradient || 1.2}%</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Impervious Surface:</span>
                    <strong className="text-slate-900 font-mono">
                      {Math.round((st.surface_imperviousness || 0.85) * 100)}%
                    </strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Catchment Footprint:</span>
                    <strong className="text-slate-900 font-mono">
                      {Number(st.catchment_area_sqm || 45000).toLocaleString()} m²
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Col 2: Drainage Infrastructure */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2.5 flex items-center gap-1.5 text-xs">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Drain Outfall Telemetry</span>
                </h4>
                <ul className="space-y-1.5 text-slate-600">
                  <li className="flex justify-between">
                    <span>Drain Code:</span>
                    <strong className="text-slate-900 font-mono">{dr?.drain_code || 'N/A'}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Nominal Capacity:</span>
                    <strong className="text-slate-900 font-mono">{dr?.nominal_capacity_mm_hr || 45} mm/h</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>Structural Status:</span>
                    <strong className="text-slate-900">{dr?.structural_status || 'Operational'}</strong>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Outfall Canal:</span>
                    <span className="text-[11px] font-semibold text-slate-800 text-right truncate max-w-[140px]" title={dr?.discharge_outfall}>
                      {dr?.discharge_outfall || 'Stormwater Canal'}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Col 3: Historical Recurrence */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2.5 flex items-center gap-1.5 text-xs">
                  <Activity className="w-3.5 h-3.5 text-rose-600" />
                  <span>Historical Recurrence & Cause</span>
                </h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Annual Frequency:</span>
                    <strong className="text-rose-700 font-mono font-bold">
                      {hotspot?.historical_events_year || 6} flood episodes / yr
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Vulnerability Index:</span>
                    <strong className="text-rose-700 font-mono font-bold">
                      {hotspot?.vulnerability_index || riskScore} / 100
                    </strong>
                  </div>
                  <div className="text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700 mt-1">
                    <span className="font-bold text-slate-900 block mb-0.5">Topographic Cause:</span>
                    {hotspot?.primary_cause || 'Low-lying depression with undersized storm conduit.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Inundation Simulation Balance Alert Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400 block mb-0.5">
                  Hydrologic Simulation Inundation Balance
                </span>
                <p className="text-xs text-slate-200">
                  Simulated Runoff Load: <strong>{risk?.effective_rainfall_mm_hr || 35} mm/h</strong> vs. Cleared Drain Capacity:{' '}
                  <strong>{risk?.effective_drainage_capacity_mm_hr || 30} mm/h</strong>.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Operational Recommendation: {risk?.action_summary || 'Mobilize high-capacity dewatering pumps to clear ponding.'}
                </p>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="no-print flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shadow-md shadow-teal-900/30 whitespace-nowrap self-start sm:self-auto"
              >
                <FileDown className="w-4 h-4" />
                <span>{isExportingPdf ? 'Exporting...' : 'Export Location PDF'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            No street telemetry found for the selected city.
          </div>
        )}
      </div>

      {/* Historical Hotspot Recurrence Ranking Table */}
      <div className="civic-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Historical Urban Flood Recurrence Hotspots (Indian Demonstration Metros)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Vulnerability indices calibrated against monsoon flood history and catchment topography
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-200">
            Top Vulnerability Ranking
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-3">Hotspot Corridor</th>
                <th className="py-2.5 px-3">City</th>
                <th className="py-2.5 px-3">Historical Floods / Year</th>
                <th className="py-2.5 px-3">Vulnerability Index (0-100)</th>
                <th className="py-2.5 px-3">Root Hydrologic Cause</th>
                <th className="py-2.5 px-3 no-print text-right">PDF Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.historical_hotspots?.map((hs: any, idx: number) => {
                // Find matching street id if available
                const matchedStreet = availableStreets.find(
                  (s: any) => s.name.toLowerCase().includes(hs.name.split(' ')[0].toLowerCase())
                );
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                        #{idx + 1}
                      </span>
                      <span>{hs.name}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-teal-700">{hs.city}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {hs.historical_events_year} episodes / yr
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${hs.vulnerability_index}%` }}
                            className="bg-rose-600 h-full rounded-full"
                          />
                        </div>
                        <span className="font-mono font-bold text-rose-700">{hs.vulnerability_index}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px] max-w-xs">{hs.primary_cause}</td>
                    <td className="py-3 px-3 no-print text-right">
                      {matchedStreet ? (
                        <button
                          onClick={() => {
                            setSelectedStreetId(matchedStreet.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] transition-colors"
                        >
                          View & Export
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Regional Data</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Row: Top Drainage Bottlenecks & City Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worst 5 Drainage Bottlenecks */}
        <div className="civic-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>Severe Drainage Outfall Bottlenecks</span>
            </h3>
            <span className="text-[10px] text-slate-400">Ranked by Blockage %</span>
          </div>

          <div className="space-y-3">
            {data?.worst_bottlenecks?.map((bn: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 font-mono">
                    {bn.drain_code} — {bn.street_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                    {bn.current_blockage_pct}% Blocked
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    {bn.city} • {bn.drain_type}
                  </span>
                  <span>
                    Silt Accumulation: <strong>{bn.silt_depth_cm} cm</strong>
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div style={{ width: `${bn.current_blockage_pct}%` }} className="bg-rose-500 h-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* City-Wise Monitored Network Comparison */}
        <div className="civic-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>City Telemetry & Capacity Comparison</span>
            </h3>
            <span className="text-[10px] text-slate-400">Multi-City Coverage</span>
          </div>

          <div className="space-y-3">
            {data?.city_stats?.map((cs: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{cs.city}</span>
                  <span className="font-semibold text-teal-700">{cs.street_count} Monitored Corridors</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mt-1">
                  <div>
                    Avg Drain Capacity:{' '}
                    <strong className="font-mono text-slate-800">{Math.round(cs.avg_capacity || 45)} mm/h</strong>
                  </div>
                  <div>
                    Avg Blockage:{' '}
                    <strong className="font-mono text-amber-700">{Math.round(cs.avg_blockage || 25)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incident Resolution Breakdown */}
      <div className="civic-card p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Municipal Response Priority & Asset Deployment Distribution</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {data?.incident_priority_stats?.map((ps: any, idx: number) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-center">
              <span className="text-xs font-bold text-slate-700 block mb-1">{ps.priority} Incidents</span>
              <div className="text-2xl font-black text-slate-900">{ps.count} Cases</div>
              <span className="text-[11px] text-teal-700 font-semibold mt-1 block">
                {ps.total_pumps || 0} Pumps Assigned
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
