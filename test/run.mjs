// Прогон юзерскрипта против фикстур в настоящем Chromium.
//
// Зачем фикстуры, а не живой сайт: из этой песочницы rbc.ru отдаёт 401,
// сеть закрыта. Фикстуры собраны из реальных имён классов, снятых с живых
// страниц через мост к браузеру, — они фиксируют мои допущения о разметке.
// Отдельная проверка `npm run selectors` сверяет эти допущения с сайтом.
//
// Запуск:  node test/run.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const userscript = readFileSync(resolve(here, '../rbc-4k-enhancer.user.js'), 'utf8');
const guard = readFileSync(resolve(here, 'guard.js'), 'utf8');
const fixtures = {
    article: readFileSync(resolve(here, 'fixture-article.html'), 'utf8'),
    feed: readFileSync(resolve(here, 'fixture-feed.html'), 'utf8'),
};

// Отдаём фикстуры по настоящим адресам rbc.ru, а не через file://.
// Так location.pathname совпадает с боевым, работает history.pushState,
// и определение режима страницы проверяется тем же кодом, что в бою.
const isArticleUrl = (p) => /^\/[a-z0-9_-]+(\/[a-z0-9_-]+)?\/\d{2}\/\d{2}\/\d{4}\/[0-9a-z]+/i.test(p)
    || /^\/rbcfreenews\/[0-9a-z]+/i.test(p);

const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(isArticleUrl(path) ? fixtures.article : fixtures.feed);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// Юзерскрипт рассчитан на песочницу Tampermonkey — подменяем GM_*.
const harness = `
    window.GM_addStyle = (css) => { const s=document.createElement('style'); s.textContent=css; (document.head||document.documentElement).appendChild(s); return s; };
    const __store = {};
    window.GM_getValue = (k,d) => (k in __store ? __store[k] : d);
    window.GM_setValue = (k,v) => { __store[k]=v; };
`;

const results = [];
function check(scenario, name, ok, detail = '') {
    results.push({ scenario, name, ok, detail });
}

async function scenario(browser, { title, url, before, body }) {
    const page = await browser.newPage({ viewport: { width: 1680, height: 900 } });
    const consoleErrors = [];
    page.on('console', (m) => { const t=m.text(); if (m.type()==='error' && !/ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|fonts\.googleapis|fonts\.gstatic/.test(t)) consoleErrors.push(t); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    await page.addInitScript({ content: guard });
    await page.addInitScript({ content: harness });
    if (before) await page.addInitScript({ content: before });
    await page.addInitScript({ content: userscript });

    await page.goto(origin + url);
    await page.waitForTimeout(700);

    await body(page, (name, ok, detail) => check(title, name, ok, detail));

    const g = await page.evaluate(() => window.__tmGuard);
    check(title, 'не удаляет узлы сайта из DOM', g.siteNodeRemovals.length === 0,
        g.siteNodeRemovals.slice(0, 3).join(', '));
    check(title, 'нет ошибок в консоли', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
    check(title, 'нет необработанных исключений', g.errors.length === 0, g.errors.slice(0, 2).join(' | '));

    await page.close();
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// ── Сценарий 1: страница статьи, прямой заход ────────────────────────────
await scenario(browser, {
    title: 'Статья',
    url: '/politics/29/07/2026/6a69dadf9a79474d5e9b9c30',
    body: async (page, t) => {
        t('режим статьи включён', await page.evaluate(() => document.documentElement.classList.contains('tm-rbc-article')));
        t('шапка скрыта', await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')).display === 'none'));
        t('кнопка «Назад» на месте', await page.evaluate(() => !!document.getElementById('tm-rbc-back')));
        t('кнопка темы на месте', await page.evaluate(() => !!document.getElementById('tm-rbc-dark-toggle')));
        t('время чтения посчитано', await page.evaluate(() => !!document.querySelector('.tm-rbc-readtime')));
        t('полоса прогресса создана', await page.evaluate(() => !!document.getElementById('tm-rbc-progress')));
        t('реклама скрыта', await page.evaluate(() =>
            [...document.querySelectorAll('.fox-tail,[id^="yandex_rtb_"]')].every(e => e.getBoundingClientRect().height === 0)));
        t('врезка между абзацами скрыта', await page.evaluate(() =>
            getComputedStyle(document.querySelector('.base-card-template')).display === 'none'));
        t('промо «в Максе» скрыто', await page.evaluate(() =>
            getComputedStyle(document.querySelector('.card-wrapper')).display === 'none'));
        t('следующая статья скрыта, но осталась в DOM', await page.evaluate(() => {
            const next = document.querySelector('[data-role="next-article"]');
            return !!next && getComputedStyle(next).display === 'none';
        }));
        t('шрифт применён к тексту', await page.evaluate(() =>
            /Golos Text/.test(getComputedStyle(document.querySelector('p.paragraph')).fontFamily)));
        t('переносов по слогам нет', await page.evaluate(() =>
            getComputedStyle(document.querySelector('p.paragraph')).hyphens !== 'auto'));

        // Полоса прогресса: 0 наверху, растёт монотонно, 100 внизу
        const track = await page.evaluate(async () => {
            const bar = document.getElementById('tm-rbc-progress');
            if (!bar) return [];
            const read = () => parseFloat(bar.style.width) || 0;
            const out = [];
            const max = document.documentElement.scrollHeight - innerHeight;
            for (let i = 0; i <= 10; i++) {
                window.scrollTo(0, Math.round((max * i) / 10));
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                out.push(+read().toFixed(1));
            }
            return out;
        });
        // Наверху полоса показывает ровно ту часть текста, что уже попала на
        // экран, — это и есть «заполняется с самого начала». Требовать здесь
        // жёсткий ноль неправильно: тогда первые экраны прокрутки полоса
        // стояла бы на месте, с чего и началась жалоба.
        t('наверху полоса заполнена меньше чем на треть', track.length > 0 && track[0] < 33, 'наверху: ' + track[0] + '%');
        t('полоса реагирует на первую же прокрутку', track.length > 1 && track[1] > track[0], track[0] + '% → ' + track[1] + '%');
        t('прогресс растёт монотонно', track.length > 0 && track.every((v, i) => i === 0 || v >= track[i - 1]), track.join(' → '));
        t('прогресс доходит до 100%', track.length > 0 && track[track.length - 1] >= 99.5, 'внизу: ' + track[track.length - 1] + '%');
        const jumps = track.map((v, i) => (i ? v - track[i - 1] : 0));
        t('прогресс растёт плавно, без рывка 0→100', Math.max(...jumps) <= 40, 'макс. скачок: ' + Math.max(...jumps).toFixed(1) + ' п.п.');

        // Буря мутаций — это и есть «моргает при прокрутке»
        const storm = await page.evaluate(async () => {
            window.__tmStartMutationCount();
            const max = document.documentElement.scrollHeight - innerHeight;
            for (let i = 0; i < 6; i++) {
                window.scrollTo(0, (max * i) / 6);
                await new Promise(r => setTimeout(r, 120));
            }
            await new Promise(r => setTimeout(r, 500));
            return window.__tmGuard.mutationsAfterSettle;
        });
        t('нет бури мутаций при прокрутке', storm < 50, storm + ' мутаций');
    },
});

// ── Сценарий 2: тёмная тема на статье ────────────────────────────────────
await scenario(browser, {
    title: 'Статья, тёмная тема',
    url: '/politics/29/07/2026/6a69dadf9a79474d5e9b9c30',
    before: 'window.matchMedia = (q) => ({ matches: /dark/.test(q), media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });',
    body: async (page, t) => {
        t('тёмная тема включилась по системной', await page.evaluate(() => document.documentElement.classList.contains('tm-dark')));
        const contrast = await page.evaluate(() => {
            const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const bg = lum(getComputedStyle(document.body).backgroundColor);
            const pick = (sel) => { const e = document.querySelector(sel); if (!e) return null; const f = lum(getComputedStyle(e).color); const [a, b2] = [Math.max(f, bg), Math.min(f, bg)]; return +(((a + 0.05) / (b2 + 0.05))).toFixed(2); };
            return { paragraph: pick('p.paragraph'), lead: pick('.article-entry-leadText'), person: pick('.person-block-description'), tab: pick('.tab-panel-item') };
        });
        for (const [k, v] of Object.entries(contrast)) {
            t(`контраст ${k} ≥ 4.5:1`, v !== null && v >= 4.5, v + ':1');
        }
    },
});

// ── Сценарий 3: главная ──────────────────────────────────────────────────
await scenario(browser, {
    title: 'Главная',
    url: '/',
    body: async (page, t) => {
        t('режим ленты включён', await page.evaluate(() => document.documentElement.classList.contains('tm-rbc-feed')));
        t('левая колонка видна', await page.evaluate(() => getComputedStyle(document.querySelector('.main > aside.aside')).display !== 'none'));
        t('шапка на месте', await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')).display !== 'none'));
        t('материалы Pro скрыты', await page.evaluate(() =>
            [...document.querySelectorAll('article.info-block')].filter(a => a.querySelector('a[href*="pro.rbc.ru"]')).every(a => getComputedStyle(a).display === 'none')));
        t('обычные новости остались', await page.evaluate(() =>
            [...document.querySelectorAll('article.info-block')].filter(a => !a.querySelector('a[href*="pro.rbc.ru"]')).every(a => getComputedStyle(a).display !== 'none')));
        t('строка «Главное» с меткой Pro скрыта', await page.evaluate(() =>
            getComputedStyle([...document.querySelectorAll('.news-line-wrapper')].find(w => w.querySelector('.labels-item-pro'))).display === 'none'));
        t('ссылка «Подписка на РБК» в шапке цела', await page.evaluate(() =>
            getComputedStyle(document.querySelector('.topline-desktop a[href*="pro.rbc.ru"]')).display !== 'none'));
        t('опросник удалён', await page.evaluate(() => getComputedStyle(document.querySelector('[class*="oprosso"]')).display === 'none'));
        t('шрифт в центральной ленте', await page.evaluate(() =>
            /Golos Text/.test(getComputedStyle(document.querySelector('.news-line-link')).fontFamily)));
        t('кегль левой ленты поднят до 16px', await page.evaluate(() =>
            getComputedStyle(document.querySelector('.info-block-title')).fontSize === '16px'));
    },
});

// ── Сценарий 4: клиентский переход лента → статья → назад ────────────────
await scenario(browser, {
    title: 'Переходы SPA',
    url: '/',
    body: async (page, t) => {
        t('старт: режим ленты', await page.evaluate(() => document.documentElement.classList.contains('tm-rbc-feed')));
        await page.evaluate(() => history.pushState(null, '', '/technology_and_media/29/07/2026/6a676f689a794706dab3a7fa'));
        await page.waitForTimeout(900);
        t('после перехода: режим статьи', await page.evaluate(() => document.documentElement.classList.contains('tm-rbc-article')));
        await page.evaluate(() => history.pushState(null, '', '/'));
        await page.waitForTimeout(900);
        t('после возврата: снова режим ленты', await page.evaluate(() => document.documentElement.classList.contains('tm-rbc-feed')));
    },
});

// ── Сценарий 5: поздняя инъекция (readyState уже не loading) ─────────────
await scenario(browser, {
    title: 'Поздняя инъекция',
    url: '/society/29/07/2026/6a69f5fd9a7947826695a92e',
    before: `Object.defineProperty(document, 'readyState', { get: () => 'complete', configurable: true });`,
    body: async (page, t) => {
        t('инициализация не падает', await page.evaluate(() => window.__tmGuard.errors.length === 0),
            await page.evaluate(() => window.__tmGuard.errors.join(' | ')));
        t('кнопка «Назад» всё равно смонтирована', await page.evaluate(() => !!document.getElementById('tm-rbc-back')));
        t('время чтения всё равно посчитано', await page.evaluate(() => !!document.querySelector('.tm-rbc-readtime')));
    },
});

await browser.close();
server.close();

// ── Отчёт ────────────────────────────────────────────────────────────────
let failed = 0;
let lastScenario = '';
for (const r of results) {
    if (r.scenario !== lastScenario) { console.log('\n▍' + r.scenario); lastScenario = r.scenario; }
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} проверок пройдено` + (failed ? `, ПРОВАЛЕНО: ${failed}` : ''));
process.exit(failed ? 1 : 0);
