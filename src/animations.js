/**
 * src/animations.js
 * Complete 10-scene weather animation system.
 * Canvas 2D for particles (rain, snow, stars, lightning).
 * CSS keyframes for clouds, sun, fog, UI transitions.
 * Single shared requestAnimationFrame loop.
 */

// ── Condition code groups ──────────────────────────────────────────────────

const CODES = {
    rain:    [1063,1150,1153,1180,1183,1186,1189,1192,1195,1240,1243,1246,
              1069,1072,1168,1171,1198,1201,1204,1207,1237,1249,1252,1261,1264],
    snow:    [1066,1114,1117,1210,1213,1216,1219,1222,1225,1255,1258],
    thunder: [1087,1273,1276,1279,1282],
    mist:    [1030,1135,1147],
    cloudy:  [1003,1006,1009],
};

// ── Shared RAF loop ────────────────────────────────────────────────────────

let rafId = null;
let activeUpdateFn = null;

function startAnimationLoop(updateFn) {
    stopAnimationLoop();
    activeUpdateFn = updateFn;
    function tick(ts) { updateFn(ts); rafId = requestAnimationFrame(tick); }
    rafId = requestAnimationFrame(tick);
}

function stopAnimationLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// Pause on hidden tab
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAnimationLoop();
    } else if (activeUpdateFn) {
        startAnimationLoop(activeUpdateFn);
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function shouldAnimate() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobile() {
    return window.innerWidth < 768;
}

function particleCount(base) {
    return Math.floor(isMobile() ? base * 0.4 : base);
}

function setupCanvas(container) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    const dpr = window.devicePixelRatio || 1;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);
    return { canvas, ctx, w, h };
}

// ── Sky gradient system ───────────────────────────────────────────────────

function applyGradient(stage, code, isDay) {
    let colors;
    if (code === 1000) {
        colors = isDay ? ['#0a4fa8','#1a7bc4','#87ceeb'] : ['#020408','#070d1a','#0d1528'];
    } else if (CODES.thunder.includes(code)) {
        colors = isDay ? ['#0d1117','#111520','#161b28'] : ['#060810','#080c14','#0a1018'];
    } else if (CODES.snow.includes(code)) {
        colors = isDay ? ['#b0bec5','#cfd8dc','#eceff1'] : ['#1a237e','#283593','#303f9f'];
    } else if (CODES.rain.includes(code)) {
        colors = isDay ? ['#263238','#37474f','#455a64'] : ['#0d1117','#111822','#16202e'];
    } else if (CODES.mist.includes(code)) {
        colors = isDay ? ['#546e7a','#607d8b','#78909c'] : ['#1c2530','#253040','#2e3d50'];
    } else if (CODES.cloudy.includes(code)) {
        colors = isDay ? ['#3d5a6a','#546e7a','#6b8694'] : ['#111820','#1a2530','#243040'];
    } else {
        colors = isDay ? ['#1565c0','#1e88e5','#64b5f6'] : ['#0d1117','#111822','#16202e'];
    }
    stage.style.background = `linear-gradient(to bottom, ${colors[0]}, ${colors[1]}, ${colors[2]})`;
    stage.style.transition = 'background 1.2s ease';
}

// ── Particle classes ──────────────────────────────────────────────────────

class Star {
    constructor(w, h) {
        this.x = Math.random() * w;
        this.y = Math.random() * h * 0.75;
        this.radius = Math.random() * 1.5 + 0.3;
        this.twinkleDur = 2000 + Math.random() * 3000;
        this.phase = Math.random() * Math.PI * 2;
        // 20% colored stars
        const r = Math.random();
        this.color = r < 0.1 ? [255,240,200] : r < 0.2 ? [200,220,255] : [255,255,255];
    }
    draw(ctx, time) {
        const op = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((time / this.twinkleDur) * Math.PI * 2 + this.phase));
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${op})`;
        ctx.fill();
    }
}

class RainDrop {
    constructor(w, h, heavy) {
        this.w = w; this.h = h; this.heavy = heavy;
        this.reset(true);
    }
    reset(init) {
        this.x = Math.random() * (this.w + 200) - 100;
        this.y = init ? Math.random() * this.h : -30;
        this.len = this.heavy ? 25 + Math.random() * 20 : 15 + Math.random() * 10;
        this.vy = this.heavy ? 14 + Math.random() * 8 : 8 + Math.random() * 6;
        this.vx = this.vy * 0.26;
        this.opacity = this.heavy ? 0.5 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y > this.h + 30) this.reset(false);
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx * 2, this.y - this.len);
        ctx.strokeStyle = `rgba(174,214,241,${this.opacity})`;
        ctx.lineWidth = this.heavy ? 1.5 : 1;
        ctx.stroke();
    }
}

class Snowflake {
    constructor(w, h, windMult) {
        this.w = w; this.h = h; this.windMult = windMult;
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.radius = 1 + Math.random() * 3.5;
        this.vy = 0.5 + Math.random() * 1.5;
        this.phase = Math.random() * Math.PI * 2;
        this.opacity = 0.5 + Math.random() * 0.4;
    }
    update(time) {
        this.y += this.vy;
        this.x += Math.sin(time / 1200 + this.phase) * 0.7 * this.windMult;
        if (this.y > this.h + 10) { this.y = -10; this.x = Math.random() * this.w; }
        if (this.x < -10) this.x = this.w + 10;
        if (this.x > this.w + 10) this.x = -10;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
        ctx.fill();
    }
}

// ── Lightning generator ──────────────────────────────────────────────────

function drawLightning(ctx, x1, y1, x2, y2, depth) {
    if (depth === 0) return;
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 80;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 30;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx, my);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * depth})`;
    ctx.lineWidth = depth * 0.8;
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(150,200,255,0.8)';
    ctx.stroke();
    if (depth > 1 && Math.random() > 0.5) {
        const bx = mx + (Math.random() - 0.5) * 100;
        const by = my + 60 + Math.random() * 80;
        drawLightning(ctx, mx, my, bx, by, depth - 1);
    }
    drawLightning(ctx, x1, y1, mx, my, depth - 1);
    drawLightning(ctx, mx, my, x2, y2, depth - 1);
}

// ── CSS element builders ─────────────────────────────────────────────────

function buildClouds(count, dark) {
    let html = '';
    const cls = dark ? 'anim-cloud anim-cloud--dark' : 'anim-cloud';
    for (let i = 0; i < count; i++) {
        const w = 100 + Math.random() * 120;
        const h = 30 + Math.random() * 25;
        const top = 10 + Math.random() * 60;
        const dur = 20 + Math.random() * 35;
        const delay = -(Math.random() * dur);
        const opacity = dark ? 0.7 + Math.random() * 0.2 : 0.6 + Math.random() * 0.3;
        html += `<div class="${cls}" style="width:${w}px;height:${h}px;top:${top}%;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${opacity}"></div>`;
    }
    return html;
}

function buildSun(opacity = 1) {
    return `<div class="anim-sun-wrap" style="opacity:${opacity}">
        <div class="anim-sun-rays"></div>
        <div class="anim-sun"></div>
        <div class="anim-lens-flare"></div>
    </div>`;
}

function buildMoon() {
    return `<div class="anim-moon"></div>`;
}

function buildFogLayers() {
    let html = '';
    for (let i = 0; i < 5; i++) {
        const bottom = 5 + i * 18;
        const dur = 15 + i * 5;
        const h = 40 + Math.random() * 40;
        const delay = -(Math.random() * dur);
        html += `<div class="anim-fog-layer" style="bottom:${bottom}%;height:${h}px;animation-duration:${dur}s;animation-delay:${delay}s"></div>`;
    }
    html += `<div class="anim-fog-ground"></div>`;
    return html;
}

// ── Scene implementations ────────────────────────────────────────────────

function sceneSunnyDay(contentEl, w, h) {
    contentEl.innerHTML = buildSun() + buildClouds(2, false);
    // No canvas needed for sunny day
    return null;
}

function sceneClearNight(contentEl, w, h) {
    contentEl.innerHTML = buildMoon();
    const { canvas, ctx } = setupCanvas(contentEl);
    const count = particleCount(150);
    const stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star(w, h));

    let lastShoot = 0;
    let shootX = 0, shootY = 0, shootActive = false, shootStart = 0;
    const nextShootInterval = () => 8000 + Math.random() * 7000;
    let shootInterval = nextShootInterval();

    return function update(time) {
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) s.draw(ctx, time);

        // Shooting star
        if (!shootActive && time - lastShoot > shootInterval) {
            shootActive = true;
            shootStart = time;
            shootX = Math.random() * w * 0.6 + w * 0.1;
            shootY = Math.random() * h * 0.3;
        }
        if (shootActive) {
            const elapsed = time - shootStart;
            const progress = elapsed / 300;
            if (progress > 1) {
                shootActive = false;
                lastShoot = time;
                shootInterval = nextShootInterval();
            } else {
                const sx = shootX + progress * 200;
                const sy = shootY + progress * 120;
                const tailLen = 40;
                const grad = ctx.createLinearGradient(sx, sy, sx - tailLen * 0.7, sy - tailLen * 0.4);
                grad.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - progress)})`);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - tailLen * 0.7, sy - tailLen * 0.4);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    };
}

function scenePartlyCloudy(contentEl, isDay) {
    contentEl.innerHTML = (isDay ? buildSun(0.6) : buildMoon()) + buildClouds(4, false);
    return null;
}

function sceneCloudy(contentEl, isDay) {
    contentEl.innerHTML = buildClouds(isDay ? 6 : 5, true);
    return null;
}

function sceneRainLight(contentEl, w, h) {
    contentEl.innerHTML = buildClouds(3, true);
    const { canvas, ctx } = setupCanvas(contentEl);
    const count = particleCount(100);
    const drops = [];
    for (let i = 0; i < count; i++) drops.push(new RainDrop(w, h, false));

    return function update() {
        ctx.clearRect(0, 0, w, h);
        for (const d of drops) { d.update(); d.draw(ctx); }
    };
}

function sceneRainHeavy(contentEl, w, h) {
    contentEl.innerHTML = buildClouds(4, true) + '<div class="anim-rain-mist"></div>';
    const { canvas, ctx } = setupCanvas(contentEl);
    const count = particleCount(350);
    const drops = [];
    for (let i = 0; i < count; i++) drops.push(new RainDrop(w, h, true));

    // Wind gust state
    let gustActive = false, gustStart = 0, lastGust = 0;

    return function update(time) {
        // Wind gust every ~5s
        if (!gustActive && time - lastGust > 5000) {
            gustActive = true; gustStart = time;
        }
        let gustMult = 1;
        if (gustActive) {
            const elapsed = time - gustStart;
            if (elapsed > 1500) { gustActive = false; lastGust = time; }
            else { gustMult = 1 + 2 * Math.sin((elapsed / 1500) * Math.PI); }
        }

        ctx.clearRect(0, 0, w, h);
        for (const d of drops) {
            d.x += (gustMult - 1) * 3;
            d.update();
            d.draw(ctx);
        }
    };
}

function sceneThunderstorm(contentEl, w, h) {
    contentEl.innerHTML = buildClouds(4, true) + '<div class="anim-sky-flash"></div>';
    const { canvas, ctx } = setupCanvas(contentEl);
    const count = particleCount(400);
    const drops = [];
    for (let i = 0; i < count; i++) drops.push(new RainDrop(w, h, true));

    let lastBolt = 0;
    let boltActive = false, boltStart = 0;
    const nextBoltInterval = () => 2000 + Math.random() * 4000;
    let boltInterval = nextBoltInterval();
    let boltX = 0;
    const flashEl = contentEl.querySelector('.anim-sky-flash');

    return function update(time) {
        ctx.clearRect(0, 0, w, h);
        for (const d of drops) { d.update(); d.draw(ctx); }

        // Lightning bolt
        if (!boltActive && time - lastBolt > boltInterval) {
            boltActive = true; boltStart = time;
            boltX = w * 0.2 + Math.random() * w * 0.6;
            if (flashEl) { flashEl.style.animation = 'none'; void flashEl.offsetWidth; flashEl.style.animation = 'skyFlash 0.5s ease'; }
        }
        if (boltActive) {
            const elapsed = time - boltStart;
            // Double flash: 0-80ms ON, 80-140ms OFF, 140-220ms ON
            const showBolt = (elapsed < 80) || (elapsed > 140 && elapsed < 220);
            if (showBolt) {
                ctx.save();
                drawLightning(ctx, boltX, 0, boltX + (Math.random()-0.5)*40, h * 0.7, 4);
                ctx.restore();
                ctx.shadowBlur = 0;
            }
            if (elapsed > 300) {
                boltActive = false; lastBolt = time;
                boltInterval = nextBoltInterval();
            }
        }
    };
}

function sceneSnow(contentEl, w, h, windKmh) {
    const windMult = windKmh > 20 ? 3 : 1;
    contentEl.innerHTML = buildClouds(3, false) + '<div class="anim-snow-accumulation"></div>';
    const { canvas, ctx } = setupCanvas(contentEl);
    const count = particleCount(120);
    const flakes = [];
    for (let i = 0; i < count; i++) flakes.push(new Snowflake(w, h, windMult));

    return function update(time) {
        ctx.clearRect(0, 0, w, h);
        for (const f of flakes) { f.update(time); f.draw(ctx); }
    };
}

function sceneMist(contentEl) {
    contentEl.innerHTML = buildFogLayers();
    return null; // CSS only
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Build a cinematic animated scene inside the scene-stage div.
 * @param {number}  code  - WeatherAPI condition code
 * @param {number}  isDay - 1 (day) or 0 (night)
 * @param {Element} stageEl   - .scene-stage element (#weather-illustration)
 * @param {Element} contentEl - inner target (#scene-content)
 * @param {number}  [windKmh=0] - wind speed for drift intensity
 */
export function setWeatherIllustration(code, isDay, stageEl, contentEl, windKmh = 0) {
    // 1. Stop previous animation loop
    stopAnimationLoop();
    activeUpdateFn = null;

    // 2. Clear old scene
    stageEl.className = 'scene-stage';
    contentEl.innerHTML = '';

    // 3. Apply sky gradient
    applyGradient(stageEl, code, isDay);

    // 4. Check reduced motion — static gradient only
    if (!shouldAnimate()) return;

    // 5. Build scene
    const w = contentEl.offsetWidth || stageEl.offsetWidth;
    const h = contentEl.offsetHeight || stageEl.offsetHeight;
    let updateFn = null;

    if (code === 1000) {
        updateFn = isDay ? sceneSunnyDay(contentEl, w, h) : sceneClearNight(contentEl, w, h);
    } else if (CODES.thunder.includes(code)) {
        updateFn = sceneThunderstorm(contentEl, w, h);
    } else if (CODES.rain.includes(code)) {
        // Light vs heavy based on code
        const heavyCodes = [1192,1195,1243,1246,1201];
        updateFn = heavyCodes.includes(code)
            ? sceneRainHeavy(contentEl, w, h)
            : sceneRainLight(contentEl, w, h);
    } else if (CODES.snow.includes(code)) {
        updateFn = sceneSnow(contentEl, w, h, windKmh);
    } else if (CODES.mist.includes(code)) {
        sceneMist(contentEl);
    } else if (CODES.cloudy.includes(code)) {
        if (code === 1003) {
            scenePartlyCloudy(contentEl, isDay);
        } else {
            sceneCloudy(contentEl, isDay);
        }
    } else {
        sceneCloudy(contentEl, isDay);
    }

    // 6. Start RAF loop if scene has canvas particles
    if (updateFn) {
        startAnimationLoop(updateFn);
    }

    // 7. Scene enter animation
    contentEl.style.animation = 'none';
    void contentEl.offsetWidth;
    contentEl.style.animation = 'sceneEnter 600ms ease forwards';
}

/**
 * Update the full-screen background animations based on weather code.
 * @param {number}  code
 * @param {number}  isDay
 * @param {Element} bgEl - #bg-animations element
 */
export function setBackgroundAnimation(code, isDay, bgEl) {
    bgEl.innerHTML = '';
    document.body.className = '';

    if (!shouldAnimate()) return;

    if (code === 1000) {
        document.body.classList.add(isDay ? 'weather-clear-day' : 'weather-clear-night');
        if (!isDay) {
            let html = '';
            const starCount = isMobile() ? 16 : 40;
            for (let i = 0; i < starCount; i++) {
                const left = Math.random() * 120 - 10;
                const top = Math.random() * 80;
                const size = 1 + Math.random() * 2;
                const delay = Math.random() * 5;
                const dur = 2 + Math.random() * 3;
                html += `<div class="bg-star" style="position:absolute;left:${left}vw;top:${top}vh;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s;"></div>`;
            }
            bgEl.innerHTML = html;
        }
    } else if (CODES.rain.includes(code) || CODES.thunder.includes(code)) {
        document.body.classList.add(isDay ? 'weather-rain-day' : 'weather-rain-night');
        const dropCount = isMobile() ? 16 : 40;
        let html = '';
        for (let i = 0; i < dropCount; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 1.5;
            const dur = 0.5 + Math.random() * 0.5;
            html += `<div class="bg-drop" style="left:${left}vw;animation-delay:${delay}s;animation-duration:${dur}s;"></div>`;
        }
        bgEl.innerHTML = html;
    } else if (CODES.snow.includes(code)) {
        document.body.classList.add(isDay ? 'weather-snow-day' : 'weather-snow-night');
        const flakeCount = isMobile() ? 16 : 40;
        let html = '';
        for (let i = 0; i < flakeCount; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const dur = 3 + Math.random() * 5;
            const size = 3 + Math.random() * 6;
            html += `<div class="bg-flake" style="left:${left}vw;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s;"></div>`;
        }
        bgEl.innerHTML = html;
    } else if (CODES.cloudy.includes(code) || CODES.mist.includes(code)) {
        document.body.classList.add(isDay ? 'weather-cloudy-day' : 'weather-cloudy-night');
        bgEl.innerHTML = `
            <div class="bg-cloud" style="top:10%"></div>
            <div class="bg-cloud" style="top:40%;animation-delay:-20s;animation-duration:80s"></div>`;
    }
}
