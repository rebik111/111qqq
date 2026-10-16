(function(){
  'use strict';

  // Settings UI for Kyivstar plugin
  // Adds items into Lampa.Settings when available

  function safeGet(key, def){
    try{ return Lampa.Storage.get('kyv_' + key, def); }catch(e){ return def; }
  }
  function safeSet(key, val){ try{ Lampa.Storage.set('kyv_' + key, val); }catch(e){} }

  function createSettings(){
    if(!window.Lampa || !Lampa.Activity) return;

    var items = [];

    items.push({ title: 'Тип входу', subtitle: safeGet('login_type','anonymous') });
    items.push({ title: 'Номер телефону', subtitle: safeGet('phone','') });
    items.push({ title: 'SMS-код', subtitle: 'Введіть код при потребі' });
    items.push({ title: 'CORS proxy (URL)', subtitle: safeGet('proxy_url','http://localhost:8080/p?url={url}') });
    items.push({ title: 'CORS proxy увімкнено', subtitle: safeGet('proxy_enabled',false) ? 'Так' : 'Ні' });
    items.push({ title: 'Додавати stream headers', subtitle: safeGet('stream_headers',false) ? 'Так' : 'Ні' });
    items.push({ title: 'Надіслати SMS-код', subtitle: 'Надіслати OTP на вказаний номер' });
    items.push({ title: 'Оновити сесію', subtitle: 'Повторний вхід' });
    items.push({ title: 'Очистити OTP', subtitle: 'Очистити pending phone session' });
    items.push({ title: 'Діагностика / логи', subtitle: 'Відкрити лог запитів Kyivstar' });
    items.push({ title: 'Вийти / очистити сесію', subtitle: 'Очистити локальну сесію' });

    var html = '<div class="category-full kyv-settings"><div class="category-full__head"><h2>Kyivstar TV — Налаштування</h2></div><div class="category-full__body">';
    items.forEach(function(it,i){ html += '<div class="category-full__row kyv-row" data-i="'+i+'"><div class="row__title">'+it.title+'</div><div class="row__subtitle">'+(it.subtitle||'')+'</div></div>'; });
    html += '</div></div>';

    Lampa.Activity.push({
      component: 'text',
      html: html,
      onCreate: function(){
        var rows = document.querySelectorAll('.kyv-row');
        rows.forEach(function(r){ r.addEventListener('click', function(){ var i = parseInt(r.getAttribute('data-i')); onSelect(i); }); });
      }
    });
  }

  function onSelect(i){
    switch(i){
      case 0: // login type
        Lampa.Select.show([{title:'anonymous'},{title:'account'},{title:'phone'}],0,function(s){ Lampa.Storage.set('kyv_login_type', s.title); Lampa.Noty.show('Тип входу збережено: '+s.title); });
        break;
      case 3: // proxy URL
        Lampa.Input.show('Введіть URL proxy (use {url} placeholder)', Lampa.Storage.get('kyv_proxy_url','http://localhost:8080/p?url={url}'), function(v){ Lampa.Storage.set('kyv_proxy_url', v); Lampa.Noty.show('Proxy URL збережено'); });
        break;
      case 4: // proxy enabled
        var cur = Lampa.Storage.get('kyv_proxy_enabled', false);
        Lampa.Storage.set('kyv_proxy_enabled', !cur);
        Lampa.Noty.show('Proxy ' + (!cur ? 'увімкнено' : 'вимкнено'));
        break;
      case 5: // stream headers
        var sh = Lampa.Storage.get('kyv_stream_headers', false);
        Lampa.Storage.set('kyv_stream_headers', !sh);
        Lampa.Noty.show('Stream headers ' + (!sh ? 'увімкнено' : 'вимкнено'));
        break;
      case 6: // send SMS
        Lampa.Noty.show('Відправка SMS (віддалено)');
        // trigger via KyivstarApi (if loaded)
        if(window.KyivstarApi) new KyivstarApi().loginPhone();
        break;
      case 7: // refresh session
        if(window.KyivstarApi) new KyivstarApi().ensureSession(true).then(function(){ Lampa.Noty.show('Сесія оновлена'); }).catch(function(e){ Lampa.Noty.show('Помилка при оновленні: '+ (e.message||e)); });
        break;
      case 8: // clear OTP
        Lampa.Storage.set('kyv_otp',''); Lampa.Storage.set('kyv_pending_phone_session', null); Lampa.Noty.show('OTP очищено');
        break;
      case 9: // diagnostics
        // open simple diagnostics view
        Lampa.Activity.push({ component:'text', html: '<pre>'+JSON.stringify({storage: getStorageSnapshot()},null,2)+'</pre>' });
        break;
      case 10: // logout
        Lampa.Storage.set('kyv_session', null); Lampa.Storage.set('kyv_otp',''); Lampa.Noty.show('Сесія очищена');
        break;
      default:
        Lampa.Noty.show('Натиснуто: '+i);
    }
  }

  function getStorageSnapshot(){
    var keys = ['kyv_session','kyv_proxy_url','kyv_proxy_enabled','kyv_stream_headers','kyv_login_type','kyv_phone'];
    var out = {};
    keys.forEach(function(k){ out[k]=Lampa.Storage.get(k, null); });
    return out;
  }

  // register settings entry point
  if(window.Lampa && Lampa.Activity){
    // add a small hook in global settings menu — many Lampa instances render settings list from plugin sources; we push a global activity shortcut
    window.__kyv_register_settings = function(){
      Lampa.Activity.push({ component: 'main', title: 'Kyivstar TV — Налаштування', onCreate: createSettings });
    };
  }
})();
