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

let state = null;
let pollTimer = null;
let watch = null;
let gpsStarting = false;


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

          <div class="garageVehicleVisual">
            🚘
          </div>

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

        </section>
      `)
      .join('');
}


function openCarModal() {
  $('#carModal')
    ?.classList.remove('hidden');
}


function closeCarModal() {
  $('#carModal')
    ?.classList.add('hidden');
}


function saveCar() {
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
    active: true
  });


  saveGarage();
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


/* =========================================================
   CREATE / JOIN
========================================================= */

async function create() {
  try {
    const result =
      await api(
        'create',
        {
          ...playerData(),

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


async function join() {
  const lobbyCode =
    ($('#code')?.value || '')
      .trim()
      .toUpperCase();


  if (!lobbyCode) {
    toast(
      'Bitte einen Lobby-Code eingeben.'
    );

    return;
  }


  try {
    const result =
      await api(
        'join',
        {
          ...playerData(),
          code: lobbyCode
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
          onclick="found('${player.id}')">

          🚘
          ${esc(player.vehicle)}
          ·
          ${esc(player.color)}

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
}


/* =========================================================
   GPS
========================================================= */

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

  $('#gps').textContent =
    'GPS WIRD ERMITTELT...';


  watch =
    navigator.geolocation.watchPosition(

      async position => {
        gpsStarting = false;


        try {
          await api(
            'location',
            gameCredentials({
              lat:
                position.coords.latitude,

              lng:
                position.coords.longitude,

              accuracy:
                position.coords.accuracy,

              altitude:
                position.coords.altitude,

              speed:
                position.coords.speed
            })
          );


          $('#gps').textContent =
            'GPS AKTIV ✓';


          $('#gpsDot')
            ?.classList.add(
              'on'
            );
        }

        catch (error) {
          console.error(
            'Standortübertragung fehlgeschlagen',
            error
          );
        }
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
    join
  );


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
