'use strict';
/* Social identity and unread counts use account-bound authenticated RPCs. */
let chooseSearchedVehicle=()=>{};

function renderVehicleModelPicker(brand, selected = {}) {
  const picker=$('#newCarModelPicker');
  const manualWrap=$('#newCarModelManualWrap');
  const manualInput=$('#newCarModelManual');
  if(!picker)return;

  const choices=brand&&vehicleSearch.modelsForBrand ? vehicleSearch.modelsForBrand(brand) : [];
  picker._vehicleChoices=choices;
  picker.disabled=!brand;
  picker.innerHTML=!brand
    ? '<option value="">Zuerst Marke wählen</option>'
    : '<option value="">Modell auswählen</option>' +
      choices.map((choice,index)=>`<option value="${index+1}">${esc(choice.label)}</option>`).join('') +
      '<option value="manual">Anderes Modell…</option>';

  if(!brand){
    manualWrap?.classList.add('hidden');
    if(manualInput)manualInput.value='';
    return;
  }

  const selectedIndex=choices.findIndex(choice=>
    choice.model===selected.model && (!selected.series || choice.series===selected.series)
  );
  if(selectedIndex>=0){
    picker.value=String(selectedIndex+1);
    manualWrap?.classList.add('hidden');
    if(manualInput)manualInput.value='';
  }else if(selected.model){
    picker.value='manual';
    manualWrap?.classList.remove('hidden');
    if(manualInput)manualInput.value=selected.model;
  }else{
    manualWrap?.classList.add('hidden');
    if(manualInput)manualInput.value='';
  }
}

function syncVehiclePickers(car = {}) {
  const brandPicker=$('#newCarBrandPicker');
  if(!brandPicker || !vehicleSearch.brands)return;
  if(brandPicker.dataset.ready!=='1'){
    brandPicker.dataset.ready='1';
    brandPicker.innerHTML='<option value="">Marke auswählen</option>'+
      vehicleSearch.brands().map(brand=>`<option value="${esc(brand)}">${esc(brand)}</option>`).join('');
  }
  const brand=vehicleSearch.canonicalBrand ? vehicleSearch.canonicalBrand(car.brand||'') : (car.brand||'');
  brandPicker.value=brand;
  renderVehicleModelPicker(brand,car);
}

function commitVehicleSearch(){
  if($('#newCarBrand').value&&$('#newCarModel').value)return true;
  const choice=vehicleSearch.search($('#newCarSearch').value).find(item=>item.exact);
  if(!choice)return false;
  chooseSearchedVehicle(choice);return true;
}
function setupVehicleSearch(){
  const input=$('#newCarSearch'),box=$('#carSearchResults');
  if(!input||!box)return;
  let choices=[],highlighted=-1;
  const close=()=>{box.classList.add('hidden');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');highlighted=-1;};
  const paintHighlight=()=>{
    box.querySelectorAll('[role="option"]').forEach((button,index)=>{
      button.classList.toggle('selected',index===highlighted);
      button.setAttribute('aria-selected',String(index===highlighted));
    });
    const active=box.children[highlighted];
    if(active){input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}
  };
  const show=()=>{
    choices=vehicleSearch.search(input.value);highlighted=-1;
    box.innerHTML=choices.map((choice,index)=>`<button id="carSearchOption${index}" type="button" role="option" aria-selected="false" data-car-choice="${index}"><span>${esc(choice.label)}</span><small>${choice.year?'Baujahr '+esc(choice.year):choice.manual?'Eigene Angabe übernehmen':'Auswählen'}</small></button>`).join('');
    box.classList.toggle('hidden',!choices.length);
    input.setAttribute('aria-expanded',String(!!choices.length));
  };
  chooseSearchedVehicle=choice=>{
    const changed=$('#newCarBrand').value!==choice.brand||$('#newCarModel').value!==choice.model;
    $('#newCarBrand').value=choice.brand;$('#newCarModel').value=choice.model;
    input.value=choice.brand+' '+choice.model;
    if(choice.year)$('#newCarYear').value=choice.year;
    const series=$('#newCarSeries');
    series.value=choice.series||'';series.dataset.manual=String(!!choice.series);
    if(changed||!$('#newCarBody').value){
      const bodies={hatch:'Compact',sedan:'Limousine',wagon:'Touring',suv:'SUV',coupe:'Coupé',van:'Van'};
      $('#newCarBody').value=choice.body||bodies[vehicleCatalog.shape({brand:choice.brand,model:choice.model})]||'';
    }
    syncVehiclePickers(choice);
    refreshVehicleForm();close();
  };
  input.addEventListener('focus',show);
  input.addEventListener('input',()=>{
    $('#newCarBrand').value='';$('#newCarModel').value='';
    $('#newCarSeries').value='';$('#newCarSeries').dataset.manual='false';
    refreshVehicleForm();show();
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(box.classList.contains('hidden'))show();
      if(!choices.length)return;
      highlighted=highlighted<0?(event.key==='ArrowDown'?0:choices.length-1):
        (highlighted+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;
      paintHighlight();
    }
    if(event.key==='Enter'&&!box.classList.contains('hidden')&&choices.length){
      event.preventDefault();
      chooseSearchedVehicle(choices[highlighted<0?0:highlighted]);
      $('#newCarYear').focus();
    }
  });
  box.addEventListener('click',event=>{
    const button=event.target.closest('[data-car-choice]');if(!button)return;
    chooseSearchedVehicle(choices[Number(button.dataset.carChoice)]);
    $('#newCarYear').focus();
  });
  const brandPicker=$('#newCarBrandPicker');
  const modelPicker=$('#newCarModelPicker');
  const manualInput=$('#newCarModelManual');

  syncVehiclePickers({
    brand:$('#newCarBrand').value,
    model:$('#newCarModel').value,
    series:$('#newCarSeries').value
  });

  brandPicker?.addEventListener('change',()=>{
    const brand=brandPicker.value;
    $('#newCarBrand').value=brand;
    $('#newCarModel').value='';
    $('#newCarSeries').value='';
    $('#newCarSeries').dataset.manual='false';
    $('#newCarBody').value='';
    input.value=brand;
    renderVehicleModelPicker(brand,{});
    refreshVehicleForm();
  });

  modelPicker?.addEventListener('change',()=>{
    const value=modelPicker.value;
    if(value==='manual'){
      $('#newCarModelManualWrap')?.classList.remove('hidden');
      $('#newCarModel').value='';
      $('#newCarBody').value='';
      if(manualInput){manualInput.value='';manualInput.focus();}
      refreshVehicleForm();
      return;
    }
    $('#newCarModelManualWrap')?.classList.add('hidden');
    const choice=modelPicker._vehicleChoices?.[Number(value)-1];
    if(choice)chooseSearchedVehicle(choice);
  });

  manualInput?.addEventListener('input',()=>{
    const model=manualInput.value.trim();
    const brand=brandPicker?.value||'';
    $('#newCarBrand').value=brand;
    $('#newCarModel').value=model;
    input.value=(brand+' '+model).trim();
    $('#newCarSeries').value='';
    $('#newCarSeries').dataset.manual='false';
    $('#newCarBody').value=model ? ({hatch:'Compact',sedan:'Limousine',wagon:'Touring',suv:'SUV',coupe:'Coupé',van:'Van'}[vehicleCatalog.shape({brand,model})]||'') : '';
    refreshVehicleForm();
  });

  const colorInput=$('#newCarColor');
  const paintColor=()=>document.querySelectorAll('[data-car-color]').forEach(button=>{
    const selected=button.dataset.carColor===colorInput.value;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  });
  $('#carModal .carColorChoices').addEventListener('click',event=>{
    const button=event.target.closest('[data-car-color]');if(!button)return;
    colorInput.value=button.dataset.carColor;paintColor();refreshVehicleForm();
  });
  colorInput.addEventListener('input',()=>{paintColor();refreshVehicleForm();});
  document.addEventListener('click',event=>{if(!event.target.closest('.carSearchField'))close();});
}

let socialRows = [];
let activePeer = null;
let socialTab = 'friends';
let socialBusy = false;
let searchTimer = null;
let dmLastId = null;
let chatLastId = null;
let lobbyInviteLoading = false;
let incomingInviteSignature = '';
async function socialRpc(name, params = {}) {
  if (!authSession) throw new Error('Bitte anmelden.');
  const { data, error } = await supabaseClient.rpc(name, params);
  if (error) throw new Error(error.message.includes('Could not find the function') ? 'Social-Datenbank fehlt. Bitte social-setup.sql einmal in Supabase ausführen.' : error.message);
  return data;
}
const socialError = error => toast(error.message || 'Aktion fehlgeschlagen.');
async function loadFriends() {
  if (!authSession) { socialRows=[];activePeer=null;dmLastId=null;renderFriendNotice();renderSocialBadges();renderReferenceCrew();return; }
  if (socialBusy) return;
  const accountId=authSession.user.id;
  socialBusy = true;
  try {
    const rows=await socialRpc('chs_social_overview_v2') || [];
    if(authSession?.user?.id!==accountId)return;
    socialRows=rows;
    renderFriendNotice();renderSocialBadges();renderReferenceCrew();
    if($('#friends')?.classList.contains('active'))renderFriends();
  } catch (error) {
    if($('#friends')?.classList.contains('active'))$('#friendList').textContent = error.message;
  } finally { socialBusy = false; }
}

function friendDisplayName(row) { return row.username?.trim() || row.player_tag || 'Spieler'; }
function socialAvatarMarkup(row){
 const name=friendDisplayName(row),src=profileImageSource(row.avatar_url);
 return '<span class="socialAvatar" aria-hidden="true">'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'<span>'+esc(name.slice(0,2).toUpperCase())+'</span>')+'</span>';
}
function socialCounts(rows=socialRows){return {requests:rows.filter(r=>r.status==='pending'&&r.incoming).length,messages:rows.filter(r=>r.status==='accepted').reduce((sum,r)=>sum+Math.max(0,Math.trunc(Number(r.unread_count)||0)),0)};}
function renderSocialBadges(){
 const counts=authSession?socialCounts():{requests:0,messages:0};
 const paint=(button,count,label)=>{if(!button)return;let badge=button.querySelector('[data-count-badge]');if(!count){badge?.remove();button.setAttribute('aria-label',label);return;}if(!badge){badge=document.createElement('span');badge.className='notificationBadge';badge.dataset.countBadge='';button.append(badge);}badge.textContent=count>99?'99+':String(count);button.setAttribute('aria-label',label+' · '+count+' ungelesen');};
 (document.querySelectorAll?.('#bottomNav [data-page="friends"], [data-reference-crew]')||[]).forEach(b=>paint(b,counts.requests+counts.messages,'Crew'));
 const tabs=document.querySelectorAll?.('.friendsTabs button')||[];paint(tabs[0],counts.messages,'Chats');paint(tabs[1],counts.requests,'Freundschaftsanfragen');
}
function renderReferenceCrew(){if(typeof window!=='undefined')window.referenceUI?.renderCrew?.(socialRows);}
function renderFriendNotice() {
  let notice=document.getElementById('incomingFriendNotice');
  const incoming=authSession ? socialRows.filter(row=>row.status==='pending'&&row.incoming) : [];
  if(!incoming.length){notice?.remove();return;}
  if(!notice){
    notice=document.createElement('aside');notice.id='incomingFriendNotice';notice.className='friendRequestNotice';
    notice.setAttribute('aria-label','Freundschaftsanfragen');notice.setAttribute('aria-live','polite');
    notice.addEventListener('click',socialAction);(document.getElementById('homeSocialFeed')||document.body).append(notice);
  }
  notice.hidden=!!document.querySelector?.('#friends.active');
  const markup=incoming.map(row=>'<div>'+socialAvatarMarkup(row)+'<div class="socialPerson"><strong>'+esc(friendDisplayName(row))+'</strong><span> möchte dich als Freund hinzufügen.</span></div><button type="button" data-accept="'+esc(row.request_id)+'">Annehmen</button><button type="button" data-decline="'+esc(row.request_id)+'" aria-label="Anfrage von '+esc(friendDisplayName(row))+' ablehnen">×</button></div>').join('');
  if(notice.dataset.markup!==markup){notice.innerHTML=markup;notice.dataset.markup=markup;}
}

function renderFriends() {
  const list = $('#friendList');
  const rows = socialRows.filter(x => socialTab === 'friends' ? x.status === 'accepted' : x.status === 'pending');
  const markup = rows.length ? rows.map(row => `
    <div class="socialRow">
      ${socialAvatarMarkup(row)}
      <div class="socialPerson"><strong>${esc(friendDisplayName(row))}</strong><small>${esc(row.player_tag || '')} · Lv. ${Number(row.level) || 1}${row.status === 'pending' ? (row.incoming ? ' · Anfrage erhalten' : ' · Anfrage gesendet') : ''}</small></div>
      <div class="socialActions">
        ${row.status === 'accepted' ? `<button data-dm="${esc(row.peer_id)}">CHAT${Number(row.unread_count)>0?'<span class="notificationBadge">'+esc(Math.min(99,Number(row.unread_count)))+'</span>':''}</button><button data-remove="${row.request_id}" aria-label="Freund entfernen">×</button>` : row.incoming ? `<button data-accept="${row.request_id}">ANNEHMEN</button><button data-decline="${row.request_id}" aria-label="Ablehnen">×</button>` : `<button data-remove="${row.request_id}">ZURÜCKZIEHEN</button>`}
      </div>
    </div>`).join('') : `<div class="emptyState">${socialTab === 'friends' ? 'Noch keine Freunde. Suche oben nach einem Spielernamen.' : 'Keine offenen Anfragen.'}</div>`;
  if(list.dataset.markup!==markup){list.innerHTML=markup;list.dataset.markup=markup;}
}
async function searchPlayers() {
  const q = $('#friendSearch').value.trim(), box = $('#friendSearchResults');
  if (q.length < 2) { box.innerHTML = ''; return; }
  try {
    const users = await socialRpc('chs_search_players_v2', { q });
    if ($('#friendSearch').value.trim() !== q) return;
    box.innerHTML = users.length ? users.map(user => {
      const relation = socialRows.find(row => row.peer_id === user.user_id);
      return `<div class="socialRow">${socialAvatarMarkup(user)}<div class="socialPerson"><strong>${esc(user.username)}</strong><small>${esc(user.player_tag || '')} · Lv. ${Number(user.level) || 1}</small></div>${relation ? '<span class="socialLinked">Bereits verbunden</span>' : `<button data-request="${user.user_id}">ANFRAGE</button>`}</div>`;
    }).join('') : '<div class="emptyState">Kein Spieler gefunden.</div>';
  } catch (error) { box.textContent = error.message; }
}
async function socialAction(event) {
  const button = event.target.closest('button[data-request],button[data-accept],button[data-decline],button[data-remove],button[data-dm]');
  if (!button) return;
  try {
    button.disabled = true;
    if (button.dataset.request) await socialRpc('chs_send_request', { target: button.dataset.request });
    else if (button.dataset.accept) await socialRpc('chs_respond_request', { request: button.dataset.accept, accept: true });
    else if (button.dataset.decline) await socialRpc('chs_respond_request', { request: button.dataset.decline, accept: false });
    else if (button.dataset.remove) await socialRpc('chs_remove_friend', { request: button.dataset.remove });
    else if (button.dataset.dm) {
      activePeer = socialRows.find(row => row.peer_id === button.dataset.dm && row.status === 'accepted');
      if (!activePeer) return;
      dmLastId=null;$('#dmTitle').innerHTML=socialAvatarMarkup(activePeer)+'<span>CHAT MIT <strong>'+esc(friendDisplayName(activePeer))+'</strong></span>';
      $('#dmPanel').classList.remove('hidden'); await loadDm();
      $('#dmPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toast('Erledigt ✓'); await loadFriends(); if($('#friends')?.classList.contains('active'))await searchPlayers();
  } catch (error) { socialError(error); }
  finally { button.disabled = false; }
}
async function loadDm() {
 if(!activePeer||!$('#friends')?.classList.contains('active')||document.visibilityState==='hidden')return;
 const peer=activePeer.peer_id,account=authSession?.user?.id;
 const current=()=>activePeer?.peer_id===peer&&authSession?.user?.id===account&&$('#friends')?.classList.contains('active')&&!$('#dmPanel')?.classList.contains('hidden')&&document.visibilityState!=='hidden';
 try{
  const messages=(await socialRpc('chs_get_messages',{peer})||[]).reverse();if(!current())return;
  const last=messages.at(-1)?.message_id||null;
  if(dmLastId!==last){dmLastId=last;$('#dmMessages').innerHTML=messages.length?messages.map(msg=>`<div class="message ${msg.sender_id===account?'mine':''}"><small>${msg.sender_id===account?'DU':esc(friendDisplayName(activePeer))} · ${new Date(msg.sent_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</small><span>${esc(msg.body)}</span></div>`).join(''):'<p class="muted">Schreib die erste Nachricht.</p>';$('#dmMessages').scrollTop=$('#dmMessages').scrollHeight;}
  const latestIncoming=messages.filter(msg=>msg.sender_id===peer).at(-1);
  const list=$('#dmMessages'),rect=list.getBoundingClientRect?.();
  const visible=(!rect||rect.bottom>0&&rect.top<window.innerHeight)&&list.scrollHeight-list.scrollTop-list.clientHeight<40;
  if(latestIncoming&&current()&&visible&&activePeer.readThrough!==latestIncoming.message_id){
    await socialRpc('chs_mark_messages_read',{peer,message_id:latestIncoming.message_id});if(!current())return;
    activePeer.readThrough=latestIncoming.message_id;await loadFriends();
  }
 }catch(error){if(current())$('#dmMessages').textContent=error.message;}
}
async function sendDm(event) {
  event.preventDefault();
  if (!activePeer) return;
  const input = $('#dmInput'), body = input.value.trim(); if (!body) return;
  try { await socialRpc('chs_send_message', { target: activePeer.peer_id, message: body }); input.value = ''; dmLastId = null; await loadDm(); }
  catch (error) { socialError(error); }
}
function renderLobbyChat(force = false) {
  if (!$('#game')?.classList.contains('active') || !state?.chat) return;
  const messages = state.chat, last = messages.at(-1)?.id || null;
  if (!force && chatLastId === last) return;
  chatLastId = last;
  $('#lobbyMessages').innerHTML = messages.length ? messages.map(msg => `<div class="message ${msg.sender === gameSession?.userId ? 'mine' : ''}"><small>${esc(msg.name)} · ${new Date(msg.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</small><span>${esc(msg.body)}</span></div>`).join('') : '<p class="muted">Noch keine Nachrichten in der Lobby.</p>';
  $('#lobbyMessages').scrollTop = $('#lobbyMessages').scrollHeight;
}
async function sendLobbyChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = $('#lobbyChatInput');
  const button = form?.querySelector('button[type="submit"]');
  const body = input?.value.trim();
  if (!gameSession || !body) return;
  if (button) button.disabled = true;
  try {
    await api('chat', gameCredentials({ body }));
    input.value = '';
    chatLastId = null;
    await poll();
    renderLobbyChat(true);
    requestAnimationFrame(() => {
      const list = $('#lobbyMessages');
      if (list) list.scrollTop = list.scrollHeight;
    });
  } catch (error) {
    socialError(error);
  } finally {
    if (button) button.disabled = false;
  }
}


/* =========================================================
   LOBBY-EINLADUNGEN
========================================================= */

function syncLobbyInviteButton() {
  const button = $('#freshInviteButton');
  if (!button) return;
  const waiting = !!gameSession && state?.lobby?.state === 'LOBBY';
  button.hidden = !waiting;
  button.disabled = !waiting;
  const dialog = $('#lobbyInviteDialog');
  if (!waiting && dialog?.open) dialog.close();
}

async function openLobbyInviteDialog() {
  const dialog = $('#lobbyInviteDialog');
  const list = $('#lobbyInviteFriends');
  if (!dialog || !list) return;
  if (!gameSession || state?.lobby?.state !== 'LOBBY') {
    toast('Freunde können nur in einer offenen Lobby eingeladen werden.');
    return;
  }

  if (!dialog.open) dialog.showModal();
  list.innerHTML = '<div class="inviteLoading"><span></span> Freundesliste wird geladen…</div>';
  lobbyInviteLoading = true;
  try {
    const rows = await socialRpc('chs_social_overview_v2') || [];
    socialRows = rows;
    const friends = rows.filter(row => row.status === 'accepted');
    list.innerHTML = friends.length ? friends.map(friend => `
      <div class="lobbyInviteFriend">
        ${socialAvatarMarkup(friend)}
        <div class="socialPerson">
          <strong>${esc(friend.username || 'Spieler')}</strong>
          <small>${esc(friend.player_tag || '')} · Lv. ${Number(friend.level) || 1}</small>
        </div>
        <button type="button" data-lobby-invite-peer="${esc(friend.peer_id)}">EINLADEN</button>
      </div>`).join('') : `
      <div class="publicLobbyEmpty">
        <strong>Noch keine Freunde vorhanden</strong>
        <span>Füge zuerst unter Freunde einen Spieler hinzu.</span>
      </div>`;
  } catch (error) {
    list.innerHTML = `<div class="publicLobbyEmpty"><strong>Freunde konnten nicht geladen werden</strong><span>${esc(error.message)}</span></div>`;
  } finally {
    lobbyInviteLoading = false;
  }
}

async function handleLobbyInviteFriend(event) {
  const button = event.target.closest('[data-lobby-invite-peer]');
  if (!button || button.disabled || lobbyInviteLoading) return;
  if (!gameSession || state?.lobby?.state !== 'LOBBY') {
    toast('Die Lobby ist nicht mehr offen.');
    return;
  }
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'SENDET…';
  try {
    await api('invite', gameCredentials({ targetAuthId: button.dataset.lobbyInvitePeer }));
    button.textContent = 'GESENDET ✓';
    button.classList.add('sent');
    toast('Lobby-Einladung gesendet ✓');
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    socialError(error);
  }
}

function ensureIncomingInviteCard() {
  let card = document.getElementById('incomingLobbyInvite');
  if (card) return card;
  card = document.createElement('section');
  card.id = 'incomingLobbyInvite';
  card.className = 'incomingLobbyInvite';
  card.hidden = true;
  (document.getElementById('homeSocialFeed')||document.body).append(card);
  return card;
}

async function dismissLobbyInvite(inviteId) {
  try { await api('invite-dismiss', { inviteId }); } catch (error) { console.error(error); }
}

function renderIncomingLobbyInvite(invites) {
  const card = ensureIncomingInviteCard();
  if (gameSession || !invites?.length) {
    card.hidden = true;
    card.replaceChildren();
    incomingInviteSignature = '';
    return;
  }

  const invite = invites[0];
  const signature = `${invite.id}:${invite.players}`;
  if (incomingInviteSignature === signature && !card.hidden) return;
  incomingInviteSignature = signature;
  card.hidden = false;
  card.innerHTML = `
    ${socialAvatarMarkup({username:invite.fromName,avatar_url:invite.fromAvatarUrl})}
    <div class="incomingInviteText">
      <span>LOBBY-EINLADUNG</span>
      <strong>${esc(invite.fromName)} lädt dich ein</strong>
      <small>${esc(invite.lobbyName)} · ${esc(invite.code)} · ${Number(invite.players)}/${Number(invite.maxPlayers)} Spieler</small>
    </div>
    <div class="incomingInviteActions">
      <button type="button" data-accept-lobby-invite="${esc(invite.id)}" data-invite-code="${esc(invite.code)}">BEITRETEN</button>
      <button type="button" class="secondary" data-dismiss-lobby-invite="${esc(invite.id)}">ABLEHNEN</button>
    </div>`;
}

async function loadIncomingLobbyInvites() {
  if (!authSession) return;
  if (gameSession) {
    renderIncomingLobbyInvite([]);
    return;
  }
  try {
    const result = await api('invites', {}, 'GET');
    renderIncomingLobbyInvite(result.invites || []);
  } catch (error) {
    if (error.status !== 401) console.error('Lobby-Einladungen:', error);
  }
}

async function handleIncomingLobbyInvite(event) {
  const accept = event.target.closest('[data-accept-lobby-invite]');
  const dismiss = event.target.closest('[data-dismiss-lobby-invite]');
  if (!accept && !dismiss) return;

  const button = accept || dismiss;
  button.disabled = true;
  const inviteId = accept?.dataset.acceptLobbyInvite || dismiss?.dataset.dismissLobbyInvite;

  if (dismiss) {
    await dismissLobbyInvite(inviteId);
    incomingInviteSignature = '';
    renderIncomingLobbyInvite([]);
    return;
  }

  const code = accept.dataset.inviteCode;
  await dismissLobbyInvite(inviteId);
  incomingInviteSignature = '';
  renderIncomingLobbyInvite([]);
  await join(code);
}
function setupSocial() {
  setupVehicleSearch();
  $('#friendSearch')?.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchPlayers, 250); });
  $('#friendList')?.addEventListener('click', socialAction);
  $('#friendSearchResults')?.addEventListener('click', socialAction);
  $$('.friendsTabs button').forEach((button,index) => button.addEventListener('click', () => {
    socialTab = index ? 'requests' : 'friends';
    $$('.friendsTabs button').forEach(b => b.classList.toggle('active',b === button));
    renderFriends();
  }));
  let dmScrollTimer;
  $('#dmMessages')?.addEventListener('scroll',()=>{clearTimeout(dmScrollTimer);dmScrollTimer=setTimeout(()=>void loadDm(),120);},{passive:true});
  $('#closeDm')?.addEventListener('click', () => { activePeer = null; $('#dmPanel').classList.add('hidden'); });
  $('#dmForm')?.addEventListener('submit', sendDm);
  const lobbyChatForm = $('#lobbyChatForm');
  if (lobbyChatForm && lobbyChatForm.dataset.chatBound !== '1') {
    lobbyChatForm.dataset.chatBound = '1';
    lobbyChatForm.addEventListener('submit', sendLobbyChat, true);
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('#freshInviteButton,[data-open-lobby-invite]');
    if (!trigger) return;
    event.preventDefault();
    openLobbyInviteDialog();
  });

  $('#lobbyInviteClose')?.addEventListener('click', () => $('#lobbyInviteDialog')?.close());
  $('#lobbyInviteFriends')?.addEventListener('click', handleLobbyInviteFriend);
  $('#lobbyInviteDialog')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.addEventListener('click', handleIncomingLobbyInvite);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-page="friends"]')) {renderFriendNotice();setTimeout(loadFriends,0);}
  });
  syncLobbyInviteButton();
  loadFriends();
  loadIncomingLobbyInvites();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void loadFriends();void loadDm();}});
  setInterval(() => {
    if(document.visibilityState==='hidden')return;
    loadFriends();
    if ($('#friends')?.classList.contains('active') && activePeer) loadDm();
    renderLobbyChat();
    syncLobbyInviteButton();
    loadIncomingLobbyInvites();
  }, 4000);
}
setupSocial();

/* Lobby participants resolve to their authenticated profile, not their display name. */
let lobbyFriendBusy=false;
async function openLobbyFriend(playerId) {
  const player=state?.lobby?.players.find(item=>item.id===playerId);
  if(!player?.profileId || player.profileId===authSession?.user?.id)return;
  let dialog=$('#lobbyFriendDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='lobbyFriendDialog';dialog.className='productDialog';
    dialog.setAttribute('aria-labelledby','lobbyFriendTitle');
    dialog.innerHTML='<button class="dialogClose" type="button" aria-label="Schließen">×</button><span class="sectionEyebrow">AUS DEINER LOBBY</span><h2 id="lobbyFriendTitle"></h2><p data-friend-status role="status"></p><div data-friend-actions></div>';
    document.body.append(dialog);
    dialog.querySelector('.dialogClose').onclick=()=>dialog.close();
    dialog.addEventListener('click',handleLobbyFriendAction);
  }
  if(lobbyFriendBusy)return;
  dialog.dataset.peer=player.profileId;
  $('#lobbyFriendTitle').textContent=player.name;
  if(!dialog.open)dialog.showModal();
  await renderLobbyFriendStatus(dialog);
}
async function renderLobbyFriendStatus(dialog) {
  const peer=dialog.dataset.peer;
  const status=dialog.querySelector('[data-friend-status]'),actions=dialog.querySelector('[data-friend-actions]');
  status.textContent='Freundschaft wird geprüft …';actions.replaceChildren();
  try {
    const rows=await socialRpc('chs_social_overview_v2')||[];
    if(dialog.dataset.peer!==peer)return;
    const relation=rows.find(row=>row.peer_id===peer);
    socialRows=rows;
    if(relation?.status==='accepted'){status.textContent='Ihr seid bereits befreundet.';return;}
    if(relation?.status==='pending'&&!relation.incoming){status.textContent='Freundschaftsanfrage gesendet. Warte auf die Antwort.';return;}
    const button=document.createElement('button');button.type='button';button.className='primaryButton';
    if(relation?.incoming){
      status.textContent='Diese Person hat dir bereits eine Anfrage geschickt.';
      button.textContent='Anfrage annehmen';button.dataset.lobbyAccept=relation.request_id;
    }else{
      status.textContent='Füge diese Person hinzu, um später wieder zusammen zu spielen.';
      button.textContent='Freundschaftsanfrage senden';button.dataset.lobbyRequest=peer;
    }
    actions.append(button);
  }catch(error){status.textContent=error.message;const retry=document.createElement('button');retry.textContent='Erneut versuchen';retry.type='button';retry.onclick=()=>renderLobbyFriendStatus(dialog);actions.append(retry);}
}
async function handleLobbyFriendAction(event) {
  const button=event.target.closest('[data-lobby-request],[data-lobby-accept]');
  if(!button||lobbyFriendBusy)return;
  const dialog=$('#lobbyFriendDialog');
  lobbyFriendBusy=true;button.disabled=true;
  try {
    if(button.dataset.lobbyAccept)await socialRpc('chs_respond_request',{request:button.dataset.lobbyAccept,accept:true});
    else await socialRpc('chs_send_request',{target:button.dataset.lobbyRequest});
    await renderLobbyFriendStatus(dialog);
  }catch(error){dialog.querySelector('[data-friend-status]').textContent=error.message;}
  finally{lobbyFriendBusy=false;button.disabled=false;}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-lobby-profile]');
  if(button)openLobbyFriend(button.dataset.lobbyProfile);
});
