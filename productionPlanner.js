// productionPlanner.js - Advanced production scheduling
class ProductionPlanner {
    constructor() {
        this.schedule = [];
        this.resources = this.initializeResources();
        this.bottlingLines = [];
        this.allocationContext = { batches: [], tanks: [] };
    }

    initializeResources() {
        if (typeof localStorage === 'undefined') {
            return this.defaultResources();
        }

        try {
            const stored = localStorage.getItem('planner_resources');
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    ...this.defaultResources(),
                    ...parsed,
                    tanks: parsed.tanks ?? this.defaultResources().tanks,
                    barrels: parsed.barrels ?? this.defaultResources().barrels
                };
            }
        } catch (error) {
            console.warn('Unable to load stored planner resources', error);
        }

        return this.defaultResources();
    }

    defaultResources() {
        return {
            crews: [
                { id: 'crew-1', name: 'Cellar Team A', capacity: 3 },
                { id: 'crew-2', name: 'Cellar Team B', capacity: 2 }
            ],
            tanks: [
                { id: 'T1', capacity: 10000, location: 'Cellar North', temperature: 16, currentVolume: 0 },
                { id: 'T2', capacity: 8000, location: 'Cellar South', temperature: 15, currentVolume: 0 }
            ],
            barrels: [
                { id: 'B1', volume: 225, location: 'Barrel Room A', age: 2, lastTopped: null },
                { id: 'B2', volume: 225, location: 'Barrel Room B', age: 3, lastTopped: null }
            ]
        };
    }

    saveResources() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('planner_resources', JSON.stringify(this.resources));
        } catch (error) {
            console.warn('Unable to save planner resources', error);
        }
    }

    createProductionPlan(vintage) {
        const plan = {
            id: `PLAN-${vintage}-${Date.now()}`,
            vintage,
            phases: [
                { name: 'Harvest', startDate: null, endDate: null, tasks: [], resources: [], status: 'planned' },
                { name: 'Fermentation', startDate: null, endDate: null, tasks: [], resources: [], status: 'planned' },
                { name: 'Aging', startDate: null, endDate: null, tasks: [], resources: [], status: 'planned' },
                { name: 'Bottling', startDate: null, endDate: null, tasks: [], resources: [], status: 'planned' }
            ],
            allocations: new Map(),
            conflicts: [],
            optimization: null
        };

        return this.optimizePlan(plan);
    }

    optimizePlan(plan) {
        const planCopy = {
            ...plan,
            phases: plan.phases.map(phase => ({ ...phase }))
        };

        const startDate = new Date(`${plan.vintage}-03-01T00:00:00Z`);
        const phaseDurations = {
            Harvest: 21,
            Fermentation: 30,
            Aging: 180,
            Bottling: 14
        };

        let cursor = startDate;
        planCopy.phases.forEach(phase => {
            const duration = phaseDurations[phase.name] ?? 14;
            const start = new Date(cursor.getTime());
            const end = new Date(cursor.getTime());
            end.setDate(end.getDate() + duration);
            phase.startDate = start.toISOString();
            phase.endDate = end.toISOString();
            phase.resources = this.allocateResourcesForPhase(phase.name);
            cursor = new Date(end.getTime());
        });

        const utilization = this.calculateResourceUtilization(planCopy.phases);
        planCopy.optimization = {
            resourceUtilization: utilization,
            suggestions: this.generateOptimizationSuggestions(utilization)
        };

        return planCopy;
    }

    allocateResourcesForPhase(phaseName) {
        switch (phaseName) {
            case 'Harvest':
                return this.resources.crews.map(crew => ({ crewId: crew.id, role: 'Harvest support' }));
            case 'Fermentation':
                return this.resources.tanks.map(tank => ({ tankId: tank.id, usage: 'Fermentation' }));
            case 'Aging':
                return this.resources.barrels.map(barrel => ({ barrelId: barrel.id, usage: 'Aging' }));
            case 'Bottling':
                return this.bottlingLines.map(line => ({ lineId: line.id, capacity: line.capacity }));
            default:
                return [];
        }
    }

    calculateResourceUtilization(phases) {
        const utilization = { crews: 0, tanks: 0, barrels: 0 };
        const totals = {
            crews: this.resources.crews.length,
            tanks: this.resources.tanks.length,
            barrels: this.resources.barrels.length
        };

        phases.forEach(phase => {
            phase.resources.forEach(resource => {
                if (resource.crewId) utilization.crews += 1;
                if (resource.tankId) utilization.tanks += 1;
                if (resource.barrelId) utilization.barrels += 1;
            });
        });

        return {
            crews: totals.crews ? Math.min(100, (utilization.crews / totals.crews) * 100) : 0,
            tanks: totals.tanks ? Math.min(100, (utilization.tanks / totals.tanks) * 100) : 0,
            barrels: totals.barrels ? Math.min(100, (utilization.barrels / totals.barrels) * 100) : 0
        };
    }

    generateOptimizationSuggestions(utilization) {
        const suggestions = [];
        if (utilization.tanks > 90) {
            suggestions.push('Tank capacity nearing limits. Consider staggered fermentation starts.');
        }
        if (utilization.barrels < 50) {
            suggestions.push('Excess barrel capacity. Evaluate topping and rotation schedules.');
        }
        if (utilization.crews > 80) {
            suggestions.push('Crew utilization high. Consider temporary labor or automation.');
        }
        if (suggestions.length === 0) {
            suggestions.push('Resources balanced across plan phases.');
        }
        return suggestions;
    }

    scheduleBottling(batchId, date, lineId, bottles) {
        const bottlingJob = {
            id: `BOTTLE-${Date.now()}`,
            batchId,
            scheduledDate: date,
            lineId,
            estimatedBottles: bottles,
            estimatedDuration: this.calculateBottlingTime(bottles, lineId),
            resources: {
                bottles: bottles,
                corks: bottles,
                capsules: bottles,
                labels: bottles * 2,
                boxes: Math.ceil(bottles / 12)
            },
            status: 'scheduled',
            actualBottles: 0,
            startTime: null,
            endTime: null,
            qualityChecks: []
        };

        const conflicts = this.checkScheduleConflicts(bottlingJob);
        if (conflicts.length > 0) {
            return { success: false, conflicts };
        }

        this.schedule.push(bottlingJob);
        return { success: true, job: bottlingJob };
    }

    checkScheduleConflicts(job) {
        const jobDate = new Date(job.scheduledDate);
        if (!Number.isFinite(jobDate.getTime())) {
            return [{ type: 'invalid-date', message: 'Scheduled date is invalid' }];
        }

        return this.schedule.filter(existing => {
            if (existing.lineId !== job.lineId) {
                return false;
            }
            const existingDate = new Date(existing.scheduledDate);
            const sameDay = existingDate.toDateString() === jobDate.toDateString();
            if (!sameDay) {
                return false;
            }

            const existingEnd = new Date(existingDate.getTime() + existing.estimatedDuration * 60000);
            const jobEnd = new Date(jobDate.getTime() + job.estimatedDuration * 60000);
            return (jobDate >= existingDate && jobDate < existingEnd) ||
                (jobEnd > existingDate && jobEnd <= existingEnd);
        }).map(conflict => ({
            type: 'overlap',
            job: conflict
        }));
    }

    calculateBottlingTime(bottles, lineId) {
        const line = this.bottlingLines.find(l => l.id === lineId);
        const bottlesPerHour = line ? line.capacity : 500;
        return (bottles / bottlesPerHour) * 60;
    }

    registerBottlingLine(line) {
        this.bottlingLines.push(line);
    }

    generateInitialPopulation(batches, tanks) {
        const populationSize = 20;
        const population = [];
        const safeTanks = tanks.filter(tank => tank.capacity > 0);

        for (let i = 0; i < populationSize; i++) {
            const assignments = batches.map(batch => {
                const tank = safeTanks[Math.floor(Math.random() * safeTanks.length)] ?? null;
                return {
                    batchId: batch.id,
                    tankId: tank?.id ?? null
                };
            });
            population.push({ assignments });
        }
        return population;
    }

    evaluateTankAllocation(solution) {
        const { batches, tanks } = this.allocationContext;
        const tankMap = new Map(tanks.map(tank => [tank.id, tank]));
        const batchMap = new Map(batches.map(batch => [batch.id, batch]));

        const usage = new Map();
        let fitness = 0;

        solution.assignments.forEach(assignment => {
            const batch = batchMap.get(assignment.batchId);
            const tank = tankMap.get(assignment.tankId);
            if (!batch || !tank) {
                fitness -= 5;
                return;
            }
            const currentUsage = usage.get(tank.id) ?? 0;
            const projected = currentUsage + (batch.currentVolume ?? batch.initialVolume ?? 0);
            const utilization = projected / tank.capacity;
            if (utilization > 1.05) {
                fitness -= 10;
            } else {
                fitness += (1 - Math.abs(0.8 - utilization));
                usage.set(tank.id, projected);
            }
        });

        const diversityBonus = new Set(solution.assignments.map(a => a.tankId)).size;
        fitness += diversityBonus * 0.1;

        return fitness;
    }

    evolvePopulation(population) {
        const sorted = [...population].sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
        const elite = sorted.slice(0, 2);
        const newPopulation = [...elite];
        const targetSize = population.length;

        while (newPopulation.length < targetSize) {
            const parentA = sorted[Math.floor(Math.random() * Math.min(sorted.length, 10))] ?? elite[0];
            const parentB = sorted[Math.floor(Math.random() * Math.min(sorted.length, 10))] ?? elite[1] ?? elite[0];
            const crossoverPoint = Math.floor(Math.random() * (parentA.assignments.length || 1));
            const childAssignments = [
                ...parentA.assignments.slice(0, crossoverPoint),
                ...parentB.assignments.slice(crossoverPoint)
            ];

            if (Math.random() < 0.2) {
                const index = Math.floor(Math.random() * childAssignments.length);
                const availableTanks = this.allocationContext.tanks;
                const randomTank = availableTanks[Math.floor(Math.random() * availableTanks.length)];
                if (childAssignments[index] && randomTank) {
                    childAssignments[index] = {
                        ...childAssignments[index],
                        tankId: randomTank.id
                    };
                }
            }

            newPopulation.push({ assignments: childAssignments });
        }

        return newPopulation.slice(0, targetSize);
    }

    optimizeTankAllocation(batches, tanks) {
        this.allocationContext = { batches, tanks };
        let population = this.generateInitialPopulation(batches, tanks);
        let bestSolution = null;
        let bestFitness = -Infinity;

        for (let generation = 0; generation < 50; generation++) {
            population.forEach(solution => {
                solution.fitness = this.evaluateTankAllocation(solution);
                if (solution.fitness > bestFitness) {
                    bestFitness = solution.fitness;
                    bestSolution = solution;
                }
            });

            population = this.evolvePopulation(population);
        }

        return bestSolution;
    }

    generateCellarMap() {
        return {
            tanks: this.resources.tanks.map(tank => ({
                ...tank,
                location: tank.location,
                currentBatch: tank.currentBatch ?? null,
                temperature: tank.temperature,
                fillLevel: tank.capacity ? ((tank.currentVolume ?? 0) / tank.capacity) * 100 : 0
            })),
            barrels: this.resources.barrels.map(barrel => ({
                ...barrel,
                location: barrel.location,
                currentWine: barrel.currentWine ?? null,
                age: barrel.age,
                lastTopped: barrel.lastTopped
            }))
        };
    }
}

if (typeof window !== 'undefined') {
    window.ProductionPlanner = ProductionPlanner;
}
