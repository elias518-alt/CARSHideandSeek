'use strict';
/* Zusätzliche Oberfläche. Die vorhandene Spiel- und Auth-Logik in app.js bleibt bestehen. */
const brands = `Abarth|Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|BYD|Cadillac|Chevrolet|Chrysler|Citroën|Cupra|Dacia|Daewoo|Daihatsu|Dodge|DS|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hyundai|Infiniti|Isuzu|Jaguar|Jeep|Kia|Lada|Lamborghini|Lancia|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|MG|Mini|Mitsubishi|Nissan|Opel|Peugeot|Polestar|Porsche|Ram|Renault|Rolls-Royce|Saab|Seat|Škoda|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|Volvo`.split('|');
const models = {
  'Audi':['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','e-tron'],
  'BMW':['1er','2er','3er','4er','5er','6er','7er','8er','E30','E36','E46','E90','F30','G20','G31','M2','M3','M4','M5','X1','X3','X5','X6','X7','Z3','Z4'],
  'Mercedes-Benz':['A-Klasse','B-Klasse','C-Klasse','E-Klasse','S-Klasse','CLA','CLS','GLA','GLB','GLC','GLE','GLS','G-Klasse','V-Klasse','AMG GT'],
  'Volkswagen':['up!','Polo','Golf','Passat','Arteon','T-Cross','T-Roc','Tiguan','Touareg','Touran','Caddy','Transporter','ID.3','ID.4','ID.5','ID.7'],
  'Porsche':['911','718 Cayman','718 Boxster','Panamera','Macan','Cayenne','Taycan'],
  'Opel':['Corsa','Astra','Insignia','Mokka','Crossland','Grandland','Zafira'],
  'Ford':['Fiesta','Focus','Mondeo','Kuga','Puma','Mustang','Ranger','Transit'],
  'Toyota':['Aygo','Yaris','Corolla','Prius','Camry','RAV4','C-HR','Supra','Land Cruiser'],
  'Škoda':['Fabia','Scala','Octavia','Superb','Kamiq','Karoq','Kodiaq','Enyaq'],
  'Seat':['Ibiza','Leon','Arona','Ateca','Tarraco'],
  'Cupra':['Born','Formentor','Leon','Ateca','Tavascan'],
  'Hyundai':['i10','i20','i30','Kona','Tucson','Santa Fe','Ioniq 5','Ioniq 6'],
  'Kia':['Picanto','Rio','Ceed','XCeed','Sportage','Sorento','EV3','EV6','EV9'],
  'Renault':['Clio','Megane','Captur','Austral','Scenic','Twingo','R5'],
  'Peugeot':['208','308','408','508','2008','3008','5008'],
  'Fiat':['500','Panda','Tipo','Punto','Ducato'],
  'Honda':['Civic','Jazz','Accord','HR-V','CR-V','e'],
  'Mazda':['2','3','6','CX-3','CX-5','CX-30','MX-5'],
  'Nissan':['Micra','Juke','Qashqai','X-Trail','Leaf','GT-R'],
  'Volvo':['V40','V60','V90','S60','S90','XC40','XC60','XC90'],
  'Tesla':['Model 3','Model Y','Model S','Model X'],
  'Dacia':['Sandero','Duster','Jogger','Spring'],
  'Citroën':['C1','C3','C4','C5','Berlingo'],
  'Mini':['Cooper','Clubman','Countryman'],
  'Land Rover':['Defender','Discovery','Range Rover','Range Rover Sport','Evoque']
};
const norm = s => String(s || '').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function suggestions(input, box, entries, kind) {
  const q = norm(input.value.trim());
  const matches = entries.filter(item => !q || norm(item).includes(q)).slice(0, 9);
  box.innerHTML = matches.map(item => `<button type="button" data-${kind}="${esc(item)}">${esc(item)}</button>`).join('');
  box.classList.toggle('hidden', !matches.length);
}
function setupVehicleSearch() {
  const brand = $('#newCarBrand'), model = $('#newCarModel');
  const brandBox = $('#brandSuggestions'), modelBox = $('#modelSuggestions');
  if (!brand || !model) return;
  const showBrands = () => suggestions(brand, brandBox, brands, 'brand');
  const showModels = () => {
    const canonical = brands.find(x => norm(x) === norm(brand.value.trim()));
    suggestions(model, modelBox, models[canonical] || [], 'model');
  };
  brand.addEventListener('focus', showBrands);
  brand.addEventListener('input', () => { showBrands(); model.value = ''; modelBox.innerHTML = ''; refreshVehicleForm(); });
  model.addEventListener('focus', showModels);
  model.addEventListener('input', () => { showModels(); refreshVehicleForm(); });
  brandBox.addEventListener('click', event => {
    event.stopPropagation();
    const button = event.target.closest('[data-brand]'); if (!button) return;
    brand.value = button.dataset.brand; model.value=''; brandBox.classList.add('hidden'); refreshVehicleForm();
    model.focus(); showModels();
  });
  modelBox.addEventListener('click', event => {
    event.stopPropagation();
    const button = event.target.closest('[data-model]'); if (!button) return;
    model.value = button.dataset.model; modelBox.classList.add('hidden'); refreshVehicleForm();
    $('#newCarYear')?.focus();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#newCarBrand,#brandSuggestions')) brandBox.classList.add('hidden');
    if (!event.target.closest('#newCarModel,#modelSuggestions')) modelBox.classList.add('hidden');
  });
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
  if (!authSession || socialBusy || !$('#friends')?.classList.contains('active')) return;
  socialBusy = true;
  try {
    socialRows = await socialRpc('chs_social_overview') || [];
    renderFriends();
  } catch (error) {
    $('#friendList').textContent = error.message;
  } finally { socialBusy = false; }
}
function renderFriends() {
  const list = $('#friendList');
  const rows = socialRows.filter(x => socialTab === 'friends' ? x.status === 'accepted' : x.status === 'pending');
  list.innerHTML = rows.length ? rows.map(row => `
    <div class="socialRow">
      <div class="socialAvatar">${esc((row.username || '?').slice(0,1).toUpperCase())}</div>
      <div class="socialPerson"><strong>${esc(row.username)}</strong><small>${esc(row.player_tag || '')} · Lv. ${Number(row.level) || 1}${row.status === 'pending' ? (row.incoming ? ' · Anfrage erhalten' : ' · Anfrage gesendet') : ''}</small></div>
      <div class="socialActions">
        ${row.status === 'accepted' ? `<button data-dm="${row.peer_id}">CHAT</button><button data-remove="${row.request_id}" aria-label="Freund entfernen">×</button>` : row.incoming ? `<button data-accept="${row.request_id}">ANNEHMEN</button><button data-decline="${row.request_id}" aria-label="Ablehnen">×</button>` : `<button data-remove="${row.request_id}">ZURÜCKZIEHEN</button>`}
      </div>
    </div>`).join('') : `<div class="emptyState">${socialTab === 'friends' ? 'Noch keine Freunde. Suche oben nach einem Spielernamen.' : 'Keine offenen Anfragen.'}</div>`;
}
async function searchPlayers() {
  const q = $('#friendSearch').value.trim(), box = $('#friendSearchResults');
  if (q.length < 2) { box.innerHTML = ''; return; }
  try {
    const users = await socialRpc('chs_search_players', { q });
    if ($('#friendSearch').value.trim() !== q) return;
    box.innerHTML = users.length ? users.map(user => {
      const relation = socialRows.find(row => row.peer_id === user.user_id);
      return `<div class="socialRow"><div class="socialAvatar">${esc((user.username || '?').slice(0,1).toUpperCase())}</div><div class="socialPerson"><strong>${esc(user.username)}</strong><small>${esc(user.player_tag || '')} · Lv. ${Number(user.level) || 1}</small></div>${relation ? '<span class="socialLinked">Bereits verbunden</span>' : `<button data-request="${user.user_id}">ANFRAGE</button>`}</div>`;
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
      dmLastId = null; $('#dmTitle').textContent = `CHAT MIT ${activePeer.username}`;
      $('#dmPanel').classList.remove('hidden'); await loadDm();
      $('#dmPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toast('Erledigt ✓'); await loadFriends(); await searchPlayers();
  } catch (error) { socialError(error); }
  finally { button.disabled = false; }
}
async function loadDm() {
  if (!activePeer || !$('#friends')?.classList.contains('active')) return;
  try {
    const messages = (await socialRpc('chs_get_messages', { peer: activePeer.peer_id }) || []).reverse();
    const last = messages.at(-1)?.message_id || null;
    if (dmLastId === last) return;
    dmLastId = last;
    $('#dmMessages').innerHTML = messages.length ? messages.map(msg => `<div class="message ${msg.sender_id === authSession.user.id ? 'mine' : ''}"><small>${msg.sender_id === authSession.user.id ? 'DU' : esc(activePeer.username)} · ${new Date(msg.sent_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</small><span>${esc(msg.body)}</span></div>`).join('') : '<p class="muted">Schreib die erste Nachricht.</p>';
    $('#dmMessages').scrollTop = $('#dmMessages').scrollHeight;
  } catch (error) { $('#dmMessages').textContent = error.message; }
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
    const rows = await socialRpc('chs_social_overview') || [];
    socialRows = rows;
    const friends = rows.filter(row => row.status === 'accepted');
    list.innerHTML = friends.length ? friends.map(friend => `
      <div class="lobbyInviteFriend">
        <div class="socialAvatar">${esc((friend.username || '?').slice(0,1).toUpperCase())}</div>
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
  document.body.append(card);
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
    <div class="incomingInviteIcon">👥</div>
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
    if (event.target.closest('[data-page="friends"]')) setTimeout(loadFriends, 0);
  });
  syncLobbyInviteButton();
  loadIncomingLobbyInvites();
  setInterval(() => {
    if ($('#friends')?.classList.contains('active')) { loadFriends(); if (activePeer) loadDm(); }
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
    const rows=await socialRpc('chs_social_overview')||[];
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

