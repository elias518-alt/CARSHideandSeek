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
// Vollständige scrollbare Vorschläge statt auf neun Treffer begrenzter Liste.
function vehicleMatches(entries, query, kind) {
  const aliases = { Volkswagen: 'vw volkswagen', 'Mercedes-Benz': 'mercedes benz mercedesbenz', 'Škoda': 'skoda', BMW: 'bmw bayerische motorenwerke' };
  const tokens = norm(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(item => tokens.every(token => norm(item + ' ' + (kind === 'brand' ? aliases[item] || '' : '')).includes(token)));
}
function suggestions(input, box, entries, kind) {
  if (!box) return;
  const matches = vehicleMatches(entries, input.value, kind);
  box.replaceChildren();
  box.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-height:220px;overflow-y:auto;padding:10px 0;width:100%';
  for (const item of matches) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset[kind] = item; button.textContent = item;
    button.style.cssText = 'color:#fff;background:#293743;border:1px solid #677b89;border-radius:8px;padding:12px;min-height:44px;cursor:pointer';
    box.append(button);
  }
  if (!matches.length) {
    const hint = document.createElement('p');
    hint.textContent = 'Nicht in der Vorschlagsliste? Du kannst deine Eingabe direkt als Fahrzeug speichern.';
    box.append(hint);
  }
  box.classList.remove('hidden');
}
function setupVehicleSearch() {
  const brand = $('#newCarBrand'), model = $('#newCarModel');
  if (!brand || !model) return;
  for (const [input, id] of [[brand, 'brandSuggestions'], [model, 'modelSuggestions']]) {
    if (!document.getElementById(id)) { const box = document.createElement('div'); box.id = id; input.after(box); }
    input.autocomplete = 'off';
  }
  const brandBox = $('#brandSuggestions'), modelBox = $('#modelSuggestions');
  Object.assign(models, {
    'Suzuki':['Alto','Swift','Splash','Ignis','Baleno','Vitara','SX4','S-Cross','Jimny'],
    'Jeep':['Avenger','Renegade','Compass','Cherokee','Grand Cherokee','Wrangler'],
    'Mitsubishi':['Colt','Space Star','Lancer','ASX','Eclipse Cross','Outlander','Pajero'],
    'Subaru':['Impreza','WRX','BRZ','Forester','Outback','XV'],
    'Smart':['fortwo','forfour','#1','#3'],
    'Saab':['900','9000','9-3','9-5'],
    'Alfa Romeo':['147','156','159','Giulietta','Giulia','Stelvio','Tonale','MiTo'],
    'Chevrolet':['Spark','Aveo','Cruze','Malibu','Camaro','Corvette','Captiva','Tahoe'],
    'Dodge':['Challenger','Charger','Durango','Journey','Ram'],
    'BYD':['Dolphin','Atto 3','Seal','Seal U','Tang','Han'],
    'MG':['MG3','MG4','MG5','ZS','HS','Cyberster'],
    'Polestar':['1','2','3','4'],
    'Lexus':['IS','ES','LS','CT','UX','NX','RX','LC']
  });
  models.BMW = [...new Set([...models.BMW, 'E36 316i','E36 318i','E36 318is','E36 320i','E36 323i','E36 325i','E36 328i','E36 M3','E38 750i','E38 750iL','E39','E60','E61','E70','E71','F10','F11','G30','G31 520d'])];
  models.Volkswagen = [...new Set([...models.Volkswagen, 'Lupo','Bora','Beetle','Scirocco','Sharan','Amarok'])];
  const canonicalBrand = () => brands.find(x => norm(x) === norm(brand.value.trim())) || (norm(brand.value.trim()) === 'vw' ? 'Volkswagen' : norm(brand.value.trim()) === 'mercedes' ? 'Mercedes-Benz' : null);
  const showBrands = () => suggestions(brand, brandBox, brands, 'brand');
  const showModels = () => suggestions(model, modelBox, models[canonicalBrand()] || [], 'model');
  brand.addEventListener('focus', showBrands);
  brand.addEventListener('input', () => { showBrands(); model.value = ''; modelBox.replaceChildren(); });
  brand.addEventListener('blur', () => { const canonical = canonicalBrand(); if (canonical) brand.value = canonical; });
  model.addEventListener('focus', showModels);
  model.addEventListener('input', showModels);
  brandBox.addEventListener('click', event => {
    const button = event.target.closest('[data-brand]'); if (!button) return;
    event.preventDefault(); event.stopPropagation();
    brand.value = button.dataset.brand; model.value = ''; brandBox.classList.add('hidden');
    model.focus(); showModels();
  });
  modelBox.addEventListener('click', event => {
    const button = event.target.closest('[data-model]'); if (!button) return;
    event.preventDefault(); event.stopPropagation();
    model.value = button.dataset.model; modelBox.classList.add('hidden'); $('#newCarYear')?.focus();
  });
  new MutationObserver(() => { if (!$('#carModal').classList.contains('hidden')) { showBrands(); modelBox.classList.add('hidden'); } })
    .observe($('#carModal'), {attributes:true, attributeFilter:['class']});
}

let socialRows = [];
let activePeer = null;
let socialTab = 'friends';
let socialBusy = false;
let searchTimer = null;
let dmLastId = null;
let chatLastId = null;
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
function renderLobbyChat() {
  if (!$('#game')?.classList.contains('active') || !state?.chat) return;
  const messages = state.chat, last = `${state.lobby?.code || ''}:${messages.at(-1)?.id || 'empty'}`;
  if (chatLastId === last) return;
  chatLastId = last;
  const list = $('#lobbyMessages');
  if (!list) return;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
  const oldScroll = list.scrollTop;
  list.innerHTML = messages.length ? messages.map(msg => `<div class="message ${msg.sender === gameSession?.userId ? 'mine' : ''}"><small>${esc(msg.name)} · ${new Date(msg.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</small><span>${esc(msg.body)}</span></div>`).join('') : '<p class="muted">Noch keine Nachrichten in der Lobby.</p>';
  list.scrollTop = nearBottom ? list.scrollHeight : oldScroll;
}
async function sendLobbyChat(event) {
  event.preventDefault();
  const input = $('#lobbyChatInput'), body = input.value.trim();
  if (!gameSession || !body) return;
  try { await api('chat', gameCredentials({ body })); input.value = ''; await poll(); renderLobbyChat(); }
  catch (error) { socialError(error); }
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
  $('#lobbyChatForm')?.addEventListener('submit', sendLobbyChat);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-page="friends"]')) setTimeout(loadFriends, 0);
  });
  setInterval(() => {
    if ($('#friends')?.classList.contains('active')) { loadFriends(); if (activePeer) loadDm(); }
    renderLobbyChat();
  }, 4000);
}
setupSocial();
