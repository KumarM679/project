#ifndef JALDRISHTI_RISK_ENGINE_H
#define JALDRISHTI_RISK_ENGINE_H

#ifdef __cplusplus
extern "C" {
#endif

#ifdef _WIN32
    #ifdef BUILDING_RISK_ENGINE_DLL
        #define RISK_API __declspec(dllexport)
    #else
        #define RISK_API __declspec(dllimport)
    #endif
#else
    #define RISK_API
#endif

/* Street catchment parameters */
typedef struct {
    double surface_imperviousness;
    double slope_gradient;
} CStreetParams;

/* Drainage network telemetry and condition */
typedef struct {
    double nominal_capacity_mm_hr;
    double current_blockage_pct;
    double silt_depth_cm;
    int structural_status_code; /* 0: Good, 1: Fair, 2: Degraded, 3: Collapsed */
} CDrainageParams;

/* Real-time rainfall telemetry */
typedef struct {
    double current_intensity_mm_hr;
    double accumulation_1h;
    double accumulation_3h;
    double forecast_next_2h_mm_hr;
} CRainfallParams;

/* Model weight calibration */
typedef struct {
    double rainfall_weight;
    double drainage_deficit_weight;
    double blockage_weight;
    double impervious_slope_weight;
    double crowd_report_weight;
} CModelWeights;

/* Nowcasting flood risk computation output */
typedef struct {
    double risk_score;
    char severity[16];
    char risk_level[32];
    char color[16];
    char action_summary[256];
    double effective_rainfall;
    double nominal_drainage_capacity;
    double effective_drainage_capacity;
    double surplus_water;
    double effective_blockage;
    double rainfall_component;
    double drainage_deficit_component;
    double blockage_component;
    double terrain_component;
    double crowdsource_component;
    double estimated_depth_cm;
    int time_to_ponding_min;
} CRiskResult;

/**
 * Calculates street-level flood risk score (0-100) and hydrodynamic factors.
 */
RISK_API void calculate_flood_risk_c(
    const CStreetParams* street,
    const CDrainageParams* drainage,
    const CRainfallParams* rainfall,
    int citizen_reports_count,
    const CModelWeights* weights,
    CRiskResult* result
);

#ifdef __cplusplus
}
#endif

#endif /* JALDRISHTI_RISK_ENGINE_H */

