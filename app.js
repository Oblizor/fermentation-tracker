// app.js - Main application controller
class FermentationTracker {
    constructor() {
        this.dataManager = new DataManager();
        this.uiManager = new UIManager(this.dataManager);
        this.visualizer = new VisualizationEngine();
        this.alertSystem = new FermentationAlertSystem(this.dataManager);
        this.collaboration = new CollaborationManager(this.dataManager);
        this.tanks = [];
        this.reporting = new ReportingEngine(this.dataManager, this.tanks);
        this.initializeEventListeners();
        this.initializeCalculators();
        this.startAlertMonitoring();
        window.collaboration = this.collaboration;
    }

    async init() {
        try {
            // Load tanks configuration
            const response = await fetch('tanks.json');
            this.tanks = await response.json();
            
            // Initialize UI
            this.uiManager.setTanks(this.tanks);
            
            // Select first tank
            if (this.tanks.length > 0) {
                this.uiManager.selectTank(this.tanks[0].id);
                this.visualizer.renderFermentationCurve('fermentationCurveChart', this.tanks[0].id, this.dataManager);
                this.visualizer.renderMultiParameterDashboard('multiParameterChart', this.tanks[0].id, this.dataManager);
                const collabPanel = document.getElementById('collaborationPanel');
                if (collabPanel) {
                    collabPanel.innerHTML = `<div id="comments-${this.tanks[0].id}"></div>`;
                    this.collaboration.renderCommentsForTank(this.tanks[0].id);
                }
            }
            
            // Subscribe to data changes
            this.dataManager.subscribe((tankId, data) => {
                if (tankId === this.uiManager.currentTankId) {
                    this.uiManager.renderLog();
                    this.visualizer.renderFermentationCurve('fermentationCurveChart', tankId, this.dataManager);
                    this.visualizer.renderMultiParameterDashboard('multiParameterChart', tankId, this.dataManager);
                }
                this.uiManager.renderOverview();
            });
            
            // Initial overview render
            this.uiManager.renderOverview();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.uiManager.showError('Failed to load tank configuration');
        }
    }

    initializeEventListeners() {
        const ui = this.uiManager.elements;
        
        // Tank selection
        ui.tankSelect?.addEventListener('change', (e) => {
            this.uiManager.selectTank(e.target.value);
            this.visualizer.renderFermentationCurve('fermentationCurveChart', e.target.value, this.dataManager);
            this.visualizer.renderMultiParameterDashboard('multiParameterChart', e.target.value, this.dataManager);
            const collabPanel = document.getElementById('collaborationPanel');
            if (collabPanel) {
                collabPanel.innerHTML = `<div id="comments-${e.target.value}"></div>`;
                this.collaboration.renderCommentsForTank(e.target.value);
            }
        });
        
        // Variety input
        ui.varietyInput?.addEventListener('input', (e) => {
            const tankId = this.uiManager.currentTankId;
            if (!tankId) return;
            
            this.dataManager.setTankVariety(tankId, e.target.value.trim());
            this.uiManager.updateTankDetails();
        });
        
        // Form submission
        ui.readingForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });
        
        // Sugar conversion
        let updatingSugar = false;

        const updateFromBaume = (baume) => {
            const gl = FermentationCalculations.baumeToGL(baume);
            ui.sugarGL.value = gl.toFixed(1);
            if (ui.brix) {
                ui.brix.value = FermentationCalculations.glToBrix(gl).toFixed(1);
            }
        };

        const updateFromGL = (gl) => {
            ui.sugar.value = FermentationCalculations.glToBaume(gl).toFixed(1);
            if (ui.brix) {
                ui.brix.value = FermentationCalculations.glToBrix(gl).toFixed(1);
            }
        };

        const updateFromBrix = (brix) => {
            const gl = FermentationCalculations.brixToGL(brix);
            ui.sugarGL.value = gl.toFixed(1);
            ui.sugar.value = FermentationCalculations.glToBaume(gl).toFixed(1);
        };

        ui.sugar?.addEventListener('input', (e) => {
            if (updatingSugar) return;
            const baume = parseFloat(e.target.value);
            updatingSugar = true;
            if (!isNaN(baume)) {
                updateFromBaume(baume);
            } else {
                ui.sugarGL.value = '';
                if (ui.brix) ui.brix.value = '';
            }
            updatingSugar = false;
        });

        ui.sugarGL?.addEventListener('input', (e) => {
            if (updatingSugar) return;
            const gl = parseFloat(e.target.value);
            updatingSugar = true;
            if (!isNaN(gl)) {
                updateFromGL(gl);
            } else {
                ui.sugar.value = '';
                if (ui.brix) ui.brix.value = '';
            }
            updatingSugar = false;
        });

        ui.brix?.addEventListener('input', (e) => {
            if (updatingSugar) return;
            const brix = parseFloat(e.target.value);
            updatingSugar = true;
            if (!isNaN(brix)) {
                updateFromBrix(brix);
            } else {
                ui.sugar.value = '';
                ui.sugarGL.value = '';
            }
            updatingSugar = false;
        });
        
        // Log table actions
        ui.logTableBody?.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                this.handleEdit(parseInt(e.target.dataset.index));
            } else if (e.target.classList.contains('delete-btn')) {
                this.handleDelete(parseInt(e.target.dataset.index));
            }
        });
        
        // Overview actions
        ui.overviewTableBody?.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-log-btn')) {
                const tankId = e.target.dataset.tank;
                this.uiManager.selectTank(tankId);
                document.querySelector('.log-display')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        // Toggle overview
        ui.toggleOverviewBtn?.addEventListener('click', () => {
            const isHidden = ui.overviewSection.classList.toggle('hidden');
            ui.toggleOverviewBtn.textContent = isHidden ? 'Show Overview' : 'Hide Overview';
            if (!isHidden) {
                ui.overviewSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        // Export/Import
        ui.exportJsonBtn?.addEventListener('click', () => this.handleExport('json'));
        ui.exportCsvBtn?.addEventListener('click', () => this.handleExport('csv'));
        ui.importJsonBtn?.addEventListener('click', () => this.handleImport('json'));
        ui.importCsvBtn?.addEventListener('click', () => this.handleImport('csv'));
        
        ui.importFile?.addEventListener('change', (e) => this.handleFileImport(e));
    }

    handleFormSubmit() {
        const tankId = this.uiManager.currentTankId;
        if (!tankId) {
            this.uiManager.showError('Please select a tank');
            return;
        }
        
        const formData = this.uiManager.getFormData();
        const validation = Validator.validateForm(formData);
        
        if (!validation.valid) {
            this.uiManager.showError(validation.errors.join(', '));
            return;
        }
        
        if (this.uiManager.editingIndex !== null) {
            this.dataManager.updateReading(tankId, this.uiManager.editingIndex, validation.data);
            this.uiManager.showSuccess('Reading updated successfully');
        } else {
            this.dataManager.addReading(tankId, validation.data);
            this.uiManager.showSuccess('Reading saved successfully');
        }
        
        this.uiManager.resetForm();
    }

    handleEdit(index) {
        const data = this.dataManager.getTankData(this.uiManager.currentTankId);
        if (index >= 0 && index < data.length) {
            this.uiManager.loadFormData(data[index]);
            this.uiManager.setEditMode(index);
            this.uiManager.elements.readingForm.scrollIntoView({ behavior: 'smooth' });
        }
    }

    handleDelete(index) {
        if (confirm('Are you sure you want to delete this entry?')) {
            this.dataManager.deleteReading(this.uiManager.currentTankId, index);
            this.uiManager.showSuccess('Entry deleted');
        }
    }

    handleExport(format) {
        const tankId = this.uiManager.currentTankId;
        if (!tankId) {
            this.uiManager.showError('Please select a tank');
            return;
        }
        
        const data = this.dataManager.getTankData(tankId);
        if (data.length === 0) {
            this.uiManager.showError('No data to export');
            return;
        }
        
        const content = this.dataManager.exportData(tankId, format);
        const mime = format === 'csv' ? 'text/csv' : 'application/json';
        const ext = format === 'csv' ? 'csv' : 'json';
        
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tankId}_log.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.uiManager.showSuccess(`Data exported as ${format.toUpperCase()}`);
    }

    handleImport(format) {
        const tankId = this.uiManager.currentTankId;
        if (!tankId) {
            this.uiManager.showError('Please select a tank');
            return;
        }
        
        this.importFormat = format;
        this.uiManager.elements.importFile.click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let imported;
                const isCSV = this.importFormat === 'csv' || file.name.toLowerCase().endsWith('.csv');
                
                if (isCSV) {
                    imported = this.dataManager.parseCSV(e.target.result);
                } else {
                    imported = JSON.parse(e.target.result);
                }
                
                if (!Array.isArray(imported)) {
                    throw new Error('Invalid file format');
                }
                
                // Convert string values to numbers where appropriate
                const numericFields = ['temperature', 'sugar', 'sg', 'ph', 'ta', 'volume'];
                imported.forEach(entry => {
                    numericFields.forEach(field => {
                        if (entry[field] !== undefined && entry[field] !== '') {
                            const num = parseFloat(entry[field]);
                            if (!isNaN(num)) {
                                entry[field] = num;
                            }
                        }
                    });
                });
                
                this.dataManager.mergeReadings(this.uiManager.currentTankId, imported);
                this.uiManager.showSuccess('Data imported successfully');
                
            } catch (err) {
                this.uiManager.showError('Failed to import file: ' + err.message);
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
        this.importFormat = null;
    }

    initializeCalculators() {
        // Additive calculator
        const calcVolume = document.getElementById('calcVolume');
        if (!calcVolume) return;
        
        const calculators = [
            {
                name: 'Nutrients',
                rateInput: 'nutrientRate',
                resultSpan: 'nutrientAmount',
                saveBtn: 'nutrientSave',
                calc: (v, r) => FermentationCalculations.calculateNutrients(v, r)
            },
            {
                name: 'Enzymes',
                rateInput: 'enzymeRate',
                resultSpan: 'enzymeAmount',
                saveBtn: 'enzymeSave',
                calc: (v, r) => FermentationCalculations.calculateEnzymes(v, r)
            },
            {
                name: 'SO₂ (KMS)',
                rateInput: 'kmsRate',
                resultSpan: 'kmsAmount',
                saveBtn: 'kmsSave',
                calc: (v, r) => FermentationCalculations.calculateSO2(v, r)
            },
            {
                name: 'Tannins',
                rateInput: 'tanninRate',
                resultSpan: 'tanninAmount',
                saveBtn: 'tanninSave',
                calc: (v, r) => FermentationCalculations.calculateTannins(v, r)
            }
        ];
        
        // Bentonite with unit switching
        const bentoniteBtn = document.getElementById('bentoniteUnitBtn');
        const bentoniteUnits = ['g/L', 'g/hL', 'mg/L'];
        let bentoniteUnitIndex = 0;
        
        calculators.push({
            name: 'Bentonite',
            rateInput: 'bentoniteRate',
            resultSpan: 'bentoniteAmount',
            saveBtn: 'bentoniteSave',
            calc: (v, r) => FermentationCalculations.calculateBentonite(v, r, bentoniteUnits[bentoniteUnitIndex])
        });
        
        const updateCalculations = () => {
            const volume = parseFloat(calcVolume.value);
            
            calculators.forEach(calc => {
                const rateInput = document.getElementById(calc.rateInput);
                const resultSpan = document.getElementById(calc.resultSpan);
                const rate = parseFloat(rateInput?.value);
                
                if (!isNaN(volume) && !isNaN(rate) && resultSpan) {
                    const amount = calc.calc(volume, rate);
                    resultSpan.textContent = amount.toFixed(2);
                    calc.latestAmount = amount;
                } else if (resultSpan) {
                    resultSpan.textContent = '';
                    calc.latestAmount = null;
                }
            });
        };
        
        // Bentonite unit switching
        bentoniteBtn?.addEventListener('click', () => {
            bentoniteUnitIndex = (bentoniteUnitIndex + 1) % bentoniteUnits.length;
            bentoniteBtn.textContent = bentoniteUnits[bentoniteUnitIndex];
            updateCalculations();
        });
        
        // Calculator inputs
        calcVolume.addEventListener('input', updateCalculations);
        calculators.forEach(calc => {
            const input = document.getElementById(calc.rateInput);
            input?.addEventListener('input', updateCalculations);
            
            // Save buttons
            const btn = document.getElementById(calc.saveBtn);
            btn?.addEventListener('click', () => {
                const tankId = this.uiManager.currentTankId;
                if (!tankId) {
                    this.uiManager.showError('Please select a tank');
                    return;
                }
                
                if (calc.latestAmount == null) {
                    this.uiManager.showError('Please enter volume and dosage rate');
                    return;
                }
                
                this.dataManager.addReading(tankId, {
                    timestamp: formatForDateTimeInput(new Date()),
                    notes: `${calc.name}: ${calc.latestAmount.toFixed(2)} g`
                });
                
                this.uiManager.showSuccess(`${calc.name} addition logged`);
            });
        });
        
        // pH Calculator
        const calculatePHBtn = document.getElementById('calculatePH');
        calculatePHBtn?.addEventListener('click', () => {
            const currentPH = parseFloat(document.getElementById('currentPH').value);
            const targetPH = parseFloat(document.getElementById('targetPH').value);
            const volume = parseFloat(document.getElementById('phVolume').value);
            const resultDiv = document.getElementById('phResult');
            
            if (isNaN(currentPH) || isNaN(targetPH) || isNaN(volume)) {
                resultDiv.textContent = 'Please enter all values';
                return;
            }
            
            const result = FermentationCalculations.calculateAcidAddition(currentPH, targetPH, volume);
            
            if (!result.valid) {
                resultDiv.textContent = result.error;
                return;
            }
            
            resultDiv.innerHTML = `
                <div class="ph-result-success">
                    Add <strong>${result.perLiter.toFixed(2)} g/L</strong> ${result.acid} acid
                    <br>Total: <strong>${result.total.toFixed(1)} g</strong>
                </div>
            `;
        });
    }

    startAlertMonitoring() {
        setInterval(() => {
            if (this.tanks.length > 0) {
                this.alertSystem.alerts = this.alertSystem.analyzeAllTanks(this.tanks);
                this.alertSystem.renderAlertsPanel('alertsPanel');
            }
        }, 30000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new FermentationTracker();
    app.init();
});
