/**
 * src/api.js
 * Network layer: fetches weather data and search suggestions.
 * Handles AbortController, caching, search-history merging, and URL routing.
 */

import { appCache, WEATHER_TTL, SEARCH_TTL } from './cache.js';
import { recordSearch, getHistoryMatches }   from './state.js';

// ── Offline banner helpers ─────────────────────────────────────────────────

function showOfflineBanner(isoTimestamp) {
    const banner = document.getElementById('offline-banner');
    const label  = document.getElementById('offline-timestamp');
    if (!banner) return;
    if (isoTimestamp) {
        try {
            label.textContent = new Date(isoTimestamp).toLocaleString();
        } catch {
            label.textContent = 'a previous session';
        }
    }
    banner.hidden = false;
}

function hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.hidden = true;
}


// ── Constants ──────────────────────────────────────────────────────────────

const API_KEY  = ''; // Reserved for direct file-based local testing only.
const BASE_URL = 'https://api.weatherapi.com/v1';

/**
 * True when served from a real domain (Vercel).
 * False when running from file:// or localhost.
 */
export const IS_PRODUCTION = (() => {
    if (location.protocol === 'file:') return false;
    if (['localhost', '127.0.0.1'].includes(location.hostname)) return true;
    return true;
})();

// ── AbortControllers ───────────────────────────────────────────────────────

let weatherAbortController = null;
let searchAbortController  = null;

// ── URL builder ────────────────────────────────────────────────────────────

/**
 * Build the weather fetch URL for the current environment.
 * Production → Vercel serverless proxy (hides the API key).
 * Local dev  → direct WeatherAPI call.
 * @param {string} query - city name or "lat,lon"
 * @returns {string}
 */
function buildWeatherUrl(query) {
    if (IS_PRODUCTION) {
        return `/api/weather?q=${encodeURIComponent(query)}&days=6&aqi=yes`;
    }
    return `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(query)}&days=6&aqi=yes&alerts=no`;
}

/**
 * Build the search/autocomplete URL for the current environment.
 * @param {string} query
 * @returns {string}
 */
function buildSearchUrl(query) {
    if (IS_PRODUCTION) {
        return `/api/search?q=${encodeURIComponent(query)}`;
    }
    return `${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`;
}

// ── fetchWeather ───────────────────────────────────────────────────────────

/**
 * Fetch current weather + 5-day forecast.
 * Aborts in-flight requests, checks cache, records search history.
 *
 * @param {string}   query - city name or "lat,lon"
 * @param {object}   callbacks
 * @param {Function} callbacks.onStart   - called when a real network request begins
 * @param {Function} callbacks.onData    - called with the full API response object
 * @param {Function} callbacks.onError   - called with a human-readable error string
 * @param {Function} callbacks.onFinally - always called after fetch completes
 */
export async function fetchWeather(query, { onStart, onData, onError, onFinally } = {}) {
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    if (location.protocol === 'file:' && !API_KEY && !isTest) {
        onError?.('Local testing: add your API key to src/api.js');
        return;
    }

    // Cancel any in-flight weather request
    if (weatherAbortController) weatherAbortController.abort();
    weatherAbortController = new AbortController();

    // Serve from cache if fresh
    const cacheKey = `weather:${query.toLowerCase()}`;
    const cached   = appCache.get(cacheKey);
    if (cached) {
        onData?.(cached);
        return;
    }

    onStart?.();

    try {
        const res = await fetch(buildWeatherUrl(query), {
            signal: weatherAbortController.signal,
        });

        const fromCache = res.headers.get('sw-from-cache') === 'true';
        const timestamp = res.headers.get('sw-timestamp') || '';

        if (!res.ok) {
            if (res.status === 403) {
                throw new Error('API quota reached. Try again later.');
            }
            const body = await res.json().catch(() => null);
            if (res.status === 400 || res.status === 404) {
                throw new Error('City not found. Try a different name.');
            }
            throw new Error(body?.error?.message || 'City not found. Try a different name.');
        }

        const data = await res.json();

        // Populate in-memory cache
        appCache.set(cacheKey, data, WEATHER_TTL);

        // Persist search history
        if (data.location) {
            recordSearch(data.location.name, data.location.country, data.location.region);
        }

        // Show/hide offline banner based on SW header
        if (fromCache) {
            showOfflineBanner(timestamp);
        } else {
            hideOfflineBanner();
        }

        onData?.(data);
    } catch (err) {
        if (err.name === 'AbortError') return; // Cancelled — silent

        const msg = err.message === 'Failed to fetch' && navigator.onLine === false
            ? "You're offline. Showing cached data."
            : err.message === 'Failed to fetch'
                ? 'City not found. Try a different name.'
            : err.message;

        onError?.(msg);
    } finally {
        onFinally?.();
    }
}


// ── fetchSuggestions ───────────────────────────────────────────────────────

/**
 * Fetch autocomplete city suggestions, merged with local search history.
 * Aborts previous in-flight search request.
 *
 * @param {string}   query
 * @param {object}   callbacks
 * @param {Function} callbacks.onResults  - called with merged array of city objects
 * @param {Function} callbacks.onError    - called when both API and history are empty
 */
export async function fetchSuggestions(query, { onResults, onError } = {}) {
    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    try {
        // Check cache first
        const cacheKey  = `search:${query.toLowerCase()}`;
        const cached    = appCache.get(cacheKey);
        let   apiResults;

        if (cached) {
            apiResults = cached;
        } else {
            const res = await fetch(buildSearchUrl(query), {
                signal: searchAbortController.signal,
            });
            if (!res.ok) {
                if (res.status === 403) {
                    throw new Error('API quota reached. Try again later.');
                }
                throw new Error('Search failed');
            }
            apiResults = await res.json();
            appCache.set(cacheKey, apiResults, SEARCH_TTL);
        }

        const historyMatches = getHistoryMatches(query);
        const merged         = _mergeResults(historyMatches, apiResults);

        onResults?.(merged);
    } catch (err) {
        if (err.name === 'AbortError') return;

        console.error('Autocomplete error:', err);

        // Graceful degradation: show history even if API fails
        const historyMatches = getHistoryMatches(query);
        const isQuotaError = err.message === 'API quota reached. Try again later.';

        if (historyMatches.length > 0 && !isQuotaError) {
            onResults?.(historyMatches.map(h => ({ ...h, _fromHistory: true })));
        } else {
            onError?.(err.message);
        }
    }
}

// ── Private helpers ────────────────────────────────────────────────────────

/**
 * Merge history matches (tagged) with API results, deduplicating by name+country.
 * Order: history (by frequency) → India → rest.
 */
function _mergeResults(historyMatches, apiResults) {
    const merged = [];
    const seen   = new Set();

    // History items first (tagged so UI can render clock icon + badge)
    historyMatches.forEach(h => {
        const key = `${h.name}|${h.country}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push({ ...h, _fromHistory: true });
        }
    });

    // API results (de-duplicated)
    apiResults.forEach(city => {
        const key = `${city.name}|${city.country}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(city);
        }
    });

    // Sort: history first → India → rest
    merged.sort((a, b) => {
        if (a._fromHistory && !b._fromHistory) return -1;
        if (!a._fromHistory && b._fromHistory) return  1;
        if (a._fromHistory && b._fromHistory)  return (b.count || 0) - (a.count || 0);
        if (a.country === 'India' && b.country !== 'India') return -1;
        if (a.country !== 'India' && b.country === 'India') return  1;
        return 0;
    });

    return merged;
}
