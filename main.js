(function () {
    'use strict';

    var NAME = 'kyivstar_tv_left_menu';
    var TITLE = 'Kyivstar TV — канали';
    var API = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH_REALM = '557455cfe4b04ad886a6ae41';
    var KEYS = {
        session: 'kyivstar_session',
        deviceId: 'kyivstar_device_id',
        locale: 'kyivstar_locale',
        proxy: 'kyivstar_proxy',
        appendHeaders: 'kyivstar_append_stream_headers'
    };
    var active = false;
    var currentComponent = null;

    function notify(text) {
        if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
        else console.log(TITLE + ': ' + text);
    }

    function storage(key, fallback) {
        try { return Lampa.Storage.get(key, fallback); } catch (e) { return fallback; }
    }

    function save(key, value) {
        try { Lampa.Storage.set(key, value); } catch (e) {}
    }

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
    }

    function deviceId() {
        var id = storage(KEYS.deviceId, '');
        if (!id) { id = uuid(); save(KEYS.deviceId, id); }
        return id;
    }

    function apiUrl(path) {
        var url = API + path;
        var proxy = storage(KEYS.proxy, '');
        if (proxy) {
            if (proxy.indexOf('{url}') !== -1) return proxy.replace('{url}', encodeURIComponent(url));
            return proxy.replace(/\/?$/, '/') + encodeURIComponent(url);
        }
        return url;
    }

    function request(path, options) {
        options = options || {};
        var network = Lampa.Reguest ? new Lampa.Reguest() : null;
        var url = apiUrl(path);
        var headers = {
            'x-vidmind-device-id': deviceId(),
            'x-vidmind-device-type': 'WEB',
            'x-vidmind-image-sizes': '2_3_XL,16_9_XL,16_9_L,1_1_XL',
            'x-vidmind-locale': storage(KEYS.locale, 'uk_UA')
        };
        Object.keys(options.headers || {}).forEach(function (key) { headers[key] = options.headers[key]; });
        var method = options.method || 'GET';
        var body = false;
        var dataType = options.dataType || 'json';
        if (options.json !== undefined) {
            body = JSON.stringify(options.json);
            headers['Content-Type'] = 'application/json';
        } else if (options.form) {
            body = Object.keys(options.form).map(function (key) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(options.form[key]);
            }).join('&');
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        }
        return new Promise(function (resolve, reject) {
            function ok(data) {
                if (dataType === 'json' && typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (e) { reject(e); return; }
                }
                resolve(data);
            }
            function fail(error) {
                var message = error && (error.responseJSON && error.responseJSON.description || error.responseText || error.message);
                reject(new Error(message || (error && error.status ? 'HTTP ' + error.status : 'Запит до Kyivstar TV не вдався')));
            }
            if (network && (network.native || network.silent)) {
                if (network.timeout) network.timeout(20000);
                (network.native || network.silent).call(network, url, ok, fail, body, {
                    type: method, headers: headers, dataType: dataType, timeout: 20000
                });
            } else if (window.fetch) {
                fetch(url, { method: method, headers: headers, body: body || undefined }).then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return dataType === 'text' ? res.text() : res.json();
                }).then(ok).catch(fail);
            } else reject(new Error('Немає мережевого API Lampa'));
        });
    }

    function ensureSession() {
        var s = storage(KEYS.session, null);
        if (s && s.sessionId && s.userId) return Promise.resolve(s);
        return request('authentication/login', {
            method: 'POST',
            form: { username: AUTH_REALM + '\\anonymous', password: 'anonymous' }
        }).then(function (profile) {
            if (!profile || !profile.sessionId || !profile.userId) throw new Error('Kyivstar TV не повернув сесію. Відкрий налаштування оригінального плагіна й онови вхід.');
            save(KEYS.session, { sessionId: profile.sessionId, userId: profile.userId });
            return storage(KEYS.session, null);
        });
    }

    function withSession(pathBuilder, options) {
        return ensureSession().then(function (s) {
            return request(pathBuilder(s), options);
        });
    }

    function asArray(value) {
        if (Array.isArray(value)) return value;
        if (!value) return [];
        return value.items || value.elements || value.results || value.content || value.assets || [];
    }

    function groups() {
        return withSession(function (s) {
            return 'v1/contentareas/LIVE_CHANNELS;jsessionid=' + encodeURIComponent(s.sessionId) + '?includeRestricted=true&limit=100';
        }).then(asArray);
    }

    function channels(groupId) {
        return withSession(function (s) {
            return 'gallery/contentgroups/' + encodeURIComponent(groupId) + ';jsessionid=' + encodeURIComponent(s.sessionId) + '?offset=0&limit=500';
        }).then(asArray);
    }

    function titleOf(item) { return item && (item.displayName || item.name || item.title || item.assetId) || 'Телеканал'; }
    function idOf(item) { return item && (item.assetId || item.id || item.contentGroupId); }
    function imageOf(item) {
        var imgs = item && item.images;
        if (!Array.isArray(imgs) || !imgs.length) return '';
        var preferred = imgs.filter(function (im) { return im && im.url && /2_3_XL|16_9_XL|16_9_L/i.test(im.url); })[0] || imgs[0];
        return preferred && preferred.url || '';
    }

    function playChannel(channel) {
        var assetId = idOf(channel);
        if (!assetId) { notify('У каналу немає assetId'); return; }
        notify('Завантажую потік: ' + titleOf(channel));
        withSession(function (s) {
            var version = s.userId === 'anonymous' ? '4' : '2';
            return 'play/v' + version + ';jsessionid=' + encodeURIComponent(s.sessionId) + '?assetId=' + encodeURIComponent(assetId);
        }).then(function (data) {
            var url = data && data.liveChannelUrl || (data && data.media && data.media[0] && data.media[0].url);
            if (!url) throw new Error(data && (data.description || data.error) || 'API не повернув URL потоку');
            if (storage(KEYS.appendHeaders, true) !== false && url.indexOf('|') === -1) {
                var ua = encodeURIComponent('Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0');
                url += '|User-Agent="' + ua + '"&Referer="' + encodeURIComponent('https://tv.kyivstar.ua/') + '"';
            }
            Lampa.Player.play({ title: titleOf(channel), url: url, poster: imageOf(channel), timeline: false });
        }).catch(function (err) { notify('Не вдалося запустити канал: ' + (err.message || err)); });
    }

    function addStyles() {
        if (document.getElementById('ks-left-menu-style')) return;
        var style = document.createElement('style');
        style.id = 'ks-left-menu-style';
        style.textContent = [
            '.kslm{display:flex;gap:1.4em;height:calc(100vh - 7em);min-height:25em;padding:1.4em 2em;box-sizing:border-box;color:#fff}',
            '.kslm__side{width:29%;max-width:24em;min-width:15em;overflow-y:auto;border-right:1px solid #ffffff22;padding-right:1em}',
            '.kslm__main{flex:1;min-width:0;overflow-y:auto;padding-right:.6em}',
            '.kslm__heading{font-size:1.6em;font-weight:600;margin:0 0 .8em}',
            '.kslm__item{padding:.72em .9em;margin:.18em 0;border-radius:.3em;background:rgba(255,255,255,.045);font-size:1.08em;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.kslm__item.focus,.kslm__item:hover,.kslm__item:focus{background:rgba(255,255,255,.2);outline:2px solid #fff}',
            '.kslm__item.active{background:rgba(255,255,255,.14);border-left:3px solid #fff}',
            '.kslm__channel{display:flex;align-items:center;gap:1em;padding:.7em;margin:.15em 0;border-radius:.3em;min-height:3.8em}',
            '.kslm__logo{width:5em;height:3em;object-fit:contain;flex-shrink:0}',
            '.kslm__message{opacity:.8;padding:.8em;white-space:pre-wrap}',
            '@media(max-width:800px){.kslm{padding:1em;gap:.8em}.kslm__side{width:34%;min-width:10em}}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function makeItem(text, className, action, image) {
        var item = $('<div class="kslm__item selector ' + (className || '') + '"></div>');
        if (image) item.append($('<img class="kslm__logo">').attr('src', image));
        item.append($('<span></span>').text(text));
        item.attr('tabindex', '0');
        item.on('hover:enter click', function () { if (action) action(); });
        item.on('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (action) action(); }
        });
        return item;
    }

    function openScreen() {
        if (!window.Lampa || !Lampa.Component || !Lampa.Activity) {
            notify('Lampa ще не готова. Перезапусти застосунок.');
            return;
        }
        addStyles();
        var componentName = NAME + '_screen';
        var page = $('<div class="kslm"><aside class="kslm__side"><div class="kslm__heading">Категорії</div><div class="kslm__groups"></div></aside><main class="kslm__main"><div class="kslm__heading">Телеканали</div><div class="kslm__channels"><div class="kslm__message">Завантаження категорій…</div></div></main></div>');
        var groupsRoot = page.find('.kslm__groups');
        var channelsRoot = page.find('.kslm__channels');
        var selectedGroup = null;
        var generation = 0;

        function showChannels(group) {
            selectedGroup = group;
            generation++;
            var token = generation;
            groupsRoot.find('.kslm__item').removeClass('active').each(function () {
                if (String($(this).attr('data-group')) === String(idOf(group))) $(this).addClass('active');
            });
            channelsRoot.empty().append($('<div class="kslm__message"></div>').text('Завантаження «' + titleOf(group) + '»…'));
            channels(idOf(group)).then(function (items) {
                if (token !== generation) return;
                channelsRoot.empty();
                if (!items.length) {
                    channelsRoot.append($('<div class="kslm__message"></div>').text('У цій категорії каналів не знайдено.'));
                    return;
                }
                items.forEach(function (channel) {
                    var type = channel.type && channel.type.value ? channel.type.value : channel.type || 'IP';
                    var row = makeItem(titleOf(channel), 'kslm__channel', function () { playChannel(channel); }, imageOf(channel));
                    row.attr('title', titleOf(channel));
                    row.data('asset-id', idOf(channel));
                    row.append($('<span class="kslm__hint"></span>').text('▶'));
                    channelsRoot.append(row);
                });
                if (Lampa.Controller && Lampa.Controller.toggle) Lampa.Controller.toggle('content');
            }).catch(function (err) {
                if (token !== generation) return;
                channelsRoot.empty().append($('<div class="kslm__message"></div>').text('Не вдалося завантажити канали: ' + (err.message || err)));
            });
        }

        function buildGroups(items) {
            groupsRoot.empty();
            if (!items.length) {
                groupsRoot.append($('<div class="kslm__message"></div>').text('API не повернув категорій Live TV.'));
                return;
            }
            items.forEach(function (group, index) {
                var gid = idOf(group);
                if (!gid) return;
                var row = makeItem(titleOf(group), '', function () { showChannels(group); });
                row.attr('data-group', gid);
                groupsRoot.append(row);
                if (!selectedGroup && index === 0) selectedGroup = group;
            });
            if (selectedGroup) showChannels(selectedGroup);
        }

        Lampa.Component.add(componentName, function () {
            this.create = function () { this.render = function () { return page[0]; }; };
            this.render = function () { return page[0]; };
            this.start = function () {};
            this.back = function () { if (Lampa.Activity && Lampa.Activity.backward) Lampa.Activity.backward(); };
            this.destroy = function () { active = false; };
        });
        currentComponent = componentName;
        Lampa.Activity.push({ title: TITLE, component: componentName });
        setTimeout(function () {
            var activity = document.querySelector('.activity__body');
            if (activity && !page[0].parentNode) activity.append(page[0]);
        }, 100);
        groups().then(buildGroups).catch(function (err) {
            groupsRoot.empty();
            channelsRoot.empty();
            groupsRoot.append($('<div class="kslm__message"></div>').text('Не вдалося завантажити категорії.'));
            channelsRoot.append($('<div class="kslm__message"></div>').text((err.message || err) + '\nЯкщо сесія протермінована, відкрий Kyivstar TV → Налаштування → Оновити сесію.'));
        });
    }

    function addMenuEntry() {
        if (!window.$ || !Lampa || !Lampa.Storage) { setTimeout(addMenuEntry, 500); return; }
        var list = $('.menu .menu__list').eq(0);
        if (!list.length) { setTimeout(addMenuEntry, 500); return; }
        if (list.find('[data-action="kyivstar-tv-left-menu"]').length) return;
        var item = $('<li class="menu__item selector" data-action="kyivstar-tv-left-menu"><div class="menu__ico">📺</div><div class="menu__text">Kyivstar TV — канали</div></li>');
        item.on('hover:enter click', openScreen);
        list.append(item);
    }

    function boot() {
        if (!window.Lampa || !window.$) { setTimeout(boot, 500); return; }
        if (window.__kyivstar_tv_left_menu_loaded) return;
        window.__kyivstar_tv_left_menu_loaded = true;
        if (window.appready) addMenuEntry();
        else if (Lampa.Listener && Lampa.Listener.follow) Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') addMenuEntry();
        });
        setTimeout(addMenuEntry, 1000);
    }

    boot();
})();
