// uiManager.js - Manages all UI updates
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentTankId = '';
        this.editingIndex = null;
        this.initializeElements();
    }

    initializeElements() {
        // Cache all DOM elements
        this.elements = {
            tankSelect: document.getElementById('tankSelect'),
            tankDetails: document.getElementById('tankDetails'),
            varietyInput: document.getElementById('grapeVarietyInput'),
            readingForm: document.getElementById('readingForm'),
            logTableBody: document.getElementById('logTableBody'),
            logTankId: document.getElementById('logTankId'),
            overviewTableBody: document.getElementById('overviewTableBody'),
            overviewSection: document.querySelector('.overview'),
            toggleOverviewBtn: document.getElementById('toggleOverviewBtn'),
            
            // Form inputs
            timestamp: document.getElementById('timestamp'),
            temperature: document.getElementById('temperature'),
            sugar: document.getElementById('sugar'),
            sugarGL: document.getElementById('sugarGL'),
            sg: document.getElementById('sg'),
            ph: document.getElementById('ph'),
            ta: document.getElementById('ta'),
            volume: document.getElementById('volume'),
            notes: document.getElementById('notes'),
            
            // Buttons
            submitBtn: this.readingForm?.querySelector('button[type="submit"]'),
            exportJsonBtn: document.getElementById('exportJsonBtn'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            importJsonBtn: document.getElementById('importJsonBtn'),
            importCsvBtn: document.getElementById('importCsvBtn'),
            importFile: document.getElementById('importFile')
        };
    }

    setTanks(tanks) {
        this.tanks = tanks;
        this.populateTankSelector();
    }

    populateTankSelector() {
        const select = this.elements.tankSelect;
        if (!select) return;
        
        select.innerHTML = '';
        this.tanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank.id;
            option.textContent = `${tank.id} (${tank.capacity} L)`;
            select.appendChild(option);
        });
    }

    selectTank(tankId) {
        this.currentTankId = tankId;
        this.elements.tankSelect.value = tankId;
        
        const tank = this.tanks.find(t => t.id === tankId);
        if (!tank) return;
        
        // Load variety
        const variety = this.dataManager.getTankVariety(tankId);
        if (this.elements.varietyInput) {
            this.elements.varietyInput.value = variety;
        }
        
        this.updateTankDetails();
        this.renderLog();
        this.resetForm();
    }

    updateTankDetails() {
        const tank = this.tanks.find(t => t.id === this.currentTankId);
        if (!tank) return;
        
        const latest = this.dataManager.getLatestReading(this.currentTankId);
        const latestVolume = latest?.volume;
        
        const volumeDisplay = latestVolume !== undefined
            ? `${latestVolume} / ${tank.capacity} L`
            : `N/A / ${tank.capacity} L`;
        
        const variety = this.dataManager.getTankVariety(this.currentTankId) || 'N/A';
        
        this.elements.tankDetails.textContent = 
            `Volume: ${volumeDisplay}. Variety: ${variety}. Details: ${tank.description}`;
        
        // Auto-fill volume inputs
        if (latestVolume !== undefined) {
            if (this.elements.volume && !this.elements.volume.value) {
                this.elements.volume.value = latestVolume;
            }
            
            const calcVolume = document.getElementById('calcVolume');
            if (calcVolume) {
                calcVolume.value = latestVolume;
                calcVolume.dispatchEvent(new Event('input'));
            }
            
            const phVolume = document.getElementById('phVolume');
            if (phVolume && !phVolume.value) {
                phVolume.value = latestVolume;
            }
        }
    }

    renderLog() {
        const tbody = this.elements.logTableBody;
        tbody.innerHTML = '';
        
        const data = this.dataManager.getTankData(this.currentTankId);
        this.elements.logTankId.textContent = this.currentTankId;
        
        data.forEach((reading, index) => {
            const row = this.createLogRow(reading, index);
            tbody.appendChild(row);
        });

        this.renderQuickInsights();
    }

    createLogRow(reading, index) {
        const row = document.createElement('tr');
        const formattedTime = new Date(reading.timestamp).toLocaleString();
        
        // Apply visual alerts for critical values
        const tempClass = this.getAlertClass('temperature', reading.temperature);
        const phClass = this.getAlertClass('ph', reading.ph);
        const sugarClass = this.getAlertClass('sugar', reading.sugar);
        
        row.innerHTML = `
            <td>${formattedTime}</td>
            <td class="${tempClass}">${reading.temperature ?? ''}</td>
            <td class="${sugarClass}">${reading.sugar ?? ''}</td>
            <td>${reading.sg ?? ''}</td>
            <td class="${phClass}">${reading.ph ?? ''}</td>
            <td>${reading.ta ?? ''}</td>
            <td>${reading.volume ?? ''}</td>
            <td>${reading.notes ?? ''}</td>
            <td>
                <button class="edit-btn" data-index="${index}">Edit</button>
                <button class="delete-btn" data-index="${index}">Delete</button>
            </td>
        `;
        
        return row;
    }

    getAlertClass(field, value) {
        if (value === null || value === undefined) return '';
        
        const warnings = Validator.getWarnings(field, value);
        if (warnings.some(w => w.includes('Critical'))) return 'alert-critical';
        if (warnings.length > 0) return 'alert-warning';
        return '';
    }

    renderOverview() {
        const tbody = this.elements.overviewTableBody;
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.tanks.forEach(tank => {
            const latest = this.dataManager.getLatestReading(tank.id);
            if (!latest) return;
            
            const row = document.createElement('tr');
            const formattedTime = new Date(latest.timestamp).toLocaleString();
            
            row.innerHTML = `
                <td>${tank.id}</td>
                <td>${formattedTime}</td>
                <td>${latest.temperature ?? ''}</td>
                <td>${latest.sugar ?? ''}</td>
                <td>${latest.sg ?? ''}</td>
                <td>${latest.ph ?? ''}</td>
                <td>${latest.ta ?? ''}</td>
                <td><button class="view-log-btn" data-tank="${tank.id}">View Log</button></td>
            `;
            
            tbody.appendChild(row);
        });
    }

    renderQuickInsights() {
        const container = document.getElementById('insightsContainer');
        if (!container) return;

        const data = this.dataManager.getTankData(this.currentTankId);
        if (data.length < 2) {
            container.innerHTML = '<p>Need at least 2 readings for insights</p>';
            return;
        }

        // Analyze fermentation progress
        const analysis = FermentationCalculations.analyzeFermentationRate(data);

        if (!analysis) {
            container.innerHTML = '<p>Add sugar readings to see fermentation insights</p>';
            return;
        }

        const daysToComplete = analysis.daysToComplete;
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + Math.ceil(daysToComplete));

        container.innerHTML = `
            <div class="insight-card">
                <h4>Fermentation Progress</h4>
                <div class="metric">
                    <span class="metric-label">Current Sugar</span>
                    <span class="metric-value">${analysis.currentSugar.toFixed(1)} Baumé</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Drop Rate</span>
                    <span class="metric-value">${analysis.averageRate.toFixed(2)} Baumé/day</span>
                </div>
            </div>

            <div class="insight-card">
                <h4>Completion Forecast</h4>
                <div class="metric">
                    <span class="metric-label">Days Remaining</span>
                    <span class="metric-value">${Math.ceil(daysToComplete)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Est. Date</span>
                    <span class="metric-value">${completionDate.toLocaleDateString()}</span>
                </div>
            </div>

            <div class="insight-card ${this.getStatusClass(analysis)}">
                <h4>Status</h4>
                <p>${this.getStatusMessage(analysis)}</p>
            </div>
        `;
    }

    getStatusClass(analysis) {
        if (analysis.currentSugar === 0) return 'status-complete';
        if (analysis.averageRate < 0.5) return 'status-slow';
        return 'status-active';
    }

    getStatusMessage(analysis) {
        if (analysis.currentSugar === 0) {
            return '✓ Fermentation complete - ready for next stage';
        }
        if (analysis.averageRate < 0.3) {
            return '⚠️ Very slow fermentation - check temperature and nutrients';
        }
        if (analysis.averageRate < 0.5) {
            return '⚠️ Slow fermentation - consider intervention';
        }
        if (analysis.currentSugar < 2) {
            return '📊 Nearly complete - prepare for racking';
        }
        return '✓ Fermentation progressing normally';
    }

    loadFormData(reading) {
        this.elements.timestamp.value = reading.timestamp;
        this.elements.temperature.value = reading.temperature ?? '';
        this.elements.sugar.value = reading.sugar ?? '';
        this.elements.sg.value = reading.sg ?? '';
        this.elements.ph.value = reading.ph ?? '';
        this.elements.ta.value = reading.ta ?? '';
        this.elements.volume.value = reading.volume ?? '';
        this.elements.notes.value = reading.notes ?? '';
        
        // Update sugar conversion
        if (reading.sugar) {
            this.elements.sugarGL.value = FermentationCalculations.baumeToGL(reading.sugar).toFixed(1);
        }
    }

    getFormData() {
        const data = {
            timestamp: this.elements.timestamp.value
        };
        
        // Collect optional numeric fields
        ['temperature', 'sugar', 'sg', 'ph', 'ta', 'volume'].forEach(field => {
            const value = this.elements[field].value;
            if (value) data[field] = value;
        });
        
        // Add notes if present
        const notes = this.elements.notes.value.trim();
        if (notes) data.notes = notes;
        
        return data;
    }

    resetForm() {
        this.elements.readingForm.reset();
        this.elements.sugarGL.value = '';
        this.editingIndex = null;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.textContent = 'Save Reading';
        }
    }

    setEditMode(index) {
        this.editingIndex = index;
        if (this.elements.submitBtn) {
            this.elements.submitBtn.textContent = 'Update Reading';
        }
    }

    showError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-message';
            errorDiv.className = 'error-message';
            this.elements.readingForm.insertBefore(errorDiv, this.elements.readingForm.firstChild);
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        // Create or update success display
        let successDiv = document.getElementById('success-message');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'success-message';
            successDiv.className = 'success-message';
            document.body.appendChild(successDiv);
        }
        
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}