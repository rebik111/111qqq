(function () {
    'use strict';

    /* ═════════════════════════════════════════════════════════════════
       KYIVSTAR TV — плагін для Lampa / MSX (повний рефакторинг)
       ════════════════════════════════════════════════════════════════ */

    var I18N = {
        "en": {
            "menu_live_tv": "Live TV",
            "menu_channels": "TV Channels",
            "menu_epg": "TV Guide",
            "menu_catchup": "Catchup / Archive",
            "menu_settings": "Settings",
            "category_all": "All channels",
            "category_free": "Free channels",
            "category_live": "Live channels",
            "channel_unavailable": "Channel is not available",
            "loading_channels": "Loading channels...",
            "loading_epg": "Loading TV guide...",
            "epg_today": "Today",
            "epg_tomorrow": "Tomorrow",
            "catchup_date": "Select date",
            "catchup_unavailable": "Catchup is not available for this channel",
            "stream_error": "Failed to load stream",
            "try_another": "Try another stream version",
            "anonymous": "Anonymous",
            "account": "Personal account",
            "phone_otp": "Phone OTP",
            "qr_code": "QR Code",
            "login_required": "Login required",
            "session_refreshed": "Session refreshed",
            "session_cleared": "Session cleared",
            "pin_required": "PIN code required",
            "pin_wrong": "Wrong PIN code",
            "m3u_export": "Export M3U",
            "stream_proxy": "Local stream proxy",
            "app_ready": "Kyivstar TV plugin loaded"
        },
        "ru": {
            "menu_live_tv": "Живое ТВ",
            "menu_channels": "ТВ каналы",
            "menu_epg": "Телепрограмма",
            "menu_catchup": "Архив / Catchup",
            "menu_settings": "Настройки",
            "category_all": "Все каналы",
            "category_free": "Бесплатные каналы",
            "category_live": "Эфирные каналы",
            "channel_unavailable": "Канал недоступен",
            "loading_channels": "Загрузка каналов...",
            "loading_epg": "Загрузка телепрограммы...",
            "epg_today": "Сегодня",
            "epg_tomorrow": "Завтра",
            "catchup_date": "Выбрать дату",
            "catchup_unavailable": "Архив недоступен для этого канала",
            "stream_error": "Ошибка загрузки потока",
            "try_another": "Попробовать другую версию потока",
            "anonymous": "Анонимно",
            "account": "Лицевой счет",
            "phone_otp": "Телефонный OTP",
            "qr_code": "QR-код",
            "login_required": "Требуется вход",
            "session_refreshed": "Сессия обновлена",
            "session_cleared": "Сессия очищена",
            "pin_required": "Требуется PIN-код",
            "pin_wrong": "Неверный PIN-код",
            "m3u_export": "Экспорт M3U",
            "stream_proxy": "Локальный прокси потока",
            "app_ready": "Плагин Kyivstar TV загружен"
        },
        "uk": {
            "menu_live_tv": "Живе ТБ",
            "menu_channels": "ТБ канали",
            "menu_epg": "Телепередачі",
            "menu_catchup": "Архів / Catchup",
            "menu_settings": "Налаштування",
            "category_all": "Усі канали",
            "category_free": "Безкоштовні канали",
            "category_live": "Ефірні канали",
            "channel_unavailable": "Канал недоступний",
            "loading_channels": "Завантаження каналів...",
            "loading_epg": "Завантаження телепрограми...",
            "epg_today": "Сьогодні",
            "epg_tomorrow": "Завтра",
            "catchup_date": "Обрати дату",
            "catchup_unavailable": "Архів недоступний для цього канала",
            "stream_error": "Помилка завантаження потоку",
            "try_another": "Спробувати іншу версію потоку",
            "anonymous": "Анонімно",
            "account": "Особовий рахунок",
            "phone_otp": "Телефонний OTP",
            "qr_code": "QR-код",
            "login_required": "Потрібний вхід",
            "session_refreshed": "Сесію оновлено",
            "session_cleared": "Сесію очищено",
            "pin_required": "Потрібен PIN-код",
            "pin_wrong": "Невірний PIN-код",
            "m3u_export": "Експорт M3U",
            "stream_proxy": "Локальний проксі потоку",
            "app_ready": "Плагін Kyivstar TV завантажено"
        }
    };

    /* ═════════════════════════════════════════════════════════════════
       КОНСТАНТИ
       ════════════════════════════════════════════════════════════════ */
    var PLUGIN_BUILD = '2026-06-10-refactored-live-tv';
    var PLUGIN_FLAG = '__kyivstar_tv_lampa_loaded_' + PLUGIN_BUILD;
    var COMPONENT = 'kyivstar_tv';
    var TITLE = 'Kyivstar TV';
    var ASSET_BASE = 'https://dxnsav.github.io/plugin.video.kyivstar.tv/plugin.kyivstar.tv/assets/';
    var API_BASE = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_BASE = 'https://kyivstar-auth.production.vidmind.com/kyivstar-auth/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
    var DEFAULT_LOCALE = 'uk_UA';
    var USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0';
    var REFERER = 'https://tv.kyivstar.ua/';
    var LIMIT = 50;
    var CACHE_CHANNELS_MS = 15 * 60 * 1000;
    var CACHE_CATALOG_MS = 60 * 60 * 1000;
    var MAX_LOGS = 120;

    var KEYS = {
        loginType: 'kyivstar_login_type',
        username: 'kyivstar_username',
        password: 'kyivstar_password',
        phone: 'kyivstar_phone',
        otp: 'kyivstar_otp',
        locale: 'kyivstar_locale',
        deviceId: 'kyivstar_device_id',
        proxy: 'kyivstar_proxy',
        appendHeaders: 'kyivstar_append_stream_headers',
        session: 'kyivstar_session',
        pendingPhoneSession: 'kyivstar_pending_phone_session',
        cacheKeys: 'kyivstar_cache_keys',
        logs: 'kyivstar_logs',
        pinCode: 'kyivstar_pin_code',
        streamProxy: 'kyivstar_stream_proxy',
        m3uExport: 'kyivstar_m3u_export',
        epgDate: 'kyivstar_epg_date'
    };

    var DEFAULTS = {};
    DEFAULTS[KEYS.loginType] = 'anonymous';
    DEFAULTS[KEYS.username] = '';
    DEFAULTS[KEYS.password] = '';
    DEFAULTS[KEYS.phone] = '';
    DEFAULTS[KEYS.otp] = '';
    DEFAULTS[KEYS.locale] = DEFAULT_LOCALE;
    DEFAULTS[KEYS.deviceId] = '';
    DEFAULTS[KEYS.proxy] = '';
    DEFAULTS[KEYS.appendHeaders] = true;
    DEFAULTS[KEYS.session] = null;
    DEFAULTS[KEYS.pendingPhoneSession] = null;
    DEFAULTS[KEYS.cacheKeys] = [];
    DEFAULTS[KEYS.logs] = [];
    DEFAULTS[KEYS.pinCode] = '';
    DEFAULTS[KEYS.streamProxy] = false;
    DEFAULTS[KEYS.m3uExport] = '';
    DEFAULTS[KEYS.epgDate] = '';

    /* ═════════════════════════════════════════════════════════════════
       ДОПОМІЖНІ ФУНКЦІЇ
       ════════════════════════════════════════════════════════════════ */

    function t(key, params) {
        var lang = getLang();
        var value = I18N[lang] && I18N[lang][key] ? I18N[lang][key] : '';
        if (!value && I18N.uk && I18N.uk[key]) value = I18N.uk[key];
        if (!value && I18N.en && I18N.en[key]) value = I18N.en[key];
        if (!value) value = key;
        params = params || {};
        return String(value).replace(/\{([^}]+)\}/g, function (match, name) {
            return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match;
        });
    }

    function getLang() {
        var candidates = [
            safeStorage('language'),
            safeStorage('lang'),
            safeStorage('language_app'),
            safeStorage('interface_language'),
            Lampa.Lang && (Lampa.Lang.lang || Lampa.Lang.code || Lampa.Lang.language),
            setting(KEYS.locale)
        ];
        for (var i = 0; i < candidates.length; i++) {
            var l = String(candidates[i] || '').toLowerCase();
            if (!l) continue;
            if (l.indexOf('uk') === 0 || l.indexOf('ua') === 0) return 'uk';
            if (l.indexOf('ru') === 0) return 'ru';
            if (l.indexOf('en') === 0) return 'en';
        }
        return 'uk';
    }

    function safeStorage(key) {
        try { return Lampa.Storage ? Lampa.Storage.get(key, '') : ''; } catch (e) { return ''; }
    }

    function setting(name) { return Lampa.Storage.get(name, DEFAULTS[name]); }
    function boolSetting(name) {
        var v = setting(name);
        return v === true || v === 'true' || v === 1 || v === '1';
    }
    function saveSetting(name, value) { Lampa.Storage.set(name, value); }

    function log(m) {
        try { console.log('[KyivstarTV] ' + m); } catch (e) {}
    }
    function debugLog(level, event, details) {
        var entry = { time: new Date().toISOString(), level: level || 'info', event: event || 'event', details: details || {} };
        var logs = setting(KEYS.logs) || [];
        logs.push(entry);
        while (logs.length > MAX_LOGS) logs.shift();
        saveSetting(KEYS.logs, logs);
        var line = '[KyivstarTV] ' + entry.level.toUpperCase() + ' ' + entry.event + ' ' + JSON.stringify(entry.details);
        if (entry.level === 'error') console.error(line);
        else if (entry.level === 'warn') console.warn(line);
        else console.log(line);
    }
    function notify(msg) {
        if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg);
        else log(msg);
    }

    function uuid() {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function ensureDeviceId() {
        if (!setting(KEYS.deviceId)) saveSetting(KEYS.deviceId, uuid());
    }

    function sanitizeUrl(url) {
        return String(url || '')
            .replace(/jsessionid=[^?&]+/g, 'jsessionid=***')
            .replace(/([?&]otp=)[^&]+/g, '$1***')
            .replace(/([?&]pin=)[^&]+/g, '$1***');
    }

    function applyProxy(url) {
        var p = setting(KEYS.proxy);
        if (!p) return url;
        if (p.indexOf('{url}') !== -1) return p.replace('{url}', encodeURIComponent(url));
        return p.replace(/\/?$/, '/') + encodeURIComponent(url);
    }

    function decorateStreamUrl(url) {
        if (!url) return url;
        if (!boolSetting(KEYS.appendHeaders)) return url;
        if (url.indexOf('|') !== -1) return url;
        return url + '|User-Agent="' + encodeURIComponent(USER_AGENT) + '"&Referer="' + encodeURIComponent(REFERER) + '"';
    }

    function delay(ms) {
        return new Promise(function (res) { setTimeout(res, ms); });
    }

    /* ═════════════════════════════════════════════════════════════════
       KYIVSTAR API КЛІЄНТ
       ════════════════════════════════════════════════════════════════ */

    function KyivstarApi() {
        this.network = Lampa.Reguest ? new Lampa.Reguest() : null;
    }

    KyivstarApi.prototype.headers = function () {
        return {
            'x-vidmind-device-id': setting(KEYS.deviceId),
            'x-vidmind-device-type': 'WEB',
            'x-vidmind-image-sizes': '2_3_XL,16_9_XL,16_9_L,1_1_XL',
            'x-vidmind-locale': setting(KEYS.locale),
            'Origin': 'https://tv.kyivstar.ua',
            'Referer': 'https://tv.kyivstar.ua/'
        };
    };

    KyivstarApi.prototype.url = function (path) {
        return applyProxy(API_BASE + path);
    };

    KyivstarApi.prototype.request = function (path, options) {
        var self = this;
        var retries = options && options.retries !== undefined ? options.retries : 2;
        var requestOptions = Object.assign({ headers: this.headers() }, options || {});

        function run(attempt) {
            return requestTransport(self.network, self.url(path), requestOptions).catch(function (error) {
                if (error.status === 429 && attempt < retries) {
                    return delay(10000).then(function () { return run(attempt + 1); });
                }
                throw error;
            });
        }
        return run(0);
    };

    KyivstarApi.prototype.withSession = function (handler, retry) {
        var self = this;
        return this.ensureSession(false).then(function (session) {
            return Promise.resolve(handler(session)).catch(function (error) {
                if (error.status === 401 && retry !== false) {
                    return self.ensureSession(true).then(function (newSession) { return handler(newSession); });
                }
                throw error;
            });
        });
    };

    KyivstarApi.prototype.ensureSession = function (force) {
        var current = setting(KEYS.session);
        if (!force && current && current.sessionId && current.userId) return Promise.resolve(current);

        var loginType = setting(KEYS.loginType);
        var loginPromise;
        if (loginType === 'account') loginPromise = this.loginAccount();
        else if (loginType === 'phone') loginPromise = this.loginPhone();
        else loginPromise = this.loginAnonymous();

        return loginPromise.then(function (profile) {
            if (!profile || !profile.userId || !profile.sessionId) throw new Error(t('login_required'));
            saveSetting(KEYS.session, { userId: profile.userId, sessionId: profile.sessionId });
            return setting(KEYS.session);
        });
    };

    KyivstarApi.prototype.loginAnonymous = function () {
        debugLog('info', 'auth:anonymous:start', {});
        return this.request('authentication/login', {
            method: 'POST',
            form: { username: AUTH_REALM + '\\anonymous', password: 'anonymous' }
        }).then(function (profile) {
            debugLog('info', 'auth:anonymous:ok', { userId: profile && profile.userId });
            return profile;
        });
    };

    KyivstarApi.prototype.loginAccount = function () {
        var self = this;
        var username = setting(KEYS.username);
        var password = setting(KEYS.password);
        if (!username || !password) return Promise.reject(new Error(t('account_password_required')));
        return this.loginAnonymous().then(function (anonymous) {
            return self.request('authentication/login/v3;jsessionid=' + encodeURIComponent(anonymous.sessionId), {
                method: 'POST',
                form: { username: AUTH_REALM + '\\' + username, password: password }
            });
        });
    };

    KyivstarApi.prototype.loginPhone = function () {
        var self = this;
        var phone = String(setting(KEYS.phone) || '').replace(/\D/g, '');
        var otp = setting(KEYS.otp);
        var pending = setting(KEYS.pendingPhoneSession);
        if (!phone) return Promise.reject(new Error(t('phone_required')));
        return this.ensurePhonePendingSession().then(function (phoneSession) {
            if (!otp) {
                return self.sendOtp(phoneSession.sessionId, phone).then(function () {
                    throw new Error(t('sms_sent_enter_refresh'));
                });
            }
            return self.request('authentication/login/v3;jsessionid=' + encodeURIComponent(phoneSession.sessionId), {
                method: 'POST',
                form: { username: AUTH_REALM + '\\' + phone, otp: otp }
            }).then(function (profile) {
                saveSetting(KEYS.otp, '');
                saveSetting(KEYS.pendingPhoneSession, null);
                return profile;
            });
        });
    };

    KyivstarApi.prototype.ensurePhonePendingSession = function () {
        var pending = setting(KEYS.pendingPhoneSession);
        if (pending && pending.sessionId) return Promise.resolve(pending);
        return this.loginAnonymous().then(function (anonymous) {
            saveSetting(KEYS.pendingPhoneSession, anonymous);
            return anonymous;
        });
    };

    KyivstarApi.prototype.sendOtp = function (sessionId, phone) {
        phone = String(phone).replace(/\D/g, '');
        return this.request('v2/otp;jsessionid=' + encodeURIComponent(sessionId), {
            method: 'POST',
            json: { phoneNumber: phone, language: 'UK', channel: 'sms' },
            dataType: 'text'
        });
    };

    KyivstarApi.prototype.logout = function () {
        var session = setting(KEYS.session);
        saveSetting(KEYS.session, null);
        saveSetting(KEYS.pendingPhoneSession, null);
        if (session && session.userId && session.userId !== 'anonymous') {
            return this.request('authentication/logout;jsessionid=' + encodeURIComponent(session.sessionId) + '?sessionExpired=false', { dataType: 'text' }).catch(function () {});
        }
        return Promise.resolve();
    };

    KyivstarApi.prototype.getLiveChannelGroups = function () {
        var self = this;
        return this.cached('channel-groups', CACHE_CHANNELS_MS, function () {
            return self.withSession(function (session) {
                return self.request('v1/contentareas/LIVE_CHANNELS;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true&limit=100');
            });
        });
    };

    KyivstarApi.prototype.getGroupElements = function (groupId) {
        var self = this;
        return this.cached('group-' + groupId, CACHE_CHANNELS_MS, function () {
            return self.withSession(function (session) {
                return self.request('gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?offset=0&limit=500');
            });
        });
    };

    KyivstarApi.prototype.getContentAreas = function () {
        var self = this;
        return this.cached('contentareas-my-tv-web-v1', CACHE_CATALOG_MS, function () {
            return self.withSession(function (session) {
                return self.request('api/v2/contentareas/MY_TV_WEB;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true');
            });
        });
    };

    KyivstarApi.prototype.getContentAreaElements = function (compilation, filters, sort, offset, limit) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('api/v1/gallery/filters/content-area;jsessionid=' + encodeURIComponent(session.sessionId), {
                method: 'POST',
                json: {
                    compilationElementId: compilation,
                    filterElementIds: filters || [],
                    filterSortElementId: sort,
                    offset: offset || 0,
                    limit: limit || LIMIT,
                    sortOrder: null
                }
            });
        });
    };

    KyivstarApi.prototype.getContentGroupElements = function (groupId, filters, sort, offset, limit) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('api/v1/gallery/filters/content-group;jsessionid=' + encodeURIComponent(session.sessionId), {
                method: 'POST',
                json: {
                    contentGroupElementId: groupId,
                    filterElementIds: filters || [],
                    filterSortElementId: sort,
                    offset: offset || 0,
                    limit: limit || LIMIT,
                    sortOrder: null
                }
            });
        });
    };

    KyivstarApi.prototype.search = function (query) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('api/v1/search/predictive;jsessionid=' + encodeURIComponent(session.sessionId) + '?q=' + encodeURIComponent(query) + '&limit=50&includeLiveChannels=true');
        });
    };

    KyivstarApi.prototype.getAssetInfo = function (assetId) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('assets/v2;jsessionid=' + encodeURIComponent(session.sessionId) + '?movie=' + encodeURIComponent(assetId));
        });
    };

    KyivstarApi.prototype.getTvGroup = function (assetId, season, offset, limit) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('api/v1/gallery/tvgroup/' + encodeURIComponent(assetId) + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?seasonNumber=' + encodeURIComponent(season) + '&offset=' + encodeURIComponent(offset || 0) + '&limit=' + encodeURIComponent(limit || LIMIT));
        });
    };

    KyivstarApi.prototype.getStreamUrl = function (assetId, videoType) {
        var self = this;
        return this.withSession(function (session) {
            var version = session.userId === 'anonymous' ? '4' : '2';
            var isVirtual = videoType === 'VIRTUAL';
            var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
            if (isVirtual) path += '&date=-1000';
            return self.request(path, { retries: 0 }).then(function (data) {
                if (data && data.error) throw new Error(data.description || data.error);
                if (isVirtual && data && data.media && data.media[0] && data.media[0].url) {
                    return { url: data.media[0].url, quality: 'auto', subtitles: [] };
                }
                if (!isVirtual && data && data.liveChannelUrl) {
                    return { url: data.liveChannelUrl, quality: 'auto', subtitles: [] };
                }
                // Fallback: спробувати іншу версію
                if (version === '4') {
                    path = 'play/v2;jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
                    if (isVirtual) path += '&date=-1000';
                    return self.request(path, { retries: 0 }).then(function (data2) {
                        if (data2 && data2.error) throw new Error(data2.description || data2.error);
                        if (isVirtual && data2 && data2.media && data2.media[0] && data2.media[0].url) return { url: data2.media[0].url, quality: 'auto', subtitles: [] };
                        if (!isVirtual && data2 && data2.liveChannelUrl) return { url: data2.liveChannelUrl, quality: 'auto', subtitles: [] };
                        throw new Error(t('stream_error'));
                    });
                }
                throw new Error(t('stream_error'));
            });
        });
    };

    KyivstarApi.prototype.cached = function (name, ttl, loader) {
        var key = 'kyivstar_cache_' + name;
        var cached = Lampa.Storage.get(key, null);
        var now = Date.now();
        if (cached && cached.time && now - cached.time < ttl) return Promise.resolve(cached.value);
        return Promise.resolve(loader()).then(function (value) {
            Lampa.Storage.set(key, { time: now, value: value });
            rememberCacheKey(key);
            return value;
        });
    };

    KyivstarApi.prototype.clearCache = function () {
        setting(KEYS.cacheKeys).forEach(function (key) { Lampa.Storage.set(key, null); });
        saveSetting(KEYS.cacheKeys, []);
    };

    function rememberCacheKey(key) {
        var keys = setting(KEYS.cacheKeys);
        if (keys.indexOf(key) !== -1) return;
        keys.push(key);
        saveSetting(KEYS.cacheKeys, keys);
    }

    function requestTransport(network, url, options) {
        options = options || {};
        var method = options.method || 'GET';
        var headers = Object.assign({}, options.headers || {});
        var dataType = options.dataType || 'json';
        var postData = false;
        if (options.json !== undefined) {
            postData = JSON.stringify(options.json);
            headers['Content-Type'] = 'application/json';
        } else if (options.form) {
            postData = options.form;
        }
        return new Promise(function (resolve, reject) {
            var ok = function (data) {
                if (dataType === 'json' && typeof data === 'string') {
                    try { resolve(JSON.parse(data)); return; } catch (e) { reject(e); return; }
                }
                resolve(data);
            };
            var fail = function (error) {
                var normalized = new Error('Network request failed');
                if (error) {
                    normalized.status = error.status || error.decode_code;
                    normalized.body = error.responseJSON || error.responseText;
                    if (error.decode_error) normalized.message = error.decode_error;
                    else if (error.responseJSON && error.responseJSON.description) normalized.message = error.responseJSON.description;
                    else if (error.responseText) normalized.message = error.responseText;
                    else if (error.status) normalized.message = 'HTTP ' + error.status;
                }
                reject(normalized);
            };
            if (network && (network.native || network.silent)) {
                var m = network.native ? 'native' : 'silent';
                network.timeout(20000);
                network[m](url, ok, fail, postData, { type: method, headers: headers, dataType: dataType, timeout: 20000 });
                return;
            }
            fetch(url, {
                method: method,
                headers: headers,
                body: postData
            }).then(function (response) {
                if (!response.ok) {
                    var err = new Error('HTTP ' + response.status);
                    err.status = response.status;
                    return response.text().then(function (text) {
                        try { err.body = JSON.parse(text); } catch (e) { err.body = text; }
                        throw err;
                    });
                }
                if (dataType === 'text') return response.text();
                return response.json();
            }).then(ok).catch(fail);
        });
    }

    /* ═════════════════════════════════════════════════════════════════
       UI: ГОЛОВНЕ МЕНЮ, КАНАЛИ, EPG, CATCHUP
       ════════════════════════════════════════════════════════════════ */

    var channelsCache = [];
    var epgCache = {};

    function mapChannelItem(ch) {
        var images = ch.images || [];
        var logo = '';
        if (images.length) logo = images[0].url || '';
        var type = ch.type || {};
        var typeValue = type && type.value ? type.value : type;
        var purchased = ch.purchased !== false;
        var catchup = ch.catchupEnabled === true;
        return {
            id: ch.assetId,
            title: ch.name || ch.displayName || 'Channel',
            subtitle: typeValue || '',
            image: logo,
            assetId: ch.assetId,
            videoType: typeValue === 'VIRTUAL' ? 'VIRTUAL' : 'IP',
            locked: !purchased,
            catchup: catchup,
            group: ch.group || '',
            raw: ch
        };
    }

    function loadAllChannels(api) {
        debugLog('info', 'channels:load:start', {});
        return api.getLiveChannelGroups().then(function (groups) {
            var all = [];
            var promises = groups.map(function (g) {
                return api.getGroupElements(g.assetId || g.id).then(function (channels) {
                    (channels || []).forEach(function (ch) {
                        if (ch.purchased === false) return;
                        all.push(mapChannelItem(ch));
                    });
                });
            });
            return Promise.all(promises).then(function () { return all; });
        }).catch(function (err) {
            debugLog('error', 'channels:load:error', { error: err.message || String(err) });
            throw err;
        });
    }

    function getChannelsByCategory(category) {
        if (category === 'all') return channelsCache;
        if (category === 'free') return channelsCache.filter(function (c) { return !c.locked; });
        if (category === 'live') return channelsCache.filter(function (c) { return c.catchup || true; });
        return channelsCache;
    }

    function showChannelList(api, category) {
        notify(t('loading_channels'));
        var catName = { all: t('category_all'), free: t('category_free'), live: t('category_live') }[category] || t('category_all');
        var items = getChannelsByCategory(category).map(function (ch) {
            return {
                title: ch.title,
                subtitle: ch.subtitle + (ch.locked ? ' 🔒' : '') + (ch.catchup ? ' 📼' : ''),
                image: ch.image,
                assetId: ch.assetId,
                videoType: ch.videoType,
                locked: ch.locked,
                catchup: ch.catchup,
                onSelect: function () {
                    if (ch.locked) { notify(t('channel_unavailable')); return; }
                    playItem(api, ch);
                },
                onLongPress: function () {
                    showCatchupMenu(api, ch);
                }
            };
        });
        Lampa.Select.show({
            title: TITLE + ' — ' + catName,
            items: items,
            onBack: function () { showMainMenu(); }
        });
    }

    function showEPG(api) {
        notify(t('loading_epg'));
        var date = setting(KEYS.epgDate) || new Date().toISOString().slice(0, 10);
        api.getLiveChannelGroups().then(function (groups) {
            return Promise.all(groups.map(function (g) {
                return api.getGroupElements(g.assetId || g.id).then(function (channels) {
                    return (channels || []).filter(function (c) { return c.purchased !== false; }).map(function (c) {
                        return {
                            id: c.assetId,
                            title: c.name || c.displayName || 'Channel',
                            image: (c.images && c.images[0]) ? c.images[0].url : '',
                            date: date
                        };
                    });
                });
            })).then(function (grouped) {
                var flat = [].concat.apply([], grouped);
                epgCache[date] = flat;
                showEPGList(flat, date);
            });
        }).catch(function (err) {
            notify(err.message || t('stream_error'));
            debugLog('error', 'epg:load:error', { error: err.message || String(err) });
        });
    }

    function showEPGList(programs, date) {
        var items = programs.map(function (p) {
            return {
                title: p.title,
                subtitle: date,
                image: p.image,
                assetId: p.id,
                videoType: 'IP',
                onSelect: function () {
                    playCatchup(api, p.id, date);
                }
            };
        });
        Lampa.Select.show({
            title: t('menu_epg') + ' — ' + date,
            items: items,
            onBack: function () { showEPG(api); }
        });
    }

    function playCatchup(api, assetId, date) {
        notify(t('resolving_stream'));
        api.getStreamUrl(assetId, 'IP').then(function (stream) {
            var url = decorateStreamUrl(stream.url);
            if (date) url += '&catchup=' + encodeURIComponent(date);
            Lampa.Player.play({ title: 'Catchup ' + assetId, url: url, poster: '', timeline: false });
        }).catch(function (err) {
            notify(err.message || t('stream_error'));
        });
    }

    function showCatchupMenu(api, channel) {
        if (!channel.catchup) { notify(t('catchup_unavailable')); return; }
        var today = new Date().toISOString().slice(0, 10);
        var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        Lampa.Select.show({
            title: t('menu_catchup') + ' — ' + channel.title,
            items: [
                { title: t('epg_today') + ' (' + today + ')', date: today, assetId: channel.assetId },
                { title: t('epg_tomorrow') + ' (' + yesterday + ')', date: yesterday, assetId: channel.assetId },
                { title: t('catchup_date'), date: '', assetId: channel.assetId }
            ],
            onSelect: function (item) {
                if (!item.date) {
                    var d = window.prompt(t('catchup_date'), today);
                    if (d) playCatchup(api, channel.assetId, d);
                } else {
                    playCatchup(api, item.assetId, item.date);
                }
            }
        });
    }

    function playItem(api, item) {
        var key = item && item.assetId ? String(item.assetId) : '';
        var now = Date.now();
        if (key && playLock.key === key && now - playLock.time < 1200) return Promise.resolve();
        playLock = { key: key, time: now };
        notify(t('resolving_stream'));
        return api.getStreamUrl(item.assetId, item.videoType).then(function (stream) {
            var url = decorateStreamUrl(stream.url);
            Lampa.Player.play({ title: item.title, url: url, poster: item.image || '', timeline: false });
        }).catch(function (err) {
            notify(err.message || t('stream_error'));
            debugLog('error', 'play:error', { assetId: item.assetId, error: err.message || String(err) });
        });
    }

    var playLock = { key: '', time: 0 };

    /* ═════════════════════════════════════════════════════════════════
       НАЛАШТУВАННЯ
       ════════════════════════════════════════════════════════════════ */

    var settingsAdded = false;

    function addSettings() {
        if (settingsAdded) return;
        if (!Lampa.SettingsApi || !Lampa.SettingsApi.addParam) { setTimeout(addSettings, 500); return; }
        try {
            if (Lampa.SettingsApi.removeComponent) Lampa.SettingsApi.removeComponent(COMPONENT);
            else if (Lampa.SettingsApi.removeParams) Lampa.SettingsApi.removeParams(COMPONENT);

            if (Lampa.SettingsApi.addComponent) {
                Lampa.SettingsApi.addComponent({ component: COMPONENT, name: TITLE, icon: iconSvg() });
            }

            addParam({ name: KEYS.loginType, type: 'select', values: { anonymous: t('anonymous'), account: t('account'), phone: t('phone_otp') }, default: DEFAULTS[KEYS.loginType] }, t('login_type'), t('login_type_description'));
            addParam({ name: KEYS.username, type: 'input', default: '' }, t('personal_account'), t('personal_account_description'), clearSession);
            addParam({ name: KEYS.password, type: 'input', default: '', password: true }, t('password'), t('password_description'), clearSession);
            addParam({ name: KEYS.phone, type: 'input', default: '' }, t('phone_number'), t('phone_description'), clearSession);
            addParam({ name: KEYS.otp, type: 'input', default: '' }, t('sms_code'), t('sms_code_description'));
            addParam({ name: KEYS.locale, type: 'select', values: { uk_UA: t('language_uk'), en_US: t('language_en'), ru_RU: t('language_ru') }, default: DEFAULT_LOCALE }, t('locale'), t('locale_description'), clearSession);
            addParam({ name: KEYS.proxy, type: 'input', default: '' }, 'CORS proxy', t('cors_proxy_description'));
            addParam({ name: KEYS.appendHeaders, type: 'trigger', default: true }, t('append_stream_headers'), t('append_stream_headers_description'));
            addParam({ name: KEYS.streamProxy, type: 'trigger', default: false }, t('stream_proxy'), t('stream_proxy_description'));
            addParam({ name: KEYS.pinCode, type: 'input', default: '' }, t('pin_required'), t('pin_wrong'));
            addParam({ name: 'kyivstar_send_sms', type: 'button' }, t('send_sms_code_now'), t('send_sms_code_description'), function () { sendSmsCode(new KyivstarApi()); });
            addParam({ name: 'kyivstar_refresh_session', type: 'button' }, t('refresh_session'), t('refresh_session_description'), function () { refreshSession(new KyivstarApi()); });
            addParam({ name: 'kyivstar_channels', type: 'button' }, t('menu_channels'), 'Завантажити список каналів', function () { loadChannelsMenu(new KyivstarApi()); });
            addParam({ name: 'kyivstar_epg', type: 'button' }, t('menu_epg'), t('loading_epg'), function () { showEPG(new KyivstarApi()); });
            addParam({ name: 'kyivstar_logout', type: 'button' }, t('logout_clear_session'), t('logout_clear_session_description'), function () { logout(new KyivstarApi()); });

            settingsAdded = true;
            debugLog('info', 'settings:added', {});
        } catch (e) { log('settings registration skipped: ' + e.message); }
    }

    function addParam(param, name, description, onChange) {
        if (param.type === 'input' && typeof param.values === 'undefined') param.values = '';
        if (param.type === 'input' && typeof param.placeholder === 'undefined') param.placeholder = '';
        var data = { component: COMPONENT, param: param, field: { name: name, description: description || '' } };
        if (typeof onChange === 'function') data.onChange = onChange;
        Lampa.SettingsApi.addParam(data);
    }

    function clearSession() { saveSetting(KEYS.session, null); }

    function sendSmsCode(api) {
        var phone = String(setting(KEYS.phone) || '').replace(/\D/g, '');
        if (!phone) { notify(t('phone_required')); return; }
        api.ensurePhonePendingSession().then(function (s) {
            return api.sendOtp(s.sessionId, phone);
        }).then(function () {
            notify(t('sms_sent_enter_refresh'));
        }).catch(function (err) {
            notify(err.message || String(err));
        });
    }

    function refreshSession(api) {
        api.ensureSession(true).then(function () { notify(t('session_refreshed')); }).catch(function (err) { notify(err.message || String(err)); });
    }

    function logout(api) {
        api.logout().then(function () { notify(t('session_cleared')); });
    }

    function loadChannelsMenu(api) {
        loadAllChannels(api).then(function (all) {
            channelsCache = all;
            var categories = [
                { id: 'all', title: t('category_all'), count: all.length },
                { id: 'free', title: t('category_free'), count: all.filter(function (c) { return !c.locked; }).length },
                { id: 'live', title: t('category_live'), count: all.length }
            ];
            Lampa.Select.show({
                title: TITLE + ' — ' + t('menu_channels'),
                items: categories.map(function (c) {
                    return { title: c.title + ' (' + c.count + ')', value: c.id };
                }),
                onSelect: function (item) { showChannelList(api, item.value); },
                onBack: function () { showMainMenu(); }
            });
        }).catch(function (err) {
            notify(err.message || t('stream_error'));
        });
    }

    function iconSvg() {
        return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 9l5 3-5 3V9z" fill="currentColor"/></svg>';
    }

    /* ═════════════════════════════════════════════════════════════════
       ГОЛОВНЕ МЕНЮ ТА ІНТЕГРАЦІЯ Z LAMPA
       ════════════════════════════════════════════════════════════════ */

    function addSideMenuEntry() {
        var list = $('.menu .menu__list').eq(0);
        if (!list.length) { setTimeout(addSideMenuEntry, 500); return; }
        $('.menu__item[data-action="kyivstar-tv"]').remove();
        var item = $('<li class="menu__item selector" data-action="kyivstar-tv">' +
            '<div class="menu__ico">' + iconSvg() + '</div>' +
            '<div class="menu__text">' + TITLE + '</div>' +
            '</li>');
        item.on('hover:enter click', showMainMenu);
        list.append(item);
        debugLog('info', 'menu:added', {});
    }

    function showMainMenu() {
        addApiSource();
        if (Lampa.Activity && Lampa.Activity.push) {
            Lampa.Activity.push({ title: TITLE, component: 'main', source: COMPONENT, page: 1 });
        }
    }

    var apiSourceAdded = false;
    function addApiSource() {
        if (apiSourceAdded) return;
        if (!Lampa.Activity || !Lampa.Activity.push) { setTimeout(addApiSource, 500); return; }
        try {
            Lampa.Activity.push({
                title: TITLE,
                component: 'main',
                source: COMPONENT,
                page: 1,
                rows: [
                    { title: t('menu_live_tv'), items: [{ title: t('menu_channels'), action: 'channels' }, { title: t('menu_epg'), action: 'epg' }, { title: t('menu_catchup'), action: 'catchup' }] },
                    { title: t('menu_settings'), items: [{ title: t('menu_settings'), action: 'settings' }] }
                ]
            });
            apiSourceAdded = true;
        } catch (e) { debugLog('warn', 'api:source:error', { error: e.message || String(e) }); }
    }

    function searchSource(params, onComplete, onError) {
        var api = new KyivstarApi();
        var query = params && params.query ? decodeURIComponent(params.query) : '';
        if (!query) { onComplete({ results: [] }); return; }
        api.search(query).then(function (results) {
            var items = (results || []).map(function (r) {
                return { title: r.name || r.title || 'Item', subtitle: r.type || '', assetId: r.assetId || r.id, videoType: 'IP', image: r.image || '' };
            });
            onComplete({ title: TITLE + ' — ' + query, results: items });
        }).catch(function () { onError(); });
    }

    /* ═════════════════════════════════════════════════════════════════
       BOOT / ІНІЦІАЛІЗАЦІЯ
       ════════════════════════════════════════════════════════════════ */

    function boot() {
        if (!window.Lampa || !window.$ || !Lampa.Storage) { setTimeout(boot, 200); return; }
        if (window[PLUGIN_FLAG]) return;
        window[PLUGIN_FLAG] = true;

        try {
            ensureDeviceId();
            addSideMenuEntry();
            addSettings();
            addApiSource();

            window.plugin_kyivstar_tv_ready = true;
            window.KyivstarTVPlugin = {
                show: showMainMenu,
                settings: function () { showSettingsMenu(new KyivstarApi(), showMainMenu); },
                logs: function () { return setting(KEYS.logs); },
                clearLogs: function () { saveSetting(KEYS.logs, []); },
                channels: function () { loadChannelsMenu(new KyivstarApi()); },
                epg: function () { showEPG(new KyivstarApi()); }
            };
            debugLog('info', 'boot:ready', { lampa: !!window.Lampa, jquery: !!window.$ });
        } catch (error) {
            window.plugin_kyivstar_tv_error = error && error.message ? error.message : String(error);
            console.error(TITLE + ' boot failed:', error);
        }

        if (window.appready) {
            addSideMenuEntry();
            addSettings();
            addApiSource();
            initNotice();
        } else if (Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') {
                    addSideMenuEntry();
                    addSettings();
                    addApiSource();
                    initNotice();
                }
            });
        }
    }

    function initNotice() {
        log(t('app_ready'));
    }

    function showSettingsMenu(api, onBack) {
        if (!Lampa.Select || !Lampa.Select.show) { notify(t('lampa_select_unavailable')); return; }
        var session = setting(KEYS.session);
        Lampa.Select.show({
            title: TITLE + ' — ' + t('menu_settings'),
            items: [
                { title: t('login_type') + ': ' + setting(KEYS.loginType), action: 'login-type' },
                { title: t('personal_account') + ': ' + (setting(KEYS.username) || '—'), action: 'username' },
                { title: t('password') + ': ' + (setting(KEYS.password) ? '••••••' : '—'), action: 'password' },
                { title: t('phone_number') + ': ' + (setting(KEYS.phone) || '—'), action: 'phone' },
                { title: t('sms_code') + ': ' + (setting(KEYS.otp) || '—'), action: 'otp' },
                { title: t('locale') + ': ' + setting(KEYS.locale), action: 'locale' },
                { title: t('stream_proxy') + ': ' + (boolSetting(KEYS.streamProxy) ? t('yes') : t('no')), action: 'stream-proxy' },
                { title: t('pin_required') + ': ' + (setting(KEYS.pinCode) ? '••••' : '—'), action: 'pin-code' },
                { title: t('send_sms_code_now'), action: 'send-otp' },
                { title: t('refresh_session') + (session && session.userId ? ' (' + session.userId + ')' : ''), action: 'session' },
                { title: t('menu_channels'), action: 'channels' },
                { title: t('menu_epg'), action: 'epg' },
                { title: t('menu_catchup'), action: 'catchup' },
                { title: t('logout_clear_session'), action: 'logout' }
            ],
            onSelect: function (item) {
                if (item.action === 'login-type') selectLoginType(api, onBack);
                else if (item.action === 'username') editValue(t('personal_account'), KEYS.username, api, onBack);
                else if (item.action === 'password') editValue(t('password'), KEYS.password, api, onBack);
                else if (item.action === 'phone') editValue(t('phone_number'), KEYS.phone, api, onBack);
                else if (item.action === 'otp') editValue(t('sms_code'), KEYS.otp, api, onBack);
                else if (item.action === 'locale') selectLocale(api, onBack);
                else if (item.action === 'stream-proxy') { saveSetting(KEYS.streamProxy, !boolSetting(KEYS.streamProxy)); showSettingsMenu(api, onBack); }
                else if (item.action === 'pin-code') editValue(t('pin_required'), KEYS.pinCode, api, onBack);
                else if (item.action === 'send-otp') { sendSmsCode(api).then(function () { showSettingsMenu(api, onBack); }); }
                else if (item.action === 'session') { refreshSession(api).then(function () { showSettingsMenu(api, onBack); }); }
                else if (item.action === 'channels') { loadChannelsMenu(api); }
                else if (item.action === 'epg') { showEPG(api); }
                else if (item.action === 'catchup') { showCatchupMenu(api, { title: 'All', assetId: '', catchup: true }); }
                else if (item.action === 'logout') { logout(api).then(function () { showSettingsMenu(api, onBack); }); }
            },
            onBack: function () { if (typeof onBack === 'function') onBack(); else if (Lampa.Controller && Lampa.Controller.toggle) Lampa.Controller.toggle('content'); }
        });
    }

    function selectLoginType(api, onBack) {
        Lampa.Select.show({
            title: t('login_type'),
            items: [
                { title: t('anonymous'), value: 'anonymous' },
                { title: t('account'), value: 'account' },
                { title: t('phone_otp'), value: 'phone' }
            ],
            onSelect: function (item) { saveSetting(KEYS.loginType, item.value); saveSetting(KEYS.session, null); showSettingsMenu(api, onBack); },
            onBack: function () { showSettingsMenu(api, onBack); }
        });
    }

    function selectLocale(api, onBack) {
        Lampa.Select.show({
            title: t('locale'),
            items: [
                { title: t('language_uk'), value: 'uk_UA' },
                { title: t('language_en'), value: 'en_US' },
                { title: t('language_ru'), value: 'ru_RU' }
            ],
            onSelect: function (item) { saveSetting(KEYS.locale, item.value); saveSetting(KEYS.session, null); showSettingsMenu(api, onBack); },
            onBack: function () { showSettingsMenu(api, onBack); }
        });
    }

    function editValue(title, key, api, onBack) {
        askText(title, setting(key) || '', function (value) {
            saveSetting(key, value || '');
            if (key !== KEYS.otp) saveSetting(KEYS.session, null);
            showSettingsMenu(api, onBack);
        });
    }

    function askText(title, value, done) {
        if (Lampa.Input && Lampa.Input.edit) {
            try { Lampa.Input.edit({ title: title, value: value || '', free: true }, function (r) { done(r); }); return; } catch (e) {}
        }
        var r = window.prompt(title, value || '');
        if (r !== null) done(r);
    }

    /* ═════════════════════════════════════════════════════════════════
       START
       ════════════════════════════════════════════════════════════════ */

    if (window.appready) boot();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); });

})();
