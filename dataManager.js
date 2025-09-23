// dataManager.js - All data operations in one place

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATETIME_WITH_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

function toLocalDateTimeString(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }

    const offsetMs = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offsetMs);
    return localDate.toISOString().slice(0, 16);
}

function formatForDateTimeInput(input) {
    if (input === null || input === undefined) {
        return '';
    }

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) {
            return '';
        }

        if (DATETIME_LOCAL_PATTERN.test(trimmed)) {
            return trimmed;
        }

        const localMatch = trimmed.match(DATETIME_WITH_TIME_PATTERN);
        const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
        if (localMatch && !hasZone) {
            return `${localMatch[1]}T${localMatch[2]}`;
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return toLocalDateTimeString(parsed);
        }

        return '';
    }

    if (input instanceof Date) {
        return toLocalDateTimeString(input);
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
        return toLocalDateTimeString(new Date(input));
    }

    return '';
}

if (typeof window !== 'undefined') {
    window.formatForDateTimeInput = formatForDateTimeInput;
}

class DataManager {
    constructor() {
        this.cache = new Map();
    }

    normalizeReading(entry) {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }

        const normalizedTimestamp = formatForDateTimeInput(entry.timestamp);
        if (normalizedTimestamp) {
            return { ...entry, timestamp: normalizedTimestamp };
        }

        return { ...entry };
    }

    getTankData(tankId) {
        if (!tankId) return [];
        
        // Use cache first
        if (this.cache.has(tankId)) {
            return this.cache.get(tankId);
        }
        
        const data = localStorage.getItem(tankId);
        const parsed = data ? JSON.parse(data) : [];
        this.cache.set(tankId, parsed);
        return parsed;
    }

    saveTankData(tankId, data) {
        // Sort by timestamp (newest first) before saving
        const sorted = [...data].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        localStorage.setItem(tankId, JSON.stringify(sorted));
        this.cache.set(tankId, sorted);
        this.notifyChange(tankId, sorted);
    }

    addReading(tankId, reading) {
        const data = this.getTankData(tankId);
        data.push(this.normalizeReading(reading));
        this.saveTankData(tankId, data);
    }

    updateReading(tankId, index, reading) {
        const data = this.getTankData(tankId);
        if (index >= 0 && index < data.length) {
            data[index] = this.normalizeReading(reading);
            this.saveTankData(tankId, data);
        }
    }

    deleteReading(tankId, index) {
        const data = this.getTankData(tankId);
        if (index >= 0 && index < data.length) {
            data.splice(index, 1);
            this.saveTankData(tankId, data);
        }
    }

    getLatestReading(tankId) {
        const data = this.getTankData(tankId);
        if (data.length === 0) return null;
        
        return data.reduce((latest, current) => 
            new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
        );
    }

    mergeReadings(tankId, imported) {
        const existing = this.getTankData(tankId);
        const map = new Map();

        const normalizeEntry = (entry) => this.normalizeReading(entry);

        // Existing entries
        existing.forEach(entry => {
            const normalized = normalizeEntry(entry);
            if (!normalized) {
                return;
            }
            const key = normalized.timestamp ?? entry?.timestamp;
            if (key) {
                map.set(key, normalized);
            }
        });

        // Imported entries (overwrite if same timestamp)
        imported.forEach(entry => {
            const normalized = normalizeEntry(entry);
            if (!normalized) {
                return;
            }
            const key = normalized.timestamp ?? entry?.timestamp;
            if (key) {
                map.set(key, normalized);
            }
        });

        const merged = Array.from(map.values());
        this.saveTankData(tankId, merged);
        return merged;
    }

    exportData(tankId, format = 'json') {
        const data = this.getTankData(tankId);
        
        if (format === 'csv') {
            return this.toCSV(data);
        }
        
        return JSON.stringify(data, null, 2);
    }

    toCSV(data) {
        if (!data.length) return '';
        
        const headers = Array.from(new Set(data.flatMap(d => Object.keys(d))));
        const rows = data.map(row => 
            headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    }

    parseCSV(text) {
        const [headerLine, ...lines] = text.trim().split(/\r?\n/);
        const headers = headerLine.split(',');
        
        return lines.filter(l => l.trim()).map(line => {
            const values = line.split(',');
            const entry = {};
            
            headers.forEach((h, i) => {
                let value = values[i];
                if (value) {
                    value = value.replace(/^"|"$/g, '');
                }
                entry[h] = value;
            });
            
            return entry;
        });
    }

    // Observer pattern for data changes
    subscribers = [];

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifyChange(tankId, data) {
        this.subscribers.forEach(callback => callback(tankId, data));
    }

    // Tank variety management
    getTankVariety(tankId) {
        return localStorage.getItem(tankId + '_variety') || '';
    }

    setTankVariety(tankId, variety) {
        if (variety) {
            localStorage.setItem(tankId + '_variety', variety);
        } else {
            localStorage.removeItem(tankId + '_variety');
        }
    }
}
