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
let garageSyncBusy = false;
let gpsPhase = '';
let lastGpsRequestAt = 0;


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

function vehiclePhotoUrl(photoPath) {
  if (!photoPath) return '';
  const { data } = supabaseClient.storage
    .from('vehicle-images')
    .getPublicUrl(photoPath);
  return data?.publicUrl || '';
}

function vehiclePhotoSource(value) {
  if (safeCarPhoto(value)) return value;
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function cloudVehicleToLocal(row) {
  return {
    id: row.id,
    brand: row.brand || '',
    model: row.model || '',
    year: row.model_year ? String(row.model_year) : '',
    color: row.color || '',
    active: !!row.is_active || row.id === dbProfile?.active_vehicle_id,
    photoPath: row.photo_path || '',
    photo: row.photo_path ? vehiclePhotoUrl(row.photo_path) : ''
  };
}

async function uploadVehiclePhoto(vehicleId, dataUrl) {
  if (!authSession?.user?.id || !dataUrl) return '';
  const source = vehiclePhotoSource(dataUrl);
  if (!source.startsWith('data:image/')) {
    throw new Error('Ungültiges Fahrzeugbild.');
  }

  const blob = await (await fetch(source)).blob();
  if (blob.size > 2 * 1024 * 1024) {
    throw new Error('Das Fahrzeugbild ist nach der Verarbeitung zu groß.');
  }

  const extension = blob.type === 'image/png' ? 'png' : 'webp';
  const path = `${authSession.user.id}/${vehicleId}.${extension}`;

  const { error } = await supabaseClient.storage
    .from('vehicle-images')
    .upload(path, blob, {
      contentType: blob.type || 'image/webp',
      upsert: true,
      cacheControl: '3600'
    });

  if (error) throw error;
  return path;
}

async function activateCloudVehicle(vehicleId) {
  if (!authSession?.user?.id || garageSyncBusy) return;
  garageSyncBusy = true;

  const previous = localGarage.map(car => ({ ...car }));

  try {
    const userId = authSession.user.id;

    const { error: clearError } = await supabaseClient
      .from('vehicles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (clearError) throw clearError;

    const { error: activateError } = await supabaseClient
      .from('vehicles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)
      .eq('user_id', userId);
    if (activateError) throw activateError;

    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({ active_vehicle_id: vehicleId, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (profileError) throw profileError;

    if (dbProfile) dbProfile.active_vehicle_id = vehicleId;
    localGarage.forEach(car => { car.active = car.id === vehicleId; });
    saveGarage();
    syncVehicleUI();
    toast('Aktives Fahrzeug geändert ✓');
  } catch (error) {
    localGarage = previous;
    saveGarage();
    syncVehicleUI();
    toast(error.message || 'Fahrzeug konnte nicht aktiviert werden.');
  } finally {
    garageSyncBusy = false;
  }
}

async function importLegacyGarage() {
  if (!authSession?.user?.id || !localGarage.length) return false;
  const userId = authSession.user.id;
  const legacy = localGarage.map(car => ({ ...car }));
  let activeId = '';

  for (const [index, car] of legacy.entries()) {
    const vehicleId = crypto.randomUUID();
    const isActive = car.active || (!legacy.some(item => item.active) && index === 0);

    const { error: insertError } = await supabaseClient
      .from('vehicles')
      .insert({
        id: vehicleId,
        user_id: userId,
        brand: String(car.brand || '').slice(0, 60),
        model: String(car.model || '').slice(0, 80),
        model_year: Number(car.year) || null,
        color: String(car.color || '').slice(0, 40),
        is_active: false
      });
    if (insertError) throw insertError;

    let photoPath = '';
    if (safeCarPhoto(car.photo)) {
      try {
        photoPath = await uploadVehiclePhoto(vehicleId, car.photo);
        const { error: photoError } = await supabaseClient
          .from('vehicles')
          .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
          .eq('id', vehicleId)
          .eq('user_id', userId);
        if (photoError) throw photoError;
      } catch (error) {
        console.error('Altes Fahrzeugfoto konnte nicht migriert werden:', error);
      }
    }

    if (isActive) activeId = vehicleId;
  }

  if (activeId) {
    await activateCloudVehicle(activeId);
  }

  return true;
}

async function loadCloudGarage({ migrateLocal = true } = {}) {
  if (!authSession?.user?.id || garageSyncBusy) return;
  garageSyncBusy = true;

  try {
    const userId = authSession.user.id;
    let { data, error } = await supabaseClient
      .from('vehicles')
      .select('id,user_id,brand,model,model_year,color,is_active,photo_path,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!data?.length && migrateLocal && localGarage.length) {
      garageSyncBusy = false;
      await importLegacyGarage();
      return loadCloudGarage({ migrateLocal: false });
    }

    localGarage = (data || []).map(cloudVehicleToLocal);

    const profileActive = dbProfile?.active_vehicle_id;
    if (profileActive && localGarage.some(car => car.id === profileActive)) {
      localGarage.forEach(car => { car.active = car.id === profileActive; });
    } else if (localGarage.length && !localGarage.some(car => car.active)) {
      localGarage[0].active = true;
    }

    saveGarage();
    syncVehicleUI();
  } catch (error) {
    console.error('Cloud-Garage konnte nicht geladen werden:', error);
    toast('Garage konnte nicht synchronisiert werden. Lokale Daten bleiben erhalten.');
    syncVehicleUI();
  } finally {
    garageSyncBusy = false;
  }
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

    await migrateLegacyProfileAvatar();
    await loadCloudGarage();


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
          ${vehiclePhotoSource(car.photo) ? `<button type="button" class="textButton" data-remove-photo="${esc(car.id)}">FOTO ENTFERNEN</button>` : ''}


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


async function saveCar() {
  if (carPhotoBusy || garageSyncBusy) {
    toast('Bitte kurz warten, die Garage wird noch synchronisiert.');
    return;
  }

  const brand = $('#newCarBrand')?.value.trim();
  const model = $('#newCarModel')?.value.trim();
  const year = $('#newCarYear')?.value.trim();
  const color = $('#newCarColor')?.value.trim();

  if (!brand || !model || !color) {
    toast('Bitte Marke, Modell und Farbe angeben.');
    return;
  }

  if (!authSession?.user?.id) {
    toast('Bitte erneut anmelden.');
    return;
  }

  garageSyncBusy = true;
  const userId = authSession.user.id;
  const vehicleId = crypto.randomUUID();
  let uploadedPath = '';

  try {
    const { error: insertError } = await supabaseClient
      .from('vehicles')
      .insert({
        id: vehicleId,
        user_id: userId,
        brand: brand.slice(0, 60),
        model: model.slice(0, 80),
        model_year: Number(year) || null,
        color: color.slice(0, 40),
        is_active: false
      });
    if (insertError) throw insertError;

    if (pendingCarPhoto) {
      uploadedPath = await uploadVehiclePhoto(vehicleId, pendingCarPhoto);
      const { error: photoError } = await supabaseClient
        .from('vehicles')
        .update({ photo_path: uploadedPath, updated_at: new Date().toISOString() })
        .eq('id', vehicleId)
        .eq('user_id', userId);
      if (photoError) throw photoError;
    }

    garageSyncBusy = false;
    await activateCloudVehicle(vehicleId);
    await loadCloudGarage({ migrateLocal: false });

    pendingCarPhoto = '';
    resetCarPhotoInput();
    closeCarModal();

    $('#newCarBrand').value = '';
    $('#newCarModel').value = '';
    $('#newCarYear').value = '';
    $('#newCarColor').value = '';

    toast('Fahrzeug im Konto gespeichert ✓');
  } catch (error) {
    if (uploadedPath) {
      try {
        await supabaseClient.storage.from('vehicle-images').remove([uploadedPath]);
      } catch {}
    }
    try {
      await supabaseClient.from('vehicles').delete().eq('id', vehicleId).eq('user_id', userId);
    } catch {}
    toast(error.message || 'Fahrzeug konnte nicht gespeichert werden.');
  } finally {
    garageSyncBusy = false;
  }
}


/* =========================================================
   GAME API
========================================================= */

async function api(
  path,
  data = {},
  method = 'POST',
  signal
) {
  let url =
    `/api/${path}`;

  const options = {
    method,
    signal,

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

    photoUrl:
      vehiclePhotoSource(car.photo),

    avatarUrl:
      profileImageSource(dbProfile.avatar_url),

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
        if (position.coords.accuracy > 200) {
          reject(new Error('Standort ist zu ungenau. Bitte kurz erneut versuchen.'));
          return;
        }
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => reject(new Error('Standort freigeben, um öffentliche Runden zu finden.')),
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 }
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
  publicSearchLastAt = now;
  const button = $('#findPublic');
  if (button) button.disabled = true;
  list.innerHTML = '<div class="publicLobbyLoading"><span></span> Offene Lobbys werden gesucht…</div>';

  try {
    const position = await currentPosition();
    const result = await api('public', position, 'GET');
    list.innerHTML = result.lobbies.length
      ? result.lobbies.map(lobby => `
          <button class="publicLobby" type="button" data-public-code="${esc(lobby.code)}">
            <span class="publicLobbyLive">OFFEN</span>
            <strong>${esc(lobby.name)}</strong>
            <small>${lobby.players}/${lobby.maxPlayers} Spieler · ca. ${lobby.distanceKm} km entfernt</small>
            <b>BEITRETEN ›</b>
          </button>`).join('')
      : '<div class="publicLobbyEmpty"><strong>Keine offene Lobby in deiner Nähe</strong><span>Du kannst unten selbst eine Lobby erstellen oder per Code beitreten.</span></div>';
  } catch (error) {
    list.innerHTML = `<div class="publicLobbyEmpty"><strong>Öffentliche Lobbys konnten nicht geladen werden</strong><span>${esc(error.message)}</span></div>`;
  } finally {
    publicSearchBusy = false;
    if (button) { button.disabled = false; button.textContent = 'AKTUALISIEREN'; }
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
    const info = await api('lobby-info', { code: lobbyCode }, 'GET');
    const location = info.visibility === 'PUBLIC' ? await currentPosition() : {};
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
    if (!gpsStarting) {
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

    lobbyMissingPolls = 0;
    renderGame();
  }

  catch (error) {
    console.error(error);


    const lobbyGone =
      error.status === 404 ||
      error.status === 403 ||
      error.message.includes('Lobby nicht gefunden') ||
      error.message.includes('Session nicht gefunden');

    if (lobbyGone) {
      lobbyMissingPolls += 1;
      if (lobbyMissingPolls >= 4) {
        toast('Die Lobby ist serverseitig nicht mehr verfügbar.');
        setTimeout(resetGame, 1200);
        return;
      }
    } else {
      lobbyMissingPolls = 0;
      // Bei kurzen Render-/Netzwerk-Aussetzern bleibt die Lobby geöffnet.
      if (error.status && error.status < 500) toast(error.message);
    }
  }


  const pollDelay =
    state?.lobby?.state === 'LOBBY'
      ? 3000
      : state?.lobby?.state === 'RESULT'
        ? 5000
        : 1000;

  pollTimer =
    setTimeout(
      poll,
      pollDelay
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
            ${profileImageSource(player.avatarUrl)
              ? `<img src="${esc(profileImageSource(player.avatarUrl))}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
              : esc(initials(player.name))}
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


  renderFindButtons(targets);

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
  syncGpsForLobbyState();

  const mapFold = document.getElementById('freshMapFold');
  if (lobby.state !== 'LOBBY' || mapFold?.open) {
    window.chsMapUpdate?.(state);
  }
}


/* =========================================================
   GPS — ADAPTIV / AKKUSCHONEND
========================================================= */

function gpsConfigForState() {
  const phase = state?.lobby?.state || 'LOBBY';

  if (phase === 'ACTIVE' || phase === 'HEADSTART') {
    return {
      phase: 'ACTIVE',
      interval: 6000,
      options: {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 10000
      }
    };
  }

  if (phase === 'COUNTDOWN') {
    return {
      phase: 'COUNTDOWN',
      interval: 10000,
      options: {
        enableHighAccuracy: false,
        maximumAge: 5000,
        timeout: 10000
      }
    };
  }

  if (phase === 'RESULT') {
    return {
      phase: 'RESULT',
      interval: 60000,
      options: {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000
      }
    };
  }

  return {
    phase: 'LOBBY',
    interval: 30000,
    options: {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 10000
    }
  };
}

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

    const lobbyMode = state?.lobby?.state === 'LOBBY';
    $('#gps').textContent = lobbyMode ? 'GPS BEREIT ✓' : 'GPS AKTIV ✓';
    $('#gpsDot')?.classList.add('on');
  } catch (error) {
    console.error('Standortübertragung fehlgeschlagen', error);
  }
}

function requestGpsPosition({ force = false } = {}) {
  if (!navigator.geolocation || !gameSession || gpsStarting) return;

  const config = gpsConfigForState();
  const now = Date.now();

  if (!force && now - lastGpsRequestAt < Math.max(3000, config.interval - 1000)) {
    return;
  }

  gpsStarting = true;
  lastGpsRequestAt = now;

  navigator.geolocation.getCurrentPosition(
    position => {
      gpsStarting = false;
      sendGameLocation(position);
    },
    error => {
      gpsStarting = false;
      console.error('GPS:', error);

      if (error.code === 1) {
        $('#gps').textContent = 'GPS FREIGEBEN';
      } else {
        $('#gps').textContent = 'GPS ERNEUT VERSUCHEN';
      }
    },
    config.options
  );
}

function startGpsSchedule({ force = false } = {}) {
  if (!navigator.geolocation) {
    toast('Dieses Gerät unterstützt keine Standortabfrage.');
    return;
  }

  const config = gpsConfigForState();

  if (gpsPhase === config.phase && gpsHeartbeat !== null && !force) {
    return;
  }

  clearInterval(gpsHeartbeat);
  gpsHeartbeat = null;
  gpsPhase = config.phase;

  requestGpsPosition({ force: true });

  if (config.phase !== 'RESULT') {
    gpsHeartbeat = setInterval(
      () => {
        if (document.visibilityState === 'visible' && gameSession) {
          requestGpsPosition();
        }
      },
      config.interval
    );
  }
}

function syncGpsForLobbyState() {
  if (!gameSession) return;
  startGpsSchedule();
}

function gps() {
  startGpsSchedule({ force: true });
}

/* =========================================================
   GAME ACTIONS
========================================================= */

let readyBusy = false;

async function ready() {
  if (readyBusy || !state?.lobby?.me) {
    return;
  }

  const button = document.getElementById('ready');
  readyBusy = true;
  if (button) button.disabled = true;

  try {
    await api(
      'ready',
      gameCredentials({
        ready:
          !state.lobby.me.ready
      })
    );

    await poll();
  }

  catch (error) {
    toast(
      error.message
    );
  }

  finally {
    readyBusy = false;
    if (button) button.disabled = false;
  }
}


async function start() {
  if (
    !state?.lobby?.me?.hasLocation
  ) {
    toast(
      'Aktuelle Position wird noch ermittelt.'
    );


    gps();

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


let findPending = false;

function renderFindButtons(targets) {
  const container = $('#targetButtons');
  const ids = new Set(targets.map(player => player.id));
  for (const button of [...container.children]) {
    if (!ids.has(button.dataset.targetId)) button.remove();
  }
  for (const player of targets) {
    let button = [...container.children].find(item => item.dataset.targetId === player.id);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.targetId = player.id;
      button.setAttribute('aria-describedby', 'findFeedback');
      button.addEventListener('click', () => found(player.id));
      container.append(button);
    }
    const nearby = state.nearbyTargets?.includes(player.id);
    const label = 'Fund melden · ' + player.vehicle + ' · ' + player.color;
    if (button.textContent !== label) button.textContent = label;
    button.classList.toggle('findReady', !!nearby);
    button.disabled = findPending;
  }
}

async function found(targetId) {
  if (findPending) return;
  const feedback = $('#findFeedback');
  if (state?.lobby?.state !== 'ACTIVE' || state.lobby.me.role !== 'SEEKER') {
    feedback.textContent = 'Ein Fund ist nur während der Suche als Sucher möglich.';
    return;
  }
  findPending = true;
  feedback.textContent = 'Fund wird geprüft …';
  feedback.dataset.status = 'pending';
  $('#targetButtons').setAttribute('aria-busy', 'true');
  for (const button of $('#targetButtons').children) button.disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await api('found', gameCredentials({ targetId }), 'POST', controller.signal);
    feedback.textContent = '✓ Fund bestätigt · ' + result.distance + ' m';
    feedback.dataset.status = 'success';
    toast(feedback.textContent);
  } catch (error) {
    feedback.textContent = controller.signal.aborted
      ? 'Keine Antwort vom Server. Prüfe deine Verbindung. Der Rundenstatus wird erneut geladen.'
      : error.message + (error.data?.distance != null ? ' · ' + error.data.distance + ' m' : '');
    feedback.dataset.status = 'error';
    toast(feedback.textContent);
  } finally {
    clearTimeout(timeout);
    findPending = false;
    $('#targetButtons').setAttribute('aria-busy', 'false');
    for (const button of $('#targetButtons').children) button.disabled = false;
    poll();
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


let leaveBusy = false;

async function leave() {
  if (leaveBusy || !gameSession) return;
  leaveBusy = true;

  const credentials = gameCredentials();

  /*
    Die Lobby wird lokal sofort verlassen. So fühlt sich das X auch bei
    langsamer Mobilfunk-/Render-Verbindung unmittelbar an. Der Server wird
    danach im Hintergrund aufgeräumt.
  */
  resetGame();
  leaveBusy = false;

  try {
    await api('leave', credentials);
  } catch (error) {
    console.error('Lobby konnte serverseitig nicht sofort verlassen werden:', error);
  }
}


function resetGame() {
  const inviteDialog = document.getElementById('lobbyInviteDialog');
  const settingsDialog = document.getElementById('freshSettingsDialog');
  if (inviteDialog?.open) inviteDialog.close();
  if (settingsDialog?.open) settingsDialog.close();

  const mapFold = document.getElementById('freshMapFold');
  if (mapFold) mapFold.open = false;

  const chatDrawer = document.getElementById('freshChatDrawer');
  chatDrawer?.classList.remove('open');
  chatDrawer?.setAttribute('aria-hidden', 'true');
  chatDrawer?.setAttribute('inert', '');
  chatDrawer?.style.setProperty('pointer-events', 'none', 'important');
  chatDrawer?.style.setProperty('display', 'none', 'important');

  document.querySelectorAll('#freshChatBackdrop').forEach(element => element.remove());
  document.body.classList.remove('freshChatOpen');
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
  gpsPhase = '';
  lastGpsRequestAt = 0;
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
    event => {
      event.preventDefault();
      event.stopPropagation();
      leave();
    }
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
  activateCloudVehicle(button.dataset.carId);
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


/* Host-Einstellungen – passend zur neuen Fresh-Lobby in index.html. */
let lobbySettingsKey = '';
let lobbySettingsSaving = false;
let lobbySettingsBound = false;

function renderLobbySettings() {
  const lobby = state?.lobby;
  if (!lobby?.me) return;

  const panel = document.getElementById('lobbySettingsPanel');
  const dialog = document.getElementById('freshSettingsDialog');
  const button = document.getElementById('freshSettingsButton');
  if (!panel || !dialog) return;

  const host = lobby.hostId === lobby.me.id;
  const waiting = lobby.state === 'LOBBY';
  const settings = lobby.settings;

  if (button) {
    button.hidden = !host;
    button.disabled = !waiting || !settings || lobbySettingsSaving;
    button.title = !host ? 'Nur der Host kann die Lobby anpassen.' : waiting ? 'Lobby anpassen' : 'Während der Runde gesperrt';
  }

  if ((!host || !waiting) && dialog.open) dialog.close();

  if (settings) fillLobbySettings();

  const key = `${lobby.code}:${settings?.revision || 0}:${lobby.hostId}`;
  if (lobbySettingsKey && lobbySettingsKey !== key && dialog.open) {
    dialog.close();
    toast('Lobby-Einstellungen aktualisiert.');
  }
  lobbySettingsKey = key;

  if (!lobbySettingsBound) {
    lobbySettingsBound = true;
    ['lobbyRadius', 'lobbyDuration', 'lobbyHeadstart', 'lobbyEscape'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', saveFreshLobbySettings);
    });
  }
}

function fillLobbySettings() {
  const lobby = state?.lobby;
  const settings = lobby?.settings;
  if (!settings) return;

  const values = {
    lobbyRadius: settings.radius,
    lobbyDuration: settings.duration,
    lobbyHeadstart: settings.headstart,
    lobbyEscape: settings.escape ?? settings.escapeWindow ?? 15
  };

  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (field && value != null && [...field.options].some(option => String(option.value) === String(value))) {
      field.value = String(value);
    }
  }
}

async function saveFreshLobbySettings() {
  const lobby = state?.lobby;
  if (lobbySettingsSaving || !lobby?.settings) return;
  if (lobby.hostId !== lobby.me?.id || lobby.state !== 'LOBBY') return;

  const value = id => document.getElementById(id)?.value;
  lobbySettingsSaving = true;
  const button = document.getElementById('freshSettingsButton');
  if (button) button.disabled = true;

  try {
    await api('settings', gameCredentials({
      revision: Number(lobby.settings.revision || 0),
      lobbyName: lobby.name,
      visibility: lobby.visibility,
      radius: Number(value('lobbyRadius') || lobby.settings.radius),
      duration: Number(value('lobbyDuration') || lobby.settings.duration),
      headstart: Number(value('lobbyHeadstart') || lobby.settings.headstart),
      escape: Number(value('lobbyEscape') || lobby.settings.escape || 15)
    }));
    toast('Lobby-Einstellungen gespeichert.');
    await poll();
  } catch (error) {
    toast(error.message || 'Einstellungen konnten nicht gespeichert werden.');
    fillLobbySettings();
  } finally {
    lobbySettingsSaving = false;
    if (button) button.disabled = false;
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


/* Eigene Fahrzeugfotos: KI-Freistellung direkt im Browser. */
function safeCarPhoto(value) {
  return typeof value === 'string' && value.length <= 900000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}
function carPhotoMarkup(car) {
  const source = vehiclePhotoSource(car?.photo);
  return source
    ? `<img src="${esc(source)}" alt="Foto von ${esc(`${car?.brand || ''} ${car?.model || ''}`.trim())}" style="display:block;width:100%;max-height:240px;object-fit:contain" loading="lazy" decoding="async">`
    : '<div style="font-size:72px;text-align:center" aria-label="Fahrzeug-Platzhalter">🚘</div>';
}
async function loadImageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      img.src = url;
    });
    return img;
  } finally {
    // Safari benötigt die URL bis nach img.onload; danach kann sie weg.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
function cropTransparentVehicle(img) {
  const source = document.createElement('canvas');
  source.width = img.naturalWidth || img.width;
  source.height = img.naturalHeight || img.height;
  const sx = source.getContext('2d', { willReadFrequently: true });
  sx.clearRect(0, 0, source.width, source.height);
  sx.drawImage(img, 0, 0);
  const pixels = sx.getImageData(0, 0, source.width, source.height);
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels.data[(y * source.width + x) * 4 + 3] > 18) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('Das Fahrzeug konnte nicht erkannt werden.');
  const padX = Math.round((maxX - minX + 1) * 0.05);
  const padY = Math.round((maxY - minY + 1) * 0.07);
  minX = Math.max(0, minX - padX); minY = Math.max(0, minY - padY);
  maxX = Math.min(source.width - 1, maxX + padX); maxY = Math.min(source.height - 1, maxY + padY);
  const cropW = maxX - minX + 1, cropH = maxY - minY + 1;
  const scale = Math.min(1, 900 / Math.max(cropW, cropH));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cropW * scale));
  out.height = Math.max(1, Math.round(cropH * scale));
  out.getContext('2d').drawImage(source, minX, minY, cropW, cropH, 0, 0, out.width, out.height);
  let result = out.toDataURL('image/webp', 0.86);
  if (!result.startsWith('data:image/webp')) result = out.toDataURL('image/png');
  if (result.length > 900000) result = out.toDataURL('image/webp', 0.68);
  if (!safeCarPhoto(result)) throw new Error('Das freigestellte Fahrzeugbild ist zu groß. Bitte ein kleineres Foto wählen.');
  return result;
}
async function prepareVehiclePhoto(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw new Error('Bitte JPG, PNG oder WebP wählen. iPhone-HEIC-Fotos vorher als JPG exportieren.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Bitte ein Foto unter 15 MB wählen.');
  }

  const img = await loadImageFromBlob(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

async function shrinkCarPhoto(file) {
  toast('Fahrzeug wird freigestellt …');
  const prepared = await prepareVehiclePhoto(file);

  let result;
  try {
    result = await api('remove-background', { image: prepared });
  } catch (error) {
    console.error('Background removal failed:', error);
    throw new Error(error.message || 'Fahrzeug konnte nicht freigestellt werden.');
  }

  if (!result?.image || !/^data:image\/png;base64,/.test(result.image)) {
    throw new Error('Der Server hat kein gültiges freigestelltes Bild zurückgegeben.');
  }

  const transparentBlob = await (await fetch(result.image)).blob();
  const img = await loadImageFromBlob(transparentBlob);
  return cropTransparentVehicle(img);
}
function resetCarPhotoInput() {
  const input = document.getElementById('newCarPhoto');
  if (input) input.value = '';
  const preview = document.getElementById('newCarPhotoPreview');
  if (preview) preview.replaceChildren();
}
function setupCarPhotoInput() {
  const input = document.getElementById('newCarPhoto');
  const preview = document.getElementById('newCarPhotoPreview');
  if (!input) return;
  if (input.dataset.chsPhotoBound === '1') return;
  input.dataset.chsPhotoBound = '1';
  document.getElementById('clearNewCarPhoto')?.addEventListener('click', () => {
    if (!carPhotoBusy) { pendingCarPhoto = ''; resetCarPhotoInput(); }
  });
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    carPhotoBusy = true; event.target.disabled = true;
    try {
      pendingCarPhoto = await shrinkCarPhoto(file);
      if (preview) preview.innerHTML = carPhotoMarkup({photo:pendingCarPhoto,brand:'Dein',model:'Fahrzeug'});
      toast('Fahrzeug freigestellt ✓');
    } catch(error) {
      pendingCarPhoto = '';
      toast(error.message);
      if (preview) {
        preview.innerHTML = `<div class="carPhotoError"><strong>FREISTELLUNG FEHLGESCHLAGEN</strong><span>${esc(error.message || 'Unbekannter Fehler')}</span></div>`;
      }
    }
    finally { carPhotoBusy = false; event.target.disabled = false; }
  });
}
document.getElementById('garageCars')?.addEventListener('change', async event => {
  const input = event.target.closest('[data-car-photo]');
  if (!input?.files[0] || !authSession?.user?.id) return;

  const car = localGarage.find(item => item.id === input.dataset.carPhoto);
  if (!car) return;

  input.disabled = true;

  try {
    const photo = await shrinkCarPhoto(input.files[0]);
    const path = await uploadVehiclePhoto(car.id, photo);

    if (car.photoPath && car.photoPath !== path) {
      await supabaseClient.storage.from('vehicle-images').remove([car.photoPath]);
    }

    const { error } = await supabaseClient
      .from('vehicles')
      .update({ photo_path: path, updated_at: new Date().toISOString() })
      .eq('id', car.id)
      .eq('user_id', authSession.user.id);
    if (error) throw error;

    car.photoPath = path;
    car.photo = vehiclePhotoUrl(path) + `?v=${Date.now()}`;
    saveGarage();
    syncVehicleUI();
    toast('Fahrzeugfoto im Konto gespeichert ✓');
  } catch(error) {
    toast(error.message || 'Fahrzeugfoto konnte nicht gespeichert werden.');
  } finally {
    input.disabled = false;
    input.value = '';
  }
});

document.getElementById('garageCars')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-remove-photo]');
  if (!button || !authSession?.user?.id) return;

  const car = localGarage.find(item => item.id === button.dataset.removePhoto);
  if (!car) return;

  button.disabled = true;

  try {
    if (car.photoPath) {
      await supabaseClient.storage.from('vehicle-images').remove([car.photoPath]);
    }

    const { error } = await supabaseClient
      .from('vehicles')
      .update({ photo_path: null, updated_at: new Date().toISOString() })
      .eq('id', car.id)
      .eq('user_id', authSession.user.id);
    if (error) throw error;

    car.photoPath = '';
    car.photo = '';
    saveGarage();
    syncVehicleUI();
    toast('Fahrzeugfoto entfernt.');
  } catch (error) {
    button.disabled = false;
    toast(error.message || 'Foto konnte nicht entfernt werden.');
  }
});

/* Profil bearbeiten und gespeicherte Statistiken anzeigen. */
function profileImageSource(value) {
  if (safeCarPhoto(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
}

async function prepareProfilePhoto(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw new Error('Bitte JPG, PNG oder WebP wählen.');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Bitte ein Profilbild unter 15 MB wählen.');
  }

  const img = await loadImageFromBlob(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const maxSide = 720;
  const scale = Math.min(1, maxSide / Math.max(width, height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  /*
    Profilfotos werden bewusst NICHT freigestellt. Das frühere Verwenden
    der Fahrzeug-Freistellung war der Grund für das unnatürliche Rendering.
  */
  return canvas.toDataURL('image/jpeg', 0.84);
}

async function uploadProfilePhoto(dataUrl) {
  const userId = authSession?.user?.id;
  if (!userId || !/^data:image\/jpeg;base64,/.test(String(dataUrl || ''))) {
    throw new Error('Ungültiges Profilbild.');
  }

  const blob = await (await fetch(dataUrl)).blob();
  if (blob.size > 2 * 1024 * 1024) {
    throw new Error('Das Profilbild ist nach der Verarbeitung zu groß.');
  }

  const path = `${userId}/avatar.jpg`;

  const { error } = await supabaseClient.storage
    .from('profile-images')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '300'
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('profile-images')
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error('Profilbild-URL konnte nicht erstellt werden.');
  }

  return `${data.publicUrl}?v=${Date.now()}`;
}

async function removeStoredProfilePhoto() {
  const userId = authSession?.user?.id;
  if (!userId) return;

  try {
    await supabaseClient.storage
      .from('profile-images')
      .remove([`${userId}/avatar.jpg`]);
  } catch (error) {
    console.error('Altes Profilbild konnte nicht aus Storage entfernt werden:', error);
  }
}

async function migrateLegacyProfileAvatar() {
  if (!authSession?.user?.id || !safeCarPhoto(dbProfile?.avatar_url)) return;

  try {
    const publicUrl = await uploadProfilePhoto(dbProfile.avatar_url);
    const { data, error } = await supabaseClient.rpc('chs_update_my_profile', {
      p_username: dbProfile.username || 'Spieler',
      p_avatar: publicUrl
    });

    if (error) throw error;
    if (data?.avatar_url) {
      dbProfile = { ...dbProfile, avatar_url: data.avatar_url, updated_at: data.updated_at || dbProfile.updated_at };
      renderProfile();
    }
  } catch (error) {
    console.error('Altes Profilbild konnte nicht automatisch migriert werden:', error);
  }
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
      <p class="muted">Das Profilbild ist freiwillig. Wenn du eins auswählst, wird es normal zugeschnitten und kontoweit gespeichert. JPG, PNG oder WebP, maximal 15 MB.</p>
      <p data-profile-error role="alert" style="color:#ffbca4;white-space:pre-wrap"></p>
      <button type="submit" class="primaryButton">ÄNDERUNGEN SPEICHERN</button>`;
    dialog.append(form);
    form.elements.photo.addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file || dialog._busy) return;
      dialog._busy = true; setProfileFormBusy(form, true);
      try {
        dialog._photo = await prepareProfilePhoto(file);
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
        let avatarValue = dialog._photo;

        if (dialog._photo && dialog._photo !== '__KEEP__') {
          avatarValue = await uploadProfilePhoto(dialog._photo);
        }

        if (dialog._photo === null) {
          await removeStoredProfilePhoto();
          avatarValue = null;
        }

        const { data, error } = await supabaseClient.rpc('chs_update_my_profile', {
          p_username: name,
          p_avatar: avatarValue
        });

        if (error) throw new Error(error.code === 'PGRST202' ? 'Profilfunktion ist noch nicht verfügbar.' : error.message);
        if (authSession?.user?.id !== userId) return;
        if (!data || typeof data.username !== 'string') throw new Error('Unerwartete Serverantwort. Bitte neu laden.');

        dbProfile = {
          ...dbProfile,
          username: data.username,
          avatar_url: data.avatar_url,
          updated_at: data.updated_at || dbProfile.updated_at
        };

        renderProfile();
        dialog.close();
        toast(data.avatar_url ? 'Profil gespeichert ✓' : 'Profil ohne Bild gespeichert ✓');
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
freshLobbyStyle.textContent = ``;
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
  if (!game || game.dataset.freshBound === '1') return;
  game.dataset.freshBound = '1';
  game.classList.add('freshLobby');

  const chatDrawer = document.getElementById('freshChatDrawer');
  const chatButton = document.getElementById('freshChatButton');
  const chatClose = document.getElementById('freshChatClose');
  const settingsDialog = document.getElementById('freshSettingsDialog');
  const settingsButton = document.getElementById('freshSettingsButton');
  const settingsClose = document.getElementById('freshSettingsClose');
  const copyButton = document.getElementById('copyLobbyCode');
  const mapFold = document.getElementById('freshMapFold');

  /*
    V7: Kein separater Chat-Backdrop mehr.
    Der Backdrop war die einzige vollflächige Ebene über der Lobby und konnte
    auf Safari nach mehrmaligem Öffnen/Schließen unsichtbar Klicks abfangen.
    Der Chat wird geschlossen jetzt wirklich mit display:none aus dem
    Hit-Testing genommen.
  */
  document.querySelectorAll('#freshChatBackdrop').forEach(element => element.remove());

  if (chatDrawer && chatDrawer.parentElement !== document.body) {
    document.body.append(chatDrawer);
  }

  const clearChatBlockers = () => {
    document.querySelectorAll('#freshChatBackdrop').forEach(element => element.remove());
    document.body.classList.remove('freshChatOpen');
    game.classList.remove('chatDrawerOpen');
  };

  const setChatOpen = open => {
    if (!chatDrawer) return;

    if (open) {
      clearChatBlockers();
      chatDrawer.style.setProperty('display', 'flex', 'important');
      chatDrawer.style.setProperty('pointer-events', 'auto', 'important');
      chatDrawer.removeAttribute('inert');
      chatDrawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('freshChatOpen');
      game.classList.add('chatDrawerOpen');

      requestAnimationFrame(() => {
        chatDrawer.classList.add('open');
        if (typeof renderLobbyChat === 'function') renderLobbyChat(true);
        markFreshChatRead();
        const list = document.getElementById('lobbyMessages');
        if (list) list.scrollTop = list.scrollHeight;
      });
      return;
    }

    const input = document.getElementById('lobbyChatInput');
    if (input && document.activeElement === input) input.blur();

    chatDrawer.classList.remove('open');
    chatDrawer.setAttribute('aria-hidden', 'true');
    chatDrawer.setAttribute('inert', '');
    chatDrawer.style.setProperty('pointer-events', 'none', 'important');
    chatDrawer.style.setProperty('display', 'none', 'important');
    clearChatBlockers();
  };

  const openChat = () => setChatOpen(true);
  const closeChat = () => setChatOpen(false);

  /* Startzustand garantiert geschlossen. */
  closeChat();

  chatButton?.addEventListener('click', openChat);
  chatClose?.addEventListener('click', closeChat);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && chatDrawer?.classList.contains('open')) closeChat();
  });

  /*
    Vor allen wichtigen Lobby-Aktionen räumen wir vorsichtshalber jeden
    möglichen alten Chat-Zustand weg. Dadurch kann ein Safari-Resume oder
    ein alter CSS-Zustand READY/START/SETTINGS/VERLASSEN nicht blockieren.
  */
  ['ready', 'start', 'freshSettingsButton', 'leave'].forEach(id => {
    document.getElementById(id)?.addEventListener('pointerdown', () => {
      if (!chatDrawer?.classList.contains('open')) clearChatBlockers();
    }, { capture: true });
  });

  settingsButton?.addEventListener('click', () => {
    closeChat();
    if (state?.lobby?.hostId !== state?.lobby?.me?.id || state?.lobby?.state !== 'LOBBY') return;
    fillLobbySettings();
    if (settingsDialog && !settingsDialog.open) settingsDialog.showModal();
  });

  settingsClose?.addEventListener('click', () => settingsDialog?.close());

  copyButton?.addEventListener('click', async () => {
    const code = state?.lobby?.code || '';
    try {
      await navigator.clipboard.writeText(code);
      toast('Lobby-Code kopiert.');
    } catch {
      toast('Dein Lobby-Code: ' + code);
    }
  });

  const mapSummary = mapFold?.querySelector('summary');
  mapSummary?.addEventListener('click', event => {
    event.preventDefault();
    mapFold.open = !mapFold.open;
  });

  mapFold?.addEventListener('toggle', () => {
    if (mapFold.open) {
      window.chsMapUpdate?.(state);
      window.dispatchEvent(new Event('resize'));
    }
  });

  const readIfVisible = () => {
    if (chatDrawer?.classList.contains('open') && document.visibilityState === 'visible') {
      markFreshChatRead();
    }
  };
  window.addEventListener('focus', readIfVisible);
  document.addEventListener('visibilitychange', readIfVisible);

  new MutationObserver(() => {
    if (!game.classList.contains('active')) {
      closeChat();
      if (settingsDialog?.open) settingsDialog.close();
    }
  }).observe(game, { attributes: true, attributeFilter: ['class'] });
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
  if (announcement && announcement.textContent !== label) {
    announcement.textContent = label;
  }
}
function updateFreshChat() {
  if (!state?.lobby) return;

  const code = state.lobby.code;
  const messages = state.chat || [];
  const drawer = document.getElementById('freshChatDrawer');
  document.querySelectorAll('#freshChatBackdrop').forEach(element => element.remove());
  const game = document.getElementById('game');

  /*
    Wenn eine Lobby neu geladen wird, muss der komplette Chat-Zustand
    geschlossen werden. In V5 wurde nur der Drawer geschlossen, der
    Backdrop blieb aber aktiv. Dadurch lag eine unsichtbare Ebene über
    Chat-, Einstellungen- und Verlassen-Button und fing die Klicks ab.
  */
  if (freshChatState.code !== code) {
    freshChatState.code = code;
    freshChatState.seen = new Set(messages.map(message => message.id));
    freshChatState.unread.clear();

    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('freshChatOpen');
    game?.classList.remove('chatDrawerOpen');

    const settingsDialog = document.getElementById('freshSettingsDialog');
    if (settingsDialog?.open) settingsDialog.close();
  } else {
    for (const message of messages) {
      if (!freshChatState.seen.has(message.id) && message.sender !== state.lobby.me.id) {
        freshChatState.unread.add(message.id);
      }
      freshChatState.seen.add(message.id);
    }
  }

  /*
    Sicherheits-Sync: Ein Backdrop darf niemals aktiv bleiben, wenn der
    Chat selbst geschlossen ist. Das verhindert auch nach Safari-Resume,
    Polling oder einem schnellen Lobby-Wechsel blockierte Bedienelemente.
  */
  const chatOpen = !!drawer?.classList.contains('open');
  if (!chatOpen) {
    drawer?.style.setProperty('pointer-events', 'none', 'important');
    drawer?.style.setProperty('display', 'none', 'important');
    drawer?.setAttribute('inert', '');
    document.body.classList.remove('freshChatOpen');
    game?.classList.remove('chatDrawerOpen');
  }

  if (chatOpen && document.visibilityState === 'visible' && document.hasFocus()) {
    markFreshChatRead();
  } else {
    paintFreshUnread();
  }
}
function freshPlayerColor(id) {
  const colors=['#ac98ff','#76e4cb','#ffb68b','#84bdff','#f7a1d4','#dfec8e'];
  let hash=0;for(const ch of String(id))hash=(hash*31+ch.charCodeAt(0))>>>0;
  return colors[hash%colors.length];
}
function lobbyCarColor(color) {
  const value=String(color||'').toLowerCase();
  const colors={schwarz:'#17191c',black:'#17191c',weiß:'#ecece8',weiss:'#ecece8',white:'#ecece8',grau:'#777d84',gray:'#777d84',grey:'#777d84',silber:'#aeb4ba',silver:'#aeb4ba',blau:'#245ca9',blue:'#245ca9',rot:'#a81c22',red:'#a81c22',grün:'#28653f',gruen:'#28653f',green:'#28653f',orange:'#e96619',gelb:'#e5c328',yellow:'#e5c328',braun:'#5d4032',brown:'#5d4032',beige:'#b8aa8e',lila:'#68408b',purple:'#68408b'};
  for(const [name,hex] of Object.entries(colors))if(value.includes(name))return hex;
  return '#737981';
}
function lobbyCarMarkup(player,mine=false){
  const ownPhoto = mine ? vehiclePhotoSource(activeCar()?.photo) : '';
  const source = vehiclePhotoSource(player?.photoUrl) || ownPhoto;

  if (source) {
    return `<img class="lobbyModelCar" src="${esc(source)}" alt="${esc(player.vehicle || 'Fahrzeug')}" draggable="false" loading="lazy" decoding="async">`;
  }

  return `<div class="lobbyCarFallback" role="img" aria-label="${esc(player.vehicle||'Fahrzeug')}"></div>`;
}
function lobbyProfileMarkup(player) {
  const source = profileImageSource(player?.avatarUrl);

  if (!source) {
    return `<div class="freshLobbyProfile isFallback" aria-label="Kein Profilbild">${esc(initials(player?.name || 'Spieler'))}</div>`;
  }

  return `<div class="freshLobbyProfile"><img src="${esc(source)}" alt="Profilbild von ${esc(player?.name || 'Spieler')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
}
function renderFreshLobby() {
  if(!state?.lobby)return;
  ensureFreshLobby();
  const lobby=state.lobby,waiting=lobby.state==='LOBBY',host=lobby.hostId===lobby.me.id;
  const game=document.getElementById('game');game.classList.toggle('freshWaiting',waiting);game.classList.toggle('liveRound',!waiting);
  document.getElementById('freshRoomLabel').textContent=waiting?'DEIN WARTERAUM':'DEINE CREW · LIVE';
  const settings=document.getElementById('lobbySettingsPanel');
  const settingsDialog=document.getElementById('freshSettingsDialog');
  if(settings&&settings.parentNode!==settingsDialog)settingsDialog.append(settings);
  const hostButton=document.getElementById('freshSettingsButton');hostButton.hidden=!host;hostButton.disabled=!waiting;hostButton.title=waiting?'Lobby anpassen':'Während der Runde gesperrt';
  if((!host||!waiting)&&settingsDialog.open)settingsDialog.close();
  const phase=lobby.code + ':' + waiting;
  const mapFold=document.getElementById('freshMapFold');
  if(freshLobbyPhase!==phase){
    if(mapFold)mapFold.open=!waiting;
    const feedback=document.getElementById('findFeedback');
    feedback.textContent='Fahrzeug entdeckt? Tippe auf „Fund melden“. GPS und Entfernung werden geprüft.';
    delete feedback.dataset.status;
    freshLobbyPhase=phase;
  }
  const resultPanel=document.getElementById('result');
  const roomHeader=document.querySelector('.freshRoomHeader');
  if(lobby.state==='RESULT' && roomHeader.nextElementSibling!==resultPanel)roomHeader.after(resultPanel);
  const targetPanel=document.getElementById('targets');
  const crewPanel=document.querySelector('.freshCrewBoard');
  if(!waiting){
    if(targetPanel.nextElementSibling!==mapFold)mapFold.before(targetPanel);
    if(mapFold.nextElementSibling!==crewPanel)mapFold.after(crewPanel);
  } else {
    if(crewPanel.nextElementSibling!==mapFold)mapFold.before(crewPanel);
    if(mapFold.nextElementSibling!==targetPanel)mapFold.after(targetPanel);
  }
  const hostPlayer=lobby.players.find(player=>player.id===lobby.hostId);
  const others=lobby.players.filter(player=>player.id!==lobby.hostId);
  const half=Math.ceil(others.length/2);
  const displayPlayers=hostPlayer?[...others.slice(0,half),hostPlayer,...others.slice(half)]:[...lobby.players];
  const crew=document.getElementById('players');
  crew.innerHTML=displayPlayers.map(player=>{
    const mine=player.id===lobby.me.id,owner=player.id===lobby.hostId;
    const status=player.found?'GEFUNDEN':!player.connected?'VERBINDUNG…':waiting?(player.ready?'BEREIT':'WARTET'):player.role==='SEEKER'?'SUCHER':'VERSTECKER';
    return `<article class="freshPlayerCard ${mine?'isYou':''} ${owner?'isHost':''} ${player.ready?'isReady':''} ${player.found?'isFound':''}" style="--crew-color:${freshPlayerColor(player.id)};--car-color:${lobbyCarColor(player.color)}">
      <div class="freshPlayerTop"><span>${owner?'♛ HOST':mine?'DU':'CREW'}</span><span class="freshConnection ${player.connected?'online':''}"></span></div>
      <h3>${esc(player.name)}${mine?'<small>DU</small>':''}</h3>
      ${lobbyProfileMarkup(player)}
      <div class="freshAvatarStage">${lobbyCarMarkup(player,mine)}<span class="freshPlatform"></span></div>
      <p class="freshVehicleName">${esc(player.vehicle||'Kein Fahrzeug')}</p>
      <p class="freshVehicleColor">${esc(player.color||'Keine Farbe')} · Level ${Number(player.level)||1}</p>
      <div class="freshPlayerStatus">${player.ready||player.found?'✓ ':''}${status}</div>
      <small class="freshGpsState">${player.hasLocation?'● GPS bereit':'○ Warte auf GPS'}</small>
    </article>`;
  }).join('');
  if(waiting&&lobby.players.length<2)crew.insertAdjacentHTML('beforeend','<button class="freshEmptySeat" type="button" data-open-lobby-invite aria-label="Freunde in die Lobby einladen"><span>＋</span><strong>SPIELER EINLADEN</strong><p>Freund auswählen oder Lobby-Code teilen.<br>Ab 2 Spielern geht’s los.</p></button>');
  if(typeof renderLobbyChat==='function')renderLobbyChat();
  if(typeof syncLobbyInviteButton==='function')syncLobbyInviteButton();
  updateFreshChat();
}

