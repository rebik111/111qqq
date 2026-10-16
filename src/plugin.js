(function(){
  'use strict';

  // Kyivstar Lampa plugin - improved: fixes, channel categories, UI closer to official
  // - lazy-loads API/plugin on demand
  // - preserves proxy keys (kyv_proxy_enabled, kyv_proxy_url, kyv_device_ua, kyv_device_referer)
  // - settings shortcut via window.__kyv_register_settings
  // - builds channels-by-category list (if API provides categories) and a Live section

  if(window.__kyv_init_done) return; window.__kyv_init_done = true;

  var SOURCE_ID = 'kyv_source_kyivstar';
  var TITLE = 'Kyivstar TV';

  function getPref(k, d){ try { return Lampa.Storage.get('kyv_' + k, d); } catch(e) { return d; } }
  function setPref(k, v){ try { Lampa.Storage.set('kyv_' + k, v); } catch(e) {} }

  function lazyLoad(src, cb){
    try{
      if(Array.from(document.scripts).some(function(s){ return s.src && s.src.indexOf(src) !== -1; })){
        if(cb) cb(); return;
      }
      var s = document.createElement('script'); s.src = src; s.onload = function(){ if(cb) cb(); }; s.onerror = function(e){ console.error('kyv: load error', src, e); };
      document.head.appendChild(s);
    }catch(e){ console.error('kyv: lazyLoad error', e); }
  }

  function onSelect(){
    var apiUrl = 'https://cdn.jsdelivr.net/gh/rebik111/111qqq@lampa-port/src/kyivstar_api.js';
    var pluginUrl = 'https://cdn.jsdelivr.net/gh/rebik111/111qqq@lampa-port/src/plugin.js';

    if(!window.KyivstarApi) lazyLoad(apiUrl);
    lazyLoad(pluginUrl, function(){
      if(window.__kyv_plugin && typeof window.__kyv_plugin.showMain === 'function' && !window.__kyv_plugin.__is_fallback){
        try{ window.__kyv_plugin.showMain(); }catch(e){ console.error('kyv: showMain error', e); }
      } else if(window.__kyv_plugin && typeof window.__kyv_plugin.showMain === 'function'){
        // fallback available
        try{ window.__kyv_plugin.showMain(); }catch(e){ console.error('kyv: fallback showMain error', e); }
      } else {
        setTimeout(function(){ if(window.__kyv_plugin && typeof window.__kyv_plugin.showMain === 'function') try{ window.__kyv_plugin.showMain(); }catch(e){ console.error(e); } }, 300);
      }
    });
  }

  function registerSource(){
    try{
      if(!window.Lampa || !Lampa.Api || !Lampa.Api.sources) return false;
      if(Array.isArray(Lampa.Api.sources)){
        if(Lampa.Api.sources.find(function(s){ return s && s.id === SOURCE_ID; })) return true;
        Lampa.Api.sources.push({ id: SOURCE_ID, title: TITLE, icon: '', onSelect: onSelect });
        return true;
      }
      if(typeof Lampa.Api.sources === 'object'){
        if(Lampa.Api.sources[SOURCE_ID]) return true;
        Lampa.Api.sources[SOURCE_ID] = { id: SOURCE_ID, title: TITLE, icon: '', onSelect: onSelect };
        return true;
      }
      return false;
    }catch(e){ console.error('kyv: registerSource error', e); return false; }
  }

  // Settings UI
  function openSettings(){
    var items = [
      { title: 'Proxy: ' + (getPref('proxy_enabled', false) ? 'Увімкнено' : 'Вимкнено'), id: 'toggle_proxy' },
      { title: 'Proxy URL', subtitle: getPref('proxy_url','https://api.allorigins.win/raw?url={url}'), id: 'proxy_url' },
      { title: 'Device User-Agent', subtitle: getPref('device_ua',''), id: 'device_ua' },
      { title: 'Device Referer', subtitle: getPref('device_referer',''), id: 'device_referer' },
      { title: 'Login type: ' + (getPref('login_type','anonymous') || 'anonymous'), id: 'login_type' },
      { title: 'Очистити сесію', id: 'clear_session' }
    ];

    Lampa.Activity.push({ component: 'list', title: TITLE + ' — Налаштування', body: items, onSelect: function(it){
      if(!it) return;
      switch(it.id){
        case 'toggle_proxy':
          var cur = getPref('proxy_enabled', false); setPref('proxy_enabled', !cur); Lampa.Noty && Lampa.Noty.show('Proxy ' + (!cur ? 'увімкнено' : 'вимкнено')); setTimeout(openSettings, 250); break;
        case 'proxy_url': Lampa.Input ? Lampa.Input.show('Proxy URL', getPref('proxy_url','https://api.allorigins.win/raw?url={url}'), function(val){ setPref('proxy_url', val); Lampa.Noty && Lampa.Noty.show('Proxy URL збережено'); }) : promptAndSave('proxy_url'); break;
        case 'device_ua': Lampa.Input ? Lampa.Input.show('Device User-Agent', getPref('device_ua',''), function(val){ setPref('device_ua', val); Lampa.Noty && Lampa.Noty.show('UA збережено'); }) : promptAndSave('device_ua'); break;
        case 'device_referer': Lampa.Input ? Lampa.Input.show('Device Referer', getPref('device_referer',''), function(val){ setPref('device_referer', val); Lampa.Noty && Lampa.Noty.show('Referer збережено'); }) : promptAndSave('device_referer'); break;
        case 'login_type': var curt = getPref('login_type','anonymous'); var next = curt === 'anonymous' ? 'phone' : (curt === 'phone' ? 'account' : 'anonymous'); setPref('login_type', next); Lampa.Noty && Lampa.Noty.show('Login type: ' + next); setTimeout(openSettings, 250); break;
        case 'clear_session': ['sessionId','session_token','kyv_session'].forEach(function(k){ try{ Lampa.Storage.remove('kyv_' + k); }catch(e){} }); Lampa.Noty && Lampa.Noty.show('Сесія очищена'); break;
      }
    }});

    function promptAndSave(key){ var cur = getPref(key,''); var val = window.prompt('Задайте ' + key + ':', cur || ''); if(val !== null){ setPref(key, val); Lampa.Noty && Lampa.Noty.show(key + ' збережено'); } }
  }

  function registerSettingsShortcut(){ window.__kyv_register_settings = function(){ openSettings(); }; }

  // Utility: build categories from channels if API doesn't return categories
  function categorizeChannels(channels){
    var byCat = {};
    (channels||[]).forEach(function(ch){
      var cat = ch.category || ch.genre || (ch.group && ch.group.name) || 'Інше';
      if(!cat) cat = 'Інше';
      if(!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(ch);
    });
    return byCat;
  }

  // More polished showMain implemented in kyivstar_api/plugin if loaded; provide fallback
  window.__kyv_plugin = window.__kyv_plugin || (function(){
    var obj = { __is_fallback: true };

    obj.showMain = function(){
      if(typeof KyivstarApi !== 'function'){
        Lampa.Noty && Lampa.Noty.show('Kyivstar API не готовий');
        return Promise.reject(new Error('KyivstarApi not ready'));
      }

      try{
        var api = new KyivstarApi();
        Lampa.Activity.push({ component: 'preloader', title: TITLE });

        // Fetch areas and channels in parallel
        var areasP = api.getContentAreas ? api.getContentAreas().catch(function(e){ console.warn('getContentAreas failed', e); return null; }) : Promise.resolve(null);
        var channelsP = (api.getChannelsList && typeof api.getChannelsList === 'function') ? api.getChannelsList().catch(function(e){ console.warn('getChannelsList failed', e); return null; }) : Promise.resolve(null);

        return Promise.all([areasP, channelsP]).then(function(results){
          var areas = results[0] || {};
          var channels = results[1] || [];

          // Build official-like list: Live + Categories
          var list = [];
          if(Array.isArray(channels) && channels.length){
            list.push({ title: 'Live — Канали', subtitle: '', id: '__kyv_live__', _raw: { type: 'live_list', channels: channels } });
          }

          // content areas first (if provided), otherwise derive categories from channels
          if(areas && Array.isArray(areas.compilations) && areas.compilations.length){
            areas.compilations.forEach(function(c){ list.push({ title: c.name||c.title||'Категорія', subtitle: c.description||'', id: c.id||c.compilationId, _raw: c }); });
          } else {
            var byCat = categorizeChannels(channels);
            Object.keys(byCat).sort().forEach(function(catName){ list.push({ title: catName, subtitle: '', id: '__kyv_cat_' + encodeURIComponent(catName), _raw: { type: 'derived_cat', name: catName } }); });
          }

          Lampa.Activity.push({ component:'list', title: TITLE, body: list, onSelect: function(item){
            if(!item || !item._raw) return;
            if(item._raw.type === 'live_list') return openLiveCategory(item._raw.channels);
            if(item._raw.type === 'derived_cat') return openDerivedCategory(item._raw.name, channels);
            return openCategory(item);
          }});

          return list;
        }).catch(function(e){ console.error('showMain err', e); Lampa.Noty && Lampa.Noty.show('Помилка отримання контенту'); return []; });
      }catch(e){ return Promise.reject(e); }
    };

    // open category from content area (by id)
    function openCategory(item){
      if(!item || !item._raw) return;
      var api = new KyivstarApi();
      Lampa.Activity.push({ component: 'preloader', title: item.title });
      api.getContentAreaElements(item.id, 0, 200).then(function(res){
        var entries = res && res.entries ? res.entries : (res || []);
        var cards = entries.map(function(en){ return { id: en.assetId||en.id, title: en.title||en.name, subtitle: en.subtitle||'', poster: (en.images&&en.images[0]&&en.images[0].url)||'', _raw: en }; });
        Lampa.Activity.push({ component:'list', title: item.title, body: cards, onSelect:function(i){ openItem(i._raw || i); } });
      }).catch(function(e){ console.error('getContentAreaElements err', e); Lampa.Noty && Lampa.Noty.show('Помилка завантаження елементів'); });
    }

    // build list from derived categories using channels array
    function openDerivedCategory(name, channels){
      var list = (channels||[]).filter(function(c){
        var cat = c.category || c.genre || (c.group && c.group.name) || 'Інше';
        return (cat||'') === name;
      }).map(function(ch){ return { title: ch.title||ch.name||'Канал', subtitle: ch.subtitle||'', poster: ch.image||(ch.images&&ch.images[0]&&ch.images[0].url)||'', _raw: ch }; });
      Lampa.Activity.push({ component:'list', title: name, body: list, onSelect:function(i){ openItem(i._raw || i); } });
    }

    function openLiveCategory(channels){
      try{
        var items = (channels||[]).map(function(ch){ return { title: ch.title||ch.name||'Канал', subtitle: ch.subtitle||'', id: ch.assetId||ch.id||ch.channelId, poster: ch.image||(ch.images&&ch.images[0]&&ch.images[0].url)||'', _raw: ch }; });
        Lampa.Activity.push({ component:'list', title: 'Live — Канали', body: items, onSelect:function(i){ openItem(i._raw || i); } });
      }catch(e){ console.error('openLiveCategory err', e); Lampa.Noty && Lampa.Noty.show('Помилка відображення каналів'); }
    }

    function openItem(raw){
      if(!raw) return;
      if(raw.type === 'live' || raw.assetType === 'LIVE_CHANNEL' || raw.channelType === 'live' || raw.playbackAssetId || raw.channelId){
        showChannelPlayer(raw);
        return;
      }
      Lampa.Activity.push({ component:'text', title: raw && (raw.title||raw.name)||'Kyivstar', html: '<pre>'+JSON.stringify(raw,null,2)+'</pre>' });
    }

    function showChannelPlayer(raw){
      var api = new KyivstarApi();
      var assetId = raw.assetId || raw.id || raw.channelId || raw.playbackAssetId;
      var title = raw.title || raw.name || raw.channelName || 'Канал';
      var html = '<div class="category-full"><div class="category-full__head"><h2>'+ title +'</h2></div>' +
        '<div class="category-full__body"><button id="kyv_play">Відтворити</button> <button id="kyv_epg">Телепрограма</button></div></div>';
      Lampa.Activity.push({ component:'text', title: title, html: html, onCreate:function(){
        var play = document.getElementById('kyv_play'); if(play) play.addEventListener('click', function(){
          Lampa.Activity.push({ component:'preloader', title: 'Підготовка до відтворення' });
          api.getStreamUrl(assetId, 'LIVE').then(function(s){ if(s && s.url){ if(Lampa.Player && typeof Lampa.Player.play === 'function') Lampa.Player.play({ url: s.url }); else Lampa.Noty && Lampa.Noty.show('Плеєр недоступний'); } else { Lampa.Noty && Lampa.Noty.show('URL потоку не знайдено'); } }).catch(function(e){ console.error('getStreamUrl err', e); Lampa.Noty && Lampa.Noty.show('Помилка відтворення'); });
        });
        var epg = document.getElementById('kyv_epg'); if(epg) epg.addEventListener('click', function(){ openEPGForChannel(assetId); });
      }});
    }

    function openEPGForChannel(channelAssetId){
      if(window.KyivstarEPGImporter){
        KyivstarEPGImporter.syncChannelToday(channelAssetId).then(function(){ return KyivstarEPGDB.allPrograms(); }).then(function(programs){
          var filtered = programs.filter(function(p){ return p.channelAssetId === channelAssetId; }).sort(function(a,b){ return a.start - b.start; });
          var list = filtered.map(function(p){ return { title: p.title, subtitle: (new Date(p.start*1000)).toLocaleString(), _raw: p }; });
          Lampa.Activity.push({ component:'list', title: 'Телепрограма', body: list, onSelect:function(item){ openProgram(item._raw); } });
        }).catch(function(e){ console.error('EPG err', e); Lampa.Noty && Lampa.Noty.show('Помилка EPG'); });
        return;
      }
      Lampa.Noty && Lampa.Noty.show('EPG не доступний');
    }

    function openProgram(program){
      var api = new KyivstarApi();
      var date = program.start;
      api.getStreamUrl(program.playbackAssetId || program.assetId || program.programId, 'VIRTUAL', date).then(function(s){ if(s && s.url){ if(Lampa.Player && typeof Lampa.Player.play === 'function') Lampa.Player.play({ url: s.url }); else Lampa.Noty && Lampa.Noty.show('Плеєр недоступний'); } else { Lampa.Noty && Lampa.Noty.show('URL не знайдено'); } }).catch(function(e){ console.error('openProgram err', e); Lampa.Noty && Lampa.Noty.show('Помилка відтворення запису'); });
    }

    // expose
    return obj;
  })();

  // boot sequence
  function boot(){
    if(!window.Lampa || !Lampa.Activity || !Lampa.Storage || !Lampa.Api){ setTimeout(boot, 300); return; }
    registerSource();
    registerSettingsShortcut();
  }

  setTimeout(boot, 200);

})();
