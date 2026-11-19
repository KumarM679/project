#define BUILDING_RISK_ENGINE_DLL
#include "risk_engine.h"
#include <string.h>
#include <math.h>
#include <stdio.h>

static double c_min(double a, double b) {
    return (a < b) ? a : b;
}

static double c_max(double a, double b) {
    return (a > b) ? a : b;
}

static double c_clamp(double val, double low, double high) {
    return c_max(low, c_min(high, val));
}

void calculate_flood_risk_c(
    const CStreetParams* street,
    const CDrainageParams* drainage,
    const CRainfallParams* rainfall,
    int citizen_reports_count,
    const CModelWeights* weights,
    CRiskResult* result
) {
    if (!result) return;
    memset(result, 0, sizeof(CRiskResult));

    /* Default model weights if not provided */
    CModelWeights w;
    if (weights) {
        w = *weights;
    } else {
        w.rainfall_weight = 0.35;
        w.drainage_deficit_weight = 0.30;
        w.blockage_weight = 0.15;
        w.impervious_slope_weight = 0.12;
        w.crowd_report_weight = 0.08;
    }

    /* 1. Rainfall Parameters */
    double intensity   = rainfall ? rainfall->current_intensity_mm_hr : 0.0;
    double accum_1h    = rainfall ? rainfall->accumulation_1h : 0.0;
    double accum_3h    = rainfall ? rainfall->accumulation_3h : 0.0;
    double forecast_2h = rainfall ? rainfall->forecast_next_2h_mm_hr : 0.0;

    double effective_rainfall = intensity + (0.35 * accum_1h) + (0.15 * c_min(accum_3h, 60.0)) + (0.2 * forecast_2h);

    /* 2. Drainage Parameters */
    double nominal_cap  = drainage ? drainage->nominal_capacity_mm_hr : 35.0;
    double blockage_pct = drainage ? drainage->current_blockage_pct : 20.0;
    double silt_depth   = drainage ? drainage->silt_depth_cm : 10.0;
    int structural_code = drainage ? drainage->structural_status_code : 0;

    double structural_mult = 1.0;
    if (structural_code == 1) structural_mult = 0.88;       /* Fair */
    else if (structural_code == 2) structural_mult = 0.72;  /* Degraded */
    else if (structural_code == 3) structural_mult = 0.35;  /* Collapsed */

    double effective_blockage = c_min(100.0, blockage_pct + (silt_depth * 0.8));
    double effective_drainage = c_max(2.0, nominal_cap * (1.0 - (effective_blockage / 100.0)) * structural_mult);

    /* 3. Surplus Load & Deficit Ratio */
    double surplus_load = c_max(0.0, effective_rainfall - effective_drainage);
    double deficit_ratio = surplus_load / c_max(10.0, effective_drainage);

    /* 4. Terrain & Catchment */
    double imperviousness = street ? street->surface_imperviousness : 0.85;
    double slope = street ? street->slope_gradient : 1.2;
    double slope_ponding_penalty = (slope < 0.6) ? 1.4 : ((slope < 1.0) ? 1.2 : 0.9);
    double catchment_factor = imperviousness * slope_ponding_penalty;

    /* 5. Sub-component Scores (0 - 100) */
    double rainfall_score = c_min(100.0, (effective_rainfall / 70.0) * 100.0);
    double deficit_score  = c_min(100.0, deficit_ratio * 65.0);
    double blockage_score = c_min(100.0, effective_blockage);
    double terrain_score  = c_min(100.0, catchment_factor * 80.0);
    double crowd_score    = c_min(100.0, (double)citizen_reports_count * 30.0);

    /* 6. Composite Score */
    double composite_raw = (
        (rainfall_score * w.rainfall_weight) +
        (deficit_score * w.drainage_deficit_weight) +
        (blockage_score * w.blockage_weight) +
        (terrain_score * w.impervious_slope_weight) +
        (crowd_score * w.crowd_report_weight)
    );

    double final_score = floor(c_clamp(composite_raw, 0.0, 100.0) * 10.0 + 0.5) / 10.0;

    /* Store populated values */
    result->risk_score = final_score;
    result->effective_rainfall = floor(effective_rainfall * 10.0 + 0.5) / 10.0;
    result->nominal_drainage_capacity = floor(nominal_cap * 10.0 + 0.5) / 10.0;
    result->effective_drainage_capacity = floor(effective_drainage * 10.0 + 0.5) / 10.0;
    result->surplus_water = floor(surplus_load * 10.0 + 0.5) / 10.0;
    result->effective_blockage = floor(effective_blockage * 10.0 + 0.5) / 10.0;

    result->rainfall_component = floor((rainfall_score * w.rainfall_weight) * 10.0 + 0.5) / 10.0;
    result->drainage_deficit_component = floor((deficit_score * w.drainage_deficit_weight) * 10.0 + 0.5) / 10.0;
    result->blockage_component = floor((blockage_score * w.blockage_weight) * 10.0 + 0.5) / 10.0;
    result->terrain_component = floor((terrain_score * w.impervious_slope_weight) * 10.0 + 0.5) / 10.0;
    result->crowdsource_component = floor((crowd_score * w.crowd_report_weight) * 10.0 + 0.5) / 10.0;

    /* Depth estimation */
    if (surplus_load <= 0.0) {
        result->estimated_depth_cm = 0.0;
        result->time_to_ponding_min = -1;
    } else {
        result->estimated_depth_cm = floor(c_min(120.0, (surplus_load * 0.45) * catchment_factor) * 10.0 + 0.5) / 10.0;
        result->time_to_ponding_min = (int)c_max(5.0, floor(45.0 / c_max(0.5, deficit_ratio)));
    }

    /* Severity Banding */
    if (final_score < 30.0) {
        strncpy(result->severity, "green", sizeof(result->severity) - 1);
        strncpy(result->risk_level, "Low Risk", sizeof(result->risk_level) - 1);
        strncpy(result->color, "#16a34a", sizeof(result->color) - 1);
        strncpy(result->action_summary, "Drainage operating within nominal runoff tolerance. Normal traffic flow.", sizeof(result->action_summary) - 1);
    } else if (final_score < 55.0) {
        strncpy(result->severity, "yellow", sizeof(result->severity) - 1);
        strncpy(result->risk_level, "Moderate Risk", sizeof(result->risk_level) - 1);
        strncpy(result->color, "#ca8a04", sizeof(result->color) - 1);
        strncpy(result->action_summary, "Minor curb pooling expected at low spots. Ward desilting crew on watch.", sizeof(result->action_summary) - 1);
    } else if (final_score < 80.0) {
        strncpy(result->severity, "orange", sizeof(result->severity) - 1);
        strncpy(result->risk_level, "High Risk", sizeof(result->risk_level) - 1);
        strncpy(result->color, "#ea580c", sizeof(result->color) - 1);
        strncpy(result->action_summary, "Overtopping imminent or underway (15-30cm water). Slow vehicular speed advised.", sizeof(result->action_summary) - 1);
    } else {
        strncpy(result->severity, "red", sizeof(result->severity) - 1);
        strncpy(result->risk_level, "Severe / Critical", sizeof(result->risk_level) - 1);
        strncpy(result->color, "#dc2626", sizeof(result->color) - 1);
        strncpy(result->action_summary, "Critical street inundation (>45cm). High risk of vehicle stall. Responders deploy pumps.", sizeof(result->action_summary) - 1);
    }
}

