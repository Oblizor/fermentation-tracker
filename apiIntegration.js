// apiIntegration.js - External service integrations
class APIIntegration {
    constructor(batchManager = null) {
        this.batchManager = batchManager;
        this.endpoints = {
            weather: 'https://api.weather.com/v1/',
            marketPrices: 'https://wine-market-api.com/',
            laboratoryLIMS: 'https://lims-system.com/api/',
            bottlingLine: 'https://bottling-control.local/',
            erp: 'https://erp-system.com/api/'
        };
    }

    async fetchLocalBatches() {
        if (!this.batchManager) {
            return [];
        }
        return this.batchManager.getAllBatches();
    }

    calculateUnitCost(batch) {
        const costs = batch?.costTracking ?? {};
        const total = (costs.grapes ?? 0) + (costs.labor ?? 0) + (costs.materials ?? 0) + (costs.overhead ?? 0);
        const volume = batch?.currentVolume ?? batch?.initialVolume ?? 1;
        return volume > 0 ? total / volume : total;
    }

    async postToERP(path, payload) {
        if (typeof fetch !== 'function') {
            return { success: false, reason: 'fetch-unavailable' };
        }
        try {
            const response = await fetch(`${this.endpoints.erp}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`ERP request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('ERP sync failed', error);
            return { success: false, error: error.message };
        }
    }

    async syncWithERP() {
        const batches = await this.fetchLocalBatches();
        const erpData = batches.map(batch => ({
            itemCode: batch.id,
            description: `${batch.variety ?? 'Blend'} ${batch.vintage ?? ''}`.trim(),
            quantity: batch.currentVolume ?? 0,
            unitCost: this.calculateUnitCost(batch),
            location: batch.currentTank ?? 'Cellar',
            status: batch.status ?? 'active'
        }));
        return this.postToERP('/inventory/update', erpData);
    }

    async fetchWeatherData(vineyard) {
        if (typeof fetch !== 'function') {
            return null;
        }
        try {
            const response = await fetch(`${this.endpoints.weather}forecast?location=${encodeURIComponent(vineyard)}&days=10`);
            if (!response.ok) {
                throw new Error(`Weather API returned ${response.status}`);
            }
            const weather = await response.json();
            return {
                harvestWindow: this.analyzeHarvestWindow(weather),
                risks: this.identifyWeatherRisks(weather),
                recommendations: this.generateWeatherRecommendations(weather)
            };
        } catch (error) {
            console.warn('Weather data unavailable', error);
            return {
                harvestWindow: null,
                risks: ['Unable to fetch weather data'],
                recommendations: []
            };
        }
    }

    analyzeHarvestWindow(weather) {
        if (!weather || !Array.isArray(weather.forecast)) {
            return null;
        }
        const favorable = weather.forecast.filter(day => day.precipitation < 20 && day.temperatureMax < 32);
        return favorable.slice(0, 5).map(day => ({ date: day.date, condition: day.summary }));
    }

    identifyWeatherRisks(weather) {
        if (!weather || !Array.isArray(weather.forecast)) {
            return [];
        }
        return weather.forecast
            .filter(day => day.precipitation > 40 || day.temperatureMax > 35)
            .map(day => `High risk on ${day.date}: ${day.summary}`);
    }

    generateWeatherRecommendations(weather) {
        const risks = this.identifyWeatherRisks(weather);
        if (risks.length === 0) {
            return ['Weather conditions favorable. Proceed with planned harvest.'];
        }
        return ['Monitor conditions closely', 'Prepare canopy management and irrigation adjustments'];
    }

    async integrateWithLIMS(sampleId) {
        if (typeof fetch !== 'function') {
            return null;
        }
        try {
            const response = await fetch(`${this.endpoints.laboratoryLIMS}samples/${encodeURIComponent(sampleId)}`);
            if (!response.ok) {
                throw new Error(`LIMS response ${response.status}`);
            }
            const labData = await response.json();
            return this.mapLIMSData(labData);
        } catch (error) {
            console.warn('LIMS integration failed', error);
            return null;
        }
    }

    mapLIMSData(labData) {
        if (!labData) return null;
        return {
            sampleId: labData.id,
            alcohol: labData.parameters?.alcohol,
            pH: labData.parameters?.pH,
            residualSugar: labData.parameters?.residual_sugar,
            totalAcidity: labData.parameters?.total_acidity,
            timestamp: labData.completed_at
        };
    }

    async controlBottlingLine(command) {
        if (typeof fetch !== 'function') {
            return { success: false, reason: 'fetch-unavailable' };
        }
        try {
            const response = await fetch(`${this.endpoints.bottlingLine}control`, {
                method: 'POST',
                body: JSON.stringify(command),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Bottling line request failed ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('Bottling line control failed', error);
            return { success: false, error: error.message };
        }
    }
}

if (typeof window !== 'undefined') {
    window.APIIntegration = APIIntegration;
}
