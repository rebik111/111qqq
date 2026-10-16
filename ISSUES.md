# ISSUES & PLAN — Kyivstar TV LAMPA port

Це робочий список знайдених проблем, ризиків та план виправлень для порту Kyivstar TV з оригінального LAMPA плагіна (dxnsav) та Kodi-реалізації (TVHomeNetwork). Файл згенеровано як частина роботи в гілці `lampa-port` репозиторію.

Мета: виправити всі критичні баги оригіналу, зробити модульну, безпечнішу і більш офіційно схожу версію плагіна для LAMPA з повним EPG + catchup, категоріями каналів і можливістю локальних доповнень.

---

## Резюме головних проблем (високий пріоритет)

1. Зберігання чутливих даних у Lampa.Storage у відкритому вигляді
   - Пароль особового рахунку та sessionId зберігаються у Storage (plaintext). Необхідно:
     - Чітко інформувати користувача (UI) про зберігання.
     - Впровадити можливість TTL/in-memory session або явного видалення сесій.

2. OTP / pending phone session логіка
   - OTP зберігається у Storage до ручного очищення — ризик витоку.
   - Потрібно автоматично інвалідовувати OTP через таймаут (наприклад 10–15 хв), очищати pendingPhoneSession після успішного логіну.

3. Відсутність глобального timeout для fetch
   - Потенційні зависання запитів. Використати AbortController з таймаутом та повертати дружні помилки користувачу.

4. Монолітний single-file код (main.js) — важко підтримувати
   - Розбити на модулі: api, ui, epg, storage, utils, logger.

5. Кешування з довгими TTL за замовчуванням
   - CACHE_CHANNELS_MS = 15min, CACHE_CATALOG_MS = 60min — для live-контенту треба дозволити більш часті оновлення і можливість ручного refresh.

6. Логування і діагностика зберігається за замовчуванням
   - Логи містять sanitized дані, але все одно ризики; зберігати логи опційно та додати політику очищення.

7. DOM-вставки без додаткового санітайзу
   - Використовується jQuery для вставки HTML; потрібно уникати вставки неперевіреного HTML і санітайзити поля з API.

8. Play URL декорація (параметри UA/Referer) через ``|User-Agent=...`` — працює не на всіх платформах
   - Додати перевірку середовища та fallback. Забезпечити опцію увімк/вимк у налаштуваннях.

---

## Середній пріоритет

1. Дублювання запитів для відтворення — недостатньо стійкий debouncing
   - playRequestLock на 1200ms може пропустити повільні системи. Замінимо на токен/Abort для попереднього запиту.

2. Недостатня обробка помилок (retry, backoff)
   - Для 429 робиться simple delay 10s; впровадити експоненціальне повторення з лімітом і явне повідомлення юзеру.

3. CORS proxy опція без попередження
   - Користувач може вказати небезпечний проксі — додати попередження і рекомендації щодо самообслуговуваного проксі.

4. Кеш-ключі і управління кешем
   - Запровадити централізований кеш-менеджер з можливістю інвалідизації через UI (Refresh channels / Refresh EPG).

---

## Низький пріоритет / покращення UX

1. Поліпшити message UX для OTP (вказати таймер, інструкції по повторному запиту)
2. Поліпшити інтеграцію з Lampa.Activity / full-card — повністю тестувати в appready
3. Налагодити обмеження розміру логів і зручну експортну функцію для діагностики

---

## EPG / ARCHIVE — архітектура та план міграції (повноцінний EPG + catchup)

Вихідні умови: Kodi використовував SQLite; у LAMPA немає прямого доступу до файлової СУБД у sandboxed env — беремо IndexedDB (для даних) та Lampa.Storage для конфіг.

Схема:
- БД: indexedDB `kyivstar_epg` версія 1
  - store `channels` (keyPath: assetId) — метадані каналу, lastUpdate
  - store `programs` (keyPath: programId) — програми/епізоди, з колонками: programId, channelAssetId, start, end, title, description, raw (оригінал)

Функції:
- Імпорт EPG (fetch списку каналів -> запити per-channel для програм) з batching і rate-limit керуванням.
- Scheduled update: service-like планувальник з throttling (щоденне оновлення або user-triggered) — Lampa не дає background service, тому плануємо оновлення при запуску та за розкладом якщо користувач запустить додаток.
- Catchup: зберігати asset->video mapping і відтворювати через play flow з date params (виводити playlist.m3u8 або direct stream URL), реалізувати сегментну логіку по можливості.

Міграція:
- Написати імпортер, який читатиме Kodi M3U/EPG (якщо користувач має локальний експорт) або з Kyivstar API збудує IndexedDB.
- Додати UI для керування (Reset archive, Re-download EPG for channel, Select channels to include).

---

## Channel manager & Categories

Підхід: комбінований
- Джерело правди: Kyivstar API (live groups / compilations)
- Місцеві доповнення/переклади/переурядка: Lampa.Storage + indexDB mapping

Функції:
- Завантажити групи з API (getLiveChannelGroups)
- Дозволити локальні групи, reorder, enable/disable каналів
- Експорт M3U для IPTV Simple Client — додати можливість генерувати M3U локально і скачати

---

## Безпека та конфіденційність

- Зберігаємо сесію/пароль у Lampa.Storage (за вашою згодою), але додаємо:
  - опцію "зберігати пароль" (on/off),
  - TTL для pending OTP (10–15 хв),
  - кнопку експліцитного logout + очистки local cache/EPG,
  - можливість експорт/імпорту лише метаданів (без паролів/sessions).

---

## Тестування

- Тестовий стенд: http://lampa.mx — ви вже дали доступ в Opera.
- Юніт/статичні тести: ESLint додано; пізніше додамо basic jest/mocha для утиліт якщо потрібно.
- Ручні сценарії: login flows (anonymous/account/phone OTP), browse categories, search, open full card, open seasons, play VOD, play Live Channel, generate M3U, EPG import & program lookup, catchup playback.

---

## План дій (покроково)

1. Форкнути 3–4 приклади LAMPA TV плагінів + Jellyfin плагін у вашому акаунті (виконую зараз).
2. Детальний аудит issues + складання списку задач (це файл) — завершено (цей файл).
3. Рефакторинг: розбиття monolith → модулі (src/kyivstar_api.js, src/epg/*, src/ui/*) — вже почато (скелет).
4. Реалізація auth flows з TTL & timeout; fetch timeout через AbortController.
5. Реалізація IndexedDB EPG + initial importer (по каналу), UI для перегляду і catchup.
6. Channel manager: categories + local overrides + M3U generator.
7. Тестування в Lampa, фікси.
8. Підготовка великого PR у `lampa-port`.

---

Якщо є пріоритетні задачі або додаткові вимоги — скажіть зараз. Я починаю форкати приклади та виконувати глибокий аудит (шукатиму GitHub issues, Telegram threads, форуми). Перший проміжний звіт з результатами аудиту і списком завдань дам протягом 24 годин.
