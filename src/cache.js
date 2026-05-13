/**
 * src/cache.js
 * Map-based TTL cache with per-namespace expiry, invalidation, and size reporting.
 *
 * TTL policy (per task spec):
 *   WEATHER_TTL   — 10 minutes  (current conditions change quickly)
 *   FORECAST_TTL  — 30 minutes  (daily forecast data is slower moving)
 *   SEARCH_TTL    — 60 minutes  (city name results are effectively static)
 *
 * Usage:
 *   import { appCache, WEATHER_TTL, FORECAST_TTL, SEARCH_TTL } from './cache.js';
 *   appCache.set('weather:london', data, WEATHER_TTL);
 *   const cached = appCache.get('weather:london'); // null if expired
 */

// ── TTL constants ──────────────────────────────────────────────────────────

/** Current conditions: refresh every 10 minutes */
export const WEATHER_TTL  = 10 * 60 * 1000;

/** Forecast data: refresh every 30 minutes */
export const FORECAST_TTL = 30 * 60 * 1000;

/** Autocomplete city names: refresh every 60 minutes */
export const SEARCH_TTL   = 60 * 60 * 1000;

// ── TTLCache class ─────────────────────────────────────────────────────────

/**
 * In-memory TTL cache backed by a Map.
 *
 * Entry lifecycle:
 *   set()  → stores { data, expiresAt }
 *   get()  → returns data if fresh, otherwise evicts + returns null
 *   has()  → non-destructive freshness check
 *
 * Key convention: "<namespace>:<normalised-query>"
 *   e.g.  "weather:new delhi"  |  "search:lon"
 */
export class TTLCache {
    constructor() {
        /** @type {Map<string, { data: any, expiresAt: number, setAt: number }>} */
        this._store = new Map();
    }

    // ── Write ────────────────────────────────────────────────────────────

    /**
     * Store a value with an expiry.
     * @param {string} key
     * @param {*}      data
     * @param {number} ttlMs - time-to-live in milliseconds
     */
    set(key, data, ttlMs) {
        this._store.set(key, {
            data,
            setAt:     Date.now(),
            expiresAt: Date.now() + ttlMs,
        });
    }

    // ── Read ─────────────────────────────────────────────────────────────

    /**
     * Return cached data if still fresh, otherwise evict the entry and return null.
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.data;
    }

    /**
     * Check freshness without evicting on miss.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        const entry = this._store.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return false;
        }
        return true;
    }

    // ── Metadata ──────────────────────────────────────────────────────────

    /**
     * How many seconds remain before this entry expires.
     * Returns 0 if already expired or missing.
     * @param {string} key
     * @returns {number}
     */
    ttlRemaining(key) {
        const entry = this._store.get(key);
        if (!entry) return 0;
        const remaining = entry.expiresAt - Date.now();
        return Math.max(0, Math.round(remaining / 1000));
    }

    /** Number of live entries currently in the cache. */
    get size() {
        this._evictExpired();
        return this._store.size;
    }

    // ── Invalidation ──────────────────────────────────────────────────────

    /**
     * Remove a specific entry immediately.
     * @param {string} key
     * @returns {boolean} true if an entry was removed
     */
    invalidate(key) {
        return this._store.delete(key);
    }

    /**
     * Remove all entries whose keys start with a given prefix.
     * Useful for invalidating a whole namespace: invalidateNamespace('weather:').
     * @param {string} prefix
     * @returns {number} number of entries removed
     */
    invalidateNamespace(prefix) {
        let count = 0;
        for (const key of this._store.keys()) {
            if (key.startsWith(prefix)) {
                this._store.delete(key);
                count++;
            }
        }
        return count;
    }

    /** Remove all entries regardless of expiry. */
    clear() {
        this._store.clear();
    }

    // ── Private ───────────────────────────────────────────────────────────

    /** Sweep expired entries. Called lazily by `.size`. */
    _evictExpired() {
        const now = Date.now();
        for (const [key, entry] of this._store) {
            if (now > entry.expiresAt) this._store.delete(key);
        }
    }
}

// ── Singleton ──────────────────────────────────────────────────────────────

/**
 * Shared application cache instance.
 * Import this wherever caching is needed — do not construct new TTLCache instances.
 *
 * @type {TTLCache}
 */
export const appCache = new TTLCache();
