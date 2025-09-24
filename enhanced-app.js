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
        this.workflowManager = typeof HarvestWorkflowManager !== 'undefined'
            ? new HarvestWorkflowManager(this.dataManager, this.batchManager)
            : null;
        this.tanks = [];
        this.scannerStream = null;
        this.scanFrameRequest = null;
        this.scannerActive = false;
        this.lastScanData = null;
        this.scanResultElement = null;
        this.lastScanAttempt = 0;
        this.tempChart = null;
        this.currentView = 'dashboard';
        this.cellar3DEnabled = false;
        this.notifications = [];
        this.notificationsOpen = false;
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleEscape = this.handleEscape.bind(this);
    }

    async init() {
        await this.loadTanks();
        this.populateQuickAddSelector();
        this.bindNavigation();
        this.bindQuickAddForm();
        this.bindHeaderActions();
        this.bindHarvestWorkflowForm();
        this.bindWorkflowActionHandlers();
        this.bindNotificationPanel();
        this.bindGlobalEvents();
        this.updateNotifications();
        this.renderTankOverview();
        this.renderBatchOverview();
        this.renderLabOverview();
        this.renderProductionSchedule();
        this.renderHarvestWorkflowBoard();
        this.renderAnalyticsSummary();
        this.renderSettingsPanel();
        this.switchView(this.currentView);
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

    bindHeaderActions() {
        const quickAddButton = document.querySelector('[data-action="quick-add"]');
        if (quickAddButton) {
            quickAddButton.addEventListener('click', () => {
                this.quickAdd();
            });
        }

        const scanButton = document.querySelector('[data-action="open-scanner"]');
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                this.openScannerModal();
            });
        }

        const toggleNotificationsButton = document.querySelector('[data-action="toggle-notifications"]');
        if (toggleNotificationsButton) {
            toggleNotificationsButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleNotifications();
            });
        }

        const closeNotificationsButton = document.querySelector('[data-action="close-notifications"]');
        if (closeNotificationsButton) {
            closeNotificationsButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleNotifications(false);
            });
        }

        const quickAddModal = document.getElementById('quickAddModal');
        if (quickAddModal) {
            quickAddModal.addEventListener('click', (event) => {
                if (event.target === quickAddModal) {
                    this.closeModal();
                }
            });
        }

        document.querySelectorAll('[data-action="close-modal"]').forEach(button => {
            button.addEventListener('click', () => {
                this.closeModal();
            });
        });

        const scannerModal = document.getElementById('scannerModal');
        if (scannerModal) {
            scannerModal.addEventListener('click', (event) => {
                if (event.target === scannerModal) {
                    this.closeScanner();
                }
            });
        }

        document.querySelectorAll('[data-action="close-scanner"]').forEach(button => {
            button.addEventListener('click', () => {
                this.closeScanner();
            });
        });

        const toggle3DButton = document.querySelector('[data-action="toggle-3d"]');
        if (toggle3DButton) {
            toggle3DButton.addEventListener('click', () => {
                this.toggleCellarViewMode();
            });
        }
    }

    bindNavigation() {
        const navItems = document.querySelectorAll('.nav-menu .nav-item[data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetView = item.dataset.view;
                if (targetView) {
                    this.switchView(targetView);
                }
            });
        });
    }

    bindNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.addEventListener('click', (event) => event.stopPropagation());
        }
    }

    bindGlobalEvents() {
        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleEscape);
    }

    handleDocumentClick(event) {
        if (!this.notificationsOpen) {
            return;
        }
        const panel = document.getElementById('notificationPanel');
        const button = document.querySelector('.btn-notifications');
        if (!panel || !button) {
            return;
        }
        if (panel.contains(event.target) || button.contains(event.target)) {
            return;
        }
        this.toggleNotifications(false);
    }

    handleEscape(event) {
        if (event.key === 'Escape' && this.notificationsOpen) {
            this.toggleNotifications(false);
        }
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
            this.renderTankOverview();
            this.renderBatchOverview();
            this.renderAnalyticsSummary();
            this.updateNotifications();
        });
    }

    bindHarvestWorkflowForm() {
        const form = document.getElementById('harvestIntakeForm');
        if (!form || !this.workflowManager) {
            return;
        }

        const setDefaultArrival = () => {
            const arrivalInput = document.getElementById('intakeArrival');
            if (!arrivalInput) {
                return;
            }
            const formatted = this.formatInputDate(new Date(), true);
            arrivalInput.value = formatted;
        };

        setDefaultArrival();

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const payload = {
                arrivalTime: data.get('arrivalTime') || null,
                vineyard: (data.get('vineyard') || '').trim(),
                block: (data.get('block') || '').trim(),
                variety: (data.get('variety') || '').trim(),
                vehicleType: data.get('vehicleType') || 'tractor-trailer',
                crateCount: data.get('crateCount'),
                crateWeight: data.get('crateWeight'),
                notes: (data.get('notes') || '').trim(),
                route: data.get('route') || 'press'
            };
            this.workflowManager.createTransport(payload);
            form.reset();
            setDefaultArrival();
            this.handleWorkflowChange({ refreshBatches: false });
        });
    }

    bindWorkflowActionHandlers() {
        const list = document.getElementById('harvestWorkflowList');
        if (!list || !this.workflowManager) {
            return;
        }

        list.addEventListener('submit', (event) => {
            const form = event.target instanceof HTMLFormElement
                ? event.target
                : event.target.closest('form[data-workflow-id]');
            if (!form) {
                return;
            }
            event.preventDefault();
            const workflowId = form.dataset.workflowId;
            const action = form.dataset.action;
            if (!workflowId || !action) {
                return;
            }
            this.handleWorkflowAction(action, workflowId, new FormData(form));
        });
    }

    handleWorkflowAction(action, workflowId, formData) {
        if (!this.workflowManager) {
            return;
        }
        const values = Object.fromEntries(formData.entries());
        const trimmed = (input) => (input ?? '').toString().trim();
        switch (action) {
            case 'destemming':
                this.workflowManager.recordDestemming(workflowId, {
                    timestamp: values.timestamp || null,
                    route: values.route || 'press',
                    tankId: trimmed(values.tankId) || null,
                    estimatedVolume: values.estimatedVolume,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: false });
                break;
            case 'pressing':
                this.workflowManager.recordPressing(workflowId, {
                    timestamp: values.timestamp || null,
                    pressId: trimmed(values.pressId),
                    mustVolume: values.mustVolume,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: false });
                break;
            case 'settling-start':
                this.workflowManager.startSettling(workflowId, {
                    start: values.start || null,
                    tankId: trimmed(values.tankId),
                    expectedHours: values.expectedHours,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: false });
                break;
            case 'settling-complete':
                this.workflowManager.completeSettling(workflowId, {
                    end: values.end || null,
                    clarity: trimmed(values.clarity),
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: false });
                break;
            case 'fermentation-start':
                this.workflowManager.startFermentation(workflowId, {
                    inoculatedAt: values.inoculatedAt || null,
                    tankId: trimmed(values.tankId),
                    yeast: trimmed(values.yeast),
                    volume: values.volume,
                    temperature: values.temperature,
                    density: values.density,
                    scale: values.scale,
                    ph: values.ph,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: true });
                break;
            case 'addition':
                this.workflowManager.recordAddition(workflowId, {
                    product: trimmed(values.product),
                    amount: values.amount,
                    unit: trimmed(values.unit),
                    stage: values.stage,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: values.stage === 'fermentation' });
                break;
            case 'reading':
                this.workflowManager.recordFermentationReading(workflowId, {
                    timestamp: values.timestamp || null,
                    temperature: values.temperature,
                    density: values.density,
                    scale: values.scale,
                    ph: values.ph,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: true, refreshCharts: true });
                break;
            case 'burb':
                this.workflowManager.recordBurbProcessing(workflowId, {
                    startedAt: values.startedAt || null,
                    bentoniteAddedAt: values.bentoniteAddedAt || null,
                    notes: trimmed(values.notes)
                });
                this.handleWorkflowChange({ refreshBatches: false });
                break;
            default:
                break;
        }
    }

    handleWorkflowChange({ refreshBatches = false, refreshCharts = false } = {}) {
        this.renderHarvestWorkflowBoard();
        this.renderActivityFeed();
        this.updateNotifications();
        if (refreshBatches) {
            this.renderBatchOverview();
            this.renderTankOverview();
            this.renderKPIs();
        }
        if (refreshCharts) {
            this.renderFermentationProgress();
            this.renderTemperatureChart();
        }
    }

    renderHarvestWorkflowBoard() {
        const list = document.getElementById('harvestWorkflowList');
        const emptyState = document.getElementById('harvestWorkflowEmptyState');
        if (!list || !this.workflowManager) {
            return;
        }

        const arrivalInput = document.getElementById('intakeArrival');
        if (arrivalInput && !arrivalInput.value) {
            arrivalInput.value = this.formatInputDate(new Date(), true);
        }

        const workflows = this.workflowManager.getWorkflows();
        list.innerHTML = '';

        if (!workflows.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);

        workflows.sort((a, b) => new Date(b.arrival.time) - new Date(a.arrival.time));
        workflows.forEach(workflow => {
            list.appendChild(this.buildWorkflowCard(workflow));
        });
    }

    buildWorkflowCard(workflow) {
        const card = document.createElement('article');
        card.className = 'glass-card workflow-card';
        const statusMeta = this.getWorkflowStatusMeta(workflow);
        const transportLabel = this.formatTransport(workflow.arrival?.vehicleType);
        const crateInfo = workflow.arrival?.crateCount
            ? `${this.formatNumber(workflow.arrival.crateCount)} × ${workflow.arrival.crateWeight ?? '—'} kg`
            : '—';
        const totalWeight = workflow.arrival?.totalWeight
            ? `${this.formatNumber(workflow.arrival.totalWeight)} kg`
            : '—';
        const plannedVolume = workflow.fermentation?.volume ?? workflow.fermentation?.plannedVolume;
        const routeLabel = workflow.route === 'press'
            ? 'Destem • Press • Settling'
            : 'Destem • Direct fermentation';
        const fermentationTank = workflow.fermentation?.tankId || 'Not assigned';

        const alerts = [];
        if (workflow.settling?.start && !workflow.settling?.end) {
            const elapsed = (Date.now() - new Date(workflow.settling.start).getTime()) / (1000 * 60 * 60);
            if (Number.isFinite(elapsed) && elapsed > 72) {
                alerts.push(`Settling active for ${Math.round(elapsed)} h`);
            }
        }
        if (workflow.fermentation?.started) {
            const readings = workflow.fermentation.readings;
            const lastReading = Array.isArray(readings) && readings.length ? readings[readings.length - 1] : null;
            if (!lastReading || (Date.now() - new Date(lastReading.timestamp).getTime()) / (1000 * 60 * 60) > 30) {
                alerts.push('Capture a fresh fermentation reading');
            }
        }

        const header = `
            <header>
                <div>
                    <h3>${this.escapeHtml(workflow.grapes?.variety || 'Unassigned variety')}</h3>
                    <p class="small-note">${this.escapeHtml(workflow.grapes?.vineyard || 'Vineyard TBD')}${workflow.grapes?.block ? ` • Block ${this.escapeHtml(workflow.grapes.block)}` : ''}</p>
                </div>
                <span class="status-pill ${statusMeta.className}">${statusMeta.label}</span>
            </header>
        `;

        const meta = `
            <dl class="workflow-meta">
                <div>
                    <dt>Arrival</dt>
                    <dd>${this.formatDate(workflow.arrival?.time)}</dd>
                </div>
                <div>
                    <dt>Transport</dt>
                    <dd>${this.escapeHtml(transportLabel)}</dd>
                </div>
                <div>
                    <dt>Crates</dt>
                    <dd>${crateInfo}</dd>
                </div>
                <div>
                    <dt>Total weight</dt>
                    <dd>${totalWeight}</dd>
                </div>
                <div>
                    <dt>Route</dt>
                    <dd>${this.escapeHtml(routeLabel)}</dd>
                </div>
                <div>
                    <dt>Fermentation tank</dt>
                    <dd>${this.escapeHtml(fermentationTank)}</dd>
                </div>
                <div>
                    <dt>Planned volume</dt>
                    <dd>${plannedVolume !== null && plannedVolume !== undefined ? `${this.formatNumber(plannedVolume)} L` : '—'}</dd>
                </div>
            </dl>
        `;

        const notesFooter = workflow.arrival?.notes
            ? `<footer class="small-note">Intake notes: ${this.escapeHtml(workflow.arrival.notes)}</footer>`
            : '';

        card.innerHTML = [
            header,
            alerts.length ? alerts.map(message => `<div class="workflow-alert">${this.escapeHtml(message)}</div>`).join('') : '',
            meta,
            this.buildWorkflowProgress(workflow),
            this.buildWorkflowActions(workflow),
            this.buildAdditionsSection(workflow),
            this.buildReadingsSection(workflow),
            this.buildHistorySection(workflow),
            notesFooter
        ].filter(Boolean).join('');

        return card;
    }

    getWorkflowStatusMeta(workflow) {
        const defaultMeta = { label: 'In intake', className: 'status-warning' };
        if (!workflow) {
            return defaultMeta;
        }
        switch (workflow.status) {
            case 'intake':
                return { label: 'Awaiting destemming', className: 'status-warning' };
            case 'destemmed':
                return { label: workflow.route === 'press' ? 'Ready for pressing' : 'Ready for fermentation', className: 'status-warning' };
            case 'pressed':
                return { label: 'Pressed – assign settling tank', className: 'status-warning' };
            case 'settling':
                return { label: `Settling in ${workflow.settling?.tankId || 'tank'}`, className: 'status-warning' };
            case 'settled':
                return { label: 'Settling complete', className: 'status-active' };
            case 'fermenting':
                return { label: `Fermenting in ${workflow.fermentation?.tankId || 'tank'}`, className: 'status-active' };
            default:
                return defaultMeta;
        }
    }

    formatTransport(type) {
        switch ((type || '').toLowerCase()) {
            case 'tractor-trailer':
                return 'Farm trailer with crates';
            case 'fiat-ducato':
                return 'Coachbuilt Fiat Ducato';
            case 'other':
                return 'Other transport';
            default:
                return type || 'Not recorded';
        }
    }

    buildWorkflowProgress(workflow) {
        if (!workflow) {
            return '';
        }
        const steps = [
            { id: 'intake', label: 'Transport', completed: true },
            { id: 'destemming', label: 'Destemming', completed: workflow.destemming?.completed },
            { id: 'pressing', label: 'Pressing', completed: workflow.route === 'press' ? workflow.pressing?.completed : true, hidden: workflow.route !== 'press' },
            { id: 'settling', label: 'Settling', completed: workflow.route === 'press' ? Boolean(workflow.settling?.end) : true, inProgress: workflow.settling?.start && !workflow.settling?.end, hidden: workflow.route !== 'press' },
            { id: 'fermentation', label: 'Fermentation', completed: workflow.fermentation?.started }
        ].filter(step => !step.hidden);

        const items = steps.map(step => {
            const classes = [''];
            if (step.completed) {
                classes.push('completed');
            } else if (step.inProgress) {
                classes.push('in-progress');
            }
            return `<li class="${classes.join(' ').trim()}">${step.label}</li>`;
        }).join('');
        return `<ol class="workflow-progress">${items}</ol>`;
    }

    buildWorkflowActions(workflow) {
        const sections = [];
        if (!workflow.destemming?.completed) {
            sections.push(this.buildDestemmingForm(workflow));
        }
        if (workflow.route === 'press' && workflow.destemming?.completed && !workflow.pressing?.completed) {
            sections.push(this.buildPressingForm(workflow));
        }
        if (workflow.route === 'press' && workflow.pressing?.completed && !workflow.settling?.start) {
            sections.push(this.buildSettlingStartForm(workflow));
        }
        if (workflow.route === 'press' && workflow.settling?.start && !workflow.settling?.end) {
            sections.push(this.buildSettlingCompleteForm(workflow));
        }

        const canStartFermentation = !workflow.fermentation?.started && (
            workflow.route === 'tank'
                ? workflow.destemming?.completed
                : Boolean(workflow.settling?.end)
        );
        if (canStartFermentation) {
            sections.push(this.buildFermentationStartForm(workflow));
        }
        if (workflow.fermentation?.started) {
            sections.push(this.buildFermentationReadingForm(workflow));
        }
        sections.push(this.buildAdditionForm(workflow));
        if (workflow.route === 'press') {
            sections.push(this.buildBurbForm(workflow));
        }

        const content = sections.filter(Boolean).join('');
        return content ? `<div class="workflow-actions">${content}</div>` : '';
    }

    buildDestemmingForm(workflow) {
        const timestamp = this.formatInputDate(workflow.destemming?.timestamp, true);
        const route = workflow.route === 'tank' ? 'tank' : 'press';
        const estimatedVolume = workflow.fermentation?.plannedVolume ?? '';
        return `
            <form class="workflow-action-form" data-action="destemming" data-workflow-id="${workflow.id}">
                <h4>Destemming &amp; routing</h4>
                <div class="form-row">
                    <label for="dest-${workflow.id}">Destemmed at</label>
                    <input type="datetime-local" id="dest-${workflow.id}" name="timestamp" value="${timestamp}">
                </div>
                <div class="fieldset-options">
                    <div class="option">
                        <input type="radio" id="dest-route-press-${workflow.id}" name="route" value="press" ${route !== 'tank' ? 'checked' : ''}>
                        <label for="dest-route-press-${workflow.id}">Press for settling</label>
                    </div>
                    <div class="option">
                        <input type="radio" id="dest-route-tank-${workflow.id}" name="route" value="tank" ${route === 'tank' ? 'checked' : ''}>
                        <label for="dest-route-tank-${workflow.id}">Send to fermentation tank</label>
                    </div>
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="dest-volume-${workflow.id}">Estimated volume (L)</label>
                        <input type="number" step="0.1" min="0" id="dest-volume-${workflow.id}" name="estimatedVolume" value="${estimatedVolume ?? ''}">
                    </div>
                    <div>
                        <label for="dest-tank-${workflow.id}">Fermentation tank</label>
                        <select id="dest-tank-${workflow.id}" name="tankId">
                            ${this.buildTankOptions(workflow.fermentation?.tankId)}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <label for="dest-notes-${workflow.id}">Notes</label>
                    <textarea id="dest-notes-${workflow.id}" name="notes">${this.escapeHtml(workflow.destemming?.notes || '')}</textarea>
                </div>
                <button type="submit" class="btn-primary">Save destemming</button>
            </form>
        `;
    }

    buildPressingForm(workflow) {
        const timestamp = this.formatInputDate(workflow.pressing?.timestamp, true);
        const mustVolume = workflow.pressing?.mustVolume ?? workflow.fermentation?.plannedVolume ?? '';
        return `
            <form class="workflow-action-form" data-action="pressing" data-workflow-id="${workflow.id}">
                <h4>Press cycle</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="press-time-${workflow.id}">Press completed</label>
                        <input type="datetime-local" id="press-time-${workflow.id}" name="timestamp" value="${timestamp}">
                    </div>
                    <div>
                        <label for="press-id-${workflow.id}">Press</label>
                        <input type="text" id="press-id-${workflow.id}" name="pressId" placeholder="Press ID or cycle" value="${this.escapeHtml(workflow.pressing?.pressId || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <label for="press-volume-${workflow.id}">Must volume (L)</label>
                    <input type="number" step="0.1" min="0" id="press-volume-${workflow.id}" name="mustVolume" value="${mustVolume ?? ''}">
                </div>
                <div class="form-row">
                    <label for="press-notes-${workflow.id}">Notes</label>
                    <textarea id="press-notes-${workflow.id}" name="notes">${this.escapeHtml(workflow.pressing?.notes || '')}</textarea>
                </div>
                <button type="submit" class="btn-primary">Record pressing</button>
            </form>
        `;
    }

    buildSettlingStartForm(workflow) {
        const start = this.formatInputDate(workflow.settling?.start, true);
        const expected = workflow.settling?.expectedHours ?? '';
        return `
            <form class="workflow-action-form" data-action="settling-start" data-workflow-id="${workflow.id}">
                <h4>Start settling</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="settling-start-${workflow.id}">Start</label>
                        <input type="datetime-local" id="settling-start-${workflow.id}" name="start" value="${start}">
                    </div>
                    <div>
                        <label for="settling-tank-${workflow.id}">Settling tank</label>
                        <select id="settling-tank-${workflow.id}" name="tankId">
                            ${this.buildTankOptions(workflow.settling?.tankId || 'R1')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <label for="settling-hours-${workflow.id}">Expected duration (h)</label>
                    <input type="number" min="0" step="0.5" id="settling-hours-${workflow.id}" name="expectedHours" value="${expected ?? ''}">
                </div>
                <div class="form-row">
                    <label for="settling-notes-${workflow.id}">Notes</label>
                    <textarea id="settling-notes-${workflow.id}" name="notes">${this.escapeHtml(workflow.settling?.notes || '')}</textarea>
                </div>
                <button type="submit" class="btn-primary">Begin settling</button>
            </form>
        `;
    }

    buildSettlingCompleteForm(workflow) {
        const end = this.formatInputDate(workflow.settling?.end, true);
        return `
            <form class="workflow-action-form" data-action="settling-complete" data-workflow-id="${workflow.id}">
                <h4>Complete settling</h4>
                <div class="form-row">
                    <label for="settling-end-${workflow.id}">Completed at</label>
                    <input type="datetime-local" id="settling-end-${workflow.id}" name="end" value="${end}">
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="settling-clarity-${workflow.id}">Clarity</label>
                        <input type="text" id="settling-clarity-${workflow.id}" name="clarity" placeholder="e.g. NTU" value="${this.escapeHtml(workflow.settling?.clarity || '')}">
                    </div>
                    <div>
                        <label for="settling-complete-notes-${workflow.id}">Notes</label>
                        <input type="text" id="settling-complete-notes-${workflow.id}" name="notes" value="${this.escapeHtml(workflow.settling?.notes || '')}">
                    </div>
                </div>
                <button type="submit" class="btn-primary">Log completion</button>
            </form>
        `;
    }

    buildFermentationStartForm(workflow) {
        const inoculation = this.formatInputDate(workflow.fermentation?.inoculatedAt, true);
        const scale = workflow.fermentation?.densityScale || 'Brix';
        const planned = workflow.fermentation?.volume ?? workflow.fermentation?.plannedVolume ?? '';
        return `
            <form class="workflow-action-form" data-action="fermentation-start" data-workflow-id="${workflow.id}">
                <h4>Start fermentation</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="ferm-date-${workflow.id}">Inoculated at</label>
                        <input type="datetime-local" id="ferm-date-${workflow.id}" name="inoculatedAt" value="${inoculation}">
                    </div>
                    <div>
                        <label for="ferm-tank-${workflow.id}">Fermentation tank</label>
                        <select id="ferm-tank-${workflow.id}" name="tankId">
                            ${this.buildTankOptions(workflow.fermentation?.tankId)}
                        </select>
                    </div>
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="ferm-yeast-${workflow.id}">Yeast</label>
                        <input type="text" id="ferm-yeast-${workflow.id}" name="yeast" placeholder="Inoculated yeast" value="${this.escapeHtml(workflow.fermentation?.yeast || '')}">
                    </div>
                    <div>
                        <label for="ferm-volume-${workflow.id}">Volume (L)</label>
                        <input type="number" min="0" step="0.1" id="ferm-volume-${workflow.id}" name="volume" value="${planned ?? ''}">
                    </div>
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="ferm-density-${workflow.id}">Density</label>
                        <input type="number" step="0.01" id="ferm-density-${workflow.id}" name="density" value="${workflow.fermentation?.startingDensity ?? ''}">
                    </div>
                    <div>
                        <label for="ferm-scale-${workflow.id}">Scale</label>
                        <select id="ferm-scale-${workflow.id}" name="scale">
                            ${['Brix', 'Baumé', 'g/L', 'Babo'].map(option => `<option value="${option}" ${option === scale ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="ferm-temp-${workflow.id}">Temperature (°C)</label>
                        <input type="number" step="0.1" id="ferm-temp-${workflow.id}" name="temperature" value="${workflow.fermentation?.startingTemperature ?? ''}">
                    </div>
                    <div>
                        <label for="ferm-ph-${workflow.id}">pH</label>
                        <input type="number" step="0.01" id="ferm-ph-${workflow.id}" name="ph" value="${workflow.fermentation?.startingPh ?? ''}">
                    </div>
                </div>
                <div class="form-row">
                    <label for="ferm-notes-${workflow.id}">Notes</label>
                    <textarea id="ferm-notes-${workflow.id}" name="notes">${this.escapeHtml(workflow.fermentation?.notes || '')}</textarea>
                </div>
                <button type="submit" class="btn-primary">Start fermentation</button>
            </form>
        `;
    }

    buildFermentationReadingForm(workflow) {
        const timestamp = this.formatInputDate(null, true);
        return `
            <form class="workflow-action-form" data-action="reading" data-workflow-id="${workflow.id}">
                <h4>Fermentation reading</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="reading-time-${workflow.id}">Recorded at</label>
                        <input type="datetime-local" id="reading-time-${workflow.id}" name="timestamp" value="${timestamp}">
                    </div>
                    <div>
                        <label for="reading-density-${workflow.id}">Density</label>
                        <input type="number" step="0.01" id="reading-density-${workflow.id}" name="density">
                    </div>
                    <div>
                        <label for="reading-scale-${workflow.id}">Scale</label>
                        <select id="reading-scale-${workflow.id}" name="scale">
                            ${['Brix', 'Baumé', 'g/L', 'Babo'].map(option => `<option value="${option}" ${option === (workflow.fermentation?.densityScale || 'Brix') ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="reading-temp-${workflow.id}">Temperature (°C)</label>
                        <input type="number" step="0.1" id="reading-temp-${workflow.id}" name="temperature">
                    </div>
                    <div>
                        <label for="reading-ph-${workflow.id}">pH</label>
                        <input type="number" step="0.01" id="reading-ph-${workflow.id}" name="ph">
                    </div>
                </div>
                <div class="form-row">
                    <label for="reading-notes-${workflow.id}">Notes</label>
                    <textarea id="reading-notes-${workflow.id}" name="notes" placeholder="Cap management, aromas, etc."></textarea>
                </div>
                <button type="submit" class="btn-primary">Log reading</button>
            </form>
        `;
    }

    buildAdditionForm(workflow) {
        return `
            <form class="workflow-action-form" data-action="addition" data-workflow-id="${workflow.id}">
                <h4>Add enological product</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="addition-product-${workflow.id}">Product</label>
                        <select id="addition-product-${workflow.id}" name="product">
                            ${['SO₂ / KMS', 'Tannins', 'Enzymes', 'Tartaric acid', 'Nutrients', 'Bentonite', 'Other'].map(option => `<option value="${option}">${option}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="addition-amount-${workflow.id}">Amount</label>
                        <input type="number" step="0.01" id="addition-amount-${workflow.id}" name="amount" placeholder="Quantity">
                    </div>
                    <div>
                        <label for="addition-unit-${workflow.id}">Unit</label>
                        <input type="text" id="addition-unit-${workflow.id}" name="unit" placeholder="e.g. g/hL">
                    </div>
                </div>
                <div class="workflow-inline-group">
                    <div>
                        <label for="addition-stage-${workflow.id}">Stage</label>
                        <select id="addition-stage-${workflow.id}" name="stage">
                            ${['destemming', 'must', 'settling', 'fermentation', 'burb'].map(stage => `<option value="${stage}">${stage.charAt(0).toUpperCase()}${stage.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="addition-notes-${workflow.id}">Notes</label>
                        <input type="text" id="addition-notes-${workflow.id}" name="notes" placeholder="Vendor, batch, reason">
                    </div>
                </div>
                <button type="submit" class="btn-primary">Log addition</button>
            </form>
        `;
    }

    buildBurbForm(workflow) {
        return `
            <form class="workflow-action-form" data-action="burb" data-workflow-id="${workflow.id}">
                <h4>Lees (burb) management</h4>
                <div class="workflow-inline-group">
                    <div>
                        <label for="burb-start-${workflow.id}">Fermentation start</label>
                        <input type="datetime-local" id="burb-start-${workflow.id}" name="startedAt" value="${this.formatInputDate(workflow.burb?.startedAt, !!workflow.burb?.startedAt)}">
                    </div>
                    <div>
                        <label for="burb-bentonite-${workflow.id}">Bentonite added</label>
                        <input type="datetime-local" id="burb-bentonite-${workflow.id}" name="bentoniteAddedAt" value="${this.formatInputDate(workflow.burb?.bentoniteAddedAt, false)}">
                    </div>
                </div>
                <div class="form-row">
                    <label for="burb-notes-${workflow.id}">Notes</label>
                    <textarea id="burb-notes-${workflow.id}" name="notes">${this.escapeHtml(workflow.burb?.notes || '')}</textarea>
                </div>
                <button type="submit" class="btn-primary">Update lees plan</button>
            </form>
        `;
    }

    buildAdditionsSection(workflow) {
        const additions = Array.isArray(workflow.additions) ? [...workflow.additions] : [];
        if (!additions.length) {
            return '';
        }
        additions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const items = additions.slice(0, 6).map(addition => {
            const amountValue = addition.amount !== null && addition.amount !== undefined
                ? this.formatNumber(addition.amount)
                : null;
            const amount = amountValue !== null && amountValue !== undefined
                ? `${amountValue} ${this.escapeHtml(addition.unit || '')}`.trim()
                : this.escapeHtml(addition.unit || '');
            return `
                <li>
                    <strong>${this.escapeHtml(addition.product || 'Addition')}</strong>
                    <span class="small-note">${this.formatDate(addition.timestamp)} • ${this.escapeHtml(addition.stage)}</span>
                    ${amount ? `<div class="small-note">${amount}</div>` : ''}
                    ${addition.notes ? `<div class="small-note">${this.escapeHtml(addition.notes)}</div>` : ''}
                </li>
            `;
        }).join('');
        return `<div class="workflow-subsection"><h4>Enological additions</h4><ul class="workflow-additions">${items}</ul></div>`;
    }

    buildReadingsSection(workflow) {
        const readings = Array.isArray(workflow.fermentation?.readings) ? [...workflow.fermentation.readings] : [];
        if (!readings.length) {
            return '';
        }
        readings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const rows = readings.slice(0, 6).map(reading => `
            <tr>
                <td>${this.formatDate(reading.timestamp)}</td>
                <td>${reading.density !== null && reading.density !== undefined ? `${this.formatNumber(reading.density)} ${this.escapeHtml(reading.scale || '')}` : '—'}</td>
                <td>${reading.temperature !== null && reading.temperature !== undefined ? `${this.formatNumber(reading.temperature)} °C` : '—'}</td>
                <td>${reading.ph !== null && reading.ph !== undefined ? this.formatNumber(reading.ph) : '—'}</td>
                <td>${this.escapeHtml(reading.notes || '')}</td>
            </tr>
        `).join('');
        return `
            <div class="workflow-subsection">
                <h4>Fermentation readings</h4>
                <table class="workflow-table">
                    <thead>
                        <tr><th>Date</th><th>Density</th><th>Temp</th><th>pH</th><th>Notes</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    buildHistorySection(workflow) {
        const history = Array.isArray(workflow.history) ? [...workflow.history] : [];
        if (!history.length) {
            return '';
        }
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const items = history.slice(0, 5).map(entry => `
            <li>
                <strong>${this.escapeHtml(entry.summary || entry.type || 'Update')}</strong>
                <div class="small-note">${this.formatDate(entry.timestamp)}</div>
                ${entry.detail ? `<div class="small-note">${this.escapeHtml(entry.detail)}</div>` : ''}
            </li>
        `).join('');
        return `<div class="workflow-subsection"><h4>Latest activity</h4><ul class="workflow-history">${items}</ul></div>`;
    }

    buildTankOptions(selectedId) {
        if (!Array.isArray(this.tanks) || !this.tanks.length) {
            return '<option value="">No tanks configured</option>';
        }
        const options = ['<option value="">Select tank</option>'];
        this.tanks.forEach(tank => {
            const description = tank.description ? ` – ${this.escapeHtml(tank.description)}` : '';
            const selected = tank.id === selectedId ? 'selected' : '';
            options.push(`<option value="${this.escapeHtml(tank.id)}" ${selected}>${this.escapeHtml(tank.id)}${description}</option>`);
        });
        return options.join('');
    }

    formatInputDate(value, fallbackNow = false) {
        if (value) {
            try {
                return typeof formatForDateTimeInput === 'function'
                    ? formatForDateTimeInput(value)
                    : new Date(value).toISOString().slice(0, 16);
            } catch (error) {
                // ignore formatting issues and fall through
            }
        }
        if (fallbackNow) {
            const now = new Date();
            return typeof formatForDateTimeInput === 'function'
                ? formatForDateTimeInput(now)
                : now.toISOString().slice(0, 16);
        }
        return '';
    }

    escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char] || char);
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

    switchView(view) {
        const target = view || 'dashboard';
        this.currentView = target;

        const navItems = document.querySelectorAll('.nav-menu .nav-item[data-view]');
        navItems.forEach(item => {
            const isActive = item.dataset.view === target;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.setAttribute('aria-current', 'page');
            } else {
                item.removeAttribute('aria-current');
            }
        });

        let matched = false;
        const panels = document.querySelectorAll('.view-panel[data-view]');
        panels.forEach(panel => {
            const isMatch = panel.dataset.view === target;
            panel.classList.toggle('active', isMatch);
            panel.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
            if (isMatch) {
                matched = true;
            }
        });

        if (!matched) {
            return;
        }

        switch (target) {
            case 'dashboard':
                this.renderKPIs();
                this.renderCellarMap();
                this.renderTemperatureChart();
                this.renderFermentationProgress();
                this.renderActivityFeed();
                this.renderTimeline();
                break;
            case 'tanks':
                this.renderTankOverview();
                break;
            case 'batches':
                this.renderBatchOverview();
                break;
            case 'laboratory':
                this.renderLabOverview();
                break;
            case 'production':
                this.renderProductionSchedule();
                this.renderHarvestWorkflowBoard();
                break;
            case 'analytics':
                this.renderAnalyticsSummary();
                break;
            case 'settings':
                this.renderSettingsPanel();
                break;
            default:
                break;
        }

        this.toggleNotifications(false);
    }

    renderCellarMap() {
        const container = document.getElementById('cellarVisualization');
        if (!container) return;
        const toggleButton = document.querySelector('[data-action="toggle-3d"]');
        if (toggleButton) {
            toggleButton.textContent = this.cellar3DEnabled ? '2D View' : '3D View';
            toggleButton.setAttribute('aria-pressed', String(this.cellar3DEnabled));
        }

        container.innerHTML = '';
        if (this.cellar3DEnabled) {
            this.renderCellar3D(container);
            return;
        }

        const map = this.productionPlanner ? this.productionPlanner.generateCellarMap() : { tanks: [] };
        const plannerTanks = Array.isArray(map.tanks) && map.tanks.length > 0 ? map.tanks : [];
        const tanks = plannerTanks.length ? plannerTanks : this.tanks.map(tank => ({
            id: tank.id,
            location: tank.location ?? 'Cellar',
            fillLevel: 0,
            temperature: null,
            capacity: tank.capacity
        }));

        if (!tanks.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state glass-card';
            empty.innerHTML = '<h3>No tanks available</h3><p>Add tanks to visualize your cellar layout.</p>';
            container.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'tank-grid';
        tanks.forEach(tank => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            const fillLevel = typeof tank.fillLevel === 'number' ? tank.fillLevel : 0;
            card.innerHTML = `
                <h3>${tank.id}</h3>
                <p>Location: ${tank.location ?? '—'}</p>
                <p>Fill Level: ${fillLevel.toFixed(1)}%</p>
                <p>Temperature: ${tank.temperature != null ? `${tank.temperature}°C` : 'N/A'}</p>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    renderCellar3D(container) {
        const stage = document.createElement('div');
        stage.className = 'cellar-3d';
        const tanks = this.tanks.length ? this.tanks : (this.productionPlanner?.resources?.tanks ?? []);

        if (!tanks.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state glass-card';
            empty.innerHTML = '<h3>No tanks to display</h3><p>Add tanks to experience the 3D cellar view.</p>';
            container.appendChild(empty);
            return;
        }

        const batchesByTank = new Map();
        if (this.batchManager) {
            this.batchManager.getAllBatches().forEach(batch => {
                if (batch.currentTank) {
                    batchesByTank.set(batch.currentTank, batch);
                }
            });
        }

        tanks.slice(0, 12).forEach(tank => {
            const card = document.createElement('div');
            card.className = 'cellar-3d__tank glass-card';
            const assigned = batchesByTank.get(tank.id);
            const capacity = Number(tank.capacity ?? 0);
            const currentVolume = Number.isFinite(assigned?.currentVolume)
                ? Number(assigned.currentVolume)
                : Number.isFinite(assigned?.initialVolume)
                    ? Number(assigned.initialVolume)
                    : null;
            const fillPercent = capacity > 0 && currentVolume != null
                ? Math.max(0, Math.min(100, Math.round((currentVolume / capacity) * 100)))
                : 0;

            card.innerHTML = `
                <div>
                    <h3>${tank.id}</h3>
                    <p class="cellar-3d__meta">${assigned ? `${assigned.variety ?? 'Blend'} • ${assigned.status ?? 'active'}` : (tank.location ?? 'Available')}</p>
                </div>
                <div class="cellar-3d__level">
                    <div class="cellar-3d__level-fill" style="height:${fillPercent}%"></div>
                </div>
                <p class="cellar-3d__meta">${capacity ? `${capacity.toLocaleString()} L capacity` : ''}</p>
            `;
            stage.appendChild(card);
        });

        container.appendChild(stage);
    }

    renderTankOverview() {
        const container = document.getElementById('tankOverviewList');
        const emptyState = document.getElementById('tanksEmptyState');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        if (!Array.isArray(this.tanks) || this.tanks.length === 0) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);

        const batchesByTank = new Map();
        if (this.batchManager) {
            this.batchManager.getAllBatches().forEach(batch => {
                if (batch.currentTank) {
                    batchesByTank.set(batch.currentTank, batch);
                }
            });
        }

        this.tanks.forEach(tank => {
            const card = document.createElement('article');
            card.className = 'glass-card tank-overview-card';
            const assigned = batchesByTank.get(tank.id);
            const capacity = Number(tank.capacity ?? 0);
            const currentVolume = Number.isFinite(assigned?.currentVolume)
                ? Number(assigned.currentVolume)
                : Number.isFinite(assigned?.initialVolume)
                    ? Number(assigned.initialVolume)
                    : null;
            const latest = this.dataManager ? this.dataManager.getLatestReading(tank.id) : null;
            const fillPercent = capacity > 0 && currentVolume != null
                ? Math.max(0, Math.min(100, Math.round((currentVolume / capacity) * 100)))
                : null;

            const capacityText = this.formatNumber(capacity);
            const volumeText = currentVolume != null ? this.formatNumber(currentVolume) : null;
            const temperatureText = typeof latest?.temperature === 'number'
                ? `${latest.temperature}°C`
                : latest?.temperature != null
                    ? `${latest.temperature}`
                    : '—';
            const sugarValue = latest?.sugar;
            const sugarText = sugarValue != null ? `${sugarValue}` : '—';

            const metrics = [
                { label: 'Capacity', value: capacityText ? `${capacityText} L` : '—' },
                { label: 'Volume', value: volumeText ? `${volumeText} L` : '—' },
                { label: 'Temperature', value: temperatureText },
                { label: 'Sugar', value: sugarText }
            ];

            card.innerHTML = `
                <header>
                    <h3>${tank.id}</h3>
                    <span class="status-pill ${assigned ? 'status-active' : 'status-idle'}">${assigned ? 'Active' : 'Available'}</span>
                </header>
                <p class="tank-details">${tank.description || 'No description provided.'}</p>
                <p class="tank-current-batch">Current batch: ${assigned ? `${assigned.variety ?? 'Blend'} ${assigned.vintage ?? ''}`.trim() || assigned.id : 'None assigned'}</p>
                <dl class="metric-list">
                    ${metrics.map(metric => `<div><dt>${metric.label}</dt><dd>${metric.value}</dd></div>`).join('')}
                </dl>
                <p class="tank-last-reading">Last reading: ${latest?.timestamp ? this.formatDate(latest.timestamp) : 'No readings yet'}</p>
                ${fillPercent != null ? `<div class="progress"><div class="progress-bar" style="width:${fillPercent}%"></div></div><p class="progress-label">${fillPercent}% full</p>` : ''}
            `;

            container.appendChild(card);
        });
    }

    renderBatchOverview() {
        const container = document.getElementById('batchOverviewList');
        const emptyState = document.getElementById('batchesEmptyState');
        if (!container) {
            return;
        }
        container.innerHTML = '';
        const batches = this.batchManager ? this.batchManager.getAllBatches() : [];

        if (!batches.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);

        batches.forEach(batch => {
            const card = document.createElement('article');
            card.className = 'glass-card batch-overview-card';
            const status = (batch.status ?? 'active').toLowerCase();
            let statusClass = 'status-idle';
            if (status === 'active') {
                statusClass = 'status-active';
            } else if (status === 'completed' || status === 'bottled') {
                statusClass = 'status-success';
            } else if (status === 'at-risk' || status === 'hold') {
                statusClass = 'status-warning';
            }

            const labCount = batch.labResults?.length ?? 0;
            const historyCount = batch.history?.length ?? 0;
            const volumeNumber = Number.isFinite(batch.currentVolume) ? Number(batch.currentVolume) : null;
            const currentVolume = volumeNumber != null
                ? `${this.formatNumber(volumeNumber) ?? volumeNumber} L`
                : '—';

            card.innerHTML = `
                <header>
                    <h3>${batch.variety ?? 'Batch'} ${batch.vintage ?? ''}</h3>
                    <span class="status-pill ${statusClass}">${(batch.status ?? 'ACTIVE').toUpperCase()}</span>
                </header>
                <p>Batch ID: ${batch.id}</p>
                <dl class="metric-list">
                    <div><dt>Volume</dt><dd>${currentVolume}</dd></div>
                    <div><dt>Tank</dt><dd>${batch.currentTank ?? 'Unassigned'}</dd></div>
                    <div><dt>Lab Tests</dt><dd>${labCount}</dd></div>
                    <div><dt>History Events</dt><dd>${historyCount}</dd></div>
                </dl>
                <footer>Last updated: ${this.formatDate(batch.history?.[historyCount - 1]?.timestamp ?? batch.createdAt)}</footer>
            `;

            container.appendChild(card);
        });
    }

    renderLabOverview() {
        const container = document.getElementById('labResultsList');
        const emptyState = document.getElementById('labEmptyState');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        if (!this.batchManager) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        const results = this.batchManager.getAllBatches()
            .map(batch => {
                const labResults = Array.isArray(batch.labResults) ? [...batch.labResults] : [];
                if (!labResults.length) {
                    return null;
                }
                const sorted = labResults.sort((a, b) => new Date(b.timestamp ?? b.date ?? 0) - new Date(a.timestamp ?? a.date ?? 0));
                return { batch, result: sorted[0] };
            })
            .filter(Boolean);

        if (!results.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);

        results.slice(0, 6).forEach(entry => {
            const { batch, result } = entry;
            const quality = result.qualityScore?.score ?? result.qualityScore ?? batch.qualityScore ?? null;
            const metrics = [
                { label: 'Alcohol', value: result.alcohol != null ? `${result.alcohol}%` : '—' },
                { label: 'pH', value: result.pH ?? result.ph ?? '—' },
                { label: 'TA', value: result.totalAcidity ?? result.ta ?? '—' },
                { label: 'VA', value: result.volatileAcidity ?? result.va ?? '—' }
            ];

            const card = document.createElement('article');
            card.className = 'glass-card lab-overview-card';
            card.innerHTML = `
                <header>
                    <h3>${batch.variety ?? 'Batch'} ${batch.vintage ?? ''}</h3>
                    ${quality != null ? `<span class="status-pill status-active">Score ${quality}</span>` : ''}
                </header>
                <p>Sample ID: ${result.sampleId ?? result.id ?? 'N/A'}</p>
                <dl class="metric-list">
                    ${metrics.map(metric => `<div><dt>${metric.label}</dt><dd>${metric.value}</dd></div>`).join('')}
                </dl>
                <footer>Result date: ${this.formatDate(result.timestamp ?? result.date)}</footer>
            `;
            container.appendChild(card);
        });
    }

    renderProductionSchedule() {
        const container = document.getElementById('productionSchedule');
        const emptyState = document.getElementById('productionEmptyState');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        if (!this.productionPlanner) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        const plan = this.productionPlanner.createProductionPlan(new Date().getFullYear());
        if (!plan?.phases?.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);

        plan.phases.forEach(phase => {
            const card = document.createElement('article');
            card.className = 'glass-card production-card';
            card.innerHTML = `
                <header>
                    <h3>${phase.name}</h3>
                    <span class="status-pill status-planned">${(phase.status ?? 'planned').toUpperCase()}</span>
                </header>
                <p>${this.formatDate(phase.startDate)} – ${this.formatDate(phase.endDate)}</p>
                <ul>
                    ${(phase.resources ?? []).map(resource => {
                        if (resource.tankId) return `<li>Tank ${resource.tankId}</li>`;
                        if (resource.barrelId) return `<li>Barrel ${resource.barrelId}</li>`;
                        if (resource.crewId) return `<li>${resource.crewId}</li>`;
                        if (resource.role) return `<li>${resource.role}</li>`;
                        return '';
                    }).join('')}
                </ul>
            `;
            container.appendChild(card);
        });

        if (plan.optimization?.suggestions?.length) {
            const summary = document.createElement('article');
            summary.className = 'glass-card production-card';
            summary.innerHTML = `
                <header>
                    <h3>Optimization Insights</h3>
                    <span class="status-pill status-active">Utilization</span>
                </header>
                <ul class="suggestions-list">
                    ${plan.optimization.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                </ul>
                <footer>Crews: ${Math.round(plan.optimization.resourceUtilization.crews)}% • Tanks: ${Math.round(plan.optimization.resourceUtilization.tanks)}% • Barrels: ${Math.round(plan.optimization.resourceUtilization.barrels)}%</footer>
            `;
            container.appendChild(summary);
        }
    }

    renderAnalyticsSummary() {
        const container = document.getElementById('analyticsSummary');
        const emptyState = document.getElementById('analyticsEmptyState');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        if (!this.aiAnalytics || !this.dataManager || !this.tanks.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        const cards = [];
        this.tanks.slice(0, 6).forEach(tank => {
            const prediction = this.aiAnalytics.predictFermentationCompletion(tank.id, this.dataManager);
            if (!prediction) {
                return;
            }
            const risks = Array.isArray(prediction.riskFactors) && prediction.riskFactors.length
                ? prediction.riskFactors
                : ['No critical risks detected'];
            const recommendations = Array.isArray(prediction.recommendations) ? prediction.recommendations : [];

            const card = document.createElement('article');
            card.className = 'glass-card analytics-card';
            card.innerHTML = `
                <header>
                    <h3>${tank.id}</h3>
                    <span class="status-pill ${prediction.daysRemaining > 14 ? 'status-warning' : 'status-active'}">${prediction.daysRemaining} days remaining</span>
                </header>
                <p>Confidence: ${(prediction.confidence * 100).toFixed(0)}%</p>
                <ul>
                    ${risks.map(risk => `<li>${risk}</li>`).join('')}
                </ul>
                <footer>${recommendations.length ? (recommendations[0].action ?? recommendations[0]) : 'Monitoring stable fermentation.'}</footer>
            `;
            cards.push(card);
        });

        if (!cards.length) {
            this.toggleEmptyState(emptyState, true);
            return;
        }

        this.toggleEmptyState(emptyState, false);
        cards.forEach(card => container.appendChild(card));
    }

    renderSettingsPanel() {
        const container = document.getElementById('settingsPanel');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        const features = [
            {
                name: 'Offline Sync',
                description: 'Capture readings without connectivity and sync automatically.',
                active: !!this.pwaManager,
                detail: this.pwaManager?.backgroundSyncSupported
                    ? 'Background sync ready'
                    : 'Using local queue until connection is restored',
                statusClass: this.pwaManager ? 'status-active' : 'status-idle'
            },
            {
                name: 'Barcode Scanner',
                description: 'Use your device camera to scan tank QR codes.',
                active: !!this.pwaManager?.barcodeDetector,
                detail: this.pwaManager?.barcodeDetector
                    ? 'BarcodeDetector API available'
                    : 'Detector not supported in this browser',
                statusClass: this.pwaManager?.barcodeDetector ? 'status-active' : 'status-warning'
            },
            {
                name: 'ERP Integration',
                description: 'Sync inventory and production data with ERP systems.',
                active: !!this.apiIntegration,
                detail: this.apiIntegration ? 'Endpoints configured' : 'Integration not connected',
                statusClass: this.apiIntegration ? 'status-active' : 'status-idle'
            },
            {
                name: 'AI Analytics',
                description: 'Predict fermentation completion and highlight risks.',
                active: !!this.aiAnalytics,
                detail: this.aiAnalytics ? 'Model loaded' : 'Analytics module unavailable',
                statusClass: this.aiAnalytics ? 'status-active' : 'status-warning'
            }
        ];

        features.forEach(feature => {
            const card = document.createElement('article');
            card.className = 'glass-card settings-card';
            card.innerHTML = `
                <header>
                    <h3>${feature.name}</h3>
                    <span class="status-pill ${feature.statusClass}">${feature.active ? 'Enabled' : 'Unavailable'}</span>
                </header>
                <p>${feature.description}</p>
                <footer>${feature.detail}</footer>
            `;
            container.appendChild(card);
        });
    }

    toggleEmptyState(element, show) {
        if (!element) {
            return;
        }
        element.hidden = !show;
        element.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    formatNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value.toLocaleString();
        }
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
            return Number(value).toLocaleString();
        }
        return null;
    }

    formatDate(value) {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    buildNotificationData() {
        const notifications = [];
        const now = new Date();

        if (!this.tanks.length) {
            notifications.push({
                type: 'action',
                message: 'Add tanks to begin monitoring your cellar.',
                detail: 'Import a layout or create tanks from the Tanks view.',
                time: 'Just now'
            });
        } else if (this.dataManager) {
            const stale = this.tanks.filter(tank => {
                const latest = this.dataManager.getLatestReading(tank.id);
                if (!latest || !latest.timestamp) {
                    return true;
                }
                const age = now - new Date(latest.timestamp);
                return Number.isFinite(age) && age > 1000 * 60 * 60 * 24 * 2;
            });
            if (stale.length) {
                notifications.push({
                    type: 'warning',
                    message: `${stale.length} tank${stale.length === 1 ? '' : 's'} need new readings.`,
                    detail: 'Capture temperature and sugar updates to keep analytics accurate.',
                    time: 'Today'
                });
            }
        }

        const batches = this.batchManager ? this.batchManager.getAllBatches() : [];
        if (batches.length) {
            const active = batches.filter(batch => (batch.status ?? 'active').toLowerCase() === 'active');
            if (active.length) {
                notifications.push({
                    type: 'info',
                    message: `${active.length} active fermentation${active.length === 1 ? '' : 's'} in progress.`,
                    detail: 'Review AI forecasts in the Analytics view.',
                    time: 'Today'
                });
            }
            const missingLab = batches.filter(batch => (batch.labResults?.length ?? 0) === 0);
            if (missingLab.length) {
                notifications.push({
                    type: 'action',
                    message: `${missingLab.length} batch${missingLab.length === 1 ? '' : 'es'} awaiting lab results.`,
                    detail: 'Log lab analyses to keep compliance reports ready.',
                    time: 'Just now'
                });
            }
        }

        if (this.workflowManager) {
            const pendingDestemming = this.workflowManager.getPendingDestemming();
            if (pendingDestemming.length) {
                notifications.push({
                    type: 'action',
                    message: `${pendingDestemming.length} transport${pendingDestemming.length === 1 ? '' : 's'} awaiting destemming decisions.`,
                    detail: 'Confirm press vs. direct fermentation to keep the intake line moving.',
                    time: 'Today'
                });
            }

            const overdueSettling = this.workflowManager.getActiveSettling().filter(workflow => {
                const start = workflow.settling?.start;
                if (!start) {
                    return false;
                }
                const elapsed = (Date.now() - new Date(start).getTime()) / (1000 * 60 * 60);
                return Number.isFinite(elapsed) && elapsed > 72;
            });
            if (overdueSettling.length) {
                notifications.push({
                    type: 'warning',
                    message: `${overdueSettling.length} settling tank${overdueSettling.length === 1 ? '' : 's'} beyond 72 hours.`,
                    detail: 'Rack or inoculate the clarified must to avoid oxidation risks.',
                    time: 'Today'
                });
            }

            const staleFermentations = this.workflowManager.getFermentationWithoutRecentReadings(30);
            if (staleFermentations.length) {
                notifications.push({
                    type: 'warning',
                    message: `Update readings for ${staleFermentations.length} harvest lot${staleFermentations.length === 1 ? '' : 's'}.`,
                    detail: 'Last fermentation measurement recorded more than 30 hours ago.',
                    time: 'Today'
                });
            }
        }

        if (!notifications.length) {
            notifications.push({
                type: 'success',
                message: 'All systems up to date.',
                detail: 'No pending actions. Great work!',
                time: 'Just now'
            });
        }

        return notifications.slice(0, 4);
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.btn-notifications .badge');
        if (!badge) {
            return;
        }
        const count = this.notifications.length;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
    }

    renderNotificationList() {
        const list = document.getElementById('notificationList');
        if (!list) {
            return;
        }
        list.innerHTML = '';
        this.notifications.forEach(notification => {
            const item = document.createElement('li');
            item.className = `notification-item ${notification.type ?? 'info'}`;
            item.innerHTML = `
                <p class="notification-message">${notification.message}</p>
                ${notification.detail ? `<p class="notification-detail">${notification.detail}</p>` : ''}
                <span class="notification-time">${notification.time ?? ''}</span>
            `;
            list.appendChild(item);
        });
    }

    updateNotifications() {
        this.notifications = this.buildNotificationData();
        this.updateNotificationBadge();
        if (this.notificationsOpen) {
            this.renderNotificationList();
        }
    }

    toggleNotifications(force) {
        const panel = document.getElementById('notificationPanel');
        const button = document.querySelector('.btn-notifications');
        if (!panel || !button) {
            return;
        }
        const nextState = typeof force === 'boolean' ? force : !this.notificationsOpen;
        this.notificationsOpen = nextState;
        panel.classList.toggle('show', nextState);
        panel.setAttribute('aria-hidden', nextState ? 'false' : 'true');
        button.setAttribute('aria-expanded', String(nextState));
        if (nextState) {
            this.renderNotificationList();
        }
    }

    toggleCellarViewMode() {
        this.cellar3DEnabled = !this.cellar3DEnabled;
        this.renderCellarMap();
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
        if (!container) {
            return;
        }
        container.innerHTML = '';

        const batchActivities = this.batchManager
            ? this.batchManager.getAllBatches().flatMap(batch =>
                (batch.history ?? []).map(event => ({
                    ...event,
                    batchId: batch.id,
                    source: batch.variety ? `${batch.variety} ${batch.vintage ?? ''}`.trim() : batch.id
                }))
            )
            : [];

        const workflowActivities = this.workflowManager
            ? this.workflowManager.getWorkflows().flatMap(workflow =>
                (workflow.history ?? []).map(event => ({
                    ...event,
                    workflowId: workflow.id,
                    source: workflow.grapes?.variety || 'Harvest workflow'
                }))
            )
            : [];

        const activities = [...batchActivities, ...workflowActivities]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 12);

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            if (activity.workflowId) {
                const detail = activity.detail ? `<div class="small-note">${this.escapeHtml(activity.detail)}</div>` : '';
                item.innerHTML = `
                    <strong>${this.escapeHtml(activity.summary || activity.type || 'Workflow')}</strong>
                    <div class="small-note">${this.escapeHtml(activity.source || '')} • ${this.formatDate(activity.timestamp)}</div>
                    <div class="small-note">Workflow ${this.escapeHtml(activity.workflowId)}</div>
                    ${detail}
                `;
            } else {
                item.innerHTML = `
                    <strong>${this.escapeHtml(activity.batchId || activity.batch || 'Batch')}</strong>
                    <div class="small-note">${this.escapeHtml(activity.type || 'Update')} • ${this.formatDate(activity.timestamp)}</div>
                `;
            }
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
        this.scanResultElement = document.getElementById('scanResult');
        this.lastScanData = null;
        this.updateScanResult('Align barcode within the frame to scan.', 'info');

        if (!navigator.mediaDevices?.getUserMedia) {
            this.updateScanResult('Camera access is not supported on this device.', 'error');
            return;
        }

        try {
            this.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = document.getElementById('scannerVideo');
            if (video) {
                video.srcObject = this.scannerStream;
                await video.play().catch(() => undefined);
                if (this.pwaManager?.barcodeDetector) {
                    this.startBarcodeDetection(video);
                } else {
                    this.updateScanResult('Barcode detection is not available in this browser.', 'error');
                }
            }
        } catch (error) {
            console.error('Camera access denied', error);
            this.updateScanResult('Unable to access camera for scanning.', 'error');
        }
    }

    closeScanner() {
        const modal = document.getElementById('scannerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.stopBarcodeDetection();
        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(track => track.stop());
            this.scannerStream = null;
        }
        if (this.scanResultElement) {
            this.scanResultElement.innerHTML = '';
        }
        this.scanResultElement = null;
    }

    updateScanResult(message, variant = 'info') {
        if (!this.scanResultElement) {
            return;
        }
        if (!message) {
            this.scanResultElement.innerHTML = '';
            return;
        }
        this.scanResultElement.innerHTML = `<div class="scan-message ${variant}">${message}</div>`;
    }

    startBarcodeDetection(videoElement) {
        if (!this.pwaManager?.barcodeDetector) {
            this.updateScanResult('Barcode detection is not supported.', 'error');
            return;
        }

        this.scannerActive = true;

        const scanFrame = async () => {
            if (!this.scannerActive) {
                return;
            }
            const requiredReadyState = typeof HTMLMediaElement !== 'undefined'
                ? HTMLMediaElement.HAVE_CURRENT_DATA
                : 2;
            if (videoElement.readyState < requiredReadyState) {
                this.scanFrameRequest = requestAnimationFrame(scanFrame);
                return;
            }

            const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
                ? performance.now()
                : Date.now();
            if (now - this.lastScanAttempt < 300) {
                this.scanFrameRequest = requestAnimationFrame(scanFrame);
                return;
            }
            this.lastScanAttempt = now;

            try {
                const detections = await this.pwaManager.scanBarcode(videoElement);
                if (detections && detections.length > 0) {
                    const primary = detections[0];
                    if (primary.data && primary.data !== this.lastScanData) {
                        this.lastScanData = primary.data;
                        this.displayScanResults(primary);
                    }
                }
            } catch (error) {
                console.error('Barcode detection error', error);
                this.updateScanResult('Unable to process barcode. Ensure the code is well lit.', 'error');
            }

            if (this.scannerActive) {
                this.scanFrameRequest = requestAnimationFrame(scanFrame);
            }
        };

        this.scanFrameRequest = requestAnimationFrame(scanFrame);
    }

    stopBarcodeDetection() {
        this.scannerActive = false;
        if (this.scanFrameRequest) {
            cancelAnimationFrame(this.scanFrameRequest);
            this.scanFrameRequest = null;
        }
        this.lastScanData = null;
        this.lastScanAttempt = 0;
    }

    displayScanResults(detection) {
        if (!this.scanResultElement) {
            return;
        }

        let batchDetails = '';
        if (this.batchManager) {
            const batches = this.batchManager.getAllBatches();
            const matched = batches.find(batch => batch.id === detection.data || batch.qrCode === detection.data);
            if (matched) {
                const volumeLiters = matched.currentVolume ?? matched.initialVolume ?? 0;
                batchDetails = `
                    <p>Batch: <strong>${matched.variety ?? 'Unknown'} ${matched.vintage ?? ''}</strong></p>
                    <p>Tank: ${matched.currentTank ?? 'N/A'} &bull; Volume: ${volumeLiters.toLocaleString()} L</p>
                `;
            } else {
                batchDetails = '<p>No matching batch found in local records.</p>';
            }
        }

        this.scanResultElement.innerHTML = `
            <div class="scan-message success">
                <p><strong>${detection.type.toUpperCase()}</strong> detected</p>
                <p>${detection.data}</p>
                ${batchDetails}
            </div>
        `;
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
    enhancedApp.toggleCellarViewMode();
}

function toggleNotifications(event) {
    if (event) {
        event.stopPropagation();
    }
    enhancedApp.toggleNotifications();
}
