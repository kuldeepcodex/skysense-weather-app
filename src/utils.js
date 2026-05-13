/**
 * src/utils.js
 * Pure stateless utility functions — no DOM access, no side effects.
 *
 * Caching utilities live in src/cache.js.
 */

// ── Date formatter ─────────────────────────────────────────────────────────

/**
 * Format an API date string → human-readable.
 * e.g. "2026-03-15 18:00" → "Saturday, 15 Mar 2026 · 6:00 PM"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        day:     'numeric',
        month:   'short',
        year:    'numeric',
        hour:    'numeric',
        minute:  '2-digit',
        hour12:  true,
    });
}

// ── Debounce ────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that delays invocation until after
 * `wait` milliseconds have elapsed since the last call.
 *
 * @template {(...args: any[]) => any} T
 * @param {T}      fn   - The function to debounce.
 * @param {number} wait - Delay in milliseconds (default 350ms).
 * @returns {T & { cancel: () => void }} Debounced function with a `.cancel()` escape hatch.
 *
 * @example
 * const debouncedSearch = debounce(fetchSuggestions, 350);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
export function debounce(fn, wait = 350) {
    let timerId;

    function debounced(...args) {
        clearTimeout(timerId);
        timerId = setTimeout(() => fn(...args), wait);
    }

    /** Cancel a pending invocation without calling the function. */
    debounced.cancel = () => clearTimeout(timerId);

    return debounced;
}
