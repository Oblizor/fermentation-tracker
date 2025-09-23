// complianceManager.js - Regulatory compliance tracking
class ComplianceManager {
    constructor(batchManager) {
        this.batchManager = batchManager;
        this.regulations = this.loadRegulations();
        this.certificates = new Map();
        this.audits = [];
        this.bondNumber = 'BOND-000123';
    }

    loadRegulations() {
        return {
            US: {
                so2Limits: { red: 350, white: 350 },
                reportingFrequency: 'monthly'
            },
            EU: {
                so2Limits: { red: 150, white: 200 },
                reportingFrequency: 'quarterly'
            }
        };
    }

    getCurrentPeriod() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        return { start, end };
    }

    calculateLosses(batch) {
        if (!batch) return { totalLoss: 0, lossPercent: 0 };
        const expected = batch.initialVolume ?? 0;
        const current = batch.currentVolume ?? expected;
        const totalLoss = Math.max(0, expected - current);
        const lossPercent = expected > 0 ? (totalLoss / expected) * 100 : 0;
        return { totalLoss, lossPercent };
    }

    calculateTaxableLiters(batch) {
        if (!batch) return 0;
        const bottled = batch.bottleCount ?? 0;
        const bottleVolume = batch.bottleVolume ?? 0.75;
        return bottled * bottleVolume;
    }

    generateTTBReport(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) {
            return null;
        }

        const labResults = batch.labResults ?? [];
        const latestLab = labResults[labResults.length - 1] ?? {};

        return {
            reportId: `TTB-${Date.now()}`,
            batchId,
            bondNumber: this.bondNumber,
            reportPeriod: this.getCurrentPeriod(),
            production: {
                gallonsProduced: (batch.currentVolume ?? 0) * 0.264172,
                alcoholContent: latestLab.alcohol ?? null,
                sugarContent: latestLab.residualSugar ?? null
            },
            materials: {
                grapes: batch.grapeWeight ?? null,
                additives: (batch.treatments ?? []).map(t => ({
                    name: t.additive ?? t.name ?? 'Unknown',
                    amount: t.amount ?? null,
                    date: t.timestamp ?? t.date ?? null
                }))
            },
            movements: (batch.history ?? []).filter(h => h.type === 'transfer'),
            losses: this.calculateLosses(batch),
            taxableLiters: this.calculateTaxableLiters(batch)
        };
    }

    trackSO2Compliance(batchId, country = 'US') {
        const limits = this.regulations[country]?.so2Limits ?? this.regulations.US.so2Limits;
        const batch = this.getBatch(batchId);
        if (!batch) {
            return null;
        }
        const labResults = batch.labResults ?? [];
        const latestLab = labResults[labResults.length - 1] ?? {};
        const type = batch.wineType ?? 'red';
        const limit = limits[type] ?? 350;
        const currentSO2 = latestLab.totalSO2 ?? 0;

        return {
            compliant: currentSO2 <= limit,
            current: currentSO2,
            limit,
            margin: limit - currentSO2,
            recommendation: currentSO2 > limit * 0.9
                ? 'Approaching limit - avoid further additions'
                : 'Within safe limits'
        };
    }

    generateCertificateOfOrigin(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;
        const certificate = {
            id: `COO-${Date.now()}`,
            batchId,
            vineyard: batch.vineyard,
            harvestDate: batch.harvestDate,
            varietal: batch.variety,
            createdAt: new Date().toISOString()
        };
        this.certificates.set(certificate.id, certificate);
        return certificate;
    }

    generateAnalysisReport(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;
        const latest = (batch.labResults ?? []).slice(-1)[0] ?? {};
        return {
            id: `AN-${Date.now()}`,
            batchId,
            analyses: latest,
            issuedAt: new Date().toISOString()
        };
    }

    generateHealthCertificate(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;
        return {
            id: `HEALTH-${Date.now()}`,
            batchId,
            status: 'certified',
            inspections: batch.inspections ?? [],
            issuedAt: new Date().toISOString()
        };
    }

    generateCustomsDeclaration(batchId, destination) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;
        return {
            id: `CUS-${Date.now()}`,
            batchId,
            destination,
            volume: batch.currentVolume ?? batch.initialVolume ?? 0,
            alcohol: (batch.labResults ?? []).slice(-1)[0]?.alcohol ?? null,
            createdAt: new Date().toISOString()
        };
    }

    generateVI1Form(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;
        const latest = (batch.labResults ?? []).slice(-1)[0] ?? {};
        return {
            id: `VI1-${Date.now()}`,
            batchId,
            alcohol: latest.alcohol ?? null,
            totalAcidity: latest.totalAcidity ?? null,
            residualSugar: latest.residualSugar ?? null,
            issuedAt: new Date().toISOString()
        };
    }

    generateExportDocumentation(batchId, destination) {
        return {
            certificateOfOrigin: this.generateCertificateOfOrigin(batchId),
            analysisReport: this.generateAnalysisReport(batchId),
            healthCertificate: this.generateHealthCertificate(batchId),
            customsDeclaration: this.generateCustomsDeclaration(batchId, destination),
            VI1Form: destination === 'EU' ? this.generateVI1Form(batchId) : null
        };
    }

    scheduleAudit(type, date) {
        const audit = {
            id: `AUDIT-${Date.now()}`,
            type,
            scheduledDate: date,
            auditor: null,
            status: 'scheduled',
            checklist: this.generateAuditChecklist(type),
            findings: [],
            correctiveActions: []
        };
        this.audits.push(audit);
        return audit;
    }

    generateAuditChecklist(type) {
        const baseChecklist = [
            { item: 'Record keeping up to date', status: 'pending' },
            { item: 'Tank sanitation logs complete', status: 'pending' },
            { item: 'Additives documented', status: 'pending' }
        ];

        if (type === 'Organic') {
            baseChecklist.push({ item: 'Organic certification paperwork', status: 'pending' });
        }
        if (type === 'Biodynamic') {
            baseChecklist.push({ item: 'Biodynamic preparations logs', status: 'pending' });
        }
        if (type === 'ISO') {
            baseChecklist.push({ item: 'ISO 22000 procedures reviewed', status: 'pending' });
        }
        return baseChecklist;
    }

    getBatch(batchId) {
        return this.batchManager?.getBatch(batchId) ?? null;
    }
}

if (typeof window !== 'undefined') {
    window.ComplianceManager = ComplianceManager;
}
