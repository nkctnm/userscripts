// ==UserScript==
// @name         RBC 4K Enhancer
// @namespace    https://rbc.ru/
// @version      3.0.0
// @description  Улучшает отображение rbc.ru на 4K мониторах: расширяет контент, чинит ширину колонки, задаёт читаемую типографику, убирает подгрузку следующих статей и рекламный мусор
// @author       Nikita
// @match        *://www.rbc.ru/*
// @match        *://rbc.ru/*
// @grant        GM_addStyle
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
        // 720px при 20px PT Serif = ~71 знак в строке.
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
    };

    // =========================================================================
    //  ТИПОГРАФИКА
    //  Шрифт: PT Serif (ParaType) — предустановлен в macOS, спроектирован
    //  специально под кириллицу, крупный x-height, засечки дают опору глазу
    //  на длинных текстах. Fallback: Georgia → generic serif.
    //  Модульная шкала ×1.4 от кегля основного текста.
    // =========================================================================
    const TYPO = {
        enabled: true,

        // Семейство для статьи. Альтернативы: '"Charter", Georgia, serif',
        // '"PT Sans", "Inter", sans-serif' (если засечки не заходят).
        family: '"PT Serif", Georgia, "Times New Roman", serif',

        bodySize: 20,        // px — основной текст
        bodyLine: 1.62,      // интерлиньяж: 1.6–1.65 для 20px serif
        bodyWeight: 400,
        bodyColor: '#16181d', // почти чёрный, но не #000 — меньше ореола на Retina
        paraGap: 1.05,       // отступ между абзацами, в em

        leadSize: 21,        // «подводка» (жирный абзац-врез)
        leadLine: 1.5,
        leadWeight: 700,

        h1Size: 40,          // заголовок статьи
        h1Line: 1.12,
        h1Weight: 700,
        h1Tracking: '-0.015em', // крупный кегль требует отрицательного трекинга

        h2Size: 28,          // подзаголовки внутри текста
        h2Line: 1.25,
        h2Weight: 700,

        h3Size: 22,
        h3Line: 1.3,
        h3Weight: 700,

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
           МЕЛОЧИ ДЛЯ 4K
           ============================================================ */
        .article-image-container img,
        .article-feature-item img {
            max-width: 100% !important;
            height: auto !important;
        }
        .main > .aside {
            min-width: 300px !important;
            max-width: 300px !important;
        }
        .bside { min-width: 300px !important; }

        ${!CONFIG.hideFooter ? `
        .footer-container {
            max-width: ${CONFIG.maxContentWidth}px !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }
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

        console.log('%c[RBC 4K Enhancer v3] Активирован', 'color: #00ff41; font-size: 14px; font-weight: bold;');
    });

    // =========================================================================
    //  Утилиты
    // =========================================================================
    function isArticlePath(path) {
        return /^\/(politics|economics|society|business|technology|finances|life|auto|sport|style|rbcfreenews|crypto)\//.test(path);
    }

})();
