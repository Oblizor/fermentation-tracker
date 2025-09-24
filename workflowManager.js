class HarvestWorkflowManager {
    constructor(dataManager, batchManager) {
        this.dataManager = dataManager ?? null;
        this.batchManager = batchManager ?? null;
        this.storageKey = 'vinetrack-harvest-workflows';
        this.storageAvailable = this.checkStorageAvailability();
        this.memoryStore = [];
        this.workflows = this.loadWorkflows();
    }

    checkStorageAvailability() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return false;
        }
        try {
            const testKey = '__vinetrack_workflow_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('Workflow storage unavailable, using in-memory persistence only.', error);
            return false;
        }
    }

    cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    normalizeWorkflow(raw) {
        const base = {
            id: raw?.id ?? `INTAKE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            arrival: {
                time: raw?.arrival?.time ?? new Date().toISOString(),
                vehicleType: raw?.arrival?.vehicleType ?? 'tractor-trailer',
                driver: raw?.arrival?.driver ?? null,
                crateCount: Number.isFinite(raw?.arrival?.crateCount) ? Number(raw.arrival.crateCount) : 0,
                crateWeight: Number.isFinite(raw?.arrival?.crateWeight) ? Number(raw.arrival.crateWeight) : 0,
                totalWeight: Number.isFinite(raw?.arrival?.totalWeight) ? Number(raw.arrival.totalWeight) : null,
                notes: raw?.arrival?.notes ?? ''
            },
            grapes: {
                variety: raw?.grapes?.variety ?? '',
                vineyard: raw?.grapes?.vineyard ?? '',
                block: raw?.grapes?.block ?? ''
            },
            route: raw?.route ?? 'press',
            status: raw?.status ?? 'intake',
            destemming: {
                completed: Boolean(raw?.destemming?.completed ?? false),
                timestamp: raw?.destemming?.timestamp ?? null,
                notes: raw?.destemming?.notes ?? ''
            },
            pressing: {
                completed: Boolean(raw?.pressing?.completed ?? false),
                timestamp: raw?.pressing?.timestamp ?? null,
                pressId: raw?.pressing?.pressId ?? '',
                mustVolume: Number.isFinite(raw?.pressing?.mustVolume) ? Number(raw.pressing.mustVolume) : null,
                notes: raw?.pressing?.notes ?? ''
            },
            settling: {
                active: Boolean(raw?.settling?.active ?? false),
                tankId: raw?.settling?.tankId ?? '',
                start: raw?.settling?.start ?? null,
                end: raw?.settling?.end ?? null,
                expectedHours: Number.isFinite(raw?.settling?.expectedHours) ? Number(raw.settling.expectedHours) : null,
                durationHours: Number.isFinite(raw?.settling?.durationHours) ? Number(raw.settling.durationHours) : null,
                notes: raw?.settling?.notes ?? '',
                clarity: raw?.settling?.clarity ?? ''
            },
            fermentation: {
                started: Boolean(raw?.fermentation?.started ?? false),
                tankId: raw?.fermentation?.tankId ?? '',
                yeast: raw?.fermentation?.yeast ?? '',
                inoculatedAt: raw?.fermentation?.inoculatedAt ?? null,
                volume: Number.isFinite(raw?.fermentation?.volume) ? Number(raw.fermentation.volume) : null,
                plannedVolume: Number.isFinite(raw?.fermentation?.plannedVolume) ? Number(raw.fermentation.plannedVolume) : null,
                startingDensity: raw?.fermentation?.startingDensity ?? null,
                densityScale: raw?.fermentation?.densityScale ?? 'Brix',
                startingTemperature: Number.isFinite(raw?.fermentation?.startingTemperature)
                    ? Number(raw.fermentation.startingTemperature)
                    : null,
                startingPh: Number.isFinite(raw?.fermentation?.startingPh) ? Number(raw.fermentation.startingPh) : null,
                notes: raw?.fermentation?.notes ?? '',
                readings: Array.isArray(raw?.fermentation?.readings)
                    ? raw.fermentation.readings.map(reading => ({
                        timestamp: reading?.timestamp ?? new Date().toISOString(),
                        temperature: Number.isFinite(reading?.temperature) ? Number(reading.temperature) : null,
                        density: Number.isFinite(reading?.density) ? Number(reading.density) : null,
                        scale: reading?.scale ?? 'Brix',
                        ph: Number.isFinite(reading?.ph) ? Number(reading.ph) : null,
                        notes: reading?.notes ?? ''
                    }))
                    : []
            },
            burb: {
                fermenting: Boolean(raw?.burb?.fermenting ?? false),
                startedAt: raw?.burb?.startedAt ?? null,
                bentoniteAddedAt: raw?.burb?.bentoniteAddedAt ?? null,
                notes: raw?.burb?.notes ?? ''
            },
            additions: Array.isArray(raw?.additions)
                ? raw.additions.map(addition => ({
                    id: addition?.id ?? `ADD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    stage: addition?.stage ?? 'destemming',
                    product: addition?.product ?? '',
                    amount: Number.isFinite(addition?.amount) ? Number(addition.amount) : null,
                    unit: addition?.unit ?? '',
                    timestamp: addition?.timestamp ?? new Date().toISOString(),
                    notes: addition?.notes ?? ''
                }))
                : [],
            history: Array.isArray(raw?.history)
                ? raw.history.map(entry => ({
                    id: entry?.id ?? `WFH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: entry?.type ?? 'update',
                    summary: entry?.summary ?? '',
                    detail: entry?.detail ?? null,
                    timestamp: entry?.timestamp ?? new Date().toISOString()
                }))
                : []
        };

        if (!base.arrival.totalWeight && base.arrival.crateCount && base.arrival.crateWeight) {
            base.arrival.totalWeight = base.arrival.crateCount * base.arrival.crateWeight;
        }

        return base;
    }

    loadWorkflows() {
        let stored = [];
        if (this.storageAvailable) {
            try {
                const raw = window.localStorage.getItem(this.storageKey);
                stored = raw ? JSON.parse(raw) : [];
            } catch (error) {
                console.warn('Unable to load harvest workflows from storage.', error);
                this.storageAvailable = false;
            }
        }
        const normalized = Array.isArray(stored) ? stored.map(entry => this.normalizeWorkflow(entry)) : [];
        if (!this.storageAvailable) {
            this.memoryStore = this.cloneData(normalized);
        }
        return normalized;
    }

    persist() {
        if (this.storageAvailable) {
            try {
                window.localStorage.setItem(this.storageKey, JSON.stringify(this.workflows));
                return;
            } catch (error) {
                console.warn('Persisting harvest workflows to local storage failed. Falling back to memory.', error);
                this.storageAvailable = false;
            }
        }
        this.memoryStore = this.cloneData(this.workflows);
    }

    getWorkflows() {
        return this.cloneData(this.workflows);
    }

    getWorkflowById(workflowId) {
        return this.workflows.find(workflow => workflow.id === workflowId) ?? null;
    }

    toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    addHistoryEntry(workflow, type, summary, detail = null) {
        const entry = {
            id: `WFH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            summary,
            detail,
            timestamp: new Date().toISOString()
        };
        workflow.history.push(entry);
        return entry;
    }

    createTransport(data) {
        const workflow = this.normalizeWorkflow({
            arrival: {
                time: data?.arrivalTime ?? new Date().toISOString(),
                vehicleType: data?.vehicleType ?? 'tractor-trailer',
                driver: data?.driver ?? null,
                crateCount: this.toNumber(data?.crateCount) ?? 0,
                crateWeight: this.toNumber(data?.crateWeight) ?? null,
                totalWeight: this.toNumber(data?.totalWeight) ?? null,
                notes: data?.notes ?? ''
            },
            grapes: {
                variety: data?.variety ?? '',
                vineyard: data?.vineyard ?? '',
                block: data?.block ?? ''
            },
            route: data?.route ?? 'press',
            status: 'intake'
        });
        this.addHistoryEntry(workflow, 'intake', `Transport received (${workflow.arrival.vehicleType})`,
            `${workflow.arrival.crateCount} crates • ${workflow.arrival.totalWeight ?? 'N/A'} kg`);
        this.workflows.push(workflow);
        this.persist();
        return this.cloneData(workflow);
    }

    recordDestemming(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.destemming.completed = true;
            workflow.destemming.timestamp = details?.timestamp ?? new Date().toISOString();
            workflow.destemming.notes = details?.notes ?? '';
            workflow.route = details?.route ?? workflow.route ?? 'press';
            workflow.status = 'destemmed';
            if (details?.tankId) {
                workflow.fermentation.tankId = details.tankId;
            }
            const estimatedVolume = this.toNumber(details?.estimatedVolume);
            if (estimatedVolume !== null) {
                workflow.fermentation.plannedVolume = estimatedVolume;
            }
            this.addHistoryEntry(
                workflow,
                'destemming',
                workflow.route === 'press'
                    ? 'Destemmed for pressing'
                    : `Destemmed and routed to tank ${workflow.fermentation.tankId || ''}`,
                details?.notes ?? null
            );
        });
    }

    recordAddition(workflowId, addition) {
        return this.updateWorkflow(workflowId, workflow => {
            const entry = {
                id: `ADD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                stage: addition?.stage ?? 'destemming',
                product: addition?.product ?? '',
                amount: this.toNumber(addition?.amount),
                unit: addition?.unit ?? '',
                timestamp: addition?.timestamp ?? new Date().toISOString(),
                notes: addition?.notes ?? ''
            };
            workflow.additions.push(entry);
            this.addHistoryEntry(
                workflow,
                'addition',
                `${entry.product || 'Addition'} added during ${entry.stage}`,
                entry.amount !== null && entry.unit
                    ? `${entry.amount} ${entry.unit}`
                    : entry.unit || null
            );
            if (entry.stage === 'fermentation' && workflow.fermentation.started && this.batchManager && workflow.fermentation.tankId) {
                const batch = this.batchManager.getBatchByTank(workflow.fermentation.tankId);
                if (batch) {
                    this.batchManager.addHistoryEntry(batch.id, {
                        type: 'addition',
                        data: {
                            product: entry.product,
                            amount: entry.amount,
                            unit: entry.unit,
                            workflowId
                        },
                        timestamp: entry.timestamp
                    });
                }
            }
        });
    }

    recordPressing(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.pressing.completed = true;
            workflow.pressing.timestamp = details?.timestamp ?? new Date().toISOString();
            workflow.pressing.pressId = details?.pressId ?? '';
            workflow.pressing.mustVolume = this.toNumber(details?.mustVolume);
            workflow.pressing.notes = details?.notes ?? '';
            workflow.status = 'pressed';
            if (workflow.pressing.mustVolume !== null) {
                workflow.fermentation.plannedVolume = workflow.pressing.mustVolume;
            }
            this.addHistoryEntry(
                workflow,
                'pressing',
                'Press cycle completed',
                workflow.pressing.mustVolume !== null ? `${workflow.pressing.mustVolume} L collected` : workflow.pressing.notes
            );
        });
    }

    startSettling(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.settling.active = true;
            workflow.settling.tankId = details?.tankId ?? workflow.settling.tankId ?? '';
            workflow.settling.start = details?.start ?? new Date().toISOString();
            workflow.settling.expectedHours = this.toNumber(details?.expectedHours);
            workflow.settling.notes = details?.notes ?? '';
            workflow.status = 'settling';
            this.addHistoryEntry(
                workflow,
                'settling-start',
                `Must settling in tank ${workflow.settling.tankId || ''}`,
                workflow.settling.expectedHours
                    ? `Expected ${workflow.settling.expectedHours} h`
                    : workflow.settling.notes || null
            );
        });
    }

    completeSettling(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.settling.end = details?.end ?? new Date().toISOString();
            workflow.settling.clarity = details?.clarity ?? '';
            workflow.settling.notes = details?.notes ?? workflow.settling.notes;
            workflow.settling.active = false;
            if (workflow.settling.start) {
                const duration = (new Date(workflow.settling.end) - new Date(workflow.settling.start)) / (1000 * 60 * 60);
                if (Number.isFinite(duration)) {
                    workflow.settling.durationHours = Math.max(duration, 0);
                }
            }
            workflow.status = 'settled';
            this.addHistoryEntry(
                workflow,
                'settling-complete',
                'Must settling complete',
                workflow.settling.clarity ? `Clarity: ${workflow.settling.clarity}` : null
            );
        });
    }

    startFermentation(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.fermentation.started = true;
            workflow.fermentation.tankId = details?.tankId ?? workflow.fermentation.tankId ?? '';
            workflow.fermentation.yeast = details?.yeast ?? '';
            workflow.fermentation.inoculatedAt = details?.inoculatedAt ?? new Date().toISOString();
            workflow.fermentation.volume = this.toNumber(details?.volume);
            workflow.fermentation.plannedVolume = workflow.fermentation.volume ?? workflow.fermentation.plannedVolume;
            workflow.fermentation.startingDensity = details?.density ?? workflow.fermentation.startingDensity;
            workflow.fermentation.densityScale = details?.scale ?? workflow.fermentation.densityScale ?? 'Brix';
            workflow.fermentation.startingTemperature = this.toNumber(details?.temperature) ?? workflow.fermentation.startingTemperature;
            workflow.fermentation.startingPh = this.toNumber(details?.ph) ?? workflow.fermentation.startingPh;
            workflow.fermentation.notes = details?.notes ?? workflow.fermentation.notes;
            workflow.status = 'fermenting';

            if (details?.density || details?.temperature || details?.ph) {
                workflow.fermentation.readings.push({
                    timestamp: workflow.fermentation.inoculatedAt,
                    temperature: this.toNumber(details?.temperature),
                    density: this.toNumber(details?.density),
                    scale: details?.scale ?? 'Brix',
                    ph: this.toNumber(details?.ph),
                    notes: 'Initial inoculation reading'
                });
            }

            const historyDetail = [
                workflow.fermentation.yeast ? `Yeast: ${workflow.fermentation.yeast}` : null,
                details?.notes ? details.notes : null
            ].filter(Boolean).join(' • ') || null;
            this.addHistoryEntry(
                workflow,
                'fermentation-start',
                `Fermentation started in tank ${workflow.fermentation.tankId || ''}`,
                historyDetail
            );

            if (this.batchManager && workflow.fermentation.tankId) {
                const batch = this.batchManager.ensureBatchForTank(workflow.fermentation.tankId, {
                    variety: workflow.grapes.variety || 'Unknown',
                    vineyard: workflow.grapes.vineyard,
                    harvestDate: workflow.arrival.time,
                    volume: workflow.fermentation.volume ?? workflow.fermentation.plannedVolume ?? 0
                });
                if (batch) {
                    this.batchManager.addHistoryEntry(batch.id, {
                        type: 'fermentation-start',
                        data: {
                            workflowId,
                            yeast: workflow.fermentation.yeast,
                            volume: workflow.fermentation.volume ?? workflow.fermentation.plannedVolume ?? 0,
                            notes: details?.notes ?? null
                        },
                        timestamp: workflow.fermentation.inoculatedAt
                    });
                }
            }
        });
    }

    recordFermentationReading(workflowId, reading) {
        return this.updateWorkflow(workflowId, workflow => {
            const entry = {
                timestamp: reading?.timestamp ?? new Date().toISOString(),
                temperature: this.toNumber(reading?.temperature),
                density: this.toNumber(reading?.density),
                scale: reading?.scale ?? workflow.fermentation.densityScale ?? 'Brix',
                ph: this.toNumber(reading?.ph),
                notes: reading?.notes ?? ''
            };
            workflow.fermentation.readings.push(entry);
            this.addHistoryEntry(
                workflow,
                'fermentation-reading',
                'Fermentation reading captured',
                entry.density !== null
                    ? `${entry.density} ${entry.scale}`
                    : entry.temperature !== null
                        ? `${entry.temperature} °C`
                        : null
            );

            if (this.dataManager && workflow.fermentation.tankId) {
                this.dataManager.addReading(workflow.fermentation.tankId, {
                    timestamp: entry.timestamp,
                    temperature: entry.temperature,
                    sugar: entry.density,
                    ph: entry.ph,
                    notes: `Harvest workflow (${entry.scale}) ${entry.notes ?? ''}`.trim()
                });
            }

            if (this.batchManager && workflow.fermentation.tankId) {
                const batch = this.batchManager.getBatchByTank(workflow.fermentation.tankId);
                if (batch) {
                    this.batchManager.addHistoryEntry(batch.id, {
                        type: 'reading',
                        data: {
                            workflowId,
                            density: entry.density,
                            scale: entry.scale,
                            temperature: entry.temperature,
                            ph: entry.ph
                        },
                        timestamp: entry.timestamp
                    });
                }
            }
        });
    }

    recordBurbProcessing(workflowId, details) {
        return this.updateWorkflow(workflowId, workflow => {
            workflow.burb.fermenting = true;
            workflow.burb.startedAt = details?.startedAt ?? new Date().toISOString();
            workflow.burb.bentoniteAddedAt = details?.bentoniteAddedAt ?? workflow.burb.bentoniteAddedAt;
            workflow.burb.notes = details?.notes ?? workflow.burb.notes;
            this.addHistoryEntry(
                workflow,
                'burb',
                'Lees fermentation updated',
                workflow.burb.bentoniteAddedAt ? `Bentonite at ${workflow.burb.bentoniteAddedAt}` : workflow.burb.notes || null
            );
        });
    }

    updateWorkflow(workflowId, mutator) {
        const workflow = this.getWorkflowById(workflowId);
        if (!workflow || typeof mutator !== 'function') {
            return null;
        }
        mutator(workflow);
        this.persist();
        return this.cloneData(workflow);
    }

    getPendingDestemming() {
        return this.workflows.filter(workflow => !workflow.destemming.completed);
    }

    getActiveSettling() {
        return this.workflows.filter(workflow => workflow.settling.start && !workflow.settling.end);
    }

    getFermentationWithoutRecentReadings(hours = 36) {
        const thresholdMs = hours * 60 * 60 * 1000;
        const now = Date.now();
        return this.workflows.filter(workflow => {
            if (!workflow.fermentation.started) {
                return false;
            }
            const readings = workflow.fermentation.readings;
            if (!Array.isArray(readings) || readings.length === 0) {
                return true;
            }
            const last = readings[readings.length - 1];
            if (!last?.timestamp) {
                return true;
            }
            const age = now - new Date(last.timestamp).getTime();
            return !Number.isNaN(age) && age > thresholdMs;
        });
    }
}

if (typeof window !== 'undefined') {
    window.HarvestWorkflowManager = HarvestWorkflowManager;
}

