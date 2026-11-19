"""
Urban Flood Nowcasting System - Street-Level Flood Risk Scoring Engine
Integrates high-performance C / C++ Engine via ctypes with native Python fallback.
"""

import os
import ctypes
from ctypes import Structure, c_double, c_int, c_char

# --- CTYPES C-ENGINE INTEGRATION ---
DLL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'c_engine', 'risk_engine.dll'))
C_LIB = None

class CStreetParams(Structure):
    _fields_ = [
        ("surface_imperviousness", c_double),
        ("slope_gradient", c_double)
    ]

class CDrainageParams(Structure):
    _fields_ = [
        ("nominal_capacity_mm_hr", c_double),
        ("current_blockage_pct", c_double),
        ("silt_depth_cm", c_double),
        ("structural_status_code", c_int)
    ]

class CRainfallParams(Structure):
    _fields_ = [
        ("current_intensity_mm_hr", c_double),
        ("accumulation_1h", c_double),
        ("accumulation_3h", c_double),
        ("forecast_next_2h_mm_hr", c_double)
    ]

class CModelWeights(Structure):
    _fields_ = [
        ("rainfall_weight", c_double),
        ("drainage_deficit_weight", c_double),
        ("blockage_weight", c_double),
        ("impervious_slope_weight", c_double),
        ("crowd_report_weight", c_double)
    ]

class CRiskResult(Structure):
    _fields_ = [
        ("risk_score", c_double),
        ("severity", c_char * 16),
        ("risk_level", c_char * 32),
        ("color", c_char * 16),
        ("action_summary", c_char * 256),
        ("effective_rainfall", c_double),
        ("nominal_drainage_capacity", c_double),
        ("effective_drainage_capacity", c_double),
        ("surplus_water", c_double),
        ("effective_blockage", c_double),
        ("rainfall_component", c_double),
        ("drainage_deficit_component", c_double),
        ("blockage_component", c_double),
        ("terrain_component", c_double),
        ("crowdsource_component", c_double),
        ("estimated_depth_cm", c_double),
        ("time_to_ponding_min", c_int)
    ]

if os.path.exists(DLL_PATH):
    try:
        C_LIB = ctypes.CDLL(DLL_PATH)
        C_LIB.calculate_flood_risk_c.argtypes = [
            ctypes.POINTER(CStreetParams),
            ctypes.POINTER(CDrainageParams),
            ctypes.POINTER(CRainfallParams),
            c_int,
            ctypes.POINTER(CModelWeights),
            ctypes.POINTER(CRiskResult)
        ]
        C_LIB.calculate_flood_risk_c.restype = None
    except Exception as e:
        C_LIB = None

def calculate_street_flood_risk(street, drainage, rainfall, citizen_reports_count=0, weights=None):
    if weights is None:
        weights = {
            'rainfall_weight': 0.35,
            'drainage_deficit_weight': 0.30,
            'blockage_weight': 0.15,
            'impervious_slope_weight': 0.12,
            'crowd_report_weight': 0.08
        }

    # If compiled C DLL is available, run directly via high-speed C engine
    if C_LIB is not None:
        try:
            status_map = {'good': 0, 'fair': 1, 'degraded': 2, 'collapsed': 3}
            stat_str = (drainage.get('structural_status', 'Good') if drainage else 'Fair').lower()
            status_code = status_map.get(stat_str, 0)

            c_street = CStreetParams(
                surface_imperviousness=street.get('surface_imperviousness', 0.85) if street else 0.85,
                slope_gradient=street.get('slope_gradient', 1.2) if street else 1.2
            )
            c_drain = CDrainageParams(
                nominal_capacity_mm_hr=drainage.get('nominal_capacity_mm_hr', 45.0) if drainage else 35.0,
                current_blockage_pct=drainage.get('current_blockage_pct', 15.0) if drainage else 20.0,
                silt_depth_cm=drainage.get('silt_depth_cm', 10.0) if drainage else 10.0,
                structural_status_code=status_code
            )
            c_rain = CRainfallParams(
                current_intensity_mm_hr=rainfall.get('current_intensity_mm_hr', 0.0) if rainfall else 0.0,
                accumulation_1h=rainfall.get('accumulation_1h', 0.0) if rainfall else 0.0,
                accumulation_3h=rainfall.get('accumulation_3h', 0.0) if rainfall else 0.0,
                forecast_next_2h_mm_hr=rainfall.get('forecast_next_2h_mm_hr', 0.0) if rainfall else 0.0
            )
            c_weights = CModelWeights(
                rainfall_weight=weights['rainfall_weight'],
                drainage_deficit_weight=weights['drainage_deficit_weight'],
                blockage_weight=weights['blockage_weight'],
                impervious_slope_weight=weights['impervious_slope_weight'],
                crowd_report_weight=weights['crowd_report_weight']
            )

            res = CRiskResult()
            C_LIB.calculate_flood_risk_c(
                ctypes.byref(c_street),
                ctypes.byref(c_drain),
                ctypes.byref(c_rain),
                citizen_reports_count,
                ctypes.byref(c_weights),
                ctypes.byref(res)
            )

            # Build explainability factor breakdown
            explanations = []
            if res.effective_rainfall > res.effective_drainage_capacity:
                pct = round(((res.effective_rainfall - res.effective_drainage_capacity) / res.effective_drainage_capacity) * 100)
                explanations.append(f"Effective rainfall load ({res.effective_rainfall} mm/hr) exceeds net drainage capacity ({res.effective_drainage_capacity} mm/hr) by {pct}%.")
            else:
                margin = round(res.effective_drainage_capacity - res.effective_rainfall, 1)
                explanations.append(f"Drainage has a remaining buffer capacity of {margin} mm/hr under current rainfall.")

            if res.effective_blockage > 30.0:
                explanations.append(f"High drain obstruction: {round(c_drain.current_blockage_pct)}% debris blockage and {round(c_drain.silt_depth_cm, 1)}cm accumulated silt reduce outfall velocity.")

            if stat_str != 'good':
                explanations.append(f"Drain structural condition is '{stat_str.title()}', reducing stormwater conveyance efficiency.")

            if c_street.slope_gradient < 0.8:
                explanations.append(f"Flat/depression terrain (slope {c_street.slope_gradient}%) inhibits gravitational runoff, creating a localized waterlogging sink.")

            if c_street.surface_imperviousness > 0.8:
                explanations.append(f"High impervious surface density ({round(c_street.surface_imperviousness*100)}% asphalt/concrete) generates immediate flash runoff without ground infiltration.")

            if citizen_reports_count > 0:
                explanations.append(f"{citizen_reports_count} verified citizen waterlogging report(s) actively logged in this street/vicinity.")

            return {
                'risk_score': round(res.risk_score, 1),
                'severity': res.severity.decode('utf-8', errors='ignore'),
                'risk_level': res.risk_level.decode('utf-8', errors='ignore'),
                'color': res.color.decode('utf-8', errors='ignore'),
                'action_summary': res.action_summary.decode('utf-8', errors='ignore'),
                'effective_rainfall_mm_hr': round(res.effective_rainfall, 1),
                'nominal_drainage_capacity_mm_hr': round(res.nominal_drainage_capacity, 1),
                'effective_drainage_capacity_mm_hr': round(res.effective_drainage_capacity, 1),
                'surplus_water_mm_hr': round(res.surplus_water, 1),
                'effective_blockage_pct': round(res.effective_blockage, 1),
                'imperviousness_pct': round(c_street.surface_imperviousness * 100),
                'slope_gradient_pct': c_street.slope_gradient,
                'factors_breakdown': {
                    'rainfall_component': round(res.rainfall_component, 1),
                    'drainage_deficit_component': round(res.drainage_deficit_component, 1),
                    'blockage_component': round(res.blockage_component, 1),
                    'terrain_component': round(res.terrain_component, 1),
                    'crowdsource_component': round(res.crowdsource_component, 1)
                },
                'explanations': explanations,
                'engine': 'C Native DLL Engine',
                'experimental_estimate': True,
                'disclaimer': 'Experimental nowcasting estimate based on hydrologic runoff calculations. Not an official meteorological emergency broadcast.'
            }
        except Exception as ex:
            pass # fallback to native python

    # --- PYTHON NATIVE IMPLEMENTATION (Fallback) ---
    intensity = rainfall.get('current_intensity_mm_hr', 0.0) if rainfall else 0.0
    accum_1h = rainfall.get('accumulation_1h', 0.0) if rainfall else 0.0
    accum_3h = rainfall.get('accumulation_3h', 0.0) if rainfall else 0.0
    forecast_2h = rainfall.get('forecast_next_2h_mm_hr', 0.0) if rainfall else 0.0

    effective_rainfall = intensity + (0.35 * accum_1h) + (0.15 * min(accum_3h, 60.0)) + (0.2 * forecast_2h)

    nominal_cap = drainage.get('nominal_capacity_mm_hr', 45.0) if drainage else 35.0
    blockage_pct = drainage.get('current_blockage_pct', 15.0) if drainage else 20.0
    silt_depth = drainage.get('silt_depth_cm', 10.0) if drainage else 10.0
    structural_status = (drainage.get('structural_status', 'Good') if drainage else 'Fair').lower()

    structural_mult = 1.0
    if structural_status == 'fair':
        structural_mult = 0.88
    elif structural_status == 'degraded':
        structural_mult = 0.72
    elif structural_status == 'collapsed':
        structural_mult = 0.35

    effective_blockage = min(100.0, blockage_pct + (silt_depth * 0.8))
    effective_drainage = max(2.0, nominal_cap * (1.0 - (effective_blockage / 100.0)) * structural_mult)

    surplus_load = max(0.0, effective_rainfall - effective_drainage)
    deficit_ratio = surplus_load / max(10.0, effective_drainage)

    imperviousness = street.get('surface_imperviousness', 0.85) if street else 0.85
    slope = street.get('slope_gradient', 1.2) if street else 1.2
    slope_ponding_penalty = 1.4 if slope < 0.6 else (1.2 if slope < 1.0 else 0.9)
    catchment_factor = imperviousness * slope_ponding_penalty

    rainfall_score = min(100.0, (effective_rainfall / 70.0) * 100.0)
    deficit_score = min(100.0, deficit_ratio * 65.0)
    blockage_score = min(100.0, effective_blockage)
    terrain_score = min(100.0, catchment_factor * 80.0)
    crowd_score = min(100.0, citizen_reports_count * 30.0)

    composite_raw = (
        (rainfall_score * weights['rainfall_weight']) +
        (deficit_score * weights['drainage_deficit_weight']) +
        (blockage_score * weights['blockage_weight']) +
        (terrain_score * weights['impervious_slope_weight']) +
        (crowd_score * weights['crowd_report_weight'])
    )

    final_score = round(max(0.0, min(100.0, composite_raw)), 1)

    if final_score < 30.0:
        severity = 'green'
        risk_level = 'Low Risk'
        color = '#16a34a'
        action_summary = 'Drainage operating within nominal runoff tolerance. Normal traffic flow.'
    elif final_score < 55.0:
        severity = 'yellow'
        risk_level = 'Moderate Risk'
        color = '#ca8a04'
        action_summary = 'Minor curb pooling expected at low spots. Ward desilting crew on watch.'
    elif final_score < 80.0:
        severity = 'orange'
        risk_level = 'High Risk'
        color = '#ea580c'
        action_summary = 'Overtopping imminent or underway (15-30cm water). Slow vehicular speed advised.'
    else:
        severity = 'red'
        risk_level = 'Severe / Critical'
        color = '#dc2626'
        action_summary = 'Critical street inundation (>45cm). High risk of vehicle stall. Responders deploy pumps.'

    explanations = []
    if effective_rainfall > effective_drainage:
        pct_exceeded = round(((effective_rainfall - effective_drainage) / effective_drainage) * 100)
        explanations.append(f"Effective rainfall load ({round(effective_rainfall, 1)} mm/hr) exceeds net drainage capacity ({round(effective_drainage, 1)} mm/hr) by {pct_exceeded}%.")
    else:
        margin = round(effective_drainage - effective_rainfall, 1)
        explanations.append(f"Drainage has a remaining buffer capacity of {margin} mm/hr under current rainfall.")

    if effective_blockage > 30.0:
        explanations.append(f"High drain obstruction: {round(blockage_pct)}% debris blockage and {round(silt_depth, 1)}cm accumulated silt reduce outfall velocity.")
    
    if structural_status != 'good':
        explanations.append(f"Drain structural condition is '{structural_status.title()}', reducing stormwater conveyance efficiency.")

    if slope < 0.8:
        explanations.append(f"Flat/depression terrain (slope {slope}%) inhibits gravitational runoff, creating a localized waterlogging sink.")

    if imperviousness > 0.8:
        explanations.append(f"High impervious surface density ({round(imperviousness*100)}% asphalt/concrete) generates immediate flash runoff without ground infiltration.")

    if citizen_reports_count > 0:
        explanations.append(f"{citizen_reports_count} verified citizen waterlogging report(s) actively logged in this street/vicinity.")

    return {
        'risk_score': final_score,
        'severity': severity,
        'risk_level': risk_level,
        'color': color,
        'action_summary': action_summary,
        'effective_rainfall_mm_hr': round(effective_rainfall, 1),
        'nominal_drainage_capacity_mm_hr': round(nominal_cap, 1),
        'effective_drainage_capacity_mm_hr': round(effective_drainage, 1),
        'surplus_water_mm_hr': round(surplus_load, 1),
        'effective_blockage_pct': round(effective_blockage, 1),
        'imperviousness_pct': round(imperviousness * 100),
        'slope_gradient_pct': slope,
        'factors_breakdown': {
            'rainfall_component': round(rainfall_score * weights['rainfall_weight'], 1),
            'drainage_deficit_component': round(deficit_score * weights['drainage_deficit_weight'], 1),
            'blockage_component': round(blockage_score * weights['blockage_weight'], 1),
            'terrain_component': round(terrain_score * weights['impervious_slope_weight'], 1),
            'crowdsource_component': round(crowd_score * weights['crowd_report_weight'], 1)
        },
        'explanations': explanations,
        'engine': 'Python Fallback Engine',
        'experimental_estimate': True,
        'disclaimer': 'Experimental nowcasting estimate based on hydrologic runoff calculations. Not an official meteorological emergency broadcast.'
    }
