'use strict';
/* Reference composition using live account, vehicle and crew data. */
(function(){
 let crewRows=[];
 function ownPlayer(car=activeCar()){return {id:'own-reference',profileId:authSession?.user?.id,name:dbProfile?.username||authSession?.user?.user_metadata?.full_name||'Spieler',avatarUrl:dbProfile?.avatar_url,vehicle:car?[car.brand,car.model].filter(Boolean).join(' '):'Dein Fahrzeug',bodyType:car?.body,color:car?.color,photoUrl:car?.photo,appearance:window.accountUI?.appearance?.(),characterStyle:getCharacterStyle()};}
 function renderOwn(){
  const target=document.getElementById('homeOwnScene');if(!target)return;const car=activeCar(),player=ownPlayer(car),name=player.name;
  const intro=document.getElementById('homeGreeting');intro.textContent='Hey '+name.split(/\s+/)[0];
  document.getElementById('homeGreetingAvatar').innerHTML=parkingAvatarMarkup(player);
  document.getElementById('homeGreetingCar').textContent=car?player.vehicle+' ist bereit':'Wähle dein Fahrzeug in der Garage';
  const markup=car?'<article class="parkingPlayer isHost"><div class="parkingVehicleStage">'+lobbyCarMarkup(player,true,'home-hero')+lobbyCharacterMarkup(player)+'<span class="parkingContactShadow"></span></div></article>':'<button class="referenceNoCar" type="button" data-page="garage">Fahrzeug hinzufügen <span>Dein Auto und Charakter erscheinen hier.</span></button>';
  if(target.dataset.markup!==markup){target.innerHTML=markup;target.dataset.markup=markup;}
  renderPhotoPreview();
 }
 function renderCrew(rows=crewRows){
  crewRows=rows;const friends=rows.filter(r=>r.status==='accepted'),html=friends.slice(0,6).map(r=>'<button type="button" class="referenceCrewPerson" data-dm="'+esc(r.peer_id)+'" data-reference-peer><span class="referenceCrewPortrait">'+socialAvatarMarkup(r)+(r.online?'<i class="referenceOnline" aria-label="Vor kurzem aktiv"></i>':'')+'</span><strong>'+esc(friendDisplayName(r))+'</strong><small>'+(r.online?'Online':'Offline')+'</small>'+(Number(r.unread_count)>0?'<span class="notificationBadge">'+esc(Math.min(99,Number(r.unread_count)))+'</span>':'')+'</button>').join('');
  const home=document.getElementById('homeCrewPeople');if(home){const markup=html||'<p class="muted">Deine Crew beginnt mit einer Freundschaftsanfrage.</p>';if(home.dataset.markup!==markup){home.innerHTML=markup;home.dataset.markup=markup;}}
  const profile=document.getElementById('profileCrewPeople');if(profile){const markup=friends.slice(0,6).map(r=>'<article class="communityCrewRow"><button type="button" data-crew-profile="'+esc(r.peer_id)+'">'+socialAvatarMarkup(r)+'<span><strong>'+esc(friendDisplayName(r))+'</strong><small><i class="'+(r.online?'communityOnline':'communityOffline')+'"></i>'+(r.online?'Online':'Offline')+'</small></span></button><button type="button" data-reference-peer data-dm="'+esc(r.peer_id)+'" aria-label="Chat mit '+esc(friendDisplayName(r))+'">'+(typeof appIcon==='function'?appIcon('chat'):'CHAT')+'</button></article>').join('')||'<p class="communityEmpty">Deine Crew beginnt mit einer Einladung.</p>';if(profile.dataset.markup!==markup){profile.innerHTML=markup;profile.dataset.markup=markup;}}
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
  let scene=document.getElementById('referenceResultScene');if(!scene){scene=document.createElement('div');scene.id='referenceResultScene';card.prepend(scene);}
  const car=activeCar(),own=ownPlayer(car),sceneHtml=car?'<article class="parkingPlayer isHost"><div class="parkingVehicleStage">'+lobbyCarMarkup(own,true,'result-scene')+lobbyCharacterMarkup(own)+'</div></article>':'';scene.hidden=!car;if(scene.dataset.markup!==sceneHtml){scene.innerHTML=sceneHtml;scene.dataset.markup=sceneHtml;}
  let list=document.getElementById('referenceResultPeople');if(!list){list=document.createElement('div');list.id='referenceResultPeople';card.querySelector('#rematch')?.before(list);}
  const html=(lobby.result?.players||[]).map(result=>{const player=lobby.players.find(p=>p.id===result.id)||result;const label=result.eliminated?'Ausgeschieden':result.foundBy||result.found?'Gefunden':result.role==='HIDER'?'Überlebt':'Sucher';return '<div class="referenceResultPerson"><span class="parkingStripAvatar">'+parkingAvatarMarkup(player)+'</span><strong>'+esc(result.name)+'</strong><span>'+esc(label)+'</span><small>+'+esc(Number(result.baseXp)||0)+' XP</small></div>';}).join('');
  if(list.dataset.markup!==html){list.innerHTML=html;list.dataset.markup=html;}
 }
 function setup(){
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
