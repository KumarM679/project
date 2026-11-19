package jaldrishti;

import java.util.ArrayList;
import java.util.List;

/**
 * JalDrishti: Urban Flood Nowcasting System
 * Java Flood Risk Calculation Engine
 */
public class FloodRiskEngine {

    public static class StreetParams {
        public double surfaceImperviousness = 0.85;
        public double slopeGradient = 1.2;

        public StreetParams(double imperviousness, double slope) {
            this.surfaceImperviousness = imperviousness;
            this.slopeGradient = slope;
        }
    }

    public static class DrainageParams {
        public double nominalCapacityMmHr = 45.0;
        public double currentBlockagePct = 15.0;
        public double siltDepthCm = 10.0;
        public String structuralStatus = "Good";

        public DrainageParams(double nominalCap, double blockage, double silt, String status) {
            this.nominalCapacityMmHr = nominalCap;
            this.currentBlockagePct = blockage;
            this.siltDepthCm = silt;
            this.structuralStatus = status;
        }
    }

    public static class RainfallParams {
        public double currentIntensityMmHr = 0.0;
        public double accumulation1h = 0.0;
        public double accumulation3h = 0.0;
        public double forecastNext2hMmHr = 0.0;

        public RainfallParams(double intensity, double a1, double a3, double f2) {
            this.currentIntensityMmHr = intensity;
            this.accumulation1h = a1;
            this.accumulation3h = a3;
            this.forecastNext2hMmHr = f2;
        }
    }

    public static class Weights {
        public double rainfall = 0.35;
        public double deficit = 0.30;
        public double blockage = 0.15;
        public double terrain = 0.12;
        public double crowd = 0.08;
    }

    public static class RiskEvaluation {
        public double riskScore;
        public String severity;
        public String riskLevel;
        public String color;
        public String actionSummary;
        public double effectiveRainfallMmHr;
        public double effectiveDrainageMmHr;
        public double surplusWaterMmHr;
        public double estimatedDepthCm;
        public List<String> explanations = new ArrayList<>();
    }

    public static RiskEvaluation calculate(StreetParams street, DrainageParams drainage, RainfallParams rain, int citizenReports, Weights w) {
        if (w == null) w = new Weights();
        RiskEvaluation res = new RiskEvaluation();

        // 1. Effective Rainfall
        double effectiveRain = rain.currentIntensityMmHr + (0.35 * rain.accumulation1h) + (0.15 * Math.min(rain.accumulation3h, 60.0)) + (0.2 * rain.forecastNext2hMmHr);

        // 2. Structural Degradation Multiplier
        double structMult = 1.0;
        String status = drainage.structuralStatus.toLowerCase();
        if (status.equals("fair")) structMult = 0.88;
        else if (status.equals("degraded")) structMult = 0.72;
        else if (status.equals("collapsed")) structMult = 0.35;

        // Effective Drainage
        double effectiveBlockage = Math.min(100.0, drainage.currentBlockagePct + (drainage.siltDepthCm * 0.8));
        double effectiveDrain = Math.max(2.0, drainage.nominalCapacityMmHr * (1.0 - (effectiveBlockage / 100.0)) * structMult);

        // 3. Deficit
        double surplus = Math.max(0.0, effectiveRain - effectiveDrain);
        double deficitRatio = surplus / Math.max(10.0, effectiveDrain);

        // 4. Terrain
        double pondingPenalty = (street.slopeGradient < 0.6) ? 1.4 : ((street.slopeGradient < 1.0) ? 1.2 : 0.9);
        double catchmentFactor = street.surfaceImperviousness * pondingPenalty;

        // 5. Scores
        double rainfallScore = Math.min(100.0, (effectiveRain / 70.0) * 100.0);
        double deficitScore = Math.min(100.0, deficitRatio * 65.0);
        double blockageScore = Math.min(100.0, effectiveBlockage);
        double terrainScore = Math.min(100.0, catchmentFactor * 80.0);
        double crowdScore = Math.min(100.0, citizenReports * 30.0);

        double composite = (rainfallScore * w.rainfall) + (deficitScore * w.deficit) + (blockageScore * w.blockage) + (terrainScore * w.terrain) + (crowdScore * w.crowd);
        res.riskScore = Math.round(Math.max(0.0, Math.min(100.0, composite)) * 10.0) / 10.0;
        res.effectiveRainfallMmHr = Math.round(effectiveRain * 10.0) / 10.0;
        res.effectiveDrainageMmHr = Math.round(effectiveDrain * 10.0) / 10.0;
        res.surplusWaterMmHr = Math.round(surplus * 10.0) / 10.0;

        if (surplus <= 0.0) {
            res.estimatedDepthCm = 0.0;
        } else {
            res.estimatedDepthCm = Math.round(Math.min(120.0, (surplus * 0.45) * catchmentFactor) * 10.0) / 10.0;
        }

        if (res.riskScore < 30.0) {
            res.severity = "green";
            res.riskLevel = "Low Risk";
            res.color = "#16a34a";
            res.actionSummary = "Drainage operating within nominal runoff tolerance. Normal traffic flow.";
        } else if (res.riskScore < 55.0) {
            res.severity = "yellow";
            res.riskLevel = "Moderate Risk";
            res.color = "#ca8a04";
            res.actionSummary = "Minor curb pooling expected at low spots. Ward desilting crew on watch.";
        } else if (res.riskScore < 80.0) {
            res.severity = "orange";
            res.riskLevel = "High Risk";
            res.color = "#ea580c";
            res.actionSummary = "Overtopping imminent or underway (15-30cm water). Slow vehicular speed advised.";
        } else {
            res.severity = "red";
            res.riskLevel = "Severe / Critical";
            res.color = "#dc2626";
            res.actionSummary = "Critical street inundation (>45cm). High risk of vehicle stall. Responders deploy pumps.";
        }

        return res;
    }
}

