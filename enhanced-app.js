class EnhancedDashboardApp {
    constructor() {
        this.dataManager = typeof DataManager !== 'undefined' ? new DataManager() : null;
        this.batchManager = typeof BatchManager !== 'undefined' ? new BatchManager(this.dataManager) : null;
        this.labIntegration = typeof LabIntegration !== 'undefined' ? new LabIntegration(this.batchManager) : null;
        this.productionPlanner = typeof ProductionPlanner !== 'undefined' ? new ProductionPlanner() : null;
        this.complianceManager = typeof ComplianceManager !== 'undefined' ? new ComplianceManager(this.batchManager) : null;
        this.aiAnalytics = typeof AIAnalytics !== 'undefined' ? new AIAnalytics(this.batchManager) : null;
        this.apiIntegration = typeof APIIntegration !== 'undefined' ? new APIIntegration(this.batchManager) : null;
        this.pwaManager = typeof PWAManager !== 'undefined' ? new PWAManager() : null;
        this.tanks = [];
        this.scannerStream = null;
        this.tempChart = null;
    }

    async init() {
        await this.loadTanks();
        this.populateQuickAddSelector();
        this.renderKPIs();
        this.renderCellarMap();
        this.renderTemperatureChart();
        this.renderFermentationProgress();
        this.renderActivityFeed();
        this.renderTimeline();
        this.bindQuickAddForm();
    }

    async loadTanks() {
        try {
            const response = await fetch('tanks.json');
            this.tanks = await response.json();
        } catch (error) {
            console.warn('Unable to load tanks configuration', error);
            this.tanks = [];
        }
    }

    populateQuickAddSelector() {
        const select = document.getElementById('quickTank');
        if (!select) return;
        select.innerHTML = '';
        this.tanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank.id;
            option.textContent = `${tank.id} (${tank.capacity} L)`;
            select.appendChild(option);
        });
    }

    bindQuickAddForm() {
        const form = document.getElementById('quickReadingForm');
        if (!form) return;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const tankId = document.getElementById('quickTank').value;
            if (!tankId || !this.dataManager) {
                return;
            }
            const reading = {
                timestamp: new Date().toISOString(),
                temperature: parseFloat(document.getElementById('quickTemp').value) || null,
                sugar: parseFloat(document.getElementById('quickSugar').value) || null,
                ph: parseFloat(document.getElementById('quickPH').value) || null,
                notes: 'Quick reading logged from dashboard'
            };
            this.dataManager.addReading(tankId, reading);
            if (this.batchManager) {
                const batch = this.batchManager.ensureBatchForTank(tankId, { volume: reading.volume ?? 0 });
                batch.history.push({ type: 'reading', data: reading, timestamp: reading.timestamp });
                this.batchManager.saveBatches();
            }
            this.closeModal();
            this.renderKPIs();
            this.renderTemperatureChart();
            this.renderFermentationProgress();
            this.renderActivityFeed();
        });
    }

    renderKPIs() {
        const batches = this.batchManager ? this.batchManager.getAllBatches() : [];
        const active = batches.filter(batch => batch.status === 'active').length;
        const totalVolume = batches.reduce((sum, batch) => sum + (batch.currentVolume ?? batch.initialVolume ?? 0), 0);
        const labSamples = batches.reduce((sum, batch) => sum + (batch.labResults?.length ?? 0), 0);
        const avgQuality = batches.length
            ? (batches.reduce((sum, batch) => sum + (batch.qualityScore ?? 0), 0) / batches.length).toFixed(1)
            : '0';

        this.updateText('kpiFermentations', active);
        this.updateText('kpiFermentationTrend', `Tracking ${batches.length} batches`);
        this.updateText('kpiVolume', `${totalVolume.toFixed(0)} L`);
        this.updateText('kpiCapacity', `${this.tanks.length ? Math.round((totalVolume / this.totalTankCapacity()) * 100) : 0}% capacity`);
        this.updateText('kpiLabSamples', labSamples);
        this.updateText('kpiLabPending', labSamples > 0 ? `${labSamples} total tests` : 'No samples yet');
        this.updateText('kpiQuality', avgQuality);
        this.updateText('kpiQualityTrend', 'AI projected quality stable');
    }

    totalTankCapacity() {
        return this.tanks.reduce((sum, tank) => sum + (tank.capacity ?? 0), 0);
    }

    updateText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    renderCellarMap() {
        if (!this.productionPlanner) return;
        const map = this.productionPlanner.generateCellarMap();
        const container = document.getElementById('cellarVisualization');
        if (!container) return;
        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'tank-grid';
        map.tanks.forEach(tank => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.innerHTML = `
                <h3>${tank.id}</h3>
                <p>Location: ${tank.location}</p>
                <p>Fill Level: ${tank.fillLevel.toFixed(1)}%</p>
                <p>Temperature: ${tank.temperature ?? 'N/A'}°C</p>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    renderTemperatureChart() {
        if (typeof Chart === 'undefined') {
            return;
        }
        const ctx = document.getElementById('tempMonitorChart');
        if (!ctx) return;
        const datasets = this.tanks.map(tank => {
            const readings = this.dataManager ? this.dataManager.getTankData(tank.id).slice(0, 7) : [];
            return {
                label: tank.id,
                data: readings.map(entry => entry.temperature ?? null),
                borderWidth: 2,
                fill: false
            };
        });
        if (this.tempChart) {
            this.tempChart.destroy();
        }
        this.tempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`),
                datasets
            },
            options: {
                responsive: true,
                plugins: { legend: { display: datasets.length > 0 } }
            }
        });
    }

    renderFermentationProgress() {
        const container = document.getElementById('fermentationProgress');
        if (!container || !this.aiAnalytics || !this.dataManager) return;
        container.innerHTML = '';
        this.tanks.slice(0, 5).forEach(tank => {
            const prediction = this.aiAnalytics.predictFermentationCompletion(tank.id, this.dataManager);
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.innerHTML = `
                <h4>${tank.id}</h4>
                <p>Days Remaining: ${prediction.daysRemaining}</p>
                <p>Confidence: ${(prediction.confidence * 100).toFixed(0)}%</p>
            `;
            container.appendChild(card);
        });
    }

    renderActivityFeed() {
        const container = document.getElementById('activityFeed');
        if (!container || !this.batchManager) return;
        container.innerHTML = '';
        const activities = this.batchManager.getAllBatches().flatMap(batch =>
            (batch.history ?? []).map(event => ({ ...event, batch: batch.id }))
        ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `<strong>${activity.batch}</strong> - ${activity.type} on ${new Date(activity.timestamp).toLocaleString()}`;
            container.appendChild(item);
        });
    }

    renderTimeline() {
        const timeline = document.getElementById('productionTimeline');
        if (!timeline || !this.productionPlanner) return;
        timeline.innerHTML = '<div class="timeline-line"></div>';
        const plan = this.productionPlanner.createProductionPlan(new Date().getFullYear());
        plan.phases.forEach(phase => {
            const eventEl = document.createElement('div');
            eventEl.className = 'timeline-event';
            eventEl.innerHTML = `
                <div class="timeline-marker"></div>
                <div class="glass-card">
                    <h4>${phase.name}</h4>
                    <p>${new Date(phase.startDate).toLocaleDateString()} - ${new Date(phase.endDate).toLocaleDateString()}</p>
                    <p>Status: ${phase.status}</p>
                </div>
            `;
            timeline.appendChild(eventEl);
        });
    }

    async openScannerModal() {
        const modal = document.getElementById('scannerModal');
        if (!modal) return;
        modal.classList.add('show');
        if (navigator.mediaDevices?.getUserMedia) {
            try {
                this.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const video = document.getElementById('scannerVideo');
                if (video) {
                    video.srcObject = this.scannerStream;
                }
            } catch (error) {
                console.error('Camera access denied', error);
            }
        }
    }

    closeScanner() {
        const modal = document.getElementById('scannerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(track => track.stop());
            this.scannerStream = null;
        }
    }

    quickAdd() {
        const modal = document.getElementById('quickAddModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeModal() {
        const modal = document.getElementById('quickAddModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
}

const enhancedApp = new EnhancedDashboardApp();
document.addEventListener('DOMContentLoaded', () => {
    enhancedApp.init();
});

function openBarcodeScanner() {
    enhancedApp.openScannerModal();
}

function closeScannerModal() {
    enhancedApp.closeScanner();
}

function quickAddReading() {
    enhancedApp.quickAdd();
}

function closeModal() {
    enhancedApp.closeModal();
}

function toggleCellar3D() {
    alert('3D view coming soon!');
}
