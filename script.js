// RevengeBench site script — leaderboard chart/table, carousel, theme toggle.

// ─────────────────────────────────────────────────────────────────────────
// Chart.js plugin
// ─────────────────────────────────────────────────────────────────────────
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let performanceChart = null;
let detailedChart = null;

// ─────────────────────────────────────────────────────────────────────────
// Model-family icons rendered inside each bar
// ─────────────────────────────────────────────────────────────────────────
const FAMILY_ICONS = {
    GPT:      'assets/icons/chatgpt.svg',
    Gemma:    'assets/icons/gemma.svg',
    DeepSeek: 'assets/icons/ds.svg',
    Grok:     'assets/icons/grok-dark.svg',
    Qwen:     'assets/icons/qwen.svg',
    Kimi:     'assets/icons/kimi.svg',
    GLM:      'assets/icons/zai.svg'
};
const ICON_DROP_PATHS = { 'ds.svg': new Set([0]) };
// Per-family visual scale — some marks have generous internal padding and
// need to be drawn larger to feel optically equal to the rest.
const ICON_SCALE = { Gemma: 1.35, DeepSeek: 1.45, GLM: 0.75 };

function modelFamily(name) {
    const lower = name.toLowerCase();
    for (const fam of Object.keys(FAMILY_ICONS)) {
        if (lower.startsWith(fam.toLowerCase())) return fam;
    }
    return null;
}

const iconCache = new Map();
const iconFetchCache = new Map();

async function fetchSvg(url) {
    if (iconFetchCache.has(url)) return iconFetchCache.get(url);
    const res = await fetch(url);
    const text = await res.text();
    iconFetchCache.set(url, text);
    return text;
}

async function loadIcon(family, color) {
    const cacheKey = `${family}:${color}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

    const url = FAMILY_ICONS[family];
    if (!url) return null;

    const raw = await fetchSvg(url);
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
    const svg = doc.documentElement;

    const fileName = url.split('/').pop();
    const drop = ICON_DROP_PATHS[fileName];
    if (drop) {
        const paths = Array.from(svg.querySelectorAll('path'));
        [...drop].sort((a, b) => b - a).forEach(i => paths[i]?.remove());
    }

    svg.querySelectorAll('path, g, circle, rect, polygon').forEach(el => {
        const fill = (el.getAttribute('fill') || '').toLowerCase();
        if (fill === 'none') return;
        el.setAttribute('fill', color);
    });
    svg.setAttribute('fill', color);

    const serialized = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
    iconCache.set(cacheKey, img);
    return img;
}

async function preloadIcons(color) {
    await Promise.all(Object.keys(FAMILY_ICONS).map(f => loadIcon(f, color).catch(() => null)));
}

const modelIconPlugin = {
    id: 'modelIcons',
    afterDatasetsDraw(chart, _args, opts) {
        const { ctx } = chart;
        const labels = chart.data.labels;
        const meta = chart.getDatasetMeta(0);
        const color = opts?.color || '#fff';

        labels.forEach((label, i) => {
            const family = modelFamily(label);
            if (!family) return;
            const img = iconCache.get(`${family}:${color}`);
            if (!img) return;
            const bar = meta.data[i];
            if (!bar) return;

            const barHeight = bar.height ?? 24;
            const baseSize = Math.min(barHeight * 0.75, 30);
            const size = baseSize * (ICON_SCALE[family] ?? 1);
            const centerX = bar.base + 12 + baseSize / 2;
            const x = centerX - size / 2;
            const y = bar.y - size / 2;
            ctx.drawImage(img, x, y, size, size);
        });
    }
};

Chart.register(modelIconPlugin);

// ─────────────────────────────────────────────────────────────────────────
// Hamburger menu
// ─────────────────────────────────────────────────────────────────────────
const hamburgerBtn = document.getElementById('hamburger-btn');
const navLinks = document.getElementById('nav-links');

if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        navLinks.classList.toggle('open');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburgerBtn.classList.remove('active');
            navLinks.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (!hamburgerBtn.contains(e.target) && !navLinks.contains(e.target)) {
            hamburgerBtn.classList.remove('active');
            navLinks.classList.remove('open');
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Theme toggle
// ─────────────────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;
const savedTheme = localStorage.getItem('theme') || 'light';
htmlEl.setAttribute('data-theme', savedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = htmlEl.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        htmlEl.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        preloadIcons(themeTokens().bg).then(rerenderCharts);
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Theme tokens pulled from CSS custom properties so charts follow the theme.
// ─────────────────────────────────────────────────────────────────────────
function themeTokens() {
    const cs = getComputedStyle(htmlEl);
    return {
        text:    cs.getPropertyValue('--text-primary').trim()     || '#222',
        muted:   cs.getPropertyValue('--text-secondary').trim()   || '#666',
        grid:    cs.getPropertyValue('--border-color').trim()     || '#e5e5e5',
        bg:      cs.getPropertyValue('--bg-primary').trim()       || '#fff',
        accent:  cs.getPropertyValue('--accent-primary').trim()   || '#222',
        accent2: cs.getPropertyValue('--accent-secondary').trim() || '#222'
    };
}

function calculateFontSizes(canvas) {
    const w = canvas?.offsetWidth || window.innerWidth;
    if (w < 480)  return { tick: 20, title: 19, label: 19 };
    if (w < 768)  return { tick: 21, title: 21, label: 21 };
    if (w < 1024) return { tick: 23, title: 24, label: 23 };
    return { tick: 24, title: 26, label: 25 };
}

// ─────────────────────────────────────────────────────────────────────────
// Leaderboard table
// ─────────────────────────────────────────────────────────────────────────
function populateLeaderboard() {
    const tbody = document.getElementById('leaderboard-data');
    if (!tbody) return;
    tbody.innerHTML = '';

    leaderboardData.forEach(row => {
        const tr = document.createElement('tr');
        const arenaCells = arenas.map(a =>
            `<td class="arena-col">${row.scores[a.key].toFixed(0)}</td>`
        ).join('');
        tr.innerHTML =
            `<td class="rank-cell">${row.rank}</td>` +
            `<td class="model-cell">${row.name}</td>` +
            `<td class="avg-cell"><strong>${row.avg.toFixed(1)}</strong></td>` +
            arenaCells;
        tbody.appendChild(tr);
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Aggregate chart (one bar per model, averaged across arenas)
// ─────────────────────────────────────────────────────────────────────────
function sizeChartWrapper(canvas, rowCount) {
    const wrapper = canvas.parentElement;
    if (wrapper) {
        const h = Math.max(rowCount * 48 + 90, 440);
        wrapper.style.height = `${h}px`;
    }
}

function createAggregateChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    if (performanceChart) performanceChart.destroy();

    const tokens = themeTokens();
    const fonts = calculateFontSizes(canvas);

    // Descending — best at top, worst at bottom (Chart.js renders first category at top of y-axis).
    const sorted = [...leaderboardData].sort((a, b) => b.avg - a.avg);
    const labels = sorted.map(r => r.name);
    const data = sorted.map(r => r.avg);
    sizeChartWrapper(canvas, sorted.length);

    performanceChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Δ (%)',
                data,
                backgroundColor: tokens.text,
                borderColor: tokens.text,
                borderWidth: 0,
                barPercentage: 0.95,
                categoryPercentage: 0.85
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                datalabels: {
                    color: ctx => ctx.dataset.data[ctx.dataIndex] < 15 ? tokens.text : tokens.bg,
                    anchor: 'end',
                    align: ctx => ctx.dataset.data[ctx.dataIndex] < 15 ? 'end' : 'start',
                    offset: 8,
                    font: { weight: 500, size: fonts.tick },
                    formatter: v => `${Math.round(v)}%`
                },
                modelIcons: { color: tokens.bg }
            },
            scales: {
                x: { min: 0, max: 85, display: false },
                y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: tokens.text, font: { size: fonts.tick, weight: 500 } }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Per-arena detailed chart
// ─────────────────────────────────────────────────────────────────────────
let currentArena = 'battlesnake';

function createDetailedChart(arenaKey) {
    const canvas = document.getElementById('detailedChart');
    if (!canvas) return;
    if (detailedChart) detailedChart.destroy();

    const tokens = themeTokens();
    const fonts = calculateFontSizes(canvas);

    const sorted = [...leaderboardData].sort((a, b) => b.scores[arenaKey] - a.scores[arenaKey]);
    const labels = sorted.map(r => r.name);
    const data = sorted.map(r => r.scores[arenaKey]);
    sizeChartWrapper(canvas, sorted.length);

    detailedChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Δ (%)',
                data,
                backgroundColor: tokens.text,
                borderColor: tokens.text,
                borderWidth: 0,
                barPercentage: 0.95,
                categoryPercentage: 0.85
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                datalabels: {
                    color: ctx => ctx.dataset.data[ctx.dataIndex] < 15 ? tokens.text : tokens.bg,
                    anchor: 'end',
                    align: ctx => ctx.dataset.data[ctx.dataIndex] < 15 ? 'end' : 'start',
                    offset: 8,
                    font: { weight: 500, size: fonts.tick },
                    formatter: v => `${Math.round(v)}%`
                },
                modelIcons: { color: tokens.bg }
            },
            scales: {
                x: { min: 0, max: 85, display: false },
                y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: tokens.text, font: { size: fonts.tick, weight: 500 } }
                }
            }
        }
    });
}

function arenaLabel(key) {
    return arenas.find(a => a.key === key)?.name || key;
}

function rerenderCharts() {
    createAggregateChart();
    createDetailedChart(currentArena);
}

// ─────────────────────────────────────────────────────────────────────────
// Custom dropdown (arena selector, Elo tier selector)
// ─────────────────────────────────────────────────────────────────────────
function bindDropdown(displayEl, optionsEl, onSelect) {
    if (!displayEl || !optionsEl) return;
    const dropdown = displayEl.closest('.custom-dropdown');

    displayEl.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.custom-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    });

    optionsEl.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.addEventListener('click', () => {
            optionsEl.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            displayEl.textContent = opt.textContent;
            dropdown.classList.remove('open');
            onSelect(opt.dataset.value);
        });
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
});

// Per-arena tabs
const arenaTabs = document.querySelectorAll('.arena-tab');
arenaTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        arenaTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentArena = tab.dataset.arena;
        createDetailedChart(currentArena);
    });
});

bindDropdown(
    document.getElementById('elo-tier-display'),
    document.getElementById('elo-tier-options'),
    () => { /* no-op for v1; wires up when real data lands */ }
);

// ─────────────────────────────────────────────────────────────────────────
// Findings carousel
// ─────────────────────────────────────────────────────────────────────────
const carousel = document.querySelector('.findings-carousel');
if (carousel) {
    const slides = carousel.querySelectorAll('.finding-slide');
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const dots = carousel.querySelector('.carousel-dots');
    let idx = 0;

    const show = (i) => {
        idx = (i + slides.length) % slides.length;
        slides.forEach((s, j) => s.classList.toggle('active', j === idx));
        dots?.querySelectorAll('.carousel-dot').forEach((d, j) => d.classList.toggle('active', j === idx));
    };

    if (slides.length <= 1) {
        prevBtn?.style.setProperty('display', 'none');
        nextBtn?.style.setProperty('display', 'none');
        dots?.style.setProperty('display', 'none');
    } else {
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Slide ${i + 1}`);
            dot.addEventListener('click', () => show(i));
            dots.appendChild(dot);
        });
        prevBtn.addEventListener('click', () => show(idx - 1));
        nextBtn.addEventListener('click', () => show(idx + 1));
        document.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft')  show(idx - 1);
            if (e.key === 'ArrowRight') show(idx + 1);
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Citation copy
// ─────────────────────────────────────────────────────────────────────────
const copyBtn = document.getElementById('copy-citation');
if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
        const text = document.querySelector('.citation-text').textContent;
        try {
            await navigator.clipboard.writeText(text);
            const original = copyBtn.innerHTML;
            copyBtn.innerHTML = '✓ Copied';
            setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
        } catch (e) {
            console.error('Clipboard write failed:', e);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Navbar logo fade
// ─────────────────────────────────────────────────────────────────────────
const logo = document.querySelector('.logo');
const hero = document.querySelector('.hero');
if (logo && hero) {
    const update = () => {
        const heroBottom = hero.getBoundingClientRect().bottom;
        logo.classList.toggle('visible', heroBottom <= 64);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
}

// ─────────────────────────────────────────────────────────────────────────
// Resize: refresh chart fonts
// ─────────────────────────────────────────────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => rerenderCharts(), 200);
});

// ─────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────
loadScoresData()
    .then(() => preloadIcons(themeTokens().bg))
    .then(() => {
        populateLeaderboard();
        rerenderCharts();
    })
    .catch(err => {
        console.error('Failed to load scores.json:', err);
        const tbody = document.getElementById('leaderboard-data');
        if (tbody) {
            tbody.innerHTML =
                `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-secondary)">
                 Failed to load leaderboard data — check the console.</td></tr>`;
        }
    });
