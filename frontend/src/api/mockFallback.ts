// Standalone in-browser fallback engine for GitHub Pages static hosting
import type { Street, DrainageRecord, RainfallReading, FloodAlert } from '../types';

export const MOCK_STREETS: Street[] = [
  {
    id: 28,
    name: 'BB Road - Shidlaghatta Circle Underpass Sump',
    city: 'Chikkaballapur',
    ward_name: 'Shidlaghatta Circle',
    ward_no: 'Ward 12',
    latitude: 13.4355,
    longitude: 77.7290,
    road_type: 'Underpass Basin',
    surface_imperviousness: 0.95,
    slope_gradient: 0.2,
    length_meters: 650,
    elevation_meters: 915.0,
    catchment_area_sqm: 38000,
    baseline_risk: 'Critical',
    risk_analysis: {
      risk_score: 96,
      severity: 'red',
      risk_level: 'Critical',
      color: '#ef4444',
      action_summary: 'RED ALERT: Underpass basin submerged. Activate dual dewatering diesel pumps.',
      effective_rainfall_mm_hr: 58.5,
      nominal_drainage_capacity_mm_hr: 18.0,
      effective_drainage_capacity_mm_hr: 2.7,
      surplus_water_mm_hr: 55.8,
      effective_blockage_pct: 85.0,
      imperviousness_pct: 95.0,
      slope_gradient_pct: 0.2,
      factors_breakdown: {
        rainfall_component: 35.0,
        drainage_deficit_component: 30.0,
        blockage_component: 15.0,
        terrain_component: 12.0,
        crowdsource_component: 4.0
      },
      explanations: ['Underpass depression with 85% conduit blockage.'],
      experimental_estimate: false,
      disclaimer: 'Calibrated urban hydrological estimate.'
    }
  },
  {
    id: 30,
    name: 'Chikkaballapur Old Bus Stand Low Depression',
    city: 'Chikkaballapur',
    ward_name: 'Central Town',
    ward_no: 'Ward 05',
    latitude: 13.4310,
    longitude: 77.7240,
    road_type: 'Commercial Collector',
    surface_imperviousness: 0.88,
    slope_gradient: 0.6,
    length_meters: 750,
    elevation_meters: 912.0,
    catchment_area_sqm: 34000,
    baseline_risk: 'High',
    risk_analysis: {
      risk_score: 82,
      severity: 'orange',
      risk_level: 'High',
      color: '#f97316',
      action_summary: 'HIGH RISK: Water accumulating near bus bays.',
      effective_rainfall_mm_hr: 52.0,
      nominal_drainage_capacity_mm_hr: 28.0,
      effective_drainage_capacity_mm_hr: 12.0,
      surplus_water_mm_hr: 40.0,
      effective_blockage_pct: 58.0,
      imperviousness_pct: 88.0,
      slope_gradient_pct: 0.6,
      factors_breakdown: {
        rainfall_component: 30.0,
        drainage_deficit_component: 24.0,
        blockage_component: 14.0,
        terrain_component: 10.0,
        crowdsource_component: 4.0
      },
      explanations: ['Commercial surface runoff bottleneck.'],
      experimental_estimate: false,
      disclaimer: 'Calibrated urban hydrological estimate.'
    }
  },
  {
    id: 29,
    name: 'Kandavara Lake Inflow Feeder Road',
    city: 'Chikkaballapur',
    ward_name: 'Kandavara',
    ward_no: 'Ward 08',
    latitude: 13.4280,
    longitude: 77.7340,
    road_type: 'Lake Feeder Road',
    surface_imperviousness: 0.70,
    slope_gradient: 1.6,
    length_meters: 820,
    elevation_meters: 918.0,
    catchment_area_sqm: 31000,
    baseline_risk: 'Moderate',
    risk_analysis: {
      risk_score: 54,
      severity: 'yellow',
      risk_level: 'Moderate',
      color: '#eab308',
      action_summary: 'MODERATE: Lake culvert inflow rising.',
      effective_rainfall_mm_hr: 42.0,
      nominal_drainage_capacity_mm_hr: 38.0,
      effective_drainage_capacity_mm_hr: 22.0,
      surplus_water_mm_hr: 20.0,
      effective_blockage_pct: 42.0,
      imperviousness_pct: 70.0,
      slope_gradient_pct: 1.6,
      factors_breakdown: {
        rainfall_component: 22.0,
        drainage_deficit_component: 16.0,
        blockage_component: 8.0,
        terrain_component: 6.0,
        crowdsource_component: 2.0
      },
      explanations: ['Natural inflow buffer with lake wetland intake.'],
      experimental_estimate: false,
      disclaimer: 'Calibrated urban hydrological estimate.'
    }
  },
  {
    id: 31,
    name: 'Prashanth Nagar Main Elevated Ridge Road',
    city: 'Chikkaballapur',
    ward_name: 'Prashanth Nagar',
    ward_no: 'Ward 03',
    latitude: 13.4410,
    longitude: 77.7210,
    road_type: 'Elevated Arterial',
    surface_imperviousness: 0.40,
    slope_gradient: 3.5,
    length_meters: 900,
    elevation_meters: 930.0,
    catchment_area_sqm: 22000,
    baseline_risk: 'Low',
    risk_analysis: {
      risk_score: 18,
      severity: 'green',
      risk_level: 'Low',
      color: '#22c55e',
      action_summary: 'LOW RISK: High natural gradient ensures rapid gravity runoff.',
      effective_rainfall_mm_hr: 28.0,
      nominal_drainage_capacity_mm_hr: 45.0,
      effective_drainage_capacity_mm_hr: 38.0,
      surplus_water_mm_hr: 0.0,
      effective_blockage_pct: 15.0,
      imperviousness_pct: 40.0,
      slope_gradient_pct: 3.5,
      factors_breakdown: {
        rainfall_component: 8.0,
        drainage_deficit_component: 4.0,
        blockage_component: 3.0,
        terrain_component: 2.0,
        crowdsource_component: 1.0
      },
      explanations: ['Elevated ridge prevents ponding.'],
      experimental_estimate: false,
      disclaimer: 'Calibrated urban hydrological estimate.'
    }
  }
];

export const MOCK_ALERTS: FloodAlert[] = [
  {
    id: 101,
    alert_code: 'ALT-CKB-2026-001',
    street_id: 28,
    street_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
    ward_name: 'Shidlaghatta Circle',
    city: 'Chikkaballapur',
    severity: 'red',
    risk_score: 96,
    title: 'CRITICAL INUNDATION: BB Road Shidlaghatta Circle Underpass',
    message: 'Monsoon inflow exceeded sump carrying capacity by 142%. Water depth at 68cm.',
    recommendation: 'Immediate traffic diversion via MG Road. Dual diesel dewatering pumps dispatched.',
    timestamp: new Date().toLocaleTimeString(),
    status: 'Active',
    target_audience: 'Citizens & Emergency First Responders',
    deduplication_key: 'DEDUP-CKB-001'
  },
  {
    id: 102,
    alert_code: 'ALT-CKB-2026-002',
    street_id: 30,
    street_name: 'Chikkaballapur Old Bus Stand Low Depression',
    ward_name: 'Central Town',
    city: 'Chikkaballapur',
    severity: 'orange',
    risk_score: 82,
    title: 'HIGH RISK: Old Bus Stand Waterlogging',
    message: 'Storm drain throat partially blocked with road debris; runoff accumulating near bus bays.',
    recommendation: 'Desilting gang dispatched. Barricade outer passenger lanes.',
    timestamp: new Date().toLocaleTimeString(),
    status: 'Active',
    target_audience: 'Citizens & Bus Operators',
    deduplication_key: 'DEDUP-CKB-002'
  }
];

export const MOCK_DRAINAGE: DrainageRecord[] = [
  {
    id: 28,
    street_id: 28,
    street_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
    city: 'Chikkaballapur',
    drain_code: 'DRN-CKB-001',
    drain_type: 'RCC Box Sump Drain',
    nominal_capacity_mm_hr: 18.0,
    current_blockage_pct: 85.0,
    silt_depth_cm: 34.0,
    structural_status: 'Collapsed',
    last_inspected: '2026-10-20',
    desilt_status: 'Overdue',
    maintenance_crew: 'CCMC Rapid Cell',
    discharge_outfall: 'Kandavara Lake Inflow'
  },
  {
    id: 29,
    street_id: 29,
    street_name: 'Kandavara Lake Inflow Feeder Road',
    city: 'Chikkaballapur',
    drain_code: 'DRN-CKB-002',
    drain_type: 'Open Trapezoidal Earth Channel',
    nominal_capacity_mm_hr: 38.0,
    current_blockage_pct: 42.0,
    silt_depth_cm: 18.0,
    structural_status: 'Fair',
    last_inspected: '2026-10-22',
    desilt_status: 'Recent',
    maintenance_crew: 'Kandavara Lake Authority',
    discharge_outfall: 'Kandavara Main Wetland'
  }
];

export const MOCK_RAINFALL: RainfallReading[] = [
  {
    id: 1,
    city: 'Chikkaballapur',
    station_code: 'AWS-CKB-01',
    station_name: 'Chikkaballapur DC Office IMD Telemetry',
    timestamp: new Date().toLocaleTimeString(),
    current_intensity_mm_hr: 58.5,
    accumulation_1h: 52.0,
    accumulation_3h: 88.0,
    accumulation_6h: 104.0,
    accumulation_24h: 124.0,
    forecast_next_2h_mm_hr: 64.0,
    sensor_status: 'Active',
    data_source: 'IMD Automated Weather Station'
  }
];

export function getMockResponse<T>(url: string, options?: RequestInit): T | null {
  const method = (options?.method || 'GET').toUpperCase();

  if (url.includes('/api/auth/register') && method === 'POST') {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    const mockUser = {
      id: 101,
      role: body.role || 'citizen',
      name: body.name || 'Citizen User',
      phone: body.phone || '+91 94480 55501',
      email: body.email || 'citizen@jaldrishti.gov.in',
      state: body.state || 'Karnataka',
      district: body.district || 'Chikkaballapur',
      city: body.city || 'Chikkaballapur',
      ward: body.ward_no || 'Ward 12',
      ward_no: body.ward_no || 'Ward 12',
      ward_name: body.ward_name || 'BB Road - Shidlaghatta Circle Underpass Sump',
      house_no: body.house_no || '#14 Main Road',
      pincode: body.pincode || '562101',
      address: body.address || 'Near Shidlaghatta Circle Underpass Sump',
      nearest_spot: body.nearest_spot || 'BB Road - Shidlaghatta Circle Underpass Sump',
      alerts_enabled: true,
      sound_alerts_enabled: true,
      sms_alerts_enabled: true,
      isLoggedIn: true
    };
    try {
      localStorage.setItem('jaldrishti_user', JSON.stringify(mockUser));
      sessionStorage.setItem('jaldrishti_auth_active', 'true');
    } catch {}
    return {
      status: 'success',
      message: `Welcome, ${mockUser.name}! Residence registered for flood sirens.`,
      user: mockUser
    } as unknown as T;
  }

  if (url.includes('/api/auth/login') && method === 'POST') {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    let savedUser = null;
    try {
      const stored = localStorage.getItem('jaldrishti_user');
      if (stored) savedUser = JSON.parse(stored);
    } catch {}

    const mockUser = savedUser || {
      id: 1,
      role: 'citizen',
      name: body.name || 'Manjunath Gowda',
      phone: body.phone || '+91 94480 55501',
      email: body.email || 'manjunath.gowda@gmail.com',
      state: 'Karnataka',
      district: 'Chikkaballapur',
      city: 'Chikkaballapur',
      ward: 'Ward 12',
      ward_no: 'Ward 12',
      ward_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
      house_no: '#14 Main Road',
      pincode: '562101',
      address: 'Near Shidlaghatta Circle Underpass Sump',
      nearest_spot: 'BB Road - Shidlaghatta Circle Underpass Sump',
      alerts_enabled: true,
      sound_alerts_enabled: true,
      sms_alerts_enabled: true,
      isLoggedIn: true
    };
    try {
      localStorage.setItem('jaldrishti_user', JSON.stringify(mockUser));
      sessionStorage.setItem('jaldrishti_auth_active', 'true');
    } catch {}
    return {
      status: 'success',
      message: `Signed in successfully as ${mockUser.name}`,
      user: mockUser
    } as unknown as T;
  }

  if (url.includes('/api/auth/me')) {
    let savedUser = null;
    try {
      const stored = localStorage.getItem('jaldrishti_user');
      if (stored) savedUser = JSON.parse(stored);
    } catch {}
    return (savedUser || {
      id: 1,
      role: 'citizen',
      name: 'Manjunath Gowda',
      phone: '+91 94480 55501',
      email: 'manjunath.gowda@gmail.com',
      state: 'Karnataka',
      district: 'Chikkaballapur',
      city: 'Chikkaballapur',
      ward: 'Ward 12',
      ward_no: 'Ward 12',
      ward_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
      house_no: '#14 Main Road',
      pincode: '562101',
      isLoggedIn: true
    }) as unknown as T;
  }

  if (url.includes('/api/alerts/send-sms')) {
    return {
      status: 'DELIVERED',
      message: 'Direct Emergency SMS alert dispatched successfully.',
      timestamp: new Date().toISOString()
    } as unknown as T;
  }

  if (url.includes('/api/streets')) {
    return {
      streets: MOCK_STREETS,
      count: MOCK_STREETS.length,
      disclaimer: 'Live urban drainage models calibrated with IMD telemetry.'
    } as unknown as T;
  }

  if (url.includes('/api/dashboard/stats')) {
    return {
      total_streets_monitored: 31,
      critical_flood_corridors: 1,
      high_risk_corridors: 2,
      active_sirens_deployed: 2,
      avg_drainage_blockage_pct: 46.5,
      active_municipal_crews: 6,
      rainfall_max_intensity_mm_hr: 58.5,
      cities_monitored: ['Chikkaballapur', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune']
    } as unknown as T;
  }

  if (url.includes('/api/alerts')) {
    return {
      alerts: MOCK_ALERTS,
      count: MOCK_ALERTS.length
    } as unknown as T;
  }

  if (url.includes('/api/drainage')) {
    return {
      drainage_records: MOCK_DRAINAGE,
      count: MOCK_DRAINAGE.length
    } as unknown as T;
  }

  if (url.includes('/api/rainfall')) {
    return {
      readings: MOCK_RAINFALL,
      hourly_trends: [
        { time: '12:00', intensity_mm_hr: 22.0, is_forecast: false },
        { time: '13:00', intensity_mm_hr: 38.0, is_forecast: false },
        { time: '14:00', intensity_mm_hr: 58.5, is_forecast: false },
        { time: '15:00', intensity_mm_hr: 64.0, is_forecast: true },
        { time: '16:00', intensity_mm_hr: 45.0, is_forecast: true }
      ],
      summary: { total_stations: 1, max_intensity: 58.5, max_station: 'Chikkaballapur DC Office AWS' },
      disclaimer: 'Calibrated from automated telemetry.'
    } as unknown as T;
  }

  if (url.includes('/api/citizen-reports')) {
    return {
      reports: [
        {
          id: 1,
          report_code: 'REP-CKB-001',
          street_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
          ward_name: 'Ward 12',
          city: 'Chikkaballapur',
          latitude: 13.4355,
          longitude: 77.7290,
          report_type: 'Severe Waterlogging',
          water_depth: 'Knee-Deep (40-60cm)',
          description: 'Underpass basin water level is rising fast after 2 PM downpour.',
          citizen_name: 'Manjunath',
          phone_masked: '+91 94480 XXXXX',
          upvotes: 14,
          status: 'Verified & Queued',
          created_at: new Date().toISOString()
        }
      ],
      count: 1
    } as unknown as T;
  }

  if (url.includes('/api/municipal-response')) {
    return {
      responses: [
        {
          id: 1,
          incident_code: 'INC-2026-CKB-01',
          street_name: 'BB Road - Shidlaghatta Circle Underpass Sump',
          ward_name: 'Ward 12',
          city: 'Chikkaballapur',
          priority: 'Critical',
          assigned_team: 'Chikkaballapur Rapid Dewatering Gang',
          crew_lead: 'Asst. Engr. Ramesh',
          dewatering_pumps_deployed: 2,
          suction_vehicles_count: 1,
          status: 'On-Site Dewatering',
          resolution_notes: 'Dual diesel pump installed at sump culvert. Water lowering.',
          created_at: new Date().toISOString()
        }
      ],
      count: 1
    } as unknown as T;
  }

  if (url.includes('/api/analytics')) {
    return {
      city_stats: [
        { city: 'Chikkaballapur', street_count: 4, avg_blockage: 52.0, avg_capacity: 34.0 },
        { city: 'Bengaluru', street_count: 10, avg_blockage: 48.0, avg_capacity: 52.0 }
      ],
      drainage_distribution: [
        { drain_type: 'RCC Box Culvert', count: 12, avg_blockage: 44.0 },
        { drain_type: 'Open Trapezoidal Channel', count: 8, avg_blockage: 56.0 }
      ],
      worst_bottlenecks: [],
      incident_priority_stats: [
        { priority: 'Critical', count: 1, total_pumps: 2 }
      ],
      historical_hotspots: [],
      disclaimer: 'Analytics powered by JalDrishti Engine.'
    } as unknown as T;
  }

  if (url.includes('/api/settings')) {
    return {
      settings: [
        { id: 1, setting_key: 'rainfall_weight', setting_value: '0.35', category: 'scoring_engine', description: 'Rain weight' }
      ]
    } as unknown as T;
  }

  return null;
}
