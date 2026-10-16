(function(){
  'use strict';

  // Main plugin: register source, menu and categories
  if(window.__kyv_init_done) return; window.__kyv_init_done = true;

  var SOURCE_ID = 'kyv_source_kyivstar';
  var TITLE = 'Kyivstar TV';

  function pref(k,d){ try{ return Lampa.Storage.get('kyv_'+k,d); }catch(e){ return d; } }
  function setp(k,v){ try{ Lampa.Storage.set('kyv_'+k,v); }catch(e){} }

  function registerSource(){
    if(!window.Lampa || !Lampa.Api || !Array.isArray(Lampa.Api.sources)) return false;
    var exists = Lampa.Api.sources.find(function(s){ return s && s.id === SOURCE_ID; });
    if(!exists){
      Lampa.Api.sources.push({
        id: SOURCE_ID,
        title: TITLE,
        icon: '',
        onSelect: function(){
          if (typeof showMain === 'function') showMain();
        }
      });
      return true;
    }
    return false;
  }

  function showMain(){
    if(!window.Lampa || !Lampa.Activity || !window.KyivstarApi){
      console.warn('Kyivstar TV plugin: Lampa or API not ready yet');
      return Promise.reject(new Error('Lampa or KyivstarApi not ready'));
    }

    var api = new KyivstarApi();

    // Try to fetch channels for Live section; if present, add Live as first category
    return Promise.all([ api.getContentAreas().catch(function(e){ console.warn('getContentAreas failed',e); return null; }),
                         (api.getChannelsList ? api.getChannelsList().catch(function(e){ console.warn('getChannelsList failed',e); return null; }) : Promise.resolve(null))
                       ]).then(function(results){
      var areas = results[0] || {};
      var channels = results[1] || null;

      var items = (areas && areas.compilations) ? areas.compilations : (areas || []);
      var list = items.map(function(it){
        return {
          title: it.name || it.title || 'Категорія',
          subtitle: it.description || '',
          id: it.id || it.compilationId,
          _raw: it
        };
      });

      // if channels available, prepend Live category
      if(Array.isArray(channels) && channels.length){
        list.unshift({ title: 'Live — Канали', subtitle: '', id: '__kyv_live__', _raw: { type: 'live_list', channels: channels } });
      }

      Lampa.Activity.push({
        component: 'list',
        title: TITLE,
        body: list,
        onSelect: function(item){
          if(item && item._raw && item._raw.type === 'live_list'){
            openLiveCategory(item._raw.channels);
          } else {
            openCategory(item);
          }
        }
      });

      return list;
    }).catch(function(e){
      console.error('showMain err', e);
      if (Lampa.Noty) Lampa.Noty.show('Помилка отримання контенту: '+(e.message||e));
      return [];
    });
  }

  function openCategory(item){
    var api = new KyivstarApi();
    Lampa.Activity.push({ component: 'preloader', title: item.title });
    api.getContentAreaElements(item.id,0,50).then(function(res){
      var entries = res && res.entries ? res.entries : (res || []);
      var cards = entries.map(function(en){
        return {
          id: en.assetId||en.id,
          title: en.title||en.name,
          poster: (en.images && en.images[0] && en.images[0].url) || '',
          _raw: en,
          onSelect: function(){ openItem(en); }
        };
      });

      Lampa.Activity.push({ component:'list', title: item.title, body: cards, onSelect: function(c){ openItem(c._raw || c); } });
    }).catch(function(e){
      console.error('getContentAreaElements err', e);
      if (Lampa.Noty) Lampa.Noty.show('Помилка завантаження елементів');
    });
  }

  function openLiveCategory(channels){
    try{
      var items = (channels||[]).map(function(ch){
        return { title: ch.title || ch.name || ch.channelName || 'Канал', subtitle: ch.subtitle||'', id: ch.assetId||ch.id||ch.channelId, poster: (ch.image|| (ch.images && ch.images[0] && ch.images[0].url)) || '', _raw: ch };
      });

      Lampa.Activity.push({ component:'list', title: 'Live — Канали', body: items, onSelect: function(it){ openItem(it._raw || it); } });
    }catch(e){ console.error('openLiveCategory err', e); if(Lampa.Noty) Lampa.Noty.show('Помилка відображення каналів'); }
  }

  function openItem(raw){
    // if live channel -> open play with EPG button
    if(raw && (raw.type === 'live' || raw.assetType === 'LIVE_CHANNEL' || raw.channelType === 'live')){ showChannelPlayer(raw); return; }
    // else show simple fullcard
    Lampa.Activity.push({ component:'text', title: raw && (raw.title||raw.name) || 'Kyivstar TV', html: '<pre>'+JSON.stringify(raw,null,2)+'</pre>' });
  }

  function showChannelPlayer(raw){
    var api = new KyivstarApi();
    // normalize assetId
    var assetId = raw.assetId || raw.id || raw.channelId || raw.playbackAssetId;
    // render simple UI with Play button and EPG button
    var html = '<div class="category-full"><div class="category-full__head"><h2>'+ (raw.title||raw.name||raw.channelName) +'</h2></div>' +
      '<div class="category-full__body"><button id="kyv_play">Відтворити</button> <button id="kyv_epg">Телепрограма</button></div></div>';
    Lampa.Activity.push({
      component:'text',
      title: raw.title||raw.name||raw.channelName,
      html: html,
      onCreate: function(){
        var b = document.getElementById('kyv_play');
        if(b) b.addEventListener('click', function(){
          api.getStreamUrl(assetId, 'LIVE').then(function(s){
            if(Lampa.Player && typeof Lampa.Player.play === 'function'){ Lampa.Player.play({ url: s.url }); }
            else { if (Lampa.Noty) Lampa.Noty.show('Плеєр недоступний'); }
          }).catch(function(e){
            if (Lampa.Noty) Lampa.Noty.show('Помилка відтворення: '+(e.message||e));
          });
        });

        var e = document.getElementById('kyv_epg');
        if(e) e.addEventListener('click', function(){ openEPGForChannel(assetId); });
      }
    });
  }

  function openEPGForChannel(channelAssetId){
    // sync today and show programs from IndexedDB
    if(window.KyivstarEPGImporter) {
      KyivstarEPGImporter.syncChannelToday(channelAssetId).then(function(){
        return KyivstarEPGDB.allPrograms();
      }).then(function(programs){
        var filtered = programs.filter(function(p){ return p.channelAssetId === channelAssetId; }).sort(function(a,b){ return a.start - b.start; });
        var list = filtered.map(function(p){ return { title: p.title, subtitle: (new Date(p.start*1000)).toLocaleString(), _raw: p }; });
        Lampa.Activity.push({ component:'list', title: 'Телепрограма', body: list, onSelect: function(item){ openProgram(item._raw); } });
      }).catch(function(e){
        console.error('EPG err', e);
        if (Lampa.Noty) Lampa.Noty.show('Помилка EPG: '+(e.message||e));
      });
      return;
    }

    if (Lampa.Noty) Lampa.Noty.show('EPG не доступний');
  }

  function openProgram(program){
    var api = new KyivstarApi();
    var date = program.start;
    api.getStreamUrl(program.playbackAssetId || program.assetId || program.programId, 'VIRTUAL', date).then(function(s){
      if(Lampa.Player && typeof Lampa.Player.play === 'function'){ Lampa.Player.play({ url: s.url }); }
      else { if (Lampa.Noty) Lampa.Noty.show('Плеєр недоступний'); }
    }).catch(function(e){
      if (Lampa.Noty) Lampa.Noty.show('Помилка відтворення запису: '+(e.message||e));
    });
  }

  // settings registration
  function registerSettingsShortcut(){
    if(window.__kyv_register_settings) window.__kyv_register_settings();
  }

  function boot(){
    if(!window.Lampa || !Lampa.Activity || !Lampa.Storage || !window.KyivstarApi){
      setTimeout(boot, 300);
      return;
    }

    registerSource();
    registerSettingsShortcut();

    // immediately open plugin content; this is what makes the item visible in UI
    setTimeout(function(){
      try {
        showMain();
      } catch (e) {
        console.error('Kyivstar TV boot failed:', e);
      }
    }, 500);
  }

  // bootstrap
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 200);
  } else {
    window.addEventListener('load', function(){ setTimeout(boot, 200); }, { once: true });
  }

  // expose small API
  window.__kyv_plugin = { showMain: showMain };

})();
