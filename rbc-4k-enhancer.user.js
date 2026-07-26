// ==UserScript==
// @name         RBC 4K Enhancer
// @namespace    https://rbc.ru/
// @version      3.6.0
// @description  Улучшает отображение rbc.ru на 4K мониторах: расширяет контент, чинит ширину колонки, задаёт читаемую типографику (Golos Text), убирает подгрузку следующих статей, врезки внутри текста и рекламный мусор
// @author       Nikita
// @match        *://www.rbc.ru/*
// @match        *://rbc.ru/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/nkctnm/userscripts/main/rbc-4k-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/nkctnm/userscripts/main/rbc-4k-enhancer.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    //  НАСТРОЙКИ — меняй под себя
    // =========================================================================
    const CONFIG = {
        // Максимальная ширина основного контента (px). На 4K дефолтные 1332px — мелко.
        maxContentWidth: 1600,

        // Максимальная ширина КОЛОНКИ ТЕКСТА статьи (px).
        // 720px при 19px Golos Text = ~70 знаков в строке.
        // Оптимум для длинного чтения — 66 знаков (Bringhurst, «The Elements of
        // Typographic Style»), допустимый коридор 60–75. Шире 800 глаз начинает
        // терять начало следующей строки — поэтому НЕ растягиваем на весь 4K.
        articleTextWidth: 720,

        // Убирать подгрузку следующих статей (infinite scroll)?
        killInfiniteScroll: true,

        // Убирать блок "Партнёрские новости" внизу статей?
        hidePartnerNews: true,

        // Убирать рекламные баннеры и adfox-блоки?
        hideAds: true,

        // Убирать футер (огромный блок ссылок внизу)?
        hideFooter: true,

        // --- Чистка страницы статьи (v3.1) ---

        // Карточки-врезки со ссылками на другие статьи ПРЯМО МЕЖДУ АБЗАЦАМИ
        // (.base-card-template, ~164px). Разрывают чтение на середине мысли.
        hideInlineCards: true,

        // Левая лента «Все новости» — только на страницах статей.
        // На главной и в рубриках остаётся: там она по делу.
        hideNewsFeedOnArticles: true,

        // Промо-блоки «РБК в Максе»: короткий призыв в конце текста
        // (.card-wrapper) и видео-витрина ниже (~383px).
        hidePromoBlocks: true,

        // Плашка радио/телеканала над статьёй (.material-content-overflow)
        hideLivePlayer: true,

        // Ограничить высоту главного фото статьи (px). null = не трогать.
        // Дефолтные 503px съедают пол-экрана до первого абзаца.
        heroImageMaxHeight: 340,

        // --- Режим чтения и надстройки (v3.2) ---

        // Режим чтения ВСЕГДА включён на страницах статей: остаётся только
        // текст, колонка центрируется по окну. Навигационная шапка остаётся —
        // без неё некуда уйти со статьи.
        readingMode: true,

        // Полоса прогресса чтения сверху экрана
        progressBar: true,
        progressBarHeight: 3,
        progressBarColor: '#d0021b',

        // «~4 мин» под заголовком
        readingTime: true,
        wordsPerMinute: 180,

        // Кнопка переключения тёмной темы (кружок в правом нижнем углу).
        // Выбор запоминается между страницами и сессиями через GM_setValue.
        darkToggleButton: true,

        // Убирать верхнюю навигационную панель на страницах статей.
        // Скрывается .site-header целиком — это статичная распорка в 48px,
        // внутри которой лежит fixed-панель, так что дыры сверху не остаётся.
        hideTopBarOnArticles: true,

        // Плавающая кнопка «Назад» на статьях. Нужна как замена шапке:
        // без неё со статьи некуда уйти. Дублируется клавишей Esc.
        backButton: true,

        // Куда ведёт «Назад». Всегда на главную, а не на предыдущую страницу
        // в истории браузера — иначе из статьи, открытой в новой вкладке или
        // по прямой ссылке, кнопка увела бы с сайта.
        backTarget: 'https://www.rbc.ru/',

        // Состояние тёмной темы по умолчанию, ДО первого нажатия кнопки.
        // 'system' — следовать теме macOS, 'light' / 'dark' — фиксировать.
        darkDefault: 'system',

        // --- Главная и рубрики (v3.3) ---

        // Типографика ЛЕВОЙ колонки «Все новости». Дефолт РБК — 13px/17px.
        feedTitleSize: 16,
        feedTitleLine: 1.4,
        feedTitleWeight: 500,

        // ГЛАВНАЯ лента — центральная колонка (.content-custom).
        // Заголовки там уже 16px, но интерлиньяж 20px (1.25) — тесно для
        // двух-трёхстрочных заголовков. Гарнитуру тоже меняем на Golos Text.
        feedCenterSize: 16,
        feedCenterLine: 1.35,
        feedCenterWeight: 500,

        // Ширина левой колонки с лентой (px). Дефолт 300 → текст новости 251px,
        // заголовки ломаются на 4–5 строк. На 4K место есть.
        feedColumnWidth: 420,

        // Контраст дат и рубрик. Дефолт rgba(0,0,0,.545) ≈ 4.7:1 при 12px —
        // едва проходит WCAG AA (порог 4.5:1). Ниже ≈ 6:1.
        feedMetaColor: '#5f636b',

        // Компактная лента: меньше вертикальных отступов + без миниатюр.
        feedCompact: true,

        // Приглушать уже прочитанные новости (:visited)
        markVisited: true,

        // Убирать видео-витрины, плашку телеканала и промо на ВСЕХ страницах,
        // а не только на статьях.
        hidePromoEverywhere: true,

        // Тёмная тема не только на статьях, но и на главной/в рубриках
        darkOnFeedPages: true,

        // Обрезать ленту до N элементов. 0 = не обрезать. Подробности почему —
        // в комментарии к trimNewsFeed() ниже.
        feedMaxItems: 0,
    };

    // Тёмная палитра. Не инверсия: белый текст на чёрном даёт halation —
    // светлые штрихи «растекаются» на тёмном фоне, особенно у тонких
    // гротесков на Retina. Поэтому контраст снижен примерно до 11:1
    // вместо 19:1 у чистого чёрного на белом.
    const DARK = {
        bg: '#15171c',        // фон страницы
        surface: '#1b1e24',   // фон карточек и врезок
        text: '#c9ccd1',      // основной текст
        heading: '#e6e8eb',   // заголовки — чуть ярче текста
        muted: '#8b9099',     // подписи, даты, служебное
        link: '#7ab0ff',      // ссылки: красный РБК на тёмном нечитаем
        border: '#2a2e36',
        imageDim: 0.88,       // фото на тёмном светятся — приглушаем
    };

    // Теги, несущие текст. :is() имеет специфичность самого «тяжёлого»
    // аргумента — здесь это один элемент, поэтому правила с [class*=...]
    // ниже спокойно перебивают базовый цвет.
    const DARK_TEXT_TAGS = ':is(p,span,div,li,h1,h2,h3,h4,h5,h6,time,figcaption,td,th,dd,dt,strong,em,b,i)';

    // Куски имён классов, которыми РБК помечает служебный текст.
    const DARK_MUTED_PATTERNS = [
        '[class*="description"]', '[class*="-footer"]', '[class*="date"]',
        '[class*="caption"]', '[class*="leadText"]', '[class*="meta-info"]',
        '[class*="tab-panel-item"]', '[class*="author"]', '[class*="source"]',
    ];

    // =========================================================================
    //  ТИПОГРАФИКА
    //  Шрифт: Golos Text — по данным Google Fonts, сделан по заказу Smena и
    //  AIC Media для сайтов государственных и социальных служб, то есть
    //  кириллица у него первичная, а не адаптированная с латиницы; там же он
    //  описан как подходящий для длительного чтения.
    //  Замеры на живой странице (canvas, 19px):
    //    x-height / cap-height = 0.757, средний знак 10.26px → 70 знаков
    //    в строке при колонке 720px — ровно в коридоре 60–75 (Bringhurst).
    //  Fallback: PT Sans (стоит локально) → generic sans-serif.
    // =========================================================================
    const TYPO = {
        enabled: true,

        // Тянуть шрифт с Google Fonts. rbc.ru не блокирует CSP — проверено.
        // false = использовать только локальные шрифты из fallback.
        useGoogleFont: true,
        googleFontUrl: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..700&display=swap',

        // Альтернативы: '"Fira Sans", sans-serif', '"Onest", sans-serif',
        // '"PT Sans", sans-serif' (локальный, без внешних запросов),
        // '"PT Serif", Georgia, serif' (если захочется назад к засечкам).
        family: '"Golos Text", "PT Sans", -apple-system, sans-serif',

        bodySize: 19,        // px — гротеск с высоким x-height, 20px уже крупно
        bodyLine: 1.65,      // интерлиньяж
        bodyWeight: 400,
        bodyColor: '#16181d', // почти чёрный, но не #000 — меньше ореола на Retina
        paraGap: 1.05,       // отступ между абзацами, в em

        leadSize: 20,        // «подводка» (жирный абзац-врез)
        leadLine: 1.5,
        leadWeight: 600,

        h1Size: 38,          // заголовок статьи
        h1Line: 1.15,
        h1Weight: 700,
        h1Tracking: '-0.015em', // крупный кегль требует отрицательного трекинга

        h2Size: 27,          // подзаголовки внутри текста
        h2Line: 1.25,
        h2Weight: 700,

        h3Size: 22,
        h3Line: 1.3,
        h3Weight: 600,

        captionSize: 15,     // подписи к картинкам, служебные строки
        captionLine: 1.45,
        captionColor: '#6e727a',

        quoteSize: 22,       // цитаты
        quoteLine: 1.45,
        quoteAccent: '#d0021b', // фирменный красный РБК

        // Переносы по слогам — на узкой колонке убирают «дыры» в выключке
        hyphens: true,
    };

    // =========================================================================
    //  0. ПОДКЛЮЧЕНИЕ ШРИФТА + МЕТКА СТРАНИЦЫ СТАТЬИ
    //     Обе операции — на document-start, до первого кадра, чтобы не было
    //     ни мигания шрифта, ни мигания скрываемых блоков.
    // =========================================================================
    // rbc.ru — SPA на Next.js: переход «главная → статья» и обратно происходит
    // без перезагрузки страницы. Скрипт с @run-at document-start отрабатывает
    // один раз, поэтому метку страницы нельзя ставить разово — иначе после
    // клиентского перехода на статье остаётся класс главной (и наоборот),
    // и всё завязанное на неё CSS применяется не к той странице.
    // Отсюда починка: метка синхронизируется на каждой смене URL.
    function syncPageClass() {
        const isArt = isArticlePath(location.pathname);
        const root = document.documentElement;
        root.classList.toggle('tm-rbc-article', isArt);
        root.classList.toggle('tm-rbc-feed', !isArt);
        return isArt;
    }
    syncPageClass();

    // Хранилище: GM_* если Tampermonkey дал права, иначе localStorage.
    const store = {
        get(k, d) {
            try {
                if (typeof GM_getValue === 'function') return GM_getValue(k, d);
                const v = localStorage.getItem(k);
                return v === null ? d : JSON.parse(v);
            } catch (e) { return d; }
        },
        set(k, v) {
            try {
                if (typeof GM_setValue === 'function') return GM_setValue(k, v);
                localStorage.setItem(k, JSON.stringify(v));
            } catch (e) { /* приватный режим — просто не запоминаем */ }
        },
    };

    // Тему решаем ДО первого кадра, иначе будет вспышка белым.
    function resolveDark() {
        const saved = store.get('tm-rbc-dark', null);
        if (saved === true || saved === false) return saved;
        if (CONFIG.darkDefault === 'dark') return true;
        if (CONFIG.darkDefault === 'light') return false;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (resolveDark()) document.documentElement.classList.add('tm-dark');

    if (TYPO.enabled && TYPO.useGoogleFont) {
        const head = document.head || document.documentElement;
        for (const [href, cors] of [
            ['https://fonts.googleapis.com', false],
            ['https://fonts.gstatic.com', true],
        ]) {
            const pre = document.createElement('link');
            pre.rel = 'preconnect';
            pre.href = href;
            if (cors) pre.crossOrigin = 'anonymous';
            head.appendChild(pre);
        }
        const font = document.createElement('link');
        font.rel = 'stylesheet';
        font.href = TYPO.googleFontUrl;
        head.appendChild(font);
    }

    // =========================================================================
    //  1. ПЕРЕХВАТ IntersectionObserver — ДО загрузки скриптов сайта
    // =========================================================================
    if (CONFIG.killInfiniteScroll) {
        const OriginalObserver = window.IntersectionObserver;
        window.IntersectionObserver = function (callback, options) {
            const wrappedCallback = (entries, observer) => {
                const filtered = entries.filter(entry => {
                    const el = entry.target;
                    if (el.classList.contains('infinity-load-more') ||
                        el.classList.contains('rbc-infinity-scroller-loader') ||
                        el.closest?.('.rbc-infinity-scroller-loader')) {
                        return false;
                    }
                    return true;
                });
                if (filtered.length > 0) {
                    callback(filtered, observer);
                }
            };
            return new OriginalObserver(wrappedCallback, options);
        };
        window.IntersectionObserver.prototype = OriginalObserver.prototype;
        Object.setPrototypeOf(window.IntersectionObserver, OriginalObserver);
    }

    // =========================================================================
    //  2. CSS
    // =========================================================================
    const typoCss = !TYPO.enabled ? '' : `
        /* ---------- Основной текст ---------- */
        .article-feature-item p.paragraph,
        .article-feature-item .article__text p {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.bodySize}px !important;
            line-height: ${TYPO.bodyLine} !important;
            font-weight: ${TYPO.bodyWeight} !important;
            color: ${TYPO.bodyColor} !important;
            letter-spacing: 0 !important;
            padding-bottom: 0 !important;
            margin: 0 0 ${TYPO.paraGap}em 0 !important;
            text-wrap: pretty;
            ${TYPO.hyphens ? 'hyphens: auto; -webkit-hyphens: auto;' : ''}
        }

        /* ---------- Врез / подводка ---------- */
        .article-feature-item [class*="styles_lead__"] {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.leadSize}px !important;
            line-height: ${TYPO.leadLine} !important;
            font-weight: ${TYPO.leadWeight} !important;
            color: ${TYPO.bodyColor} !important;
        }

        /* ---------- Заголовок статьи ---------- */
        h1.article-entry-title,
        .article-feature-item h1,
        .article__header__title-in {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.h1Size}px !important;
            line-height: ${TYPO.h1Line} !important;
            font-weight: ${TYPO.h1Weight} !important;
            letter-spacing: ${TYPO.h1Tracking} !important;
            color: ${TYPO.bodyColor} !important;
            text-wrap: balance;
        }

        /* ---------- Подзаголовки внутри текста ---------- */
        .article-feature-item h2 {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.h2Size}px !important;
            line-height: ${TYPO.h2Line} !important;
            font-weight: ${TYPO.h2Weight} !important;
            margin: 1.9em 0 0.55em !important;
        }
        .article-feature-item h3,
        .article-feature-item h4 {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.h3Size}px !important;
            line-height: ${TYPO.h3Line} !important;
            font-weight: ${TYPO.h3Weight} !important;
            margin: 1.7em 0 0.5em !important;
        }

        /* ---------- Цитаты ---------- */
        .article-feature-item blockquote {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.quoteSize}px !important;
            line-height: ${TYPO.quoteLine} !important;
            font-style: italic !important;
            border-left: 3px solid ${TYPO.quoteAccent} !important;
            padding-left: 20px !important;
            margin: 1.6em 0 !important;
        }

        /* ---------- Списки ---------- */
        .article-feature-item .article__text ul li,
        .article-feature-item .article__text ol li {
            font-family: ${TYPO.family} !important;
            font-size: ${TYPO.bodySize}px !important;
            line-height: ${TYPO.bodyLine} !important;
            margin-bottom: 0.4em !important;
        }

        /* ---------- Подписи и служебные строки ---------- */
        .article-feature-item figcaption,
        .article-feature-item [class*="caption"],
        .article-feature-item [class*="styles_author__"] {
            font-size: ${TYPO.captionSize}px !important;
            line-height: ${TYPO.captionLine} !important;
            color: ${TYPO.captionColor} !important;
        }

        /* ---------- Ссылки в тексте ---------- */
        .article-feature-item p.paragraph a {
            text-decoration-thickness: 1px !important;
            text-underline-offset: 3px !important;
        }
    `;

    const css = `
        /* ============================================================
           ШАПКА
           ============================================================ */
        .topline-desktop {
            background-color: #fff !important;
            border-bottom: 1px solid #e4e4e4 !important;
        }
        .topline-desktop-container {
            max-width: ${CONFIG.maxContentWidth}px !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }

        /* ============================================================
           ОСНОВНОЙ КОНТЕНТ
           ============================================================ */
        .main {
            max-width: ${CONFIG.maxContentWidth}px !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }
        .column-central-plus-side {
            max-width: calc(${CONFIG.maxContentWidth}px - 300px) !important;
            flex-grow: 1 !important;
        }

        /* ФИКС: .main-content у РБК имеет ЖЁСТКУЮ width: 648px внутри
           flex-строки .column-fullwidth. Из-за этого max-width на
           .article-feature-item ничего не давал — колонка физически не
           могла стать шире 600px. Снимаем фиксированную ширину. */
        .column-fullwidth > .main-content {
            width: auto !important;
            flex: 1 1 auto !important;
            min-width: 0 !important;
        }
        .main-content > main {
            max-width: none !important;
        }

        /* ============================================================
           ТЕКСТ СТАТЬИ — колонка комфортной ширины, по центру
           ============================================================ */
        .article-feature-item,
        .article-feature-item .m-gutter-b {
            max-width: ${CONFIG.articleTextWidth}px !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }

        ${typoCss}

        /* ============================================================
           INFINITE SCROLL
           ============================================================ */
        ${CONFIG.killInfiniteScroll ? `
        .rbc-infinity-scroller-loader,
        .infinity-load-more {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }
        .column-central-plus-side > .column-fullwidth ~ .column-fullwidth,
        .column-central-plus-side > .column-fullwidth ~ .stroke-t {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
        }
        /* Вторая и последующие статьи внутри одной колонки */
        .main-content > main > .article-feature-item ~ .article-feature-item {
            display: none !important;
        }
        ` : ''}

        /* ============================================================
           ПАРТНЁРСКИЕ НОВОСТИ
           ============================================================ */
        ${CONFIG.hidePartnerNews ? `
        [class*="PartnersNews"] { display: none !important; }
        ` : ''}

        /* ============================================================
           РЕКЛАМНЫЕ БЛОКИ
           ============================================================ */
        ${CONFIG.hideAds ? `
        [id*="adfox"],
        [class*="adfox"],
        [class*="banner-"],
        [class*="js-video-player-ad"],
        .live-tv-player,
        [class*="ad-slot"],
        [class*="advert"] {
            display: none !important;
        }
        ` : ''}

        /* ============================================================
           ФУТЕР
           ============================================================ */
        ${CONFIG.hideFooter ? `
        footer.footer { display: none !important; }
        ` : ''}

        /* ============================================================
           ЧИСТКА СТРАНИЦЫ СТАТЬИ (v3.1)
           ============================================================ */

        /* Карточки-врезки между абзацами */
        ${CONFIG.hideInlineCards ? `
        .article-feature-item .base-card-template { display: none !important; }
        ` : ''}

        /* Левая лента новостей — только на статьях */
        ${CONFIG.hideNewsFeedOnArticles ? `
        .tm-rbc-article .main > aside.aside { display: none !important; }
        .tm-rbc-article .main { justify-content: center !important; }
        ` : ''}

        /* Промо «РБК в Максе»: врез в тексте + видео-витрина ниже.
           :has() нужен потому, что у витрины хешированный CSS-модульный класс,
           который меняется при каждой пересборке сайта — цепляемся за
           устойчивый фрагмент имени внутри. */
        ${CONFIG.hidePromoBlocks ? `
        .article-feature-item .card-wrapper { display: none !important; }
        .article-feature-item .stroke-y:has([class*="video-showcase"]) { display: none !important; }
        ` : ''}

        /* Плашка радио/телеканала над статьёй */
        ${CONFIG.hideLivePlayer ? `
        .tm-rbc-article .material-content-overflow { display: none !important; }
        ` : ''}

        /* Главное фото — не на пол-экрана */
        ${CONFIG.heroImageMaxHeight ? `
        .article-image .article-image-container {
            max-height: ${CONFIG.heroImageMaxHeight}px !important;
            overflow: hidden !important;
        }
        .article-image .article-image-container img {
            width: 100% !important;
            height: ${CONFIG.heroImageMaxHeight}px !important;
            object-fit: cover !important;
        }
        ` : ''}

        /* ============================================================
           РЕЖИМ ЧТЕНИЯ (v3.2) — всегда включён на статьях
           ============================================================ */
        ${CONFIG.readingMode ? `
        .tm-rbc-article .main > aside.aside,
        .tm-rbc-article .column-fullwidth > aside.bside,
        .tm-rbc-article .article-feature-item [class*="material-meta"] {
            display: none !important;
        }
        .tm-rbc-article .main,
        .tm-rbc-article .column-central-plus-side {
            justify-content: center !important;
            max-width: 100% !important;
        }
        .tm-rbc-article .column-fullwidth { justify-content: center !important; }
        ` : ''}

        /* ============================================================
           ПОЛОСА ПРОГРЕССА ЧТЕНИЯ
           ============================================================ */
        ${CONFIG.progressBar ? `
        #tm-rbc-progress {
            position: fixed;
            top: 0; left: 0;
            height: ${CONFIG.progressBarHeight}px;
            width: 0;
            background: ${CONFIG.progressBarColor};
            z-index: 2147483646;
            pointer-events: none;
            transition: width .08s linear;
        }
        ` : ''}

        /* ============================================================
           ВРЕМЯ ЧТЕНИЯ
           ============================================================ */
        ${CONFIG.readingTime ? `
        .tm-rbc-readtime {
            font-family: ${TYPO.family};
            font-size: 14px;
            font-weight: 500;
            letter-spacing: .02em;
            color: ${TYPO.captionColor};
            margin: 10px 0 2px;
        }
        ` : ''}

        /* ============================================================
           ПЛАВАЮЩИЕ КНОПКИ: назад и тёмная тема
           ============================================================ */
        #tm-rbc-dark-toggle,
        #tm-rbc-back {
            position: fixed;
            z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            gap: 8px;
            cursor: pointer;
            font-family: ${TYPO.family};
            border: 1px solid rgba(0,0,0,.16);
            background: #fff;
            color: #16181d;
            /* Раньше было opacity .55 — белый полупрозрачный кружок на белом
               фоне не читался как элемент управления и терялся на экране. */
            opacity: .92;
            box-shadow: 0 3px 14px rgba(0,0,0,.18);
            transition: transform .12s ease, opacity .12s ease;
        }
        #tm-rbc-dark-toggle:hover,
        #tm-rbc-back:hover { opacity: 1; transform: translateY(-1px); }

        html.tm-dark #tm-rbc-dark-toggle,
        html.tm-dark #tm-rbc-back {
            background: ${DARK.surface};
            color: ${DARK.heading};
            border-color: ${DARK.border};
            box-shadow: 0 3px 14px rgba(0,0,0,.55);
        }

        ${CONFIG.darkToggleButton ? `
        #tm-rbc-dark-toggle {
            right: 24px; bottom: 24px;
            width: 46px; height: 46px;
            border-radius: 50%;
            font-size: 20px; line-height: 1;
        }
        ` : ''}

        ${CONFIG.backButton ? `
        #tm-rbc-back {
            left: 24px; top: 18px;
            height: 40px;
            padding: 0 18px 0 14px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: .01em;
        }
        #tm-rbc-back .tm-arrow { font-size: 17px; line-height: 1; }
        #tm-rbc-back .tm-hint {
            font-size: 11px;
            opacity: .5;
            border: 1px solid currentColor;
            border-radius: 4px;
            padding: 1px 4px;
        }
        ` : ''}

        /* ============================================================
           ВЕРХНЯЯ ПАНЕЛЬ НА СТАТЬЯХ
           .site-header — статичная распорка 48px, внутри неё fixed-бар.
           Прячем целиком, поэтому пустого места сверху не остаётся.
           ============================================================ */
        ${CONFIG.hideTopBarOnArticles ? `
        .tm-rbc-article .site-header { display: none !important; }
        ` : ''}

        /* В режиме чтения по бокам от колонки видно фон body (#f8f8f8) —
           серая полоса вдоль края. Выравниваем с белым фоном статьи. */
        html:not(.tm-dark).tm-rbc-article body { background-color: #fff !important; }

        /* ============================================================
           ТЁМНАЯ ТЕМА
           ============================================================ */
        html.tm-dark,
        html.tm-dark body,
        html.tm-dark .main,
        html.tm-dark .main-content,
        html.tm-dark .column-fullwidth,
        html.tm-dark .column-central-plus-side,
        html.tm-dark .article-feature-item {
            background-color: ${DARK.bg} !important;
        }
        html.tm-dark .topline-desktop {
            background-color: ${DARK.bg} !important;
            border-bottom-color: ${DARK.border} !important;
        }
        html.tm-dark .topline-desktop a,
        html.tm-dark .topline-desktop-toplink,
        html.tm-dark .topline-desktop li {
            color: ${DARK.text} !important;
        }
        html.tm-dark .article-feature-item p.paragraph,
        html.tm-dark .article-feature-item li {
            color: ${DARK.text} !important;
        }
        html.tm-dark h1.article-entry-title,
        html.tm-dark .article-feature-item h2,
        html.tm-dark .article-feature-item h3,
        html.tm-dark .article-feature-item [class*="styles_lead__"] {
            color: ${DARK.heading} !important;
        }
        html.tm-dark .article-feature-item a { color: ${DARK.link} !important; }
        /* Служебный текст. Часть элементов у РБК окрашена не классом, а
           жёстким rgba(0,0,0,.545) — на тёмном фоне это чёрное на чёрном,
           поэтому каждый такой блок перекрываем явно. */
        html.tm-dark .article-feature-item figcaption,
        html.tm-dark .article-feature-item [class*="caption"],
        html.tm-dark .article-feature-item-title,
        html.tm-dark .article-entry-leadText,
        html.tm-dark [class*="leadText"],
        html.tm-dark .article-entry time,
        html.tm-dark .tm-rbc-readtime,
        html.tm-dark .meta-info-row-date {
            color: ${DARK.muted} !important;
        }
        html.tm-dark .article-feature-item blockquote {
            background: ${DARK.surface} !important;
            padding: 14px 20px !important;
            border-radius: 4px !important;
        }
        html.tm-dark .article-image img,
        html.tm-dark .article-feature-item img {
            filter: brightness(${DARK.imageDim}) !important;
        }
        html.tm-dark [class*="stroke-"],
        html.tm-dark .stroke-t, html.tm-dark .stroke-b, html.tm-dark .stroke-y {
            border-color: ${DARK.border} !important;
        }
        /* Пока шрифт грузится, не показываем прыжок начертания */
        html.tm-dark ::selection { background: ${DARK.link}; color: ${DARK.bg}; }

        /* ============================================================
           МЕЛОЧИ ДЛЯ 4K
           ============================================================ */
        .article-image-container img,
        .article-feature-item img {
            max-width: 100% !important;
            height: auto !important;
        }
        .bside { min-width: 300px !important; }

        /* ============================================================
           ГЛАВНАЯ И РУБРИКИ (v3.3)
           ============================================================ */

        /* Ширина колонки с лентой. Центральная забирает остаток сама. */
        .tm-rbc-feed .main > aside.aside {
            min-width: ${CONFIG.feedColumnWidth}px !important;
            max-width: ${CONFIG.feedColumnWidth}px !important;
            flex: 0 0 ${CONFIG.feedColumnWidth}px !important;
        }
        .tm-rbc-feed .content-custom {
            width: auto !important;
            flex: 1 1 auto !important;
            min-width: 0 !important;
        }

        /* Гарнитура на всей странице ленты.
           Исключаем ra-icon: у РБК иконки — это иконочный шрифт, и если
           перебить ему font-family, вместо стрелок и лупы полезут буквы. */
        .tm-rbc-feed .content-custom :not([class*="ra-icon"]),
        .tm-rbc-feed aside.aside :not([class*="ra-icon"]),
        .tm-rbc-feed aside.bside :not([class*="ra-icon"]),
        .tm-rbc-feed .topline-desktop :not([class*="ra-icon"]) {
            font-family: ${TYPO.family} !important;
        }

        /* Заголовки ГЛАВНОЙ (центральной) ленты */
        .tm-rbc-feed .news-line-link,
        .tm-rbc-feed .collection-new-item-link,
        .tm-rbc-feed .central-publisher-item a {
            font-size: ${CONFIG.feedCenterSize}px !important;
            line-height: ${CONFIG.feedCenterLine} !important;
            font-weight: ${CONFIG.feedCenterWeight} !important;
            text-wrap: pretty;
        }
        .tm-rbc-feed [class*="section-header-title"] {
            letter-spacing: -0.01em !important;
        }

        /* Кегль заголовков в левой колонке «Все новости» */
        .tm-rbc-feed .info-block-title {
            font-family: ${TYPO.family} !important;
            font-size: ${CONFIG.feedTitleSize}px !important;
            line-height: ${CONFIG.feedTitleLine} !important;
            font-weight: ${CONFIG.feedTitleWeight} !important;
            text-wrap: pretty;
        }

        /* Контраст служебных строк */
        .tm-rbc-feed .meta-info-row-date,
        .tm-rbc-feed [class*="meta-info-row"] {
            color: ${CONFIG.feedMetaColor} !important;
        }

        /* Компактная лента */
        ${CONFIG.feedCompact ? `
        .tm-rbc-feed article.info-block { padding: 10px 0 !important; }
        .tm-rbc-feed [class*="styles_newsfeed__"] article.info-block picture,
        .tm-rbc-feed [class*="styles_newsfeed__"] article.info-block img {
            display: none !important;
        }
        ` : ''}

        /* Прочитанное. :visited разрешает менять только цвет — этого хватает. */
        ${CONFIG.markVisited ? `
        .tm-rbc-feed a:visited .info-block-title,
        .tm-rbc-feed a.info-block-title:visited { color: #8a8f98 !important; }
        html.tm-dark.tm-rbc-feed a:visited .info-block-title,
        html.tm-dark.tm-rbc-feed a.info-block-title:visited { color: #62666e !important; }
        ` : ''}

        /* Промо и витрины на всех страницах */
        ${CONFIG.hidePromoEverywhere ? `
        [class*="video-showcase"],
        [class*="live-media-feature"],
        .card-wrapper,
        .material-content-overflow {
            display: none !important;
        }
        ` : ''}

        /* Тёмная тема для главной и рубрик */
        ${CONFIG.darkOnFeedPages ? `
        html.tm-dark.tm-rbc-feed,
        html.tm-dark.tm-rbc-feed body,
        html.tm-dark.tm-rbc-feed .main,
        html.tm-dark.tm-rbc-feed .content-custom,
        html.tm-dark.tm-rbc-feed aside.aside,
        html.tm-dark.tm-rbc-feed aside.bside,
        html.tm-dark.tm-rbc-feed article.info-block,
        html.tm-dark.tm-rbc-feed [class*="styles_newsfeed__"] {
            background-color: ${DARK.bg} !important;
        }
        html.tm-dark.tm-rbc-feed .info-block-title,
        html.tm-dark.tm-rbc-feed [class*="headline-"],
        html.tm-dark.tm-rbc-feed [class*="section-header"] {
            color: ${DARK.heading} !important;
        }
        html.tm-dark.tm-rbc-feed .meta-info-row-date,
        html.tm-dark.tm-rbc-feed [class*="meta-info-row"] {
            color: ${DARK.muted} !important;
        }
        html.tm-dark.tm-rbc-feed [class*="stroke-"] { border-color: ${DARK.border} !important; }
        html.tm-dark.tm-rbc-feed img { filter: brightness(${DARK.imageDim}) !important; }
        ` : ''}

        ${!CONFIG.hideFooter ? `
        .footer-container {
            max-width: ${CONFIG.maxContentWidth}px !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }
        ` : ''}

        /* ============================================================
           ТЁМНАЯ ТЕМА — СИСТЕМНЫЙ СЛОЙ (v3.6)

           У РБК десятки блоков с жёстко прописанными белым фоном и
           rgba(0,0,0,.545) для текста, причём у половины из них имена
           классов хешированные (styles_block-description__CBh_) и меняются
           при каждой пересборке сайта. Ловить их поимённо бесполезно.
           Поэтому здесь три слоя по возрастанию специфичности:
             1) обнуляем фон у контейнеров — просвечивает тёмный фон страницы;
             2) задаём базовый цвет текста через :is(...), у которого
                специфичность равна одному элементу;
             3) поверх — приглушённое и заголовочное, где селекторы с
                [class*=...] заведомо специфичнее базового слоя.
           Блок идёт последним в файле: при равной специфичности побеждает
           правило, объявленное позже.
           ============================================================ */

        /* 1. Фон контейнеров. Ссылки и кнопки в список не входят —
              фирменные акценты (зелёная кнопка, красная плашка) остаются. */
        html.tm-dark .article-feature-item :is(div,section,article,ul,ol,li,figure,header),
        html.tm-dark.tm-rbc-feed .content-custom :is(div,section,article,ul,ol,li,figure,header),
        html.tm-dark.tm-rbc-feed aside.aside :is(div,section,article,ul,ol,li,figure,header),
        html.tm-dark.tm-rbc-feed aside.bside :is(div,section,article,ul,ol,li,figure,header),
        html.tm-dark .topline-desktop :is(div,section,ul,li,nav) {
            background-color: transparent !important;
        }
        html.tm-dark .topline-desktop,
        html.tm-dark .topline-desktop-container { background-color: ${DARK.bg} !important; }

        /* 2. Базовый цвет текста */
        html.tm-dark .article-feature-item ${DARK_TEXT_TAGS},
        html.tm-dark.tm-rbc-feed .content-custom ${DARK_TEXT_TAGS},
        html.tm-dark.tm-rbc-feed aside.aside ${DARK_TEXT_TAGS},
        html.tm-dark.tm-rbc-feed aside.bside ${DARK_TEXT_TAGS},
        html.tm-dark .topline-desktop ${DARK_TEXT_TAGS},
        html.tm-dark .topline-desktop a,
        html.tm-dark.tm-rbc-feed a {
            color: ${DARK.text} !important;
        }

        /* 3a. Приглушённое: подписи, даты, авторы, служебные вкладки */
        ${['html.tm-dark .article-feature-item',
           'html.tm-dark.tm-rbc-feed .content-custom',
           'html.tm-dark.tm-rbc-feed aside.aside',
           'html.tm-dark.tm-rbc-feed aside.bside']
            .flatMap(root => DARK_MUTED_PATTERNS.map(sel => `${root} ${sel}`))
            .join(',\n        ')} {
            color: ${DARK.muted} !important;
        }

        /* 3b. Заголовки — ярче основного текста */
        html.tm-dark .article-feature-item h1,
        html.tm-dark .article-feature-item h2,
        html.tm-dark .article-feature-item h3,
        html.tm-dark h1.article-entry-title,
        html.tm-dark .article-feature-item [class*="styles_lead__"],
        html.tm-dark.tm-rbc-feed a.info-block-title,
        html.tm-dark.tm-rbc-feed a.news-line-link,
        html.tm-dark.tm-rbc-feed a.collection-new-item-link,
        html.tm-dark.tm-rbc-feed [class*="section-header-title"],
        html.tm-dark.tm-rbc-feed [class*="headline-"] {
            color: ${DARK.heading} !important;
        }

        /* 3c. Ссылки внутри текста статьи */
        html.tm-dark .article-feature-item p.paragraph a,
        html.tm-dark .article-feature-item blockquote a { color: ${DARK.link} !important; }

        /* 3d. Прочитанное в ленте — тусклее непрочитанного */
        ${CONFIG.markVisited ? `
        html.tm-dark.tm-rbc-feed a:visited .info-block-title,
        html.tm-dark.tm-rbc-feed a.info-block-title:visited { color: #62666e !important; }
        ` : ''}
    `;

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    // =========================================================================
    //  3. JS
    // =========================================================================
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(() => {
        // Переносы работают только если у документа объявлен язык
        if (TYPO.enabled && TYPO.hyphens && !document.documentElement.lang) {
            document.documentElement.lang = 'ru';
        }

        if (CONFIG.killInfiniteScroll) {
            const removeLoadMore = () => {
                document.querySelectorAll('.rbc-infinity-scroller-loader, .infinity-load-more').forEach(el => el.remove());
            };
            removeLoadMore();

            const watchTarget = document.querySelector('.column-central-plus-side');
            if (watchTarget) {
                const cleanupArticles = () => {
                    const fullwidthBlocks = watchTarget.querySelectorAll(':scope > .column-fullwidth');
                    if (fullwidthBlocks.length > 1) {
                        let foundFirst = false;
                        Array.from(watchTarget.children).forEach(child => {
                            if (child.classList.contains('column-fullwidth')) {
                                if (!foundFirst) {
                                    foundFirst = true;
                                } else {
                                    child.remove();
                                }
                            } else if (foundFirst && child.classList.contains('stroke-t')) {
                                child.remove();
                            }
                        });
                    }
                    // Вторая и последующие статьи внутри одного main
                    const arts = document.querySelectorAll('.main-content > main > .article-feature-item');
                    for (let i = 1; i < arts.length; i++) arts[i].remove();

                    removeLoadMore();
                };

                const cpsObserver = new MutationObserver(cleanupArticles);
                cpsObserver.observe(watchTarget, { childList: true, subtree: true });

                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    const mcObserver = new MutationObserver(cleanupArticles);
                    mcObserver.observe(mainContent, { childList: true, subtree: true });
                }
                cleanupArticles();
            }

            const originalUrl = location.href;
            const origPushState = history.pushState.bind(history);
            const origReplaceState = history.replaceState.bind(history);

            history.pushState = function (state, title, url) {
                const newUrl = url ? new URL(url, location.origin).pathname : null;
                const currentPath = new URL(originalUrl).pathname;
                if (newUrl && newUrl !== currentPath && isArticlePath(newUrl) && isArticlePath(currentPath)) {
                    return;
                }
                return origPushState(state, title, url);
            };

            history.replaceState = function (state, title, url) {
                const newUrl = url ? new URL(url, location.origin).pathname : null;
                const currentPath = new URL(originalUrl).pathname;
                if (newUrl && newUrl !== currentPath && isArticlePath(newUrl) && isArticlePath(currentPath)) {
                    return;
                }
                return origReplaceState(state, title, url);
            };
        }

        if (CONFIG.hideAds) {
            const bodyObserver = new MutationObserver(() => {
                document.querySelectorAll('[id*="adfox"], [class*="adfox"]').forEach(el => {
                    el.style.display = 'none';
                });
            });
            bodyObserver.observe(document.body, { childList: true, subtree: true });
        }

        if (CONFIG.darkToggleButton) mountDarkToggle();
        applyForCurrentRoute();
        watchRouteChanges();

        console.log('%c[RBC 4K Enhancer v3.6] Активирован', 'color: #00ff41; font-size: 14px; font-weight: bold;');
    });

    // =========================================================================
    //  3.5. РОУТИНГ SPA
    //  Next.js меняет URL через history.pushState без перезагрузки. Ловим это
    //  тремя способами сразу: патч history, событие popstate (кнопка «назад»)
    //  и страховочный опрос — на случай, если сайт сменит способ навигации.
    // =========================================================================

    function applyForCurrentRoute() {
        const isArt = syncPageClass();

        // React при клиентском переходе перерисовывает поддерево body и может
        // снести кнопку — mountDarkToggle сам выходит, если она на месте.
        if (CONFIG.darkToggleButton) mountDarkToggle();

        document.getElementById('tm-rbc-progress')?.remove();
        document.querySelector('.tm-rbc-readtime')?.remove();
        detachProgress();

        if (CONFIG.backButton) {
            if (isArt) mountBackButton();
            else document.getElementById('tm-rbc-back')?.remove();
        }

        if (!isArt) {
            if (CONFIG.feedMaxItems > 0) trimNewsFeed();
            return;
        }

        // После клиентского перехода разметка статьи появляется не мгновенно,
        // поэтому пробуем несколько раз, пока не найдём абзацы.
        let tries = 0;
        const attempt = () => {
            if (document.querySelector('.article-feature-item p.paragraph')) {
                if (CONFIG.readingTime) mountReadingTime();
                if (CONFIG.progressBar) mountProgressBar();
                return;
            }
            if (++tries < 30) setTimeout(attempt, 100);
        };
        attempt();
    }

    function watchRouteChanges() {
        let lastPath = location.pathname;
        const onMaybeChanged = () => {
            if (location.pathname === lastPath) return;
            lastPath = location.pathname;
            applyForCurrentRoute();
        };

        for (const method of ['pushState', 'replaceState']) {
            const original = history[method].bind(history);
            history[method] = function (...args) {
                const result = original(...args);
                // Классы переключаем синхронно, до отрисовки следующего кадра,
                // иначе на статье успевает мелькнуть колонка с главной.
                syncPageClass();
                onMaybeChanged();
                return result;
            };
        }
        window.addEventListener('popstate', onMaybeChanged);
        setInterval(onMaybeChanged, 500);
    }

    // =========================================================================
    //  4. РЕЖИМ ЧТЕНИЯ: кнопка темы, время чтения, прогресс
    // =========================================================================

    // Обрезка ленты новостей.
    //
    // Замеры на главной rbc.ru (Chrome, 26.07.2026): лента слева содержит
    // ~1160 элементов и около 16 000 узлов DOM — это примерно 85% всего
    // документа. Синхронный reflow страницы занимал в среднем 59.8 мс;
    // после удаления всего, что дальше 60-го элемента, — 6.0 мс.
    //
    // Честная оговорка: замер форсирует layout принудительно, обычный скролл
    // так себя не ведёт, так что 10× — это разница в худшем случае, а не
    // ускорение прокрутки в десять раз. Высота страницы при этом НЕ меняется:
    // её задаёт центральная колонка, а не лента.
    //
    // Поэтому по умолчанию выключено (feedMaxItems: 0). Включать имеет смысл,
    // если заметны рывки при скролле или греется вентилятор на главной.
    function trimNewsFeed() {
        const feed = document.querySelector('[class*="styles_newsfeed__"]');
        if (!feed) return;
        const cut = () => {
            const items = feed.querySelectorAll('article.info-block');
            for (let i = CONFIG.feedMaxItems; i < items.length; i++) items[i].remove();
        };
        cut();
        // Лента догружается по скроллу — подрезаем и подгруженное.
        let scheduled = false;
        new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; cut(); });
        }).observe(feed, { childList: true, subtree: true });
    }

    function goBack() {
        // Всегда на главную, а не history.back(). Поведение предсказуемо
        // независимо от того, как открыта статья: из ленты, из новой вкладки
        // или по прямой ссылке из мессенджера.
        window.location.href = CONFIG.backTarget;
    }

    function mountBackButton() {
        if (document.getElementById('tm-rbc-back')) return;
        const btn = document.createElement('button');
        btn.id = 'tm-rbc-back';
        btn.type = 'button';
        btn.title = 'Назад к ленте (Esc)';
        btn.innerHTML = '<span class="tm-arrow">←</span><span>Назад</span><span class="tm-hint">Esc</span>';
        btn.addEventListener('click', goBack);
        document.body.appendChild(btn);
    }

    // Esc — то же действие. Не перехватываем, если пользователь печатает
    // в поле или открыт какой-нибудь модальный диалог сайта.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !CONFIG.backButton) return;
        if (!isArticlePath(location.pathname)) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        goBack();
    });

    function mountDarkToggle() {
        if (document.getElementById('tm-rbc-dark-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'tm-rbc-dark-toggle';
        btn.type = 'button';
        const sync = () => {
            const on = document.documentElement.classList.contains('tm-dark');
            btn.textContent = on ? '☀' : '☾';
            btn.title = on ? 'Светлая тема' : 'Тёмная тема';
            btn.setAttribute('aria-label', btn.title);
        };
        btn.addEventListener('click', () => {
            const on = document.documentElement.classList.toggle('tm-dark');
            store.set('tm-rbc-dark', on);
            sync();
        });
        sync();
        document.body.appendChild(btn);
    }

    function articleParagraphs() {
        return document.querySelectorAll('.article-feature-item p.paragraph, .article-feature-item .article__text p');
    }

    function mountReadingTime() {
        const paras = articleParagraphs();
        if (!paras.length) return;
        let words = 0;
        paras.forEach(p => {
            const t = p.innerText.trim();
            if (t) words += t.split(/\s+/).length;
        });
        if (!words) return;
        const minutes = Math.max(1, Math.round(words / CONFIG.wordsPerMinute));
        const h1 = document.querySelector('h1.article-entry-title, .article-feature-item h1');
        if (!h1 || h1.parentElement.querySelector('.tm-rbc-readtime')) return;
        const el = document.createElement('div');
        el.className = 'tm-rbc-readtime';
        el.textContent = `~${minutes} мин чтения · ${words} слов`;
        h1.insertAdjacentElement('afterend', el);
    }

    // Слушатели прогресса живут дольше страницы: при клиентском переходе
    // старые надо снимать, иначе они копятся с каждой открытой статьёй.
    let progressHandler = null;
    function detachProgress() {
        if (!progressHandler) return;
        window.removeEventListener('scroll', progressHandler);
        window.removeEventListener('resize', progressHandler);
        progressHandler = null;
    }

    function mountProgressBar() {
        const paras = articleParagraphs();
        if (!paras.length) return;
        const first = paras[0];
        const last = paras[paras.length - 1];

        detachProgress();
        document.getElementById('tm-rbc-progress')?.remove();
        const bar = document.createElement('div');
        bar.id = 'tm-rbc-progress';
        document.body.appendChild(bar);

        let ticking = false;
        const update = () => {
            ticking = false;
            // Считаем по границам ТЕКСТА, а не по высоте документа:
            // ниже статьи ещё сотни пикселей служебных блоков, и прогресс
            // по scrollHeight показывал бы 40% там, где читать уже нечего.
            const startY = first.getBoundingClientRect().top + window.scrollY;
            const endY = last.getBoundingClientRect().bottom + window.scrollY;
            const span = endY - startY - window.innerHeight * 0.5;
            if (span <= 0) { bar.style.width = '0'; return; }
            const passed = window.scrollY - startY + window.innerHeight * 0.5;
            const pct = Math.min(100, Math.max(0, (passed / span) * 100));
            bar.style.width = pct + '%';
        };
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        };
        progressHandler = onScroll;
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        update();
    }

    // =========================================================================
    //  Утилиты
    // =========================================================================
    function isArticlePath(path) {
        // Статья — это /<рубрика>/DD/MM/YYYY/<id> либо /rbcfreenews/<id>.
        //
        // Раньше здесь был просто список рубрик, и /politics/ — страница
        // рубрики со своей лентой — считалась статьёй: у неё пряталась
        // колонка новостей и шапка, а сверху появлялась кнопка «Назад».
        // Проверка по дате в URL отсекает это и заодно не требует
        // поддерживать список рубрик: новые разделы заработают сами.
        // (\/[a-z-]+)? — вложенные рубрики вида /life/style/DD/MM/YYYY/...
        return /^\/[a-z-]+(\/[a-z-]+)?\/\d{2}\/\d{2}\/\d{4}\/[0-9a-z]+/i.test(path)
            || /^\/rbcfreenews\/[0-9a-z]+/i.test(path);
    }

})();
