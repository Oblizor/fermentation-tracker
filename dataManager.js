// dataManager.js - All data operations in one place

function formatForDateTimeInput(input) {
    if (input === null || input === undefined) {
        return '';
    }

    let parsed;

    if (input instanceof Date) {
        parsed = input;
    } else if (typeof input === 'number') {
        parsed = new Date(input);
    } else if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) {
            return '';
        }
        parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            const partial = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
            return partial ? `${partial[1]}T${partial[2]}` : '';
        }
    } else {
        return '';
    }

    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const pad = (num) => String(num).padStart(2, '0');

    const year = parsed.getFullYear();
    const month = pad(parsed.getMonth() + 1);
    const day = pad(parsed.getDate());
    const hours = pad(parsed.getHours());
    const minutes = pad(parsed.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

class DataManager {
    constructor() {
        this.cache = new Map();
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
        data.push(reading);
        this.saveTankData(tankId, data);
    }

    updateReading(tankId, index, reading) {
        const data = this.getTankData(tankId);
        if (index >= 0 && index < data.length) {
            data[index] = reading;
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

        const normalizeEntry = (entry) => {
            if (!entry) return entry;
            const normalizedTimestamp = formatForDateTimeInput(entry.timestamp);
            if (normalizedTimestamp) {
                return { ...entry, timestamp: normalizedTimestamp };
            }
            return { ...entry };
        };

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
