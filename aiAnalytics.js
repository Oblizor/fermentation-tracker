// aiAnalytics.js - Machine learning predictions
class AIAnalytics {
    constructor(batchManager = null) {
        this.batchManager = batchManager;
        this.models = {
            fermentation: this.loadFermentationModel(),
            quality: this.loadQualityModel(),
            market: this.loadMarketModel()
        };
    }

    loadFermentationModel() {
        return {
            predict: (features) => {
                // Placeholder model using simple trend analysis
                const { times, sugars } = features;
                if (times.length < 2 || sugars.length < 2) {
                    return { days: 7, finalSugar: sugars[sugars.length - 1] ?? 0 };
                }
                const slope = (sugars[sugars.length - 1] - sugars[0]) / (times[times.length - 1] - times[0] || 1);
                const projectedDays = slope >= 0 ? 10 : Math.min(30, Math.abs(sugars[sugars.length - 1] / slope));
                return { days: projectedDays, finalSugar: Math.max(0, sugars[sugars.length - 1] + slope * projectedDays) };
            }
        };
    }

    loadQualityModel() {
        return {
            confidence: 0.75,
            predict: (inputs) => {
                let score = 85;
                const modifiers = inputs.filter(value => typeof value === 'number');
                if (modifiers.length) {
                    const avg = modifiers.reduce((sum, val) => sum + val, 0) / modifiers.length;
                    score += Math.min(10, avg / 10);
                }
                score += (Math.random() - 0.5) * 2; // slight variation
                return Math.max(70, Math.min(99, score));
            }
        };
    }

    loadMarketModel() {
        return {
            predict: ({ variety }) => ({
                demandIndex: 0.6 + (variety ? variety.length % 5 / 10 : 0.2),
                priceIndex: 1.1
            })
        };
    }

    extractFermentationFeatures(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return { times: [], sugars: [], temperatures: [], startDate: new Date() };
        }
        const sorted = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const start = new Date(sorted[0].timestamp ?? Date.now());
        const times = [];
        const sugars = [];
        const temperatures = [];
        sorted.forEach(entry => {
            const time = (new Date(entry.timestamp).getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            times.push(time);
            const sugar = entry.sugar ?? entry.brix ?? entry.sg ?? 0;
            sugars.push(Number(sugar));
            if (entry.temperature != null) {
                temperatures.push(Number(entry.temperature));
            }
        });
        return { times, sugars, temperatures, startDate: start };
    }

    polynomialRegression(features) {
        const { times, sugars, startDate } = features;
        if (times.length < 2 || sugars.length < 2) {
            const fallbackDate = new Date(startDate.getTime());
            fallbackDate.setDate(fallbackDate.getDate() + 7);
            return { date: fallbackDate.toISOString(), finalSugar: sugars[sugars.length - 1] ?? 0, days: 7 };
        }
        const sumX = times.reduce((a, b) => a + b, 0);
        const sumY = sugars.reduce((a, b) => a + b, 0);
        const sumXY = times.reduce((sum, x, i) => sum + x * sugars[i], 0);
        const sumXX = times.reduce((sum, x) => sum + x * x, 0);
        const n = times.length;
        const denominator = n * sumXX - sumX * sumX || 1;
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        const targetSugar = 0.5;
        const days = slope >= 0 ? 14 : Math.max(0, (targetSugar - intercept) / slope);
        const completion = new Date(startDate.getTime());
        completion.setDate(completion.getDate() + Math.round(days));
        return { date: completion.toISOString(), finalSugar: Math.max(0, intercept + slope * days), days: Math.round(days) };
    }

    calculateConfidence(data) {
        if (!Array.isArray(data) || data.length === 0) return 0.3;
        const hasTemperature = data.some(entry => entry.temperature != null);
        const hasSugar = data.some(entry => entry.sugar != null || entry.brix != null);
        const density = Math.min(1, data.length / 10);
        let confidence = 0.5 + density * 0.3;
        if (!hasTemperature) confidence -= 0.1;
        if (!hasSugar) confidence -= 0.2;
        return Math.max(0.1, Math.min(0.95, confidence));
    }

    identifyRisks(data) {
        if (!Array.isArray(data) || data.length === 0) return [];
        const risks = [];
        const latest = data[data.length - 1];
        if (latest.temperature != null && latest.temperature > 25) {
            risks.push('High fermentation temperature');
        }
        if (latest.sugar != null && latest.sugar > 10) {
            risks.push('Slow sugar reduction');
        }
        const previous = data[data.length - 2];
        if (previous && latest.sugar != null && previous.sugar != null && latest.sugar > previous.sugar) {
            risks.push('Sugar level increasing');
        }
        return risks;
    }

    calculateOptimalTemperature(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return 18;
        }
        const temps = data.map(entry => entry.temperature).filter(value => typeof value === 'number');
        if (temps.length === 0) {
            return 18;
        }
        const avg = temps.reduce((sum, value) => sum + value, 0) / temps.length;
        return Math.round(Math.max(15, Math.min(24, avg)));
    }

    generateAIRecommendations(data, prediction) {
        const recommendations = [];
        const latest = data[data.length - 1];
        if (!latest) {
            return recommendations;
        }

        const optimalTemp = this.calculateOptimalTemperature(data);
        if (latest.temperature != null && Math.abs(latest.temperature - optimalTemp) > 2) {
            recommendations.push({
                priority: 'high',
                action: `Adjust temperature to ${optimalTemp}°C for optimal fermentation`,
                impact: 'Improve fermentation kinetics and aroma development'
            });
        }

        if (prediction.days > 20 && latest.sugar != null && latest.sugar > 5) {
            recommendations.push({
                priority: 'medium',
                action: 'Consider nutrient addition to support yeast',
                impact: 'Prevent stuck fermentation'
            });
        }

        return recommendations;
    }

    predictFermentationCompletion(tankId, dataManager) {
        const data = dataManager.getTankData(tankId);
        const features = this.extractFermentationFeatures(data);
        const prediction = this.polynomialRegression(features);
        const confidence = this.calculateConfidence(data);
        return {
            estimatedCompletion: prediction.date,
            finalSugar: prediction.finalSugar,
            daysRemaining: prediction.days,
            confidence,
            riskFactors: this.identifyRisks(data),
            recommendations: this.generateAIRecommendations(data, prediction)
        };
    }

    normalizeLabData(labResults) {
        if (!Array.isArray(labResults) || labResults.length === 0) {
            return [0, 0, 0, 0, 0];
        }
        const latest = labResults[labResults.length - 1];
        return [
            latest.alcohol ?? 12,
            latest.residualSugar ?? 2,
            latest.pH ?? 3.5,
            latest.totalAcidity ?? 6,
            latest.volatileAcidity ?? 0.4
        ];
    }

    encodeTreatments(treatments) {
        if (!Array.isArray(treatments) || treatments.length === 0) {
            return [0, 0, 0];
        }
        const nutrient = treatments.filter(t => /nutrient/i.test(t.type ?? t.name ?? '')).length;
        const oak = treatments.filter(t => /oak|barrel/i.test(t.type ?? t.name ?? '')).length;
        const so2 = treatments.filter(t => /so.?2|kms/i.test(t.type ?? t.name ?? '')).length;
        return [nutrient, oak, so2];
    }

    explainPrediction(inputs, qualityScore) {
        const explanations = [];
        if (qualityScore > 90) {
            explanations.push('Strong lab chemistry aligned with premium benchmarks.');
        } else if (qualityScore < 80) {
            explanations.push('Lab metrics suggest quality risks that should be addressed.');
        }
        const sugar = inputs[1];
        if (typeof sugar === 'number' && sugar > 5) {
            explanations.push('Residual sugar level is elevated; ensure fermentation completion.');
        }
        return explanations;
    }

    suggestImprovements(batch, qualityScore) {
        const suggestions = [];
        if (qualityScore < 85) {
            suggestions.push('Review oak integration plan to build mid-palate weight.');
        }
        if ((batch.labResults ?? []).length === 0) {
            suggestions.push('Schedule full lab panel to verify wine stability.');
        }
        if ((batch.treatments ?? []).every(t => !/so.?2/i.test(t.name ?? ''))) {
            suggestions.push('Confirm sulfur regime to maintain microbial stability.');
        }
        return suggestions;
    }

    predictQualityScore(batchId) {
        const batch = this.batchManager?.getBatch(batchId);
        if (!batch) {
            return null;
        }
        const inputs = [
            batch.variety,
            batch.vintage,
            batch.vineyard,
            ...this.normalizeLabData(batch.labResults),
            ...this.encodeTreatments(batch.treatments)
        ];
        const qualityScore = this.models.quality.predict(inputs);
        return {
            predictedScore: qualityScore,
            confidence: this.models.quality.confidence,
            keyFactors: this.explainPrediction(inputs, qualityScore),
            improvements: this.suggestImprovements(batch, qualityScore)
        };
    }

    analyzeMarketTrends(variety, vintage) {
        const basePrice = 15 + (variety ? variety.length : 5);
        const ageFactor = Math.max(0.8, 1 + ((new Date().getFullYear() - vintage) * 0.02));
        return {
            averagePrice: basePrice * ageFactor,
            demandIndex: 0.6 + Math.random() * 0.2,
            trend: Math.random() > 0.5 ? 'upward' : 'stable'
        };
    }

    calculateOptimalPrice(quality, market, batch) {
        const cost = this.calculateMinPrice(batch);
        const qualityPremium = (quality.predictedScore - 85) * 0.5;
        const marketPremium = market.trend === 'upward' ? 2 : 0;
        return Math.max(cost, market.averagePrice + qualityPremium + marketPremium);
    }

    calculateMinPrice(batch) {
        const costs = batch?.costTracking ?? {};
        const total = (costs.grapes ?? 0) + (costs.labor ?? 0) + (costs.materials ?? 0) + (costs.overhead ?? 0);
        const bottles = batch?.bottleCount ?? 0;
        if (bottles === 0) {
            return total > 0 ? total / 12 : 10;
        }
        return (total / bottles) * 1.2;
    }

    calculateMaxPrice(quality, market) {
        const base = market.averagePrice * (market.trend === 'upward' ? 1.1 : 1.0);
        const premium = (quality.predictedScore - 80) * 0.8;
        return Math.max(base, base + premium);
    }

    analyzeCompetitors(batch) {
        return [
            { name: 'Estate Reserve', price: 45, score: 92 },
            { name: 'Regional Benchmark', price: 38, score: 89 }
        ].map(entry => ({
            ...entry,
            difference: batch?.sellingPrice ? batch.sellingPrice - entry.price : null
        }));
    }

    forecastDemand(batch, market) {
        const baseDemand = market.demandIndex * 1000;
        const adjustments = (batch?.qualityScore ?? 85) / 100;
        return Math.round(baseDemand * adjustments);
    }

    calculateProfitMargins(batch) {
        const minPrice = this.calculateMinPrice(batch);
        const currentPrice = batch?.sellingPrice ?? minPrice;
        const costs = batch?.costTracking ?? {};
        const totalCost = (costs.grapes ?? 0) + (costs.labor ?? 0) + (costs.materials ?? 0) + (costs.overhead ?? 0);
        const revenue = (batch?.bottleCount ?? 0) * currentPrice;
        return {
            costPerBottle: batch?.bottleCount ? totalCost / batch.bottleCount : minPrice,
            grossMargin: revenue - totalCost,
            marginPercent: revenue ? ((revenue - totalCost) / revenue) * 100 : 0
        };
    }

    optimizePricing(batchId) {
        const batch = this.batchManager?.getBatch(batchId);
        if (!batch) return null;
        const quality = this.predictQualityScore(batchId);
        const market = this.analyzeMarketTrends(batch.variety, batch.vintage);
        return {
            suggestedPrice: this.calculateOptimalPrice(quality, market, batch),
            priceRange: {
                min: this.calculateMinPrice(batch),
                max: this.calculateMaxPrice(quality, market)
            },
            competitorAnalysis: this.analyzeCompetitors(batch),
            demandForecast: this.forecastDemand(batch, market),
            profitability: this.calculateProfitMargins(batch)
        };
    }

    trainIsolationForest(data) {
        const stats = ['temperature', 'sugar', 'brix', 'ph'].reduce((acc, key) => {
            const values = data.map(entry => entry[key]).filter(value => typeof value === 'number');
            if (values.length === 0) {
                acc[key] = { mean: 0, std: 1 };
                return acc;
            }
            const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
            const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
            acc[key] = { mean, std: Math.sqrt(variance) || 1 };
            return acc;
        }, {});

        return {
            stats,
            predict(reading) {
                let score = 0;
                Object.entries(stats).forEach(([key, { mean, std }]) => {
                    const value = reading[key];
                    if (typeof value === 'number') {
                        const deviation = Math.abs(value - mean) / std;
                        if (deviation > 2) {
                            score += Math.min(1, deviation / 3);
                        }
                    }
                });
                return Math.min(1, score);
            }
        };
    }

    identifyAnomalousParameters(reading, forest) {
        const anomalies = [];
        Object.entries(forest.stats).forEach(([key, { mean, std }]) => {
            const value = reading[key];
            if (typeof value === 'number') {
                const deviation = Math.abs(value - mean) / std;
                if (deviation > 2) {
                    anomalies.push({ parameter: key, deviation });
                }
            }
        });
        return anomalies;
    }

    calculateSeverity(score) {
        if (score > 0.8) return 'high';
        if (score > 0.5) return 'medium';
        if (score > 0.3) return 'elevated';
        return 'low';
    }

    recommendAction(reading, score) {
        if (reading.temperature && reading.temperature > 28) {
            return 'Lower tank temperature immediately to avoid spoilage.';
        }
        if (reading.sugar && reading.sugar > 15) {
            return 'Consider yeast nutrient addition to restart fermentation.';
        }
        return score > 0.5 ? 'Investigate anomaly and validate sensor calibration.' : 'Monitor closely.';
    }

    detectAnomalies(tankId, dataManager) {
        const data = dataManager.getTankData(tankId);
        const anomalies = [];
        if (data.length === 0) {
            return anomalies;
        }
        const forest = this.trainIsolationForest(data);
        data.forEach((reading, index) => {
            const anomalyScore = forest.predict(reading);
            if (anomalyScore > 0.6) {
                anomalies.push({
                    index,
                    timestamp: reading.timestamp,
                    score: anomalyScore,
                    parameters: this.identifyAnomalousParameters(reading, forest),
                    severity: this.calculateSeverity(anomalyScore),
                    action: this.recommendAction(reading, anomalyScore)
                });
            }
        });
        return anomalies;
    }
}

if (typeof window !== 'undefined') {
    window.AIAnalytics = AIAnalytics;
}
