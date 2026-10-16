(function(){
  'use strict';

  // EPG importer: uses KyivstarApi.getChannelSchedule and stores programs into IndexedDB

  var DB = window.KyivstarEPGDB;
  if(!DB){ console.warn('KyivstarEPGDB not available'); return; }

  function syncChannelEPG(channelAssetId, from, to){
    var api = new KyivstarApi();
    return api.getChannelSchedule(channelAssetId, from, to).then(function(res){
      var programs = res && res.programs ? res.programs : (res || []);
      var promises = programs.map(function(p){
        var program = Object.assign({}, p, { programId: p.id || (channelAssetId + '_' + p.start), channelAssetId: channelAssetId });
        return DB.putProgram(program);
      });
      return Promise.all(promises);
    });
  }

  // helper: sync range for today +/- 1 day
  function syncChannelToday(channelAssetId){
    var start = new Date(); start.setHours(0,0,0,0);
    var from = Math.floor(start.getTime() / 1000);
    var end = new Date(start); end.setDate(end.getDate()+1);
    var to = Math.floor(end.getTime() / 1000);
    return syncChannelEPG(channelAssetId, from, to);
  }

  window.KyivstarEPGImporter = { syncChannelEPG: syncChannelEPG, syncChannelToday: syncChannelToday };
})();
