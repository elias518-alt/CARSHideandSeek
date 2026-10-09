// One server clock and the existing state poll drive all round controls.
let gameplayReceivedAt = 0;
let gameplayEventCursor = '';
function gameplayNow() { return (state?.serverTime || Date.now()) + Math.max(0,Date.now()-gameplayReceivedAt); }
function findCountdownLabel(lock) { return 'Fund bestätigen · '+(state?.lobby?.players?.find(p=>p.id===lock.targetId)?.name||'Fahrzeug')+' · '+Math.min((lock.endsAt-lock.startedAt)/1000,Math.max(0,(lock.endsAt-gameplayNow())/1000)).toFixed(1)+' s'; }
async function gameplayAction(action,extra={}) {
  try { const result=await api(action,gameCredentials(extra)); if(action==='abort-vote')toast('Abbruch: '+result.votes+' von '+result.required+' benötigten Stimmen.'); await poll(); }
  catch(error){toast(error.message);}
}
function gameplayButton(label,action,extra) {
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.addEventListener('click',()=>gameplayAction(action,extra));return button;
}
function renderGameplayDetails() {
  const lobby=state?.lobby;if(!lobby)return;
  let panel=document.getElementById('gameplayDetails');
  if(!panel){panel=document.createElement('section');panel.id='gameplayDetails';panel.className='gameplayDetails';$('#targets').before(panel);}
  const waiting=lobby.state==='LOBBY';
  const key=JSON.stringify([lobby.code,lobby.state,lobby.hostId,lobby.me.id,lobby.settings?.revision,
    lobby.players.map(p=>[p.id,p.name,p.role,p.found,p.eliminated,p.eliminationReason,p.profileId,p.ready]),
    state.locks,state.escapesUsed,state.outsideDeadline,state.replacementUntil,state.replacementNeedsStop,state.afkDeadline,state.driverBlocked,state.gpsWarning,
    (state.events||[]).map(e=>e.id),state.debugAvailable,state.blocksForMe,(state.history||[]).map(r=>r.id)]);
  if(panel.dataset.renderKey===key)return;
  panel.dataset.renderKey=key;
  panel.hidden=waiting;
  let management=document.getElementById('lobbyManagement');
  if(!management){management=document.createElement('section');management.id='lobbyManagement';document.getElementById('lobbySettingsPanel').append(management);}
  management.replaceChildren();
  const output=waiting?management:panel;
  panel.replaceChildren();
  const countdown=(prefix,until)=>{const p=document.createElement('p');p.dataset.countdownUntil=until;p.dataset.countdownPrefix=prefix;output.append(p);updateGameplayCountdowns();};
  const text=value=>{const p=document.createElement('p');p.textContent=value;output.append(p);};
  const playing=['COUNTDOWN','HEADSTART','ACTIVE'].includes(lobby.state);
  if(waiting){
    text('Das Verstecken in mehrstöckigen Parkhäusern ist nicht erlaubt, da GPS keine zuverlässige Erkennung der jeweiligen Etage ermöglicht.');
    text('Sucher warten während der Versteckphase sicher abseits im Wartebereich und beobachten die Verstecker nicht.');
    text('Start am Treffpunkt: Alle Teilnehmer müssen innerhalb von 50 m sein. Prüft vor Ort, ob das Gebiet geeignet ist.');
    if(lobby.hostId===lobby.me.id){
      output.append(gameplayButton('Meinen Standort als Treffpunkt setzen','checkpoint'));
      for(const player of lobby.players.filter(p=>p.id!==lobby.me.id))output.append(gameplayButton(player.name+' aus Lobby entfernen','kick',{targetId:player.id}));
    }
  }
  if(playing){
    if(lobby.state==='HEADSTART'&&lobby.me.role==='SEEKER')text('Sicher abseits warten. Beobachte nicht, wohin die Verstecker fahren. Gegnerhinweise sind bis zur Suchphase ausgeblendet.');
    if(lobby.me.eliminated)text('Ausgeschieden: '+({EARLY_START:'Startbereich zu früh verlassen',OUTSIDE:'Spielgebiet nicht rechtzeitig erreicht',GPS_TIMEOUT:'GPS zu lange ausgefallen',DISCONNECT:'Verbindung zu lange unterbrochen',AFK:'Inaktivität',LEFT:'Runde verlassen'}[lobby.me.eliminationReason]||lobby.me.eliminationReason));
    else if(lobby.me.found)text('Du wurdest gefunden. Deine Standortübertragung wurde beendet.');
    else {
      if(lobby.state==='HEADSTART'&&lobby.me.role==='HIDER')text('Versteck dich im Spielgebiet. Die Sucher starten nach dem Countdown.');
      if(lobby.me.role==='HIDER')text(state.escapesUsed?'Deine einmalige Flucht ist verbraucht. Beim nächsten gültigen Fund-Countdown kannst du nicht erneut entkommen.':'Du darfst dich im Spielradius bewegen und einmal aus einem Fund-Countdown entkommen.');
      if(state.outsideDeadline)countdown('Außerhalb des Gebiets: Rückkehr in ',state.outsideDeadline);
      if(state.gpsWarning)text('GPS fehlt oder ist schwach. Letzte gültige Position bleibt vorübergehend erhalten.');
      if(state.driverBlocked && lobby.me.role==='SEEKER')text('Als Fahrer erst sicher anhalten, um einen Fund zu starten.');
      if(state.replacementUntil>gameplayNow())countdown('Ersatzsucher: Zeit zum sicheren Anhalten · ',state.replacementUntil);
      if(state.replacementNeedsStop&&state.replacementUntil<=gameplayNow())text('Als Ersatzsucher bitte anhalten. GPS bestätigt den Stillstand, bevor du Funde starten kannst.');
      if(state.afkDeadline){countdown('Noch aktiv? Bitte bestätigen in ',state.afkDeadline);panel.append(gameplayButton('Ich bin noch dabei','activity'));}
      panel.append(gameplayButton('Für Rundenabbruch stimmen','abort-vote'));
    }
  }
  const events=state.events||[];
  const last=events.at(-1);
  const ownLock=state.locks?.find(lock=>lock.seekerId===lobby.me.id);
  if(ownLock)$('#findFeedback').textContent='Festes Ziel · '+findCountdownLabel(ownLock)+' · Fahrt auf der Karte sichtbar';
  else {
    const ownEvent=[...events].reverse().find(event=>['FOUND','ESCAPED','LOCK_CANCELLED'].includes(event.type)&&event.seekerId===lobby.me.id);
    if(ownEvent)$('#findFeedback').textContent=ownEvent.body;
  }
  if(last && !['ROLES','START'].includes(last.type))text(last.body);
  if(last && gameplayEventCursor && gameplayEventCursor!==last.id && ['FOUND','ESCAPED','DISQUALIFIED','REPLACEMENT','END'].includes(last.type)){
    toast(last.body);
    if(localStorage.getItem('chsGameFeedback')==='true'){
      navigator.vibrate?.([100,50,100]);
      try { const Context=window.AudioContext||window.webkitAudioContext;const audio=new Context();const tone=audio.createOscillator(),gain=audio.createGain();tone.connect(gain);gain.connect(audio.destination);gain.gain.value=.04;tone.frequency.value=660;tone.start();tone.stop(audio.currentTime+.15);tone.onended=()=>audio.close(); }catch{}
    }
  }
  gameplayEventCursor=last?.id||'';
  if(lobby.state==='RESULT'){
    const table=document.createElement('table');table.className='gameplayResults';
    const header=table.insertRow();for(const label of ['Spieler','Rolle','Gefunden von / Status','Funde','Fluchten','Fehlversuche','Überlebt','Außerhalb','XP']){const th=document.createElement('th');th.textContent=label;header.append(th);}
    for(const player of lobby.result?.players||[]){const row=table.insertRow();for(const value of [player.name+(player.eliminated?' · ausgeschieden':''),player.role==='SEEKER'?'Sucher':'Verstecker',player.foundBy?(lobby.result.players.find(p=>p.id===player.foundBy)?.name||'Sucher'):player.eliminated?'Ausgeschieden':player.role==='HIDER'?'Überlebt':'—',player.finds,player.escapes,player.failedFinds,formatTime(player.survivalSeconds),formatTime(Math.round((player.outsideMs||0)/1000)),player.baseXp||0])row.insertCell().textContent=String(value||0);}
    panel.append(table);
    const journal=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ereignisse dieser Runde';journal.append(summary);
    for(const event of state.events||[]){const line=document.createElement('p');line.textContent=event.body;journal.append(line);}panel.append(journal);
    const history=document.createElement('details'),title=document.createElement('summary');title.textContent='Letzte Runden';history.append(title);
    for(const result of state.history||[]){const line=document.createElement('p');line.textContent=new Date(result.endedAt).toLocaleString('de-DE')+' · '+(result.aborted?'Abgebrochen':result.seekersWin?'Sucher gewinnen':'Verstecker gewinnen');history.append(line);}panel.append(history);
  }
  const moderation=document.createElement('details');const heading=document.createElement('summary');heading.textContent='Spieler melden oder blockieren';moderation.append(heading);
  for(const player of lobby.players.filter(p=>p.id!==lobby.me.id))moderation.append(playerModerationActions(player));
  output.append(moderation);
  const feedback=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=localStorage.getItem('chsGameFeedback')==='true';
  check.addEventListener('change',()=>localStorage.setItem('chsGameFeedback',String(check.checked)));feedback.append(check,document.createTextNode(' Töne und Vibration bei Spielereignissen'));output.append(feedback);
  if(state.debugAvailable){
    const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Administrator: Rundendiagnose';details.append(summary,pre);
    details.addEventListener('toggle',async()=>{if(!details.open)return;try{const data=await api('debug',gameCredentials(),'GET');pre.textContent=JSON.stringify(data,null,2);}catch(error){pre.textContent=error.message;}});output.append(details);
  }
  const tutorialKey='chsRulesSeen:'+String(lobby.me.profileId||lobby.me.id);
  if(waiting&&!localStorage.getItem(tutorialKey)){
    const dialog=document.createElement('dialog');const info=document.createElement('p');info.textContent='Verstecker dürfen sich im Spielradius bewegen und einmal entkommen. Sucher warten zuerst am Treffpunkt. Ein Fund startet nur mit bestätigtem GPS innerhalb von 8 m und läuft 10–15 Sekunden auf dasselbe Ziel. Fahrer bedienen die Fundfunktion erst im Stillstand.';
    const button=document.createElement('button');button.textContent='Verstanden';button.addEventListener('click',()=>{localStorage.setItem(tutorialKey,'true');dialog.close();dialog.remove();});dialog.append(info,button);document.body.append(dialog);localStorage.setItem(tutorialKey,'shown');dialog.showModal();
  }
}
function updateGameplayCountdowns(){
  for(const node of document.querySelectorAll('[data-countdown-until]'))node.textContent=node.dataset.countdownPrefix+Math.max(0,Math.ceil((Number(node.dataset.countdownUntil)-gameplayNow())/1000))+' s';
}
setInterval(()=>{
  if(typeof state==='undefined')return;
  updateGameplayCountdowns();
  const lock=state?.locks?.find(item=>item.seekerId===state?.lobby?.me?.id);
  if(!lock||state?.lobby?.state!=='ACTIVE')return;
  const button=[...($('#targetButtons')?.children||[])].find(item=>item.dataset.targetId===lock.targetId);
  if(button)button.textContent=findCountdownLabel(lock);
  const feedback=$('#findFeedback');if(feedback)feedback.textContent='Festes Ziel · '+findCountdownLabel(lock)+' · Fahrt auf der Karte sichtbar';
},100);
document.addEventListener('pointerdown',()=>{
  if(typeof gameSession==='undefined'||!gameSession||!['COUNTDOWN','HEADSTART','ACTIVE'].includes(state?.lobby?.state))return;
  if(Date.now()-(document._chsActivityAt||0)<30000)return;
  document._chsActivityAt=Date.now();void api('activity',gameCredentials()).catch(()=>{});
});

document.getElementById('lobbyPreset')?.addEventListener('change',event=>{
  const presets={quick:[500,300,120,10],normal:[1000,900,180,15],large:[3000,1800,180,15]};
  const values=presets[event.target.value];if(!values)return;
  ['lobbyRadius','lobbyDuration','lobbyHeadstart','lobbyEscape'].forEach((id,index)=>{document.getElementById(id).value=values[index];});
  void saveFreshLobbySettings();
});

function playerModerationActions(player){
  const actions=document.createElement("div");
    const blocked=state?.blocksForMe?.includes(player.profileId);
    const block=gameplayButton(player.name+(blocked?' · Blockierung aufheben':' für nächste Lobbys blockieren'),'block',{targetAuthId:player.profileId,blocked:!blocked});actions.append(block);
    const report=document.createElement('button');report.textContent=player.name+' melden';report.addEventListener('click',()=>{
      window.betaUI.report(player);
    });actions.append(report);

  return actions;
}

function positionGameplayDetails(){
  const panel=document.getElementById('gameplayDetails');if(!panel)return;
  const anchor=state?.lobby?.state==='RESULT'?document.getElementById('result'):document.getElementById('freshMapFold');
  if(!anchor)return;
  if(state?.lobby?.state==='RESULT'){if(anchor.nextElementSibling!==panel)anchor.after(panel);}
  else if(panel.nextElementSibling!==anchor)anchor.before(panel);
}
