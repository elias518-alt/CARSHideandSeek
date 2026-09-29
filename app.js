const SUPABASE_URL = 'https://yyvljkzitodxhtkilsxm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zgP-ABl8eaVGLkheMdlVWw_0TeZIEr8';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));


let authSession = null;
let dbProfile = null;

let gameSession =
  JSON.parse(localStorage.getItem('chs') || 'null');

let localGarage =
  JSON.parse(localStorage.getItem('chsGarage') || '[]');

let pendingCarPhoto = '';
let carPhotoBusy = false;
let state = null;
let pollTimer = null;
let watch = null;
let gpsStarting = false;
let gpsHeartbeat = null;


/* =========================================================
   HELPERS
========================================================= */

function toast(message) {
  const element = $('#toast');

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.add('show');

  clearTimeout(element._timer);

  element._timer = setTimeout(() => {
    element.classList.remove('show');
  }, 2800);
}


function initials(name) {
  const parts =
    String(name || 'Spieler')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map(part => part[0])
      .join('') || '?'
  ).toUpperCase();
}


function xpRange(level) {
  const safeLevel = Math.max(1, Number(level) || 1);

  return {
    start: (safeLevel - 1) * 1000,
    end: safeLevel * 1000
  };
}


function activeCar() {
  return (
    localGarage.find(car => car.active) ||
    localGarage[0] ||
    null
  );
}


function saveGarage() {
  localStorage.setItem(
    'chsGarage',
    JSON.stringify(localGarage)
  );
}


function openPage(page) {
  $$('.page').forEach(element => {
    element.classList.remove('active');
  });

  const target = document.getElementById(page);

  if (target) {
    target.classList.add('active');
  }

  $$('.navButton').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.page === page
    );
  });

  $('#bottomNav')?.classList.toggle(
    'hidden',
    page === 'game'
  );

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   AUTH
========================================================= */

async function googleLogin() {
  const button = $('#googleLogin');

  if (button) {
    button.disabled = true;
  }

  if ($('#authStatus')) {
    $('#authStatus').textContent =
      'Google wird geöffnet…';
  }

  const { error } =
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',

      options: {
        redirectTo:
          `${window.location.origin}/`
      }
    });

  if (error) {
    console.error(error);

    if (button) {
      button.disabled = false;
    }

    if ($('#authStatus')) {
      $('#authStatus').textContent =
        error.message;
    }

    toast(error.message);
  }
}


async function logout() {
  clearTimeout(pollTimer);
  clearInterval(gpsHeartbeat);
  gpsHeartbeat = null;

  if (
    watch !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(watch);
  }

  watch = null;
  state = null;
  gameSession = null;

  localStorage.removeItem('chs');

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    toast(error.message);
    return;
  }

  authSession = null;
  dbProfile = null;

  $('#app')?.classList.add('hidden');
  $('#authGate')?.classList.remove('hidden');
}


async function loadProfile(userId, attempt = 0) {
  const { data, error } =
    await supabaseClient
      .from('profiles')
      .select(`
        id,
        username,
        player_tag,
        avatar_url,
        level,
        xp,
        rounds_played,
        wins,
        finds,
        survived_rounds,
        active_vehicle_id,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

  if (error) {
    /*
      Beim allerersten Login kann der Trigger einen
      kurzen Moment benötigen.
    */

    if (attempt < 5) {
      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );

      return loadProfile(
        userId,
        attempt + 1
      );
    }

    throw error;
  }

  dbProfile = data;

  renderProfile();
}


function renderProfile() {
  if (
    !dbProfile ||
    !authSession?.user
  ) {
    return;
  }

  const name =
    dbProfile.username || 'Spieler';

  const level =
    Math.max(
      1,
      Number(dbProfile.level) || 1
    );

  const xp =
    Math.max(
      0,
      Number(dbProfile.xp) || 0
    );

  const rounds =
    Number(dbProfile.rounds_played) || 0;

  const wins =
    Number(dbProfile.wins) || 0;

  const finds =
    Number(dbProfile.finds) || 0;

  const winrate =
    rounds > 0
      ? Math.round((wins / rounds) * 100)
      : 0;

  const range =
    xpRange(level);

  const progress =
    Math.max(
      0,
      Math.min(
        100,
        ((xp - range.start) /
          (range.end - range.start)) *
          100
      )
    );

  const avatar =
    initials(name);

  const setText = (selector, value) => {
    const element = $(selector);

    if (element) {
      element.textContent = value;
    }
  };


  setText('#headerName', name);
  setText('#headerLevel', level);

  setText(
    '#headerXp',
    `${xp.toLocaleString('de-DE')} XP`
  );

  setText(
    '#headerAvatar',
    avatar
  );


  setText(
    '#homeRounds',
    rounds
  );

  setText(
    '#homeWins',
    wins
  );

  setText(
    '#homeFinds',
    finds
  );

  setText(
    '#homeLevel',
    `LEVEL ${level}`
  );

  setText(
    '#homeXp',
    `${xp.toLocaleString('de-DE')} XP`
  );

  setText(
    '#homeXpStart',
    `${range.start.toLocaleString('de-DE')} XP`
  );

  setText(
    '#homeXpEnd',
    `${range.end.toLocaleString('de-DE')} XP`
  );


  if ($('#homeProgressBar')) {
    $('#homeProgressBar').style.width =
      `${progress}%`;
  }


  setText(
    '#profileName',
    name
  );

  setText(
    '#profileLevelBadge',
    level
  );

  setText(
    '#profileLevelText',
    `LEVEL ${level}`
  );

  setText(
    '#profileXpText',
    `${xp.toLocaleString('de-DE')} / ` +
    `${range.end.toLocaleString('de-DE')} XP`
  );

  setText(
    '#profileRounds',
    rounds
  );

  setText(
    '#profileWins',
    wins
  );

  setText(
    '#profileFinds',
    finds
  );

  setText(
    '#profileWinrate',
    `${winrate}%`
  );

  setText(
    '#profileTag',
    `PLAYER-ID ${
      dbProfile.player_tag ||
      authSession.user.id
        .slice(0, 8)
        .toUpperCase()
    }`
  );

  setText(
    '#accountEmail',
    authSession.user.email || 'Google-Konto'
  );


  if ($('#profileAvatar')) {
    /*
      Der Level-Badge muss erhalten bleiben.
    */

    const badge =
      $('#profileLevelBadge');

    $('#profileAvatar').innerHTML = '';

    $('#profileAvatar').append(
      document.createTextNode(avatar)
    );

    if (badge) {
      $('#profileAvatar').append(badge);
    }
  }


  if ($('#profileProgressBar')) {
    $('#profileProgressBar').style.width =
      `${progress}%`;
  }


  if ($('#name')) {
    $('#name').value = name;
  }


  paintProfileAvatars();
  syncVehicleUI();
}


/* =========================================================
   INITIAL AUTH
========================================================= */

async function initializeAuth() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    authSession =
      data.session;


    if (!authSession) {
      $('#app')?.classList.add('hidden');

      $('#authGate')
        ?.classList.remove('hidden');

      if ($('#authStatus')) {
        $('#authStatus').textContent =
          'Anmeldung erforderlich';
      }

      return;
    }


    $('#authGate')
      ?.classList.add('hidden');

    $('#app')
      ?.classList.remove('hidden');


    await loadProfile(
      authSession.user.id
    );


    if (gameSession) {
      showGame();
    }

    else {
      openPage('home');
    }
  }

  catch (error) {
    console.error(
      'Auth initialization failed:',
      error
    );

    $('#app')
      ?.classList.add('hidden');

    $('#authGate')
      ?.classList.remove('hidden');

    if ($('#authStatus')) {
      $('#authStatus').textContent =
        'Profil konnte nicht geladen werden: ' +
        error.message;
    }
  }
}


supabaseClient.auth.onAuthStateChange(
  (event, newSession) => {

    authSession =
      newSession;

    if (event === 'SIGNED_OUT') {
      $('#app')
        ?.classList.add('hidden');

      $('#authGate')
        ?.classList.remove('hidden');
    }

  }
);


/* =========================================================
   GARAGE
========================================================= */

function syncVehicleUI() {
  const car =
    activeCar();


  if (!car) {
    if ($('#vehicle')) {
      $('#vehicle').value = '';
    }

    if ($('#color')) {
      $('#color').value = '';
    }

    if ($('#homeVehicleBrand')) {
      $('#homeVehicleBrand').textContent =
        'KEIN FAHRZEUG';
    }

    if ($('#homeVehicle')) {
      $('#homeVehicle').textContent =
        'Fahrzeug hinzufügen';
    }

    if ($('#homeColor')) {
      $('#homeColor').textContent =
        '–';
    }

    if ($('#homeCarStatus')) {
      $('#homeCarStatus').textContent =
        'NICHT GESETZT';
    }
  }

  else {
    if ($('#vehicle')) {
      $('#vehicle').value =
        `${car.brand} ${car.model}`.trim();
    }

    if ($('#color')) {
      $('#color').value =
        car.color || '';
    }

    if ($('#homeVehicleBrand')) {
      $('#homeVehicleBrand').textContent =
        car.brand || 'FAHRZEUG';
    }

    if ($('#homeVehicle')) {
      $('#homeVehicle').textContent =
        car.model || '–';
    }

    if ($('#homeColor')) {
      $('#homeColor').textContent =
        car.color || '–';
    }

    if ($('#homeCarStatus')) {
      $('#homeCarStatus').textContent =
        'AKTIV';
    }
  }


  const visual = document.querySelector('.activeCarCard .carVisual');
  if (visual) visual.innerHTML = carPhotoMarkup(car);
  renderGarage();
}


function renderGarage() {
  const container =
    $('#garageCars');

  if (!container) {
    return;
  }


  if (!localGarage.length) {
    container.innerHTML = `
      <section class="infoPanel">
        <span>NOCH KEIN FAHRZEUG</span>
        <p>
          Füge dein erstes Fahrzeug hinzu.
          Es wird anschließend als aktives
          Fahrzeug verwendet.
        </p>
      </section>
    `;

    return;
  }


  container.innerHTML =
    localGarage
      .map(car => `
        <section class="garageCar ${
          car.active
            ? 'activeVehicle'
            : ''
        }">

          <div class="garageCarTop">

            ${
              car.active
                ? `
                  <span class="activeTag">
                    AKTIVES FAHRZEUG
                  </span>
                `
                : `
                  <span class="manufacturer">
                    FAHRZEUG
                  </span>
                `
            }

          </div>

          <div class="garageVehicleVisual" style="height:auto;min-height:140px">
            ${carPhotoMarkup(car)}
          </div>
          <label style="display:block;margin:10px 0">FOTO HINZUFÜGEN / ÄNDERN
            <input type="file" accept="image/jpeg,image/png,image/webp" data-car-photo="${esc(car.id)}">
          </label>
          ${safeCarPhoto(car.photo) ? `<button type="button" class="textButton" data-remove-photo="${esc(car.id)}">FOTO ENTFERNEN</button>` : ''}


          <span class="manufacturer">
            ${esc(car.brand)}
          </span>

          <h2>
            ${esc(car.model)}
          </h2>

          <div class="vehicleDetails">

            <span>
              ${esc(car.color)}
            </span>

            <span>
              ${esc(car.year || '–')}
            </span>

          </div>

          ${car.active ? '' : `<button class="activateVehicle" data-car-id="${esc(car.id)}" type="button">ALS AKTIVES FAHRZEUG WÄHLEN</button>`}

        </section>
      `)
      .join('');
}


function openCarModal() {
  setupCarPhotoInput();
  $('#carModal')
    ?.classList.remove('hidden');
}


function closeCarModal() {
  $('#carModal')
    ?.classList.add('hidden');
}


function saveCar() {
  if (carPhotoBusy) { toast("Bitte warten, bis das Foto verarbeitet ist."); return; }
  const brand =
    $('#newCarBrand')
      ?.value
      .trim();

  const model =
    $('#newCarModel')
      ?.value
      .trim();

  const year =
    $('#newCarYear')
      ?.value
      .trim();

  const color =
    $('#newCarColor')
      ?.value
      .trim();


  if (
    !brand ||
    !model ||
    !color
  ) {
    toast(
      'Bitte Marke, Modell und Farbe angeben.'
    );

    return;
  }


  const oldGarage = localGarage.map(car => ({ ...car }));
  localGarage.forEach(car => {
    car.active = false;
  });


  localGarage.push({
    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : `car_${Date.now()}`,

    brand,
    model,
    year,
    color,
    photo: pendingCarPhoto,
    active: true
  });


  try { saveGarage(); }
  catch { localGarage = oldGarage; toast('Speicher voll. Bitte ein gespeichertes Foto entfernen.'); return; }
  pendingCarPhoto = '';
  resetCarPhotoInput();
  syncVehicleUI();
  closeCarModal();


  $('#newCarBrand').value = '';
  $('#newCarModel').value = '';
  $('#newCarYear').value = '';
  $('#newCarColor').value = '';


  toast(
    'Fahrzeug gespeichert ✓'
  );
}


/* =========================================================
   GAME API
========================================================= */

async function api(
  path,
  data = {},
  method = 'POST'
) {
  let url =
    `/api/${path}`;

  const options = {
    method,

    headers: {
      'Content-Type':
        'application/json',

      ...(authSession?.access_token
        ? {
            Authorization:
              `Bearer ${authSession.access_token}`
          }
        : {})
    }
  };


  if (method === 'GET') {
    url +=
      '?' +
      new URLSearchParams(data);
  }

  else {
    options.body =
      JSON.stringify(data);
  }


  const response =
    await fetch(
      url,
      options
    );


  let json;

  try {
    json =
      await response.json();
  }

  catch {
    throw new Error(
      'Serverantwort konnte nicht gelesen werden.'
    );
  }


  if (!response.ok) {
    const error =
      new Error(
        json.error ||
        'Unbekannter Fehler'
      );

    error.data =
      json;

    throw error;
  }


  return json;
}


const gameCredentials =
  extra => ({
    code:
      gameSession?.code,

    userId:
      gameSession?.userId,

    ...(extra || {})
  });


function playerData() {
  const car =
    activeCar();


  if (!dbProfile) {
    throw new Error(
      'Profil ist noch nicht geladen.'
    );
  }


  if (!car) {
    throw new Error(
      'Bitte zuerst ein Fahrzeug in der Garage hinzufügen.'
    );
  }


  return {
    name:
      dbProfile.username ||
      'Spieler',

    vehicle:
      `${car.brand} ${car.model}`.trim(),

    color:
      car.color ||
      'Unbekannt',

    mode:
      $('#mode')?.value ||
      'PASSENGER'
  };
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS wird auf diesem Gerät nicht unterstützt.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        if (position.coords.accuracy > 100) {
          reject(new Error('GPS ist zu ungenau. Bitte draußen erneut versuchen.'));
          return;
        }
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => reject(new Error('Standort freigeben, um öffentliche Runden zu finden.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  });
}

async function findPublic() {
  const list = $('#publicLobbies');
  list.textContent = 'Suche nach Runden in deiner Nähe…';
  try {
    const position = await currentPosition();
    const result = await api('public', position, 'GET');
    list.innerHTML = result.lobbies.length
      ? result.lobbies.map(lobby => `
          <button class="publicLobby" type="button" data-public-code="${esc(lobby.code)}">
            <strong>${esc(lobby.name)}</strong>
            <small>${lobby.players}/${lobby.maxPlayers} Spieler · ca. ${lobby.distanceKm} km</small>
            <span>BEITRETEN ›</span>
          </button>`).join('')
      : '<p class="muted">Noch keine öffentliche Runde in 20 km Nähe. Erstelle selbst eine!</p>';
  } catch (error) {
    list.textContent = error.message;
  }
}


/* =========================================================
   CREATE / JOIN
========================================================= */

async function create() {
  try {
    const visibility = $('#visibility')?.value || 'PRIVATE';
    const location = visibility === 'PUBLIC' ? await currentPosition() : {};
    const result =
      await api(
        'create',
        {
          ...playerData(),
          visibility,
          ...location,

          lobbyName:
            $('#lname')?.value ||
            'NIGHT HUNT',

          radius:
            +$('#radius')?.value ||
            3000,

          duration:
            +$('#duration')?.value ||
            900,

          headstart:
            +$('#headstart')?.value ||
            180,

          escape:
            +$('#escape')?.value ||
            15
        }
      );


    saveGameSession(result);
    showGame();
  }

  catch (error) {
    toast(
      error.message
    );
  }
}


async function join(codeOverride) {
  const lobbyCode =
    (typeof codeOverride === 'string' ? codeOverride : $('#code')?.value || '')
      .trim()
      .toUpperCase();


  if (!lobbyCode) {
    toast(
      'Bitte einen Lobby-Code eingeben.'
    );

    return;
  }


  try {
    const location = await currentPosition();
    const result =
      await api(
        'join',
        {
          ...playerData(),
          code: lobbyCode,
          ...location
        }
      );


    saveGameSession(result);
    showGame();
  }

  catch (error) {
    toast(
      error.message
    );
  }
}


function saveGameSession(result) {
  gameSession = {
    code:
      result.lobby.code,

    userId:
      result.userId
  };


  localStorage.setItem(
    'chs',
    JSON.stringify(gameSession)
  );
}


/* =========================================================
   GAME
========================================================= */

function showGame() {
  openPage('game');

  poll();


  setTimeout(() => {
    if (
      watch === null &&
      !gpsStarting
    ) {
      gps();
    }
  }, 400);
}


async function poll() {
  clearTimeout(pollTimer);


  if (!gameSession) {
    return;
  }


  try {
    state =
      await api(
        'state',
        gameCredentials(),
        'GET'
      );


    renderGame();
  }

  catch (error) {
    console.error(error);


    if (
      error.message.includes(
        'Lobby nicht gefunden'
      ) ||
      error.message.includes(
        'Session'
      )
    ) {
      toast(
        'Die Lobby ist nicht mehr verfügbar.'
      );

      setTimeout(
        resetGame,
        1200
      );

      return;
    }


    toast(
      error.message
    );
  }


  pollTimer =
    setTimeout(
      poll,
      1000
    );
}


function formatTime(seconds) {
  seconds =
    Math.max(
      0,
      Math.ceil(seconds)
    );


  return (
    `${Math.floor(seconds / 60)}:` +
    `${String(seconds % 60)
      .padStart(2, '0')}`
  );
}


function renderGame() {
  if (
    !state ||
    !state.lobby
  ) {
    return;
  }


  const lobby =
    state.lobby;

  const me =
    lobby.me;

  const serverTime =
    state.serverTime;


  if (!me) {
    return;
  }


  $('#lobbyName').textContent =
    lobby.name;

  $('#lobbyCode').textContent =
    lobby.code;

  $('#state').textContent =
    lobby.state;

  $('#stateLabel').textContent =
    lobby.state;

  $('#count').textContent =
    lobby.players.length;


  $('#role').textContent =
    me.role === 'SEEKER'
      ? '🔎 SUCHER'
      : me.role === 'HIDER'
        ? '👤 VERSTECKER'
        : 'OFFEN';


  $('#driverWarning')
    ?.classList.toggle(
      'hidden',
      me.mode !== 'DRIVER'
    );


  let endTime = null;


  if (
    lobby.state === 'COUNTDOWN'
  ) {
    endTime =
      lobby.countdownEndsAt;
  }

  else if (
    lobby.state === 'HEADSTART'
  ) {
    endTime =
      lobby.headstartEndsAt;
  }

  else {
    endTime =
      lobby.endsAt;
  }


  $('#timer').textContent =
    endTime
      ? formatTime(
          (endTime - serverTime) /
          1000
        )
      : '–';


  $('#ready').textContent =
    me.ready
      ? '✓ BEREIT'
      : 'BEREIT';


  $('#ready')
    ?.classList.toggle(
      'active',
      me.ready
    );


  $('#ready')
    ?.classList.toggle(
      'hidden',
      lobby.state !== 'LOBBY'
    );


  $('#gpsDot')
    ?.classList.toggle(
      'on',
      me.hasLocation
    );


  if (me.hasLocation) {
    $('#gps').textContent =
      'GPS AKTIV ✓';
  }


  const isHost =
    lobby.hostId === me.id;

  const enoughPlayers =
    lobby.players.length >= 2;

  const inLobby =
    lobby.state === 'LOBBY';


  $('#start')
    ?.classList.toggle(
      'hidden',
      !isHost ||
      !inLobby ||
      !enoughPlayers
    );


  $('#start').disabled =
    isHost &&
    enoughPlayers &&
    inLobby &&
    !me.hasLocation;


  $('#start').textContent =
    (
      isHost &&
      enoughPlayers &&
      inLobby &&
      !me.hasLocation
    )
      ? 'POSITION WIRD ERMITTELT...'
      : 'SPIEL STARTEN';


  const proximity =
    state.proximity;


  let proximityText =
    me.hasLocation
      ? 'GPS aktiv · keine Gegnerdaten in direkter Nähe.'
      : 'Standort wird ermittelt...';


  if (proximity) {
    if (
      proximity.level ===
      'VERY_CLOSE'
    ) {
      proximityText =
        `⚠ EXTREM NAH · ca. ${proximity.distance} m`;
    }

    else if (
      proximity.level ===
      'CLOSE'
    ) {
      proximityText =
        `⚠ SEHR NAH · ca. ${proximity.distance} m`;
    }

    else if (
      proximity.level ===
      'NEAR'
    ) {
      proximityText =
        `⚠ JEMAND NÄHERT SICH · ca. ${proximity.distance} m`;
    }

    else {
      proximityText =
        `Kein Gegner in direkter Nähe · ca. ${proximity.distance} m`;
    }


    $('#enemyDot')
      ?.classList.remove(
        'hidden'
      );
  }

  else {
    $('#enemyDot')
      ?.classList.add(
        'hidden'
      );
  }


  $('#proximity').textContent =
    proximityText;


  $('#proximity')
    ?.classList.toggle(
      'hot',
      !!proximity &&
      proximity.distance < 50
    );


  const escapeLeft =
    Math.ceil(
      (
        (state.escapeUntil || 0) -
        serverTime
      ) / 1000
    );


  $('#escapeBox')
    ?.classList.toggle(
      'hidden',
      !(
        escapeLeft > 0 &&
        me.role === 'HIDER'
      )
    );


  $('#escapeTimer').textContent =
    Math.max(
      0,
      escapeLeft
    );


  $('#players').innerHTML =
    lobby.players
      .map(player => `
        <div class="player ${
          player.found
            ? 'found'
            : ''
        }">

          <div class="avatar">
            ${
              player.role === 'SEEKER'
                ? '🔎'
                : player.role === 'HIDER'
                  ? '👤'
                  : '🚘'
            }
          </div>

          <div class="pdata">

            <b>
              ${esc(player.name)}

              ${
                player.id ===
                lobby.hostId
                  ? '<em>HOST</em>'
                  : ''
              }
            </b>

            <small>
              ${esc(player.vehicle)}
              ·
              ${esc(player.color)}
            </small>

            <small>
              ${
                player.connected
                  ? '● Online'
                  : '○ Reconnect…'
              }

              · Lv. ${player.level}
            </small>

          </div>

          <div>
            ${
              player.ready
                ? '✓'
                : ''
            }

            ${
              player.found
                ? ' FOUND'
                : ''
            }
          </div>

        </div>
      `)
      .join('');


  const targets =
    lobby.players.filter(
      player =>
        player.role === 'HIDER' &&
        !player.found
    );


  const canFind =
    me.role === 'SEEKER' &&
    lobby.state === 'ACTIVE';


  $('#targets')
    ?.classList.toggle(
      'hidden',
      !canFind
    );


  $('#targetButtons').innerHTML =
    targets
      .map(player => `
        <button
          class="danger"
          onclick="found('${player.id}')"
          ${state.nearbyTargets?.includes(player.id) ? '' : 'disabled'}>

          🚘
          ${esc(player.vehicle)}
          ·
          ${esc(player.color)}
          ${state.nearbyTargets?.includes(player.id) ? '' : ' · erst in GPS-Nähe'}

        </button>
      `)
      .join('');


  const cooldown =
    Math.ceil(
      (
        (state.cooldownUntil || 0) -
        serverTime
      ) / 1000
    );


  $('#cooldown').textContent =
    cooldown > 0
      ? `Nächster Fundversuch in ${formatTime(cooldown)}`
      : '';


  $('#result')
    ?.classList.toggle(
      'hidden',
      lobby.state !== 'RESULT'
    );


  if (
    lobby.state === 'RESULT'
  ) {
    const seekerWin =
      lobby.result?.seekersWin;


    $('#resultTitle').textContent =
      seekerWin
        ? 'SUCHER GEWINNEN'
        : 'VERSTECKER GEWINNEN';


    $('#resultText').textContent =
      `${lobby.result?.found || 0} von ` +
      `${lobby.result?.totalHiders || 0} ` +
      `Versteckern gefunden.`;


    $('#xpGain').textContent =
      me.role === 'SEEKER'
        ? 100 +
          (
            lobby.result?.found ||
            0
          ) * 80
        : me.found
          ? 140
          : 280;


    $('#rematch')
      ?.classList.toggle(
        'hidden',
        lobby.hostId !== me.id
      );
  }

  renderLobbySettings();
  renderFreshLobby();
  window.chsMapUpdate?.(state);
}


/* =========================================================
   GPS
========================================================= */

async function sendGameLocation(position) {
  if (!gameSession) return;
  try {
    await api('location', gameCredentials({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed
    }));
    $('#gps').textContent = 'GPS AKTIV ✓';
    $('#gpsDot')?.classList.add('on');
  } catch (error) {
    console.error('Standortübertragung fehlgeschlagen', error);
  }
}

function gps() {
  if (
    !navigator.geolocation
  ) {
    toast(
      'Dieses Gerät unterstützt keine Standortabfrage.'
    );

    return;
  }


  if (
    watch !== null ||
    gpsStarting
  ) {
    return;
  }


  gpsStarting = true;

  if (gpsHeartbeat === null) {
    gpsHeartbeat = setInterval(() => {
      if (!gameSession || watch === null) return;
      navigator.geolocation.getCurrentPosition(
        position => sendGameLocation(position),
        error => console.error('GPS-Aktualisierung:', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }, 10000);
  }

  $('#gps').textContent =
    'GPS WIRD ERMITTELT...';


  watch =
    navigator.geolocation.watchPosition(

      position => {
        gpsStarting = false;
        sendGameLocation(position);
      },


      error => {
        console.error(
          'GPS:',
          error
        );


        gpsStarting = false;


        if (
          watch !== null
        ) {
          navigator.geolocation
            .clearWatch(
              watch
            );
        }


        watch = null;
        clearInterval(gpsHeartbeat);
        gpsHeartbeat = null;


        $('#gps').textContent =
          'GPS ERNEUT VERSUCHEN';


        if (error.code === 1) {
          toast(
            'Standortzugriff nicht erlaubt. Bitte Standort für diese Webseite freigeben.'
          );
        }

        else if (error.code === 2) {
          toast(
            'Aktuelle Position konnte nicht bestimmt werden.'
          );
        }

        else if (error.code === 3) {
          toast(
            'GPS benötigt länger. Bitte erneut versuchen.'
          );
        }

        else {
          toast(
            `GPS: ${error.message}`
          );
        }
      },


      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
}


/* =========================================================
   GAME ACTIONS
========================================================= */

async function ready() {
  if (!state?.lobby?.me) {
    return;
  }


  try {
    await api(
      'ready',
      gameCredentials({
        ready:
          !state.lobby.me.ready
      })
    );


    poll();
  }

  catch (error) {
    toast(
      error.message
    );
  }
}


async function start() {
  if (
    !state?.lobby?.me?.hasLocation
  ) {
    toast(
      'Aktuelle Position wird noch ermittelt.'
    );


    if (watch === null) {
      gps();
    }

    return;
  }


  try {
    await api(
      'start',
      gameCredentials()
    );


    toast(
      'Countdown gestartet'
    );


    poll();
  }

  catch (error) {
    toast(
      error.message
    );
  }
}


async function found(targetId) {
  try {
    const result =
      await api(
        'found',
        gameCredentials({
          targetId
        })
      );


    toast(
      `✓ FUND BESTÄTIGT · ${result.distance} m`
    );


    poll();
  }

  catch (error) {
    toast(
      `✕ ${error.message}` +
      (
        error.data?.distance != null
          ? ` · ${error.data.distance} m`
          : ''
      )
    );
  }
}


async function rematch() {
  try {
    await api(
      'rematch',
      gameCredentials()
    );


    toast(
      'Neue Runde vorbereitet'
    );


    poll();
  }

  catch (error) {
    toast(
      error.message
    );
  }
}


async function leave() {
  try {
    await api(
      'leave',
      gameCredentials()
    );
  }

  catch (error) {
    console.error(error);
  }


  resetGame();
}


function resetGame() {
  clearTimeout(
    pollTimer
  );
  clearInterval(gpsHeartbeat);
  gpsHeartbeat = null;


  if (
    watch !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation
      .clearWatch(
        watch
      );
  }


  watch = null;
  gpsStarting = false;
  state = null;
  gameSession = null;
  window.chsMapReset?.();


  localStorage.removeItem(
    'chs'
  );


  openPage(
    'home'
  );
}


/* =========================================================
   NAVIGATION
========================================================= */

$$('[data-page]')
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {
        openPage(
          button.dataset.page
        );
      }
    );

  });


$('#openPlay')
  ?.addEventListener(
    'click',
    () => openPage('play')
  );


$('#navPlay')
  ?.addEventListener(
    'click',
    () => openPage('play')
  );


/* =========================================================
   BUTTONS
========================================================= */

$('#googleLogin')
  ?.addEventListener(
    'click',
    googleLogin
  );


$('#logout')
  ?.addEventListener(
    'click',
    logout
  );


$('#create')
  ?.addEventListener(
    'click',
    create
  );


$('#join')
  ?.addEventListener(
    'click',
    () => join()
  );

$('#findPublic')?.addEventListener('click', findPublic);
$('#publicLobbies')?.addEventListener('click', event => {
  const button = event.target.closest('[data-public-code]');
  if (button) join(button.dataset.publicCode);
});


$('#gps')
  ?.addEventListener(
    'click',
    gps
  );


$('#ready')
  ?.addEventListener(
    'click',
    ready
  );


$('#start')
  ?.addEventListener(
    'click',
    start
  );


$('#rematch')
  ?.addEventListener(
    'click',
    rematch
  );


$('#leave')
  ?.addEventListener(
    'click',
    leave
  );


$('#addCar')
  ?.addEventListener(
    'click',
    openCarModal
  );


$('#garageAddCar')
  ?.addEventListener(
    'click',
    openCarModal
  );

$('#garageCars')?.addEventListener('click', event => {
  const button = event.target.closest('[data-car-id]');
  if (!button) return;
  localGarage.forEach(car => { car.active = car.id === button.dataset.carId; });
  saveGarage();
  syncVehicleUI();
  toast('Aktives Fahrzeug geändert ✓');
});


$('#closeCarModal')
  ?.addEventListener(
    'click',
    closeCarModal
  );


$('.modalBackdrop')
  ?.addEventListener(
    'click',
    closeCarModal
  );


$('#saveCar')
  ?.addEventListener(
    'click',
    saveCar
  );


/* =========================================================
   START
========================================================= */

syncVehicleUI();

initializeAuth();


/* Host-Einstellungen: Änderungen werden ausschließlich serverseitig freigegeben. */
let lobbySettingsKey = '';
let lobbySettingsSaving = false;
function renderLobbySettings() {
  const lobby = state?.lobby;
  if (!lobby?.me) return;
  let panel = document.getElementById('lobbySettingsPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'lobbySettingsPanel';
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panelTitle"><div><span>DEINE LOBBY</span><h3>EINSTELLUNGEN</h3></div></div>
      <p id="lobbySettingsSummary" class="muted"></p>
      <p id="lobbySettingsNotice" role="status"></p>
      <details id="lobbySettingsEditor">
        <summary style="cursor:pointer;padding:12px 0;font-weight:bold">⚙ Lobby bearbeiten</summary>
        <form id="lobbySettingsForm">
          <label>LOBBY-NAME<input id="editLobbyName" maxlength="40" required></label>
          <div class="settingsGrid">
            <label>SICHTBARKEIT<select id="editLobbyVisibility"><option value="PRIVATE">Privat – Beitritt mit Code</option><option value="PUBLIC">Öffentlich – in der Suche sichtbar</option></select></label>
            <label>RADIUS IN METERN<input id="editLobbyRadius" type="number" min="200" max="10000" step="1" required></label>
            <label>SPIELZEIT IN MINUTEN<input id="editLobbyDuration" type="number" min="5" max="60" step="1" required></label>
            <label>STARTVORSPRUNG IN SEKUNDEN<input id="editLobbyHeadstart" type="number" min="30" max="300" step="1" required></label>
          </div>
          <p class="muted">Änderungen gelten für alle. Danach müssen sich die Spieler erneut bereit melden. Der Mittelpunkt bleibt bestehen.</p>
          <button id="saveLobbySettings" type="submit" class="primaryButton">ÄNDERUNGEN SPEICHERN</button>
          <button id="cancelLobbySettings" type="button" class="textButton" style="padding:12px">ABBRECHEN</button>
          <p id="lobbySettingsError" role="alert"></p>
        </form>
      </details>`;
    document.querySelector('#game .gameHeaderCard').after(panel);
    document.getElementById('lobbySettingsEditor').addEventListener('toggle', event => {
      if (event.target.open) fillLobbySettings();
    });
    document.getElementById('cancelLobbySettings').addEventListener('click', () => {
      document.getElementById('lobbySettingsEditor').open = false;
    });
    document.getElementById('lobbySettingsForm').addEventListener('submit', saveLobbySettings);
  }
  const settings = lobby.settings;
  const editor = document.getElementById('lobbySettingsEditor');
  const notice = document.getElementById('lobbySettingsNotice');
  const host = lobby.hostId === lobby.me.id;
  editor.hidden = !host || lobby.state !== 'LOBBY' || !settings;
  if (editor.hidden) editor.open = false;
  document.getElementById('lobbySettingsSummary').textContent = settings
    ? `${lobby.visibility === 'PUBLIC' ? 'Öffentlich' : 'Privat'} · Radius ${settings.radius / 1000} km · ${settings.duration / 60} Min. Spielzeit · ${settings.headstart} Sek. Vorsprung`
    : 'Bitte auch die aktualisierte server.js bereitstellen.';
  const key = `${lobby.code}:${settings?.revision || 0}:${lobby.hostId}`;
  if (lobbySettingsKey && lobbySettingsKey !== key && editor.open) {
    editor.open = false;
    toast('Lobby-Einstellungen aktualisiert. Bei Bedarf erneut öffnen.');
  }
  lobbySettingsKey = key;
  notice.textContent = lobby.state !== 'LOBBY'
    ? 'Während der Runde sind die Einstellungen gesperrt.'
    : settings?.revision > 0
      ? 'Einstellungen geändert – bitte prüfen und erneut bereit melden.'
      : host ? 'Als Host kannst du die Lobby vor dem Start anpassen.' : 'Der Host kann diese Einstellungen vor dem Start ändern.';
  document.getElementById('saveLobbySettings').disabled = lobbySettingsSaving;
}
function fillLobbySettings() {
  const lobby = state?.lobby;
  if (!lobby?.settings) return;
  const fields = { editLobbyName: lobby.name, editLobbyVisibility: lobby.visibility,
    editLobbyRadius: lobby.settings.radius, editLobbyDuration: lobby.settings.duration / 60,
    editLobbyHeadstart: lobby.settings.headstart };
  for (const [id, value] of Object.entries(fields)) document.getElementById(id).value = value;
  document.getElementById('lobbySettingsForm').dataset.revision = lobby.settings.revision;
  document.getElementById('lobbySettingsError').textContent = '';
}
async function saveLobbySettings(event) {
  event.preventDefault();
  if (lobbySettingsSaving || !state?.lobby) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  lobbySettingsSaving = true;
  document.getElementById('saveLobbySettings').disabled = true;
  const value = id => document.getElementById(id).value;
  try {
    await api('settings', gameCredentials({
      revision: Number(form.dataset.revision), lobbyName: value('editLobbyName'),
      visibility: value('editLobbyVisibility'), radius: Number(value('editLobbyRadius')),
      duration: Number(value('editLobbyDuration')) * 60, headstart: Number(value('editLobbyHeadstart'))
    }));
    document.getElementById('lobbySettingsEditor').open = false;
    toast('Lobby gespeichert. Alle Spieler müssen sich erneut bereit melden.');
    await poll();
  } catch (error) {
    document.getElementById('lobbySettingsError').textContent = error.message;
  } finally {
    lobbySettingsSaving = false;
    document.getElementById('saveLobbySettings').disabled = false;
  }
}


// Kleine Spielradien auch im bestehenden Formular zur Lobby-Erstellung anbieten.
function addSmallLobbyRadii() {
  const select = document.getElementById('radius');
  if (!select) return;
  const selected = select.value;
  for (const meters of [200, 300, 500]) {
    if ([...select.options].some(option => Number(option.value) === meters)) continue;
    const option = document.createElement('option');
    option.value = String(meters);
    option.textContent = `${meters} m`;
    const next = [...select.options].find(item => Number(item.value) > meters);
    select.insertBefore(option, next || null);
  }
  select.value = selected;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addSmallLobbyRadii, { once: true });
} else {
  addSmallLobbyRadii();
}


/* Eigene Fahrzeugfotos: verkleinert, ohne EXIF, nur lokal wie die Garage. */
function safeCarPhoto(value) {
  return typeof value === 'string' && value.length <= 250000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
}
function carPhotoMarkup(car) {
  return safeCarPhoto(car?.photo)
    ? `<img src="${car.photo}" alt="Foto von ${esc(`${car.brand} ${car.model}`)}" style="display:block;width:100%;max-height:240px;object-fit:contain;border-radius:12px">`
    : '<div style="font-size:72px;text-align:center" aria-label="Fahrzeug-Platzhalter">🚘</div>';
}
async function shrinkCarPhoto(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Bitte JPG, PNG oder WebP wählen. iPhone-HEIC-Fotos vorher als JPG exportieren.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Bitte ein Foto unter 15 MB wählen.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.')); img.src = url; });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#202a34'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(img,0,0,canvas.width,canvas.height);
    let result = canvas.toDataURL('image/jpeg', 0.72);
    if (result.length > 250000) result = canvas.toDataURL('image/jpeg', 0.45);
    if (!safeCarPhoto(result)) throw new Error('Dieses Foto ist zu groß. Bitte einen kleineren Ausschnitt wählen.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
function resetCarPhotoInput() {
  const input = document.getElementById('newCarPhoto');
  if (input) input.value = '';
  const preview = document.getElementById('newCarPhotoPreview');
  if (preview) preview.replaceChildren();
}
function setupCarPhotoInput() {
  if (document.getElementById('newCarPhoto')) return;
  const box = document.createElement('div');
  box.innerHTML = `<label>EIGENES AUTOFOTO (OPTIONAL)<input id="newCarPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="newCarPhotoPreview"></div><button type="button" id="clearNewCarPhoto" class="textButton">FOTO ENTFERNEN</button><p class="muted">Foto und Garage bleiben in diesem Browser. Nutze eigene Bilder oder Bilder, die du verwenden darfst.</p>`;
  document.getElementById('saveCar').before(box);
  document.getElementById('clearNewCarPhoto').addEventListener('click', () => { if (!carPhotoBusy) { pendingCarPhoto = ''; resetCarPhotoInput(); } });
  document.getElementById('newCarPhoto').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    carPhotoBusy = true; event.target.disabled = true;
    try {
      pendingCarPhoto = await shrinkCarPhoto(file);
      document.getElementById('newCarPhotoPreview').innerHTML = carPhotoMarkup({photo:pendingCarPhoto,brand:'Dein',model:'Fahrzeug'});
    } catch(error) { toast(error.message); }
    finally { carPhotoBusy = false; event.target.disabled = false; }
  });
}
document.getElementById('garageCars')?.addEventListener('change', async event => {
  const input = event.target.closest('[data-car-photo]'); if (!input?.files[0]) return;
  const car = localGarage.find(item => item.id === input.dataset.carPhoto); if (!car) return;
  input.disabled = true;
  const oldPhoto = car.photo;
  try {
    const photo = await shrinkCarPhoto(input.files[0]);
    car.photo = photo;
    try { saveGarage(); } catch { car.photo = oldPhoto; throw new Error('Speicher voll. Bitte ein anderes Foto entfernen.'); }
    syncVehicleUI(); toast('Fahrzeugfoto gespeichert.');
  } catch(error) { toast(error.message); }
  finally { input.disabled = false; input.value = ''; }
});
document.getElementById('garageCars')?.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-photo]'); if (!button) return;
  const car = localGarage.find(item => item.id === button.dataset.removePhoto); if (!car) return;
  const oldPhoto = car.photo; delete car.photo;
  try { saveGarage(); syncVehicleUI(); } catch { car.photo = oldPhoto; toast('Foto konnte nicht entfernt werden.'); }
});

/* Profil bearbeiten und gespeicherte Statistiken anzeigen. */
function profileImageSource(value) {
  if (safeCarPhoto(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
}
function paintProfileAvatars() {
  for (const id of ['headerAvatar', 'profileAvatar']) {
    const element = document.getElementById(id);
    if (!element) continue;
    const badge = id === 'profileAvatar' ? document.getElementById('profileLevelBadge') : null;
    element.replaceChildren();
    element.append(document.createTextNode(initials(dbProfile?.username || 'Spieler')));
    const src = profileImageSource(dbProfile?.avatar_url);
    if (src) {
      element.replaceChildren();
      const image = document.createElement('img');
      image.src = src; image.alt = 'Dein Profilbild'; image.referrerPolicy = 'no-referrer';
      image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';
      image.onerror = () => { image.remove(); element.prepend(document.createTextNode(initials(dbProfile?.username || 'Spieler'))); };
      element.append(image);
    }
    if (badge) element.append(badge);
  }
}
function makeProfileDialog(id, title) {
  let dialog = document.getElementById(id);
  if (dialog) return dialog;
  dialog = document.createElement('dialog'); dialog.id = id;
  dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:min(94vw,520px);max-height:88dvh;overflow:auto;background:#202c36;color:#f5f7fa;border:1px solid #74828b;border-radius:16px;padding:22px;box-sizing:border-box;z-index:10000';
  const heading = document.createElement('h2'); heading.textContent = title;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'SCHLIESSEN ×';
  close.style.cssText = 'float:right;padding:8px;color:white;background:#394957;border:0;border-radius:8px';
  close.addEventListener('click', () => { if (!dialog._busy) dialog.close(); });
  dialog.append(close, heading); document.body.append(dialog);
  return dialog;
}
function openProfileEditor() {
  if (!dbProfile || !authSession?.user) { toast('Bitte warten, bis dein Profil geladen wurde.'); return; }
  const dialog = makeProfileDialog('profileEditDialog', 'PROFIL BEARBEITEN');
  if (!dialog.querySelector('form')) {
    const form = document.createElement('form');
    form.innerHTML = `<label>SPIELERNAME<input name="username" minlength="2" maxlength="24" required autocomplete="nickname"></label>
      <label>PROFILBILD<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <div data-avatar-preview style="width:96px;height:96px;border-radius:50%;overflow:hidden;margin:12px auto;background:#344553;display:grid;place-items:center"></div>
      <button type="button" data-remove-avatar class="textButton">BILD ENTFERNEN</button>
      <p class="muted">Name und Profilbild werden in deinem Konto gespeichert. JPG, PNG oder WebP, maximal 15 MB.</p>
      <p data-profile-error role="alert" style="color:#ffbca4;white-space:pre-wrap"></p>
      <button type="submit" class="primaryButton">ÄNDERUNGEN SPEICHERN</button>`;
    dialog.append(form);
    form.elements.photo.addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file || dialog._busy) return;
      dialog._busy = true; setProfileFormBusy(form, true);
      try {
        dialog._photo = await shrinkCarPhoto(file);
        renderProfilePreview(dialog, dialog._photo);
        form.querySelector('[data-profile-error]').textContent = '';
      } catch(error) { form.querySelector('[data-profile-error]').textContent = error.message; }
      finally { dialog._busy = false; setProfileFormBusy(form, false); }
    });
    form.querySelector('[data-remove-avatar]').addEventListener('click', () => {
      dialog._photo = null; form.elements.photo.value = ''; renderProfilePreview(dialog, null);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (dialog._busy || !form.reportValidity()) return;
      const name = form.elements.username.value.trim();
      const errorNode = form.querySelector('[data-profile-error]');
      if (name.length < 2 || name.length > 24 || /[\x00-\x1f\x7f]/.test(name)) { errorNode.textContent = 'Bitte einen Namen mit 2 bis 24 Zeichen eingeben.'; return; }
      const userId = authSession?.user?.id;
      if (!userId || userId !== dialog._userId) { errorNode.textContent = 'Konto gewechselt. Bitte den Profil-Editor erneut öffnen.'; return; }
      dialog._busy = true; setProfileFormBusy(form, true); errorNode.textContent = 'Wird gespeichert…';
      try {
        const { data, error } = await supabaseClient.rpc('chs_update_my_profile', {p_username: name, p_avatar: dialog._photo});
        if (error) throw new Error(error.code === 'PGRST202' ? 'Bitte zuerst den neuen Profil-SQL-Code einmal in Supabase ausführen.' : error.message);
        if (authSession?.user?.id !== userId) return;
        if (!data || typeof data.username !== 'string') throw new Error('Unerwartete Serverantwort. Bitte neu laden.');
        dbProfile = {...dbProfile, username:data.username, avatar_url:data.avatar_url};
        renderProfile(); dialog.close(); toast('Profil gespeichert.');
      } catch(error) { errorNode.textContent = error.message; }
      finally { dialog._busy = false; setProfileFormBusy(form, false); }
    });
    dialog.addEventListener('cancel', event => { if (dialog._busy) event.preventDefault(); });
  }
  if (dialog._busy) return;
  const form = dialog.querySelector('form');
  dialog._userId = authSession.user.id; dialog._photo = '__KEEP__';
  form.elements.username.value = dbProfile.username || '';
  form.elements.photo.value = '';
  form.querySelector('[data-profile-error]').textContent = '';
  renderProfilePreview(dialog, dbProfile.avatar_url);
  if (!dialog.open) dialog.showModal();
  form.elements.username.focus();
}
function setProfileFormBusy(form, busy) {
  for (const control of form.querySelectorAll('input,button')) control.disabled = busy;
}
function renderProfilePreview(dialog, source) {
  const preview = dialog.querySelector('[data-avatar-preview]'); preview.replaceChildren();
  const src = profileImageSource(source);
  if (src) {
    const image = document.createElement('img'); image.src = src; image.alt = 'Profilbild-Vorschau'; image.referrerPolicy = 'no-referrer';
    image.style.cssText = 'width:100%;height:100%;object-fit:cover'; preview.append(image);
  } else preview.textContent = initials(dialog.querySelector('form').elements.username.value || 'Spieler');
}
function openProfileStatistics() {
  if (!dbProfile) { toast('Profil wird noch geladen.'); return; }
  const dialog = makeProfileDialog('profileStatsDialog', 'DEINE STATISTIKEN');
  let body = dialog.querySelector('[data-stats]');
  if (!body) { body = document.createElement('div'); body.dataset.stats = ''; dialog.append(body); }
  body.replaceChildren();
  const number = key => Math.max(0, Number(dbProfile[key]) || 0);
  const rounds = number('rounds_played');
  const rows = [['Runden',rounds],['Siege',number('wins')],['Funde',number('finds')],['Überlebte Runden',number('survived_rounds')],['Siegquote',rounds ? Math.round(number('wins') / rounds * 100) + '%' : '0%'],['Level',Math.max(1,number('level'))],['XP',number('xp').toLocaleString('de-DE')]];
  for (const [label,value] of rows) {
    const row = document.createElement('p'); row.style.cssText = 'display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #53616b;padding:12px 0';
    const key = document.createElement('span'); key.textContent = label;
    const val = document.createElement('strong'); val.textContent = value; row.append(key,val); body.append(row);
  }
  const hint = document.createElement('p'); hint.textContent = 'Gespeicherte Kontowerte. Eine Liste einzelner vergangener Runden ist noch nicht vorhanden.'; body.append(hint);
  if (!dialog.open) dialog.showModal();
}
function setupProfileActions() {
  document.querySelector('#profile .settingsButton')?.addEventListener('click', openProfileEditor);
  document.querySelector('.profileMini')?.addEventListener('click', openProfileEditor);
  for (const row of document.querySelectorAll('#profile .menuRow')) {
    const title = row.querySelector('strong')?.textContent.trim();
    if (title === 'ACCOUNT') row.addEventListener('click', openProfileEditor);
    if (title === 'STATISTIKEN') row.addEventListener('click', openProfileStatistics);
  }
  for (const id of ['profileAvatar','profileName']) {
    const element = document.getElementById(id); if (!element) continue;
    element.tabIndex = 0; element.setAttribute('role','button'); element.setAttribute('aria-label','Profil bearbeiten'); element.style.cursor = 'pointer';
    element.addEventListener('click',openProfileEditor);
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openProfileEditor();}});
  }
}
setupProfileActions();

const freshLobbyStyle = document.createElement("style");
freshLobbyStyle.textContent = "/* Isoliert auf den Spielbildschirm und dessen Dialoge. */\n#game.freshLobby.active{display:flex;flex-direction:column;gap:18px;max-width:1120px;margin:auto;padding:22px 18px 40px;background:radial-gradient(ellipse at 20% 0%,#36305b88,transparent 55%),#121a28;color:#eef1ff;border-radius:24px;isolation:isolate}\n.freshLobbyTools{position:sticky;top:76px;z-index:20;background:#172135ed;backdrop-filter:blur(14px);padding:10px;border-radius:16px;order:0;display:flex;align-items:center;justify-content:space-between;gap:12px}\n.freshRoomLabel{font-size:11px;letter-spacing:2px;font-weight:800;color:#c1b9ed;display:flex;align-items:center;gap:8px}\n.freshLiveDot{width:8px;height:8px;background:#80e5ca;border-radius:50%;box-shadow:0 0 14px #80e5ca88}\n.freshToolButtons{display:flex;gap:8px}.freshToolButtons button{position:relative;padding:12px 16px;background:#29334a;border:1px solid #52617c;color:#f2f4ff;border-radius:14px;font-weight:800;min-height:46px;font-size:13px;cursor:pointer}.freshToolButtons button:disabled{opacity:.45;cursor:default}.freshToolButtons button[hidden]{display:none}\n#freshChatButton{background:#b7a4ff;color:#171329;border-color:#d1c5ff}#freshChatButton.hasUnread{box-shadow:0 0 0 3px #ff637144}\n#freshUnread{position:absolute;right:-7px;top:-9px;background:#fb4f67;border:3px solid #172132;min-width:25px;height:25px;display:grid;place-items:center;border-radius:20px;font-size:11px;color:white;padding:0 4px}#freshUnread[hidden]{display:none}\n#game .freshRoomHeader{order:1;margin:0;background:linear-gradient(125deg,#354267,#272d48);border:1px solid #637193;border-radius:22px;padding:22px;box-shadow:0 16px 35px #070e1c33}\n#game .freshRoomHeader h2{font-size:clamp(24px,5vw,38px);letter-spacing:-1px;line-height:1.15;margin:8px 0;color:#fff;overflow-wrap:anywhere}\n#game .freshRoomHeader .sectionEyebrow{color:#9aebd8;letter-spacing:3px;font-size:10px}#game .freshRoomHeader .closeGame{background:#ffffff16;color:#fff;border:1px solid #ffffff38;border-radius:12px}\n#game .freshRoomHeader .codeBox{background:#172039;border:1px solid #7184ae55;display:flex;align-items:center;gap:12px;border-radius:14px;padding:14px 16px;margin:16px 0}\n#game .freshRoomHeader .codeBox strong{font-size:29px;letter-spacing:6px;color:#dddcff}.freshRoomHeader .copyIcon{display:none}.freshCopyButton{margin-left:auto;padding:10px 12px;background:#ffffff12;border:1px solid #8f9cb355;border-radius:10px;color:#eee;font-size:10px;font-weight:800}\n#game .freshRoomHeader .gameStats{background:none;margin:0;padding:0;border:0}#game .freshRoomHeader .gameStats span{color:#c3cde0;font-size:10px}#game .freshRoomHeader .gameStats strong{color:#fff;font-size:15px}\n#game .freshCrewBoard{order:4;margin:0;padding:22px;background:linear-gradient(165deg,#252e46,#1c263b);border:1px solid #52617b;border-radius:22px}#game.freshWaiting .freshCrewBoard{order:2}\n#game .freshCrewBoard .panelTitle{margin-bottom:20px}#game .freshCrewBoard .panelTitle h3{font-size:20px;letter-spacing:1px;color:#fff}#game .freshCrewBoard .panelTitle span{color:#abb8d3}#game .freshCrewBoard .panelTitle>div>span{font-size:10px;letter-spacing:3px}\n#game #players{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;align-items:stretch}\n.freshPlayerCard{position:relative;min-width:0;padding:14px 14px 12px;background:#172235;border:1px solid #56677f;border-radius:18px;text-align:center;box-shadow:0 8px 0 #101a2c;overflow:hidden}.freshPlayerCard.isYou{border:2px solid var(--crew-color)}.freshPlayerCard.isFound{opacity:.65}\n.freshPlayerTop{display:flex;justify-content:space-between;align-items:center;letter-spacing:1px;font-size:10px;font-weight:900;color:var(--crew-color)}.freshConnection{display:block;width:7px;height:7px;background:#e8ae67;border-radius:50%}.freshConnection.online{background:#8ee8c4}\n.freshAvatarStage{height:118px;position:relative;display:grid;place-items:center;margin:5px 0 10px}.freshAvatarOrb{z-index:1;display:grid;place-items:center;width:80px;height:83px;border-radius:30px 30px 26px 26px;background:var(--crew-color);color:#172039;border:3px solid #ffffff77;box-shadow:inset -7px -9px 0 #17203926,0 7px 0 #0b142a66;font-size:29px;font-weight:950;transform:rotate(-5deg)}.freshPlatform{position:absolute;bottom:5px;left:10%;width:80%;height:24px;border-radius:50%;background:#7084ab24;border:1px solid #8fa6d33d}\n.freshPlayerCard h3{margin:4px 0!important;font-size:16px!important;letter-spacing:0!important;color:#fff;overflow-wrap:anywhere}.freshPlayerCard h3 small{display:inline-block;margin-left:6px;color:var(--crew-color);font-size:9px}.freshVehicleName{font-size:12px;color:#d5def0;min-height:32px;margin:8px 0 3px;overflow-wrap:anywhere}.freshVehicleColor{font-size:10px;color:#a8b7d2;margin:0 0 12px}.freshPlayerStatus{font-size:10px;font-weight:900;letter-spacing:1px;background:#2d3a50;padding:8px 3px;border-radius:8px;color:#d1dcef}.isReady .freshPlayerStatus{background:#254e47;color:#a9f4d8}.freshGpsState{display:block;font-size:10px;color:#b7c7e1;margin-top:8px}\n.freshEmptySeat{min-height:265px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:2px dashed #576887;border-radius:18px;color:#b6c6e4;padding:15px}.freshEmptySeat>span{font-size:45px;color:#b4a6f3}.freshEmptySeat strong{font-size:10px;letter-spacing:1px}.freshEmptySeat p{font-size:12px;line-height:1.7}\n#game #ready{background:#3b4864;border:1px solid #8594af;color:#fff;border-radius:12px;padding:13px 18px;font-size:12px}#game #ready.active{background:#90e9ca;border-color:#90e9ca;color:#122a23}\n#game #start{background:#b6a3ff;color:#1b1533;border:0;border-radius:14px;padding:19px;font-size:15px;letter-spacing:1px;box-shadow:0 5px 0 #6652a4;margin-top:24px}#game #start:disabled{opacity:.5}\n.freshMapFold{order:3;border:1px solid #52617b;background:#1b263b;border-radius:18px;overflow:hidden}.freshMapFold>summary{padding:18px;color:#d7e2f7;font-weight:800;font-size:12px;letter-spacing:1px;cursor:pointer}.freshMapFold .radarCard{margin:0;border:0;border-radius:0;background:#1b263b}.freshMapFold .radar{display:none}#game.freshLobby #driverWarning{order:2}#game.freshLobby #targets{order:5}#game.freshLobby #result{order:6}\n.freshDialog{position:fixed;inset:0;margin:auto;width:min(94vw,580px);max-width:none;max-height:88dvh;padding:22px;color:#eef2ff;background:#202b42;border:1px solid #8899b6;border-radius:22px;box-shadow:0 30px 100px #0009;overflow:auto;box-sizing:border-box}.freshDialog::backdrop{background:#080e1bc9;backdrop-filter:blur(5px)}.freshDialogBar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.freshDialogBar h2{font-size:18px;letter-spacing:2px;margin:0}.freshDialogBar>button{width:40px;height:40px;border-radius:12px;color:white;background:#3c4a65;border:1px solid #7d8ca6;font-size:26px;cursor:pointer}.freshDialog input,.freshDialog select{background:#131f34;color:white;border:1px solid #7d8ca6;border-radius:11px;padding:13px}.freshDialog input::placeholder{color:#bcc8de}.freshDialog .muted{color:#bdc9de}.freshDialog #lobbySettingsPanel{background:none;border:0;margin:0;padding:0}.freshDialog .primaryButton{background:#b6a3ff;color:#19132c;border-radius:12px}.freshDialog .textButton{color:#d0c4ff}.freshDialog .lobbyChat{margin:0;padding:0;border:0}.freshDialog .lobbyChat>h3{display:none}\n#freshChatDialog{width:min(94vw,520px);height:min(720px,88dvh)}#freshChatDialog[open]{display:flex;flex-direction:column}#freshChatDialog .lobbyChat{display:flex;flex-direction:column;min-height:0;flex:1}#freshChatDialog .messageList{flex:1;min-height:120px;max-height:none;overflow-y:auto;background:#172237;border:1px solid #54617c;border-radius:14px;padding:12px}#freshChatDialog .message{max-width:92%;background:#354562;color:#f0f4ff;border-radius:14px;padding:12px;margin:8px 0;overflow-wrap:anywhere}#freshChatDialog .message.mine{background:#4b4370;margin-left:auto}#freshChatDialog .message small{color:#d3c8ff;display:block;font-size:10px;margin-bottom:5px}#freshChatDialog .message span{white-space:pre-wrap;font-size:14px}#freshChatDialog .messageForm{display:flex;gap:8px;margin-top:12px}#freshChatDialog .messageForm input{min-width:0;flex:1;margin:0}#freshChatDialog .messageForm button{background:#ad99f9;color:#19172c;border:0;border-radius:12px;padding:12px;font-size:11px;font-weight:900}\n.freshSrOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}.freshLobby button:focus-visible,.freshDialog button:focus-visible{outline:3px solid #83e8cd;outline-offset:3px}\n@media(min-width:850px){#game #players{grid-template-columns:repeat(4,minmax(0,1fr))}.freshAvatarStage{height:140px}.freshAvatarOrb{width:92px;height:95px}}\n@media(max-width:430px){#game.freshLobby.active{padding:14px 10px 30px;border-radius:0;gap:12px}.freshRoomLabel{font-size:9px;letter-spacing:1px}.freshToolButtons button{padding:10px;font-size:11px}.freshToolButtons{gap:6px}#game .freshCrewBoard{padding:14px}#game #players{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.freshPlayerCard{padding:10px 8px}.freshPlayerCard h3{font-size:14px!important}.freshAvatarStage{height:100px}.freshAvatarOrb{height:70px;width:67px;font-size:25px}#game .freshRoomHeader{padding:16px}.freshCopyButton{font-size:9px;padding:9px}#game .freshRoomHeader .codeBox strong{font-size:24px;letter-spacing:4px}.freshDialog{padding:16px}.freshDialog .settingsGrid{grid-template-columns:1fr}}\n";
document.head.append(freshLobbyStyle);

/* Lobby-Warteraum mit eigenem Chat-Fenster und Host-Einstellungen. */
const freshChatState = { code: null, seen: new Set(), unread: new Set() };
let freshLobbyPhase = null;
function freshDialog(id, title) {
  const dialog = document.createElement('dialog'); dialog.id = id; dialog.className = 'freshDialog';
  dialog.setAttribute('aria-label', title);
  const bar = document.createElement('div'); bar.className = 'freshDialogBar';
  const heading = document.createElement('h2'); heading.textContent = title;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','Schließen');
  close.addEventListener('click',()=>dialog.close()); bar.append(heading,close); dialog.append(bar);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  document.body.append(dialog); return dialog;
}
function ensureFreshLobby() {
  const game = document.getElementById('game');
  if (!game || document.getElementById('freshLobbyTools')) return;
  game.classList.add('freshLobby');
  const tools = document.createElement('div'); tools.id = 'freshLobbyTools'; tools.className = 'freshLobbyTools';
  tools.innerHTML = `<div class="freshRoomLabel"><span class="freshLiveDot"></span> <span id="freshRoomLabel">DEIN WARTERAUM</span></div>
    <div class="freshToolButtons"><button id="freshSettingsButton" type="button" aria-haspopup="dialog">⚙ <span>Einstellungen</span></button>
    <button id="freshChatButton" type="button" aria-haspopup="dialog" aria-label="Lobby-Chat öffnen">↗ <span>Chat</span><b id="freshUnread" hidden>0</b></button></div>`;
  game.prepend(tools);
  const announcement = document.createElement('span'); announcement.id='freshChatAnnouncement';announcement.className='freshSrOnly';announcement.setAttribute('aria-live','polite');tools.append(announcement);
  const board = document.getElementById('players')?.closest('section');
  if (board) { board.classList.add('freshCrewBoard'); }
  const header = game.querySelector('.gameHeaderCard'); header?.classList.add('freshRoomHeader');
  const copy = document.createElement('button');copy.className='freshCopyButton';copy.type='button';copy.textContent='CODE KOPIEREN';
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.lobby.code);toast('Lobby-Code kopiert.');}catch{toast('Dein Lobby-Code: '+(state?.lobby?.code||''));}});
  header?.querySelector('.codeBox')?.append(copy);
  const map = game.querySelector('.radarCard');
  if (map) {
    const fold = document.createElement('details'); fold.id='freshMapFold'; fold.className='freshMapFold';
    const summary=document.createElement('summary');summary.textContent='SPIELKARTE & GPS';fold.append(summary);map.before(fold);fold.append(map);
    fold.addEventListener('toggle',()=>{if(fold.open){window.chsMapUpdate?.(state);window.dispatchEvent(new Event('resize'));}});
  }
  const settingsDialog=freshDialog('freshSettingsDialog','LOBBY-EINSTELLUNGEN');
  const chatDialog=freshDialog('freshChatDialog','CREW-CHAT');
  const chat=game.querySelector('.lobbyChat'); if(chat)chatDialog.append(chat);
  chatDialog.addEventListener('close',()=>document.getElementById('freshChatButton')?.focus());
  document.getElementById('freshChatButton').addEventListener('click',()=>{
    if(!chatDialog.open)chatDialog.showModal();
    if(typeof renderLobbyChat==='function')renderLobbyChat();
    markFreshChatRead();
    const list=document.getElementById('lobbyMessages');if(list)list.scrollTop=list.scrollHeight;
    document.getElementById('lobbyChatInput')?.focus();
  });
  document.getElementById('freshSettingsButton').addEventListener('click',()=>{
    if(state?.lobby?.hostId!==state?.lobby?.me?.id||state?.lobby?.state!=='LOBBY')return;
    if(!settingsDialog.open)settingsDialog.showModal();
    const editor=document.getElementById('lobbySettingsEditor');if(editor){editor.open=true;fillLobbySettings();}
  });
  document.getElementById('cancelLobbySettings')?.addEventListener('click',()=>settingsDialog.close());
  const editor=document.getElementById('lobbySettingsEditor');
  if(editor)new MutationObserver(()=>{if(!editor.open&&settingsDialog.open)settingsDialog.close();}).observe(editor,{attributes:true,attributeFilter:['open']});
  new MutationObserver(()=>{
    if(!game.classList.contains('active')){chatDialog.close();settingsDialog.close();}
  }).observe(game,{attributes:true,attributeFilter:['class']});
  const readIfVisible=()=>{if(chatDialog.open&&document.visibilityState==='visible'&&document.hasFocus())markFreshChatRead();};
  window.addEventListener('focus',readIfVisible);document.addEventListener('visibilitychange',readIfVisible);
}
function markFreshChatRead() {
  freshChatState.unread.clear();
  for(const message of state?.chat||[])freshChatState.seen.add(message.id);
  paintFreshUnread();
}
function paintFreshUnread() {
  const count=freshChatState.unread.size;
  const badge=document.getElementById('freshUnread');if(!badge)return;
  badge.textContent=count>99?'99+':String(count);badge.hidden=!count;
  const button=document.getElementById('freshChatButton');
  button.classList.toggle('hasUnread',count>0);
  button.setAttribute('aria-label',count?`Lobby-Chat: ${count} ungelesene Nachrichten`:'Lobby-Chat öffnen');
  const announcement=document.getElementById('freshChatAnnouncement');
  const label=count?`${count} ungelesene Chat-Nachrichten`:'';
  if(announcement.textContent!==label)announcement.textContent=label;
}
function updateFreshChat() {
  if(!state?.lobby)return;
  const code=state.lobby.code, messages=state.chat||[], dialog=document.getElementById('freshChatDialog');
  if(freshChatState.code!==code){
    freshChatState.code=code;freshChatState.seen=new Set(messages.map(message=>message.id));freshChatState.unread.clear();
    dialog?.close();document.getElementById('freshSettingsDialog')?.close();
  }else{
    for(const message of messages){
      if(!freshChatState.seen.has(message.id)&&message.sender!==state.lobby.me.id)freshChatState.unread.add(message.id);
      freshChatState.seen.add(message.id);
    }
  }
  if(dialog?.open&&document.visibilityState==='visible'&&document.hasFocus())markFreshChatRead();
  else paintFreshUnread();
}
function freshPlayerColor(id) {
  const colors=['#ac98ff','#76e4cb','#ffb68b','#84bdff','#f7a1d4','#dfec8e'];
  let hash=0;for(const ch of String(id))hash=(hash*31+ch.charCodeAt(0))>>>0;
  return colors[hash%colors.length];
}
function renderFreshLobby() {
  if(!state?.lobby)return;
  ensureFreshLobby();
  const lobby=state.lobby, waiting=lobby.state==='LOBBY', host=lobby.hostId===lobby.me.id;
  const game=document.getElementById('game');game.classList.toggle('freshWaiting',waiting);
  document.getElementById('freshRoomLabel').textContent=waiting?'DEIN WARTERAUM':'DEINE CREW · LIVE';
  const settings=document.getElementById('lobbySettingsPanel');
  const settingsDialog=document.getElementById('freshSettingsDialog');
  if(settings&&settings.parentNode!==settingsDialog)settingsDialog.append(settings);
  const hostButton=document.getElementById('freshSettingsButton');hostButton.hidden=!host;hostButton.disabled=!waiting;
  hostButton.title=waiting?'Lobby anpassen':'Während der Runde gesperrt';
  if((!host||!waiting)&&settingsDialog.open)settingsDialog.close();
  const phase=lobby.code+':'+lobby.state;
  if(freshLobbyPhase!==phase){document.getElementById('freshMapFold').open=!waiting;freshLobbyPhase=phase;}
  const crew=document.getElementById('players');
  crew.innerHTML=lobby.players.map(player=>{
    const mine=player.id===lobby.me.id, owner=player.id===lobby.hostId;
    const status=player.found?'GEFUNDEN':!player.connected?'VERBINDUNG…':waiting?(player.ready?'BEREIT':'WARTET'):player.role==='SEEKER'?'SUCHER':'VERSTECKER';
    return `<article class="freshPlayerCard ${mine?'isYou':''} ${player.ready?'isReady':''} ${player.found?'isFound':''}" style="--crew-color:${freshPlayerColor(player.id)}">
      <div class="freshPlayerTop"><span>${owner?'♛ HOST':mine?'DU':'CREW'}</span><span class="freshConnection ${player.connected?'online':''}" aria-label="${player.connected?'Online':'Verbindung unterbrochen'}"></span></div>
      <div class="freshAvatarStage"><div class="freshAvatarOrb">${esc(initials(player.name))}</div><span class="freshPlatform"></span></div>
      <h3>${esc(player.name)}${mine?'<small>DU</small>':''}</h3>
      <p class="freshVehicleName">${esc(player.vehicle)}</p><p class="freshVehicleColor">${esc(player.color||'')} · Level ${Number(player.level)||1}</p>
      <div class="freshPlayerStatus">${player.ready||player.found?'✓ ':''}${status}</div>
      <small class="freshGpsState">${player.hasLocation?'● GPS bereit':'○ Warte auf GPS'}</small>
    </article>`;
  }).join('');
  if(waiting&&lobby.players.length<2)crew.insertAdjacentHTML('beforeend','<div class="freshEmptySeat"><span>＋</span><strong>PLATZ FÜR DEINE CREW</strong><p>Teile den Lobby-Code.<br>Ab 2 Spielern geht’s los.</p></div>');
  if(typeof renderLobbyChat==='function')renderLobbyChat();
  updateFreshChat();
}
