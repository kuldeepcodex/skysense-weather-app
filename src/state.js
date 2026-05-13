/**
 * src/state.js
 * Centralised application state: unit preference, search history, last data.
 * No DOM manipulation — callers decide how to react to state changes.
 */

// ── Temperature unit ───────────────────────────────────────────────────────

const UNIT_KEY = 'skysense_unit';

/** Current display unit: 'C' | 'F'  */
export let currentUnit = localStorage.getItem(UNIT_KEY) || 'C';

/**
 * Persist and broadcast a unit change.
 * The caller (script.js) is responsible for updating the UI after this.
 * @param {'C'|'F'} unit
 */
export function setCurrentUnit(unit) {
    currentUnit = unit;
    localStorage.setItem(UNIT_KEY, unit);
}

/** Convert °C → °F (rounded) */
export const toF = (c) => Math.round(c * 9 / 5 + 32);

/**
 * Format a Celsius value according to the current unit preference.
 * @param {number} c - temperature in Celsius
 * @returns {string} e.g. "23°C" or "73°F"
 */
export function fmtTemp(c) {
    return currentUnit === 'F' ? `${toF(c)}°F` : `${Math.round(c)}°C`;
}

/**
 * Format a Celsius value according to the current unit preference, without 'C' or 'F'.
 * @param {number} c - temperature in Celsius
 * @returns {string} e.g. "23°" or "73°"
 */
export function fmtTempOnly(c) {
    return currentUnit === 'F' ? `${toF(c)}°` : `${Math.round(c)}°`;
}

// ── Last fetched data (needed for unit-toggle re-render) ───────────────────

/** @type {object|null} */
export let lastWeatherData = null;

/** @param {object} data - full API response */
export function setLastWeatherData(data) {
    lastWeatherData = data;
}

// ── Search history ─────────────────────────────────────────────────────────

const HISTORY_KEY = 'skysense_history';
const LEGACY_HISTORY_KEY = 'skysense_search_history';
const MAX_HISTORY = 10;

/**
 * Read the full search history from localStorage.
 * @returns {{ name: string, country: string, region: string, count: number, lastUsed: number }[]}
 */
export function getSearchHistory() {
    try {
        const current = localStorage.getItem(HISTORY_KEY);
        if (current) return JSON.parse(current) || [];

        const legacy = localStorage.getItem(LEGACY_HISTORY_KEY);
        if (!legacy) return [];

        const migrated = JSON.parse(legacy) || [];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated.slice(0, MAX_HISTORY)));
        localStorage.removeItem(LEGACY_HISTORY_KEY);
        return migrated;
    } catch {
        return [];
    }
}

/**
 * Record a successful city search; increments frequency counter.
 * @param {string} cityName
 * @param {string} country
 * @param {string} region
 */
export function recordSearch(cityName, country, region) {
    const history = getSearchHistory();
    const key = `${cityName}|${country}`;
    const existing = history.find(h => `${h.name}|${h.country}` === key);

    if (existing) {
        existing.count++;
        existing.lastUsed = Date.now();
        if (region) existing.region = region;
    } else {
        history.push({
            name:     cityName,
            country:  country  || '',
            region:   region   || '',
            count:    1,
            lastUsed: Date.now(),
        });
    }

    history.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

/**
 * Return history entries that match the search query (partial, case-insensitive).
 * @param {string} query
 * @returns {object[]}
 */
export function getHistoryMatches(query) {
    const q = query.toLowerCase();
    return getSearchHistory()
        .filter(h => h.name.toLowerCase().includes(q))
        .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
}

/**
 * Wipe the search history from localStorage.
 */
export function clearSearchHistory() {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LEGACY_HISTORY_KEY);
}
