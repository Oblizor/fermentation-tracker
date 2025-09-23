// labIntegration.js - Laboratory data management
class LabIntegration {
    constructor(batchManager = null) {
        this.batchManager = batchManager;
        this.analyses = new Map();
        this.standards = this.loadQualityStandards();
    }

    recordLabAnalysis(batchId, analysis) {
        const molecularSO2 = this.calculateMolecularSO2(analysis.freeSO2 ?? 0, analysis.pH ?? 3.4);
        const labResult = {
            id: `LAB-${Date.now()}`,
            batchId,
            timestamp: new Date().toISOString(),
            technician: analysis.technician ?? null,
            sampleId: analysis.sampleId ?? null,

            // Basic parameters
            alcohol: analysis.alcohol ?? null,
            residualSugar: analysis.residualSugar ?? null,
            totalAcidity: analysis.totalAcidity ?? null,
            volatileAcidity: analysis.volatileAcidity ?? null,
            pH: analysis.pH ?? null,

            // Advanced parameters
            malicAcid: analysis.malicAcid ?? null,
            lacticAcid: analysis.lacticAcid ?? null,
            tartaricAcid: analysis.tartaricAcid ?? null,
            citricAcid: analysis.citricAcid ?? null,

            // SO2 levels
            freeSO2: analysis.freeSO2 ?? null,
            totalSO2: analysis.totalSO2 ?? null,
            molecularSO2,

            // Metals and minerals
            copper: analysis.copper ?? null,
            iron: analysis.iron ?? null,
            calcium: analysis.calcium ?? null,
            potassium: analysis.potassium ?? null,

            // Microbiological
            yeastCount: analysis.yeastCount ?? null,
            bacteriaCount: analysis.bacteriaCount ?? null,
            brettanomyces: analysis.brettanomyces ?? null,

            // Phenolic compounds
            totalPhenols: analysis.totalPhenols ?? null,
            tannins: analysis.tannins ?? null,
            anthocyanins: analysis.anthocyanins ?? null,
            colorIntensity: analysis.colorIntensity ?? null,
            hue: analysis.hue ?? null,

            // Stability tests
            proteinStability: analysis.proteinStability ?? null,
            tartrateStability: analysis.tartrateStability ?? null,
            microbiologicalStability: analysis.microbiologicalStability ?? null,

            // Quality assessment
            qualityScore: this.assessQuality({ ...analysis, molecularSO2 }),
            compliance: this.checkCompliance({ ...analysis, molecularSO2 }),
            recommendations: this.generateRecommendations({ ...analysis, molecularSO2 })
        };

        if (!this.analyses.has(batchId)) {
            this.analyses.set(batchId, []);
        }
        this.analyses.get(batchId).push(labResult);

        if (this.batchManager) {
            this.batchManager.recordLabResult(batchId, labResult);
        }

        return labResult;
    }

    calculateMolecularSO2(freeSO2, pH) {
        const pKa = 1.81;
        if (!Number.isFinite(freeSO2) || !Number.isFinite(pH)) {
            return 0;
        }
        return freeSO2 / (1 + Math.pow(10, pH - pKa));
    }

    assessQuality(analysis) {
        let score = 100;
        const penalties = [];

        if (analysis.volatileAcidity != null && analysis.volatileAcidity > 0.7) {
            score -= 20;
            penalties.push('High VA');
        }

        if (analysis.molecularSO2 != null && analysis.molecularSO2 < 0.5) {
            score -= 10;
            penalties.push('Low molecular SO2');
        }

        if (analysis.brettanomyces != null && analysis.brettanomyces > 100) {
            score -= 30;
            penalties.push('Brett detected');
        }

        if (analysis.pH != null && (analysis.pH < 3 || analysis.pH > 3.8)) {
            score -= 5;
            penalties.push('pH outside ideal range');
        }

        return { score: Math.max(0, score), penalties };
    }

    checkCompliance(analysis) {
        const compliance = {};
        Object.entries(this.standards).forEach(([parameter, standard]) => {
            const value = analysis[parameter];
            if (value == null) {
                compliance[parameter] = { compliant: true, message: 'No data' };
                return;
            }

            const withinRange = value >= standard.min && value <= standard.max;
            compliance[parameter] = {
                compliant: withinRange,
                message: withinRange
                    ? 'Within specification'
                    : `Outside range (${standard.min} - ${standard.max})`
            };
        });

        return compliance;
    }

    generateRecommendations(analysis) {
        const recommendations = [];
        const molecularSO2 = analysis.molecularSO2 ?? this.calculateMolecularSO2(analysis.freeSO2 ?? 0, analysis.pH ?? 3.4);

        if (molecularSO2 < 0.5) {
            const needed = this.calculateSO2Addition(analysis);
            recommendations.push(`Add ${needed.toFixed(1)} mg/L SO₂ for protection`);
        }

        if (analysis.volatileAcidity != null && analysis.volatileAcidity > 0.6) {
            recommendations.push('Consider reverse osmosis for VA reduction');
        }

        if (analysis.proteinStability === false) {
            recommendations.push('Bentonite treatment needed for protein stability');
        }

        if (analysis.malicAcid != null && analysis.malicAcid > 2) {
            recommendations.push('Monitor malolactic fermentation progress');
        }

        return recommendations;
    }

    calculateSO2Addition(analysis) {
        const targetMolecular = 0.8;
        const pH = analysis.pH ?? 3.4;
        const currentFree = analysis.freeSO2 ?? 0;
        const molecular = this.calculateMolecularSO2(currentFree, pH);
        if (molecular >= targetMolecular) {
            return 0;
        }

        const targetFree = targetMolecular * (1 + Math.pow(10, (pH ?? 3.4) - 1.81));
        return Math.max(0, targetFree - currentFree) * 1000 / 1000; // mg/L equivalent
    }

    loadQualityStandards() {
        return {
            alcohol: { min: 10, max: 16 },
            residualSugar: { min: 0.5, max: 8 },
            totalAcidity: { min: 4, max: 8 },
            volatileAcidity: { min: 0.1, max: 0.7 },
            pH: { min: 3, max: 3.8 },
            malicAcid: { min: 0, max: 5 },
            lacticAcid: { min: 0, max: 3 },
            freeSO2: { min: 10, max: 40 },
            totalSO2: { min: 50, max: 150 }
        };
    }

    getAnalyses(batchId) {
        return this.analyses.get(batchId) ?? [];
    }

    getLatestAnalysis(batchId) {
        const analyses = this.getAnalyses(batchId);
        if (analyses.length === 0) return null;
        return analyses[analyses.length - 1];
    }
}

if (typeof window !== 'undefined') {
    window.LabIntegration = LabIntegration;
}
