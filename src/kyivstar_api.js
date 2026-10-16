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
    if(proxy.indexOf('{url}') !== -1) return proxy.replace('{url}', encodeURIComponent(url));
    return proxy + encodeURIComponent(url);
  }

  function timeoutFetch(url, options, ms){
    ms = ms || 15000;
    var controller = new AbortController();
    var id = setTimeout(function(){ controller.abort(); }, ms);
    options = options || {};
    options.signal = controller.signal;
    return fetch(url, options).finally(function(){ clearTimeout(id); });
  }

  function safeRequest(url, opts){
    var final = applyProxy(url);
    var headers = Object.assign({}, opts && opts.headers ? opts.headers : {});
    // attach minimal headers from storage
    var ua = getStorage('device_ua','');
    if(ua) headers['User-Agent'] = ua;
    var referer = getStorage('device_referer','');
    if(referer) headers['Referer'] = referer;
    return timeoutFetch(final, { method: opts && opts.method ? opts.method : 'GET', headers: headers, body: opts && opts.body ? opts.body : null }, opts && opts.timeout ? opts.timeout : 20000)
      .then(function(r){ if(!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } var ct = r.headers.get('content-type')||''; if(ct.indexOf('application/json')!==-1) return r.json(); return r.text(); });
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
      if(resp && resp.sessionId){ setStorage('session', { userId: resp.userId, sessionId: resp.sessionId }); return resp; }
      throw new Error('Anonymous login failed');
    });
  };

  KyivstarApi.prototype.loginPhone = function(){
    var phone = getStorage('phone','');
    var otp = getStorage('otp','');
    var self = this;
    return this.loginAnonymous().then(function(anon){
      setStorage('pending_phone_session', anon);
      if(!otp){
        // send otp
        var url = self.apiBase + 'v2/otp;jsessionid=' + encodeURIComponent(anon.sessionId);
        return safeRequest(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phoneNumber: phone.replace(/\D/g,''), language: 'UK', channel: 'sms' }) }).then(function(){ throw new Error('OTP_SENT'); });
      }
      // submit otp
      var url2 = self.apiBase + 'authentication/login/v3;jsessionid=' + encodeURIComponent(anon.sessionId);
      var form = 'username=' + encodeURIComponent(self.authRealm + '\\' + phone) + '&otp=' + encodeURIComponent(otp);
      return safeRequest(url2, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: form }).then(function(profile){ setStorage('session', { userId: profile.userId, sessionId: profile.sessionId }); setStorage('otp',''); setStorage('pending_phone_session', null); return profile; });
    });
  };

  KyivstarApi.prototype.getContentAreas = function(){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var url = self.apiBase + 'api/v2/contentareas/MY_TV_WEB;jsessionid=' + encodeURIComponent(session.sessionId) + '?includeRestricted=true';
      return safeRequest(url, { timeout: 10000 });
    });
  };

  KyivstarApi.prototype.getContentAreaElements = function(compilationId, offset, limit){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var url = self.apiBase + 'api/v1/gallery/filters/content-area;jsessionid=' + encodeURIComponent(session.sessionId);
      var payload = { compilationElementId: compilationId, offset: offset||0, limit: limit||50 };
      return safeRequest(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload), timeout: 15000 });
    });
  };

  KyivstarApi.prototype.getChannelSchedule = function(channelAssetId, from, to){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var url = self.apiBase + 'api/v1/epg/channel/' + encodeURIComponent(channelAssetId) + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
      return safeRequest(url, { timeout: 20000 });
    });
  };

  KyivstarApi.prototype.getStreamUrl = function(assetId, videoType, date){
    var self = this;
    return this.ensureSession(false).then(function(session){
      var version = session.userId === 'anonymous' ? '4' : '2';
      var isVirtual = (videoType === 'VIRTUAL');
      var path = 'play/v' + version + ';jsessionid=' + encodeURIComponent(session.sessionId) + '?assetId=' + encodeURIComponent(assetId);
      if(isVirtual && date) path += '&date=' + encodeURIComponent(date);
      var url = self.apiBase + path;
      return safeRequest(url, { timeout: 15000 }).then(function(data){
        if(data && data.error) throw new Error(data.description || data.error);
        if(isVirtual && data && data.media && data.media[0] && data.media[0].url) return { url: data.media[0].url, quality: 'auto', subtitles: [] };
        if(!isVirtual && data && data.liveChannelUrl) return { url: data.liveChannelUrl, quality: 'auto', subtitles: [] };
        throw new Error('No playable stream URL');
      });
    });
  };

  window.KyivstarApi = KyivstarApi;
})();
