#include "risk_engine.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char* argv[]) {
    printf("========================================================\n");
    printf("   JalDrishti C-Engine: Flood Risk Predictor CLI        \n");
    printf("========================================================\n\n");

    CStreetParams street = { 0.95, 0.3 };            /* High impervious, low slope */
    CDrainageParams drainage = { 45.0, 60.0, 20.0, 2 }; /* Degraded drain */
    CRainfallParams rainfall = { 65.0, 50.0, 80.0, 70.0 }; /* Intense rain */
    int citizen_reports = 3;

    CRiskResult result;
    calculate_flood_risk_c(&street, &drainage, &rainfall, citizen_reports, NULL, &result);

    printf("Analysis Results:\n");
    printf("--------------------------------------------------------\n");
    printf("  Flood Risk Score   : %.1f / 100.0\n", result.risk_score);
    printf("  Severity Level     : %s (%s)\n", result.severity, result.risk_level);
    printf("  Effective Rainfall : %.1f mm/hr\n", result.effective_rainfall);
    printf("  Effective Drainage : %.1f mm/hr\n", result.effective_drainage_capacity);
    printf("  Surplus Water      : %.1f mm/hr\n", result.surplus_water);
    printf("  Ponding Depth Est. : %.1f cm\n", result.estimated_depth_cm);
    printf("  Recommended Action : %s\n", result.action_summary);
    printf("--------------------------------------------------------\n");

    return 0;
}

