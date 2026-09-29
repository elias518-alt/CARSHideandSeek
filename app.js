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
let lobbyMissingPolls = 0;
let watch = null;
let gpsStarting = false;
let gpsHeartbeat = null;
let publicSearchBusy = false;
let publicSearchLastAt = 0;


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

  if (page === 'play') {
    setTimeout(() => {
      if (typeof findPublic === 'function') findPublic({ automatic: true });
    }, 120);
  }
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
    error.status = response.status;

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

async function findPublic(options = {}) {
  const list = $('#publicLobbies');
  if (!list || publicSearchBusy) return;

  const automatic = !!options.automatic;
  const now = Date.now();
  if (automatic && now - publicSearchLastAt < 12000 && list.children.length) return;

  publicSearchBusy = true;