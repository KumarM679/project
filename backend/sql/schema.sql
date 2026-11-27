-- ============================================================================
-- JalDrishti: Urban Flood Nowcasting System
-- Database Schema (SQL DDL)
-- Target RDBMS: SQLite / ANSI SQL-92 Compatible
-- ============================================================================

-- 1. Streets Table
CREATE TABLE IF NOT EXISTS streets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    ward_no TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    road_type TEXT DEFAULT 'Arterial',
    surface_imperviousness REAL DEFAULT 0.85,
    slope_gradient REAL DEFAULT 1.2,
    length_meters INTEGER DEFAULT 1200,
    elevation_meters REAL DEFAULT 910.0,
    catchment_area_sqm REAL DEFAULT 45000.0,
    baseline_risk TEXT DEFAULT 'Moderate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_streets_city ON streets(city);
CREATE INDEX IF NOT EXISTS idx_streets_coords ON streets(latitude, longitude);

-- 2. Drainage Network Table
CREATE TABLE IF NOT EXISTS drainage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_id INTEGER NOT NULL,
    drain_code TEXT NOT NULL UNIQUE,
    drain_type TEXT NOT NULL,
    nominal_capacity_mm_hr REAL NOT NULL,
    current_blockage_pct REAL NOT NULL DEFAULT 15.0,
    silt_depth_cm REAL NOT NULL DEFAULT 10.0,
    structural_status TEXT NOT NULL DEFAULT 'Good',
    last_inspected DATE NOT NULL,
    desilt_status TEXT NOT NULL DEFAULT 'Recent',
    maintenance_crew TEXT DEFAULT 'Ward-QRT Zone 4',
    discharge_outfall TEXT DEFAULT 'Bellandur Lake Outfall Canal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (street_id) REFERENCES streets (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drainage_street_id ON drainage(street_id);
CREATE INDEX IF NOT EXISTS idx_drainage_drain_code ON drainage(drain_code);

-- 3. Rainfall Telemetry Readings Table
CREATE TABLE IF NOT EXISTS rainfall_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    station_code TEXT NOT NULL,
    station_name TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_intensity_mm_hr REAL NOT NULL,
    accumulation_1h REAL NOT NULL,
    accumulation_3h REAL NOT NULL,
    accumulation_6h REAL NOT NULL,
    accumulation_24h REAL NOT NULL,
    forecast_next_2h_mm_hr REAL NOT NULL,
    sensor_status TEXT DEFAULT 'Operational',
    data_source TEXT DEFAULT 'Automated Weather Station (AWS-IMD/BBMP Telemetry)'
);

CREATE INDEX IF NOT EXISTS idx_rainfall_city ON rainfall_readings(city);

-- 4. Flood Alerts Table
CREATE TABLE IF NOT EXISTS flood_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_code TEXT NOT NULL UNIQUE,
    street_id INTEGER NOT NULL,
    street_name TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    city TEXT NOT NULL,
    severity TEXT NOT NULL,
    risk_score REAL NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Active',
    target_audience TEXT NOT NULL DEFAULT 'Citizens & Emergency Responders',
    deduplication_key TEXT NOT NULL,
    FOREIGN KEY (street_id) REFERENCES streets (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alerts_city_status ON flood_alerts(city, status);

-- 5. Citizen Reports Table
CREATE TABLE IF NOT EXISTS citizen_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_code TEXT NOT NULL UNIQUE,
    street_name TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    report_type TEXT NOT NULL,
    water_depth TEXT NOT NULL,
    description TEXT NOT NULL,
    citizen_name TEXT DEFAULT 'Anonymous Citizen',
    phone_masked TEXT DEFAULT '+91 98*** **412',
    photo_url TEXT,
    upvotes INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Verified & Queued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_city_status ON citizen_reports(city, status);

-- 6. Municipal Responses Table
CREATE TABLE IF NOT EXISTS municipal_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_code TEXT NOT NULL UNIQUE,
    street_id INTEGER,
    street_name TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    city TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'High',
    assigned_team TEXT NOT NULL,
    crew_lead TEXT NOT NULL,
    pump_capacity_hp REAL DEFAULT 15.0,
    dewatering_pumps_deployed INTEGER DEFAULT 2,
    suction_vehicles_count INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Dispatched',
    dispatch_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolution_time TIMESTAMP,
    resolution_notes TEXT,
    verified_by TEXT DEFAULT 'Divisional Executive Engineer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responses_status ON municipal_responses(status);

-- 7. Activity Audit Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT DEFAULT '10.0.12.44',
    metadata_json TEXT
);

-- 8. System Configuration Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Registered Users & Citizen Alert Subscribers Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT DEFAULT 'preset',
    role TEXT NOT NULL DEFAULT 'citizen', -- 'citizen', 'eoc_chief', 'ward_engineer', 'admin'
    state TEXT DEFAULT 'Karnataka',
    district TEXT DEFAULT 'Chikkaballapur',
    city TEXT NOT NULL DEFAULT 'Chikkaballapur',
    ward_no TEXT DEFAULT 'Ward 12',
    ward_name TEXT DEFAULT 'BB Road - Shidlaghatta Circle Underpass Sump (Ward 12)',
    house_no TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    address TEXT DEFAULT '',
    nearest_spot TEXT DEFAULT 'BB Road - Shidlaghatta Circle Underpass Sump',
    street_id INTEGER,
    alerts_enabled INTEGER DEFAULT 1,
    sound_alerts_enabled INTEGER DEFAULT 1,
    sms_alerts_enabled INTEGER DEFAULT 1,
    badge_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_city_ward ON users(city, ward_name);


