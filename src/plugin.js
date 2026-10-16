(function(){
    'use strict';

    /*
      Тестовий плагін Kyivstar для швидкої перевірки на lampa.mx.
      - Реєструє плагін у window.lampa_plugins
      - Після ініціалізації виконує короткий запит getContentAreas() через KyivstarApi
      - Логи виводяться у консоль і через Lampa.Noty (якщо доступно)

      Використовуйте цей файл для швидкого тестування підключення та CORS/HTTP.
    */

    var COMPONENT = 'kyivstar_tv_test';
    var TITLE = 'Kyivstar TV — Test Build';

    function notify(msg){
        try{
            if(window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(String(msg));
            else console.log('NOTY: ' + msg);
        }catch(e){ console.log('NOTY ERR', e); }
    }

    function boot(){
        if(!window.Lampa || !window.Lampa.Storage){
            setTimeout(boot, 200);
            return;
        }

        if(!window.lampa_plugins) window.lampa_plugins = [];

        var plugin = {
            id: COMPONENT,
            name: TITLE,
            version: '0.1.0-test',
            type: 'video',
            icon: '',
            show: function(){
                if(window.Lampa && Lampa.Activity && Lampa.Activity.push){
                    Lampa.Activity.push({ component: 'main', source: COMPONENT, title: TITLE, page: 1 });
                } else {
                    notify(TITLE + ' opened');
                }
            }
        };

        window.lampa_plugins.push(plugin);
        console.info(TITLE + ' registered');

        // Короткий тест мережі: виклик content areas
        setTimeout(runQuickApiTest, 500);
    }

    function runQuickApiTest(){
        try{
            if(typeof window.KyivstarApi !== 'function'){
                console.warn('KyivstarApi не знайдено у глобальній області. Переконайтесь, що src/kyivstar_api.js підключений.');
                notify('KyivstarApi not loaded');
                return;
            }

            var api = new KyivstarApi();
            console.log('Test: calling KyivstarApi.getContentAreas()...');
            notify('Тест: викликаю getContentAreas()');

            api.getContentAreas().then(function(areas){
                console.log('getContentAreas SUCCESS:', areas);
                notify('getContentAreas OK: ' + (Array.isArray(areas) ? areas.length + ' areas' : 'result'));
            }).catch(function(err){
                console.error('getContentAreas ERROR:', err);
                try{
                    var msg = (err && err.message) ? err.message : String(err);
                    notify('getContentAreas ERROR: ' + msg);
                }catch(e){ console.log('notify err', e); }
            });
        }catch(e){
            console.error('runQuickApiTest exception', e);
            notify('Test exception: ' + (e && e.message ? e.message : String(e)));
        }
    }

    boot();
})();
