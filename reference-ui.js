'use strict';
/* Reference composition using live account, vehicle and crew data. */
(function(){
 let crewRows=[];
 // Unique SVG IDs must not restart an unchanged avatar animation on each poll.
 const avatarSignature=html=>html.replace(/(avatar|character-studio|studio-car|pet)-\d+/g,'$1-id');
 function ownPlayer(car=activeCar()){return {id:'own-reference',profileId:authSession?.user?.id,name:dbProfile?.username||authSession?.user?.user_metadata?.full_name||'Spieler',avatarUrl:dbProfile?.avatar_url,vehicle:car?[car.brand,car.model].filter(Boolean).join(' '):'Dein Fahrzeug',bodyType:car?.body,vehicleYear:car?.year,vehicleSeries:car?.series,color:car?.color,cosmetics:car?.cosmetics,photoUrl:car?.photo,appearance:window.accountUI?.appearance?.(),pet:window.petUI?.selection?.(),characterStyle:getCharacterStyle()};}
 function renderOwn(){
  const target=document.getElementById('homeOwnScene');if(!target)return;const car=activeCar(),player=ownPlayer(car),name=player.name;
  const intro=document.getElementById('homeGreeting');intro.textContent='Hey '+name.split(/\s+/)[0];
  document.getElementById('homeGreetingAvatar').innerHTML=parkingAvatarMarkup(player);
  document.getElementById('homeGreetingCar').textContent=car?player.vehicle+' ist bereit':'Wähle dein Fahrzeug in der Garage';
  const markup=car?'<article class="parkingPlayer isHost"><div class="parkingVehicleStage">'+carPhotoMarkup(car,'home-hero')+lobbyCharacterMarkup(player)+'<span class="parkingContactShadow"></span></div></article>':'<button class="referenceNoCar" type="button" data-page="garage">Fahrzeug hinzufügen <span>Dein Auto und Charakter erscheinen hier.</span></button>';
  if(target.dataset.markup!==avatarSignature(markup)){target.innerHTML=markup;target.dataset.markup=avatarSignature(markup);}
  window.gameDesign?.profileScene(car,player);
  renderPhotoPreview();
 }
 function renderCrew(rows=crewRows){
  crewRows=rows;const friends=rows.filter(r=>r.status==='accepted'),html=friends.slice(0,6).map(r=>'<button type="button" class="referenceCrewPerson" data-dm="'+esc(r.peer_id)+'" data-reference-peer><span class="referenceCrewPortrait">'+socialAvatarMarkup(r)+(friendIsOnline(r)?'<i class="referenceOnline" aria-label="Vor kurzem aktiv"></i>':'')+'</span><strong>'+esc(friendDisplayName(r))+'</strong><small>'+esc(friendActivityLabel(r))+'</small>'+(Number(r.unread_count)>0?'<span class="notificationBadge">'+esc(Math.min(99,Number(r.unread_count)))+'</span>':'')+'</button>').join('');
  const home=document.getElementById('homeCrewPeople');if(home){const markup=html||'<p class="muted">Deine Crew beginnt mit einer Freundschaftsanfrage.</p>';if(home.dataset.markup!==markup){home.innerHTML=markup;home.dataset.markup=markup;}}
  const profile=document.getElementById('profileCrewPeople');if(profile){const markup=friends.slice(0,6).map(r=>'<article class="communityCrewRow"><button type="button" data-crew-profile="'+esc(r.peer_id)+'">'+socialAvatarMarkup(r)+'<span><strong>'+esc(friendDisplayName(r))+'</strong><small><i class="'+(friendIsOnline(r)?'communityOnline':'communityOffline')+'"></i>'+esc(friendActivityLabel(r))+'</small></span></button><button type="button" data-reference-peer data-dm="'+esc(r.peer_id)+'" aria-label="Chat mit '+esc(friendDisplayName(r))+'">'+(typeof appIcon==='function'?appIcon('chat'):'CHAT')+'</button></article>').join('')||'<p class="communityEmpty">Deine Crew beginnt mit einer Einladung.</p>';if(profile.dataset.markup!==markup){profile.innerHTML=markup;profile.dataset.markup=markup;}}
  window.crewUI?.renderHomeCrew();
 }
 function renderPhotoPreview(){
  const box=document.getElementById('photoLobbyPreview');if(!box)return;
  const editId=typeof editingVehicleId==='undefined'?null:editingVehicleId;const existing=localGarage.find(c=>c.id===editId)||{},car={...existing,brand:$('#newCarBrand')?.value,model:$('#newCarModel')?.value,color:$('#newCarColor')?.value,body:$('#newCarBody')?.value};
  const photo=pendingCarPhoto||existing.photo;if(!photo){box.replaceChildren();delete box.dataset.markup;box.hidden=true;return;}
  const p={...ownPlayer(car),photoUrl:photo};box.hidden=false;
  const markup='<span class="photoPreviewLabel">So wirkt es in der Lobby</span><article class="parkingPlayer isHost"><div class="parkingVehicleStage"><img class="lobbyModelCar" src="'+esc(vehiclePhotoSource(photo))+'" alt="Vorschau deines Fahrzeugfotos">'+lobbyCharacterMarkup(p)+'</div></article>';
  if(box.dataset.markup!==markup){box.innerHTML=markup;box.dataset.markup=markup;}
 }
 function renderResult(lobby){
  const card=document.getElementById('result');if(!card)return;
  let scene=document.getElementById('referenceResultScene');if(!scene){scene=document.createElement('div');scene.id='referenceResultScene';card.querySelector('#resultText')?.after(scene);}
  const participants=lobby.result?.players||[],self=lobby.me?.id||gameSession?.userId;
  const sceneHtml='<div class="resultCrewHeading"><span>GEMEINSAM GESPIELT</span><strong>'+participants.length+' Spieler</strong></div><div class="resultCrewGrid">'+participants.map(result=>{
   const player={...(result.id===self?ownPlayer():{}),...result,...lobby.players.find(p=>p.id===result.id)},won=!lobby.result.aborted&&!result.left&&!result.eliminated&&(result.role==='SEEKER'?lobby.result.seekersWin:!lobby.result.seekersWin&&!result.found),label=lobby.result.aborted?'Ohne Wertung':result.left?'Runde verlassen':result.eliminated?'Ausgeschieden':result.found?'Gefunden':result.role==='HIDER'?'Überlebt':'Sucher';
   // Only server-filtered appearance data is used for other participants.
   if(result.id===self){player.appearance=window.accountUI?.appearance?.();player.pet=window.petUI?.selection?.();}
   const appearance=player.appearance||{classic:player.characterStyle||0};
   return '<article class="resultCrewCard" data-own="'+(result.id===self)+'"><div class="resultCrewVisual">'+(player.vehicle?lobbyCarMarkup(player,result.id===self,'result-scene'):'')+wardrobe.markup(appearance,won?'victory':'standing')+pets.render(player.pet)+'</div><div class="resultCrewInfo"><strong>'+esc(result.name)+(result.id===self?' · Du':'')+'</strong><span>'+esc(label)+(won?' · Gewonnen':'')+'</span><small>'+Number(result.finds||0)+' Funde · '+Number(result.baseXp||0)+' Basis-XP</small></div></article>';
  }).join('')+'</div>';
  scene.hidden=!participants.length;if(scene.dataset.markup!==avatarSignature(sceneHtml)){scene.innerHTML=sceneHtml;scene.dataset.markup=avatarSignature(sceneHtml);}
  document.getElementById('referenceResultPeople')?.remove();
  let chat=document.getElementById('resultCrewChat');if(!chat){chat=document.createElement('button');chat.id='resultCrewChat';chat.type='button';chat.className='resultCrewChat';chat.textContent='Crewchat öffnen';chat.onclick=()=>document.getElementById('freshChatButton')?.click();card.querySelector('#rematch')?.before(chat);}
  let wait=document.getElementById('resultWait');if(!wait){wait=document.createElement('p');wait.id='resultWait';wait.className='resultWait';card.querySelector('#rematch')?.before(wait);}wait.hidden=lobby.hostId===self;wait.textContent='Der Host öffnet die Lobby für die nächste Runde. Du kannst hier auf deine Crew warten.';

 }
 function setup(){
  document.addEventListener('chs:plus-changed',()=>{if(typeof state!=='undefined'&&state?.lobby?.result)renderResult(state.lobby);});
  document.addEventListener('click',event=>{
   const peer=event.target.closest('[data-reference-peer]');if(peer){openPage('friends');void socialAction(event);return;}
   const create=event.target.closest('#homeCreateLobby');if(create){openPage('play');document.getElementById('create')?.focus();return;}
   if(event.target.closest('#friends .roundAction'))document.getElementById('friendSearch')?.focus();
  });
  document.getElementById('carModal')?.addEventListener('input',()=>renderPhotoPreview());
  document.getElementById('newCarPhotoPreview')&&new MutationObserver(()=>renderPhotoPreview()).observe(document.getElementById('newCarPhotoPreview'),{childList:true,subtree:true});
  document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.closest('.socialAvatar')){const avatar=img.closest('.socialAvatar');img.remove();avatar.textContent='?';}},{capture:true});
  renderOwn();if(typeof socialRows!=='undefined')renderCrew(socialRows);
 }
 window.referenceUI={renderOwn,renderCrew,renderPhotoPreview,renderResult};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
