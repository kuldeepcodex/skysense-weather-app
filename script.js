/**
 * script.js — Entry point (ES Module)
 *
 * Responsibilities:
 *  1. Wire up all DOM event listeners
 *  2. Coordinate API calls → UI renders
 *  3. Handle unit-toggle logic (reads state, triggers re-render)
 *  4. Boot the app on DOMContentLoaded
 *
 * All business logic lives in src/*.js modules.
 */

import { currentUnit, setCurrentUnit, lastWeatherData, getSearchHistory, recordSearch, clearSearchHistory } from './src/state.js';

import { fetchWeather, fetchSuggestions }                         from './src/api.js';
import { debounce }                                               from './src/utils.js';
import {
    renderCurrentWeather,
    renderForecast,
    renderHourly,
    renderSuggestions,
    highlightSuggestion,
    showLoading,
    showToast,
    hideToast,
    hdTabHourly,
    hdTabDaily,
    hdPanelHourly,
    hdPanelDaily,
    suggestionsDropdown,
    activeSuggestionIdx,
    setActiveSuggestionIdx,
    focusWeatherSection,
} from './src/ui.js';

// ── DOM refs (entry-point-only) ────────────────────────────────────────────

const weatherSection     = document.getElementById('weather-section');
const hourlyDailySection = document.getElementById('hourly-daily-section');
const cityInput          = document.getElementById('city-input');
const searchBtn          = document.getElementById('search-btn');
const locationBtn        = document.getElementById('location-btn');
const hamburgerBtn       = document.getElementById('hamburger-btn');
const mainNav            = document.getElementById('main-nav');
const emptyState         = document.getElementById('empty-state');

// ── Unit toggle ────────────────────────────────────────────────────────────

function setUnit(unit) {
    setCurrentUnit(unit);

    // Sync button aria / active class
    document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
        const isActive = btn.dataset.unit === unit;
        btn.classList.toggle('unit-toggle__btn--active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
        if (isActive) {
            btn.classList.add('unit-toggle__btn--bump');
            setTimeout(() => btn.classList.remove('unit-toggle__btn--bump'), 220);
        }
    });

    // Re-render current data with the new unit
    if (lastWeatherData) {
        renderCurrentWeather(lastWeatherData);
        renderForecast(lastWeatherData.forecast.forecastday);
        renderHourly(lastWeatherData.forecast.forecastday, lastWeatherData.location.localtime);
    }
}

// ── Search helpers ─────────────────────────────────────────────────────────

function doWeatherFetch(query) {
    if (emptyState) emptyState.hidden = true;
    weatherSection.hidden = false;
    hourlyDailySection.hidden = false;
    hideToast();

    fetchWeather(query, {
        onStart:   () => showLoading(true),
        onData:    (data) => {
            renderCurrentWeather(data);
            renderForecast(data.forecast.forecastday);
            renderHourly(data.forecast.forecastday, data.location.localtime);

            // Record in history (Task 10)
            const { name, country, region } = data.location;
            recordSearch(name, country, region);

            // Move focus to results so keyboard/SR users don't have to re-navigate
            focusWeatherSection();
        },

        onError:   (msg) => {
            showToast(msg, 'error');
            if (!lastWeatherData && emptyState) emptyState.hidden = false;
        },
        onFinally: ()    => showLoading(false),
    });
}

function doSuggestionFetch(query) {
    const input = document.getElementById('city-input');
    suggestionsDropdown.innerHTML = '<div class="suggestion-loading" role="status" aria-live="polite">Searching…</div>';
    suggestionsDropdown.hidden = false;
    if (input) input.setAttribute('aria-expanded', 'true');

    fetchSuggestions(query, {
        onResults: (cities) => renderSuggestions(cities, (cityName) => doWeatherFetch(cityName)),
        onError:   (msg)    => {
            if (msg === 'API quota reached. Try again later.') {
                showToast(msg, 'error');
                suggestionsDropdown.hidden = true;
            } else {
                suggestionsDropdown.innerHTML = '<div class="suggestion-empty" role="status">No cities found</div>';
            }
        },
    });
}

function showHistory() {
    const history = getSearchHistory().map(h => ({ ...h, _fromHistory: true }));
    if (history.length > 0) {
        renderSuggestions(
            history,
            (cityName) => doWeatherFetch(cityName),
            () => {
                clearSearchHistory();
                suggestionsDropdown.hidden = true;
                cityInput.setAttribute('aria-expanded', 'false');
            }
        );
    } else {
        suggestionsDropdown.hidden = true;
        cityInput.setAttribute('aria-expanded', 'false');
    }
}


// ── Event listeners ────────────────────────────────────────────────────────

// Search button
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) doWeatherFetch(city);
});

// Geolocation button
locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'error');
        return;
    }
    showToast('Detecting your location…', 'info');
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => doWeatherFetch(`${coords.latitude},${coords.longitude}`),
        ()           => showToast('Location access denied. Search manually.', 'info'),
    );
});

// Unit toggle buttons
document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    if (btn.dataset.unit) {
        btn.addEventListener('click', () => setUnit(btn.dataset.unit));
    }
});

// Autocomplete: debounced input — 350 ms idle before firing the API call
const debouncedSuggestionFetch = debounce(doSuggestionFetch, 350);

cityInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    setActiveSuggestionIdx(-1);

    if (val.length < 1) {
        debouncedSuggestionFetch.cancel(); // abort any pending call immediately
        showHistory();
        return;
    }


    debouncedSuggestionFetch(val);
});

// Show history on focus if empty
cityInput.addEventListener('focus', () => {
    if (cityInput.value.trim().length === 0) {
        showHistory();
    }
});


// Autocomplete: keyboard navigation
cityInput.addEventListener('keydown', (e) => {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIdx(Math.min(activeSuggestionIdx + 1, items.length - 1));
        highlightSuggestion(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIdx(Math.max(activeSuggestionIdx - 1, 0));
        highlightSuggestion(items);
    } else if (e.key === 'Enter') {
        if (activeSuggestionIdx >= 0 && items[activeSuggestionIdx]) {
            items[activeSuggestionIdx].click();
        } else {
            const city = cityInput.value.trim();
            if (city) {
                suggestionsDropdown.hidden = true;
                cityInput.setAttribute('aria-expanded', 'false');
                cityInput.removeAttribute('aria-activedescendant');
                setActiveSuggestionIdx(-1);
                doWeatherFetch(city);
            }
        }
    } else if (e.key === 'Escape') {
        debouncedSuggestionFetch.cancel(); // don't fire a search after Escape
        suggestionsDropdown.hidden = true;
        cityInput.setAttribute('aria-expanded', 'false');
        cityInput.removeAttribute('aria-activedescendant');
        setActiveSuggestionIdx(-1);
    }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
        suggestionsDropdown.hidden = true;
        cityInput.setAttribute('aria-expanded', 'false');
        cityInput.removeAttribute('aria-activedescendant');
        setActiveSuggestionIdx(-1);
    }
});

// Mobile hamburger menu logic
if (hamburgerBtn && mainNav) {
    const closeMenu = () => {
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('open');
    };

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = hamburgerBtn.getAttribute('aria-expanded') === 'true';
        hamburgerBtn.setAttribute('aria-expanded', !isExpanded);
        mainNav.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!mainNav.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });

    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });
}

// Hourly / Daily tab switching — roving tabindex + aria-selected
function activateTab(tabToActivate, tabToDeactivate, panelToShow, panelToHide) {
    if (tabToActivate.classList.contains('hd-tab--active')) return;

    tabToActivate.classList.add('hd-tab--active');
    tabToActivate.setAttribute('aria-selected', 'true');
    tabToActivate.removeAttribute('tabindex');

    tabToDeactivate.classList.remove('hd-tab--active');
    tabToDeactivate.setAttribute('aria-selected', 'false');
    tabToDeactivate.setAttribute('tabindex', '-1');

    panelToHide.classList.add('hd-panel--exiting');

    setTimeout(() => {
        panelToHide.hidden = true;
        panelToHide.classList.add('hd-panel--hidden');
        panelToHide.classList.remove('hd-panel--exiting');

        panelToShow.hidden = false;
        panelToShow.classList.remove('hd-panel--hidden');
        panelToShow.classList.add('hd-panel--entering');

        setTimeout(() => {
            panelToShow.classList.remove('hd-panel--entering');
        }, 220);
    }, 180);
}

hdTabHourly.addEventListener('click', () => activateTab(hdTabHourly, hdTabDaily, hdPanelHourly, hdPanelDaily));
hdTabDaily.addEventListener('click',  () => activateTab(hdTabDaily, hdTabHourly, hdPanelDaily, hdPanelHourly));

// Arrow-key navigation inside the tablist (ARIA keyboard pattern)
hdTabHourly.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { hdTabDaily.focus(); }
});
hdTabDaily.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { hdTabHourly.focus(); }
});

// ── Boot ───────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    // Apply persisted unit preference to toggle buttons without triggering a re-render
    document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
        if (!btn.dataset.unit) return;
        const isActive = btn.dataset.unit === currentUnit;
        btn.classList.toggle('unit-toggle__btn--active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });

    // Auto-fetch weather for user's current location on page load
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (emptyState) emptyState.hidden = true;
                doWeatherFetch(`${coords.latitude},${coords.longitude}`);
            },
            () => {
                // Location denied — show empty state so user can search manually
                if (emptyState) emptyState.hidden = false;
            },
            { timeout: 8000 }
        );
    } else {
        if (emptyState) emptyState.hidden = false;
    }
});
