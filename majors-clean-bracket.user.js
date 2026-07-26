// ==UserScript==
// @name         majors.im — Clean Bracket View
// @namespace    https://majors.im/
// @version      1.1.0
// @description  Убирает рекламу, боковые блоки и оверлеи на majors.im, оставляя только турнирную сетку и Pick'em
// @author       Nikita
// @match        https://majors.im/*
// @grant        GM_addStyle
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/userscripts/main/majors-clean-bracket.user.js
// @downloadURL  https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/userscripts/main/majors-clean-bracket.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Инжектируем стили сразу, до рендера ──────────────────────────────────
    GM_addStyle(`
        /* === Боковые рекламные блоки (aside) === */
        aside.siderad-container,
        aside.siderad-banner,
        .siderad-frame {
            display: none !important;
        }

        /* === Перестраиваем grid-лейаут: убираем боковые колонки === */
        .outer {
            display: block !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
        }

        /* === Убираем класс with-sider, который добавляет отступы под сайдбар === */
        .content-container.with-sider {
            width: 100% !important;
            max-width: 100% !important;
        }

        /* === Нижняя рекламная полоса (bottom-desktop, bottom-banner-row) === */
        .bottom-desktop,
        .bottom-banner-row,
        .bottom-banner-frame {
            display: none !important;
        }

        /* === Горизонтальный рекламный aside внутри контента === */
        aside[aria-label="Advertisement"],
        aside[aria-label="Advertisement 1"],
        aside[aria-label="Advertisement 2"] {
            display: none !important;
        }

        /* === Google AdSense блоки === */
        .adsbygoogle,
        ins.adsbygoogle {
            display: none !important;
        }

        /* === Оверлей «Sponsored links» / Google Anno === */
        #google-anno-sa,
        #google-anno-sa * {
            display: none !important;
        }

        /* === Плавающие iframe-оверлеи от рекламных сетей === */
        body > iframe,
        body > div[id^=":r"] > iframe {
            display: none !important;
        }

        /* === Блок «Sponsored topics» под контентом === */
        .bottom-banner-row [aria-label="Sponsored links"],
        [data-ad], [data-ad-slot], [data-ad-client] {
            display: none !important;
        }

        /* === Убираем горизонтальный скролл у страницы в целом === */
        html, body {
            overflow-x: hidden !important;
        }
    `);

    // ── Дополнительная чистка через DOM после загрузки ───────────────────────
    function cleanDOM() {

        // 1. Все aside-реклама
        document.querySelectorAll('aside.siderad-container, aside.siderad-banner').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 2. Перестроить .outer: убрать grid с колонками боковых панелей
        const outer = document.querySelector('.outer');
        if (outer) {
            outer.style.setProperty('display', 'block', 'important');
            outer.style.setProperty('max-width', '100%', 'important');
            outer.style.setProperty('overflow-x', 'hidden', 'important');
        }

        // 3. Убрать .with-sider ограничение у основного контейнера
        const contentContainer = document.querySelector('.content-container');
        if (contentContainer) {
            contentContainer.style.setProperty('width', '100%', 'important');
            contentContainer.style.setProperty('max-width', '100%', 'important');
        }

        // 4. Нижняя рекламная полоса
        document.querySelectorAll('.bottom-desktop, .bottom-banner-row').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 5. AdSense блоки
        document.querySelectorAll('.adsbygoogle, ins.adsbygoogle').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 6. Google Annotation оверлей (всплывающий блок «Sponsored links»)
        const googleAnno = document.getElementById('google-anno-sa');
        if (googleAnno) {
            googleAnno.style.setProperty('display', 'none', 'important');
        }

        // 7. Clash.gg / сторонние баннеры внутри iframe
        document.querySelectorAll('iframe.siderad-frame, iframe[src*="clash.gg"], iframe[src*="acebet"]').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        // 8. «Sponsored links» блок (нижний)
        document.querySelectorAll('[aria-label="Sponsored links"]').forEach(el => {
            const wrapper = el.closest('.bottom-banner-row') || el.closest('.bottom-desktop') || el;
            wrapper.style.setProperty('display', 'none', 'important');
        });
    }

    // Запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanDOM);
    } else {
        cleanDOM();
    }

    // Наблюдатель: сайт — SPA (React), реклама может подгружаться динамически.
    // Троттлим через requestAnimationFrame, чтобы не жечь CPU на каждой мутации.
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; cleanDOM(); });
    });

    // Запускаем наблюдатель как только появится body
    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            requestAnimationFrame(startObserver);
        }
    };
    startObserver();

})();
