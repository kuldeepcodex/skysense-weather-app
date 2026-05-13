/**
 * src/ui.js
 * All DOM rendering: current weather, forecast, hourly, suggestions,
 * AQI badges, sun arc, wind compass, toast, and loading state.
 *
 * DOM elements are read once at module load and cached as module-level vars.
 * This module imports from state + animations; it never imports from api.js
 * (keeping the dependency graph clean).
 */

import { fmtTemp, fmtTempOnly, setLastWeatherData } from './state.js';
import { setWeatherIllustration, setBackgroundAnimation } from './animations.js';
import { formatDate } from './utils.js';

// Chart.js instance (destroyed + re-created on each weather fetch)
let precipChart = null;
let precipChartCanvas = null;


// ── DOM element cache ──────────────────────────────────────────────────────

const bgAnimations       = document.getElementById('bg-animations');
const weatherSection     = document.getElementById('weather-section');
const hourlyDailySection = document.getElementById('hourly-daily-section');
const hourlyScroll       = document.getElementById('hourly-scroll');

// Current weather card
const weatherCity        = document.getElementById('weather-city');
const weatherDate        = document.getElementById('weather-date');
const weatherTemp        = document.getElementById('weather-temp');
const weatherCondition   = document.getElementById('weather-condition');
const weatherFeels       = document.getElementById('weather-feels');
const weatherIllustration = document.getElementById('weather-illustration');

// Detail grid widgets
const widgetAqiIndex     = document.getElementById('widget-aqi-index');
const widgetPm25         = document.getElementById('widget-pm25');
const widgetPm10         = document.getElementById('widget-pm10');
const widgetSunrise      = document.getElementById('widget-sunrise');
const widgetSunset       = document.getElementById('widget-sunset');
const widgetMoonPhase    = document.getElementById('widget-moon-phase');
const widgetWindVal      = document.getElementById('widget-wind-val');
const widgetWindDir      = document.getElementById('widget-wind-dir');
const widgetWindGust     = document.getElementById('widget-wind-gust');
const widgetHumidity     = document.getElementById('widget-humidity');
const widgetDewpoint     = document.getElementById('widget-dewpoint');
const widgetVisibility   = document.getElementById('widget-visibility');
const widgetPressure     = document.getElementById('widget-pressure');
const widgetUv           = document.getElementById('widget-uv');
const widgetCloud        = document.getElementById('widget-cloud');
const widgetPrecip       = document.getElementById('widget-precip');
const widgetRainChance   = document.getElementById('widget-rain-chance');

// Forecast + toast + loader
const forecastGrid       = document.getElementById('forecast-grid');
const toastEl            = document.getElementById('toast');
const loaderWrap         = document.getElementById('loader-wrap');

// Hourly / daily tab elements
export const hdTabHourly  = document.getElementById('hd-tab-hourly');
export const hdTabDaily   = document.getElementById('hd-tab-daily');
export const hdPanelHourly = document.getElementById('hd-panel-hourly');
export const hdPanelDaily  = document.getElementById('hd-panel-daily');

// Search autocomplete
export const suggestionsDropdown = document.getElementById('suggestions-dropdown');

// ── Current weather card ───────────────────────────────────────────────────

/**
 * Populate the current-weather card and detail grid.
 * Also triggers scene illustration + background update.
 * @param {object} data - full WeatherAPI response
 */
export function renderCurrentWeather(data) {
    const { location, current } = data;

    // Persist for unit-toggle re-renders
    setLastWeatherData(data);

    // City & timestamp
    weatherCity.textContent = `${location.name}, ${location.country}`;
    weatherDate.textContent = formatDate(location.localtime);

    // Primary temps
    weatherTemp.textContent      = fmtTemp(current.temp_c);
    weatherCondition.textContent = current.condition.text;
    weatherFeels.textContent     = fmtTemp(current.feelslike_c);

    // Quick-stats overlay (always °C unit, no conversion needed for wind/UV)
    const humQ  = document.getElementById('weather-humidity-q');
    const windQ = document.getElementById('weather-wind-q');
    const uvQ   = document.getElementById('weather-uv-q');
    if (humQ)  humQ.textContent  = `${current.humidity}%`;
    if (windQ) windQ.textContent = `${current.wind_kph} km/h`;
    if (uvQ)   uvQ.textContent   = `UV ${current.uv}`;

    // ── Detail grid ──────────────────────────────────────────────────────

    // 1. Air Quality
    const aqi      = current.air_quality || {};
    const aqiLabels = ['','Good','Moderate','Unhealthy for Sensitive','Unhealthy','Very Unhealthy','Hazardous'];
    const aqiColors = ['','#00E400','#FFFF00','#FF7E00','#FF0000','#8F3F97','#7E0023'];
    
    const aqiIndex  = aqi['us-epa-index'] ?? 0;
    const aqiLabel  = aqiLabels[aqiIndex] || 'Unknown';
    const aqiColor  = aqiColors[aqiIndex] || '#aaa';
    const aqiPct    = ((aqiIndex / 6) * 100).toFixed(0);
    const pm25      = aqi.pm2_5?.toFixed(1) ?? '--';
    const pm10      = aqi.pm10?.toFixed(1)  ?? '--';

    if (widgetAqiIndex) {
        widgetAqiIndex.innerHTML = `
    <span style="display:inline-block;width:12px;height:12px;
      border-radius:50%;background:${aqiColor};
      margin-right:8px;vertical-align:middle;
      box-shadow:0 0 8px ${aqiColor}"></span>
    <span style="color:${aqiColor};font-size:1.4rem;font-weight:700">
      ${aqiLabel}
    </span>
    <div style="margin-top:10px;height:5px;border-radius:3px;
      background:rgba(255,255,255,0.1);overflow:hidden">
      <div style="height:100%;width:${aqiPct}%;
        background:${aqiColor};border-radius:3px;
        transition:width 0.6s ease"></div>
    </div>
    <div style="margin-top:10px;font-size:0.8rem;
      color:rgba(255,255,255,0.6)">
      PM2.5: <b style="color:#fff">${pm25}</b> µg/m³ &nbsp;|&nbsp;
      PM10: <b style="color:#fff">${pm10}</b> µg/m³
    </div>
  `;
    }
    
    // Clear the old PM elements since they're now in the widget-aqi-index
    if (widgetPm25) widgetPm25.textContent = '';
    if (widgetPm10) widgetPm10.textContent = '';

    // 2. Sun & Moon
    const sunrise   = data.forecast.forecastday[0].astro.sunrise;
    const sunset    = data.forecast.forecastday[0].astro.sunset;
    const moonPhase = data.forecast.forecastday[0].astro.moon_phase;
    const localtime = data.location.localtime;

    function toMins(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    }

    const nowMins     = (() => {
        const t = localtime.split(' ')[1];
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    })();
    const riseMins    = toMins(sunrise);
    const setMins     = toMins(sunset);
    const progress    = Math.max(0, Math.min(1, (nowMins - riseMins) / (setMins - riseMins)));
    
    const cx = 100, cy = 80, r = 65;
    const angle = Math.PI - progress * Math.PI;
    const dotX  = cx + r * Math.cos(angle);
    const dotY  = cy - r * Math.sin(angle);

    if (widgetSunrise) {
        widgetSunrise.innerHTML = `
    <svg viewBox="0 0 200 95" width="100%" style="overflow:visible;margin-bottom:8px">
      <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}"
        fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3"
        stroke-linecap="round"/>
      <path d="M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${dotX} ${dotY}"
        fill="none"
        stroke="url(#sunGrad)" stroke-width="3"
        stroke-linecap="round"/>
      <defs>
        <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF6B35"/>
          <stop offset="100%" stop-color="#FFD93D"/>
        </linearGradient>
      </defs>
      <circle cx="${dotX}" cy="${dotY}" r="7"
        fill="#FFD93D"
        filter="drop-shadow(0 0 6px rgba(255,217,61,0.9))"/>
      <text x="${cx-r}" y="${cy+18}" 
        font-size="10" fill="rgba(255,255,255,0.55)" 
        text-anchor="middle">${sunrise}</text>
      <text x="${cx+r}" y="${cy+18}" 
        font-size="10" fill="rgba(255,255,255,0.55)" 
        text-anchor="middle">${sunset}</text>
    </svg>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);
      text-align:center;margin-top:4px">
      🌙 ${moonPhase}
    </div>
  `;
    }
    
    if (widgetSunset) widgetSunset.textContent = '';
    if (widgetMoonPhase) widgetMoonPhase.textContent = '';

    // 3. Wind
    if (widgetWindVal)  widgetWindVal.textContent  = current.wind_kph;
    if (widgetWindDir)  widgetWindDir.innerHTML    = renderCompass(current.wind_degree, current.wind_dir);
    if (widgetWindGust) widgetWindGust.textContent = current.gust_kph;

    // 4. Moisture
    if (widgetHumidity)   widgetHumidity.textContent   = `${current.humidity}%`;
    if (widgetDewpoint)   widgetDewpoint.textContent   = fmtTemp(current.dewpoint_c);
    if (widgetVisibility) widgetVisibility.textContent = current.vis_km;

    // 5. Atmosphere
    if (widgetPressure) widgetPressure.textContent = current.pressure_mb;
    if (widgetUv)       widgetUv.textContent       = current.uv;
    if (widgetCloud)    widgetCloud.textContent    = `${current.cloud}%`;

    // 6. Precipitation
    if (widgetPrecip)     widgetPrecip.textContent     = current.precip_mm;
    const todayDay = data.forecast.forecastday[0].day;
    if (widgetRainChance) widgetRainChance.textContent =
        `${Math.max(todayDay.daily_chance_of_rain, todayDay.daily_chance_of_snow)}%`;

    // ── Animations ───────────────────────────────────────────────────────
    const stageEl   = weatherIllustration;
    const contentEl = document.getElementById('scene-content');
    setWeatherIllustration(current.condition.code, current.is_day, stageEl, contentEl);
    setBackgroundAnimation(current.condition.code, current.is_day, bgAnimations);

    // ── Reveal + focus ──────────────────────────────────────────────────────
    weatherSection.hidden = false;
    weatherSection.style.animation = 'none';
    void weatherSection.offsetWidth; // force reflow
    weatherSection.style.animation = 'fadeSlideUp .5s ease';
}

/**
 * Move keyboard + screen-reader focus to the weather results section.
 * Called by script.js after a successful API fetch so keyboard users
 * don't have to manually navigate past the search bar.
 */
export function focusWeatherSection() {
    if (!weatherSection.hidden) weatherSection.focus();
}

// ── Forecast cards ─────────────────────────────────────────────────────────

/**
 * Render the 5-day forecast cards (skips today).
 * @param {object[]} days - forecastday array from API
 */
export function renderForecast(days) {
    forecastGrid.innerHTML = '';
    const upcoming = days.slice(1, 6);

    upcoming.forEach(day => {
        const card = document.createElement('div');
        card.className = 'forecast-card glass-card';

        const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
        const hi      = fmtTempOnly(day.day.maxtemp_c);
        const lo      = fmtTempOnly(day.day.mintemp_c);
        const cond    = day.day.condition;

        card.innerHTML = `
            <p class="forecast-card__day">${dayName}</p>
            <img class="forecast-card__icon" src="https:${cond.icon}" alt="${cond.text}">
            <p class="forecast-card__temp">${hi} <span>/ ${lo}</span></p>
            <p class="forecast-card__cond">${cond.text}</p>`;

        forecastGrid.appendChild(card);
    });

    hourlyDailySection.hidden = false;
    hourlyDailySection.style.animation = 'none';
    void hourlyDailySection.offsetWidth;
    hourlyDailySection.style.animation = 'fadeSlideUp .55s ease';
}

// ── Hourly scroll ──────────────────────────────────────────────────────────

/**
 * Render the next 24 hours of hourly forecast data.
 * @param {object[]} forecastDays - Array of forecastday objects
 * @param {string}   localtime   - The location's local time, e.g. "2026-03-15 19:30"
 */
export function renderHourly(forecastDays, localtime) {
    hourlyScroll.innerHTML = '';

    const now         = new Date(localtime.replace(' ', 'T'));
    let   allHours    = [];
    forecastDays.forEach(day => {
        if (day.hour) allHours = allHours.concat(day.hour);
    });

    const futureHours = allHours
        .filter(h => new Date(h.time.replace(' ', 'T')) >= now)
        .slice(0, 24);

    if (futureHours.length === 0) return;

    futureHours.forEach((h, idx) => {
        const hTime     = new Date(h.time.replace(' ', 'T'));
        const timeLabel = idx === 0
            ? 'Now'
            : hTime.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

        const rainPct  = h.chance_of_rain || 0;
        const snowPct  = h.chance_of_snow || 0;
        const precipMm = h.precip_mm      || 0;
        const willRain = h.will_it_rain   === 1;
        const willSnow = h.will_it_snow   === 1;

        let rainLabel, rainDim;
        if      (rainPct > 0)              { rainLabel = `${rainPct}%`;    rainDim = false; }
        else if (snowPct > 0)              { rainLabel = `${snowPct}%`;    rainDim = false; }
        else if (willRain && precipMm > 0) { rainLabel = `${precipMm}mm`; rainDim = false; }
        else if (willSnow && precipMm > 0) { rainLabel = `${precipMm}mm`; rainDim = false; }
        else if (precipMm > 0)             { rainLabel = `${precipMm}mm`; rainDim = false; }
        else                               { rainLabel = '0%';            rainDim = true;  }

        const item = document.createElement('div');
        item.className = 'hourly-item';
        item.setAttribute('role', 'group');
        item.setAttribute('aria-label', `${timeLabel}: ${fmtTempOnly(h.temp_c)}, ${h.condition.text}, precipitation ${rainLabel}`);
        item.innerHTML = `
            <span class="hourly-item__time" aria-hidden="true">${timeLabel}</span>
            <img class="hourly-item__icon" src="https:${h.condition.icon}" alt="${h.condition.text}">
            <span class="hourly-item__temp" aria-hidden="true">${fmtTempOnly(h.temp_c)}</span>
            <div class="hourly-item__rain" style="${rainDim ? 'opacity:0.35' : ''}" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
                </svg>
                ${rainLabel}
            </div>`;

        hourlyScroll.appendChild(item);
    });

    // Draw the precipitation chart below the cards
    renderPrecipChart(futureHours);
}

// ── Precipitation bar chart (Chart.js) ────────────────────────────────────

/**
 * Render / update the precipitation-probability bar chart.
 * Called automatically by renderHourly().
 * @param {object[]} hours - filtered future hourly data (max 24)
 */
export function renderPrecipChart(hours) {
    const canvas = document.getElementById('precip-chart');
    if (!canvas) return;

    precipChartCanvas = canvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.offsetWidth || 600;
    const h = canvas.offsetHeight || 120;
    canvas.width = w;
    canvas.height = h;

    const padding = 40;
    const chartW = w - 2 * padding;
    const chartH = h - 2 * padding;
    const barW = Math.max(2, (chartW / hours.length) - 2);
    const spacing = chartW / hours.length;

    const rainData = hours.map(h => h.chance_of_rain || 0);
    const snowData = hours.map(h => h.chance_of_snow || 0);
    const data = rainData.map((r, i) => Math.max(r, snowData[i]));

    // Clear background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, w, h);

    // Draw Y-axis gridlines and labels
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.fillStyle = 'rgba(232,240,248,0.5)';
    ctx.font = '10px Poppins';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 100; i += 25) {
        const y = h - padding - (i / 100) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding - 5, y);
        ctx.lineTo(w - padding, y);
        ctx.stroke();
        ctx.fillText(i + '%', padding - 10, y);
    }

    // Draw Y-axis
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.stroke();

    // Draw bars
    data.forEach((val, idx) => {
        const barH = (val / 100) * chartH;
        const x = padding + idx * spacing + (spacing - barW) / 2;
        const y = h - padding - barH;

        // Color based on intensity
        let color = 'rgba(255,255,255,0.10)';
        if (val > 0 && val < 25) color = 'rgba(79,195,247,0.35)';
        else if (val >= 25 && val < 50) color = 'rgba(79,195,247,0.55)';
        else if (val >= 50 && val < 75) color = 'rgba(79,195,247,0.75)';
        else if (val >= 75) color = 'rgba(3,155,229,0.90)';

        ctx.fillStyle = color;
        ctx.fillRect(x, y, barW, barH);
        ctx.strokeStyle = 'rgba(79,195,247,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, barH);
    });

    // Draw X-axis labels (every 3rd)
    ctx.fillStyle = 'rgba(232,240,248,0.6)';
    ctx.font = '10px Poppins';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    hours.forEach((h, idx) => {
        if (idx % 3 === 0) {
            let label = 'Now';
            if (idx > 0) {
                const d = new Date(h.time.replace(' ', 'T'));
                label = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            }
            const x = padding + idx * spacing + spacing / 2;
            ctx.fillText(label, x, h - padding + 10);
        }
    });
}

/** Resize the precipitation chart canvas when tab is shown */
export function resizePrecipChart() {
    if (precipChartCanvas) {
        // Trigger a redraw by setting width
        const parent = precipChartCanvas.parentElement;
        if (parent) {
            precipChartCanvas.width = parent.offsetWidth - 10;
        }
    }
}

// ── Autocomplete suggestions ───────────────────────────────────────────────

/** Tracks the currently highlighted suggestion index */
export let activeSuggestionIdx = -1;

/**
 * Set the active suggestion index (called by script.js keyboard handler).
 * @param {number} idx
 */
export function setActiveSuggestionIdx(idx) {
    activeSuggestionIdx = idx;
}

/**
 * Highlight the suggestion at activeSuggestionIdx.
 * @param {NodeList|Array} items
 */
export function highlightSuggestion(items) {
    const input = document.getElementById('city-input');
    items.forEach((el, i) => {
        const isActive = i === activeSuggestionIdx;
        el.classList.toggle('active', isActive);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (items[activeSuggestionIdx]) {
        items[activeSuggestionIdx].scrollIntoView({ block: 'nearest' });
        if (input) input.setAttribute('aria-activedescendant', items[activeSuggestionIdx].id);
    } else {
        if (input) input.removeAttribute('aria-activedescendant');
    }
}

/**
 * Render the autocomplete dropdown items.
 * @param {object[]} cities   - merged city list from api.js
 * @param {Function} onSelect - callback(cityName) when a suggestion is clicked
 * @param {Function} [onClear] - callback when "Clear History" is clicked
 */
export function renderSuggestions(cities, onSelect, onClear) {

    suggestionsDropdown.innerHTML = '';
    activeSuggestionIdx = -1;

    const input = document.getElementById('city-input');
    if (!cities || cities.length === 0) {
        suggestionsDropdown.innerHTML = '<div class="suggestion-empty" role="option" aria-disabled="true">No cities found</div>';
        suggestionsDropdown.hidden = false;
        if (input) input.setAttribute('aria-expanded', 'true');
        return;
    }

    cities.forEach((city, idx) => {
        const item      = document.createElement('div');
        item.className  = 'suggestion-item';
        item.dataset.index = idx;
        item.id = `opt-${idx}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        const region    = city.region ? `, ${city.region}` : '';
        const isIndia   = city.country === 'India';
        const isHistory = city._fromHistory;

        const icon = isHistory
            ? `<svg class="suggestion-item__icon suggestion-item__icon--history" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
               </svg>`
            : `<svg class="suggestion-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true" focusable="false">
                    <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
               </svg>`;

        const badgeLabel = isHistory ? ` (searched ${city.count} time${city.count === 1 ? '' : 's'})` : '';
        const badge = isHistory
            ? `<span class="suggestion-item__badge" aria-hidden="true">×${city.count}</span>`
            : '';

        // Build accessible label for screen readers: "London, England, United Kingdom"
        const fullLabel = `${city.name}${region}, ${city.country}${badgeLabel}`;
        item.setAttribute('aria-label', fullLabel);

        item.innerHTML = `
            ${icon}
            <div class="suggestion-item__text" aria-hidden="true">
                <strong>${city.name}</strong>${region}
                <span class="suggestion-item__country ${isIndia ? 'suggestion-item__country--india' : ''}">${city.country}</span>
            </div>
            ${badge}`;

        item.addEventListener('click', () => {
            const input = document.getElementById('city-input');
            if (input) {
                input.value = `${city.name}${region}`;
                input.setAttribute('aria-expanded', 'false');
                input.removeAttribute('aria-activedescendant');
            }
            suggestionsDropdown.hidden = true;
            activeSuggestionIdx = -1;
            onSelect?.(city.name);
        });

        item.addEventListener('mouseenter', () => {
            activeSuggestionIdx = idx;
            highlightSuggestion(suggestionsDropdown.querySelectorAll('.suggestion-item'));
        });

        suggestionsDropdown.appendChild(item);
    });

    // Add "Clear History" option if any item is from history and onClear is provided
    const hasHistory = cities.some(c => c._fromHistory);
    if (hasHistory && onClear) {
        const clearBtn = document.createElement('div');
        clearBtn.className = 'suggestion-clear';
        clearBtn.setAttribute('role', 'button');
        clearBtn.setAttribute('tabindex', '0');
        clearBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Clear Search History`;
        
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClear();
        });
        
        // Handle keyboard for the clear button
        clearBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClear();
            }
        });

        suggestionsDropdown.appendChild(clearBtn);
    }

    suggestionsDropdown.hidden = false;

    const inputEl = document.getElementById('city-input');
    if (inputEl) {
        inputEl.setAttribute('aria-expanded', 'true');
        // Announce count to screen reader via the listbox label
        suggestionsDropdown.setAttribute('aria-label',
            `City suggestions: ${cities.length} result${cities.length === 1 ? '' : 's'}`);
    }
}

// ── Widget renderers ───────────────────────────────────────────────────────

/**
 * AQI badge with a colored dot.
 * @param {string} label - e.g. 'Good'
 * @param {number} index - EPA index 1-6
 * @returns {string} HTML string
 */
export function renderAqiBadge(label, index) {
    return `<span class="aqi-badge" data-aqi="${index}" aria-label="Air Quality: ${label}">
        <span class="aqi-badge__dot" aria-hidden="true"></span>
        <span>${label}</span>
    </span>`;
}

/**
 * Minimal SVG sun-arc showing sunrise→sunset progress.
 * @param {object} astro    - { sunrise, sunset } strings
 * @param {string} localtime
 * @returns {string} HTML string
 */
export function renderSunArc(astro, localtime) {
    const parseTime = t => {
        if (!t) return 0;
        const [timePart, period] = t.trim().split(' ');
        let [h, m] = timePart.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };

    const nowParts = localtime.split(' ')[1]?.split(':').map(Number) || [12, 0];
    const nowMin   = nowParts[0] * 60 + (nowParts[1] || 0);
    const riseMin  = parseTime(astro.sunrise);
    const setMin   = parseTime(astro.sunset);
    const daySpan  = Math.max(setMin - riseMin, 1);
    const progress = Math.min(Math.max((nowMin - riseMin) / daySpan, 0), 1);

    const totalDash  = 160;
    const dashOffset = totalDash - progress * totalDash;
    const angle = Math.PI * progress;
    const cx    = 10 + 80 * progress;
    const cy    = 55 - 40 * Math.sin(angle);

    return `
    <div class="sun-arc-wrap" aria-label="Sunrise ${astro.sunrise}, Sunset ${astro.sunset}">
        <svg class="sun-arc-svg" viewBox="0 0 100 65" fill="none" role="img" aria-hidden="true">
            <path class="sun-arc-track"    d="M10 55 A 40 40 0 0 1 90 55" stroke-width="3" fill="none"/>
            <path class="sun-arc-progress" d="M10 55 A 40 40 0 0 1 90 55" stroke-width="3" fill="none"
                style="stroke-dashoffset:${dashOffset.toFixed(1)}"/>
            <circle class="sun-arc-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"/>
            <text class="sun-arc-label" x="5"  y="64" font-size="7">${astro.sunrise}</text>
            <text class="sun-arc-label" x="72" y="64" font-size="7">${astro.sunset}</text>
        </svg>
    </div>
    <div>${astro.sunrise}</div>`;
}

/**
 * Miniature SVG compass with rotating needle.
 * @param {number} degrees - wind direction in degrees
 * @param {string} dir     - cardinal label e.g. "NNE"
 * @param {number} kph     - wind speed
 * @param {number} gust    - gust speed
 * @returns {string} HTML string
 */
export function renderCompass(degrees, dir) {
    const safeDegs = isNaN(degrees) ? 0 : degrees;
    return `
    <div class="wind-compass-wrap" aria-label="Wind direction: ${dir}">
        <svg class="wind-compass-svg" viewBox="0 0 120 120" role="img" aria-hidden="true">
            <circle class="compass-ring" cx="60" cy="60" r="50" stroke-width="2" fill="none" stroke="rgba(255,255,255,0.15)"/>
            <text class="compass-label" x="60" y="18" font-size="11" font-weight="bold" text-anchor="middle" fill="rgba(255,255,255,0.6)">N</text>
            <text class="compass-label" x="60" y="108" font-size="11" text-anchor="middle" fill="rgba(255,255,255,0.4)">S</text>
            <text class="compass-label" x="12" y="65" font-size="11" text-anchor="middle" fill="rgba(255,255,255,0.4)">W</text>
            <text class="compass-label" x="108" y="65" font-size="11" text-anchor="middle" fill="rgba(255,255,255,0.4)">E</text>
            <g transform="rotate(${safeDegs}, 60, 60)">
                <line x1="60" y1="80" x2="60" y2="60" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
                <line x1="60" y1="20" x2="60" y2="60" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="60" cy="60" r="4" fill="white"/>
            </g>
        </svg>
        <div style="font-size: 0.85rem; font-weight: 600; margin-top: 6px; color: rgba(255,255,255,0.9)">${dir}</div>
    </div>`;
}

// ── Toast & loader ─────────────────────────────────────────────────────────

/**
 * Show / hide the loading skeleton.
 * @param {boolean} visible
 */
export function showLoading(visible) {
    document.body.classList.toggle('is-loading', visible);
    if (loaderWrap) loaderWrap.hidden = true;
}

/**
 * Show a toast notification.
 * @param {string}           msg
 * @param {'error'|'info'}   type
 */
export function showToast(msg, type = 'info') {
    toastEl.innerHTML = `<p class="toast__msg toast__msg--${type}">${msg}</p>`;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(hideToast, 5000);
}

/** Dismiss the toast immediately. */
export function hideToast() {
    toastEl.innerHTML = '';
    toastEl.classList.remove('show');
}
