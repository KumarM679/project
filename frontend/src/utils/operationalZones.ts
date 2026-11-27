/**
 * Official Operational Zones and Monitored Places Database Mapping.
 * Matches 1:1 with the backend SQLite `streets` table.
 */

export interface MonitoredPlace {
  id: number;
  name: string;
  ward_name: string;
  city: string;
  latitude: number;
  longitude: number;
  default_risk: 'Critical' | 'High' | 'Medium' | 'Low';
  advisory: string;
}

export const OPERATIONAL_ZONES = [
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Vijayawada',
  'Mysuru',
  'Chikkaballapur'
] as const;

export type OperationalZoneCity = typeof OPERATIONAL_ZONES[number];

export const MONITORED_PLACES_BY_ZONE: Record<string, MonitoredPlace[]> = {
  Bengaluru: [
    {
      id: 1,
      name: 'Silk Board Junction Low-Lying Underpass',
      ward_name: 'BTM Layout',
      city: 'Bengaluru',
      latitude: 12.9172,
      longitude: 77.6228,
      default_risk: 'Critical',
      advisory: 'Heavy sump basin accumulation. Divert via elevated flyover to Electronic City.'
    },
    {
      id: 2,
      name: 'Outer Ring Road - Bellandur Ecospace Stretch',
      ward_name: 'Bellandur',
      city: 'Bengaluru',
      latitude: 12.9260,
      longitude: 77.6834,
      default_risk: 'High',
      advisory: 'Curbside canal overflow across tech corridor. Use Marathahalli inner ring road.'
    },
    {
      id: 3,
      name: 'Manyata Tech Park Flyover Down-Ramp',
      ward_name: 'Nagavara',
      city: 'Bengaluru',
      latitude: 13.0475,
      longitude: 77.6200,
      default_risk: 'High',
      advisory: 'Ramp runoff pooling. Maintain 20 km/h crawl speed or use service bypass.'
    },
    {
      id: 4,
      name: 'Shantinagar Double Road (KSRTC Bus Depot)',
      ward_name: 'Shantinagar',
      city: 'Bengaluru',
      latitude: 12.9568,
      longitude: 77.5954,
      default_risk: 'Medium',
      advisory: 'Bus bay curbside ponding. Move towards central elevated lanes.'
    },
    {
      id: 5,
      name: 'Richmond Road Flyover Underpass',
      ward_name: 'Shanthala Nagar',
      city: 'Bengaluru',
      latitude: 12.9660,
      longitude: 77.6042,
      default_risk: 'Medium',
      advisory: 'Storm grate intake backflow. Avoid low underpass dip during heavy downpours.'
    },
    {
      id: 6,
      name: 'Koramangala 80 Feet Road (Near 4th Block)',
      ward_name: 'Koramangala',
      city: 'Bengaluru',
      latitude: 12.9345,
      longitude: 77.6272,
      default_risk: 'High',
      advisory: 'Commercial corridor storm overflow. Divert via 100ft road or Sarjapur road.'
    },
    {
      id: 7,
      name: 'Sony World Junction Catchment',
      ward_name: 'Ejipura',
      city: 'Bengaluru',
      latitude: 12.9378,
      longitude: 77.6288,
      default_risk: 'High',
      advisory: 'Intersection basin pooling. Proceed with crawl speed.'
    },
    {
      id: 8,
      name: 'Hebbal Lake Downstream Feeder Road',
      ward_name: 'Hebbal',
      city: 'Bengaluru',
      latitude: 13.0358,
      longitude: 77.5970,
      default_risk: 'Critical',
      advisory: 'Airport expressway approach lake feeder runoff. Divert to main elevated lane.'
    },
    {
      id: 9,
      name: 'Majestic KSR Railway Underpass',
      ward_name: 'Gandhinagar',
      city: 'Bengaluru',
      latitude: 12.9772,
      longitude: 77.5714,
      default_risk: 'Critical',
      advisory: 'Railway underpass low point. Use Anand Rao Circle flyover to avoid flooding.'
    },
    {
      id: 10,
      name: 'Indiranagar 100ft Road (12th Main Crossing)',
      ward_name: 'Indiranagar',
      city: 'Bengaluru',
      latitude: 12.9719,
      longitude: 77.6412,
      default_risk: 'Low',
      advisory: 'Minor roadside gully water pooling. Normal movement permissible.'
    }
  ],
  Hyderabad: [
    {
      id: 11,
      name: 'Madhapur Hitec City Cyber Towers Junction',
      ward_name: 'Madhapur',
      city: 'Hyderabad',
      latitude: 17.4504,
      longitude: 78.3808,
      default_risk: 'High',
      advisory: 'IT corridor underpass dip pooling. Use cable bridge elevated access.'
    },
    {
      id: 12,
      name: 'Tolichowki Flyover Underpass Basin',
      ward_name: 'Tolichowki',
      city: 'Hyderabad',
      latitude: 17.3995,
      longitude: 78.4140,
      default_risk: 'Critical',
      advisory: 'Low-lying basin flooding. Heavy ponding under flyover pillars. Divert via Mehdipatnam.'
    },
    {
      id: 13,
      name: 'Begumpet Shyamlal Building Road',
      ward_name: 'Begumpet',
      city: 'Hyderabad',
      latitude: 17.4442,
      longitude: 78.4682,
      default_risk: 'Critical',
      advisory: 'Railway track corridor water accumulation. Take Prakash Nagar flyover.'
    },
    {
      id: 14,
      name: 'Gachibowli Outer Ring Road Slip Road',
      ward_name: 'Gachibowli',
      city: 'Hyderabad',
      latitude: 17.4362,
      longitude: 78.3582,
      default_risk: 'Medium',
      advisory: 'ORR interchange slip road curb pooling. Maintain lane discipline.'
    }
  ],
  Chennai: [
    {
      id: 15,
      name: 'Velachery Bypass Road (Near Vijayanagar)',
      ward_name: 'Velachery',
      city: 'Chennai',
      latitude: 12.9815,
      longitude: 80.2180,
      default_risk: 'Critical',
      advisory: 'Lake overflow basin choke point. Divert via Taramani link road.'
    },
    {
      id: 16,
      name: 'T Nagar Usman Road Flyover Base',
      ward_name: 'T. Nagar',
      city: 'Chennai',
      latitude: 13.0418,
      longitude: 80.2341,
      default_risk: 'High',
      advisory: 'Shopping arterial street flooding. Take South Boag road detour.'
    },
    {
      id: 17,
      name: 'Koyambedu Wholesale Market Link Road',
      ward_name: 'Koyambedu',
      city: 'Chennai',
      latitude: 13.0694,
      longitude: 80.1948,
      default_risk: 'High',
      advisory: 'Storm canal feeder depression. Commercial vehicles proceed at crawl speed.'
    },
    {
      id: 18,
      name: 'Madipakkam Main Road Low Depression',
      ward_name: 'Madipakkam',
      city: 'Chennai',
      latitude: 12.9647,
      longitude: 80.1961,
      default_risk: 'Critical',
      advisory: 'Suburban lake basin overflow. Avoid two-wheeler transit.'
    }
  ],
  Pune: [
    {
      id: 19,
      name: 'Shivajinagar Sancheti Hospital Underpass',
      ward_name: 'Shivajinagar',
      city: 'Pune',
      latitude: 18.5308,
      longitude: 73.8527,
      default_risk: 'Critical',
      advisory: 'Subway water ingress during heavy Mula-Mutha surges. Divert via COEP flyover.'
    },
    {
      id: 20,
      name: 'Swargate Chowk Sub-Grade Connector',
      ward_name: 'Swargate',
      city: 'Pune',
      latitude: 18.5018,
      longitude: 73.8586,
      default_risk: 'High',
      advisory: 'Underground connector pooling. Divert through Tilak Road.'
    },
    {
      id: 21,
      name: 'Hinjewadi Phase 1 Circle',
      ward_name: 'Hinjewadi',
      city: 'Pune',
      latitude: 18.5913,
      longitude: 73.7389,
      default_risk: 'Medium',
      advisory: 'Tech park roundabout runoff. Use phase 2 bypass corridor.'
    }
  ],
  Vijayawada: [
    {
      id: 22,
      name: 'Benz Circle Underpass Crossing',
      ward_name: 'Benz Circle',
      city: 'Vijayawada',
      latitude: 16.5005,
      longitude: 80.6480,
      default_risk: 'Critical',
      advisory: 'Arterial highway underpass storm pooling. Divert to upper elevated expressway.'
    },
    {
      id: 23,
      name: 'MG Road (Bandar Road) Commercial Corridor',
      ward_name: 'Governorpet',
      city: 'Vijayawada',
      latitude: 16.5126,
      longitude: 80.6356,
      default_risk: 'Medium',
      advisory: 'Commercial storm drain backpressure. Stay in center lanes.'
    },
    {
      id: 24,
      name: 'One Town Canal Bank Relief Road',
      ward_name: 'One Town',
      city: 'Vijayawada',
      latitude: 16.5180,
      longitude: 80.6120,
      default_risk: 'High',
      advisory: 'Krishna canal bank low contour. Avoid riverfront slip roads.'
    }
  ],
  Mysuru: [
    {
      id: 25,
      name: 'Sayyaji Rao Road Heritage Corridor',
      ward_name: 'Mandi Mohalla',
      city: 'Mysuru',
      latitude: 12.3168,
      longitude: 76.6508,
      default_risk: 'High',
      advisory: 'Heritage underpass depression. Divert via Irwin Road.'
    },
    {
      id: 26,
      name: 'D. Devaraj Urs Road Shopping Precinct',
      ward_name: 'Subbarayanakere',
      city: 'Mysuru',
      latitude: 12.3082,
      longitude: 76.6472,
      default_risk: 'Medium',
      advisory: 'Roadside curbside ponding. Proceed with caution.'
    },
    {
      id: 27,
      name: 'Kuvempunagar Double Road Low Point',
      ward_name: 'Kuvempunagar',
      city: 'Mysuru',
      latitude: 12.2885,
      longitude: 76.6268,
      default_risk: 'High',
      advisory: 'Low-contour drainage basin. Take outer ring road bypass.'
    }
  ],
  Chikkaballapur: [
    {
      id: 28,
      name: 'BB Road - Shidlaghatta Circle Underpass Sump',
      ward_name: 'Shidlaghatta Circle',
      city: 'Chikkaballapur',
      latitude: 13.4355,
      longitude: 77.7290,
      default_risk: 'Critical',
      advisory: 'Severe sump flood depression. Immediate road closure recommended. Avoid underpass completely.'
    },
    {
      id: 30,
      name: 'Chikkaballapur Old Bus Stand Low Depression',
      ward_name: 'Central Town',
      city: 'Chikkaballapur',
      latitude: 13.4310,
      longitude: 77.7240,
      default_risk: 'High',
      advisory: 'Commercial basin waterlogging. Move towards elevated central road.'
    },
    {
      id: 29,
      name: 'Kandavara Lake Inflow Feeder Road',
      ward_name: 'Kandavara',
      city: 'Chikkaballapur',
      latitude: 13.4280,
      longitude: 77.7340,
      default_risk: 'Medium',
      advisory: 'Lake surplus backflow on curbside. Maintain crawl speed.'
    },
    {
      id: 31,
      name: 'Prashanth Nagar Main Elevated Ridge Road',
      ward_name: 'Prashanth Nagar',
      city: 'Chikkaballapur',
      latitude: 13.4410,
      longitude: 77.7210,
      default_risk: 'Low',
      advisory: 'Elevated ridgeline corridor with high drainage capacity. Normal movement permissible.'
    }
  ]
};

/**
 * Returns all monitored places for a given operational zone city.
 * Normalizes both 'Chikkaballapur' and 'Chikkabalupur'.
 */
export function getPlacesForZone(city: string): MonitoredPlace[] {
  if (city === 'All Cities') {
    return Object.values(MONITORED_PLACES_BY_ZONE).flat();
  }
  const normalized = (city || '').toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('chikkaba')) {
    return MONITORED_PLACES_BY_ZONE['Chikkaballapur'] || [];
  }
  if (MONITORED_PLACES_BY_ZONE[city]) {
    return MONITORED_PLACES_BY_ZONE[city];
  }
  return Object.values(MONITORED_PLACES_BY_ZONE).flat();
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Finds the nearest monitored choke point / underpass to the provided coordinates.
 */
export function findNearestMonitoredPlace(
  userLat: number,
  userLng: number,
  city?: string
): { place: MonitoredPlace; distanceKm: number } {
  const candidates = city && city !== 'All Cities' && MONITORED_PLACES_BY_ZONE[city]
    ? MONITORED_PLACES_BY_ZONE[city]
    : Object.values(MONITORED_PLACES_BY_ZONE).flat();

  let closest = candidates[0];
  let minDistance = calculateDistanceKm(userLat, userLng, closest.latitude, closest.longitude);

  for (let i = 1; i < candidates.length; i++) {
    const d = calculateDistanceKm(userLat, userLng, candidates[i].latitude, candidates[i].longitude);
    if (d < minDistance) {
      minDistance = d;
      closest = candidates[i];
    }
  }

  return { place: closest, distanceKm: minDistance };
}

export interface ZoneLocationMetadata {
  state: string;
  district: string;
  defaultPincode: string;
  defaultWardNo: string;
  wards: { wardNo: string; wardName: string }[];
}

export const ZONE_LOCATION_METADATA: Record<string, ZoneLocationMetadata> = {
  Chikkaballapur: {
    state: 'Karnataka',
    district: 'Chikkaballapur',
    defaultPincode: '562101',
    defaultWardNo: 'Ward 12',
    wards: [
      { wardNo: 'Ward 12', wardName: 'Shidlaghatta Circle' },
      { wardNo: 'Ward 05', wardName: 'Central Town' },
      { wardNo: 'Ward 08', wardName: 'Kandavara' },
      { wardNo: 'Ward 03', wardName: 'Prashanth Nagar' },
    ]
  },
  Bengaluru: {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    defaultPincode: '560068',
    defaultWardNo: 'Ward 176',
    wards: [
      { wardNo: 'Ward 176', wardName: 'BTM Layout' },
      { wardNo: 'Ward 150', wardName: 'Bellandur' },
      { wardNo: 'Ward 023', wardName: 'Nagavara' },
      { wardNo: 'Ward 117', wardName: 'Shantinagar' },
      { wardNo: 'Ward 111', wardName: 'Shanthala Nagar' },
      { wardNo: 'Ward 151', wardName: 'Koramangala' },
      { wardNo: 'Ward 148', wardName: 'Ejipura' },
      { wardNo: 'Ward 007', wardName: 'Hebbal' },
      { wardNo: 'Ward 094', wardName: 'Gandhinagar / Majestic' },
      { wardNo: 'Ward 112', wardName: 'Indiranagar' },
    ]
  },
  Hyderabad: {
    state: 'Telangana',
    district: 'Hyderabad',
    defaultPincode: '500081',
    defaultWardNo: 'Circle 20',
    wards: [
      { wardNo: 'Circle 20', wardName: 'Madhapur' },
      { wardNo: 'Circle 13', wardName: 'Tolichowki' },
      { wardNo: 'Circle 18', wardName: 'Begumpet' },
      { wardNo: 'Circle 19', wardName: 'Gachibowli' },
    ]
  },
  Chennai: {
    state: 'Tamil Nadu',
    district: 'Chennai',
    defaultPincode: '600042',
    defaultWardNo: 'Zone 13',
    wards: [
      { wardNo: 'Zone 13', wardName: 'Velachery' },
      { wardNo: 'Zone 10', wardName: 'T. Nagar' },
      { wardNo: 'Zone 08', wardName: 'Koyambedu' },
      { wardNo: 'Zone 14', wardName: 'Madipakkam' },
    ]
  },
  Pune: {
    state: 'Maharashtra',
    district: 'Pune',
    defaultPincode: '411005',
    defaultWardNo: 'Prabhag 07',
    wards: [
      { wardNo: 'Prabhag 07', wardName: 'Shivajinagar' },
      { wardNo: 'Prabhag 19', wardName: 'Swargate' },
      { wardNo: 'Prabhag 02', wardName: 'Hinjewadi' },
    ]
  },
  Vijayawada: {
    state: 'Andhra Pradesh',
    district: 'NTR / Krishna',
    defaultPincode: '520010',
    defaultWardNo: 'Ward 12',
    wards: [
      { wardNo: 'Ward 12', wardName: 'Benz Circle' },
      { wardNo: 'Ward 08', wardName: 'Governorpet' },
      { wardNo: 'Ward 03', wardName: 'One Town' },
    ]
  },
  Mysuru: {
    state: 'Karnataka',
    district: 'Mysuru',
    defaultPincode: '570001',
    defaultWardNo: 'Ward 22',
    wards: [
      { wardNo: 'Ward 22', wardName: 'Mandi Mohalla' },
      { wardNo: 'Ward 25', wardName: 'Subbarayanakere' },
      { wardNo: 'Ward 48', wardName: 'Kuvempunagar' },
    ]
  }
};

export const INDIAN_STATES = [
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Tamil Nadu',
  'Maharashtra',
  'Kerala',
  'Goa',
  'Gujarat',
  'Delhi',
  'Rajasthan',
  'Uttar Pradesh',
  'West Bengal'
];

