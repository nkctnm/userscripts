# Селекторы, на которых держится скрипт

Фикстуры фиксируют эти имена классов. Если РБК их переименует, тесты
останутся зелёными, а на живом сайте сломается. Поэтому список надо
периодически сверять с сайтом.

## Как сверить

Открыть в браузере главную rbc.ru и любую статью, вставить в консоль:

```js
const EXPECT = {
  '/': {
    '.main > aside.aside': 1,
    '[class*="styles_newsfeed__"]': 1,
    'article.info-block': 50,
    'a.info-block-title': 50,
    '.meta-info-row-date': 50,
    '.news-line-wrapper': 10,
    '.news-line-link': 10,
    '.collection-new-item-link': 1,
    '.central-publisher-item': 1,
    'a.meta-info-row-project': 1,
    '.labels-item-pro': 1,
    '.content-custom': 1,
    'aside.bside': 1,
    '.site-header': 1,
    '.topline-desktop': 1,
    '.fox-tail': 1,
  },
  article: {
    '.article-feature-item': 1,
    'h1.article-entry-title': 1,
    'p.paragraph': 3,
    '[class*="styles_lead__"]': 1,
    '.article-image .article-image-container': 1,
    '[class*="material-meta"]': 1,
    '.article-entry-leadText': 1,
    '.site-header': 1,
    '.column-central-plus-side': 1,
    '.main-content': 1,
  },
};
const isArticle = /\/\d{2}\/\d{2}\/\d{4}\//.test(location.pathname);
const table = Object.entries(EXPECT[isArticle ? 'article' : '/'])
  .map(([sel, min]) => {
    const n = document.querySelectorAll(sel).length;
    return { селектор: sel, найдено: n, 'нужно ≥': min, статус: n >= min ? 'ок' : 'ПРОПАЛ' };
  });
console.table(table);
console.log('пропало:', table.filter(r => r.статус !== 'ок').length);
```

Если что-то в статусе `ПРОПАЛ` — сначала чиним селектор и фикстуру, потом
всё остальное.

## Отдельно про рекламу

Значения снимались 27–29 июля 2026 на живых страницах:

- `.fox-tail` — контейнер AdFox, на статье их было **117**, суммарная
  высота **67 000 px**;
- `[id^="yandex_rtb_"]` — слоты Яндекс.РТБ, 4 штуки на статью;
- сторонние хосты: `an.yandex.ru`, `yastatic.net/pcode`, `24smi.net`,
  `weborama-tech.ru`, `top-fwz1.mail.ru`.

Проверка «сколько осталось видимой рекламы» на живой странице:

```js
[...document.querySelectorAll('.fox-tail,[id^="yandex_rtb_"],[class*="24smi"]')]
  .filter(e => e.getBoundingClientRect().height > 0).length   // должно быть 0
```

## Материалы Pro

- `a.meta-info-row-project` — подпись «Подписка на РБК» под карточкой.
  На 29.07.2026: 52 штуки на главной, **все** ведут на `pro.rbc.ru`.
- `.labels-item-pro` — значок в строках блока «Главное».

Проверка, что маркер по-прежнему честный:

```js
const links = [...document.querySelectorAll('a.meta-info-row-project')];
const hosts = new Set(links.map(a => new URL(a.href).hostname));
console.log(links.length, [...hosts]);   // ожидаем только pro.rbc.ru
```
