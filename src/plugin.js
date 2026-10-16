(function(){
    'use strict';

    // Minimal LAMPA plugin skeleton. The full implementation will be modularized
    // into src/kyivstar_api.js, src/epg/indexeddb.js and UI modules.

    // Plugin configuration
    var COMPONENT = 'kyivstar_tv';
    var TITLE = 'Kyivstar TV (WIP)';

    // Ensure Lampa is available before booting
    function boot(){
        if(!window.Lampa || !window.Lampa.Storage){
            setTimeout(boot, 200);
            return;
        }

        try{
            // Expose minimal interface for Lampa integration
            if(!window.lampa_plugins) window.lampa_plugins = [];

            var plugin = {
                id: COMPONENT,
                name: TITLE,
                version: '0.1.0',
                type: 'video',
                icon: '',

                // Called when LAMPA wants to open the plugin main screen
                show: function(){
                    showMain();
                },

                // Search integration (called by Lampa Search)
                search: function(params, callback){
                    var q = params && params.query ? params.query : '';
                    var api = new KyivstarApi();
                    api.search(q).then(function(results){
                        // Map to Lampa rows (simple mapping for prototype)
                        var cards = (results || []).map(function(item){
                            return {
                                id: item.assetId || item.id || '',
                                title: item.name || item.title || item.displayName || '',
                                poster: item.image || (item.images && item.images[0] && item.images[0].url) || '',
                                source: COMPONENT,
                                _kyivstar: item
                            };
                        });
                        callback(cards);
                    }).catch(function(err){
                        console.error('Kyivstar search error', err);
                        callback([]);
                    });
                }
            };

            window.lampa_plugins.push(plugin);
            console.info(TITLE + ' plugin loaded (skeleton)');

        }catch(e){
            console.error('Kyivstar plugin boot failed', e);
        }
    }

    function showMain(){
        // Minimal main activity: open a category screen using Lampa.Activity
        if(window.Lampa && window.Lampa.Activity && Lampa.Activity.push){
            Lampa.Activity.push({
                component: 'main',
                source: COMPONENT,
                title: TITLE,
                page: 1
            });
            return;
        }

        alert(TITLE + ' — Lampa API not ready');
    }

    // Basic API client constructor is in src/kyivstar_api.js; this file expects it to be
    // available in the global scope as KyivstarApi. The port will later bundle modules.

    boot();
})();
