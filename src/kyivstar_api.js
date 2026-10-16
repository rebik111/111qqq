// kyivstar_api.js — lightweight Kyivstar API client for LAMPA
// Implements session handling (anonymous / account / phone OTP), basic cached requests

(function(){
    'use strict';

    // Export to global scope for simple inclusion in plugin.js
    window.KyivstarApi = function(){
        this.apiBase = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
        this.authRealm = '557455cfe4b04ad886a6ae41';
        this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0';
        this.referer = 'https://tv.kyivstar.ua/';
        this.storage = window.Lampa && Lampa.Storage ? Lampa.Storage : (window.localStorage ? window.localStorage : null);
    };

    // helpers
    function _get(key, def){
        if(!window.Lampa || !Lampa.Storage) return def;
        return Lampa.Storage.get(key, def);
    }
    function _set(key, value){
        if(!window.Lampa || !Lampa.Storage) return;
        Lampa.Storage.set(key, value);
    }

    function _applyProxy(url){
        var proxy = _get('kyivstar_proxy', '');
        if(!proxy) return url;
        if(proxy.indexOf('{url}') !== -1) return proxy.replace('{url}', encodeURIComponent(url));
        return proxy.replace(/\/?$/, '/') + encodeURIComponent(url);
    }

    function _request(url, options){
        options = options || {};
        var headers = options.headers || {};
        var method = options.method || 'GET';
        var body = options.body || null;

        var finalUrl = _applyProxy(url);

        var fetchOptions = {
            method: method,
            headers: headers,
            body: body
        };

        return fetch(finalUrl, fetchOptions).then(function(resp){
            if(!resp.ok){
                var err = new Error('HTTP ' + resp.status);
                err.status = resp.status;
                return resp.text().then(function(text){
                    err.body = text;
                    throw err;
                });
            }
            var ct = resp.headers.get('content-type') || '';
            if(ct.indexOf('application/json') !== -1) return resp.json();
            return resp.text();
        });
    }

    // Basic caching helper (storage based, TTL in ms)
    KyivstarApi.prototype.cached = function(key, ttl, loader){
        var cacheKey = 'kyivstar_cache_' + key;
        var cached = this.storage ? (this.storage.get ? this.storage.get(cacheKey, null) : JSON.parse(this.storage.getItem(cacheKey) || 'null')) : null;
        var now = Date.now();
        if(cached && cached.time && (now - cached.time) < ttl) return Promise.resolve(cached.value);
        return Promise.resolve(loader()).then(function(value){
            var item = { time: now, value: value };
            if(this.storage && this.storage.set) this.storage.set(cacheKey, item);
            else if(window.localStorage) window.localStorage.setItem(cacheKey, JSON.stringify(item));
            return value;
        }.bind(this));
    };

    KyivstarApi.prototype.headers = function(){
        return {
            'x-vidmind-device-id': _get('kyivstar_device_id', ''),
            'x-vidmind-device-type': 'WEB',
            'x-vidmind-locale': _get('kyivstar_locale', 'uk_UA')
        };
    };

    // Auth flows
    KyivstarApi.prototype.loginAnonymous = function(){
        var url = this.apiBase + 'authentication/login';
        var form = 'username=' + encodeURIComponent(this.authRealm + '\\anonymous') + '&password=anonymous';
        return _request(url, { method: 'POST', headers: this.headers(), body: form }).then(function(resp){
            // expect JSON profile
            if(resp && resp.sessionId && resp.userId){
                _set('kyivstar_session', { userId: resp.userId, sessionId: resp.sessionId });
                return resp;
            }
            throw new Error('Anonymous login failed');
        });
    };

    KyivstarApi.prototype.loginAccount = function(){
        var username = _get('kyivstar_username', '');
        var password = _get('kyivstar_password', '');
        if(!username || !password) return Promise.reject(new Error('Personal account and password required'));

        return this.loginAnonymous().then(function(anon){
            var url = this.apiBase + 'authentication/login/v3;jsessionid=' + encodeURIComponent(anon.sessionId);
            var form = 'username=' + encodeURIComponent(this.authRealm + '\\' + username) + '&password=' + encodeURIComponent(password);
            return _request(url, { method: 'POST', headers: this.headers(), body: form });
        }.bind(this)).then(function(profile){
            if(profile && profile.sessionId){
                _set('kyivstar_session', { userId: profile.userId, sessionId: profile.sessionId });
                return profile;
            }
            throw new Error('Account login failed');
        });
    };

    KyivstarApi.prototype.ensureSession = function(force){
        var session = _get('kyivstar_session', null);
        if(!force && session && session.sessionId && session.userId) return Promise.resolve(session);
        var loginType = _get('kyivstar_login_type', 'anonymous');
        if(loginType === 'account') return this.loginAccount();
        if(loginType === 'phone') return this.loginPhone();
        return this.loginAnonymous();
    };

    KyivstarApi.prototype.loginPhone = function(){
        // Phone OTP flow: ensure pending session, send otp, then login with otp
        var pending = _get('kyivstar_pending_phone_session', null);
        var phone = _get('kyivstar_phone', '');
        var otp = _get('kyivstar_otp', '');
        if(!phone) return Promise.reject(new Error('Phone required'));

        var promise = pending && pending.sessionId ? Promise.resolve(pending) : this.loginAnonymous().then(function(anon){ _set('kyivstar_pending_phone_session', anon); return anon; });

        return promise.then(function(phoneSession){
            if(!otp){
                // send otp and throw a special message so UI can inform user
                var url = this.apiBase + 'v2/otp;jsessionid=' + encodeURIComponent(phoneSession.sessionId);
                var payload = { phoneNumber: phone.replace(/\D/g, ''), language: 'UK', channel: 'sms' };
                return _request(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(payload) }).then(function(){
                    throw new Error('OTP_SENT');
                });
            }
            // have otp -> login
            var url = this.apiBase + 'authentication/login/v3;jsessionid=' + encodeURIComponent(phoneSession.sessionId);
            var form = 'username=' + encodeURIComponent(this.authRealm + '\\' + phone) + '&otp=' + encodeURIComponent(otp);
            return _request(url, { method: 'POST', headers: this.headers(), body: form }).then(function(profile){
                _set('kyivstar_otp', '');
                _set('kyivstar_pending_phone_session', null);
                _set('kyivstar_session', { userId: profile.userId, sessionId: profile.sessionId });
                return profile;
            });
        }.bind(this));
    };

    // Example API endpoints (catalog, search, stream)
    KyivstarApi.prototype.getContentAreas = function(){
        var self = this;
        return this.cached('contentareas', 60*60*1000, function(){
            return self.ensureSession(false).then(function(session){
                var url = self.apiBase + 'api/v2/contentareas/MY_TV_WEB;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true';
                return _request(url, { headers: self.headers() });
            });
        });
    };

    KyivstarApi.prototype.getContentAreaElements = function(compilation, filters, sort, offset, limit){
        var self = this;
        return this.ensureSession(false).then(function(session){
            var url = self.apiBase + 'api/v1/gallery/filters/content-area;jsessionid=' + encodeURIComponent(session.sessionId);
            var payload = { compilationElementId: compilation || null, filterElementIds: filters || [], filterSortElementId: sort || null, offset: offset || 0, limit: limit || 20 };
            return _request(url, { method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, self.headers()), body: JSON.stringify(payload) });
        });
    };

    KyivstarApi.prototype.search = function(query){
        var self = this;
        return this.ensureSession(false).then(function(session){
            var url = self.apiBase + 'api/v1/search/predictive;jsessionid=' + encodeURIComponent(session.sessionId) + '?q=' + encodeURIComponent(query) + '&limit=50&includeLiveChannels=true';
            return _request(url, { headers: self.headers() });
        });
    };

    KyivstarApi.prototype.getStreamUrl = function(assetId, videoType){
        var self = this;
        return this.ensureSession(false).then(function(session){
            var version = session.userId === 'anonymous' ? '4' : '2';
            var isVirtual = (videoType === 'VIRTUAL');
            var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
            if(isVirtual) path += '&date=-1000';
            var url = self.apiBase + path;
            return _request(url, { headers: self.headers() }).then(function(data){
                if(data && data.error) throw new Error(data.description || data.error);
                if(isVirtual && data && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url, quality: 'auto', subtitles: [] };
                if(!isVirtual && data && data.liveChannelUrl) return { url: data.liveChannelUrl, quality: 'auto', subtitles: [] };
                throw new Error('No playable stream URL');
            });
        });
    };

})();
