(function(){
  'use strict';

  // Main plugin: register source, menu and categories
  if(window.__kyv_init_done) return; window.__kyv_init_done = true;

  var SOURCE_ID = 'kyv_source_kyivstar';
  var TITLE = 'Kyivstar TV';

  function pref(k,d){ try{ return Lampa.Storage.get('kyv_'+k,d); }catch(e){ return d; } }
  function setp(k,v){ try{ Lampa.Storage.set('kyv_'+k,v); }catch(e){} }

  function registerSource(){
    if(!window.Lampa || !Lampa.Api || !Array.isArray(Lampa.Api.sources)) return;
    var exists = Lampa.Api.sources.find(s => s.id === SOURCE_ID);
    if(!exists) Lampa.Api.sources.push({ id: SOURCE_ID, title: TITLE, icon: '' });
  }

  function showMain(){
    var api = new KyivstarApi();
    api.getContentAreas().then(function(areas){
      var items = (areas && areas.compilations) ? areas.compilations : (areas || []);
      var list = items.map(function(it){ return { title: it.name || it.title || 'Категорія', subtitle: it.description || '', id: it.id || it.compilationId, _raw: it }; });
      Lampa.Activity.push({ component: 'list', title: TITLE, body: list, onSelect: function(item){ openCategory(item); } });
    }).catch(function(e){ console.error('getContentAreas err', e); Lampa.Noty.show('Помилка отримання категорій: '+(e.message||e)); });
  }

  function openCategory(item){
    var api = new KyivstarApi();
    Lampa.Activity.push({ component: 'preloader', title: item.title });
    api.getContentAreaElements(item.id,0,50).then(function(res){
      var entries = res && res.entries ? res.entries : (res || []);
      var cards = entries.map(function(en){ return { id: en.assetId||en.id, title: en.title||en.name, poster: (en.images && en.images[0] && en.images[0].url) || '', _raw: en, onSelect: function(){ openItem(en); } }; });
      Lampa.Activity.push({ component:'list', title: item.title, body: cards, onSelect: function(c){ openItem(c._raw || c); } });
    }).catch(function(e){ console.error('getContentAreaElements err', e); Lampa.Noty.show('Помилка завантаження ��лементів'); });
  }

  function openItem(raw){
    // if live channel -> open play with EPG button
    if(raw.type === 'live' || raw.assetType === 'LIVE_CHANNEL'){ showChannelPlayer(raw); return; }
    // else show simple fullcard
    Lampa.Activity.push({ component:'text', title: raw.title||raw.name, html: '<pre>'+JSON.stringify(raw,null,2)+'</pre>' });
  }

  function showChannelPlayer(raw){
    var api = new KyivstarApi();
    // render simple UI with Play button and EPG button
    var html = '<div class="category-full"><div class="category-full__head"><h2>'+ (raw.title||raw.name) +'</h2></div>' +
      '<div class="category-full__body"><button id="kyv_play">Відтворити</button> <button id="kyv_epg">Телепрограма</button></div></div>';
    Lampa.Activity.push({ component:'text', title: raw.title||raw.name, html: html, onCreate: function(){
      var b = document.getElementById('kyv_play'); if(b) b.addEventListener('click', function(){ api.getStreamUrl(raw.assetId, 'LIVE').then(function(s){ Lampa.Player.play({ url: s.url }); }).catch(function(e){ Lampa.Noty.show('Помилка відтворення: '+(e.message||e)); }); });
      var e = document.getElementById('kyv_epg'); if(e) e.addEventListener('click', function(){ openEPGForChannel(raw.assetId); });
    }});
  }

  function openEPGForChannel(channelAssetId){
    // sync today and show programs from IndexedDB
    if(window.KyivstarEPGImporter) KyivstarEPGImporter.syncChannelToday(channelAssetId).then(function(){
      return KyivstarEPGDB.allPrograms();
    }).then(function(programs){
      var filtered = programs.filter(p => p.channelAssetId === channelAssetId).sort((a,b)=> a.start - b.start);
      var list = filtered.map(function(p){ return { title: p.title, subtitle: (new Date(p.start*1000)).toLocaleString(), _raw: p }; });
      Lampa.Activity.push({ component:'list', title: 'Телепрограма', body: list, onSelect: function(item){ openProgram(item._raw); } });
    }).catch(function(e){ console.error('EPG err', e); Lampa.Noty.show('Помилка EPG: '+(e.message||e)); });
  }

  function openProgram(program){
    // if program has playback asset or date -> call getStreamUrl with VIRTUAL
    var api = new KyivstarApi();
    var date = program.start; // seconds
    api.getStreamUrl(program.playbackAssetId || program.assetId || program.programId, 'VIRTUAL', date).then(function(s){ Lampa.Player.play({ url: s.url }); }).catch(function(e){ Lampa.Noty.show('Помилка відтворення запису: '+(e.message||e)); });
  }

  // settings registration
  function registerSettingsShortcut(){
    if(window.__kyv_register_settings) window.__kyv_register_settings();
  }

  // bootstrap
  setTimeout(function(){ registerSource(); registerSettingsShortcut(); }, 200);

  // expose small API
  window.__kyv_plugin = { showMain: showMain };

})();
