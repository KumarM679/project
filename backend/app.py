import os
import json
import sqlite3
import io
import re
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from database import get_db_connection, init_db
from risk_engine import calculate_street_flood_risk
from pdf_generator import generate_location_analytics_pdf

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))

app = Flask(__name__, static_folder=None)
CORS(app)

@app.errorhandler(BrokenPipeError)
@app.errorhandler(ConnectionResetError)
def handle_broken_pipe(error):
    # Gracefully ignore socket write closures when client browser disconnects or cancels
    return '', 204

def get_system_weights():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT setting_key, setting_value FROM system_settings WHERE category = 'scoring_engine'")
    rows = cursor.fetchall()
    conn.close()
    
    weights = {
        'rainfall_weight': 0.35,
        'drainage_deficit_weight': 0.30,
        'blockage_weight': 0.15,
        'impervious_slope_weight': 0.12,
        'crowd_report_weight': 0.08
    }
    for row in rows:
        key = row['setting_key']
        if key in weights:
            try:
                weights[key] = float(row['setting_value'])
            except ValueError:
                pass
    return weights

def log_activity(event_type, actor, role, description, metadata=None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO activity_logs (event_type, actor, role, description, ip_address, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (event_type, actor, role, description, request.remote_addr or '127.0.0.1', json.dumps(metadata or {})))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging activity: {e}")

def init_users_table():
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            email TEXT,
            password_hash TEXT DEFAULT 'preset',
            role TEXT NOT NULL DEFAULT 'citizen',
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
        )
        ''')
        c.execute('CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_users_city_ward ON users(city, ward_name)')

        # Safely migrate existing users table with all detailed location columns
        cursor_cols = c.execute("PRAGMA table_info(users)").fetchall()
        existing_cols = [dict(col)['name'] if isinstance(col, sqlite3.Row) else col[1] for col in cursor_cols]
        columns_to_add = [
            ('state', "TEXT DEFAULT 'Karnataka'"),
            ('district', "TEXT DEFAULT 'Chikkaballapur'"),
            ('ward_no', "TEXT DEFAULT 'Ward 12'"),
            ('house_no', "TEXT DEFAULT ''"),
            ('pincode', "TEXT DEFAULT ''"),
            ('address', "TEXT DEFAULT ''"),
            ('nearest_spot', "TEXT DEFAULT ''"),
        ]
        for col_name, col_def in columns_to_add:
            if col_name not in existing_cols:
                try:
                    c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                except Exception as ex:
                    print(f"Column {col_name} alter warning: {ex}")

        c.execute('SELECT COUNT(*) FROM users')
        if c.fetchone()[0] == 0:
            seed_users = [
                ('Ananya Rao (Citizen)', '+91 98765 43210', 'ananya.rao@gmail.com', 'citizen', 'Karnataka', 'Chikkaballapur', 'Chikkaballapur', 'Ward 12', 'BB Road - Shidlaghatta Circle Underpass Sump (Ward 12)', '#14, Ground Floor, Shidlaghatta Main Road', '562101', 'Near Shidlaghatta Circle Underpass', 'BB Road - Shidlaghatta Circle Underpass Sump', 28, 1, 1, 1, 'CITIZEN-CKB-01'),
                ('Commander R. Sharma', '+91 98000 00001', 'r.sharma@eoc.gov.in', 'eoc_chief', 'Karnataka', 'Bengaluru Urban', 'Bengaluru', 'HQ', 'Central Command EOC', 'Room 402, Disaster Ops Center', '560001', 'Vidhana Soudha Zone', 'Central Command EOC', None, 1, 1, 1, 'NDMA-KA-092'),
                ('Er. Praveen Kumar', '+91 98000 00002', 'praveen.k@bbmp.gov.in', 'ward_engineer', 'Karnataka', 'Bengaluru Urban', 'Bengaluru', 'Ward 176', 'BTM Layout & Silk Board', '#88, 16th Main, BTM 2nd Stage', '560076', 'BTM Water Board Junction', 'Silk Board Junction Low-Lying Underpass', 1, 1, 1, 1, 'BBMP-EE-104'),
                ('System Admin', '+91 98000 00000', 'admin@jaldrishti.local', 'admin', 'Karnataka', 'Bengaluru Urban', 'All Cities', 'HQ', 'Headquarters', 'System Operations Command', '560001', 'Central Server Infrastructure', 'Main Center', None, 1, 1, 1, 'SYS-ROOT-01'),
            ]
            c.executemany('''
            INSERT INTO users (name, phone, email, role, state, district, city, ward_no, ward_name, house_no, pincode, address, nearest_spot, street_id, alerts_enabled, sound_alerts_enabled, sms_alerts_enabled, badge_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', seed_users)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing users table: {e}")

init_users_table()

# --- HEALTH ---
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'Urban Flood Nowcasting System API',
        'version': '2.4.0',
        'environment': 'Production Demonstration',
        'disclaimer': 'Experimental nowcasting system with fictional Indian demonstration datasets.'
    })

# --- DASHBOARD STATS ---
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    city = request.args.get('city')
    conn = get_db_connection()
    cursor = conn.cursor()

    # Base street filter
    street_query = "SELECT * FROM streets"
    street_params = []
    if city and city != 'All Cities':
        street_query += " WHERE city = ?"
        street_params.append(city)
    
    cursor.execute(street_query, street_params)
    streets = [dict(row) for row in cursor.fetchall()]

    # Fetch drainage
    cursor.execute("SELECT * FROM drainage")
    drainage_map = {row['street_id']: dict(row) for row in cursor.fetchall()}

    # Fetch rainfall
    rain_query = "SELECT * FROM rainfall_readings"
    rain_params = []
    if city and city != 'All Cities':
        rain_query += " WHERE city = ?"
        rain_params.append(city)
    cursor.execute(rain_query, rain_params)
    rain_readings = [dict(row) for row in cursor.fetchall()]
    avg_rainfall = sum(r['current_intensity_mm_hr'] for r in rain_readings) / max(1, len(rain_readings))
    max_rainfall = max((r['current_intensity_mm_hr'] for r in rain_readings), default=0.0)

    # Fetch citizen report counts per street
    cursor.execute("SELECT street_name, COUNT(*) as cnt FROM citizen_reports WHERE status != 'Rejected' GROUP BY street_name")
    citizen_counts = {row['street_name']: row['cnt'] for row in cursor.fetchall()}

    # Calculate dynamic risk for each street
    weights = get_system_weights()
    high_risk_count = 0
    severe_risk_count = 0
    moderate_risk_count = 0
    low_risk_count = 0
    total_blocked_drains = 0
    high_risk_streets = []

    for st in streets:
        st_id = st['id']
        dr = drainage_map.get(st_id)
        if dr and (dr['current_blockage_pct'] >= 50.0 or dr['desilt_status'] == 'Overdue'):
            total_blocked_drains += 1

        # Find matching city rainfall reading or nearest
        rf = next((r for r in rain_readings if r['city'] == st['city']), rain_readings[0] if rain_readings else None)
        c_count = citizen_counts.get(st['name'], 0)
        risk_result = calculate_street_flood_risk(st, dr, rf, c_count, weights)
        st['computed_risk'] = risk_result

        sev = risk_result['severity']
        if sev == 'red':
            severe_risk_count += 1
            high_risk_count += 1
            high_risk_streets.append(st)
        elif sev == 'orange':
            high_risk_count += 1
            high_risk_streets.append(st)
        elif sev == 'yellow':
            moderate_risk_count += 1
        else:
            low_risk_count += 1

    # Active alerts count
    alert_query = "SELECT COUNT(*) FROM flood_alerts WHERE status = 'Active'"
    alert_params = []
    if city and city != 'All Cities':
        alert_query += " AND city = ?"
        alert_params.append(city)
    cursor.execute(alert_query, alert_params)
    active_alerts_count = cursor.fetchone()[0]

    # Recent incidents
    incident_query = "SELECT * FROM municipal_responses ORDER BY created_at DESC LIMIT 5"
    cursor.execute(incident_query)
    recent_incidents = [dict(row) for row in cursor.fetchall()]

    # Active citizen reports
    rep_query = "SELECT * FROM citizen_reports ORDER BY created_at DESC LIMIT 5"
    cursor.execute(rep_query)
    recent_reports = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Sort high risk streets by score descending
    high_risk_streets.sort(key=lambda s: s['computed_risk']['risk_score'], reverse=True)

    return jsonify({
        'total_monitored_streets': len(streets),
        'average_rainfall_mm_hr': round(avg_rainfall, 1),
        'max_rainfall_mm_hr': round(max_rainfall, 1),
        'high_risk_locations_count': high_risk_count,
        'severe_risk_count': severe_risk_count,
        'moderate_risk_count': moderate_risk_count,
        'low_risk_count': low_risk_count,
        'blocked_drains_count': total_blocked_drains,
        'active_alerts_count': active_alerts_count,
        'recent_incidents': recent_incidents,
        'recent_citizen_reports': recent_reports,
        'high_risk_spotlight': high_risk_streets[:6],
        'experimental_label': 'Experimental Nowcasting Engine (Demo)'
    })

# --- STREETS & DETAILED RISK ANALYSIS ---
@app.route('/api/streets', methods=['GET'])
def get_streets():
    city = request.args.get('city')
    search = request.args.get('search', '').lower()
    risk_filter = request.args.get('risk') # green, yellow, orange, red

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM streets"
    params = []
    if city and city != 'All Cities':
        query += " WHERE city = ?"
        params.append(city)
    cursor.execute(query, params)
    streets = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM drainage")
    drainage_map = {row['street_id']: dict(row) for row in cursor.fetchall()}

    cursor.execute("SELECT * FROM rainfall_readings")
    rain_readings = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT street_name, COUNT(*) as cnt FROM citizen_reports WHERE status != 'Rejected' GROUP BY street_name")
    citizen_counts = {row['street_name']: row['cnt'] for row in cursor.fetchall()}

    conn.close()

    weights = get_system_weights()
    results = []

    for st in streets:
        st_id = st['id']
        dr = drainage_map.get(st_id)
        rf = next((r for r in rain_readings if r['city'] == st['city']), rain_readings[0] if rain_readings else None)
        c_count = citizen_counts.get(st['name'], 0)

        risk_data = calculate_street_flood_risk(st, dr, rf, c_count, weights)
        st['drainage'] = dr
        st['rainfall'] = rf
        st['citizen_reports_count'] = c_count
        st['risk_analysis'] = risk_data

        # Filter by search
        if search:
            match_name = search in st['name'].lower()
            match_ward = search in st['ward_name'].lower()
            match_city = search in st['city'].lower()
            if not (match_name or match_ward or match_city):
                continue

        # Filter by risk severity
        if risk_filter and risk_filter != 'all':
            if risk_data['severity'] != risk_filter:
                continue

        results.append(st)

    # Sort by risk score descending
    results.sort(key=lambda s: s['risk_analysis']['risk_score'], reverse=True)

    return jsonify({
        'streets': results,
        'count': len(results),
        'disclaimer': 'Risk scores are experimental estimates combining rainfall telemetry, drainage capacity, and slope parameters.'
    })

@app.route('/api/streets/<int:street_id>', methods=['GET'])
def get_street_detail(street_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM streets WHERE id = ?", (street_id,))
    st_row = cursor.fetchone()
    if not st_row:
        conn.close()
        return jsonify({'error': 'Street not found'}), 404
    street = dict(st_row)

    cursor.execute("SELECT * FROM drainage WHERE street_id = ?", (street_id,))
    dr_row = cursor.fetchone()
    drainage = dict(dr_row) if dr_row else None

    cursor.execute("SELECT * FROM rainfall_readings WHERE city = ?", (street['city'],))
    rain_readings = [dict(r) for r in cursor.fetchall()]
    rf = rain_readings[0] if rain_readings else None

    cursor.execute("SELECT * FROM citizen_reports WHERE street_name = ? ORDER BY created_at DESC", (street['name'],))
    citizen_reports = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM flood_alerts WHERE street_id = ? ORDER BY timestamp DESC", (street_id,))
    alerts = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM municipal_responses WHERE street_name = ? ORDER BY created_at DESC", (street['name'],))
    incidents = [dict(r) for r in cursor.fetchall()]

    conn.close()

    weights = get_system_weights()
    risk_analysis = calculate_street_flood_risk(street, drainage, rf, len(citizen_reports), weights)

    return jsonify({
        'street': street,
        'drainage': drainage,
        'rainfall': rf,
        'risk_analysis': risk_analysis,
        'citizen_reports': citizen_reports,
        'alerts': alerts,
        'municipal_responses': incidents
    })

# --- RAINFALL MONITORING ---
@app.route('/api/rainfall', methods=['GET'])
def get_rainfall_monitoring():
    city = request.args.get('city')
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM rainfall_readings"
    params = []
    if city and city != 'All Cities':
        query += " WHERE city = ?"
        params.append(city)
    
    cursor.execute(query, params)
    readings = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Generate synthetic 24h hourly trends for telemetry charts
    hourly_trends = []
    hours = ["-24h", "-20h", "-16h", "-12h", "-8h", "-6h", "-4h", "-3h", "-2h", "-1h", "Now", "+1h (F)", "+2h (F)"]
    base_factor = [0.1, 0.15, 0.22, 0.35, 0.6, 0.8, 0.95, 1.1, 1.25, 1.15, 1.0, 1.05, 0.85]
    
    for h, factor in zip(hours, base_factor):
        sample_intensity = round(readings[0]['current_intensity_mm_hr'] * factor if readings else 35.0 * factor, 1)
        hourly_trends.append({
            'time': h,
            'intensity_mm_hr': sample_intensity,
            'is_forecast': '(F)' in h
        })

    return jsonify({
        'readings': readings,
        'hourly_trends': hourly_trends,
        'summary': {
            'total_stations': len(readings),
            'max_intensity': max((r['current_intensity_mm_hr'] for r in readings), default=0.0),
            'max_station': max(readings, key=lambda x: x['current_intensity_mm_hr'])['station_name'] if readings else 'N/A'
        },
        'disclaimer': 'Demonstration telemetry based on synthetic AWS and Doppler radar feeds.'
    })

# --- DRAINAGE MANAGEMENT (FULL CRUD) ---
@app.route('/api/drainage', methods=['GET'])
def get_drainage_records():
    search = request.args.get('search', '').lower()
    status_filter = request.args.get('status') # Overdue, Due, Recent
    city = request.args.get('city')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
    SELECT d.*, s.name as street_name, s.city, s.ward_name, s.ward_no, s.latitude, s.longitude
    FROM drainage d
    JOIN streets s ON d.street_id = s.id
    '''
    params = []
    conditions = []

    if city and city != 'All Cities':
        conditions.append("s.city = ?")
        params.append(city)
    if status_filter and status_filter != 'all':
        conditions.append("d.desilt_status = ?")
        params.append(status_filter)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY d.current_blockage_pct DESC"

    cursor.execute(query, params)
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if search:
        records = [r for r in records if search in r['drain_code'].lower() or search in r['street_name'].lower() or search in r['drain_type'].lower()]

    return jsonify({
        'drainage_records': records,
        'count': len(records)
    })

@app.route('/api/drainage', methods=['POST'])
def create_drainage_record():
    data = request.get_json(silent=True) or {}
    street_id = data.get('street_id')
    drain_code = data.get('drain_code')
    drain_type = data.get('drain_type', 'RCC Box Storm Drain')
    nominal_capacity = float(data.get('nominal_capacity_mm_hr', 45.0))
    current_blockage = float(data.get('current_blockage_pct', 15.0))
    silt_depth = float(data.get('silt_depth_cm', 10.0))
    structural_status = data.get('structural_status', 'Good')
    last_inspected = data.get('last_inspected', datetime.now().strftime('%Y-%m-%d'))
    desilt_status = data.get('desilt_status', 'Recent')
    maintenance_crew = data.get('maintenance_crew', 'Ward Desilting Wing')
    discharge_outfall = data.get('discharge_outfall', 'Stormwater Canal Outfall')

    if not street_id or not drain_code:
        return jsonify({'error': 'street_id and drain_code are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
        INSERT INTO drainage (street_id, drain_code, drain_type, nominal_capacity_mm_hr, current_blockage_pct, silt_depth_cm, structural_status, last_inspected, desilt_status, maintenance_crew, discharge_outfall)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (street_id, drain_code, drain_type, nominal_capacity, current_blockage, silt_depth, structural_status, last_inspected, desilt_status, maintenance_crew, discharge_outfall))
        conn.commit()
        drain_id = cursor.lastrowid
        conn.close()

        log_activity('DRAIN_RECORD_CREATED', 'Ward Engineer', 'Municipal Officer', f"Created drainage record {drain_code} for Street ID {street_id}")

        return jsonify({'message': 'Drainage record created successfully', 'id': drain_id}), 201
    except sqlite3.IntegrityError as e:
        conn.close()
        return jsonify({'error': f"Duplicate drain_code or database conflict: {str(e)}"}), 400

@app.route('/api/drainage/<int:drain_id>', methods=['PUT'])
def update_drainage_record(drain_id):
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM drainage WHERE id = ?", (drain_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Drainage record not found'}), 404

    nominal_cap = float(data.get('nominal_capacity_mm_hr', existing['nominal_capacity_mm_hr']))
    blockage = float(data.get('current_blockage_pct', existing['current_blockage_pct']))
    silt = float(data.get('silt_depth_cm', existing['silt_depth_cm']))
    struct = data.get('structural_status', existing['structural_status'])
    insp = data.get('last_inspected', existing['last_inspected'])
    desilt = data.get('desilt_status', existing['desilt_status'])
    crew = data.get('maintenance_crew', existing['maintenance_crew'])
    outfall = data.get('discharge_outfall', existing['discharge_outfall'])

    cursor.execute('''
    UPDATE drainage
    SET nominal_capacity_mm_hr = ?, current_blockage_pct = ?, silt_depth_cm = ?,
        structural_status = ?, last_inspected = ?, desilt_status = ?,
        maintenance_crew = ?, discharge_outfall = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    ''', (nominal_cap, blockage, silt, struct, insp, desilt, crew, outfall, drain_id))
    conn.commit()
    conn.close()

    log_activity('DRAIN_RECORD_UPDATED', 'Ward Engineer', 'Municipal Officer', f"Updated drainage {existing['drain_code']}: Blockage={blockage}%, Desilt={desilt}")

    return jsonify({'message': 'Drainage record updated successfully'})

@app.route('/api/drainage/<int:drain_id>', methods=['DELETE'])
def delete_drainage_record(drain_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT drain_code FROM drainage WHERE id = ?", (drain_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Drainage record not found'}), 404

    drain_code = row['drain_code']
    cursor.execute("DELETE FROM drainage WHERE id = ?", (drain_id,))
    conn.commit()
    conn.close()

    log_activity('DRAIN_RECORD_DELETED', 'Ward Engineer', 'Municipal Officer', f"Deleted drainage record {drain_code}")

    return jsonify({'message': f"Drainage record {drain_code} deleted successfully"})

# --- FLOOD ALERTS & DEDUPLICATION ENGINE ---
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    city = request.args.get('city')
    severity = request.args.get('severity')
    status = request.args.get('status')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM flood_alerts WHERE 1=1"
    params = []

    if city and city != 'All Cities':
        query += " AND city = ?"
        params.append(city)
    if severity and severity != 'all':
        query += " AND severity = ?"
        params.append(severity)
    if status and status != 'all':
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY timestamp DESC"
    cursor.execute(query, params)
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'alerts': alerts,
        'count': len(alerts),
        'disclaimer': 'Demonstration alerts generated by configurable rule threshold engine.'
    })

@app.route('/api/alerts/generate', methods=['POST'])
def trigger_alert_generation():
    """Evaluates all streets against current rainfall & drainage. Generates deduplicated alerts if score > threshold."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get settings for thresholds
    cursor.execute("SELECT setting_key, setting_value FROM system_settings WHERE category = 'alert_thresholds'")
    settings = {row['setting_key']: float(row['setting_value']) for row in cursor.fetchall()}
    yellow_thresh = settings.get('threshold_yellow', 30.0)
    orange_thresh = settings.get('threshold_orange', 55.0)
    red_thresh = settings.get('threshold_red', 80.0)

    cursor.execute("SELECT * FROM streets")
    streets = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM drainage")
    drainage_map = {r['street_id']: dict(r) for r in cursor.fetchall()}

    cursor.execute("SELECT * FROM rainfall_readings")
    rain_readings = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT street_name, COUNT(*) as cnt FROM citizen_reports WHERE status != 'Rejected' GROUP BY street_name")
    citizen_counts = {r['street_name']: r['cnt'] for r in cursor.fetchall()}

    # Existing active deduplication keys
    cursor.execute("SELECT deduplication_key FROM flood_alerts WHERE status = 'Active'")
    existing_keys = set(row['deduplication_key'] for row in cursor.fetchall())

    weights = get_system_weights()
    generated = []

    today_str = datetime.now().strftime('%Y-%m-%d')

    for st in streets:
        st_id = st['id']
        dr = drainage_map.get(st_id)
        rf = next((r for r in rain_readings if r['city'] == st['city']), rain_readings[0] if rain_readings else None)
        c_count = citizen_counts.get(st['name'], 0)
        risk = calculate_street_flood_risk(st, dr, rf, c_count, weights)

        score = risk['risk_score']
        if score >= yellow_thresh:
            dedup_key = f"{st['city'][:3].upper()}-{st_id}-{today_str}"
            if dedup_key in existing_keys:
                continue  # Prevent duplicate alert for the same street on the same day

            alert_code = f"ALT-{st['city'][:3].upper()}-{datetime.now().strftime('%m%d%H%M')}-{st_id}"
            title = f"{risk['risk_level'].upper()}: {st['name']}"
            msg = f"Simulated rainfall load ({risk['effective_rainfall_mm_hr']} mm/hr) vs effective drainage ({risk['effective_drainage_capacity_mm_hr']} mm/hr). Risk score {score}/100."
            rec = risk['action_summary']

            cursor.execute('''
            INSERT INTO flood_alerts (alert_code, street_id, street_name, ward_name, city, severity, risk_score, title, message, recommendation, status, deduplication_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
            ''', (alert_code, st_id, st['name'], st['ward_name'], st['city'], risk['severity'], score, title, msg, rec, dedup_key))
            
            existing_keys.add(dedup_key)
            generated.append(alert_code)

    conn.commit()
    conn.close()

    if generated:
        log_activity('ALERTS_GENERATED', 'Nowcasting Engine', 'System Service', f"Generated {len(generated)} location-specific flood alerts based on risk thresholds", {'generated_codes': generated})

    return jsonify({
        'message': f"Evaluated streets. Generated {len(generated)} new unique alerts (duplicates suppressed).",
        'new_alerts_count': len(generated),
        'generated_codes': generated
    })

@app.route('/api/alerts/<int:alert_id>/status', methods=['PUT'])
def update_alert_status(alert_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get('status', 'Acknowledged') # Active, Acknowledged, Dispatched, Resolved

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE flood_alerts SET status = ? WHERE id = ?", (new_status, alert_id))
    conn.commit()
    conn.close()

    log_activity('ALERT_STATUS_CHANGE', 'EOC Watch Officer', 'Municipal Responder', f"Updated Alert #{alert_id} status to {new_status}")

    return jsonify({'message': f"Alert status updated to {new_status}"})

@app.route('/api/alerts/broadcast', methods=['POST'])
def broadcast_alert_to_public():
    data = request.get_json(silent=True) or {}
    alert_id = data.get('alert_id')
    broadcast_channel = data.get('channel', 'SMS & Cell Broadcast')
    custom_msg = data.get('custom_message')

    conn = get_db_connection()
    cursor = conn.cursor()

    if alert_id:
        cursor.execute("SELECT * FROM flood_alerts WHERE id = ?", (alert_id,))
        alert = cursor.fetchone()
        if not alert:
            conn.close()
            return jsonify({'error': 'Alert not found'}), 404

        alert_dict = dict(alert)
        new_target = 'Broadcasted to Public Citizens & Emergency Units'
        cursor.execute('''
        UPDATE flood_alerts
        SET target_audience = ?,
            status = 'Broadcasted to Citizens',
            message = COALESCE(?, message)
        WHERE id = ?
        ''', (new_target, custom_msg, alert_id))
        conn.commit()
        conn.close()

        log_activity(
            'ALERT_BROADCAST_PUBLIC',
            'EOC Commander',
            'Commander',
            f"EOC Commander broadcasted emergency alert {alert_dict['alert_code']} for {alert_dict['street_name']} to Public via {broadcast_channel}"
        )

        return jsonify({
            'message': f"Emergency flood alert broadcasted to public citizens via {broadcast_channel}!",
            'alert_code': alert_dict['alert_code'],
            'street_name': alert_dict['street_name'],
            'channel': broadcast_channel
        })
    else:
        title = data.get('title', 'CRITICAL FLOOD ADVISORY FOR CITIZENS')
        street_name = data.get('street_name', 'Silk Board & Outer Ring Road')
        city = data.get('city', 'Bengaluru')
        ward_name = data.get('ward_name', 'BTM Layout Ward 176')
        severity = data.get('severity', 'red')
        rec = data.get('recommendation', 'Avoid waterlogged underpasses. Divert via elevated highway.')
        msg = custom_msg or data.get('message', 'Heavy stormwater accumulation. Water depth exceeds safe vehicular clearance.')

        alert_code = f"PUB-{city[:3].upper()}-{datetime.now().strftime('%m%d%H%M')}"
        dedup_key = f"PUB-{city[:3].upper()}-{datetime.now().strftime('%Y-%m-%d-%H%M')}"

        cursor.execute('''
        INSERT INTO flood_alerts (alert_code, street_id, street_name, ward_name, city, severity, risk_score, title, message, recommendation, status, target_audience, deduplication_key)
        VALUES (?, 1, ?, ?, ?, ?, 88.0, ?, ?, ?, 'Broadcasted to Citizens', 'Broadcasted to Public Citizens & Emergency Units', ?)
        ''', (alert_code, street_name, ward_name, city, severity, title, msg, rec, dedup_key))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        log_activity(
            'ALERT_BROADCAST_PUBLIC',
            'EOC Commander',
            'Commander',
            f"EOC Commander issued direct public emergency broadcast: {title} ({street_name})"
        )

        return jsonify({
            'message': f"Direct public emergency alert broadcasted via {broadcast_channel}!",
            'alert_code': alert_code,
            'id': new_id
        }), 201

# --- AUTHENTICATION & USER ALERT SUBSCRIPTION ROUTES ---
@app.route('/api/auth/register', methods=['POST'])
def register_user():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()
    password = (data.get('password') or 'preset').strip()
    role = data.get('role', 'citizen')
    
    # Detailed location attributes
    state = (data.get('state') or 'Karnataka').strip()
    district = (data.get('district') or 'Chikkaballapur').strip()
    city = (data.get('city') or 'Chikkaballapur').strip()
    ward_no = (data.get('ward_no') or 'Ward 12').strip()
    ward_name = (data.get('ward_name') or 'Shidlaghatta Circle').strip()
    house_no = (data.get('house_no') or '').strip()
    pincode = (data.get('pincode') or '').strip()
    address = (data.get('address') or '').strip()
    nearest_spot = (data.get('nearest_spot') or '').strip()
    street_id = data.get('street_id', 28)

    alerts_enabled = 1 if data.get('alerts_enabled', True) else 0
    sound_alerts_enabled = 1 if data.get('sound_alerts_enabled', True) else 0
    sms_alerts_enabled = 1 if data.get('sms_alerts_enabled', True) else 0

    if not name:
        return jsonify({'error': 'Full name is required'}), 400
    if not phone:
        return jsonify({'error': 'Mobile phone number is required to receive flood alerts'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    clean_phone = re.sub(r'\D', '', phone)
    cursor.execute("""
        SELECT * FROM users 
        WHERE phone = ? 
        OR (length(?) >= 7 AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') = ?)
    """, (phone, clean_phone, clean_phone))
    existing = cursor.fetchone()

    if existing:
        cursor.execute('''
        UPDATE users
        SET name = ?, email = COALESCE(?, email), password_hash = COALESCE(?, password_hash),
            state = ?, district = ?, city = ?, ward_no = ?, ward_name = ?,
            house_no = ?, pincode = ?, address = ?, nearest_spot = ?, street_id = ?,
            role = ?, alerts_enabled = ?, sound_alerts_enabled = ?, sms_alerts_enabled = ?,
            last_login = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (name, email, password, state, district, city, ward_no, ward_name, house_no, pincode, address, nearest_spot, street_id, role, alerts_enabled, sound_alerts_enabled, sms_alerts_enabled, existing['id']))
        user_id = existing['id']
    else:
        badge = f"CITIZEN-{city[:2].upper()}-{phone[-4:]}" if role == 'citizen' else f"OFFICER-{city[:2].upper()}-99"
        cursor.execute('''
        INSERT INTO users (name, phone, email, password_hash, role, state, district, city, ward_no, ward_name, house_no, pincode, address, nearest_spot, street_id, alerts_enabled, sound_alerts_enabled, sms_alerts_enabled, badge_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, phone, email, password, role, state, district, city, ward_no, ward_name, house_no, pincode, address, nearest_spot, street_id, alerts_enabled, sound_alerts_enabled, sms_alerts_enabled, badge))
        user_id = cursor.lastrowid

    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cursor.fetchone())
    conn.close()

    log_activity(
        'USER_REGISTERED',
        name,
        role,
        f"Resident registered with location: {house_no}, {ward_no} ({ward_name}), {city}, {district}, {state} - PIN: {pincode} (Phone: {phone})"
    )

    return jsonify({
        'status': 'success',
        'message': f"Welcome, {name}! Your residence at {house_no or ward_name}, {city} is registered for flood sirens.",
        'user': user
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login_user():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('identifier') or data.get('phone') or data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()
    preset = data.get('preset')
    role = data.get('role')

    conn = get_db_connection()
    cursor = conn.cursor()

    user = None
    if preset == 'citizen':
        cursor.execute("SELECT * FROM users WHERE role = 'citizen' ORDER BY id ASC LIMIT 1")
        user = cursor.fetchone()
    elif preset in ['eoc_chief', 'ward_engineer', 'admin']:
        cursor.execute("SELECT * FROM users WHERE role = ? LIMIT 1", (preset,))
        user = cursor.fetchone()
    elif identifier or phone or email:
        target = identifier or phone or email
        clean_target = re.sub(r'\D', '', target)
        # Look up by phone OR email OR name with phone normalization support
        if clean_target and len(clean_target) >= 7:
            cursor.execute("""
                SELECT * FROM users 
                WHERE phone = ? OR email = ? OR name = ? 
                OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') = ?
                OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE ?
            """, (target, target, target, clean_target, f"%{clean_target[-10:]}%"))
        else:
            cursor.execute("SELECT * FROM users WHERE phone = ? OR email = ? OR name = ?", (target, target, target))
        user = cursor.fetchone()
        
        # If user not found and it looks like a phone number, quick-provision standard resident record
        if not user and phone:
            name = data.get('name') or f"Resident ({phone[-4:]})"
            city = data.get('city') or 'Chikkaballapur'
            state = data.get('state') or 'Karnataka'
            district = data.get('district') or 'Chikkaballapur'
            ward_no = data.get('ward_no') or 'Ward 12'
            ward = data.get('ward_name') or 'BB Road - Shidlaghatta Circle Underpass Sump (Ward 12)'
            badge = f"CITIZEN-{city[:2].upper()}-{phone[-4:]}"
            cursor.execute('''
            INSERT INTO users (name, phone, password_hash, role, state, district, city, ward_no, ward_name, badge_number)
            VALUES (?, ?, ?, 'citizen', ?, ?, ?, ?, ?, ?)
            ''', (name, phone, password or 'preset', state, district, city, ward_no, ward, badge))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,))
            user = cursor.fetchone()
    elif role:
        cursor.execute("SELECT * FROM users WHERE role = ? LIMIT 1", (role,))
        user = cursor.fetchone()

    if not user:
        cursor.execute("SELECT * FROM users ORDER BY id ASC LIMIT 1")
        user = cursor.fetchone()

    user_dict = dict(user) if user else {
        'id': 1, 'name': 'Public Citizen', 'phone': '+91 98765 43210',
        'role': 'citizen', 'state': 'Karnataka', 'district': 'Chikkaballapur',
        'city': 'Chikkaballapur', 'ward_no': 'Ward 12',
        'ward_name': 'BB Road - Shidlaghatta Circle Underpass Sump',
        'house_no': '#14 Main Road', 'pincode': '562101'
    }

    if user:
        cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user['id'],))
        conn.commit()
    conn.close()

    log_activity(
        'USER_LOGIN',
        user_dict['name'],
        user_dict['role'],
        f"Resident logged in: {user_dict.get('name')} ({user_dict.get('phone', 'N/A')}) - {user_dict.get('city')}"
    )

    return jsonify({
        'status': 'success',
        'message': f"Signed in successfully as {user_dict['name']}",
        'user': user_dict
    })

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    phone = request.args.get('phone')
    user_id = request.args.get('id')

    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    elif phone:
        clean_phone = re.sub(r'\D', '', phone)
        if clean_phone and len(clean_phone) >= 7:
            cursor.execute("""
                SELECT * FROM users 
                WHERE phone = ? 
                OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') = ?
                OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE ?
                ORDER BY last_login DESC LIMIT 1
            """, (phone, clean_phone, f"%{clean_phone[-10:]}%"))
        else:
            cursor.execute("SELECT * FROM users WHERE phone = ? ORDER BY last_login DESC LIMIT 1", (phone,))
    else:
        cursor.execute("SELECT * FROM users ORDER BY last_login DESC LIMIT 1")
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'status': 'success', 'user': dict(user)})

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    data = request.get_json(silent=True) or {}
    user_id = data.get('id')
    phone = data.get('phone')

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_id and not phone:
        conn.close()
        return jsonify({'error': 'User id or phone is required'}), 400

    cursor.execute('''
    UPDATE users
    SET name = COALESCE(?, name),
        email = COALESCE(?, email),
        state = COALESCE(?, state),
        district = COALESCE(?, district),
        city = COALESCE(?, city),
        ward_no = COALESCE(?, ward_no),
        ward_name = COALESCE(?, ward_name),
        house_no = COALESCE(?, house_no),
        pincode = COALESCE(?, pincode),
        address = COALESCE(?, address),
        nearest_spot = COALESCE(?, nearest_spot),
        alerts_enabled = COALESCE(?, alerts_enabled),
        sound_alerts_enabled = COALESCE(?, sound_alerts_enabled),
        sms_alerts_enabled = COALESCE(?, sms_alerts_enabled)
    WHERE id = ? OR phone = ?
    ''', (
        data.get('name'), data.get('email'),
        data.get('state'), data.get('district'), data.get('city'),
        data.get('ward_no'), data.get('ward_name'),
        data.get('house_no'), data.get('pincode'),
        data.get('address'), data.get('nearest_spot'),
        data.get('alerts_enabled'), data.get('sound_alerts_enabled'), data.get('sms_alerts_enabled'),
        user_id, phone
    ))
    conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ? OR phone = ?", (user_id, phone))
    updated = cursor.fetchone()
    conn.close()

    return jsonify({
        'status': 'success',
        'message': 'Profile and alert preferences updated.',
        'user': dict(updated) if updated else {}
    })

@app.route('/api/users', methods=['GET'])
def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, phone, email, role, state, district, city, ward_no, ward_name, house_no, pincode, address, nearest_spot, alerts_enabled, sound_alerts_enabled, sms_alerts_enabled, badge_number, last_login, created_at FROM users ORDER BY id ASC")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'users': users, 'count': len(users)})

@app.route('/api/alerts/dispatch-user', methods=['POST'])
def dispatch_personalized_alert():
    data = request.get_json(silent=True) or {}
    user_phone = data.get('phone')
    user_name = data.get('name', 'Resident')
    ward_name = data.get('ward_name', 'Monitored Ward')
    custom_msg = data.get('custom_message')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flood_alerts WHERE status IN ('Active', 'Broadcasted to Citizens') ORDER BY id DESC LIMIT 1")
    latest_alert = cursor.fetchone()
    conn.close()

    alert_text = custom_msg or (latest_alert['message'] if latest_alert else 'Moderate pooling expected at low spots. Proceed with caution.')
    alert_code = latest_alert['alert_code'] if latest_alert else 'DISPATCH-LIVE-01'

    log_activity(
        'ALERT_DISPATCHED_TO_USER',
        user_name,
        'Citizen Subscriber',
        f"Dispatched direct alert ({alert_code}) to device {user_phone}: {alert_text[:60]}..."
    )

    return jsonify({
        'status': 'dispatched',
        'alert_code': alert_code,
        'user_name': user_name,
        'phone': user_phone,
        'ward': ward_name,
        'message': alert_text,
        'channel': 'SMS, Cell Broadcast & Device Push',
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/api/alerts/send-sms', methods=['POST'])
def send_sms_alert():
    data = request.get_json(silent=True) or {}
    user_phone = data.get('phone', '+91 94480 55501')
    user_name = data.get('name', 'Resident')
    location = data.get('location', 'Monitored Underpass')
    message = data.get('message', 'Flood risk alert')
    severity = data.get('severity', 'Warning')

    sms_body = f"🚨 JALDRISHTI EMERGENCY FLOOD ALERT: {severity.upper()} flood hazard detected at {location}. {message} Helpline: 1533 / 1077. Govt of Karnataka NDMA."

    log_activity(
        'SMS_ALERT_DISPATCHED',
        user_name,
        'Citizen Subscriber',
        f"Direct SMS Alert sent to {user_phone} for {location}: {sms_body[:60]}..."
    )

    return jsonify({
        'success': True,
        'status': 'DELIVERED',
        'phone': user_phone,
        'recipient': user_name,
        'location': location,
        'sms_body': sms_body,
        'gateway': 'National Disaster Cell Broadcast & Telecom SMS Gateway',
        'delivery_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })

# --- CITIZEN CROWDSOURCED REPORTS ---
@app.route('/api/citizen-reports', methods=['GET'])
@app.route('/api/citizen-report', methods=['GET'])
def get_citizen_reports():
    city = request.args.get('city')
    status = request.args.get('status')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM citizen_reports WHERE 1=1"
    params = []
    if city and city != 'All Cities':
        query += " AND city = ?"
        params.append(city)
    if status and status != 'all':
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY upvotes DESC, created_at DESC"
    cursor.execute(query, params)
    reports = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'reports': reports,
        'count': len(reports)
    })

@app.route('/api/citizen-reports', methods=['POST'])
@app.route('/api/citizen-report', methods=['POST'])
def submit_citizen_report():
    data = request.get_json(silent=True) or {}
    street_name = data.get('street_name')
    ward_name = data.get('ward_name', 'General Ward')
    city = data.get('city', 'Bengaluru')
    lat = float(data.get('latitude', 12.9716))
    lng = float(data.get('longitude', 77.5946))
    report_type = data.get('report_type', 'Waterlogged Road')
    water_depth = data.get('water_depth', 'Knee Deep (30-45cm)')
    description = data.get('description', '')
    citizen_name = data.get('citizen_name', 'Civic Citizen')
    phone = data.get('phone_masked', '+91 98*** **000')
    photo_url = data.get('photo_url') or "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=80"

    if not street_name or not description:
        return jsonify({'error': 'street_name and description are required'}), 400

    report_code = f"CR-{city[:3].upper()}-{datetime.now().strftime('%m%d%H%M%S')}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO citizen_reports (report_code, street_name, ward_name, city, latitude, longitude, report_type, water_depth, description, citizen_name, phone_masked, photo_url, upvotes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Verified & Queued')
    ''', (report_code, street_name, ward_name, city, lat, lng, report_type, water_depth, description, citizen_name, phone, photo_url))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    log_activity('CITIZEN_REPORT_SUBMITTED', citizen_name, 'Citizen', f"Citizen reported {report_type} ({water_depth}) at {street_name}, {city}")

    return jsonify({
        'message': 'Citizen report recorded successfully',
        'report_code': report_code,
        'id': new_id
    }), 201

@app.route('/api/citizen-reports/<int:report_id>/upvote', methods=['POST'])
def upvote_citizen_report(report_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE citizen_reports SET upvotes = upvotes + 1 WHERE id = ?", (report_id,))
    cursor.execute("SELECT upvotes FROM citizen_reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({'error': 'Report not found'}), 404

    return jsonify({'message': 'Upvoted successfully', 'upvotes': row['upvotes']})

@app.route('/api/citizen-reports/<int:report_id>/status', methods=['PUT'])
def update_report_status(report_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get('status', 'Verified & Queued')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE citizen_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, report_id))
    conn.commit()
    conn.close()

    log_activity('REPORT_STATUS_UPDATED', 'Ward Officer', 'Municipal Responder', f"Updated report #{report_id} status to {new_status}")

    return jsonify({'message': f"Report status changed to {new_status}"})

# --- MUNICIPAL RESPONSE & TRIAGE ---
@app.route('/api/municipal-response', methods=['GET'])
@app.route('/api/municipal-responses', methods=['GET'])
def get_municipal_responses():
    city = request.args.get('city')
    priority = request.args.get('priority')
    status = request.args.get('status')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM municipal_responses WHERE 1=1"
    params = []
    if city and city != 'All Cities':
        query += " AND city = ?"
        params.append(city)
    if priority and priority != 'all':
        query += " AND priority = ?"
        params.append(priority)
    if status and status != 'all':
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, created_at DESC"
    cursor.execute(query, params)
    incidents = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'responses': incidents,
        'count': len(incidents)
    })

@app.route('/api/municipal-response', methods=['POST'])
@app.route('/api/municipal-responses', methods=['POST'])
def create_municipal_response():
    data = request.get_json(silent=True) or {}
    street_id = data.get('street_id')
    street_name = data.get('street_name')
    ward_name = data.get('ward_name', 'General Ward')
    city = data.get('city', 'Bengaluru')
    priority = data.get('priority', 'High')
    assigned_team = data.get('assigned_team', 'Ward Rapid Taskforce')
    crew_lead = data.get('crew_lead', 'Duty Engineer')
    pumps = int(data.get('dewatering_pumps_deployed', 2))
    suction = int(data.get('suction_vehicles_count', 1))
    notes = data.get('resolution_notes', 'Dispatched crew with dewatering apparatus.')

    incident_code = f"INC-{datetime.now().strftime('%Y')}-{city[:3].upper()}-{datetime.now().strftime('%m%d%H%M')}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO municipal_responses (incident_code, street_id, street_name, ward_name, city, priority, assigned_team, crew_lead, dewatering_pumps_deployed, suction_vehicles_count, status, resolution_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Dispatched', ?)
    ''', (incident_code, street_id, street_name, ward_name, city, priority, assigned_team, crew_lead, pumps, suction, notes))
    conn.commit()
    conn.close()

    log_activity('CREW_DISPATCHED', crew_lead, 'Municipal Responder', f"Dispatched {assigned_team} to {street_name} (Priority: {priority}, {pumps} pumps)")

    return jsonify({'message': 'Municipal incident dispatch created', 'incident_code': incident_code}), 201

@app.route('/api/municipal-response/<int:response_id>', methods=['PUT'])
def update_municipal_response(response_id):
    data = request.get_json(silent=True) or {}
    status = data.get('status') # Dispatched, On-Site Dewatering, Completed, Closed
    resolution_notes = data.get('resolution_notes')
    pumps = data.get('dewatering_pumps_deployed')
    suction = data.get('suction_vehicles_count')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM municipal_responses WHERE id = ?", (response_id,))
    incident = cursor.fetchone()
    if not incident:
        conn.close()
        return jsonify({'error': 'Incident not found'}), 404

    res_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S') if status in ['Completed', 'Closed'] else incident['resolution_time']

    cursor.execute('''
    UPDATE municipal_responses
    SET status = COALESCE(?, status),
        resolution_notes = COALESCE(?, resolution_notes),
        dewatering_pumps_deployed = COALESCE(?, dewatering_pumps_deployed),
        suction_vehicles_count = COALESCE(?, suction_vehicles_count),
        resolution_time = ?
    WHERE id = ?
    ''', (status, resolution_notes, pumps, suction, res_time, response_id))
    conn.commit()
    conn.close()

    log_activity('INCIDENT_UPDATED', 'EOC Command', 'Municipal Responder', f"Incident #{response_id} status updated to {status}: {resolution_notes}")

    return jsonify({'message': 'Municipal response updated successfully'})

# --- ANALYTICS & TRENDS ---
@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()

    # City-wise comparison
    cursor.execute('''
    SELECT s.city, COUNT(s.id) as street_count, AVG(d.current_blockage_pct) as avg_blockage, AVG(d.nominal_capacity_mm_hr) as avg_capacity
    FROM streets s
    LEFT JOIN drainage d ON s.id = d.street_id
    GROUP BY s.city
    ''')
    city_stats = [dict(row) for row in cursor.fetchall()]

    # Drainage types distribution
    cursor.execute('''
    SELECT drain_type, COUNT(*) as count, AVG(current_blockage_pct) as avg_blockage
    FROM drainage
    GROUP BY drain_type
    ''')
    drain_types = [dict(row) for row in cursor.fetchall()]

    # Top 5 worst drainage bottlenecks
    cursor.execute('''
    SELECT d.drain_code, d.drain_type, d.current_blockage_pct, d.silt_depth_cm, d.desilt_status, s.name as street_name, s.city
    FROM drainage d
    JOIN streets s ON d.street_id = s.id
    ORDER BY d.current_blockage_pct DESC LIMIT 6
    ''')
    bottlenecks = [dict(row) for row in cursor.fetchall()]

    # Incident resolution turnaround
    cursor.execute('''
    SELECT priority, COUNT(*) as count, SUM(dewatering_pumps_deployed) as total_pumps
    FROM municipal_responses
    GROUP BY priority
    ''')
    priority_breakdown = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Hotspot historical recurrence ranking (Indian demonstration hotspots)
    hotspots = [
        {'name': 'Silk Board Junction Underpass', 'city': 'Bengaluru', 'historical_events_year': 14, 'vulnerability_index': 94, 'primary_cause': 'Catchment valley depression & Rajakaluve throttle'},
        {'name': 'Bellandur Ecospace Service Road', 'city': 'Bengaluru', 'historical_events_year': 12, 'vulnerability_index': 92, 'primary_cause': 'Lake surplus backflow & rapid tech park concretization'},
        {'name': 'Velachery Bypass Road Basin', 'city': 'Chennai', 'historical_events_year': 11, 'vulnerability_index': 89, 'primary_cause': 'Marshland encroachment and high siltation in macro-drain'},
        {'name': 'Shivajinagar Sancheti Underpass', 'city': 'Pune', 'historical_events_year': 9, 'vulnerability_index': 82, 'primary_cause': 'Sub-grade elevation well pump capacity deficit'},
        {'name': 'Tolichowki Flyover Underpass', 'city': 'Hyderabad', 'historical_events_year': 8, 'vulnerability_index': 79, 'primary_cause': 'Shah Hatim Nala surplus weir overflow'}
    ]

    return jsonify({
        'city_stats': city_stats,
        'drainage_distribution': drain_types,
        'worst_bottlenecks': bottlenecks,
        'incident_priority_stats': priority_breakdown,
        'historical_hotspots': hotspots,
        'disclaimer': 'Analytics computed from simulated hydrological parameters and historical urban flood patterns.'
    })

def fetch_location_report_data(street_id=None, city=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    if street_id:
        cursor.execute("SELECT * FROM streets WHERE id = ?", (street_id,))
        street = cursor.fetchone()
    elif city and city != 'All Cities':
        cursor.execute("SELECT * FROM streets WHERE city = ? ORDER BY id ASC LIMIT 1", (city,))
        street = cursor.fetchone()
    else:
        cursor.execute("SELECT * FROM streets ORDER BY id ASC LIMIT 1")
        street = cursor.fetchone()

    if not street:
        conn.close()
        return None

    st_dict = dict(street)
    st_id = st_dict['id']
    st_city = st_dict['city']

    cursor.execute("SELECT * FROM drainage WHERE street_id = ?", (st_id,))
    drain_row = cursor.fetchone()
    dr_dict = dict(drain_row) if drain_row else {
        'drain_code': f"DRN-{st_city[:3].upper()}-{st_id:03d}",
        'drain_type': 'RCC Box Culvert',
        'nominal_capacity_mm_hr': 45.0,
        'current_blockage_pct': 20.0,
        'silt_depth_cm': 12.0,
        'structural_status': 'Operational',
        'discharge_outfall': 'Municipal Stormwater Canal'
    }

    cursor.execute("SELECT * FROM rainfall_readings WHERE city = ? ORDER BY timestamp DESC LIMIT 1", (st_city,))
    rain_row = cursor.fetchone()
    if not rain_row:
        cursor.execute("SELECT * FROM rainfall_readings ORDER BY timestamp DESC LIMIT 1")
        rain_row = cursor.fetchone()
    rf_dict = dict(rain_row) if rain_row else {
        'current_intensity_mm_hr': 35.0,
        'accumulation_1h': 28.0,
        'accumulation_24h': 72.0,
        'forecast_next_2h_mm_hr': 42.0,
        'station_name': f"AWS-{st_city[:3].upper()} IMD Central Telemetry"
    }

    cursor.execute("SELECT COUNT(*) as cnt FROM citizen_reports WHERE street_name = ? AND status != 'Rejected'", (st_dict['name'],))
    c_row = cursor.fetchone()
    c_count = c_row['cnt'] if c_row else 0

    weights = get_system_weights()
    risk = calculate_street_flood_risk(st_dict, dr_dict, rf_dict, c_count, weights)

    cursor.execute("SELECT * FROM municipal_responses WHERE street_name = ? OR street_id = ? ORDER BY created_at DESC", (st_dict['name'], st_id))
    incidents = [dict(r) for r in cursor.fetchall()]

    hotspots = [
        {'name': 'Silk Board Junction Underpass', 'city': 'Bengaluru', 'historical_events_year': 14, 'vulnerability_index': 94, 'primary_cause': 'Catchment valley depression & Rajakaluve throttle'},
        {'name': 'Bellandur Ecospace Service Road', 'city': 'Bengaluru', 'historical_events_year': 12, 'vulnerability_index': 92, 'primary_cause': 'Lake surplus backflow & rapid tech park concretization'},
        {'name': 'Velachery Bypass Road Basin', 'city': 'Chennai', 'historical_events_year': 11, 'vulnerability_index': 89, 'primary_cause': 'Marshland encroachment and high siltation in macro-drain'},
        {'name': 'Shivajinagar Sancheti Underpass', 'city': 'Pune', 'historical_events_year': 9, 'vulnerability_index': 82, 'primary_cause': 'Sub-grade elevation well pump capacity deficit'},
        {'name': 'Tolichowki Flyover Underpass', 'city': 'Hyderabad', 'historical_events_year': 8, 'vulnerability_index': 79, 'primary_cause': 'Shah Hatim Nala surplus weir overflow'}
    ]

    hotspot_info = next((h for h in hotspots if h['name'].lower() in st_dict['name'].lower() or st_dict['name'].lower() in h['name'].lower()), None)
    if not hotspot_info:
        hotspot_info = next((h for h in hotspots if h['city'].lower() == st_city.lower()), {
            'name': st_dict['name'],
            'city': st_city,
            'historical_events_year': 7,
            'vulnerability_index': int(risk['risk_score']),
            'primary_cause': f"Concretized surface runoff surplus with limited storm conduit gradient in {st_dict['ward_name']}."
        })

    cursor.execute("SELECT id, name, city, ward_name FROM streets ORDER BY city, name")
    all_streets = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        'street': st_dict,
        'drainage': dr_dict,
        'rainfall': rf_dict,
        'risk': risk,
        'incidents': incidents,
        'hotspot_info': hotspot_info,
        'all_streets': all_streets
    }

@app.route('/api/analytics/location-report', methods=['GET'])
def get_location_report():
    street_id = request.args.get('street_id', type=int)
    city = request.args.get('city')
    data = fetch_location_report_data(street_id=street_id, city=city)
    if not data:
        return jsonify({'error': 'Location not found'}), 404
    return jsonify(data)

@app.route('/api/analytics/location-report/pdf', methods=['GET'])
def download_location_report_pdf():
    street_id = request.args.get('street_id', type=int)
    city = request.args.get('city')
    data = fetch_location_report_data(street_id=street_id, city=city)
    if not data:
        return jsonify({'error': 'Location not found'}), 404

    pdf_bytes = generate_location_analytics_pdf(data)

    clean_name = "".join(c if c.isalnum() else '_' for c in data['street']['name'])
    filename = f"Hydro_Analytics_Report_{clean_name}_{data['street']['city']}.pdf"

    log_activity(
        'REPORT_EXPORTED_PDF',
        'Hydrologist / EOC Watch',
        'Municipal Commander',
        f"Exported official PDF flood analytics report for {data['street']['name']}, {data['street']['city']}"
    )

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )

# --- ACTIVITY AUDIT LOGS ---
@app.route('/api/activity-logs', methods=['GET'])
def get_activity_logs():
    limit = int(request.args.get('limit', 50))
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'logs': logs, 'count': len(logs)})

# --- SYSTEM SETTINGS & SCORING CALIBRATION ---
@app.route('/api/settings', methods=['GET'])
def get_system_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM system_settings")
    settings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'settings': settings})

@app.route('/api/settings', methods=['PUT'])
def update_system_settings():
    data = request.get_json(silent=True) or {} # list of {key, value} or dict
    conn = get_db_connection()
    cursor = conn.cursor()

    if isinstance(data, list):
        for item in data:
            cursor.execute("UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?", (str(item['value']), item['key']))
    elif isinstance(data, dict):
        for key, val in data.items():
            cursor.execute("UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?", (str(val), key))

    conn.commit()
    conn.close()

    log_activity('SETTINGS_UPDATED', 'System Administrator', 'Admin', 'Updated flood-risk scoring weights & alert thresholds')

    return jsonify({'message': 'Settings updated successfully'})

# --- SIMULATION SCENARIOS (Cloudburst, Heavy Monsoon, Moderate Shower, Dry Weather) ---
@app.route('/api/simulation/apply-scenario', methods=['POST'])
def apply_simulation_scenario():
    data = request.get_json(silent=True) or {}
    scenario = data.get('scenario', 'monsoon_heavy') # dry, moderate_shower, monsoon_heavy, cloudburst

    conn = get_db_connection()
    cursor = conn.cursor()

    if scenario == 'cloudburst':
        # Extreme rain intensity 85-110 mm/hr
        cursor.execute("UPDATE rainfall_readings SET current_intensity_mm_hr = 98.5, accumulation_1h = 88.0, accumulation_3h = 145.0, forecast_next_2h_mm_hr = 105.0")
        cursor.execute("UPDATE system_settings SET setting_value = 'cloudburst' WHERE setting_key = 'simulation_scenario'")
        desc = "Triggered Catastrophic Cloudburst Scenario (98.5 mm/hr rain intensity across monitored basins)"
    elif scenario == 'monsoon_heavy':
        cursor.execute("UPDATE rainfall_readings SET current_intensity_mm_hr = 58.0, accumulation_1h = 52.0, accumulation_3h = 85.0, forecast_next_2h_mm_hr = 64.0")
        cursor.execute("UPDATE system_settings SET setting_value = 'monsoon_heavy' WHERE setting_key = 'simulation_scenario'")
        desc = "Set Active Heavy Monsoon Regime (58.0 mm/hr steady intensity with 85mm 3h accumulation)"
    elif scenario == 'moderate_shower':
        cursor.execute("UPDATE rainfall_readings SET current_intensity_mm_hr = 24.0, accumulation_1h = 20.0, accumulation_3h = 35.0, forecast_next_2h_mm_hr = 18.0")
        cursor.execute("UPDATE system_settings SET setting_value = 'moderate_shower' WHERE setting_key = 'simulation_scenario'")
        desc = "Set Moderate Intermittent Shower Regime (24.0 mm/hr)"
    else: # dry
        cursor.execute("UPDATE rainfall_readings SET current_intensity_mm_hr = 0.0, accumulation_1h = 2.0, accumulation_3h = 5.0, forecast_next_2h_mm_hr = 0.0")
        cursor.execute("UPDATE system_settings SET setting_value = 'dry' WHERE setting_key = 'simulation_scenario'")
        desc = "Set Dry Weather Baseline (0.0 mm/hr rain, baseline drainage clearance)"

    conn.commit()
    conn.close()

    log_activity('SIMULATION_SCENARIO_CHANGED', 'Simulation Controller', 'System Admin', desc, {'scenario': scenario})

    return jsonify({
        'message': f"Simulation scenario '{scenario}' applied successfully.",
        'scenario': scenario,
        'description': desc
    })

# --- MERGED FRONTEND SPA ROUTE ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    # Do not swallow API calls
    if path and (path.startswith('api/') or path == 'api'):
        return jsonify({'error': 'API endpoint not found', 'path': f'/{path}'}), 404
    # Serve static file if exists in dist
    target = os.path.join(FRONTEND_DIST, path)
    if path and os.path.isfile(target):
        return send_from_directory(FRONTEND_DIST, path)
    # Serve index.html for client-side routing
    index_file = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.isfile(index_file):
        return send_from_directory(FRONTEND_DIST, 'index.html')
    return jsonify({
        'status': 'error',
        'message': 'Frontend build not found. Please run "npm run build" in the frontend directory.'
    }), 404

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

