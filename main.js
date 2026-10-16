(function () {
    'use strict';

    if (typeof Lampa === "undefined") return;

    var TITLE = 'Kyivstar TV';
    var COMPONENT = 'kyivstar_tv';
    var API_BASE = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
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
    DEFAULTS[KEYS.locale] = 'uk_UA';
    DEFAULTS[KEYS.deviceId] = '';
    DEFAULTS[KEYS.session] = null;

    function setting(name) {
        return Lampa.Storage.get(name, DEFAULTS[name]);
    }
    function saveSetting(name, value) {
        Lampa.Storage.set(name, value);
    }
    function notify(msg) {
        if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg);
        else console.log('[KyivstarTV] ' + msg);
    }
    function log(m) {
        try { console.log('[KyivstarTV] ' + m); } catch (e) {}
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
        var opts = Object.assign({ headers: this.headers() }, options || {});
        return new Promise(function (resolve, reject) {
            if (self.network && self.network.native) {
                self.network.timeout(20000);
                self.network.native(API_BASE + path, function (data) { resolve(data); }, function (err) {
                    reject(err || new Error('network error'));
                }, opts.form || false, {
                    type: opts.method || 'GET',
                    headers: opts.headers,
                    dataType: opts.dataType || 'json',
                    timeout: 20000
                });
            } else {
                fetch(API_BASE + path, {
                    method: opts.method || 'GET',
                    headers: opts.headers,
                    body: opts.form || undefined
                }).then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                }).then(resolve).catch(reject);
            }
        });
    };

    KyivstarApi.prototype.withSession = function (handler) {
        var self = this;
        return this.ensureSession(false).then(function (s) {
            return Promise.resolve(handler(s)).catch(function (err) {
                if (err.status === 401) return self.ensureSession(true).then(function (ns) { return handler(ns); });
                throw err;
            });
        });
    };

    KyivstarApi.prototype.ensureSession = function (force) {
        var cur = setting(KEYS.session);
        if (!force && cur && cur.sessionId && cur.userId) return Promise.resolve(cur);

        var loginType = setting(KEYS.loginType);
        var p = this.loginAnonymous();
        return p.then(function (profile) {
            if (!profile || !profile.sessionId) throw new Error('Login failed');
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

    KyivstarApi.prototype.getLiveChannelGroups = function () {
        var self = this;
        return this.withSession(function (s) {
            return self.request('v1/contentareas/LIVE_CHANNELS;jsessionid=' + encodeURIComponent(s.sessionId) + '?includeRestricted=true&limit=100');
        });
    };

    KyivstarApi.prototype.getGroupElements = function (groupId) {
        var self = this;
        return this.withSession(function (s) {
            return self.request('gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(s.sessionId) + '?offset=0&limit=500');
        });
    };

    KyivstarApi.prototype.getStreamUrl = function (assetId, videoType) {
        var self = this;
        return this.withSession(function (s) {
            var version = s.userId === 'anonymous' ? '4' : '2';
            var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(s.sessionId) + '?assetId=' + encodeURIComponent(assetId);
            if (videoType === 'VIRTUAL') path += '&date=-1000';
            return self.request(path, { retries: 0 }).then(function (data) {
                if (data && data.error) throw new Error(data.description || data.error);
                if (videoType === 'VIRTUAL' && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url };
                if (videoType !== 'VIRTUAL' && data.liveChannelUrl) return { url: data.liveChannelUrl };
                throw new Error('No stream URL');
            });
        });
    };

    // ---------- Helpers ----------
    function mapChannel(ch) {
        var images = ch.images || [];
        var logo = images.length ? (images[0].url || '') : '';
        var type = ch.type || {};
        var typeValue = type && type.value ? type.value : (type || '');
        var purchased = ch.purchased !== false;
        return {
            id: ch.assetId,
            title: ch.name || ch.displayName || 'Channel',
            image: logo,
            assetId: ch.assetId,
            videoType: (typeValue === 'VIRTUAL') ? 'VIRTUAL' : 'IP',
            locked: !purchased,
            group: ch.group || ''
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

    function showChannels(api, items) {
        if (!Lampa.Select || !Lampa.Select.show) {
            notify(TITLE + ': Lampa.Select недоступний');
            return;
        }

        Lampa.Select.show({
            title: TITLE + ' — Канали',
            items: items.map(function (ch) {
                return {
                    title: ch.title + (ch.locked ? ' 🔒' : ''),
                    subtitle: ch.videoType === 'VIRTUAL' ? 'VIRTUAL' : 'IP',
                    image: ch.image,
                    onSelect: function () {
                        if (ch.locked) { notify('Канал не доступний'); return; }
                        playItem(api, ch);
                    }
                };
            }),
            onBack: function () {
                if (Lampa.Controller && Lampa.Controller.toggle) Lampa.Controller.toggle('content');
            }
        });
    }

    // ---------- Side menu ----------
    function addSideMenuEntry() {
        var list = $('.menu .menu__list').eq(0);
        if (!list.length) { setTimeout(addSideMenuEntry, 500); return; }
        if ($('.menu__item[data-action="kyivstar-tv"]').length) return;

        var item = $('<li class="menu__item selector" data-action="kyivstar-tv">' +
            '<div class="menu__ico">📺</div>' +
            '<div class="menu__text">' + TITLE + '</div>' +
            '</li>');

        item.on('hover:enter click', function () {
            var api = new KyivstarApi();
            loadAllChannels(api, function (channels) {
                showChannels(api, channels);
            });
        });

        list.append(item);
        log('menu entry added');
    }

    // ---------- Lampa component registration ----------
    var plugin = {
        get: function (params, oncomplete, onerror) {
            var api = new KyivstarApi();
            loadAllChannels(api, function (channels) {
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
            var item = allChannels && allChannels.find ?
                allChannels.find(function (c) { return c.assetId === params.assetId || c.id === params.assetId; }) :
                params;
            playItem(api, item);
            oncomplete('');
        }
    };

    if (Lampa.Component && Lampa.Component.add) {
        Lampa.Component.add(COMPONENT, {
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
                            showChannels(new KyivstarApi(), allChannels);
                        }
                    });
                    Lampa.Listener.send('sources_update');
                }
            }
        });
    }

    // ---------- Boot ----------
    function boot() {
        if (!window.Lampa || !window.$ || !Lampa.Storage) {
            setTimeout(boot, 200);
            return;
        }
        if (window[PLUGIN_FLAG]) return;
        window[PLUGIN_FLAG] = true;

        ensureDeviceId();
        addSideMenuEntry();

        if (window.appready) {
            log('loaded via appready');
        } else if (Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') {
                    addSideMenuEntry();
                    log('loaded via listener');
                }
            });
        }
    }

    if (window.appready) boot();
    else if (Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') boot();
        });
    }

})();
