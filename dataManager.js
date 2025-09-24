// dataManager.js - All data operations in one place

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATETIME_WITH_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const DAY_FIRST_PATTERN = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?(?:\s*([zZ]|[+-]\d{2}:?\d{2}))?$/;

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

        // If already in datetime-local format, return as is
        if (DATETIME_LOCAL_PATTERN.test(trimmed)) {
            return trimmed;
        }

        // Check for datetime with time pattern (no timezone)
        const localMatch = trimmed.match(DATETIME_WITH_TIME_PATTERN);
        const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
        if (localMatch && !hasZone) {
            return `${localMatch[1]}T${localMatch[2]}`;
        }

        // Handle day-first formats (DD/MM/YYYY or DD-MM-YYYY)
        const dayFirstMatch = trimmed.match(DAY_FIRST_PATTERN);
        if (dayFirstMatch) {
            const [, day, month, year, hour = '00', minute = '00', second = '00', fraction, zone] = dayFirstMatch;
            const pad2 = (value) => String(value).padStart(2, '0');
            const datePart = `${year}-${pad2(month)}-${pad2(day)}`;
            const timePart = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;

            let isoString = `${datePart}T${timePart}`;
            if (fraction) {
                isoString += `.${fraction}`;
            }

            if (zone) {
                if (/[zZ]/.test(zone)) {
                    isoString += 'Z';
                } else {
                    const sign = zone[0];
                    const digits = zone.slice(1).replace(':', '');
                    const hours = digits.slice(0, 2) || '00';
                    const minutes = digits.slice(2) || '00';
                    isoString += `${sign}${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                }
            }

            const parsedDayFirst = new Date(isoString);
            if (!Number.isNaN(parsedDayFirst.getTime())) {
                return toLocalDateTimeString(parsedDayFirst);
            }
        }

        // Try parsing as date
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
        this.subscribers = [];
        this.memoryStore = new Map();
        this.memoryVariety = new Map();
        this.storageAvailable = this.checkStorageAvailability();
    }

    checkStorageAvailability() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return false;
        }
        try {
            const testKey = '__vinetrack_storage_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('Local storage unavailable, using in-memory persistence only.', error);
            return false;
        }
    }

    useMemoryStore(tankId, data) {
        const clone = Array.isArray(data) ? data.map(entry => ({ ...entry })) : [];
        this.memoryStore.set(tankId, clone);
        return clone;
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

        let parsed = [];
        if (this.storageAvailable) {
            try {
                const stored = window.localStorage.getItem(tankId);
                parsed = stored ? JSON.parse(stored) : [];
            } catch (error) {
                console.warn('Failed to read from local storage, falling back to in-memory data.', error);
                this.storageAvailable = false;
                parsed = this.memoryStore.get(tankId) ?? [];
            }
        } else {
            parsed = this.memoryStore.get(tankId) ?? [];
        }

        const clone = parsed.map(entry => ({ ...entry }));
        this.cache.set(tankId, clone);
        return clone;
    }

    saveTankData(tankId, data) {
        // Sort by timestamp (newest first) before saving
        const sorted = [...data].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        if (this.storageAvailable) {
            try {
                window.localStorage.setItem(tankId, JSON.stringify(sorted));
            } catch (error) {
                console.warn('Persisting to local storage failed. Continuing with in-memory cache.', error);
                this.storageAvailable = false;
                this.useMemoryStore(tankId, sorted);
            }
        }

        if (!this.storageAvailable) {
            this.useMemoryStore(tankId, sorted);
        }

        const snapshot = sorted.map(entry => ({ ...entry }));
        this.cache.set(tankId, snapshot);
        this.notifyChange(tankId, snapshot);
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
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifyChange(tankId, data) {
        this.subscribers.forEach(callback => callback(tankId, data));
    }

    // Tank variety management
    getTankVariety(tankId) {
        if (this.storageAvailable) {
            try {
                return window.localStorage.getItem(`${tankId}_variety`) || '';
            } catch (error) {
                console.warn('Reading tank variety from local storage failed, reverting to memory cache.', error);
                this.storageAvailable = false;
            }
        }
        return this.memoryVariety.get(tankId) || '';
    }

    setTankVariety(tankId, variety) {
        if (this.storageAvailable) {
            try {
                if (variety) {
                    window.localStorage.setItem(`${tankId}_variety`, variety);
                } else {
                    window.localStorage.removeItem(`${tankId}_variety`);
                }
                this.memoryVariety.delete(tankId);
                return;
            } catch (error) {
                console.warn('Persisting tank variety failed. Using in-memory fallback.', error);
                this.storageAvailable = false;
            }
        }

        if (variety) {
            this.memoryVariety.set(tankId, variety);
        } else {
            this.memoryVariety.delete(tankId);
        }
    }
}
