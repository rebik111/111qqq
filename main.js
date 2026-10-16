(function () {
    'use strict';

    if (typeof Lampa === "undefined") return;

    var TITLE = 'Kyivstar TV';
    var COMPONENT = 'kyivstar_tv';
    var API_BASE = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
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
        return this.loginAnonymous().then(function (profile) {
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

    KyivstarApi.prototype.getContentAreas = function () {
        var self = this;
        return this.withSession(function (s) {
            return self.request('api/v2/contentareas/MY_TV_WEB;jsessionid=' + encodeURIComponent(s.sessionId) + '?includeRestricted=true');
        });
    };

    KyivstarApi.prototype.getContentGroupElements = function (groupId, filters, sort, offset, limit) {
        var self = this;
        return this.withSession(function (s) {
            var url = 'gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(s.sessionId) + '?offset=' + offset + '&limit=' + limit;
            if (filters && filters.length) url += '&filters=' + encodeURIComponent(JSON.stringify(filters));
            if (sort) url += '&sort=' + encodeURIComponent(sort);
            return self.request(url);
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

    // ---------- Utilities ----------
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

    function mapCategory(cat) {
        var title = cat.name || cat.displayName || 'Category';
        return {
            id: cat.assetId,
            title: title,
            subtitle: 'Category',
            image: '',
            assetId: cat.assetId,
            videoType: 'CATEGORY',
            locked: false,
            group: cat.assetId
        };
    }

    function loadChannelsForGroup(groupId, cb) {
        var api = new KyivstarApi();
        api.getGroupElements(groupId).then(function (list) {
            var out = [];
            (list || []).forEach(function (ch) {
                if (ch.purchased === false) return;
                out.push(mapChannel(ch));
            });
            cb(out);
        }).catch(function (err) {
            notify('Помилка групи: ' + (err.message || err));
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

    // ---------- Side menu entry ----------
    function addSideMenuEntry() {
        var list = $('.menu .menu__list').eq(0);
        if (!list.length) { setTimeout(addSideMenuEntry, 300); return; }
        if ($('.menu__item[data-action="kyivstar-tv"]').length) return;

        var item = $('<li class="menu__item selector" data-action="kyivstar-tv">' +
            '<div class="menu__ico">📺</div>' +
            '<div class="menu__text">' + TITLE + '</div>' +
            '</li>');

        item.on('hover:enter click', function () {
            log('menu clicked');
            var api = new KyivstarApi();
            api.getLiveChannelGroups().then(function (groups) {
                var all = [];
                var pending = groups.length;
                if (pending === 0) {
                    showChannels(api, []);
                    return;
                }
                groups.forEach(function (g) {
                    api.getGroupElements(g.assetId || g.id).then(function (list) {
                        (list || []).forEach(function (ch) {
                            if (ch.purchased === false) return;
                            all.push(mapChannel(ch));
                        });
                        pending--;
                        if (pending === 0) showChannels(api, all);
                    }).catch(function () {
                        pending--;
                        if (pending === 0) showChannels(api, all);
                    });
                });
            }).catch(function (err) {
                notify('Помилка: ' + (err.message || err));
                showChannels(api, []);
            });
        });

        list.append(item);
        log('menu entry added');
    }

    function showChannels(api, channels) {
        if (!Lampa.Select || !Lampa.Select.show) {
            notify(TITLE + ': Lampa.Select недоступний');
            return;
        }

        Lampa.Select.show({
            title: TITLE + ' — Канали',
            items: channels.map(function (ch) {
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

    // ---------- Lampa API source registration (same pattern as dxnsav) ----------
    var source = {
        main: function (params, onComplete, onError) {
            var api = new KyivstarApi();
            api.getContentAreas().then(function (areas) {
                var items = [];
                (areas || []).forEach(function (a) {
                    if (a && a.assetId) {
                        items.push({
                            id: a.assetId,
                            title: a.name || a.title || 'Selection',
                            subtitle: 'Category',
                            image: '',
                            assetId: a.assetId,
                            videoType: 'CATEGORY',
                            group: a.assetId
                        });
                    }
                });
                onComplete({
                    title: TITLE,
                    url: '',
                    source: COMPONENT,
                    results: items
                });
            }).catch(function (err) {
                if (onError) onError(err);
            });
        },
        list: function (params, onComplete, onError) {
            var api = new KyivstarApi();
            api.getContentGroupElements(params.groupId || 'root', params.filters || [], params.sort || null, 0, LIMIT).then(function (items) {
                var out = [];
                (items || []).forEach(function (ch) {
                    if (ch.purchased === false) return;
                    out.push(mapChannel(ch));
                });
                onComplete({
                    title: params.title,
                    url: '',
                    source: COMPONENT,
                    page: 1,
                    total_pages: 1,
                    total_results: out.length,
                    results: out
                });
            }).catch(function (err) {
                if (onError) onError(err);
            });
        },
        full: function (params, onComplete, onError) {
            // fallback – original plugin handles full UI
            onComplete({ movie: null });
        },
        seasons: function (params, from, onComplete) {
            onComplete([]);
        },
        img: function (params, onComplete, onError) {
            notify('img hook not implemented in simplified version');
            onComplete({});
        },
        clear: function () {
            new KyivstarApi().clear();
        },
        discovery: false
    };

    function createApiSource() {
        var base = Lampa.Api && Lampa.Api.sources ? Lampa.Api.sources.tmdb : null;
        var src = base ? $.extend({}, base) : {};
        src.main = source.main;
        src.list = source.list;
        src.full = source.full;
        src.seasons = source.seasons;
        src.img = source.img;
        src.clear = source.clear;
        src.discovery = false;
        return src;
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

        // Register Lampa API source like original plugin
        if (Lampa.Api && Lampa.Api.sources) {
            Lampa.Api.sources[COMPONENT] = createApiSource();
            if (Lampa.Params && Lampa.Params.values && Lampa.Params.select) {
                var values = $.extend({}, Lampa.Params.values.source || {});
                values[COMPONENT] = TITLE;
                Lampa.Params.select('source', values, Lampa.Storage.get('source', 'tmdb'));
            }
            log('api source registered');
        }

        // Add side menu entry
        addSideMenuEntry();

        if (window.appready) {
            log('loaded via appready');
        } else if (Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') {
                    log('ready event');
                    addSideMenuEntry();
                }
            });
        }
    }

    var PLUGIN_FLAG = 'kyivstar_tv_boot';
    if (window.appready) boot();
    else if (Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') boot();
        });
    }

})();
