(function () {
    'use strict';

    /* ═════════════════════════════════════════════════════════════════
       KYIVSTAR TV — сумісна версія для Lampa / MSX
       ════════════════════════════════════════════════════════════════ */

    var I18N = {
        "uk": {
            "title": "Kyivstar TV",
            "live_tv": "Живе ТБ",
            "channels": "Канали",
            "epg": "Теlepередачі",
            "settings": "Налаштування",
            "login_type": "Тип входу",
            "anonymous": "Анонімно",
            "account": "Особистий рахунок",
            "phone_otp": "Телефонний OTP",
            "phone": "Номер телефону",
            "password": "Пароль",
            "sms_code": "SMS-код",
            "refresh_session": "Оновити сесію",
            "send_sms": "Надіслати SMS",
            "logout": "Вийти",
            "loading": "Завантаження каналів...",
            "error": "Помилка завантаження",
            "no_channels": "Канали не знайдені",
            "play": "Відтворити",
            "stream_error": "Не вдалося отримати потік"
        },
        "ru": {
            "title": "Kyivstar TV",
            "live_tv": "Живое ТВ",
            "channels": "Каналы",
            "epg": "Телепередачи",
            "settings": "Настройки",
            "login_type": "Тип входа",
            "anonymous": "Анонимно",
            "account": "Лицевой счет",
            "phone_otp": "Телефонный OTP",
            "phone": "Номер телефона",
            "password": "Пароль",
            "sms_code": "SMS-код",
            "refresh_session": "Обновить сессию",
            "send_sms": "Отправить SMS",
            "logout": "Выйти",
            "loading": "Загрузка каналов...",
            "error": "Ошибка загрузки",
            "no_channels": "Каналы не найдены",
            "play": "Воспроизвести",
            "stream_error": "Не удалось получить поток"
        },
        "en": {
            "title": "Kyivstar TV",
            "live_tv": "Live TV",
            "channels": "Channels",
            "epg": "TV Guide",
            "settings": "Settings",
            "login_type": "Login type",
            "anonymous": "Anonymous",
            "account": "Personal account",
            "phone_otp": "Phone OTP",
            "phone": "Phone number",
            "password": "Password",
            "sms_code": "SMS code",
            "refresh_session": "Refresh session",
            "send_sms": "Send SMS",
            "logout": "Logout",
            "loading": "Loading channels...",
            "error": "Loading error",
            "no_channels": "No channels found",
            "play": "Play",
            "stream_error": "Failed to load stream"
        }
    };

    /* ══════════════════════════════════════════════════════════════════
       КОНСТАНТИ
       ═════════════════════════════════════════════════════════════════ */
    var PLUGIN_BUILD = '2026-06-10-compatible';
    var PLUGIN_FLAG = '__kyivstar_tv_loaded_' + PLUGIN_BUILD;
    var COMPONENT = 'kyivstar_tv';
    var TITLE = 'Kyivstar TV';
    var API_BASE = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
    var DEFAULT_LOCALE = 'uk_UA';
    var USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0';
    var REFERER = 'https://tv.kyivstar.ua/';
    var LIMIT = 50;

    var KEYS = {
        loginType: 'kyivstar_login_type',
        username: 'kyivstar_username',
        password: 'kyivstar_password',
        phone: 'kyivstar_phone',
        otp: 'kyivstar_otp',
        locale: 'kyivstar_locale',
        deviceId: 'kyivstar_device_id',
        session: 'kyivstar_session'
    };

    var DEFAULTS = {};
    DEFAULTS[KEYS.loginType] = 'anonymous';
    DEFAULTS[KEYS.username] = '';
    DEFAULTS[KEYS.password] = '';
    DEFAULTS[KEYS.phone] = '';
    DEFAULTS[KEYS.otp] = '';
    DEFAULTS[KEYS.locale] = DEFAULT_LOCALE;
    DEFAULTS[KEYS.deviceId] = '';
    DEFAULTS[KEYS.session] = null;

    /* ══════════════════════════════════════════════════════════════════
       ДОПОМІЖНІ ФУНКЦІЇ
       ═════════════════════════════════════════════════════════════════ */
    function t(key) {
        var lang = DEFAULTS[KEYS.locale];
        if (Lampa.Storage) {
            try { lang = Lampa.Storage.get(KEYS.locale, DEFAULT_LOCALE); } catch(e) {}
        }
        var dict = I18N[lang] || I18N.uk;
        return dict[key] || key;
    }

    function setting(name) {
        if (!Lampa.Storage) return DEFAULTS[name];
        try { return Lampa.Storage.get(name, DEFAULTS[name]); } catch(e) { return DEFAULTS[name]; }
    }
    function saveSetting(name, value) {
        if (!Lampa.Storage) return;
        try { Lampa.Storage.set(name, value); } catch(e) {}
    }

    function log(msg) {
        try { console.log('[KyivstarTV] ' + msg); } catch(e) {}
    }
    function notify(msg) {
        if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg);
        else log(msg);
    }

    function uuid() {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }

    function ensureDeviceId() {
        if (!setting(KEYS.deviceId)) saveSetting(KEYS.deviceId, uuid());
    }

    /* ══════════════════════════════════════════════════════════════════
       KYIVSTAR API
       ═════════════════════════════════════════════════════════════════ */
    function KyivstarApi() {
        this.network = Lampa.Reguest ? new Lampa.Reguest() : null;
    }

    KyivstarApi.prototype.headers = function() {
        return {
            'x-vidmind-device-id': setting(KEYS.deviceId),
            'x-vidmind-device-type': 'WEB',
            'x-vidmind-image-sizes': '2_3_XL,16_9_XL,16_9_L,1_1_XL',
            'x-vidmind-locale': setting(KEYS.locale),
            'Origin': 'https://tv.kyivstar.ua',
            'Referer': 'https://tv.kyivstar.ua/'
        };
    };

    KyivstarApi.prototype.request = function(path, options) {
        var self = this;
        var retries = options && options.retries !== undefined ? options.retries : 2;
        var opts = Object.assign({ headers: this.headers() }, options || {});

        function run(attempt) {
            return transport(self.network, self.url(path), opts).catch(function(err) {
                if (err.status === 429 && attempt < retries) {
                    return new Promise(function(res){ setTimeout(res, 10000); }).then(function(){ return run(attempt+1); });
                }
                throw err;
            });
        }
        return run(0);
    };

    KyivstarApi.prototype.url = function(path) {
        return API_BASE + path;
    };

    KyivstarApi.prototype.withSession = function(handler) {
        var self = this;
        return this.ensureSession(false).then(function(session){
            return Promise.resolve(handler(session)).catch(function(err){
                if (err.status === 401) {
                    return self.ensureSession(true).then(function(newSession){ return handler(newSession); });
                }
                throw err;
            });
        });
    };

    KyivstarApi.prototype.ensureSession = function(force) {
        var current = setting(KEYS.session);
        if (!force && current && current.sessionId && current.userId) return Promise.resolve(current);

        var loginType = setting(KEYS.loginType);
        var p;
        if (loginType === 'account') p = this.loginAccount();
        else if (loginType === 'phone') p = this.loginPhone();
        else p = this.loginAnonymous();

        return p.then(function(profile){
            if (!profile || !profile.userId || !profile.sessionId) throw new Error(t('error'));
            saveSetting(KEYS.session, { userId: profile.userId, sessionId: profile.sessionId });
            return setting(KEYS.session);
        });
    };

    KyivstarApi.prototype.loginAnonymous = function() {
        return this.request('authentication/login', {
            method: 'POST',
            form: { username: AUTH_REALM + '\\anonymous', password: 'anonymous' }
        });
    };

    KyivstarApi.prototype.loginAccount = function() {
        var self = this;
        var username = setting(KEYS.username);
        var password = setting(KEYS.password);
        if (!username || !password) return Promise.reject(new Error(t('error')));
        return this.loginAnonymous().then(function(anon){
            return self.request('authentication/login/v3;jsessionid=' + encodeURIComponent(anon.sessionId), {
                method: 'POST',
                form: { username: AUTH_REALM + '\\' + username, password: password }
            });
        });
    };

    KyivstarApi.prototype.loginPhone = function() {
        var self = this;
        var phone = String(setting(KEYS.phone) || '').replace(/\D/g, '');
        var otp = setting(KEYS.otp);
        if (!phone) return Promise.reject(new Error(t('error')));
        return this.ensurePhonePendingSession().then(function(sess){
            if (!otp) {
                return self.sendOtp(sess.sessionId, phone).then(function(){
                    throw new Error('SMS sent');
                });
            }
            return self.request('authentication/login/v3;jsessionid=' + encodeURIComponent(sess.sessionId), {
                method: 'POST',
                form: { username: AUTH_REALM + '\\' + phone, otp: otp }
            });
        });
    };

    KyivstarApi.prototype.ensurePhonePendingSession = function() {
        var pending = setting(KEYS.pendingPhoneSession) || null;
        if (pending && pending.sessionId) return Promise.resolve(pending);
        return this.loginAnonymous().then(function(anon){
            saveSetting(KEYS.pendingPhoneSession, anon);
            return anon;
        });
    };

    KyivstarApi.prototype.sendOtp = function(sessionId, phone) {
        return this.request('v2/otp;jsessionid=' + encodeURIComponent(sessionId), {
            method: 'POST',
            json: { phoneNumber: phone, language: 'UK', channel: 'sms' },
            dataType: 'text'
        });
    };

    KyivstarApi.prototype.logout = function() {
        var session = setting(KEYS.session);
        saveSetting(KEYS.session, null);
        if (session && session.userId && session.userId !== 'anonymous') {
            return this.request('authentication/logout;jsessionid=' + encodeURIComponent(session.sessionId) + '?sessionExpired=false', { dataType: 'text' }).catch(function(){});
        }
        return Promise.resolve();
    };

    KyivstarApi.prototype.getLiveChannelGroups = function() {
        var self = this;
        return this.withSession(function(session){
            return self.request('v1/contentareas/LIVE_CHANNELS;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true&limit=100');
        });
    };

    KyivstarApi.prototype.getGroupElements = function(groupId) {
        var self = this;
        return this.withSession(function(session){
            return self.request('gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?offset=0&limit=500');
        });
    };

    KyivstarApi.prototype.getStreamUrl = function(assetId, videoType) {
        var self = this;
        return this.withSession(function(session){
            var version = session.userId === 'anonymous' ? '4' : '2';
            var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
            if (videoType === 'VIRTUAL') path += '&date=-1000';
            return self.request(path, { retries: 0 }).then(function(data){
                if (data && data.error) throw new Error(data.description || data.error);
                if (videoType === 'VIRTUAL' && data && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url };
                if (videoType !== 'VIRTUAL' && data && data.liveChannelUrl) return { url: data.liveChannelUrl };
                throw new Error(t('stream_error'));
            });
        });
    };

    KyivstarApi.prototype.cached = function(name, ttl, loader) {
        var key = 'kyivstar_cache_' + name;
        var cached = Lampa.Storage ? Lampa.Storage.get(key, null) : null;
        var now = Date.now();
        if (cached && cached.time && now - cached.time < ttl) return Promise.resolve(cached.value);
        return Promise.resolve(loader()).then(function(value){
            if (Lampa.Storage) Lampa.Storage.set(key, { time: now, value: value });
            return value;
        });
    };

    /* Транспорт: підтримка Lampa.Reguest і fetch */
    function transport(network, url, opts) {
        opts = opts || {};
        var method = opts.method || 'GET';
        var headers = Object.assign({}, opts.headers || {});
        var postData = false;
        if (opts.json !== undefined) {
            postData = JSON.stringify(opts.json);
            headers['Content-Type'] = 'application/json';
        } else if (opts.form) {
            postData = opts.form;
        }
        return new Promise(function(resolve, reject){
            var ok = function(data){
                if (opts.dataType === 'json' && typeof data === 'string') {
                    try { resolve(JSON.parse(data)); return; } catch(e){ reject(e); return; }
                }
                resolve(data);
            };
            var fail = function(err){
                var norm = new Error('Network failed');
                if (err) {
                    norm.status = err.status || err.decode_code;
                    norm.body = err.responseJSON || err.responseText;
                    if (err.decode_error) norm.message = err.decode_error;
                    else if (err.responseJSON && err.responseJSON.description) norm.message = err.responseJSON.description;
                    else if (err.responseText) norm.message = err.responseText;
                    else if (err.status) norm.message = 'HTTP ' + err.status;
                }
                reject(norm);
            };
            if (network && (network.native || network.silent)) {
                var m = network.native ? 'native' : 'silent';
                network.timeout(20000);
                network[m](url, ok, fail, postData, { type: method, headers: headers, dataType: opts.dataType || 'json', timeout: 20000 });
                return;
            }
            fetch(url, { method: method, headers: headers, body: postData })
                .then(function(r){
                    if (!r.ok) {
                        var err = new Error('HTTP ' + r.status);
                        err.status = r.status;
                        return r.text().then(function(txt){
                            try { err.body = JSON.parse(txt); } catch(e){ err.body = txt; }
                            throw err;
                        });
                    }
                    if (opts.dataType === 'text') return r.text();
                    return r.json();
                }).then(ok).catch(fail);
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       ЗАВАНТАЖЕННЯ КАНАЛІВ
       ═════════════════════════════════════════════════════════════════ */
    var allChannels = [];

    function mapChannel(ch) {
        var images = ch.images || [];
        var logo = images.length ? (images[0].url || '') : '';
        var type = ch.type || {};
        var typeValue = type && type.value ? type.value : type;
        var purchased = ch.purchased !== false;
        var catchup = ch.catchupEnabled === true;
        return {
            id: ch.assetId,
            title: ch.name || ch.displayName || 'Channel',
            image: logo,
            assetId: ch.assetId,
            videoType: typeValue === 'VIRTUAL' ? 'VIRTUAL' : 'IP',
            locked: !purchased,
            catchup: catchup,
            raw: ch
        };
    }

    function loadChannels(api, callback) {
        notify(t('loading'));
        api.getLiveChannelGroups().then(function(groups){
            var all = [];
            var pending = groups.length;
            groups.forEach(function(g){
                api.getGroupElements(g.assetId || g.id).then(function(channels){
                    (channels || []).forEach(function(ch){
                        if (ch.purchased === false) return;
                        all.push(mapChannel(ch));
                    });
                    pending--;
                    if (pending === 0) {
                        allChannels = all;
                        callback(all);
                    }
                }).catch(function(){
                    pending--;
                    if (pending === 0) callback(all);
                });
            });
        }).catch(function(err){
            notify(err.message || t('error'));
            callback([]);
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       ВІДТВОРЕННЯ
       ═════════════════════════════════════════════════════════════════ */
    function playChannel(api, item) {
        notify(t('play'));
        api.getStreamUrl(item.assetId, item.videoType).then(function(stream){
            var url = stream.url;
            // Додаємо заголовки для потоку (як у оригінальному плагіні)
            url += '|User-Agent="' + encodeURIComponent(USER_AGENT) + '"&Referer="' + encodeURIComponent(REFERER) + '"';
            if (Lampa.Player && Lampa.Player.play) {
                Lampa.Player.play({
                    title: item.title,
                    url: url,
                    poster: item.image || '',
                    timeline: false
                });
            } else {
                notify('Lampa.Player не доступний');
            }
        }).catch(function(err){
            notify(err.message || t('stream_error'));
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       БІЧНЕ МЕНЮ (без jQuery)
       ═════════════════════════════════════════════════════════════════ */
    function addSideMenuItem() {
        // Спробуємо знайти контейнер бічного меню
        var menu = null;
        var selectors = [
            '.menu .menu__list',
            '.sidebar .menu__list',
            'nav .menu__list',
            '.menu__list'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) { menu = el; break; }
        }
        if (!menu) {
            setTimeout(addSideMenuItem, 500);
            return;
        }

        // Унікальний ідентифікатор, щоб не додавати двічі
        if (document.querySelector('.menu__item[data-action="kyivstar-tv"]')) return;

        var item = document.createElement('li');
        item.className = 'menu__item selector';
        item.setAttribute('data-action', 'kyivstar-tv');
        item.innerHTML = '<div class="menu__ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 9l5 3-5 3V9z" fill="currentColor"/></svg></div><div class="menu__text">' + TITLE + '</div>';

        item.addEventListener('click', function(){
            openKyivstarMenu();
        });
        item.addEventListener('hover:enter', function(){
            openKyivstarMenu();
        });

        menu.appendChild(item);
        log('Sidebar item added');
    }

    /* ══════════════════════════════════════════════════════════════════
       ГОЛОВНЕ МЕНЮ КИЇВСТАР (Select)
       ═════════════════════════════════════════════════════════════════ */
    function openKyivstarMenu() {
        if (!Lampa.Select || !Lampa.Select.show) {
            notify('Lampa.Select не доступний');
            return;
        }
        if (!Lampa.Activity || !Lampa.Activity.push) {
            notify('Lampa.Activity не доступний');
            return;
        }

        // Пуsh活 сторінку Kyivstar TV
        Lampa.Activity.push({
            title: TITLE,
            component: 'kyivstar_main',
            source: COMPONENT,
            page: 1
        });

        // Завантажуємо канали асинхронно
        var api = new KyivstarApi();
        loadChannels(api, function(channels){
            if (!channels.length) {
                notify(t('no_channels'));
                return;
            }

            var items = channels.map(function(ch){
                return {
                    title: ch.title + (ch.locked ? ' 🔒' : '') + (ch.catchup ? ' 📼' : ''),
                    subtitle: ch.videoType,
                    image: ch.image,
                    assetId: ch.assetId,
                    videoType: ch.videoType,
                    locked: ch.locked,
                    onSelect: function(){
                        if (ch.locked) { notify('Канал недоступний без підписки'); return; }
                        playChannel(api, ch);
                    }
                };
            });

            // Додаємо пункт "Налаштування"
            items.unshift({
                title: t('settings'),
                subtitle: '⚙️',
                onSelect: function(){
                    openSettings(api);
                }
            });

            Lampa.Select.show({
                title: TITLE,
                items: items,
                onBack: function(){
                    if (Lampa.Controller && Lampa.Controller.toggle) Lampa.Controller.toggle('content');
                }
            });
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       НАЛАШТУВАННЯ
       ═════════════════════════════════════════════════════════════════ */
    function openSettings(api) {
        if (!Lampa.Select || !Lampa.Select.show) return;

        var session = setting(KEYS.session);
        var items = [
            { title: t('login_type') + ': ' + setting(KEYS.loginType), action: 'login-type' },
            { title: t('phone') + ': ' + (setting(KEYS.phone) || '—'), action: 'phone' },
            { title: t('password') + ': ' + (setting(KEYS.password) ? '••••••' : '—'), action: 'password' },
            { title: t('sms_code') + ': ' + (setting(KEYS.otp) || '—'), action: 'otp' },
            { title: t('refresh_session') + (session && session.userId ? ' (' + session.userId + ')' : ''), action: 'session' },
            { title: t('send_sms'), action: 'send-sms' },
            { title: t('logout'), action: 'logout' }
        ];

        Lampa.Select.show({
            title: TITLE + ' — ' + t('settings'),
            items: items,
            onSelect: function(item){
                if (item.action === 'login-type') selectLoginType(api);
                else if (item.action === 'phone') editValue(t('phone'), KEYS.phone, api);
                else if (item.action === 'password') editValue(t('password'), KEYS.password, api);
                else if (item.action === 'otp') editValue(t('sms_code'), KEYS.otp, api);
                else if (item.action === 'session') refreshSession(api);
                else if (item.action === 'send-sms') sendSms(api);
                else if (item.action === 'logout') doLogout(api);
                openSettings(api);
            },
            onBack: function(){
                openKyivstarMenu();
            }
        });
    }

    function selectLoginType(api) {
        Lampa.Select.show({
            title: t('login_type'),
            items: [
                { title: t('anonymous'), value: 'anonymous' },
                { title: t('account'), value: 'account' },
                { title: t('phone_otp'), value: 'phone' }
            ],
            onSelect: function(item){
                saveSetting(KEYS.loginType, item.value);
                saveSetting(KEYS.session, null);
            },
            onBack: function(){ openSettings(api); }
        });
    }

    function editValue(title, key, api) {
        var cur = setting(key) || '';
        var val = window.prompt(title, cur);
        if (val !== null) {
            saveSetting(key, val);
            if (key !== KEYS.otp) saveSetting(KEYS.session, null);
        }
    }

    function sendSms(api) {
        var phone = String(setting(KEYS.phone) || '').replace(/\D/g, '');
        if (!phone) { notify('Введіть номер телефону'); return; }
        api.ensurePhonePendingSession().then(function(s){
            return api.sendOtp(s.sessionId, phone);
        }).then(function(){
            notify('SMS надіслано');
        }).catch(function(err){
            notify(err.message || t('error'));
        });
    }

    function refreshSession(api) {
        api.ensureSession(true).then(function(){
            notify('Сесію оновлено');
        }).catch(function(err){
            notify(err.message || t('error'));
        });
    }

    function doLogout(api) {
        api.logout().then(function(){
            notify('Ви вийшли');
        });
    }

    /* ══════════════════════════════════════════════════════════════════
       ІНІЦІАЛІЗАЦІЯ
       ═════════════════════════════════════════════════════════════════ */
    function boot() {
        if (!window.Lampa || !Lampa.Storage) {
            setTimeout(boot, 300);
            return;
        }
        if (window[PLUGIN_FLAG]) return;
        window[PLUGIN_FLAG] = true;

        try {
            ensureDeviceId();
            addSideMenuItem();
            log(TITLE + ' ready');
        } catch(e) {
            console.error(TITLE + ' boot error:', e);
        }

        if (window.appready) {
            addSideMenuItem();
        } else if (Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function(event){
                if (event.type === 'ready') addSideMenuItem();
            });
        }
    }

    // Старт
    if (window.appready) boot();
    else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') boot(); });

})();
