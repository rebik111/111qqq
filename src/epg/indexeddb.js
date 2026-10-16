// IndexedDB helper for EPG / archive storage (skeleton)
// We will use an object store for channels and programs; the full implementation
// will include migrations and sync tasks.

(function(){
    'use strict';

    var DB_NAME = 'kyivstar_epg';
    var DB_VERSION = 1;
    var STORE_CHANNELS = 'channels';
    var STORE_PROGRAMS = 'programs';

    function openDb(){
        return new Promise(function(resolve, reject){
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e){
                var db = e.target.result;
                if(!db.objectStoreNames.contains(STORE_CHANNELS)) db.createObjectStore(STORE_CHANNELS, { keyPath: 'assetId' });
                if(!db.objectStoreNames.contains(STORE_PROGRAMS)) db.createObjectStore(STORE_PROGRAMS, { keyPath: 'programId' });
            };
            req.onsuccess = function(){ resolve(req.result); };
            req.onerror = function(){ reject(req.error); };
        });
    }

    function put(storeName, item){
        return openDb().then(function(db){
            return new Promise(function(resolve, reject){
                var tx = db.transaction([storeName], 'readwrite');
                var store = tx.objectStore(storeName);
                var r = store.put(item);
                r.onsuccess = function(){ resolve(r.result); };
                r.onerror = function(){ reject(r.error); };
            });
        });
    }

    function get(storeName, key){
        return openDb().then(function(db){
            return new Promise(function(resolve, reject){
                var tx = db.transaction([storeName], 'readonly');
                var store = tx.objectStore(storeName);
                var r = store.get(key);
                r.onsuccess = function(){ resolve(r.result); };
                r.onerror = function(){ reject(r.error); };
            });
        });
    }

    function all(storeName){
        return openDb().then(function(db){
            return new Promise(function(resolve, reject){
                var tx = db.transaction([storeName], 'readonly');
                var store = tx.objectStore(storeName);
                var items = [];
                var cur = store.openCursor();
                cur.onsuccess = function(e){
                    var cursor = e.target.result;
                    if(!cursor){ resolve(items); return; }
                    items.push(cursor.value);
                    cursor.continue();
                };
                cur.onerror = function(){ reject(cur.error); };
            });
        });
    }

    window.KyivstarEPGDB = {
        putChannel: function(channel){ return put(STORE_CHANNELS, channel); },
        getChannel: function(id){ return get(STORE_CHANNELS, id); },
        allChannels: function(){ return all(STORE_CHANNELS); },
        putProgram: function(program){ return put(STORE_PROGRAMS, program); },
        getProgram: function(id){ return get(STORE_PROGRAMS, id); },
        allPrograms: function(){ return all(STORE_PROGRAMS); }
    };

})();
