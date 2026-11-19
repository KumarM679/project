#include "risk_engine.h"
#include <iostream>
#include <vector>
#include <string>
#include <iomanip>

class FloodRiskCalculator {
public:
    FloodRiskCalculator(CModelWeights weights = {0.35, 0.30, 0.15, 0.12, 0.08})
        : weights_(weights) {}

    CRiskResult evaluate(
        const CStreetParams& street,
        const CDrainageParams& drainage,
        const CRainfallParams& rainfall,
        int citizenReportsCount = 0
    ) const {
        CRiskResult res;
        calculate_flood_risk_c(&street, &drainage, &rainfall, citizenReportsCount, &weights_, &res);
        return res;
    }

    void setWeights(const CModelWeights& weights) {
        weights_ = weights;
    }

private:
    CModelWeights weights_;
};

// Standalone C++ demonstration execution
int main() {
    std::cout << "========================================================\n";
    std::cout << "  JalDrishti C++ Urban Flood Risk Nowcasting Engine     \n";
    std::cout << "========================================================\n\n";

    FloodRiskCalculator calculator;

    CStreetParams street = { 0.92, 0.4 }; // Silk Board Low-Lying Underpass
    CDrainageParams drain = { 48.0, 68.0, 26.0, 1 }; // Fair status, 68% blockage
    CRainfallParams rain = { 54.5, 48.0, 82.0, 62.0 }; // Heavy monsoon rain

    CRiskResult result = calculator.evaluate(street, drain, rain, 4);

    std::cout << std::fixed << std::setprecision(1);
    std::cout << "Target: Silk Board Low-Lying Underpass\n";
    std::cout << "Calculated Risk Score : " << result.risk_score << " / 100\n";
    std::cout << "Severity Band         : " << result.severity << " (" << result.risk_level << ")\n";
    std::cout << "Color Code            : " << result.color << "\n";
    std::cout << "Effective Rainfall    : " << result.effective_rainfall << " mm/hr\n";
    std::cout << "Effective Drainage    : " << result.effective_drainage_capacity << " mm/hr\n";
    std::cout << "Capacity Deficit      : " << result.surplus_water << " mm/hr\n";
    std::cout << "Estimated Inundation  : " << result.estimated_depth_cm << " cm\n";
    std::cout << "Action Summary        : " << result.action_summary << "\n\n";

    return 0;
}

