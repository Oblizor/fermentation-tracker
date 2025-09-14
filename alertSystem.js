// alertSystem.js - AI-powered fermentation monitoring
class FermentationAlertSystem {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.alertThresholds = {
            temperature: { low: 10, high: 30, critical: 35 },
            ph: { low: 2.8, high: 3.8, critical: 4.2 },
            sugar: {
                stuckFermentation: 0.5, // Days without drop
                rapidFermentation: 3.0  // Baumé per day
            }
        };
        this.alerts = [];
    }

    analyzeAllTanks(tanks) {
        const allAlerts = [];
        
        tanks.forEach(tank => {
            const tankAlerts = this.analyzeTank(tank.id);
            allAlerts.push(...tankAlerts.map(alert => ({
                ...alert,
                tankId: tank.id,
                tankCapacity: tank.capacity
            })));
        });

        return this.prioritizeAlerts(allAlerts);
    }

    analyzeTank(tankId) {
        const data = this.dataManager.getTankData(tankId);
        if (data.length < 2) return [];

        const alerts = [];
        const latest = data[0];
        const previous = data[1];

        // Temperature alerts
        alerts.push(...this.checkTemperature(latest, previous));
        
        // pH alerts
        alerts.push(...this.checkPH(latest, previous));
        
        // Fermentation kinetics alerts
        alerts.push(...this.checkFermentationKinetics(data));
        
        // Predictive alerts
        alerts.push(...this.predictiveAnalysis(data));

        return alerts;
    }

    checkTemperature(latest, previous) {
        const alerts = [];
        const temp = latest.temperature;
        
        if (!temp) return alerts;

        if (temp < this.alertThresholds.temperature.low) {
            alerts.push({
                type: 'warning',
                category: 'temperature',
                message: `Low temperature (${temp}°C) may slow fermentation`,
                severity: 'medium',
                timestamp: latest.timestamp,
                recommendation: 'Consider moving to warmer location or insulating tank'
            });
        }

        if (temp > this.alertThresholds.temperature.high) {
            const severity = temp > this.alertThresholds.temperature.critical ? 'critical' : 'high';
            alerts.push({
                type: severity === 'critical' ? 'critical' : 'warning',
                category: 'temperature',
                message: `${severity === 'critical' ? 'Critical' : 'High'} temperature (${temp}°C)`,
                severity,
                timestamp: latest.timestamp,
                recommendation: severity === 'critical'
                    ? 'IMMEDIATE ACTION: Cool tank immediately to prevent yeast death'
                    : 'Cool tank to prevent yeast stress and off-flavors'
            });
        }

        // Temperature trend analysis
        if (previous.temperature && Math.abs(temp - previous.temperature) > 5) {
            alerts.push({
                type: 'info',
                category: 'temperature',
                message: `Rapid temperature change: ${previous.temperature}°C → ${temp}°C`,
                severity: 'low',
                timestamp: latest.timestamp,
                recommendation: 'Monitor closely for fermentation stability'
            });
        }

        return alerts;
    }

    checkPH(latest, previous) {
        const alerts = [];
        const ph = latest.ph;
        if (!ph) return alerts;

        if (ph < this.alertThresholds.ph.low || ph > this.alertThresholds.ph.high) {
            const type = ph > this.alertThresholds.ph.critical ? 'critical' : 'warning';
            alerts.push({
                type,
                category: 'ph',
                message: `pH out of optimal range: ${ph}`,
                severity: ph > this.alertThresholds.ph.critical ? 'high' : 'medium',
                timestamp: latest.timestamp,
                recommendation: 'Adjust pH or monitor closely'
            });
        }

        if (previous.ph && Math.abs(ph - previous.ph) > 0.3) {
            alerts.push({
                type: 'info',
                category: 'ph',
                message: `Rapid pH change: ${previous.ph} → ${ph}`,
                severity: 'low',
                timestamp: latest.timestamp,
                recommendation: 'Investigate potential causes'
            });
        }

        return alerts;
    }

    checkFermentationKinetics(data) {
        const alerts = [];
        const sugarData = data.filter(d => d.sugar !== undefined)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (sugarData.length < 3) return alerts;

        // Check for stuck fermentation
        const recentReadings = sugarData.slice(-3);
        const sugarDrop = recentReadings[0].sugar - recentReadings[recentReadings.length - 1].sugar;
        const daysDifference = (new Date(recentReadings[recentReadings.length - 1].timestamp) -
                              new Date(recentReadings[0].timestamp)) / (1000 * 60 * 60 * 24);

        if (daysDifference > 2 && sugarDrop < this.alertThresholds.sugar.stuckFermentation) {
            alerts.push({
                type: 'critical',
                category: 'fermentation',
                message: `Possible stuck fermentation - only ${sugarDrop.toFixed(1)} Baumé drop in ${daysDifference.toFixed(1)} days`,
                severity: 'critical',
                timestamp: recentReadings[recentReadings.length - 1].timestamp,
                recommendation: 'Check yeast viability, temperature, and nutrient levels. Consider re-inoculation.'
            });
        }

        // Check for too rapid fermentation
        for (let i = 1; i < recentReadings.length; i++) {
            const daysDiff = (new Date(recentReadings[i].timestamp) -
                            new Date(recentReadings[i-1].timestamp)) / (1000 * 60 * 60 * 24);
            const dailyDrop = (recentReadings[i-1].sugar - recentReadings[i].sugar) / daysDiff;

            if (dailyDrop > this.alertThresholds.sugar.rapidFermentation) {
                alerts.push({
                    type: 'warning',
                    category: 'fermentation',
                    message: `Rapid fermentation detected: ${dailyDrop.toFixed(1)} Baumé/day`,
                    severity: 'medium',
                    timestamp: recentReadings[i].timestamp,
                    recommendation: 'Monitor temperature closely. Consider cooling to slow fermentation.'
                });
                break;
            }
        }

        return alerts;
    }

    predictiveAnalysis(data) {
        const alerts = [];
        
        // Predict completion time
        const analysis = FermentationCalculations.analyzeFermentationRate(data);
        if (analysis && analysis.daysToComplete > 0) {
            if (analysis.daysToComplete > 21) {
                alerts.push({
                    type: 'warning',
                    category: 'prediction',
                    message: `Fermentation may take ${Math.ceil(analysis.daysToComplete)} more days`,
                    severity: 'medium',
                    timestamp: new Date().toISOString(),
                    recommendation: 'Consider checking yeast health and nutrient availability'
                });
            } else if (analysis.daysToComplete < 3 && analysis.currentSugar > 2) {
                alerts.push({
                    type: 'info',
                    category: 'prediction',
                    message: `Fermentation expected to complete in ${Math.ceil(analysis.daysToComplete)} days`,
                    severity: 'low',
                    timestamp: new Date().toISOString(),
                    recommendation: 'Prepare for pressing/racking operations'
                });
            }
        }

        return alerts;
    }

    prioritizeAlerts(alerts) {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return alerts.sort((a, b) => {
            const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
            if (severityDiff !== 0) return severityDiff;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }

    renderAlertsPanel(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const alerts = this.alerts.slice(0, 10); // Show top 10 alerts
        
        container.innerHTML = `
            <div class="alerts-header">
                <h3>🚨 Active Alerts</h3>
                <span class="alert-count">${alerts.length} active</span>
            </div>
            <div class="alerts-list">
                ${alerts.map(alert => `
                    <div class="alert alert-${alert.type} alert-${alert.severity}">
                        <div class="alert-header">
                            <span class="alert-tank">Tank ${alert.tankId}</span>
                            <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
                        </div>
                        <div class="alert-message">${alert.message}</div>
                        <div class="alert-recommendation">${alert.recommendation}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
}
