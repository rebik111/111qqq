(function () {
    'use strict';

    if (window.kyivstar_lampa_plugin) return;
    window.kyivstar_lampa_plugin = true;

    var API = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    var AUTH = 'https://kyivstar-auth.production.vidmind.com/kyivstar-auth/';
    var STORE = 'kyivstar_lampa_session_v1';
    var DEVICE = 'kyivstar_lampa_device_v1';
    var session = null;
    var deviceId = '';

    function notify(message) {
        if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(message);
        else window.alert(message);
    }

    function getSaved(key) {
        try {
            if (window.Lampa && Lampa.Storage) return Lampa.Storage.get(key, '');
            return localStorage.getItem(key) || '';
        } catch (e) { return ''; }
    }

    function setSaved(key, value) {
        try {
            if (window.Lampa && Lampa.Storage) Lampa.Storage.set(key, value);
            else localStorage.setItem(key, value);
        } catch (e) {}
    }

    function removeSaved(key) {
        try {
            if (window.Lampa && Lampa.Storage) Lampa.Storage.set(key, '');
            else localStorage.removeItem(key);
        } catch (e) {}
    }

    function loadSession() {
        try { session = JSON.parse(getSaved(STORE) || 'null'); }
        catch (e) { session = null; }
        deviceId = getSaved(DEVICE);
        if (!deviceId) {
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 3 | 8)).toString(16);
            });
            setSaved(DEVICE, deviceId);
        }
    }

    function saveSession(profile) {
        session = profile;
        setSaved(STORE, JSON.stringify(profile));
    }

    function request(url, options) {
        options = options || {};
        options.credentials = 'include';
        options.headers = Object.assign({
            'x-vidmind-device-id': deviceId,
            'x-vidmind-device-type': 'WEB',
            'x-vidmind-locale': 'uk_UA',
            'Origin': 'https://tv.kyivstar.ua',
            'Referer': 'https://tv.kyivstar.ua/'
        }, options.headers || {});
        return fetch(url, options).then(function (response) {
            return response.text().then(function (body) {
                var data;
                try { data = JSON.parse(body); } catch (e) { data = body; }
                if (!response.ok) {
                    var error = new Error('HTTP ' + response.status);
                    error.data = data;
                    throw error;
                }
                return data;
            });
        });
    }

    function postForm(url, data) {
        var body = Object.keys(data).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
        }).join('&');
        return request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body
        });
    }

    function authStart() {
        return postForm(API + 'authentication/login', {
            username: '557455cfe4b04ad886a6ae41\\anonymous',
            password: 'anonymous'
        });
    }

    function loginPhone(phone, otp, initialSessionId) {
        return request(API + 'authentication/login/v3;jsessionid=' + encodeURIComponent(initialSessionId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: 'username=' + encodeURIComponent('557455cfe4b04ad886a6ae41\\' + phone) +
                  '&otp=' + encodeURIComponent(otp)
        });
    }

    function sendOtp(phone, initialSessionId) {
        return request(API + 'v2/otp;jsessionid=' + encodeURIComponent(initialSessionId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: phone, language: 'UK', channel: 'sms' })
        });
    }

    function loginAccount(username, password, initialSessionId) {
        return request(API + 'authentication/login/v3;jsessionid=' + encodeURIComponent(initialSessionId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: 'username=' + encodeURIComponent('557455cfe4b04ad886a6ae41\\' + username) +
                  '&password=' + encodeURIComponent(password)
        });
    }

    function logout() {
        var old = session;
        session = null;
        removeSaved(STORE);
        if (old && old.sessionId) {
            request(API + 'authentication/logout;jsessionid=' + encodeURIComponent(old.sessionId) + '?sessionExpired=false', { method: 'POST' })
                .catch(function () {});
        }
        notify('Київстар ТБ: локальну сесію очищено');
        openHome();
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function styleOnce() {
        if (document.getElementById('ks-lampa-style')) return;
        var style = el('style');
        style.id = 'ks-lampa-style';
        style.textContent = [
            '.ks-page{padding:2em;color:#fff;box-sizing:border-box}',
            '.ks-title{font-size:2em;margin-bottom:1em}',
            '.ks-note{opacity:.8;max-width:60em;line-height:1.5;margin:.5em 0 1.2em}',
            '.ks-actions{display:flex;flex-direction:column;gap:.7em;max-width:42em}',
            '.ks-btn{padding:.9em 1.1em;background:rgba(255,255,255,.12);border-radius:.3em;font-size:1.15em;cursor:pointer}',
            '.ks-btn:focus,.ks-btn:hover{outline:2px solid #fff;background:rgba(255,255,255,.25)}',
            '.ks-field{box-sizing:border-box;width:100%;padding:.8em;font-size:1.1em;margin:.3em 0 1em}',
            '.ks-channel{display:flex;align-items:center;gap:1em;padding:.7em;border-bottom:1px solid #ffffff25;cursor:pointer}',
            '.ks-channel:focus,.ks-channel:hover{outline:2px solid #fff;background:#ffffff20}',
            '.ks-channel img{width:5em;height:3em;object-fit:contain}',
            '.ks-error{color:#ffb5b5;white-space:pre-wrap}'
        ].join('');
        document.head.appendChild(style);
    }

    function openHome() {
        var root = el('div', 'ks-page');
        root.appendChild(el('div', 'ks-title', 'Київстар ТБ'));
        root.appendChild(el('div', 'ks-note',
            'Експериментальний порт для Lampa/MSX. Потрібне підключення до API та перевірка відтворення на Titan OS.'));
        var actions = el('div', 'ks-actions');
        root.appendChild(actions);
        if (session && session.sessionId && session.userId) {
            actions.appendChild(button('Телеканали та категорії', function () { loadChannels(root); }));
            actions.appendChild(button('Оновити / перевірити сесію', function () { request(API + 'api/v1/subscribers;jsessionid=' + encodeURIComponent(session.sessionId)).then(function(){notify('Сесія активна');}).catch(function(e){notify('Сесія недоступна: ' + (e.message || e));}); }));
            actions.appendChild(button('Вийти з акаунта', logout));
            actions.appendChild(el('div', 'ks-note', 'Сесія збережена локально на цьому пристрої.'));
        } else {
            actions.appendChild(button('Увійти за номером телефону (SMS)', function () { phoneLogin(root); }));
            actions.appendChild(button('Увійти за особовим рахунком', function () { accountLogin(root); }));
            actions.appendChild(button('Анонімний вхід', function () { anonymousLogin(root); }));
            actions.appendChild(button('QR-вхід', function () { qrLogin(root); }));
        }
        showPage(root, 'Київстар ТБ');
    }

    function button(label, action) {
        var b = el('div', 'ks-btn', label);
        b.tabIndex = 0;
        b.setAttribute('role', 'button');
        b.addEventListener('click', action);
        b.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); }
        });
        return b;
    }

    function field(parent, label, type, value) {
        parent.appendChild(el('label', 'ks-note', label));
        var input = el('input', 'ks-field');
        input.type = type || 'text';
        input.value = value || '';
        input.autocomplete = 'off';
        parent.appendChild(input);
        return input;
    }

    function showPage(node, title) {
        styleOnce();
        if (window.Lampa && Lampa.Activity && Lampa.Activity.push) {
            var name = 'kyivstar_lampa_page';
            Lampa.Component.add(name, function (object) {
                this.create = function () { this.render = function () { return node; }; };
                this.render = function () { return node; };
                this.start = function () {};
                this.back = function () {};
                this.destroy = function () {};
            });
            Lampa.Activity.push({ title: title || 'Київстар ТБ', component: name });
            setTimeout(function () {
                var activity = document.querySelector('.activity__body');
                if (activity && !node.parentNode) activity.appendChild(node);
            }, 200);
        } else {
            document.body.appendChild(node);
        }
    }

    function showError(root, error) {
        var msg = error && error.message ? error.message : String(error);
        root.appendChild(el('div', 'ks-error',
            'Не вдалося звернутися до API: ' + msg +
            '\nЯкщо браузер повідомляє Failed to fetch, найімовірніше запит блокує CORS. У такому разі потрібен контрольований HTTPS-проксі або офіційний вебклієнт; обхід DRM не реалізується.'));
    }

    function anonymousLogin(root) {
        authStart().then(function (profile) {
            if (!profile || !profile.sessionId || !profile.userId) throw new Error('API не повернув sessionId/userId');
            saveSession(profile);
            openHome();
        }).catch(function (e) { showError(root, e); });
    }

    function phoneLogin(root) {
        var page = el('div', 'ks-page');
        page.appendChild(el('div', 'ks-title', 'Вхід за номером телефону'));
        var phone = field(page, 'Номер у форматі 380XXXXXXXXX', 'tel');
        var otp = field(page, 'SMS-код (спочатку залиш порожнім)', 'text');
        var status = el('div', 'ks-note');
        page.appendChild(status);
        page.appendChild(button('Надіслати SMS-код', function () {
            var value = phone.value.replace(/[^\d]/g, '');
            if (!/^380\d{9}$/.test(value)) { status.textContent = 'Введи номер у форматі 380XXXXXXXXX'; return; }
            status.textContent = 'Запит коду…';
            authStart().then(function (p) {
                if (!p || !p.sessionId) throw new Error('Немає sessionId');
                return sendOtp(value, p.sessionId).then(function () {
                    status.textContent = 'Код надіслано. Введи його нижче й натисни «Підтвердити».';
                    page.dataset.sessionId = p.sessionId;
                });
            }).catch(function (e) { showError(page, e); });
        }));
        page.appendChild(button('Підтвердити код', function () {
            if (!page.dataset.sessionId || !otp.value.trim()) { status.textContent = 'Спочатку запроси SMS і введи код.'; return; }
            loginPhone(phone.value.replace(/[^\d]/g, ''), otp.value.trim(), page.dataset.sessionId)
                .then(function (p) {
                    if (!p || !p.sessionId || !p.userId) throw new Error('Вхід не підтверджено API');
                    saveSession(p); openHome();
                }).catch(function (e) { showError(page, e); });
        }));
        page.appendChild(button('Назад', openHome));
        showPage(page, 'Вхід — Київстар ТБ');
    }

    function accountLogin(root) {
        var page = el('div', 'ks-page');
        page.appendChild(el('div', 'ks-title', 'Вхід за особовим рахунком'));
        var username = field(page, 'Номер особового рахунку', 'text');
        var password = field(page, 'Пароль', 'password');
        page.appendChild(button('Увійти', function () {
            authStart().then(function (p) {
                if (!p || !p.sessionId) throw new Error('Немає sessionId');
                return loginAccount(username.value.trim(), password.value, p.sessionId);
            }).then(function (p) {
                if (!p || !p.sessionId || !p.userId) throw new Error('Вхід не підтверджено API');
                saveSession(p); openHome();
            }).catch(function (e) { showError(page, e); });
        }));
        page.appendChild(button('Назад', openHome));
        showPage(page, 'Вхід — Київстар ТБ');
    }

    function qrLogin(root) {
        var page = el('div', 'ks-page');
        page.appendChild(el('div', 'ks-title', 'QR-підключення'));
        page.appendChild(el('div', 'ks-note', 'QR-вхід потребує згенерованого коду та перевірки статусу підписки. У цьому прототипі цей сценарій ще не реалізований.'));
        page.appendChild(button('Назад', openHome));
        showPage(page, 'QR-вхід — Київстар ТБ');
    }

    function loadChannels(root) {
        var page = el('div', 'ks-page');
        page.appendChild(el('div', 'ks-title', 'Телеканали'));
        page.appendChild(el('div', 'ks-note', 'Завантаження…'));
        showPage(page, 'Київстар ТБ — канали');
        request(API + 'contentareas;jsessionid=' + encodeURIComponent(session.sessionId))
            .then(function (groups) { openCategories(page, groups); })
            .catch(function (e) { showError(page, e); });
    }

    function loadGroup(page, group) {
        var id = group.id || group.assetId || group.contentGroupId;
        if (!id) { showError(page, new Error('У відповіді групи не знайдено ID')); return; }
        page.innerHTML = '';
        page.appendChild(el('div', 'ks-title', group.title || group.name || 'Канали'));
        request(API + 'gallery/filters/content-area;jsessionid=' + encodeURIComponent(session.sessionId), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({compilationElementId:id,filterElementIds:[],filterSortElementId:null,offset:0,limit:500,sortOrder:null})})
            .then(function (data) {
                var channels = Array.isArray(data) ? data : (data && (data.elements || data.items || data.content) || []);
                if (!channels.length) {
                    page.appendChild(el('div', 'ks-note', 'Не знайдено каналів у відповіді API.'));
                    return;
                }
                channels.forEach(function (channel) {
                    page.appendChild(button((channel.title || channel.name || channel.label || channel.assetId || 'Канал') + ' — дивитися', function () { playChannel(channel); }));
                    page.appendChild(button('Телепрограма / записи: ' + (channel.title || channel.name || 'канал'), function () { openEpg(channel); }));
                });
                page.appendChild(button('Назад до груп', loadChannels));
            }).catch(function (e) { showError(page, e); });
    }

    function openEpg(channel) {
        var id = channel.id || channel.assetId || channel.asset_id;
        if (!id) { notify('Не знайдено ID каналу'); return; }
        var page = el('div', 'ks-page');
        page.appendChild(el('div', 'ks-title', 'Телепрограма — ' + (channel.title || channel.name || 'Канал')));
        page.appendChild(el('div', 'ks-note', 'Завантаження телепрограми…'));
        showPage(page, 'Телепрограма');
        var now = new Date();
        function ymd(d) { return d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2) + ('0'+d.getDate()).slice(-2); }
        var from = new Date(now.getTime() - 3*86400000), to = new Date(now.getTime() + 3*86400000);
        request(API + 'livechannels/' + encodeURIComponent(id) + '/epg;jsessionid=' + encodeURIComponent(session.sessionId) + '?from=' + ymd(from) + '&to=' + ymd(to))
          .then(function(data) {
            page.innerHTML = '';
            page.appendChild(el('div','ks-title','Телепрограма — ' + (channel.title || channel.name || 'Канал')));
            var days = Array.isArray(data) ? data : (data && (data.elements || data.items || data.content) || []);
            var programs = [];
            days.forEach(function(day){ (day.programList || day.programs || []).forEach(function(p){ programs.push(p); }); });
            if (!programs.length) page.appendChild(el('div','ks-note','API не повернув передач. Перевір доступ каналу та формат відповіді.'));
            programs.forEach(function(p){
              var start = Number(p.start || 0); if (start && start < 1e12) start *= 1000;
              var end = start + Number(p.duration || 0) * 60000;
              var label = (start ? new Date(start).toLocaleString() + ' — ' : '') + (p.title || p.name || p.assetId || 'Передача');
              page.appendChild(button(label, function(){
                if (!p.assetId) { notify('У передачі немає assetId'); return; }
                if (start && end < Date.now()) playCatchup(channel, p, start);
                else if (start && start <= Date.now()) playCatchup(channel, p, start);
                else notify('Ця передача ще не почалася.');
              }));
            });
            page.appendChild(button('Назад до каналів', function(){ loadChannels(page); }));
          }).catch(function(e){ showError(page,e); });
    }

    function playCatchup(channel, program, startMs) {
        var id = channel.id || channel.assetId || channel.asset_id;
        var version = session.userId === 'anonymous' ? '4' : '2';
        // Kodi implementation uses milliseconds for EPG dates and livechannels/vN/playback for catch-up.
        request(API + 'livechannels/v' + version + '/playback;jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(id) + '&date=' + encodeURIComponent(startMs))
          .then(function(data){
            var url = data && (data.uri || data.url || data.liveChannelUrl);
            if (!url) throw new Error('API не повернув URL запису');
            if (window.Lampa && Lampa.Player && Lampa.Player.play) Lampa.Player.play({url:url,title:program.title || program.name || 'Запис передачі'});
            else window.location.href = url;
          }).catch(function(e){ notify('Не вдалося відтворити запис: ' + (e.message || e)); });
    }

    function openCategories(page, groups) {
        page.innerHTML = '';
        page.appendChild(el('div','ks-title','Категорії та телеканали'));
        var list = Array.isArray(groups) ? groups : (groups && (groups.elements || groups.items || groups.content) || []);
        if (!list.length) { page.appendChild(el('div','ks-note','API повернув порожній список або інший формат даних.')); return; }
        list.forEach(function(group){
          var name = group.title || group.name || group.label || group.nameKey || 'Категорія';
          page.appendChild(button(name, function(){
            var id = group.id || group.assetId || group.contentAreaId;
            if (!id) { showError(page,new Error('У категорії немає ID')); return; }
            request(API + 'compilations;jsessionid=' + encodeURIComponent(session.sessionId), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentAreaId:id})})
              .then(function(data){
                page.innerHTML=''; page.appendChild(el('div','ks-title',name));
                var comps = Array.isArray(data) ? data : (data && (data.elements || data.items || data.content) || []);
                comps.forEach(function(comp){ page.appendChild(button(comp.title || comp.name || 'Відкрити', function(){ loadCompilation(page,id,comp); })); });
                if (!comps.length) loadCompilation(page,id,{id:id,assetId:id,title:name});
                page.appendChild(button('Назад до категорій',function(){loadChannels(page);}));
              }).catch(function(e){ showError(page,e); });
          }));
        });
        page.appendChild(button('Назад',openHome));
    }

    function loadCompilation(page, areaId, comp) {
        var compId = comp.id || comp.assetId || comp.elementId || areaId;
        page.innerHTML=''; page.appendChild(el('div','ks-title',comp.title || comp.name || 'Елементи'));
        request(API + 'gallery/filters/content-area;jsessionid=' + encodeURIComponent(session.sessionId), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({compilationElementId:compId,filterElementIds:[],filterSortElementId:null,offset:0,limit:500,sortOrder:null})})
          .then(function(data){
            var items = Array.isArray(data) ? data : (data && (data.elements || data.items || data.content) || []);
            if (!items.length) page.appendChild(el('div','ks-note','Немає елементів у цій категорії.'));
            items.forEach(function(item){
              var title = item.title || item.name || item.label || item.assetId || 'Елемент';
              page.appendChild(button(title, function(){
                var t = String(item.type || item.assetType || '').toUpperCase();
                if (t.indexOf('LIVE') >= 0 || item.liveChannel || item.isLiveChannel) { openEpg(item); }
                else playChannel(item);
              }));
            });
            page.appendChild(button('Назад',function(){loadChannels(page);}));
          }).catch(function(e){showError(page,e);});
    }

    function playChannel(channel) {
        var id = channel.id || channel.assetId || channel.asset_id;
        if (!id) { notify('Не знайдено ID каналу'); return; }
        var version = session.userId === 'anonymous' ? '4' : '2';
        request(API + 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(id))
            .then(function (data) {
                var url = data && (data.liveChannelUrl || (data.media && data.media[0] && data.media[0].url));
                if (!url) throw new Error('API не повернув URL потоку');
                if (window.Lampa && Lampa.Player && Lampa.Player.play) {
                    Lampa.Player.play({ url: url, title: channel.title || channel.name || 'Київстар ТБ' });
                } else {
                    window.location.href = url;
                }
            }).catch(function (e) {
                notify('Не вдалося запустити канал: ' + (e.message || e));
            });
    }

    function init() {
        loadSession();
        if (window.Lampa && Lampa.Menu && Lampa.Menu.addButton) {
            Lampa.Menu.addButton(
                '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16v11H4zM2 18h20v2H2z"/></svg>',
                'Київстар ТБ',
                openHome
            );
        } else {
            openHome();
        }
    }

    if (window.Lampa && Lampa.Listener) {
        if (window.appready) init();
        else Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    } else {
        window.addEventListener('load', init);
    }
})();
