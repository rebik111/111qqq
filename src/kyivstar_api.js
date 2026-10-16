(function(){
  'use strict';

  // Extended kyivstar_api with timeout, proxy support and EPG schedule method

  window.__kyv = window.__kyv || {};
  var PREF = 'kyv_';

  function getStorage(k, def){ try{ return Lampa.Storage.get(PREF + k, def); }catch(e){ return def; } }
  function setStorage(k,v){ try{ Lampa.Storage.set(PREF + k, v); }catch(e){} }

  function applyProxy(url){
    var enabled = getStorage('proxy_enabled', false);
    var proxy = getStorage('proxy_url', '');
    if(!enabled || !proxy) return url;
    // proxy may contain {url} placeholder
    if(proxy.indexOf('{url}') !== -1) return proxy.replace('{url}', encodeURIComponent(url));
    // otherwise append url encoded
    return proxy + encodeURIComponent(url);
  }

  function timeoutFetch(url, options, ms){
    ms = ms || 15000;
    var controller = new AbortController();
    var id = setTimeout(function(){ try{ controller.abort(); }catch(e){} }, ms);
    options = options || {};
    options.signal = controller.signal;
    return fetch(url, options).finally(function(){ clearTimeout(id); });
  }

  function safeRequest(url, opts){
    opts = opts || {};
    var final = applyProxy(url);
    var headers = Object.assign({}, opts && opts.headers ? opts.headers : {});
    // attach minimal headers from storage
    var ua = getStorage('device_ua',''); if(ua) headers['User-Agent'] = ua;
    var referer = getStorage('device_referer',''); if(referer) headers['Referer'] = referer;

    var fetchOpts = { method: opts.method || 'GET', headers: headers };
    if(opts.body) fetchOpts.body = opts.body;

    return timeoutFetch(final, fetchOpts, opts.timeout || 20000).then(function(res){
      // read as text first to preserve raw response for errors
      return res.text().then(function(text){
        var ct = (res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
        var parsed = text;
        if(ct.indexOf('application/json') !== -1){
          try{ parsed = JSON.parse(text); }catch(e){ parsed = text; }
        }

        if(!res.ok){
          var err = new Error('HTTP ' + res.status + (parsed && parsed.message ? ': ' + parsed.message : ''));
          err.status = res.status; err.body = parsed; throw err;
        }

        return parsed;
      });
    }).catch(function(e){
      // normalize fetch/abort errors
      if(e && e.name === 'AbortError'){
        var err = new Error('Request timeout'); err.timeout = true; throw err;
      }
      throw e;
    });
  }

  function KyivstarApi(){
    this.apiBase = 'https://clients.production.vidmind.com/vidmind-stb-ws/';
    this.authRealm = '557455cfe4b04ad886a6ae41';
  }

  KyivstarApi.prototype.ensureSession = function(force){
    var session = getStorage('session', null);
    if(!force && session && session.sessionId) return Promise.resolve(session);
    var loginType = getStorage('login_type','anonymous');
    if(loginType === 'account') return this.loginAccount();
    if(loginType === 'phone') return this.loginPhone();
    return this.loginAnonymous();
  };

  KyivstarApi.prototype.loginAnonymous = function(){
    var url = this.apiBase + 'authentication/login';
    var body = 'username=' + encodeURIComponent(this.authRealm + '\\anonymous') + '&password=anonymous';
    return safeRequest(url, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: body }).then(function(resp){
      if(resp && (resp.sessionId || resp.session_id)){
        // some APIs use sessionId or session_id
        var sid = resp.sessionId || resp.session_id;
        setStorage('session', { userId: resp.userId || 'anonymous', sessionId: sid });
        return resp;
      }
      var err = new Error('Anonymous login failed'); err.payload = resp; throw err;
    });
  };

  KyivstarApi.prototype.loginPhone = function(){
    var phone = getStorage('phone','');
    var otp = getStorage('otp','');
    var self = this;
    // first get anon session to start phone flow
    return this.loginAnonymous().then(function(anon){
      setStorage('pending_phone_session', anon);
      if(!otp){
        var url = self.apiBase + 'v2/otp;jsessionid=' + encodeURIComponent(anon.sessionId || anon.session_id || '');
        var payload = { phoneNumber: (phone || '').replace(/[^0-9]/g,''), language: 'UK', channel: 'sms' };
        return safeRequest(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(function(r){ return r; });
      }
      // submit otp
      var url2 = self.apiBase + 'authentication/login/v3;jsessionid=' + encodeURIComponent(anon.sessionId || anon.session_id || '');
      var form = 'username=' + encodeURIComponent(self.authRealm + '\\' + phone) + '&otp=' + encodeURIComponent(otp);
      return safeRequest(url2, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: form }).then(function(profile){
        if(profile && (profile.sessionId || profile.session_id)){
          var sid = profile.sessionId || profile.session_id;
          setStorage('session', { userId: profile.userId || phone, sessionId: sid });
          return profile;
        }
        var e = new Error('Phone login failed'); e.payload = profile; throw e;
      });
    });
  };

  KyivstarApi.prototype.getContentAreas = function(){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var sid = session && (session.sessionId || session.session_id) || '';
      var url = self.apiBase + 'api/v2/contentareas/MY_TV_WEB;jsessionid=' + encodeURIComponent(sid) + '?includeRestricted=true';
      return safeRequest(url, { timeout: 10000 });
    });
  };

  KyivstarApi.prototype.getContentAreaElements = function(compilationId, offset, limit){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var sid = session && (session.sessionId || session.session_id) || '';
      var url = self.apiBase + 'api/v1/gallery/filters/content-area;jsessionid=' + encodeURIComponent(sid);
      var payload = { compilationElementId: compilationId, offset: offset||0, limit: limit||50 };
      return safeRequest(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), timeout: 15000 });
    });
  };

  KyivstarApi.prototype.getChannelSchedule = function(channelAssetId, from, to){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var sid = session && (session.sessionId || session.session_id) || '';
      var url = self.apiBase + 'api/v1/epg/channel/' + encodeURIComponent(channelAssetId) + ';jsessionid=' + encodeURIComponent(sid) + '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
      return safeRequest(url, { timeout: 20000 });
    });
  };

  KyivstarApi.prototype.getStreamUrl = function(assetId, videoType, date){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var sid = session && (session.sessionId || session.session_id) || '';
      var version = (session && session.userId && session.userId !== 'anonymous') ? '2' : '4';
      var isVirtual = (videoType === 'VIRTUAL');
      var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(sid) + '?assetId=' + encodeURIComponent(assetId);
      if(isVirtual && date) path += '&date=' + encodeURIComponent(date);
      var url = self.apiBase + path;
      return safeRequest(url, { timeout: 15000 }).then(function(data){
        if(data && data.error) throw new Error(data.description || data.error);
        if(isVirtual && data && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url, quality: 'auto', subtitles: [] };
        if(!isVirtual && data && (data.liveChannelUrl || data.live_url)) return { url: data.liveChannelUrl || data.live_url, quality: 'auto', subtitles: [] };
        throw new Error('No playable stream URL');
      });
    });
  };

  window.KyivstarApi = KyivstarApi;
})();
