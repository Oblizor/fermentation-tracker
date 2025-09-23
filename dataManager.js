// dataManager.js - All data operations in one place

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ISO_LIKE_PATTERN = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[Tt ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?(?:\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2}))?$/;
const DAY_FIRST_PATTERN = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:[Tt ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?(?:\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2}))?$/;

function pad(value, length = 2) {
    return String(value).padStart(length, '0');
}

function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

function normalizeZone(zone) {
    if (!zone) {
        return null;
    }

    const normalized = zone.trim().toUpperCase();

    if (normalized === 'Z' || normalized === 'UTC' || normalized === 'GMT') {
        return 'Z';
    }

    if (/^[+-]\d{2}$/.test(normalized)) {
        return `${normalized}:00`;
    }

    if (/^[+-]\d{4}$/.test(normalized)) {
        return `${normalized.slice(0, 3)}:${normalized.slice(3)}`;
    }

    if (/^[+-]\d{2}:\d{2}$/.test(normalized)) {
        return normalized;
    }

    return null;
}

function fractionToMilliseconds(fraction) {
    if (!fraction) {
        return 0;
    }

    const normalized = `${fraction}`.slice(0, 3).padEnd(3, '0');
    return Number(normalized);
}

function buildDateFromParts(year, month, day, hours = '0', minutes = '0', seconds = '0', fraction = '', zone) {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const numericHours = Number(hours);
    const numericMinutes = Number(minutes);
    const numericSeconds = Number(seconds || 0);
    const numericMilliseconds = fractionToMilliseconds(fraction);

    const parts = [numericYear, numericMonth, numericDay, numericHours, numericMinutes, numericSeconds, numericMilliseconds];
    if (parts.some(part => Number.isNaN(part))) {
        return null;
    }

    if (zone) {
        const normalizedZone = normalizeZone(zone);
        if (!normalizedZone) {
            return null;
        }

        const secondsPart = numericSeconds || fraction ? `:${pad(numericSeconds)}${fraction ? `.${fraction}` : ''}` : '';
        const isoString = `${pad(numericYear, 4)}-${pad(numericMonth)}-${pad(numericDay)}T${pad(numericHours)}:${pad(numericMinutes)}${secondsPart}${normalizedZone}`;
        const zonedDate = new Date(isoString);
        return isValidDate(zonedDate) ? zonedDate : null;
    }

    const localDate = new Date(
        numericYear,
        numericMonth - 1,
        numericDay,
        numericHours,
        numericMinutes,
        numericSeconds,
        numericMilliseconds
    );

    if (!isValidDate(localDate)) {
        return null;
    }

    if (
        localDate.getFullYear() !== numericYear ||
        localDate.getMonth() !== numericMonth - 1 ||
        localDate.getDate() !== numericDay ||
        localDate.getHours() !== numericHours ||
        localDate.getMinutes() !== numericMinutes ||
        localDate.getSeconds() !== numericSeconds
    ) {
        return null;
    }

    return localDate;
}

function tryParseDateLike(input) {
    if (input instanceof Date) {
        return isValidDate(input) ? new Date(input.getTime()) : null;
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
        const numericDate = new Date(input);
        return isValidDate(numericDate) ? numericDate : null;
    }

    if (typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    let match = trimmed.match(ISO_LIKE_PATTERN);
    if (match) {
        const [, year, month, day, hours = '0', minutes = '0', seconds = '0', fraction = '', zone] = match;
        return buildDateFromParts(year, month, day, hours, minutes, seconds, fraction, zone);
    }

    match = trimmed.match(DAY_FIRST_PATTERN);
    if (match) {
        const [, day, month, year, hours = '0', minutes = '0', seconds = '0', fraction = '', zone] = match;
        return buildDateFromParts(year, month, day, hours, minutes, seconds, fraction, zone);
    }

    const normalized = trimmed
        .replace(/\s+(UTC|GMT)$/i, 'Z')
        .replace(/\s+(?=[+-]\d{2}:?\d{2}$)/, '')
        .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
        .replace(/\s+/, 'T');

    const fallbackDate = new Date(normalized);
    return isValidDate(fallbackDate) ? fallbackDate : null;
}

function toLocalDateTimeString(date) {
    if (!isValidDate(date)) {
        return '';
    }

    const offsetInMs = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offsetInMs);
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
    }

    const parsed = tryParseDateLike(input);
    return parsed ? toLocalDateTimeString(parsed) : '';
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
