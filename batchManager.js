// batchManager.js - Complete batch lifecycle management
class BatchManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.batches = new Map();
        this.transfers = [];
        this.loadBatches();
        this.loadTransfers();
    }

    createBatch(data = {}) {
        const timestamp = Date.now();
        const id = `BATCH-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        const createdAt = new Date().toISOString();
        const vintage = data.vintage ?? new Date(createdAt).getFullYear();

        const batch = {
            id,
            createdAt,
            vintage,
            variety: data.variety ?? 'Unknown',
            vineyard: data.vineyard ?? null,
            block: data.block ?? null,
            harvestDate: data.harvestDate ?? null,
            initialVolume: Number.isFinite(data.volume) ? Number(data.volume) : 0,
            currentVolume: Number.isFinite(data.volume) ? Number(data.volume) : 0,
            currentTank: data.tankId ?? null,
            status: data.status ?? 'active',
            qrCode: this.generateQRCode({ id, vintage, variety: data.variety ?? 'Unknown' }),
            history: Array.isArray(data.history) ? [...data.history] : [],
            labResults: Array.isArray(data.labResults) ? [...data.labResults] : [],
            treatments: Array.isArray(data.treatments) ? [...data.treatments] : [],
            qualityScore: data.qualityScore ?? null,
            winemaker: data.winemaker ?? null,
            targetProfile: data.targetProfile ?? null,
            costTracking: {
                grapes: Number(data.costTracking?.grapes ?? 0),
                labor: Number(data.costTracking?.labor ?? 0),
                materials: Number(data.costTracking?.materials ?? 0),
                overhead: Number(data.costTracking?.overhead ?? 0)
            },
            genealogy: {
                parents: Array.isArray(data.parentBatches) ? [...data.parentBatches] : [],
                children: []
            },
            bottleCount: data.bottleCount ?? 0,
            bottlingDate: data.bottlingDate ?? null,
            wineType: data.wineType ?? 'red',
            sellingPrice: data.sellingPrice ?? null
        };

        this.batches.set(batch.id, batch);
        this.addHistoryEntry(batch.id, {
            type: 'creation',
            data: {
                variety: batch.variety,
                tankId: batch.currentTank,
                volume: batch.initialVolume
            }
        });
        this.saveBatches();
        return batch;
    }

    getBatch(batchId) {
        return this.batches.get(batchId) ?? null;
    }

    getAllBatches() {
        return Array.from(this.batches.values());
    }

    getBatchByTank(tankId) {
        return this.getAllBatches().find(batch => batch.currentTank === tankId) ?? null;
    }

    ensureBatchForTank(tankId, data = {}) {
        const existing = this.getBatchByTank(tankId);
        if (existing) {
            existing.currentTank = tankId;
            if (Number.isFinite(data.volume)) {
                existing.currentVolume = data.volume;
            }
            return existing;
        }
        const created = this.createBatch({
            variety: data.variety ?? 'Unknown',
            volume: data.volume ?? 0,
            tankId,
            vineyard: data.vineyard,
            harvestDate: data.harvestDate
        });
        return created;
    }

    updateBatch(batchId, updates) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            return null;
        }

        const merged = {
            ...batch,
            ...updates,
            costTracking: {
                ...batch.costTracking,
                ...updates?.costTracking
            },
            genealogy: {
                parents: updates?.genealogy?.parents ?? batch.genealogy.parents ?? [],
                children: updates?.genealogy?.children ?? batch.genealogy.children ?? []
            }
        };

        if (Array.isArray(updates?.labResults)) {
            merged.labResults = updates.labResults;
        }

        if (Array.isArray(updates?.treatments)) {
            merged.treatments = updates.treatments;
        }

        this.batches.set(batchId, merged);
        this.saveBatches();
        return merged;
    }

    setBatchStatus(batchId, status) {
        const batch = this.batches.get(batchId);
        if (!batch) return null;
        batch.status = status;
        this.addHistoryEntry(batchId, { type: 'status', data: { status } });
        this.saveBatches();
        return batch;
    }

    addHistoryEntry(batchId, entry) {
        const batch = this.batches.get(batchId);
        if (!batch) return;
        const historyEntry = {
            ...entry,
            timestamp: entry?.timestamp ?? new Date().toISOString()
        };
        batch.history.push(historyEntry);
        this.saveBatches();
    }

    recordTreatment(batchId, treatment) {
        const batch = this.batches.get(batchId);
        if (!batch) return null;
        const entry = {
            ...treatment,
            id: treatment?.id ?? `TRT-${Date.now()}`,
            timestamp: treatment?.timestamp ?? new Date().toISOString()
        };
        batch.treatments.push(entry);
        this.addHistoryEntry(batchId, {
            type: 'treatment',
            data: entry
        });
        this.saveBatches();
        return entry;
    }

    recordLabResult(batchId, labResult) {
        const batch = this.batches.get(batchId);
        if (!batch) return null;
        batch.labResults.push(labResult);
        batch.qualityScore = labResult.qualityScore?.score ?? labResult.qualityScore ?? batch.qualityScore;
        this.addHistoryEntry(batchId, {
            type: 'lab',
            data: labResult
        });
        this.saveBatches();
        return labResult;
    }

    recordTransfer(fromTankId, toTankId, batchId, volume, reason) {
        const transfer = {
            id: `TRANS-${Date.now()}`,
            timestamp: new Date().toISOString(),
            batchId,
            fromTank: fromTankId,
            toTank: toTankId,
            volume,
            reason,
            operator: typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null,
            losses: 0,
            notes: ''
        };

        const batch = this.batches.get(batchId);
        if (batch) {
            batch.currentTank = toTankId;
            if (typeof volume === 'number' && !Number.isNaN(volume)) {
                batch.currentVolume = Math.max(0, batch.currentVolume - (transfer.losses ?? 0));
            }
            batch.history.push({
                type: 'transfer',
                data: transfer,
                timestamp: transfer.timestamp
            });
        }

        this.transfers.push(transfer);
        this.saveTransfers();
        this.saveBatches();
        return transfer;
    }

    blendBatches(batchIds, proportions, newTankId) {
        if (!Array.isArray(batchIds) || !Array.isArray(proportions) || batchIds.length !== proportions.length) {
            throw new Error('Batch IDs and proportions must be arrays of equal length');
        }

        const parentBatches = batchIds.map(id => this.batches.get(id)).filter(Boolean);
        if (parentBatches.length === 0) {
            throw new Error('No valid parent batches provided');
        }

        const totalVolume = parentBatches.reduce((sum, batch, i) => {
            const proportion = proportions[i] ?? 0;
            const contribution = batch.currentVolume * proportion;
            return sum + (Number.isFinite(contribution) ? contribution : 0);
        }, 0);

        const blendedBatch = this.createBatch({
            variety: 'Blend',
            volume: totalVolume,
            tankId: newTankId,
            parentBatches: batchIds
        });

        parentBatches.forEach((batch, i) => {
            const proportion = proportions[i] ?? 0;
            const deduction = batch.currentVolume * proportion;
            batch.currentVolume = Math.max(0, batch.currentVolume - deduction);
            batch.genealogy.children.push(blendedBatch.id);
            this.addHistoryEntry(batch.id, {
                type: 'blend-out',
                data: {
                    toBatch: blendedBatch.id,
                    proportion
                }
            });
        });

        blendedBatch.history.push({
            type: 'blend',
            timestamp: new Date().toISOString(),
            components: batchIds.map((id, i) => ({
                batchId: id,
                proportion: proportions[i],
                variety: parentBatches[i]?.variety ?? 'Unknown'
            }))
        });

        this.saveBatches();
        return blendedBatch;
    }

    getTransfersForBatch(batchId) {
        return this.transfers.filter(t => t.batchId === batchId);
    }

    generateBatchReport(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) return null;

        return {
            ...batch,
            timeline: this.generateTimeline(batch),
            traceability: this.generateTraceability(batch),
            qualityMetrics: this.calculateQualityMetrics(batch),
            profitability: this.calculateProfitability(batch)
        };
    }

    generateQRCode(batch) {
        const seed = `${batch.id}-${batch.vintage}-${batch.variety ?? 'Unknown'}`;
        if (typeof btoa === 'function') {
            return `QR-${btoa(unescape(encodeURIComponent(seed))).slice(0, 24)}`;
        }
        return `QR-${seed}`;
    }

    generateTimeline(batch) {
        return [...batch.history].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
    }

    generateTraceability(batch) {
        return {
            vineyard: batch.vineyard,
            block: batch.block,
            harvestDate: batch.harvestDate,
            fermentationStart: batch.createdAt,
            transfers: this.getTransfersForBatch(batch.id),
            treatments: batch.treatments,
            bottlingDate: batch.bottlingDate,
            bottles: batch.bottleCount,
            genealogy: batch.genealogy
        };
    }

    calculateQualityMetrics(batch) {
        const labResults = batch.labResults ?? [];
        if (labResults.length === 0) {
            return {
                lastResult: null,
                averages: {},
                stability: 'unknown'
            };
        }

        const fields = ['alcohol', 'residualSugar', 'totalAcidity', 'volatileAcidity', 'pH'];
        const sums = Object.fromEntries(fields.map(field => [field, 0]));
        labResults.forEach(result => {
            fields.forEach(field => {
                if (typeof result[field] === 'number') {
                    sums[field] += result[field];
                }
            });
        });
        const averages = Object.fromEntries(fields.map(field => [field, sums[field] / labResults.length]));
        const latest = labResults[labResults.length - 1];

        const stability = this.assessStability(labResults);

        return {
            lastResult: latest,
            averages,
            stability
        };
    }

    assessStability(labResults) {
        if (labResults.length < 2) {
            return 'insufficient-data';
        }

        const sorted = [...labResults].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const deltas = sorted.slice(1).map((result, index) => {
            const prev = sorted[index];
            return {
                pH: (result.pH ?? prev.pH) - (prev.pH ?? 0),
                va: (result.volatileAcidity ?? prev.volatileAcidity) - (prev.volatileAcidity ?? 0),
                residualSugar: (result.residualSugar ?? prev.residualSugar) - (prev.residualSugar ?? 0)
            };
        });

        const instability = deltas.some(delta =>
            Math.abs(delta.pH) > 0.05 || Math.abs(delta.va) > 0.05 || Math.abs(delta.residualSugar) > 1
        );

        return instability ? 'unstable' : 'stable';
    }

    calculateProfitability(batch) {
        const costs = batch.costTracking ?? {};
        const totalCosts = (costs.grapes ?? 0) + (costs.labor ?? 0) + (costs.materials ?? 0) + (costs.overhead ?? 0);
        const bottleCount = batch.bottleCount ?? 0;
        const pricePerBottle = batch.pricePerBottle ?? batch.sellingPrice ?? 0;
        const revenue = bottleCount * pricePerBottle;
        const liters = batch.currentVolume ?? batch.initialVolume ?? 0;
        const costPerLiter = liters > 0 ? totalCosts / liters : 0;
        const margin = revenue - totalCosts;

        return {
            totalCosts,
            revenue,
            margin,
            costPerLiter,
            pricePerBottle,
            breakEvenPrice: bottleCount > 0 ? totalCosts / bottleCount : 0
        };
    }

    saveBatches() {
        if (typeof localStorage === 'undefined') return;
        const serializable = Array.from(this.batches.entries()).map(([id, batch]) => [id, batch]);
        localStorage.setItem('winery_batches', JSON.stringify(serializable));
    }

    saveTransfers() {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem('winery_transfers', JSON.stringify(this.transfers));
    }

    loadBatches() {
        if (typeof localStorage === 'undefined') return;
        const stored = localStorage.getItem('winery_batches');
        if (!stored) {
            return;
        }

        try {
            const entries = JSON.parse(stored);
            if (!Array.isArray(entries)) {
                return;
            }

            this.batches = new Map(entries.map(([id, batch]) => {
                const hydrated = {
                    ...batch,
                    history: Array.isArray(batch.history) ? batch.history : [],
                    labResults: Array.isArray(batch.labResults) ? batch.labResults : [],
                    treatments: Array.isArray(batch.treatments) ? batch.treatments : [],
                    costTracking: {
                        grapes: Number(batch.costTracking?.grapes ?? 0),
                        labor: Number(batch.costTracking?.labor ?? 0),
                        materials: Number(batch.costTracking?.materials ?? 0),
                        overhead: Number(batch.costTracking?.overhead ?? 0)
                    },
                    genealogy: {
                        parents: Array.isArray(batch.genealogy?.parents) ? batch.genealogy.parents : [],
                        children: Array.isArray(batch.genealogy?.children) ? batch.genealogy.children : []
                    }
                };
                return [id, hydrated];
            }));
        } catch (error) {
            console.error('Failed to load batches from storage', error);
            this.batches = new Map();
        }
    }

    loadTransfers() {
        if (typeof localStorage === 'undefined') return;
        const stored = localStorage.getItem('winery_transfers');
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                this.transfers = parsed;
            }
        } catch (error) {
            console.error('Failed to load transfers from storage', error);
            this.transfers = [];
        }
    }
}

if (typeof window !== 'undefined') {
    window.BatchManager = BatchManager;
}
