# Userscripts

Мои юзерскрипты для Tampermonkey. Обновляются автоматически из этого репозитория.

| Скрипт | Сайт | Установить |
|---|---|---|
| RBC 4K Enhancer | rbc.ru | [install](https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/userscripts/main/rbc-4k-enhancer.user.js) |
| majors.im — Clean Bracket View | majors.im | [install](https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/userscripts/main/majors-clean-bracket.user.js) |

## Как это работает

В шапке каждого скрипта есть:

```
// @updateURL    https://raw.githubusercontent.com/.../script.user.js
// @downloadURL  https://raw.githubusercontent.com/.../script.user.js
```

`@updateURL` — откуда Tampermonkey забирает **только шапку** и сравнивает `@version`.
`@downloadURL` — откуда качает полный файл, если версия выросла.

## Правила

1. **Всегда поднимай `@version` при правке.** Не поднял — обновления не будет,
   Tampermonkey сравнивает именно номер версии, а не содержимое файла.
   Схема semver: `3.0.0` → `3.0.1` (фикс) → `3.1.0` (новая опция) → `4.0.0` (переделка).
2. Репозиторий должен быть **публичным** — Tampermonkey ходит за файлом без авторизации.
3. `raw.githubusercontent.com` кэшируется CDN ~5 минут. Обновление доедет не мгновенно.

## Настройки Tampermonkey (один раз в каждом браузере)

Dashboard → **Настройки** → режим отображения **Расширенный**:

- `Обновления` → **Интервал проверки внешних скриптов**: `Каждый день` (или `Каждый час`)
- `Обновления` → **Уведомлять об обновлениях скриптов**: по вкусу

Принудительная проверка сейчас: Dashboard → вкладка **Установленные скрипты** →
кнопка с двумя стрелками (⟳) в правом верхнем углу.

## Установка на новой машине

Открыть install-ссылку из таблицы выше → Tampermonkey сам предложит установку.
Скрипт сразу приходит с прописанным `@updateURL`, дальше обновляется сам.
