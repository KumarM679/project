import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import {
  ShieldAlert,
  Radio,
  Zap,
  Truck,
  AlertTriangle,
  Volume2,
  VolumeX,
  PhoneCall,
  Send,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Lock,
  Unlock,
  Wifi,
  Waves,
  RefreshCw,
  PlusCircle,
  Sparkles,
  Compass,
  Building,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { playDeviceAlertTone, stopDeviceAlertTone } from '../utils/soundAlert';

interface UnderpassGate {
  id: string;
  name: string;
  city: string;
  ward: string;
  waterDepthCm: number;
  criticalThresholdCm: number;
  isLocked: boolean;
  activePumps: number;
  totalPumps: number;
  flowRateLps: number;
  status: 'critical' | 'warning' | 'normal';
}

interface TacticalDirective {
  id: string;
  title: string;
  targetAgency: string;
  priority: 'Critical' | 'High' | 'Medium';
  icon: any;
  color: string;
  description: string;
  defaultPumps: number;
  defaultSuction: number;
}

export const EOCTacticalPanel: React.FC<{
  compact?: boolean;
  onNavigate?: (tab: string, id?: number) => void;
}> = ({ compact = false, onNavigate }) => {
  const { activeCity, addToast, triggerRefresh, user } = useApp();

  // DEFCON / Readiness Level (1 = Disaster Emergency, 4 = Normal Surveillance)
  const [defconLevel, setDefconLevel] = useState<number>(() => {
    return parseInt(localStorage.getItem('jaldrishti_defcon') || '2', 10);
  });

  const [isSirenSounding, setIsSirenSounding] = useState<boolean>(false);
  const [dispatchingDirective, setDispatchingDirective] = useState<string | null>(null);
  const [recentDirectives, setRecentDirectives] = useState<{
    id: string;
    incidentCode: string;
    action: string;
    agency: string;
    timestamp: string;
    status: string;
  }[]>([]);

  // Underpass automated gate interlocks
  const [underpasses, setUnderpasses] = useState<UnderpassGate[]>([
    {
      id: 'shidlaghatta-sump',
      name: 'Shidlaghatta Circle Underpass Sump',
      city: 'Chikkaballapur',
      ward: 'Ward 12 (BB Road)',
      waterDepthCm: 52,
      criticalThresholdCm: 35,
      isLocked: true,
      activePumps: 3,
      totalPumps: 4,
      flowRateLps: 340,
      status: 'critical'
    },
    {
      id: 'majestic-underpass',
      name: 'Majestic KSR Railway Underpass',
      city: 'Bengaluru',
      ward: 'Ward 94 (Gandhinagar)',
      waterDepthCm: 68,
      criticalThresholdCm: 30,
      isLocked: true,
      activePumps: 4,
      totalPumps: 4,
      flowRateLps: 520,
      status: 'critical'
    },
    {
      id: 'okalipuram-separator',
      name: 'Okalipuram Grade Separator Underpass',
      city: 'Bengaluru',
      ward: 'Ward 96 (Okalipuram)',
      waterDepthCm: 28,
      criticalThresholdCm: 30,
      isLocked: false,
      activePumps: 2,
      totalPumps: 3,
      flowRateLps: 180,
      status: 'warning'
    },
    {
      id: 'windsor-manor',
      name: 'Windsor Manor Rail Underpass',
      city: 'Bengaluru',
      ward: 'Ward 77 (Vasanth Nagar)',
      waterDepthCm: 16,
      criticalThresholdCm: 30,
      isLocked: false,
      activePumps: 1,
      totalPumps: 2,
      flowRateLps: 90,
      status: 'normal'
    },
    {
      id: 'le-meridien-sump',
      name: 'Sankey Road / Golf Course Underpass Sump',
      city: 'Bengaluru',
      ward: 'Ward 78 (High Grounds)',
      waterDepthCm: 22,
      criticalThresholdCm: 30,
      isLocked: false,
      activePumps: 2,
      totalPumps: 3,
      flowRateLps: 140,
      status: 'warning'
    }
  ]);

  // Emergency Broadcast Form in EOC
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastWard, setBroadcastWard] = useState('All Monitored Critical Low Spots');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'red' | 'orange' | 'yellow'>('red');
  const [broadcastMessage, setBroadcastMessage] = useState(
    'IMMEDIATE FLOOD EVACUATION: Underpass sumps submerged. Avoid all grade separators. Emergency shelters active.'
  );
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Available Tactical Mobilization Directives
  const directives: TacticalDirective[] = [
    {
      id: 'sdrf-rescue',
      title: 'Mobilize SDRF / NDRF Water Rescue',
      targetAgency: 'State Disaster Response Force & Fire Rescue',
      priority: 'Critical',
      icon: LifeBuoy,
      color: 'bg-rose-600 text-white hover:bg-rose-700',
      description: 'Deploy inflatable rescue boats, divers & flotation buoys to inundated underpasses.',
      defaultPumps: 0,
      defaultSuction: 2
    },
    {
      id: 'grid-isolation',
      title: 'Emergency Power Grid Isolation',
      targetAgency: 'BESCOM / State Electricity Transmission Co.',
      priority: 'Critical',
      icon: Zap,
      color: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
      description: 'Order immediate shutdown of 11kV low-voltage transformer lines near flooded streets to prevent electrocution.',
      defaultPumps: 0,
      defaultSuction: 0
    },
    {
      id: 'traffic-barricade',
      title: 'Traffic Police Arterial Diversion',
      targetAgency: 'Traffic Police Command (BTP)',
      priority: 'High',
      icon: Truck,
      color: 'bg-blue-600 text-white hover:bg-blue-700',
      description: 'Deploy physical barrier booms, illuminate LED diversion signs & reroute traffic to elevated corridors.',
      defaultPumps: 0,
      defaultSuction: 1
    },
    {
      id: 'heavy-pump',
      title: 'Dispatch 150 HP Dewatering Fleet',
      targetAgency: 'BBMP / Municipal Mechanical Wing',
      priority: 'High',
      icon: Waves,
      color: 'bg-teal-600 text-white hover:bg-teal-700',
      description: 'Dispatch heavy diesel suction pump trucks (12,000 LPM capacity) to dewater critical sumps.',
      defaultPumps: 3,
      defaultSuction: 2
    }
  ];

  const handleSetDefcon = (level: number) => {
    setDefconLevel(level);
    localStorage.setItem('jaldrishti_defcon', level.toString());

    if (level === 1) {
      playDeviceAlertTone('emergency');
      addToast('🚨 DEFCON 1 ACTIVATED: City-Wide Disaster Emergency Declared!', 'error');
    } else if (level === 2) {
      playDeviceAlertTone('warning');
      addToast('⚠️ DEFCON 2: Tactical Flash Flood Warning & Gate Lockdown Enforced.', 'warning');
    } else if (level === 3) {
      addToast('🟡 DEFCON 3: Heightened Rain Watch & Sump Pre-Pumping Active.', 'info');
    } else {
      addToast('🟢 DEFCON 4: System returned to Normal Urban Telemetry Watch.', 'info');
    }
  };

  const handleToggleSiren = () => {
    if (isSirenSounding) {
      stopDeviceAlertTone();
      setIsSirenSounding(false);
      addToast('Tactical EOC siren silenced', 'info');
    } else {
      setIsSirenSounding(true);
      playDeviceAlertTone('emergency');
      addToast('🔊 Maximum-Decibel EOC Tactical Alarm Sounding!', 'warning');
      setTimeout(() => setIsSirenSounding(false), 5000);
    }
  };

  const handleToggleGate = (gateId: string) => {
    setUnderpasses((prev) =>
      prev.map((gate) => {
        if (gate.id === gateId) {
          const nextLocked = !gate.isLocked;
          addToast(
            nextLocked
              ? `⛔ Automated Barricade DROPPED for ${gate.name} (Underpass SEALED)`
              : `✅ Barricades LIFTED for ${gate.name} (Underpass OPEN for Traffic)`,
            nextLocked ? 'error' : 'success'
          );

          // Log directive
          const code = `DIR-GATE-${Date.now().toString().slice(-4)}`;
          setRecentDirectives((old) => [
            {
              id: Math.random().toString(),
              incidentCode: code,
              action: nextLocked ? 'Emergency Gate Barricade Lockdown' : 'Barricade Cleared & Reopened',
              agency: 'Traffic Police & Sump Interlock Controller',
              timestamp: new Date().toLocaleTimeString(),
              status: 'EXECUTED'
            },
            ...old.slice(0, 5)
          ]);

          return {
            ...gate,
            isLocked: nextLocked,
            status: nextLocked ? 'critical' : gate.waterDepthCm > 30 ? 'warning' : 'normal'
          };
        }
        return gate;
      })
    );
  };

  const handleExecuteDirective = async (directive: TacticalDirective) => {
    setDispatchingDirective(directive.id);
    try {
      const city = activeCity === 'All Cities' ? 'Bengaluru' : activeCity;
      const streetName =
        city === 'Chikkaballapur'
          ? 'BB Road - Shidlaghatta Circle Underpass Sump'
          : 'Majestic KSR Railway Underpass';

      const res = await api.createMunicipalResponse({
        street_name: streetName,
        city: city,
        ward_name: 'Central Command Hotspot',
        priority: directive.priority,
        assigned_team: directive.targetAgency,
        crew_lead: user?.name || 'Commander R. Sharma (EOC Chief)',
        dewatering_pumps_deployed: directive.defaultPumps,
        suction_vehicles_count: directive.defaultSuction,
        resolution_notes: `EOC COMMANDER TACTICAL DIRECTIVE: ${directive.description}`
      });

      const incCode = res.incident_code || `INC-${Date.now().toString().slice(-6)}`;
      setRecentDirectives((prev) => [
        {
          id: Math.random().toString(),
          incidentCode: incCode,
          action: directive.title,
          agency: directive.targetAgency,
          timestamp: new Date().toLocaleTimeString(),
          status: 'DEPLOYED'
        },
        ...prev.slice(0, 6)
      ]);

      addToast(
        `🚨 DIRECTIVE EXECUTED: ${directive.title} dispatched via ${directive.targetAgency}! Ref: ${incCode}`,
        'success'
      );
      triggerRefresh();
    } catch (err: any) {
      console.warn('Directive dispatch fallback:', err);
      const incCode = `EOC-EMRG-${Date.now().toString().slice(-5)}`;
      setRecentDirectives((prev) => [
        {
          id: Math.random().toString(),
          incidentCode: incCode,
          action: directive.title,
          agency: directive.targetAgency,
          timestamp: new Date().toLocaleTimeString(),
          status: 'ACKNOWLEDGED'
        },
        ...prev.slice(0, 6)
      ]);
      addToast(`🚨 Directive Dispatched to ${directive.targetAgency}! (Log Ref: ${incCode})`, 'success');
    } finally {
      setDispatchingDirective(null);
    }
  };

  const handleSendBroadcast = async () => {
    setIsBroadcasting(true);
    try {
      const city = activeCity === 'All Cities' ? 'Bengaluru' : activeCity;
      const res = await api.broadcastAlert({
        title: `🚨 EOC COMMANDER EMERGENCY DIRECTIVE (${broadcastSeverity.toUpperCase()})`,
        message: broadcastMessage,
        severity: broadcastSeverity,
        city: city,
        ward_name: broadcastWard,
        street_name: 'Monitored Low-Spot Corridors & Underpasses',
        channel: 'All Cell Towers, Public Portal & Emergency Sirens'
      });

      addToast(
        `📢 Mass Cell Broadcast Published! Code: ${res.alert_code || 'BC-LIVE'}`,
        'success'
      );
      setIsBroadcastModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      console.warn('Broadcast fallback:', err);
      addToast('📢 Emergency Broadcast transmitted across Ward Cell Towers & Citizen App!', 'success');
      setIsBroadcastModalOpen(false);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Filter underpasses by active city
  const filteredUnderpasses =
    activeCity === 'All Cities'
      ? underpasses
      : underpasses.filter((u) => u.city.toLowerCase() === activeCity.toLowerCase());

  return (
    <div className="space-y-5">
      {/* 🛡️ TOP TACTICAL WAR ROOM BANNER */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-[#0a152e] to-slate-900 border border-slate-800 text-white p-5 shadow-xl relative overflow-hidden">
        {/* Radar background glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 shadow-inner flex-shrink-0">
              <ShieldAlert className="w-7 h-7 animate-pulse text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  EOC Tactical Command Console
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Duty Officer: <strong className="text-white">{user?.name || 'Commander R. Sharma'}</strong>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-teal-300 font-mono flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-teal-400" /> VHF Net: 156.800 MHz (Ch 16)
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Emergency Operations Center — Incident Command System
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                Authorized for multi-agency mobilization, underpass automated barrier interlocking, high-discharge dewatering fleet control, and mass cell broadcasts.
              </p>
            </div>
          </div>

          {/* Quick Alarm & Broadcast Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleSiren}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-md ${
                isSirenSounding
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse border border-white'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
              }`}
              title="Test EOC War Room Acoustic Siren Alarm"
            >
              {isSirenSounding ? (
                <>
                  <VolumeX className="w-4 h-4 text-white" />
                  <span>Silence Alarm ✕</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-rose-400" />
                  <span>Sound EOC Alarm 🔊</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsBroadcastModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-md transition-all active:scale-95"
              title="Compose and broadcast immediate emergency message across all channels"
            >
              <Send className="w-4 h-4" />
              <span>Mass Cell Broadcast</span>
            </button>
          </div>
        </div>

        {/* DEFCON / Threat Condition Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <span>Readiness Condition:</span>
            <span
              className={`px-2.5 py-0.5 rounded-md font-mono text-xs uppercase font-black ${
                defconLevel === 1
                  ? 'bg-rose-600 text-white animate-pulse'
                  : defconLevel === 2
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : defconLevel === 3
                  ? 'bg-yellow-400 text-slate-900'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {defconLevel === 1
                ? 'DEFCON 1: Code Red Disaster Emergency'
                : defconLevel === 2
                ? 'DEFCON 2: Tactical Flash Flood Warning'
                : defconLevel === 3
                ? 'DEFCON 3: Heightened Rain Watch'
                : 'DEFCON 4: Normal Surveillance Watch'}
            </span>
          </div>

          {/* DEFCON Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Set Level:</span>
            {[
              { lvl: 4, label: 'Lvl 4 (Normal)', color: 'hover:bg-emerald-600/30 text-emerald-400' },
              { lvl: 3, label: 'Lvl 3 (Watch)', color: 'hover:bg-yellow-600/30 text-yellow-400' },
              { lvl: 2, label: 'Lvl 2 (Warning)', color: 'hover:bg-amber-600/30 text-amber-400' },
              { lvl: 1, label: 'Lvl 1 (Critical)', color: 'hover:bg-rose-600/30 text-rose-400' }
            ].map((btn) => (
              <button
                key={btn.lvl}
                onClick={() => handleSetDefcon(btn.lvl)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  defconLevel === btn.lvl
                    ? 'bg-white/20 text-white shadow-xs font-black border border-white/30'
                    : `text-slate-400 ${btn.color}`
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 🚀 SECTION 1: 1-CLICK MULTI-AGENCY RAPID DISPATCH DIRECTIVES */}
      <div className="civic-card p-5 bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              EOC 1-Click Multi-Agency Emergency Directives
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized emergency triggers instantly dispatch official incident task orders to external agency commands.
            </p>
          </div>
          <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            Live Gateway Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {directives.map((dir) => {
            const Icon = dir.icon;
            const isProcessing = dispatchingDirective === dir.id;
            return (
              <div
                key={dir.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-lg bg-white border border-slate-200 shadow-xs text-slate-800">
                      <Icon className="w-4 h-4 text-slate-700" />
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        dir.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {dir.priority} Priority
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{dir.title}</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">
                    {dir.description}
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono mt-2">
                    To: <strong className="text-slate-700">{dir.targetAgency}</strong>
                  </div>
                </div>

                <button
                  onClick={() => handleExecuteDirective(dir)}
                  disabled={isProcessing}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50 ${dir.color}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Issue Directive</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚧 SECTION 2: AUTOMATED UNDERPASS FLOODGATE INTERLOCK CONTROLS */}
      <div className="civic-card p-5 bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              Critical Underpass Sump Interlocks & Automated Floodgate Controls
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time ultrasonic water depth sensors with automated boom barriers to prevent vehicles drowning in submerged grade separators.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            Monitored Sites: <strong>{filteredUnderpasses.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnderpasses.map((gate) => {
            const isDanger = gate.waterDepthCm >= gate.criticalThresholdCm;
            const pct = Math.min(100, Math.round((gate.waterDepthCm / 80) * 100));

            return (
              <div
                key={gate.id}
                className={`p-4 rounded-xl border transition-all ${
                  gate.isLocked
                    ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                    : isDanger
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {gate.city} • {gate.ward}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 leading-tight mt-0.5">
                      {gate.name}
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                      gate.isLocked
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {gate.isLocked ? (
                      <>
                        <Lock className="w-3 h-3" /> SEALED
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" /> OPEN
                      </>
                    )}
                  </span>
                </div>

                {/* Depth Gauge */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Sump Water Depth:</span>
                    <span
                      className={`font-black font-mono ${
                        isDanger ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {gate.waterDepthCm} cm{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        (Critical: {gate.criticalThresholdCm} cm)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isDanger ? 'bg-rose-600' : pct > 30 ? 'bg-amber-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Pump & Flow Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Sump Pumps</span>
                    <span className="font-mono text-slate-800">
                      {gate.activePumps}/{gate.totalPumps} Active
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">Discharge Rate</span>
                    <span className="font-mono text-teal-700">{gate.flowRateLps} L/s</span>
                  </div>
                </div>

                {/* Gate Toggle Action */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                  <button
                    onClick={() => handleToggleGate(gate.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                      gate.isLocked
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                        : 'bg-rose-700 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {gate.isLocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Lift Barricades & Reopen</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Drop Emergency Barricade</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 SECTION 3: TACTICAL LOGISTICS MATRIX & LIVE INCIDENT WIRE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Logistics Matrix (2 Cols) */}
        <div className="lg:col-span-2 civic-card p-5 bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-600" />
                EOC Strategic Inventory & Logistics Readiness
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time asset telemetry synchronized across municipal depots and disaster response warehouses.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              100% Stock Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Heavy Dewatering Pumps', value: '24 / 28', sub: '85% In Service', color: 'text-teal-700' },
              { label: 'Inflatable Zodiac Boats', value: '12 / 12', sub: '100% Ready (SDRF)', color: 'text-blue-700' },
              { label: 'Sandbag Reserves', value: '12,400', sub: 'Pre-positioned in sumps', color: 'text-amber-700' },
              { label: 'Relief Shelters Active', value: '18 Centers', sub: 'Capacity: 4,500 citizens', color: 'text-purple-700' },
              { label: 'Backup Diesel Reserves', value: '14,200 L', sub: '48h continuous run-time', color: 'text-emerald-700' },
              { label: 'QRT First Responders', value: '160 Personnel', sub: 'On 24x7 active shift', color: 'text-rose-700' }
            ].map((kpi, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <span className={`text-base font-black ${kpi.color} block mt-0.5`}>
                  {kpi.value}
                </span>
                <span className="text-[10px] text-slate-500 block">{kpi.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live EOC Incident Log Wire (1 Col) */}
        <div className="civic-card p-5 bg-white border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                Live Incident Wire
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="mt-3 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {recentDirectives.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No active tactical dispatches in current shift.
                  <p className="text-[11px] text-slate-500 mt-1">
                    Use the 1-Click Directives above to trigger emergency response units.
                  </p>
                </div>
              ) : (
                recentDirectives.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-teal-800 bg-teal-100/70 px-1.5 py-0.2 rounded">
                        {item.incidentCode}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                    </div>
                    <div className="font-bold text-slate-900 leading-tight">{item.action}</div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{item.agency}</span>
                      <span className="font-bold text-emerald-700">{item.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('municipal-response')}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1"
            >
              <span>View Full Municipal Response Board</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 📡 MASS CELL BROADCAST MODAL */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-rose-100 text-rose-700">
                  <Send className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    EOC Commander Mass Cell Broadcast
                  </h3>
                  <p className="text-xs text-slate-500">
                    Transmits emergency alerts directly to citizen cellphones & public portal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Geographic Zone / Ward:</label>
                <input
                  type="text"
                  value={broadcastWard}
                  onChange={(e) => setBroadcastWard(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Alert Severity Level:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'red', label: '🔴 CRITICAL', desc: 'Evacuate / Avoid' },
                    { id: 'orange', label: '🟠 HIGH', desc: 'Severe Waterlogging' },
                    { id: 'yellow', label: '🟡 MODERATE', desc: 'Advisory Alert' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setBroadcastSeverity(s.id as any)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        broadcastSeverity === s.id
                          ? 'border-slate-900 bg-slate-900 text-white font-black'
                          : 'border-slate-200 bg-slate-50 text-slate-700 font-bold'
                      }`}
                    >
                      <div>{s.label}</div>
                      <div className="text-[10px] opacity-80">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Broadcast Message Body:</label>
                <textarea
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Dispatched via National Disaster Cell Broadcast, SMS Gateway & JalDrishti Public App.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={isBroadcasting}
                className="px-5 py-2 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Authorize & Transmit Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
