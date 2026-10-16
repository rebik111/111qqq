(function () {
    'use strict';

    if (typeof Lampa === "undefined") return;

    var TITLE = 'Kyivstar TV';
    var COMPONENT = 'kyivstar_tv';
    var API_BASE = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
    var DEFAULT_LOCALE = 'uk_UA';
    var USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0';
    var REFERER = 'https://tv.kyivstar.ua/';

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

    function setting(name) {
        return Lampa.Storage.get(name, DEFAULTS[name]);
    }
    function saveSetting(name, value) {
        Lampa.Storage.set(name, value);
    }
    function log(m) {
        try { console.log('[KyivstarTV] ' + m); } catch (e) {}
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

    // ---------- Kyivstar API ----------
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

    KyivstarApi.prototype.request = function (path, options) {
        var self = this;
        var retries = options && options.retries !== undefined ? options.retries : 2;
        var requestOptions = Object.assign({ headers: this.headers() }, options || {});

        function run(attempt) {
            return transport(self.network, self.url(path), requestOptions).catch(function (error) {
                if (error.status === 429 && attempt < retries) {
                    return new Promise(function (res) { setTimeout(res, 10000); }).then(function () { return run(attempt + 1); });
                }
                throw error;
            });
        }
        return run(0);
    };

    KyivstarApi.prototype.url = function (path) {
        return API_BASE + path;
    };

    KyivstarApi.prototype.withSession = function (handler) {
        var self = this;
        return this.ensureSession(false).then(function (session) {
            return Promise.resolve(handler(session)).catch(function (error) {
                if (error.status === 401) {
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
        var p;
        if (loginType === 'account') p = this.loginAccount();
        else if (loginType === 'phone') p = this.loginPhone();
        else p = this.loginAnonymous();

        return p.then(function (profile) {
            if (!profile || !profile.userId || !profile.sessionId) throw new Error('Login failed');
            saveSetting(KEYS.session, { userId: profile.userId, sessionId: profile.sessionId });
            return setting(KEYS.session);
        });
    };

    KyivstarApi.prototype.loginAnonymous = function () {
        var self = this;
        return self.request('authentication/login', {
            method: 'POST',
            form: { username: AUTH_REALM + '\\anonymous', password: 'anonymous' }
        });
    };

    KyivstarApi.prototype.loginAccount = function () {
        var self = this;
        var username = setting(KEYS.username);
        var password = setting(KEYS.password);
        if (!username || !password) return Promise.reject(new Error('Set account and password'));
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
        if (!phone) return Promise.reject(new Error('Set phone'));
        return this.ensurePhonePendingSession().then(function (phoneSession) {
            if (!otp) {
                return self.sendOtp(phoneSession.sessionId, phone).then(function () {
                    throw new Error('SMS sent, enter code');
                });
            }
            return self.request('authentication/login/v3;jsessionid=' + encodeURIComponent(phoneSession.sessionId), {
                method: 'POST',
                form: { username: AUTH_REALM + '\\' + phone, otp: otp }
            });
        });
    };

    KyivstarApi.prototype.ensurePhonePendingSession = function () {
        var pending = setting(KEYS.pendingPhoneSession) || null;
        if (pending && pending.sessionId) return Promise.resolve(pending);
        return this.loginAnonymous().then(function (anonymous) {
            saveSetting(KEYS.pendingPhoneSession, anonymous);
            return anonymous;
        });
    };

    KyivstarApi.prototype.sendOtp = function (sessionId, phone) {
        return this.request('v2/otp;jsessionid=' + encodeURIComponent(sessionId), {
            method: 'POST',
            json: { phoneNumber: phone, language: 'UK', channel: 'sms' },
            dataType: 'text'
        });
    };

    KyivstarApi.prototype.getLiveChannelGroups = function () {
        var self = this;
        return this.withSession(function (session) {
            return self.request('v1/contentareas/LIVE_CHANNELS;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true&limit=100');
        });
    };

    KyivstarApi.prototype.getGroupElements = function (groupId) {
        var self = this;
        return this.withSession(function (session) {
            return self.request('gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?offset=0&limit=500');
        });
    };

    KyivstarApi.prototype.getStreamUrl = function (assetId, videoType) {
        var self = this;
        return this.withSession(function (session) {
            var version = session.userId === 'anonymous' ? '4' : '2';
            var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
            if (videoType === 'VIRTUAL') path += '&date=-1000';
            return self.request(path, { retries: 0 }).then(function (data) {
                if (data && data.error) throw new Error(data.description || data.error);
                if (videoType === 'VIRTUAL' && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url };
                if (videoType !== 'VIRTUAL' && data.liveChannelUrl) return { url: data.liveChannelUrl };
                throw new Error('No stream URL');
            });
        });
    };

    // ---------- Transport ----------
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
        return new Promise(function (resolve, reject) {
            var ok = function (data) {
                if (opts.dataType === 'json' && typeof data === 'string') {
                    try { resolve(JSON.parse(data)); return; } catch (e) { reject(e); return; }
                }
                resolve(data);
            };
            var fail = function (err) {
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
                .then(function (r) {
                    if (!r.ok) {
                        var err = new Error('HTTP ' + r.status);
                        err.status = r.status;
                        return r.text().then(function (txt) {
                            try { err.body = JSON.parse(txt); } catch (e) { err.body = txt; }
                            throw err;
                        });
                    }
                    if (opts.dataType === 'text') return r.text();
                    return r.json();
                }).then(ok).catch(fail);
        });
    }

    // ---------- Channels ----------
    var allChannels = [];

    function mapChannel(ch) {
        var images = ch.images || [];
        var logo = images.length ? (images[0].url || '') : '';
        var type = ch.type || {};
        var typeValue = type && type.value ? type.value : type;
        var purchased = ch.purchased !== false;
        return {
            id: ch.assetId,
            title: ch.name || ch.displayName || 'Channel',
            image: logo,
            assetId: ch.assetId,
            videoType: typeValue === 'VIRTUAL' ? 'VIRTUAL' : 'IP',
            locked: !purchased,
            raw: ch
        };
    }

    function loadAllChannels(api, cb) {
        notify('Завантаження каналів...');
        api.getLiveChannelGroups().then(function (groups) {
            var all = [];
            var pending = groups.length;
            if (pending === 0) { cb([]); return; }
            groups.forEach(function (g) {
                api.getGroupElements(g.assetId || g.id).then(function (list) {
                    (list || []).forEach(function (ch) {
                        if (ch.purchased === false) return;
                        all.push(mapChannel(ch));
                    });
                    pending--;
                    if (pending === 0) cb(all);
                }).catch(function () {
                    pending--;
                    if (pending === 0) cb(all);
                });
            });
        }).catch(function (err) {
            notify('Помилка: ' + (err.message || err));
            cb([]);
        });
    }

    // ---------- Playback ----------
    function playItem(api, item) {
        api.getStreamUrl(item.assetId, item.videoType).then(function (stream) {
            var url = stream.url + '|User-Agent="' + encodeURIComponent(USER_AGENT) + '"&Referer="' + encodeURIComponent(REFERER) + '"';
            if (Lampa.Player && Lampa.Player.play) {
                Lampa.Player.play({ title: item.title, url: url, poster: item.image || '', timeline: false });
            }
        }).catch(function (err) {
            notify(err.message || 'Помилка відтворення');
        });
    }

    // ---------- Lampa Component ----------
    var plugin = {
        get: function (params, oncomplete, onerror) {
            var api = new KyivstarApi();
            loadAllChannels(api, function (channels) {
                allChannels = channels;
                var items = channels.map(function (ch) {
                    return {
                        title: ch.title + (ch.locked ? ' 🔒' : ''),
                        subtitle: ch.videoType,
                        image: ch.image,
                        assetId: ch.assetId,
                        videoType: ch.videoType,
                        locked: ch.locked,
                        type: ch.locked ? 'nav' : 'vod',
                        url: ch.locked ? '' : 'plugin://' + COMPONENT + '/play/' + ch.assetId
                    };
                });
                oncomplete(items);
            });
        },
        stream: function (params, oncomplete, onerror) {
            var api = new KyivstarApi();
            var item = allChannels.find(function (c) { return c.assetId === params.assetId || c.id === params.assetId; }) || params;
            playItem(api, item);
            oncomplete(item.url || '');
        }
    };

    if (Lampa.Component && Lampa.Component.add) {
        Lampa.Component.add('online_kyivstar', {
            name: TITLE,
            source: COMPONENT,
            get: plugin.get,
            stream: plugin.stream
        });
    }

    if (Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('sources', function (e) {
            if (e.type === 'start' && e.object && e.object.sources) {
                var exists = e.object.sources.find(function (s) { return s.id === COMPONENT; });
                if (!exists) {
                    e.object.sources.push({
                        id: COMPONENT,
                        title: TITLE,
                        icon: 'https://dxnsav.github.io/plugin.video.kyivstar.tv/plugin.kyivstar.tv/assets/favicon.ico',
                        action: function () {
                            Lampa.Activity.push({
                                url: '',
                                title: TITLE,
                                component: 'online_kyivstar',
                                source: COMPONENT
                            });
                        }
                    });
                    Lampa.Listener.send('sources_update');
                }
            }
        });
    }

    function boot() {
        ensureDeviceId();
        log(TITLE + ' loaded');
    }

    if (window.appready) boot();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); });

})();
