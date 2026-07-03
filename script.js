// RevengeBench site script — leaderboard chart/table, carousel, theme toggle.

// ─────────────────────────────────────────────────────────────────────────
// Chart.js plugin
// ─────────────────────────────────────────────────────────────────────────
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let performanceChart = null;

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
    const setMenu = (open) => {
        hamburgerBtn.classList.toggle('active', open);
        navLinks.classList.toggle('active', open);
        hamburgerBtn.setAttribute('aria-expanded', String(open));
    };

    hamburgerBtn.addEventListener('click', () => {
        setMenu(!navLinks.classList.contains('active'));
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('click', (e) => {
        if (!hamburgerBtn.contains(e.target) && !navLinks.contains(e.target)) {
            setMenu(false);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Theme toggle
// ─────────────────────────────────────────────────────────────────────────
// The saved theme is applied by an inline script in <head> before first
// paint, so no flash correction is needed here.
const themeToggle = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

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
// Leaderboard chart (tabbed: "All" = averaged across arenas, or one arena)
// ─────────────────────────────────────────────────────────────────────────
function sizeChartWrapper(canvas, rowCount) {
    const wrapper = canvas.parentElement;
    if (wrapper) {
        const h = Math.max(rowCount * 48 + 90, 440);
        wrapper.style.height = `${h}px`;
    }
}

// view: 'all' = averaged across arenas; otherwise an arena key (per-arena breakdown).
let currentView = 'all';

function createChart(view) {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    if (performanceChart) performanceChart.destroy();

    const tokens = themeTokens();
    const fonts = calculateFontSizes(canvas);

    const valueOf = view === 'all' ? (r => r.avg) : (r => r.scores[view]);
    // Descending — best at top, worst at bottom (Chart.js renders first category at top of y-axis).
    const sorted = [...leaderboardData].sort((a, b) => valueOf(b) - valueOf(a));
    const labels = sorted.map(r => r.name);
    const data = sorted.map(valueOf);
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

function rerenderCharts() {
    createChart(currentView);
}

// ─────────────────────────────────────────────────────────────────────────
// ARIA tablist behavior: aria-selected + arrow-key nav. All tabs stay in
// the Tab order (no roving tabindex) so keyboard users can step through
// them directly.
// ─────────────────────────────────────────────────────────────────────────
function setupTablist(tabs, onActivate) {
    const list = Array.from(tabs);
    const select = (i) => {
        list.forEach((t, j) => {
            t.classList.toggle('active', j === i);
            t.setAttribute('aria-selected', j === i ? 'true' : 'false');
        });
        onActivate(i);
    };
    list.forEach((tab, i) => {
        tab.addEventListener('click', () => select(i));
        tab.addEventListener('keydown', (e) => {
            let j = null;
            if (e.key === 'ArrowRight') j = (i + 1) % list.length;
            else if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length;
            else if (e.key === 'Home') j = 0;
            else if (e.key === 'End') j = list.length - 1;
            if (j !== null) {
                e.preventDefault();
                select(j);
                list[j].focus();
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Leaderboard view tabs: "All" (averaged) + one per arena
// ─────────────────────────────────────────────────────────────────────────
const arenaTabs = document.querySelectorAll('.arena-tab');
setupTablist(arenaTabs, (i) => {
    currentView = arenaTabs[i].dataset.arena;  // 'all' or an arena key
    createChart(currentView);
});

// ─────────────────────────────────────────────────────────────────────────
// Arena card descriptions — pulled from config.js arenaDescriptions
// ─────────────────────────────────────────────────────────────────────────
document.querySelectorAll('.arena-card').forEach(card => {
    const key = card.dataset.arena;
    const desc = card.querySelector('.arena-desc');
    if (key && desc && arenaDescriptions[key]) {
        desc.textContent = arenaDescriptions[key];
    }
});

// ─────────────────────────────────────────────────────────────────────────
// Findings carousel
// ─────────────────────────────────────────────────────────────────────────
const carousel = document.querySelector('.findings-carousel');
if (carousel) {
    const slides = carousel.querySelectorAll('.finding-slide');
    const tabs = carousel.querySelectorAll('.findings-tab');

    setupTablist(tabs, (i) => {
        slides.forEach((s, j) => s.classList.toggle('active', j === i));
    });
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
const heroTitle = document.querySelector('.hero-title');
if (logo && hero && heroTitle) {
    const update = () => {
        const titleBottom = heroTitle.getBoundingClientRect().bottom;
        logo.classList.toggle('visible', titleBottom <= 64);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();

    logo.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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
        rerenderCharts();
    })
    .catch(err => {
        console.error('Failed to load scores.json:', err);
        const chart = document.querySelector('#leaderboard .leaderboard-chart');
        if (chart) {
            chart.innerHTML =
                `<p style="text-align:center;padding:24px;color:var(--text-secondary)">
                 Failed to load leaderboard data — check the console.</p>`;
        }
    });
