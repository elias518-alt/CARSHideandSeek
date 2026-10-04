'use strict';
/* Additional connected views. Authentication and all mutations keep their existing server/RPC paths. */
(function(){
 const release={id:'community-2026-10-04',title:'Neue Funktionen verfügbar',text:'Beta-Zugang, Benachrichtigungen, Einladungslinks und die neue Crew-Ansicht sind da.'};
 let invites=[],nearby=[],nearbyAt=0,nearbyBusy=false,nearbyHint='Finde eine öffentliche Lobby in deiner Nähe.',identityTimer,lastIdentity='',inviteShown='',labBusy=false;
 const node=id=>document.getElementById(id),icon=name=>typeof appIcon==='function'?appIcon(name):'',cache=(element,html)=>{if(element&&element.dataset.markup!==html){element.innerHTML=html;element.dataset.markup=html;}};
 const storageKey=()=> 'chsNotificationSeen:'+String(authSession?.user?.id||'guest');
 function seen(){try{return JSON.parse(localStorage.getItem(storageKey())||'{}');}catch{return {};}}
 function notices(){
  if(!authSession)return [];
  const rows=typeof socialRows==='undefined'?[]:socialRows;
  return [{...release,count:1,kind:'update'},...invites.map(i=>({id:'invite:'+i.id,title:i.fromName+' lädt dich ein',text:i.lobbyName,count:1,kind:'invite',invite:i})),...rows.filter(r=>r.status==='pending'&&r.incoming).map(r=>({id:'request:'+r.request_id,title:friendDisplayName(r)+' möchte deiner Crew beitreten',text:'Freundschaftsanfrage',count:1,kind:'request',row:r})),...rows.filter(r=>r.status==='accepted'&&r.unread_count>0).map(r=>({id:'chat:'+r.peer_id,title:friendDisplayName(r)+' hat dir geschrieben',text:r.unread_count+' ungelesene Nachricht'+(r.unread_count===1?'':'en'),count:Number(r.unread_count),kind:'chat',row:r}))];
 }
 function paintNotifications(){
  const old=seen(),items=notices();
  const valid=new Set(items.map(i=>i.id));for(const key of Object.keys(old))if(key.startsWith('chat:')&&!valid.has(key))delete old[key];
  try{localStorage.setItem(storageKey(),JSON.stringify(old));}catch{}
  const count=items.reduce((total,i)=>total+Math.max(0,i.count-(Number(old[i.id])||0)),0),button=node('homeNotificationButton');if(!button)return;
  let badge=button.querySelector('[data-notification-count]');if(count&&!badge){badge=document.createElement('span');badge.className='notificationBadge';badge.dataset.notificationCount='';button.append(badge);}if(badge){badge.textContent=count>99?'99+':String(count);badge.hidden=!count;}
  button.setAttribute('aria-label','Benachrichtigungen'+(count?' · '+count+' neu':''));
 }
 function dialog(id,title){let d=node(id);if(!d){d=document.createElement('dialog');d.id=id;d.className='productDialog communityDialog';document.body.append(d);}d.innerHTML='<button type="button" class="dialogClose" aria-label="Schließen">×</button><h2>'+esc(title)+'</h2><div data-dialog-content></div>';d.querySelector('.dialogClose').onclick=()=>d.close();return d;}
 function openNotifications(){
  const d=dialog('notificationsDialog','Benachrichtigungen'),items=notices(),old=seen();
  d.querySelector('[data-dialog-content]').innerHTML=items.length?items.map(i=>'<article class="communityNotice">'+(i.row?socialAvatarMarkup(i.row):i.invite?socialAvatarMarkup({username:i.invite.fromName,avatar_url:i.invite.fromAvatarUrl,active_vehicle:i.invite.fromVehicle}):'<span class="communityNoticeIcon">'+icon(i.kind==='update'?'sparkles':'bell')+'</span>')+'<div><strong>'+esc(i.title)+'</strong><p>'+esc(i.text)+'</p>'+(i.kind==='request'?'<button type="button" data-notice-action="request">Anfragen ansehen</button>':i.kind==='chat'?'<button type="button" data-dm="'+esc(i.row.peer_id)+'" data-reference-peer>Chat öffnen</button>':i.kind==='invite'?'<button type="button" data-accept-lobby-invite="'+esc(i.invite.id)+'" data-invite-code="'+esc(i.invite.code)+'">Lobby beitreten</button>':'')+'</div></article>').join(''):'<p class="communityEmpty">Du bist auf dem neuesten Stand.</p>';
  items.forEach(i=>old[i.id]=i.count);try{localStorage.setItem(storageKey(),JSON.stringify(old));}catch{}paintNotifications();d.showModal();
 }
 function renderHome(){
  const feed=node('homeSocialFeed');if(!feed)return;let card=node('homeFeaturedCard');if(!card){card=document.createElement('section');card.id='homeFeaturedCard';card.className='communityFeatured';feed.prepend(card);}
  const car=activeCar();const name=node('homeGreetingCar');if(name&&car)name.textContent=[car.brand,car.series?.split(' · ')[0],car.model].filter(Boolean).join(' ')+' · Level '+(dbProfile?.level||1);
  let html;
  if(gameSession&&authSession){html='<span class="communityFeaturedIcon">'+icon('play')+'</span><div><strong>'+esc(state?.lobby?.state==='RESULT'?'Dein Rundenergebnis':'Deine Runde wartet auf dich')+'</strong><small>Lobby '+esc(gameSession.code)+' · '+esc(connectionLost?'Verbindung wiederherstellen':'Sitzung fortsetzen')+'</small></div><button type="button" data-resume-game aria-label="Runde fortsetzen">'+icon('arrow')+'</button>';}
  else if(invites[0]){const i=invites[0];html=socialAvatarMarkup({username:i.fromName,avatar_url:i.fromAvatarUrl,active_vehicle:i.fromVehicle})+'<div><strong>'+esc(i.fromName)+' lädt dich ein'+(i.fromOnline?'<i class="communityOnline" aria-label="Online"></i>':'')+'</strong><small>'+esc(i.lobbyName)+' · '+Number(i.players)+'/'+Number(i.maxPlayers)+' Spieler</small></div><button type="button" data-accept-lobby-invite="'+esc(i.id)+'" data-invite-code="'+esc(i.code)+'" aria-label="Einladung annehmen">'+icon('arrow')+'</button>';}
  else if(nearby[0]){const l=nearby[0];html='<span class="communityFeaturedIcon">'+icon('globe')+'</span><div><strong>'+esc(l.name)+'</strong><small>'+Number(l.distanceKm)+' km · '+Number(l.players)+'/'+Number(l.maxPlayers)+' Spieler · '+(Number(l.radius)||500)+' m</small><small>'+(l.startAt?'Start '+esc(new Date(l.startAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})):'Start durch den Host')+'</small></div><button type="button" data-nearby-join="'+esc(l.code)+'" aria-label="Lobby beitreten">'+icon('arrow')+'</button>';}
  else html='<span class="communityFeaturedIcon">'+icon('globe')+'</span><div><strong>'+(nearbyBusy?'Lobbys werden gesucht…':'Deine nächste Runde')+'</strong><small>'+esc(nearbyHint)+'</small></div><button type="button" data-find-nearby '+(nearbyBusy?'disabled':'')+' aria-label="Lobbys in der Nähe suchen">'+icon('search')+'</button>';
  cache(card,html);card.classList.toggle('isLoading',nearbyBusy);
  let summary=node('homeSeasonSummary');if(!summary){summary=document.createElement('section');summary.id='homeSeasonSummary';node('homeActionsAnchor')?.after(summary)||document.querySelector('#home .homeActions')?.after(summary);}
  cache(summary,dbProfile?'<div><span>DEIN FORTSCHRITT</span><strong>Level '+Number(dbProfile.level||1)+' · '+Number(dbProfile.xp||0).toLocaleString('de-DE')+' XP</strong><small>'+Number(dbProfile.rounds_played||0)+' Runden · '+Number(dbProfile.wins||0)+' Siege</small></div><button type="button" data-page="profile" aria-label="Profil öffnen">'+icon('arrow')+'</button>':'<p class="communityEmpty">Melde dich an, um deine Crew und deinen Fortschritt zu sehen.</p>');
  const recent=state?.history?.at(-1);if(recent){let result=node('homeRecentResult');if(!result){result=document.createElement('p');result.id='homeRecentResult';summary.append(result);}result.textContent='Letzte Runde: '+(recent.aborted?'abgebrochen':recent.seekersWin?'Sucher gewinnen':'Verstecker gewinnen');}
  paintNotifications();
 }
 async function refreshNearby(explicit=false){
  if(!authSession||gameSession||nearbyBusy||(!explicit&&Date.now()-nearbyAt<60000))return;
  const account=authSession.user.id;
  if(!explicit){try{if((await navigator.permissions.query({name:'geolocation'})).state!=='granted')return;}catch{return;}}
  nearbyBusy=true;nearbyAt=Date.now();renderHome();
  try{const position=await currentPosition(),r=await api('public',position,'GET');if(authSession?.user?.id!==account)return;nearby=r.lobbies||[];nearbyHint=nearby.length?'':'Keine offene Lobby im Umkreis von 1 km. Erstelle deine eigene Runde.';}
  catch(error){if(authSession?.user?.id===account){nearby=[];nearbyHint=error.message;}}
  finally{nearbyBusy=false;renderHome();}
 }
 function watchInvites(rows){invites=rows||[];renderHome();}
 function watchSocial(){renderHome();}
 function renderLobby(lobby){
  const leave=node('leave'),header=document.querySelector('.freshRoomHeader');if(leave&&header&&leave.parentElement!==header){header.append(leave);leave.setAttribute('aria-label','Lobby verlassen');}
  if(node('game')?.classList.contains('active')){document.body.dataset.chsPage='game';document.body.classList.toggle('communityWaiting',lobby.state==='LOBBY');}
  let visibility=node('communityVisibility');if(!visibility){visibility=document.createElement('button');visibility.id='communityVisibility';visibility.type='button';node('lobbyName')?.after(visibility);}
  const host=lobby.hostId===lobby.me.id,editable=host&&lobby.state==='LOBBY';
  if(visibility){cache(visibility,icon(lobby.visibility==='PUBLIC'?'globe':'lock')+esc(lobby.visibility==='PUBLIC'?'Öffentlich':'Privat')+' · '+lobby.players.length+' Spieler');visibility.disabled=!editable;visibility.setAttribute('aria-label','Sichtbarkeit: '+(lobby.visibility==='PUBLIC'?'öffentlich':'privat')+(editable?', Einstellungen öffnen':''));}
  let strip=node('communityLobbyMeta');if(!strip){strip=document.createElement('section');strip.id='communityLobbyMeta';document.querySelector('.freshCrewBoard')?.after(strip);}
  const ready=node('ready');let actions=node('lobbyActionsDock');if(ready&&!actions){actions=document.createElement('div');actions.id='lobbyActionsDock';ready.before(actions);actions.append(ready);if(node('start'))actions.append(node('start'));}if(actions&&actions.previousElementSibling!==strip)actions.before(strip);
  const settings=lobby.settings||{};cache(strip,'<button class="lobbyMetaSettings" type="button" data-lobby-settings '+(!editable?'disabled':'')+'><span>'+icon('globe')+'<strong>'+(Number(settings.radius)>=1000?Number(settings.radius)/1000+' km':Number(settings.radius||500)+' m')+'</strong></span><span>'+icon('clock')+'<strong>'+Math.round(Number(settings.duration||900)/60)+' Min.</strong></span><small>Spielgebiet & Runde</small></button><button class="lobbyMetaPeople" type="button" data-lobby-invite><span>'+icon('people')+'<strong>'+lobby.players.length+'/'+Number(settings.maxPlayers||20)+' Spieler</strong></span><small>'+icon('plus')+'Einladen</small></button><button class="lobbyMetaChat" type="button" data-lobby-chat aria-label="Lobby-Chat öffnen">'+icon('chat')+'<strong>Chat</strong><span data-community-chat-count></span></button>');strip.hidden=lobby.state!=='LOBBY';
  window.mobileDesign?.syncSettings();
  const chatBadge=strip?.querySelector('[data-community-chat-count]'),existing=node('freshUnread');if(chatBadge){chatBadge.textContent=existing&&!existing.hidden?existing.textContent:'';chatBadge.className=chatBadge.textContent?'notificationBadge':'';}
  let lab=node('communityAdminLab');if(!lab){lab=document.createElement('section');lab.id='communityAdminLab';lab.className='communityAdminLab';document.querySelector('.freshRoomHeader')?.after(lab);}
  lab.hidden=state?.adminTestAvailable!==true;
  if(!lab.hidden){const alone=lobby.players.length===1&&lobby.visibility==='PRIVATE';cache(lab,'<strong>'+icon('shield')+'Nur für Admin · Solo-Test</strong><p>Private Tests vergeben keine XP. Aktuelles GPS und sicheres Anhalten bleiben erforderlich.</p>'+(lobby.state==='LOBBY'?'<label>Testrolle<select id="communityTestRole"><option value="SEEKER">Sucher</option><option value="HIDER">Verstecker</option></select></label><button type="button" data-lab="start" '+(!alone?'disabled':'')+'>Solo-Test starten</button>':lobby.testMode&&['COUNTDOWN','HEADSTART','ACTIVE'].includes(lobby.state)?(lobby.state==='COUNTDOWN'?'<button type="button" data-lab="headstart">Countdown überspringen</button>':'')+(['COUNTDOWN','HEADSTART'].includes(lobby.state)?'<button type="button" data-lab="active">Direkt zur Suchphase</button>':'')+'<button type="button" data-lab="finish">Test beenden</button>':'<p>Eine private Solo-Lobby ist zum Testen erforderlich. Nach einem Test kannst du über Revanche erneut starten.</p>'));}
  renderHome();
 }
 function addSettings(){const panel=node('lobbySettingsPanel');if(!panel||node('lobbyMaxPlayers'))return;const box=document.createElement('div');box.className='communitySettingFields';box.innerHTML='<label>SICHTBARKEIT<select id="lobbyVisibility"><option value="PRIVATE">Privat</option><option value="PUBLIC">Öffentlich</option></select></label><label>SPIELERLIMIT<input id="lobbyMaxPlayers" type="number" min="2" max="20" step="1" value="20"></label>';panel.append(box);box.querySelectorAll('input,select').forEach(input=>input.addEventListener('change',saveFreshLobbySettings));}
 function friendProfile(peer){const row=socialRows.find(r=>r.peer_id===peer);if(!row)return;const d=dialog('crewProfileDialog',friendDisplayName(row));d.querySelector('[data-dialog-content]').innerHTML='<div class="communityFriendProfile">'+socialAvatarMarkup(row)+'<strong>'+esc(friendDisplayName(row))+'</strong><p>'+esc(row.player_tag||'')+' · Level '+Number(row.level||1)+'</p><small>'+esc(row.online?'Vor kurzem aktiv':'Offline')+'</small><button type="button" data-reference-peer data-dm="'+esc(row.peer_id)+'">'+icon('chat')+'Chat öffnen</button></div>';d.showModal();}
 function personalLink(){const url=new URL(location.origin+'/');url.searchParams.set('friend',authSession.user.id);url.searchParams.set('tag',dbProfile?.player_tag||dbProfile?.username||'');return url.href;}
 function shareFriends(){if(!authSession)return;const d=dialog('shareFriendsDialog','Freunde einladen');d.querySelector('[data-dialog-content]').innerHTML='<p>Dein Link öffnet die App. Nach der Anmeldung kann dein Freund dir eine Freundschaftsanfrage senden.</p><label>Dein Einladungslink<input id="personalInviteLink" readonly></label><div class="communityShareActions"><button type="button" data-copy-invite>'+icon('copy')+'Link kopieren</button><button type="button" data-share-invite>'+icon('share')+'Teilen</button></div>';node('personalInviteLink').value=personalLink();d.showModal();}
 function savePendingInvite(){const query=new URLSearchParams(location.search),target=query.get('friend'),tag=query.get('tag');if(target&&/^[0-9a-f-]{36}$/i.test(target)&&tag?.length>=2&&tag.length<=24)sessionStorage.setItem('chsPendingFriendInvite',JSON.stringify({target,tag}));}
 async function offerFriendInvite(){
  const accountStatus=window.accountUI?.currentAccount;if(!authSession||!accountStatus||accountStatus.banned||accountStatus.onboardingRequired||(!accountStatus.developerPreview&&(!(accountStatus.legal?.canAccept??accountStatus.legal?.ready)||!accountStatus.accepted)))return;let pending;try{pending=JSON.parse(sessionStorage.getItem('chsPendingFriendInvite')||'null');}catch{return;}
  if(!pending||inviteShown===authSession.user.id+pending.target)return;inviteShown=authSession.user.id+pending.target;
  if(pending.target===authSession.user.id){sessionStorage.removeItem('chsPendingFriendInvite');return;}
  const account=authSession.user.id;try{const rows=await socialRpc('chs_search_players_v2',{q:pending.tag});if(authSession?.user?.id!==account)return;const row=rows.find(r=>r.user_id===pending.target);const d=dialog('personalFriendInviteDialog','Einladung zur Crew');d.querySelector('[data-dialog-content]').innerHTML=row?'<div class="communityFriendProfile">'+socialAvatarMarkup(row)+'<strong>'+esc(row.username)+'</strong><p>Ihr verbindet euch nach einer bestätigten Freundschaftsanfrage.</p><button type="button" data-personal-request="'+esc(row.user_id)+'">Freundschaftsanfrage senden</button></div>':'<p>Diese Einladung ist nicht mehr verfügbar. Suche deinen Freund in der Crew.</p>';d.showModal();}catch(error){toast(error.message);}
 }
 function badgeDetails(id){const a=achievementCatalog.find(item=>item.id===id);if(!a)return;const conditions={FIRST_GAME:['Eine Runde abschließen.',Number(dbProfile?.rounds_played)||0],FIRST_FIND:['Einen bestätigten Fund erzielen.',Number(dbProfile?.finds)||0],HIDE_MASTER:['Eine Runde als Verstecker überleben.',Number(dbProfile?.survived_rounds)||0]},condition=conditions[id],d=dialog('badgeDetailsDialog',a.name);d.querySelector('[data-dialog-content]').innerHTML='<div class="communityBadgeDetail"><span class="achievementIcon">'+icon(id==='FIRST_FIND'?'target':id==='HIDE_MASTER'?'shield':'star')+'</span><p>'+esc(a.description)+'</p><strong>'+esc(condition?.[0]||a.description)+'</strong>'+(condition?'<p>Fortschritt: '+Math.min(1,condition[1])+' / 1</p>':'')+'<small>Belohnung: '+Number(a.xp_reward||0)+' XP</small><small>'+esc(achievementUnlocked.has(id)?'Freigeschaltet':'Noch gesperrt')+'</small></div>';d.showModal();}
 function syncIdentity(){
  renderHome();void offerFriendInvite();if(!gameSession||!dbProfile)return;
  clearTimeout(identityTimer);identityTimer=setTimeout(async()=>{const session={...gameSession},account=authSession?.user?.id;try{const data=playerData(),signature=JSON.stringify([session.code,account,data]);if(signature===lastIdentity)return;if(account!==authSession?.user?.id||gameSession?.userId!==session.userId)return;await api('identity',{...data,...session});if(account!==authSession?.user?.id||gameSession?.code!==session.code)return;lastIdentity=signature;await poll();}catch(error){toast(error.message);}},600);
 }
 function onPage(page){document.body.dataset.chsPage=page;document.body.classList.toggle('communityWaiting',page==='game'&&state?.lobby?.state==='LOBBY');if(page==='home'){renderHome();void refreshNearby();}}
 async function click(event){
  const b=event.target.closest('button');if(!b)return;
  if(b.id==='homeNotificationButton'){openNotifications();return;}
  if(b.dataset.noticeAction==='request'){node('notificationsDialog')?.close();openPage('friends');document.querySelectorAll('.friendsTabs button')[1]?.click();return;}
  if(b.hasAttribute('data-find-nearby')){void refreshNearby(true);return;}
  if(b.hasAttribute('data-resume-game')){if(connectionLost)await rejoinGame();else showGame();return;}
  if(b.dataset.nearbyJoin){await join(b.dataset.nearbyJoin);return;}
  if(b.id==='homeCodeJoin'){openPage('play');node('code')?.scrollIntoView({block:'center'});node('code')?.focus();return;}
  if(b.id==='communityVisibility'||b.hasAttribute('data-lobby-settings')){node('freshSettingsButton')?.click();return;}
  if(b.hasAttribute('data-lobby-invite')){node('freshInviteButton')?.click();return;}if(b.hasAttribute('data-lobby-chat')){node('freshChatButton')?.click();return;}
  if(b.dataset.lab&&!labBusy){labBusy=true;b.disabled=true;try{await api('admin-test',gameCredentials({command:b.dataset.lab,testRole:node('communityTestRole')?.value||'SEEKER'}));await poll();}catch(error){toast(error.message);}finally{labBusy=false;b.disabled=false;}return;}
  if(b.dataset.crewProfile){friendProfile(b.dataset.crewProfile);return;}
  if(b.hasAttribute('data-share-friends')){shareFriends();return;}
  if(b.hasAttribute('data-copy-invite')){try{await navigator.clipboard.writeText(personalLink());toast('Einladungslink kopiert.');}catch{node('personalInviteLink')?.select();toast('Link markieren und kopieren.');}return;}
  if(b.hasAttribute('data-share-invite')){try{if(navigator.share)await navigator.share({title:'Car Hide & Seek · Meine Crew',url:personalLink()});else await navigator.clipboard.writeText(personalLink());}catch(error){if(error.name!=='AbortError')toast('Teilen nicht verfügbar. Kopiere den Link.');}return;}
  if(b.dataset.personalRequest){b.disabled=true;try{await socialRpc('chs_send_request',{target:b.dataset.personalRequest});sessionStorage.removeItem('chsPendingFriendInvite');node('personalFriendInviteDialog')?.close();await loadFriends();toast('Freundschaftsanfrage gesendet.');}catch(error){toast(error.message);}finally{b.disabled=false;}return;}
  if(b.dataset.achievement){badgeDetails(b.dataset.achievement);return;}
  if(b.closest('.communityDialog')&&(b.hasAttribute('data-reference-peer')||b.hasAttribute('data-accept-lobby-invite')))b.closest('dialog').close();
 }
 function setup(){
  savePendingInvite();addSettings();document.addEventListener('click',click);
  const profileCrew=node('profileCrewPeople')?.closest('.referenceCrew');if(profileCrew&&!node('communityShareFriends')){const share=document.createElement('button');share.id='communityShareFriends';share.type='button';share.dataset.shareFriends='';share.className='communityShareFriends';share.innerHTML=icon('people')+'Freunde einladen';profileCrew.append(share);}
  if(node('homeCreateLobby'))node('homeCreateLobby').querySelector('.actionSymbol').innerHTML=icon('plus');
  if(node('openPlay'))node('openPlay').querySelector('.actionSymbol').innerHTML='<b class="communityBrand">CHS</b>';
  if(node('homeCodeJoin'))node('homeCodeJoin').querySelector('.actionSymbol').innerHTML=icon('qr');
  onPage(document.querySelector('.page.active')?.id||'home');void offerFriendInvite();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&node('home')?.classList.contains('active')){renderHome();void refreshNearby();}});
 }
 function closePrivateViews(){clearTimeout(identityTimer);invites=[];nearby=[];nearbyAt=0;lastIdentity='';inviteShown='';for(const id of ['notificationsDialog','crewProfileDialog','shareFriendsDialog','personalFriendInviteDialog','badgeDetailsDialog'])node(id)?.remove();if(node('communityAdminLab'))node('communityAdminLab').hidden=true;}
 window.communityUI={cancelIdentitySync(){clearTimeout(identityTimer);lastIdentity='';},closePrivateViews,renderHome,renderLobby,watchInvites,watchSocial,onPage,syncIdentity};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
