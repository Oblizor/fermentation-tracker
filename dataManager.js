// dataManager.js - All data operations in one place

const FLEXIBLE_DATE_SEPARATOR = '[-/.]';
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATETIME_WITH_TIME_PATTERN = new RegExp(`^(\\d{4})${FLEXIBLE_DATE_SEPARATOR}(\\d{1,2})${FLEXIBLE_DATE_SEPARATOR}(\\d{1,2})[T ](\\d{1,2}):(\\d{1,2})(?::(\\d{1,2})(?:\\.(\\d+))?)?$`);
const DATE_ONLY_PATTERN = new RegExp(`^(\\d{4})${FLEXIBLE_DATE_SEPARATOR}(\\d{1,2})${FLEXIBLE_DATE_SEPARATOR}(\\d{1,2})$`);
const DAY_FIRST_PATTERN = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:[ T](\d{1,2}):(\d{1,2}))?$/;
const TIMEZONE_SUFFIX_PATTERN = /[zZ]|[+-]\d{2}:?\d{2}$/;

function pad(value) {
    return String(value).padStart(2, '0');
}

function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

function buildLocalDate(year, month, day, hours = '00', minutes = '00', seconds = '00') {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const numericHours = Number(hours);
    const numericMinutes = Number(minutes);
    const numericSeconds = Number(seconds);

    const date = new Date(numericYear, numericMonth - 1, numericDay, numericHours, numericMinutes, numericSeconds);

    if (!isValidDate(date)) {
        return null;
    }

    const monthMatches = date.getMonth() === numericMonth - 1;
    const dayMatches = date.getDate() === numericDay;
    const hoursMatch = date.getHours() === numericHours;
    const minutesMatch = date.getMinutes() === numericMinutes;
    const secondsMatch = date.getSeconds() === numericSeconds;

    if (!monthMatches || !dayMatches || !hoursMatch || !minutesMatch || !secondsMatch) {
        return null;
    }

    return date;
}

function coerceToDate(input) {
    if (input instanceof Date) {
        return isValidDate(input) ? new Date(input.getTime()) : null;
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
        const date = new Date(input);
        return isValidDate(date) ? date : null;
    }

    if (typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    let match = trimmed.match(DATETIME_LOCAL_PATTERN);
    if (match) {
        const [, year, month, day, hours, minutes] = match;
        return buildLocalDate(year, month, day, hours, minutes);
    }

    match = trimmed.match(DATETIME_WITH_TIME_PATTERN);
    if (match && !TIMEZONE_SUFFIX_PATTERN.test(trimmed)) {
        const [, year, month, day, hours, minutes, seconds = '00'] = match;
        return buildLocalDate(year, month, day, hours, minutes, seconds);
    }

    match = trimmed.match(DATE_ONLY_PATTERN);
    if (match) {
        const [, year, month, day] = match;
        return buildLocalDate(year, month, day);
    }

    match = trimmed.match(DAY_FIRST_PATTERN);
    if (match) {
        const [, day, month, year, hours = '0', minutes = '0'] = match;
        return buildLocalDate(year, month, day, hours, minutes);
    }

    const normalizedOffset = trimmed.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const parsed = new Date(normalizedOffset);

    return isValidDate(parsed) ? parsed : null;
}

function toLocalDateTimeString(date) {
    if (!isValidDate(date)) {
        return '';
    }

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
        if (localMatch && !TIMEZONE_SUFFIX_PATTERN.test(trimmed)) {
            const [, year, month, day, hours, minutes] = localMatch;
            return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
        }

        const coerced = coerceToDate(trimmed);
        if (coerced) {
            return toLocalDateTimeString(coerced);
        }

        return '';
    }

    const coerced = coerceToDate(input);
    if (coerced) {
        return toLocalDateTimeString(coerced);
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
