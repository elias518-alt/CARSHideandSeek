'use strict';
// Pure presentation decisions shared by the browser and regression tests.
(function(root){
  const playing = lobby => ['COUNTDOWN','HEADSTART','ACTIVE'].includes(lobby?.state);
  const role = player => player?.role === 'SEEKER' ? 'Sucher' : player?.role === 'HIDER' ? 'Verstecker' : 'Rolle wird bestimmt';
  function status(player){
    if(player.left)return 'Runde verlassen';
    if(player.eliminated)return 'Ausgeschieden';
    if(player.found)return 'Gefunden';
    if(player.connected===false)return 'Verbindung verloren';
    return 'Im Spiel';
  }
  function abortReason(result){
    if(!result?.aborted)return '';
    return {ABORT_VOTE:'Die Mehrheit der aktiven Spieler hat für den Abbruch gestimmt.',TOO_FEW_PLAYERS:'Es sind nicht mehr genügend Spieler für diese Runde verfügbar.',NO_PLAYERS:'Es sind keine aktiven Spieler mehr in der Runde.',ADMIN_CLOSED:'Die Moderation hat diese Lobby geschlossen.'}[result.reason] || 'Diese Runde wurde ohne Wertung beendet.';
  }
  function startReason(lobby){
    if(lobby.players.length<2)return 'Mindestens zwei Spieler werden benötigt.';
    const offline=lobby.players.filter(p=>!p.connected);
    if(offline.length)return 'Verbindung fehlt: '+offline.map(p=>p.name).join(', ');
    const gps=lobby.players.filter(p=>!p.hasLocation);
    if(gps.length)return 'Aktueller Standort fehlt: '+gps.map(p=>p.name).join(', ');
    const waiting=lobby.players.filter(p=>p.id!==lobby.hostId&&!p.ready);
    if(waiting.length)return 'Noch nicht bereit: '+waiting.map(p=>p.name).join(', ');
    return lobby.hostId===lobby.me.id?'Alle bereit. Beim Start wird zusätzlich der Abstand zum Treffpunkt geprüft.':'Alle bereit. Der Host kann starten; alle müssen am Treffpunkt sein.';
  }
  function clock(state,now){
    const lobby=state.lobby;
    const escape=state.escapeUntil>now&&lobby.me.role==='HIDER';
    const until=escape?state.escapeUntil:lobby.state==='COUNTDOWN'?lobby.countdownEndsAt:lobby.state==='HEADSTART'?lobby.headstartEndsAt:lobby.endsAt;
    return {label:escape?'Fund-Countdown / Flucht':lobby.state==='COUNTDOWN'?'Rundenstart':lobby.state==='HEADSTART'?'Versteckphase':'Suchphase',seconds:until?Math.max(0,Math.ceil((until-now)/1000)):null};
  }
  const api={playing,role,status,abortReason,startReason,clock};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.roundPresentation=api;
})(typeof window==='undefined'?globalThis:window);
