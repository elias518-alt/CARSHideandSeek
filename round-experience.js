'use strict';
(function(){
  const $=id=>document.getElementById(id),ui=window.roundPresentation;
  let introTimer,lastRoleKey='',lastResult='';
  function element(tag,id,parent){const node=document.createElement(tag);node.id=id;parent.append(node);return node;}
  function hideIntro(){clearTimeout(introTimer);$('roundRoleIntro')?.remove();}
  function introduction(lobby){
    if(!['SEEKER','HIDER'].includes(lobby.me.role))return;
    const key=[lobby.code,lobby.me.id,lobby.countdownEndsAt||lobby.headstartEndsAt||lobby.endsAt,lobby.me.role].join(':');
    if(key===lastRoleKey)return;
    lastRoleKey=key;
    try{if(sessionStorage.getItem('chsRoleIntro')===key)return;sessionStorage.setItem('chsRoleIntro',key);}catch{}
    hideIntro();
    const node=element('div','roundRoleIntro',$('game'));node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.dataset.role=lobby.me.role;
    node.innerHTML='<span>'+appIcon(lobby.me.role==='SEEKER'?'search':'shield')+'</span><small>DEINE ROLLE</small><strong>DU BIST '+ui.role(lobby.me).toUpperCase()+'</strong><p>'+(lobby.me.role==='SEEKER'?'Warte bis zur Suchphase.':'Versteck dich im Spielgebiet.')+'</p>';
    introTimer=setTimeout(hideIntro,3000);
  }
  function tick(){
    if(typeof state==='undefined'||!state?.lobby||!ui.playing(state.lobby))return;
    const time=ui.clock(state,gameplayNow());
    $('timer').textContent=time.seconds===null?'–':formatTime(time.seconds);
    const phase=$('roundPhase');if(phase)phase.textContent=time.label;
    const health=$('roundHealth');if(health){const me=state.lobby.me;health.textContent=connectionLost?'Verbindung unterbrochen · Rejoin verfügbar':me.found?'Gefunden · Standortübertragung beendet':me.eliminated?'Ausgeschieden · Standortübertragung beendet':state.gpsWarning||!me.hasLocation?'GPS fehlt oder ist veraltet':'GPS aktuell · Verbunden';health.dataset.warning=String(connectionLost||state.gpsWarning||!me.hasLocation&&!me.found&&!me.eliminated);}
  }
  function render(){
    if(typeof state==='undefined'||!state?.lobby)return;
    const lobby=state.lobby,game=$('game'),active=ui.playing(lobby);
    game.classList.toggle('roundImmersive',active);game.dataset.roundRole=lobby.me.role||'';
    let dock=$('roundDock');
    if(!dock){dock=element('section','roundDock',game);dock.setAttribute('aria-label','Spieler und Spielaktionen');dock.innerHTML='<div id="roundHealth" role="status"></div><div id="roundRoster" aria-label="Spielerstatus"></div><div class="roundQuickActions"><button type="button" data-round-action="controls">Spielaktionen ↓</button><button type="button" data-round-action="players">Alle Spieler ↓</button><button type="button" data-round-action="help" aria-label="Spielregeln öffnen">?</button></div>';}
    dock.hidden=!active;
    if(active){
      const map=$('freshMapFold');map.open=true;
      // Only reorder existing nodes; their listeners and the map instance survive.
      const tools=game.querySelector('.freshLobbyTools');game.querySelector('.freshToolButtons').append($('leave'));if(tools&&tools.nextElementSibling!==map)tools.after(map);
      if(map.nextElementSibling!==$('targets'))map.after($('targets'));
      if($('targets').nextElementSibling!==$('gameplayDetails'))$('targets').after($('gameplayDetails'));
      let phase=$('roundPhase');if(!phase)phase=element('small','roundPhase',game.querySelector('.gameStats'));
      const roster=lobby.players.slice().sort((a,b)=>(a.role==='SEEKER'?0:1)-(b.role==='SEEKER'?0:1));
      const html=roster.map(p=>'<div class="roundPlayer" data-role="'+esc(p.role||'')+'" data-out="'+!!(p.found||p.eliminated||p.left)+'"><span class="parkingStripAvatar">'+parkingAvatarMarkup(p)+'</span><div><strong>'+esc(p.name)+(p.id===lobby.me.id?' · Du':'')+'</strong><small>'+ui.role(p)+' · '+ui.status(p)+'</small></div></div>').join('');
      if($('roundRoster').dataset.markup!==html){$('roundRoster').innerHTML=html;$('roundRoster').dataset.markup=html;}
      introduction(lobby);tick();
    }else hideIntro();
    let reason=$('roundStartReason');if(!reason)reason=element('p','roundStartReason',game.querySelector('.freshRoomHeader'));
    reason.hidden=lobby.state!=='LOBBY';if(!reason.hidden)reason.textContent=ui.startReason(lobby);
    if(lobby.state==='RESULT'){
      if(lobby.result?.aborted)$('resultText').textContent=ui.abortReason(lobby.result)+' Für diese Runde gibt es keine XP.';
      let personal=$('roundPersonalResult');if(!personal){personal=element('div','roundPersonalResult',$('result'));$('rematch').before(personal);}
      const me=lobby.result?.players?.find(p=>p.id===lobby.me.id);
      personal.innerHTML=(me?'<div class="roundPerformance"><span><strong>'+Number(me.finds||0)+'</strong>Funde</span><span><strong>'+Number(me.escapes||0)+'</strong>Fluchten</span><span><strong>'+formatTime(me.survivalSeconds||0)+'</strong>Überlebt</span></div>':'')+'<div id="roundRewardProgress"></div><button type="button" data-round-action="rewards">Fortschritt & Belohnungen</button><button type="button" data-round-action="leave">Lobby verlassen</button>';
      window.crewUI?.renderRoundProgress?.();
      if(lastResult!==lobby.result?.id){lastResult=lobby.result?.id;window.crewUI?.refreshProgress?.();}
    }
  }
  function help(){
    let d=$('roundHelp');if(!d){d=element('dialog','roundHelp',document.body);d.className='hubSheet';d.innerHTML='<header><h2>So spielst du</h2><button type="button" data-round-action="close-help" aria-label="Schließen">×</button></header><div class="hubSheetBody"><h3>1 · Dein Fahrzeug</h3><p>Wähle dein Auto und deine Farbe in der Garage. Ein eigenes Fahrzeugfoto hilft deiner Crew, dich wiederzuerkennen.</p><h3>2 · Gemeinsam starten</h3><p>Erstelle eine Lobby oder tritt per Code beziehungsweise Schnellbeitritt bei. Gib deinen Standort frei, komm zum Treffpunkt und melde dich bereit. Der Host startet die Runde.</p><h3>3 · Deine Rolle</h3><p>Verstecker bewegen sich innerhalb des Spielgebiets. Sucher warten in der Versteckphase am Startbereich und beginnen erst nach dem Countdown.</p><h3>4 · Finden und entkommen</h3><p>Sucher wählen das tatsächlich erkannte Fahrzeug. Der Server prüft GPS und Abstand; ein bestätigter Fund läuft 10–15 Sekunden. Verstecker können einmal aus einem Fund-Countdown entkommen. Fahrer bedienen die Fundfunktion nur im sicheren Stillstand.</p><h3>5 · Status und Abbruch</h3><p>Unten auf der Karte siehst du Sucher, aktive und ausgeschiedene Spieler. Ein Verbindungsabbruch bedeutet nicht sofort ausgeschieden. Aktive Spieler können für einen Rundenabbruch stimmen; erforderlich ist mehr als die Hälfte.</p><button type="button" data-round-action="close-help">Verstanden</button></div>';}
    d.showModal();
  }
  document.addEventListener('click',event=>{const b=event.target.closest('[data-round-action]');if(!b)return;const action=b.dataset.roundAction;
    if(action==='help')help();if(action==='close-help')$('roundHelp')?.close();
    if(action==='controls')($('targets').classList.contains('hidden')?$('gameplayDetails'):$('targets')).scrollIntoView({block:'start',behavior:'smooth'});
    if(action==='players')document.querySelector('.freshCrewBoard').scrollIntoView({block:'start',behavior:'smooth'});
    if(action==='rewards')window.crewUI?.openProgress?.();if(action==='leave')$('leave').click();
  });
  function ensureHelp(){const home=$('homeSeasonSummary');if(home&&!$('roundHelpButton')){const b=element('button','roundHelpButton',home);b.type='button';b.dataset.roundAction='help';b.textContent='Spielregeln';}}
  ensureHelp();
  setInterval(tick,250);
  window.roundExperience={render,help,hideIntro,ensureHelp};
})();
