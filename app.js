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
let gpsStarting = false;
let gpsHeartbeat = null;
let publicSearchBusy = false;
let publicSearchLastAt = 0;
let garageSyncBusy = false;
const legacyCutoutAttempts = new Set();
let connectionLost = false;
let rejoinBusy = false;
let sessionEpoch = 0;
let gpsPhase = '';
let lastGpsRequestAt = 0;
let achievementCatalog = [];
let achievementUnlocked = new Set();
let resultClaimInFlight = '';
let resultClaimRetryAt = 0;
const claimedGameResults = new Set();


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
    series: row.series || '',
    body: row.body_type || '',
    year: row.model_year ? String(row.model_year) : '',
    color: row.color || '',
    active: !!row.is_active || row.id === dbProfile?.active_vehicle_id,
    photoPath: row.photo_path || '',
    photo: row.photo_path ? vehiclePhotoUrl(row.photo_path) : ''
  };
}

async function migrateLegacyVehicleCutout(car) {
  if (!authSession?.user?.id || !car?.id) return false;

  const source = vehiclePhotoSource(car.photo);
  if (!source || isLobbyCutout(source) || legacyCutoutAttempts.has(car.id)) return false;

  legacyCutoutAttempts.add(car.id);

  try {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) throw new Error('Gespeichertes Fahrzeugfoto konnte nicht geladen werden.');

    const blob = await response.blob();
    const prepared = await prepareVehiclePhoto(blob);
    const result = await api('remove-background', { image: prepared });

    if (!result?.image || !/^data:image\/png;base64,/.test(result.image)) {
      throw new Error('Das vorhandene Fahrzeugfoto konnte nicht freigestellt werden.');
    }

    const transparentBlob = await (await fetch(result.image)).blob();
    const image = await loadImageFromBlob(transparentBlob);
    const cutoutDataUrl = cropTransparentVehicle(image);
    const previousPhotoPath = car.photoPath || '';
    const photoPath = await uploadVehiclePhoto(car.id, cutoutDataUrl, true);

    const { error } = await supabaseClient
      .from('vehicles')
      .update({ photo_path: photoPath })
      .eq('id', car.id)
      .eq('user_id', authSession.user.id);

    if (error) throw error;

    car.photoPath = photoPath;
    car.photo = vehiclePhotoUrl(photoPath);
    saveGarage();
    syncVehicleUI();

    if (previousPhotoPath && previousPhotoPath !== photoPath) {
      try {
        await supabaseClient.storage.from('vehicle-images').remove([previousPhotoPath]);
      } catch {}
    }

    return true;
  } catch (error) {
    console.warn('Legacy-Fahrzeugfoto bleibt vorerst als Originalbild sichtbar:', error);
    return false;
  }
}

async function uploadVehiclePhoto(vehicleId, dataUrl, cutout = false) {
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
  const suffix = cutout ? `.cutout.${extension}` : `.${extension}`;
  const path = `${authSession.user.id}/${vehicleId}${suffix}`;

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
      .select('id,user_id,brand,model,series,body_type,model_year,color,is_active,photo_path,created_at,updated_at')
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
    void migrateLegacyVehicleCutout(activeCar());
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
    behavior: 'instant'
  });

  window.communityUI?.onPage(page);
  window.crewUI?.onPage(page);
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
  achievementCatalog = [];
  achievementUnlocked = new Set();
  resultClaimInFlight = '';
  resultClaimRetryAt = 0;
  claimedGameResults.clear();

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
  renderAchievements();
  window.crewUI?.onProfile();
}

async function loadAchievements() {
  if (!authSession?.user?.id) return;

  try {
    const [{ data: catalog, error: catalogError }, { data: unlocked, error: unlockedError }] =
      await Promise.all([
        supabaseClient
          .from('achievements')
          .select('id,name,description,xp_reward')
          .order('id', { ascending: true }),
        supabaseClient
          .from('user_achievements')
          .select('achievement_id,unlocked_at')
          .eq('user_id', authSession.user.id)
      ]);

    if (catalogError) throw catalogError;
    if (unlockedError) throw unlockedError;

    achievementCatalog = Array.isArray(catalog) ? catalog : [];
    achievementUnlocked = new Set((unlocked || []).map(item => item.achievement_id));
    renderAchievements();
  } catch (error) {
    console.error('Erfolge konnten nicht geladen werden:', error);
  }
}

function achievementProgressMarkup(id,unlocked){
 const field={FIRST_GAME:'rounds_played',FIRST_FIND:'finds',HIDE_MASTER:'survived_rounds'}[id];
 if(!field)return '<small>'+ (unlocked?'Erreicht':'Bedingung noch nicht erreicht')+'</small>';
 const progress=Math.min(1,Math.max(0,Number(dbProfile?.[field])||0));
 return '<span class="badgeProgress"><progress max="1" value="'+progress+'" aria-label="Fortschritt"></progress><span>'+progress+' / 1</span></span>';
}
function renderAchievements() {
  const grid = document.getElementById('achievementGrid');
  if (!grid || !achievementCatalog.length) return;

  const icons = {
    FIRST_GAME: '★',
    FIRST_FIND: '⌖',
    HIDE_MASTER: '◆'
  };

  grid.innerHTML = achievementCatalog.map(item => {
    const unlocked = achievementUnlocked.has(item.id);
    return `
      <button type="button" data-achievement="${esc(item.id)}" class="achievementBadge ${unlocked ? 'isUnlocked' : 'isLocked'}">
        <div class="achievementIcon" aria-hidden="true">${typeof appIcon==='function'?appIcon({FIRST_GAME:'star',FIRST_FIND:'target',HIDE_MASTER:'shield'}[item.id]||'star'):(unlocked?esc(icons[item.id]||'★'):'🔒')}</div>
        <div>
          <strong>${esc(item.name)}</strong>
          <p>${esc(item.description)}</p>
          ${achievementProgressMarkup(item.id,unlocked)}
          <small>${unlocked ? 'FREIGESCHALTET' : '+' + Number(item.xp_reward || 0) + ' XP'}</small>
        </div>
      </button>
    `;
  }).join('');
}

async function claimGameProgress(reward) {
  const resultId = reward?.resultId;
  if (!resultId || !authSession?.user?.id || !dbProfile) return;
  if (claimedGameResults.has(resultId) || resultClaimInFlight === resultId) return;
  if (Date.now() < resultClaimRetryAt) return;

  resultClaimInFlight = resultId;

  try {
    const { data, error } = await supabaseClient.rpc('chs_claim_game_result', {
      p_result_id: resultId,
      p_role: reward.role,
      p_won: !!reward.won,
      p_finds: Number(reward.finds) || 0,
      p_survived: !!reward.survived
    });

    if (error) throw error;
    if (!data?.profile) throw new Error('Fortschritt konnte nicht bestätigt werden.');

    claimedGameResults.add(resultId);
    resultClaimRetryAt = 0;
    dbProfile = {
      ...dbProfile,
      ...data.profile
    };

    const xpNode = document.getElementById('xpGain');
    if (xpNode) xpNode.textContent = String(Number(data.xp_awarded) || Number(reward.baseXp) || 0);

    renderProfile();
    await loadAchievements();

    if (!data.already_claimed) {
      const unlocked = Array.isArray(data.unlocked) ? data.unlocked.length : 0;
      toast(unlocked
        ? `Runde gespeichert · ${Number(data.xp_awarded) || 0} XP · ${unlocked} Erfolg freigeschaltet`
        : `Runde gespeichert · ${Number(data.xp_awarded) || 0} XP`);
    }
  } catch (error) {
    resultClaimRetryAt = Date.now() + 10000;
    console.error('Rundenfortschritt konnte nicht gespeichert werden:', error);
  } finally {
    if (resultClaimInFlight === resultId) resultClaimInFlight = '';
  }
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

    if (!await window.accountUI.initialize()) return;

    await loadProfile(
      authSession.user.id
    );

    await loadAchievements();
    await migrateLegacyProfileAvatar();
    await loadCloudGarage();
    if(gameSession&&hasPendingLeave(gameSession.code))resetGame();
    await flushPendingLeaves();

    if (!gameSession) {
      try { const recovered=await api('rejoin-lookup',{},'GET');
        if(recovered.code&&!hasPendingLeave(recovered.code)){gameSession={code:recovered.code,userId:recovered.userId};localStorage.setItem('chs',JSON.stringify(gameSession));}
      }catch(error){console.error('Rundensuche:',error.message);}
    }
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
      window.accountUI?.closePrivateViews();
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
  if (visual) visual.innerHTML = carPhotoMarkup(car,'home-card');

  const profileVehicleStage = document.getElementById('profileVehicleStage');
  if (profileVehicleStage) {
    profileVehicleStage.innerHTML = car ? carPhotoMarkup(car,'profile') : '';
  }

  renderGarage();
  window.referenceUI?.renderOwn();
  window.communityUI?.syncIdentity();
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
      .slice().sort((a,b)=>Number(b.active)-Number(a.active)).map(car => `
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
            ${esc([car.brand,car.series?.split(' · ')[0],car.model].filter(Boolean).join(' '))}
          </h2>

          <div class="vehicleDetails">

            <span>
              ${esc(car.color)}
            </span>

            <span>
              ${esc(car.year ? 'Bj. '+car.year : 'Baujahr nicht angegeben')}
            </span>

          </div>

          <p class="vehicleSeries">${esc(car.series || car.body || '')}</p>
          <div class="garageActions"><button type="button" data-edit-car="${esc(car.id)}">Bearbeiten</button><button type="button" class="deleteVehicle" data-delete-car="${esc(car.id)}">Löschen</button></div>
          ${car.active ? '' : `<button class="activateVehicle" data-car-id="${esc(car.id)}" type="button">ALS AKTIVES FAHRZEUG WÄHLEN</button>`}

        </section>
      `)
      .join('');
}


function openCarModal() {
  if (gameSession) { toast('Verlasse zuerst die Lobby, um deine Garage zu bearbeiten.'); return; }
  editingVehicleId = null;
  pendingCarPhoto = '';
  for (const id of ['newCarBrand','newCarModel','newCarYear','newCarBody','newCarColor','newCarSeries']) $('#'+id).value='';
  $('#newCarSearch').value='';
  $('#newCarSeries').dataset.manual='false';
  $('#carSeriesDetails').open=false;
  $('#carSearchResults').classList.add('hidden');
  $('#newCarSearch').setAttribute('aria-expanded','false');
  $('#newCarColor').dispatchEvent(new Event('input'));
  $('#saveCar').textContent='Fahrzeug speichern';
  $('#carModal h2').textContent='FAHRZEUG HINZUFÜGEN';
  setupCarPhotoInput();
  resetCarPhotoInput();
  refreshVehicleForm();
  if (typeof syncVehiclePickers === 'function') syncVehiclePickers({});
  $('#carModal')
    ?.classList.remove('hidden');
  ($('#newCarBrandPicker') || $('#newCarSearch'))?.focus();
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

  commitVehicleSearch();
  const brand = $('#newCarBrand')?.value.trim();
  const model = $('#newCarModel')?.value.trim();
  const year = $('#newCarYear')?.value.trim();
  const color = $('#newCarColor')?.value.trim();
  const series = $('#newCarSeries').value.trim();
  const body = $('#newCarBody').value;
  const generation = vehicleCatalog.ranges(brand,model).find(item=>item.label===series||item.name===series);
  const yearProblem = vehicleCatalog.yearError(year,generation);
  if(yearProblem){toast(yearProblem);return;}
  if(gameSession){toast('Verlasse zuerst die Lobby, um deine Garage zu bearbeiten.');return;}

  if (!brand || !model || !color) {
    toast('Bitte dein Fahrzeug auswählen und eine Farbe angeben.');
    return;
  }

  if (!authSession?.user?.id) {
    toast('Bitte erneut anmelden.');
    return;
  }

  if(editingVehicleId){
    garageSyncBusy=true;
    try {
      const car=localGarage.find(item=>item.id===editingVehicleId);
      if(!car)throw new Error('Fahrzeug nicht mehr vorhanden.');
      const values={brand:brand.slice(0,60),model:model.slice(0,80),model_year:Number(year)||null,series:series.slice(0,100),body_type:body,color:color.slice(0,40),updated_at:new Date().toISOString()};
      const previousPhotoPath=car.photoPath||'';
      if(pendingCarPhoto)values.photo_path=await uploadVehiclePhoto(car.id,pendingCarPhoto,true);
      const {data,error}=await supabaseClient.from('vehicles').update(values).eq('id',car.id).eq('user_id',authSession.user.id).select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Änderungen wurden nicht gespeichert.');
      if(values.photo_path && previousPhotoPath && previousPhotoPath!==values.photo_path){
        try{await supabaseClient.storage?.from?.('vehicle-images')?.remove?.([previousPhotoPath]);}catch{}
      }
      garageSyncBusy=false;
      await loadCloudGarage({migrateLocal:false});
      closeCarModal();pendingCarPhoto='';editingVehicleId=null;
      toast('Fahrzeug aktualisiert.');
    }catch(error){toast(error.message);}
    finally{garageSyncBusy=false;}
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
        series: series.slice(0,100),
        body_type: body,
        model_year: Number(year) || null,
        color: color.slice(0, 40),
        is_active: false
      });
    if (insertError) throw insertError;

    if (pendingCarPhoto) {
      uploadedPath = await uploadVehiclePhoto(vehicleId, pendingCarPhoto, true);
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
    void window.accountUI?.handleError(error);
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
      `${car.brand} ${car.model}${car.year ? ' · Bj. '+car.year : ''}`.trim(),
    bodyType: car.body || '',
    background: getLobbyBackground(),

    color:
      car.color ||
      'Unbekannt',

    photoUrl:
      vehiclePhotoSource(car.photo),

    avatarUrl:
      profileImageSource(dbProfile.avatar_url),

    characterStyle:
      getCharacterStyle(),

    appearance: window.accountUI.appearance(),

    level:
      Math.max(1, Math.min(50, Number(dbProfile.level) || 1)),

    mode:
      $('#mode')?.value ||
      'PASSENGER'
  };
}

function characterStyleKey() {
  return `chsCharacterStyle:${authSession?.user?.id || 'guest'}`;
}

function getCharacterStyle() {
  const localValue = localStorage.getItem(characterStyleKey());
  if (localValue != null) {
    const saved = Number(localValue);
    if (Number.isInteger(saved) && saved >= 0 && saved <= 2) return saved;
  }
  const cloudValue = Number(authSession?.user?.user_metadata?.character_style);
  return Number.isInteger(cloudValue) && cloudValue >= 0 && cloudValue <= 2 ? cloudValue : 0;
}

function setCharacterStyle(value) {
  const style = Math.max(0, Math.min(2, Math.trunc(Number(value) || 0)));
  localStorage.setItem(characterStyleKey(), String(style));
  return style;
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
      : '<div class="publicLobbyEmpty"><strong>Keine offene Lobby im Umkreis von 1 km</strong><span>Du kannst unten selbst eine Lobby erstellen oder per Code beitreten.</span></div>';
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
            Number($('#radius')?.value ?? 500),

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

    return false;
  }


  try {
    await flushPendingLeaves();
    if(hasPendingLeave(lobbyCode))throw new Error('Das Verlassen wird noch synchronisiert. Bitte erneut versuchen, sobald du verbunden bist.');
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
    return true;
  }

  catch (error) {
    toast(
      error.message
    );
    return false;
  }
}


function saveGameSession(result) {
  sessionEpoch += 1;
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

function ensureRejoinBanner() {
  let banner = document.getElementById('rejoinBanner');
  if (banner) return banner;

  banner = document.createElement('section');
  banner.id = 'rejoinBanner';
  banner.className = 'rejoinBanner';
  banner.hidden = true;
  banner.innerHTML = `
    <div>
      <strong>VERBINDUNG UNTERBROCHEN</strong>
      <span data-rejoin-message>Dein Platz und deine letzte GPS-Position bleiben erhalten.</span>
    </div>
    <button type="button" class="primaryButton" data-rejoin>REJOIN</button>
  `;
  document.body.append(banner);
  banner.querySelector('[data-rejoin]')?.addEventListener('click', rejoinGame);
  return banner;
}

function showRejoin(message = 'Dein Platz und deine letzte GPS-Position bleiben erhalten.') {
  if (!gameSession) return;
  connectionLost = true;
  const banner = ensureRejoinBanner();
  const copy = banner.querySelector('[data-rejoin-message]');
  if (copy) copy.textContent = message;
  banner.hidden = false;
}

function hideRejoin() {
  connectionLost = false;
  const banner = document.getElementById('rejoinBanner');
  if (banner) banner.hidden = true;
}

async function rejoinGame() {
  if (rejoinBusy || !gameSession || !authSession?.user) return;
  const epoch = sessionEpoch, credentials = gameCredentials();
  rejoinBusy = true;
  const banner = ensureRejoinBanner();
  const button = banner.querySelector('[data-rejoin]');
  if (button) { button.disabled = true; button.textContent = 'VERBINDET…'; }

  try {
    try {
      const nextState = await api('state', credentials, 'GET');
      if(epoch!==sessionEpoch||!gameSession)return;
      state = nextState;
      hideRejoin();
      openPage('game');
      renderGame();
      poll();
      toast('Wieder verbunden ✓');
      return;
    } catch (stateError) {
      if(epoch!==sessionEpoch||!gameSession)return;
      // A server-side player session can be recreated by authenticated identity.
      let payload = { ...playerData(), code: gameSession.code, rejoin:true };
      try {
        const result = await api('join', payload);
        if(epoch!==sessionEpoch||!gameSession)return;
        saveGameSession(result);
      } catch (joinError) {
        if (/GPS|Position|Standort/i.test(joinError.message || '')) {
          payload = { ...payload, ...(await currentPosition()) };
          if(epoch!==sessionEpoch||!gameSession)return;
          const result = await api('join', payload);
          if(epoch!==sessionEpoch||!gameSession)return;
          saveGameSession(result);
        } else {
          throw joinError;
        }
      }

      hideRejoin();
      showGame();
      toast('Wieder in der Runde ✓');
    }
  } catch (error) {
    if(epoch!==sessionEpoch||!gameSession)return;
    showRejoin(error.status === 404
      ? 'Die Runde ist auf dem Server nicht mehr vorhanden. Du kannst es erneut versuchen oder die Lobby bewusst verlassen.'
      : 'Rejoin fehlgeschlagen. Deine lokale Session bleibt gespeichert.');
    toast(error.message || 'Rejoin fehlgeschlagen.');
  } finally {
    rejoinBusy = false;
    if (button) { button.disabled = false; button.textContent = 'REJOIN'; }
  }
}

function showGame() {
  openPage('game');
  hideRejoin();
  poll();
  // renderGame starts the one GPS schedule after the server phase is known.
}


async function poll() {
  clearTimeout(pollTimer);
  const epoch = sessionEpoch;


  if (!gameSession) {
    return;
  }


  try {
    const nextState =
      await api(
        'state',
        gameCredentials(),
        'GET'
      );
    if(epoch!==sessionEpoch||!gameSession)return;
    state = nextState;
    lobbyMissingPolls = 0;
    hideRejoin();
    renderGame();
  }

  catch (error) {
    if(epoch!==sessionEpoch||!gameSession)return;
    console.error(error);

    if (['ACCOUNT_BANNED','LEGAL_REQUIRED'].includes(error.data?.code)) return;

    const lobbyGone =
      error.status === 404 ||
      error.status === 403 ||
      error.message.includes('Lobby nicht gefunden') ||
      error.message.includes('Session nicht gefunden');

    if (lobbyGone) {
      lobbyMissingPolls += 1;
      showRejoin(
        lobbyMissingPolls >= 4
          ? 'Die Spielsession antwortet nicht mehr. Nutze REJOIN – dein Platz wird nicht lokal gelöscht.'
          : 'Verbindung zur Runde unterbrochen. Deine letzte GPS-Position bleibt stehen.'
      );
    } else {
      lobbyMissingPolls = 0;
      showRejoin('Netzwerkverbindung unterbrochen. Deine letzte GPS-Position bleibt stehen.');
      if (error.status && error.status < 500) toast(error.message);
    }
  }


  if(epoch!==sessionEpoch||!gameSession)return;
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
    ({LOBBY:'Warten',COUNTDOWN:'Startet',HEADSTART:'Verstecken',ACTIVE:'Suche läuft',RESULT:'Beendet'}[lobby.state] || lobby.state);

  $('#stateLabel').textContent =
    ({LOBBY:'Warten',COUNTDOWN:'Startet',HEADSTART:'Verstecken',ACTIVE:'Suche läuft',RESULT:'Beendet'}[lobby.state] || lobby.state);

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


  const crewReady = lobby.players.every(player => player.connected && player.hasLocation && (player.id === lobby.hostId || player.ready));
  $('#start').disabled = inLobby && !crewReady;
  $('#start').textContent = !me.hasLocation
    ? 'POSITION WIRD ERMITTELT...'
    : !crewReady ? 'WARTE AUF DIE CREW...' : 'SPIEL STARTEN';


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


  const targets =
    lobby.players.filter(
      player =>
        player.role === 'HIDER' &&
        !player.found && !player.eliminated && !player.left
    );


  const canFind =
    me.role === 'SEEKER' &&
    lobby.state === 'ACTIVE' && !me.eliminated && !me.found;


  $('#targets')
    ?.classList.toggle(
      'hidden',
      !canFind
    );


  gameplayReceivedAt = Date.now();
  renderFindButtons(targets);
  renderGameplayDetails();

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
      lobby.result?.aborted ? 'RUNDE ABGEBROCHEN' : seekerWin
        ? 'SUCHER GEWINNEN'
        : 'VERSTECKER GEWINNEN';


    $('#resultText').textContent =
      `${lobby.result?.found || 0} von ` +
      `${lobby.result?.totalHiders || 0} ` +
      `Versteckern gefunden.`;


    $('#xpGain').textContent = String(Number(state.reward?.baseXp) || 0);
    window.referenceUI?.renderResult?.(lobby);

    void claimGameProgress(state.reward);


    $('#rematch')
      ?.classList.toggle(
        'hidden',
        lobby.hostId !== me.id || lobby.closed
      );
  }

  renderLobbySettings();
  renderFreshLobby();
  positionGameplayDetails();
  syncGpsForLobbyState();

  const mapFold = document.getElementById('freshMapFold');
  if(mapFold)mapFold.hidden=lobby.state==='RESULT'||me.eliminated||me.found;
  if (lobby.state !== 'LOBBY' || mapFold?.open) {
    window.chsMapUpdate?.(state);
  }
}


/* =========================================================
   GPS — ADAPTIV / AKKUSCHONEND
========================================================= */

function gpsConfigForState() {
  const phase = state?.lobby?.state || 'LOBBY';
  const me = state?.lobby?.me;
  if (phase === 'RESULT' || (phase !== 'LOBBY' && (me?.found || me?.eliminated || me?.left)))
    return {phase:'STOPPED',interval:0,options:{}};
  const close = state?.replacementNeedsStop || state?.locks?.length || state?.proximity?.level === 'VERY_CLOSE';
  const near = state?.outsideDeadline || state?.gpsWarning || !me?.hasLocation || state?.proximity?.level === 'CLOSE';
  const interval = phase === 'ACTIVE' ? close ? 1000 : near ? 4000 : 10000 : phase === 'LOBBY' ? 10000 : 5000;
  return {phase:phase+':'+interval,interval,options:{enableHighAccuracy:phase!=='ACTIVE'||close||near,maximumAge:0,timeout:10000}};
}

async function sendGameLocation(position) {
  if (!gameSession || gpsConfigForState().phase === 'STOPPED') return;

  try {
    await api('location', gameCredentials({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      timestamp: position.timestamp
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
  if (config.phase === 'STOPPED') return;

  if (!force && now - lastGpsRequestAt < Math.max(1000, config.interval - 1000)) {
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

  const gpsButton=$('#gps');if(gpsButton)gpsButton.disabled=config.phase==='STOPPED';
  if (config.phase === 'STOPPED') {if(gpsButton)gpsButton.textContent='GPS GESTOPPT';$('#gpsDot')?.classList.remove('on');return;}
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
    const lock = state.locks?.find(item => item.seekerId === state.lobby.me.id);
    const label = lock?.targetId === player.id ? findCountdownLabel(lock) : (nearby ? 'Fund starten · ' : 'Position wird bestätigt · ') + player.vehicle + ' · ' + player.color + ' · ' + player.name;
    if (button.textContent !== label) button.textContent = label;
    button.classList.toggle('findReady', !!nearby);
    button.disabled = findPending || !nearby || !!lock;
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
    feedback.textContent = result.status === 'LOCKED' ? 'Fund-Countdown gestartet. Ziel bleibt fest ausgewählt; seine Fahrt ist auf der Karte sichtbar.' : '✓ Bereits bestätigt.';
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
    renderFindButtons(state.lobby.players.filter(player=>player.role==='HIDER'&&!player.found&&!player.eliminated&&!player.left));
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
let leaveRetryTimer = null;
function pendingLeaves(){try{const rows=JSON.parse(localStorage.getItem('chsPendingLeaves')||'[]');return Array.isArray(rows)?rows.filter(p=>p&&typeof p.code==='string'&&typeof p.userId==='string'&&typeof p.authId==='string'):[];}catch{return [];}}
function hasPendingLeave(code){return pendingLeaves().some(p=>p.authId===authSession?.user?.id&&p.code===code);}
async function flushPendingLeaves(){
  if(leaveBusy||!authSession?.user)return;
  leaveBusy=true;clearTimeout(leaveRetryTimer);
  try{for(const entry of pendingLeaves().filter(p=>p.authId===authSession.user.id)){
    try{await api('leave',{code:entry.code,userId:entry.userId},'POST',AbortSignal.timeout(10000));}
    catch(error){if(![403,404].includes(error.status))continue;}
    localStorage.setItem('chsPendingLeaves',JSON.stringify(pendingLeaves().filter(p=>!(p.authId===entry.authId&&p.code===entry.code&&p.userId===entry.userId))));
  }}finally{leaveBusy=false;if(pendingLeaves().some(p=>p.authId===authSession?.user?.id))leaveRetryTimer=setTimeout(flushPendingLeaves,5000);}
}
if(typeof window!=='undefined')window.addEventListener('online',()=>void flushPendingLeaves());

async function leave() {
  if (!gameSession) return;
  const entry={...gameCredentials(),authId:authSession?.user?.id};
  const entries=pendingLeaves().filter(p=>!(p.authId===entry.authId&&p.code===entry.code));
  localStorage.setItem('chsPendingLeaves',JSON.stringify([...entries,entry]));
  resetGame();
  await flushPendingLeaves();
}


function resetGame() {
  sessionEpoch += 1;
  window.communityUI?.cancelIdentitySync?.();
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
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


  gpsStarting = false;
  gpsPhase = '';
  lastGpsRequestAt = 0;
  state = null;
  gameSession = null;
  window.chsMapReset?.();


  localStorage.removeItem(
    'chs'
  );
  hideRejoin();


  openPage(
    'home'
  );
}


/* =========================================================
   NAVIGATION
========================================================= */

// Keep complex controls closed while a driver is moving or GPS speed is unknown.
document.addEventListener('click',event=>{
  if(!gameSession||!state?.driverBlocked)return;
  if(!event.target.closest('[data-page], #freshSettingsButton, #freshChatButton, .profileMini'))return;
  event.preventDefault();event.stopImmediatePropagation();
  toast('Als Fahrer erst sicher anhalten, bevor du Menüs bedienst.');
},true);

$$('[data-page]')
  .forEach(button => {

    button.addEventListener(
      'click',
      event => {
        if (gameSession && document.getElementById('game')?.classList.contains('active')) {
          event.preventDefault();
          // The profileMini has its own overlay handler. Other page links are
          // intentionally ignored until the player leaves the current round.
          return;
        }
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
  if (!panel || !dialog) return;

  const settings = lobby.settings;

  updateLobbySettingsAccess(lobby);
  const backgroundField=document.getElementById('lobbyBackground');
  if(backgroundField&&!backgroundField.options.length)backgroundField.innerHTML=lobbyBackgroundOptions();

  if (settings) fillLobbySettings();

  const key = `${lobby.code}:${settings?.revision || 0}:${lobby.hostId}`;
  if (lobbySettingsKey && lobbySettingsKey !== key && dialog.open && !lobbySettingsSaving) {
    dialog.close();
    toast('Lobby-Einstellungen aktualisiert.');
  }
  lobbySettingsKey = key;

  if (!lobbySettingsBound) {
    lobbySettingsBound = true;
    document.getElementById('lobbyBackground')?.addEventListener('change', changeLobbyBackground);
    ['lobbyRadius', 'lobbyDuration', 'lobbyHeadstart', 'lobbyEscape', 'lobbyReplacement'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', saveFreshLobbySettings);
    });
  }
}

function fillLobbySettings() {
  const lobby = state?.lobby;
  const settings = lobby?.settings;
  if (!settings) return;

  const backgroundField=document.getElementById('lobbyBackground');
  if(backgroundField&&!backgroundField.disabled)backgroundField.value=lobbyScene.background(lobby.background);
  const values = {
    lobbyVisibility:lobby.visibility,
    lobbyMaxPlayers:settings.maxPlayers||20,
    lobbyRadius: settings.radius,
    lobbyDuration: settings.duration,
    lobbyHeadstart: settings.headstart,
    lobbyEscape: settings.escape ?? settings.escapeWindow ?? 15,
    lobbyReplacement: String(settings.replaceSeekers !== false)
  };

  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (!field || value == null || field === document.activeElement) continue;
    if (field.tagName === 'SELECT') {
      if ([...field.options].some(option => String(option.value) === String(value))) field.value = String(value);
    } else {
      field.value = String(value);
    }
    if(id==='lobbyRadius')syncRadiusChoice(field);
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
      visibility:value('lobbyVisibility')||lobby.visibility,
      maxPlayers:Number(value('lobbyMaxPlayers')||lobby.settings.maxPlayers||20),
      radius: Number(value('lobbyRadius') || lobby.settings.radius),
      duration: Number(value('lobbyDuration') || lobby.settings.duration),
      headstart: Number(value('lobbyHeadstart') || lobby.settings.headstart),
      escape: Number(value('lobbyEscape') || lobby.settings.escape || 15),
      replaceSeekers: value('lobbyReplacement') !== 'false'
    }));
    toast('Lobby-Einstellungen gespeichert.');
    await poll();
  } catch (error) {
    toast(error.message || 'Einstellungen konnten nicht gespeichert werden.');
    fillLobbySettings();
  } finally {
    lobbySettingsSaving = false;
    if (button) button.disabled = false;
    window.mobileDesign?.syncSettings();
  }
}

function syncRadiusChoice(field) {
  const choice=document.getElementById(field.id+'Choice');
  if(!choice)return;
  choice.value=[...choice.options].some(option=>option.value===field.value)?field.value:'custom';
  choice.disabled=field.disabled;
  field.hidden=choice.value!=='custom';
  const caption=document.getElementById(field.id+'Caption');
  if(caption)caption.hidden=field.hidden;
}

// The original numeric fields remain the source of truth for creation/settings.
function addSmallLobbyRadii() {
  for (const id of ['radius','lobbyRadius']) {
    const field = document.getElementById(id);
    if (!field) continue;
    if(document.getElementById(id+'Choice'))continue;
    field.min='50';field.max='10000';field.step='1';
    const choice=document.createElement('select');choice.id=id+'Choice';choice.setAttribute('aria-label','Radius auswählen');
    const presets=[50,...Array.from({length:100},(_,i)=>(i+1)*100),750].sort((a,b)=>a-b);
    for(const meters of presets){const option=document.createElement('option');option.value=String(meters);option.textContent=meters+' m';choice.append(option);}
    const custom=document.createElement('option');custom.value='custom';custom.textContent='Eigener Radius';choice.append(custom);
    const caption=document.createElement('span');caption.id=id+'Caption';caption.textContent='Radius eingeben';
    field.setAttribute('aria-label','Radius eingeben');field.before(choice,caption);
    choice.addEventListener('change',()=>{
      field.hidden=choice.value!=='custom';caption.hidden=field.hidden;
      if(choice.value==='custom'){field.focus();field.select();return;}
      field.value=choice.value;field.dispatchEvent(new Event('change',{bubbles:true}));
    });
    field.addEventListener('change',()=>syncRadiusChoice(field));syncRadiusChoice(field);
  }
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
function carPhotoMarkup(car,context='garage') {
  const source = vehiclePhotoSource(car?.photo);
  return source
    ? `<img src="${esc(source)}" alt="Foto von ${esc(`${car?.brand || ''} ${car?.model || ''}`.trim())}" style="display:block;width:100%;max-height:240px;object-fit:contain" loading="lazy" decoding="async">`
    : vehicleIllustration(car,context);
}

function vehiclePaintFilter(color) {
  const value=String(color||'').toLowerCase();
  if (/schwarz|black/.test(value)) return 'brightness(.24) contrast(1.22)';
  if (/weiß|weiss|white/.test(value)) return 'brightness(1.55) saturate(.16)';
  if (/grau|gray|grey/.test(value)) return 'brightness(.72) saturate(.22)';
  if (/blau|blue/.test(value)) return 'sepia(.35) saturate(4.2) hue-rotate(170deg) brightness(.72)';
  if (/rot|red/.test(value)) return 'sepia(.45) saturate(5) hue-rotate(320deg) brightness(.76)';
  if (/grün|gruen|green/.test(value)) return 'sepia(.45) saturate(4) hue-rotate(82deg) brightness(.68)';
  if (/orange/.test(value)) return 'sepia(.5) saturate(5) hue-rotate(342deg) brightness(.95)';
  if (/gelb|yellow/.test(value)) return 'sepia(.65) saturate(4.5) hue-rotate(5deg) brightness(1.05)';
  if (/braun|brown/.test(value)) return 'sepia(.6) saturate(2) hue-rotate(340deg) brightness(.55)';
  if (/beige/.test(value)) return 'sepia(.45) saturate(.8) brightness(1.12)';
  if (/lila|purple|violett|violet/.test(value)) return 'sepia(.45) saturate(4) hue-rotate(225deg) brightness(.72)';
  return 'none';
}

function vehicleIllustration(car,context='vehicle') {
  const template=vehicleCatalog.illustration(car || {});
  const filter=vehiclePaintFilter(car?.color);
  const image='<image href="assets/vehicle-lineup.webp" x="'+(-template.x)+'" y="'+(-template.y)+'" width="1536" height="1024" />';
  const paint=typeof vehiclePaint==='undefined'?'':vehiclePaint.path(template.index);
  const maskId='paint-'+String(context+'-'+(car?.id||'')+'-'+template.index).replace(/[^a-zA-Z0-9_-]/g,'');
  const componentPaths=paint.split('Z').filter(p=>p.trim()).map(p=>'<path d="'+p+'Z" fill="black" stroke="black" stroke-width="2" stroke-linejoin="round"/>').join('');
  const layer=paint&&filter!=='none'?'<defs><mask id="'+maskId+'" maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="280" style="mask-type:luminance"><rect width="384" height="280" fill="white"/>'+componentPaths+'</mask></defs><g mask="url(#'+maskId+')"><g class="vehiclePaintLayer" style="filter:'+filter+'">'+image+'</g></g>':'';
  return '<figure class="vehicleIllustration"><div class="vehicleRender vehicleRender--template" role="img" aria-label="Markenneutrale Fahrzeugansicht: '+esc(template.label)+'"><svg viewBox="0 0 384 280" aria-hidden="true" focusable="false">'+image+layer+'</svg></div><figcaption>Markenneutrale Fahrzeugvorlage · Karosseriefarbe angenähert</figcaption></figure>';
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
  if (preview) preview.innerHTML = vehicleIllustration({brand:$('#newCarBrand')?.value,model:$('#newCarModel')?.value,body:$('#newCarBody')?.value});
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
    const path = await uploadVehiclePhoto(car.id, photo, true);

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
      <label>CHARAKTER
        <select name="characterStyle">
          <option value="0">Mann · dunkle Jacke</option>
          <option value="1">Frau · helle Jacke</option>
          <option value="2">Mann · orange Jacke</option>
        </select>
      </label>
      <p class="muted">Der Charakter wird in der Lobby direkt mit deinem Fahrzeug inszeniert. Die Auswahl beeinflusst keine Spielwerte.</p>
      <label>DEIN LOBBY-HINTERGRUND
        <select name="lobbyBackground">${lobbyBackgroundOptions()}</select>
      </label><p class="muted">Voreinstellung für Lobbys, die du erstellst. In der Lobby kannst du den Hintergrund für alle ändern.</p>
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
        const characterStyle=setCharacterStyle(form.elements.characterStyle.value);
        const background=lobbyScene.background(form.elements.lobbyBackground.value);
        localStorage.setItem(lobbyBackgroundKey(),background);
        let preferenceSyncFailed=false;
        try {
          const { data: authUpdate, error: authUpdateError } = await supabaseClient.auth.updateUser({
            data: { character_style: characterStyle, lobby_background: background,
              chs_appearance: wardrobe.normalize({...window.accountUI.appearance(),classic:characterStyle,
                collection:characterStyle!==dialog._oldCharacterStyle?'classic':window.accountUI.appearance().collection}) }
          });
          if (authUpdateError) throw authUpdateError;
          if (authSession?.user?.id !== userId) return;
          if (authUpdate?.user && authSession) authSession = { ...authSession, user: authUpdate.user };
        } catch (metadataError) {
          preferenceSyncFailed=true;
          // The local preference remains usable; cloud sync can retry next save.
          console.error('Charakterauswahl konnte nicht ins Konto synchronisiert werden:', metadataError);
        }

        if (authSession?.user?.id !== userId) return;
        // Keep an already running lobby profile in sync without leaving the game.
        if (gameSession) {
          const currentSession={...gameSession};
          try {
            await api('identity', { ...playerData(), ...currentSession });
            if(gameSession?.userId===currentSession.userId&&state?.lobby?.hostId===currentSession.userId&&state?.lobby?.state==='LOBBY'&&state.lobby.background!==background){
              await api('background',{...currentSession,background});await poll();
            }
          }
          catch (syncError) { console.error('Lobby-Profil konnte nicht sofort aktualisiert werden:', syncError); }
        }

        renderProfile();
        dialog.close();
        toast(preferenceSyncFailed?'Profil gespeichert · Design nur auf diesem Gerät gespeichert.':'Profil und Design gespeichert ✓');
      } catch(error) { errorNode.textContent = error.message; }
      finally { dialog._busy = false; setProfileFormBusy(form, false); }
    });
    dialog.addEventListener('cancel', event => { if (dialog._busy) event.preventDefault(); });
  }
  if (dialog._busy) return;
  const form = dialog.querySelector('form');
  dialog._userId = authSession.user.id; dialog._photo = '__KEEP__';
  form.elements.username.value = dbProfile.username || '';
  form.elements.characterStyle.value = String(getCharacterStyle());
  dialog._oldCharacterStyle = getCharacterStyle();
  form.elements.lobbyBackground.value = getLobbyBackground();
  form.elements.photo.value = '';
  form.querySelector('[data-profile-error]').textContent = '';
  renderProfilePreview(dialog, dbProfile.avatar_url);
  if (!dialog.open) dialog.showModal();
  form.elements.username.focus();
}
function setProfileFormBusy(form, busy) {
  for (const control of form.querySelectorAll('input,select,button')) control.disabled = busy;
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
  const actor=authSession?.user?.id;
  api('personal-stats',{},'GET').then(stats=>{if(!dialog.isConnected||actor!==authSession?.user?.id)return;const p=document.createElement('p');p.textContent='Beta-Erfassung: '+stats.seekerRounds+' Sucherrunden · '+stats.hiderRounds+' Versteckerrunden · Ø Überleben '+(stats.averageSurvivalSeconds===null?'noch keine Daten':formatTime(stats.averageSurvivalSeconds));body.append(p);}).catch(()=>{});
}
function setupProfileActions() {
  document.querySelector('#profile .settingsButton')?.addEventListener('click', openProfileEditor);
  document.querySelector('.profileMini')?.addEventListener('click', event => {
    if (gameSession && document.getElementById('game')?.classList.contains('active')) {
      event.preventDefault();
      event.stopPropagation();
      openLobbyPlayerCard(state?.lobby?.me?.id);
      return;
    }
    openProfileEditor();
  });
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

  document.getElementById('players')?.addEventListener('click',event=>{
    const control=event.target.closest('[data-parking-step],[data-parking-page]');
    if(!control)return;
    const crew=document.getElementById('players'),viewport=crew.querySelector('.parkingViewport');
    if(!viewport)return;
    const page=control.hasAttribute('data-parking-page') ? Number(control.dataset.parkingPage) : Math.round(viewport.scrollLeft/viewport.clientWidth)+Number(control.dataset.parkingStep);
    crew.dataset.targetPage=String(page);
    viewport.scrollTo({left:page*viewport.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    const selected=control.dataset.parkingPlayer;
    if(selected){
      crew.dataset.selectedPlayer=selected;
      crew.querySelectorAll('.parkingPlayer').forEach(player=>player.classList.toggle('isSelected',player.dataset.parkingId===selected));
      crew.querySelectorAll('.parkingCrewMember').forEach(member=>member.setAttribute('aria-pressed',String(member.dataset.parkingPlayer===selected)));
    }
  });


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
    if (game.classList.contains('chatDrawerOpen')) game.classList.remove('chatDrawerOpen');
  };

  const setChatOpen = open => {
    if (!chatDrawer) return;
    if(open&&state?.driverBlocked){toast('Als Fahrer erst sicher anhalten, bevor du den Chat bedienst.');return;}

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
    if (game?.classList.contains('chatDrawerOpen')) game.classList.remove('chatDrawerOpen');

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
    if (game?.classList.contains('chatDrawerOpen')) game.classList.remove('chatDrawerOpen');
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
  const colors={schwarz:'#17191c',black:'#17191c',weiß:'#ecece8',weiss:'#ecece8',white:'#ecece8',grau:'#777d84',gray:'#777d84',grey:'#777d84',silber:'#aeb4ba',silver:'#aeb4ba',blau:'#245ca9',blue:'#245ca9',rot:'#a81c22',red:'#a81c22',grün:'#28653f',gruen:'#28653f',green:'#28653f',orange:'#e96619',gelb:'#e5c328',yellow:'#e5c328',braun:'#5d4032',brown:'#5d4032',beige:'#b8aa8e',lila:'#68408b',violett:'#68408b',violet:'#68408b',purple:'#68408b'};
  for(const [name,hex] of Object.entries(colors))if(value.includes(name))return hex;
  return '#737981';
}
function isLobbyCutout(source) {
  if (!source) return false;
  if (/^data:image\/(?:png|webp);base64,/i.test(source)) return true;
  try {
    const path = new URL(source).pathname.toLowerCase();
    return path.includes('.cutout.png') || path.includes('.cutout.webp');
  }
  catch { return false; }
}

function lobbyCarMarkup(player,mine=false,context='lobby'){
  const ownPhoto = mine ? vehiclePhotoSource(activeCar()?.photo) : '';
  const source = ownPhoto || vehiclePhotoSource(player?.photoUrl);

  // Always prefer the player's real vehicle photo. New uploads are transparent
  // cut-outs; older photos remain visible immediately and are migrated in the
  // background instead of being replaced by a generic coloured car.
  if (source) {
    const rawClass = isLobbyCutout(source) ? '' : ' lobbyModelCar--raw';
    return `<img class="lobbyModelCar${rawClass}" src="${esc(source)}" alt="${esc(player.vehicle || 'Fahrzeug')}" draggable="false" loading="lazy" decoding="async">`;
  }

  return vehicleIllustration({id:player.id,vehicle:player.vehicle,body:player.bodyType,color:player.color},context);
}

function lobbyProfileMarkup(player) {
  const source = profileImageSource(player?.avatarUrl);
  const content = source
    ? `<img src="${esc(source)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : esc(initials(player?.name || 'Spieler'));

  return `<button type="button" class="freshLobbyProfile ${source?'':'isFallback'}" data-lobby-card="${esc(player?.id || '')}" aria-label="Profil von ${esc(player?.name || 'Spieler')} ansehen">${content}</button>`;
}

function lobbyCharacterMarkup(player) {
  if (player?.appearance && typeof wardrobe !== 'undefined') return wardrobe.markup(player.appearance);
  let hash=0;for(const ch of String(player.profileId||player.id))hash=(hash*31+ch.charCodeAt(0))>>>0;
  const fallback=hash%3;
  const skin=Number.isInteger(player?.characterStyle) ? Math.max(0,Math.min(2,player.characterStyle)) : fallback;
  return `<span class="lobbyCrewCharacter lobbyCrewCharacter--${skin} lobbyCrewPose--side" aria-hidden="true"></span>`;
}

function openLobbyPlayerCard(playerId) {
  const player = state?.lobby?.players?.find(item => item.id === playerId);
  if (!player) return;

  let dialog = document.getElementById('lobbyPlayerCardDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'lobbyPlayerCardDialog';
    dialog.className = 'productDialog lobbyPlayerCardDialog';
    dialog.innerHTML = '<button class="dialogClose" type="button" aria-label="Schließen">×</button><div data-lobby-player-card></div>';
    document.body.append(dialog);
    dialog.querySelector('.dialogClose')?.addEventListener('click',()=>dialog.close());
  }

  const source = profileImageSource(player.avatarUrl);
  const avatar = source
    ? `<img src="${esc(source)}" alt="Profilbild von ${esc(player.name)}">`
    : `<span>${esc(initials(player.name))}</span>`;
  const mine = player.id === state?.lobby?.me?.id;
  dialog.querySelector('[data-lobby-player-card]').innerHTML = `
    <div class="lobbyPlayerCardAvatar">${avatar}</div>
    <span class="sectionEyebrow">${mine?'DEIN PROFIL':'CREW-PROFIL'}</span>
    <h2>${esc(player.name)}</h2>
    <p>Level ${Number(player.level)||1} · ${esc(player.vehicle||'Kein Fahrzeug')}</p>
    <div class="lobbyPlayerCardVehicle">${lobbyCarMarkup(player,mine)}</div>
    ${mine
      ? '<button type="button" class="primaryButton" data-edit-own-lobby-profile>PROFIL BEARBEITEN</button>'
      : (player.profileId ? `<button type="button" data-lobby-profile="${esc(player.id)}">FREUNDSCHAFT</button>` : '')}
  `;
  dialog.querySelector('[data-edit-own-lobby-profile]')?.addEventListener('click',()=>{dialog.close();openProfileEditor();},{once:true});
  if (!mine && typeof playerModerationActions === 'function') dialog.querySelector('[data-lobby-player-card]').append(playerModerationActions(player));
  if (!dialog.open) dialog.showModal();
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', event => {
    const profile = event.target.closest?.('[data-lobby-card]');
    if (profile) {
      event.preventDefault();
      event.stopPropagation();
      openLobbyPlayerCard(profile.dataset.lobbyCard);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    if (gameSession) showRejoin('Keine Internetverbindung. Deine letzte GPS-Position bleibt für die Runde gespeichert.');
  });
  window.addEventListener('online', () => {
    if (gameSession && connectionLost) rejoinGame();
  });
}


// Four readable rear slots per parking section. The host stays in a separate
// foreground layer, so paging a large crew never shrinks or removes the host.
function updateLobbySettingsAccess(lobby) {
  const host=lobby.hostId===lobby.me.id,waiting=lobby.state==='LOBBY';
  const button=document.getElementById('freshSettingsButton'),dialog=document.getElementById('freshSettingsDialog');
  if(button){button.hidden=!host;button.disabled=!waiting||!lobby.settings||lobbySettingsSaving;button.title=waiting?'Lobby anpassen':'Während der Runde gesperrt';}
  if((!host||!waiting)&&dialog?.open)dialog.close();
}
function parkingLayout(players) {
  return lobbyScene.layout(players);
}
function parkingAvatarMarkup(player) {
  const source=profileImageSource(player?.avatarUrl);
  return source ? '<img src="'+esc(source)+'" alt="" loading="lazy" decoding="async">' : player?.vehicle||player?.photoUrl ? '<span class="vehicleAvatar">'+lobbyCarMarkup(player,false,'avatar')+'</span>' : esc(initials(player?.name || 'Spieler'));
}
function parkingStatus(player) {
  return !player.connected?'Verbindung…':player.ready?'Bereit':'Wartet';
}
function parkingPlayerMarkup(player,lobby,slot) {
  const owner=player.id===lobby.hostId,mine=player.id===lobby.me.id;
  const position=slot ? '--parking-x:'+slot.x+'%;--parking-left:'+(slot.x-slot.width/2)+'%;--parking-width:'+slot.width+'%;--parking-ground:'+slot.ground+'%;' : '';
  return '<article class="parkingPlayer '+(owner?'isHost':slot?.row?'isMiddle':'isRear')+' '+(player.ready?'isReady':'')+'" style="'+position+'--car-color:'+lobbyCarColor(player.color)+'" data-parking-id="'+esc(player.id)+'">'
    +'<button class="parkingNameplate" type="button" data-lobby-card="'+esc(player.id)+'" aria-label="Profil von '+esc(player.name)+' ansehen"><span class="parkingAvatar">'+parkingAvatarMarkup(player)+'</span><strong>'+esc(player.name)+'</strong>'
    +(owner?'<span class="parkingHostBadge">♛ HOST</span>':mine?'<span class="parkingYouBadge">DU</span>':'')+'<i class="parkingReadyDot" aria-label="'+parkingStatus(player)+'"></i></button>'
    +'<div class="parkingVehicleStage"><span class="parkingContactShadow" aria-hidden="true"></span>'+lobbyCarMarkup(player,mine)+lobbyCharacterMarkup(player)+'</div></article>';
}
function parkingLobbyMarkup(lobby,hostPlayer,others) {
  const lead=hostPlayer||lobby.players.find(p=>p.id===lobby.me.id);
  const layout=parkingLayout(lobby.players.filter(p=>p.id!==lead?.id));
  const ordered=hostPlayer?[hostPlayer,...others]:lobby.players;
  const waiting=ordered.filter(player=>!player.ready||!player.connected);
  const readiness=(ordered.length-waiting.length)+'/'+ordered.length+' bereit · '+(waiting.length===1?'Warte auf '+esc(waiting[0].name):waiting.length?'Warte auf '+waiting.length+' Spieler':'Crew bereit');
  return '<div class="parkingViewport" tabindex="0" role="region" aria-label="Parkplatz deiner Crew. Weitere Parkplätze seitlich ansehen." style="--parking-pages:'+layout.pages+'"><div class="parkingScene">'
    +layout.slots.map(slot=>parkingPlayerMarkup(slot.player,lobby,slot)).join('')+'</div></div>'
    +(lead?'<div class="freshCrewLead">'+parkingPlayerMarkup(lead,lobby)+'</div>':'')
    +'<div class="parkingNavigation" '+(layout.pages===1?'hidden':'')+'><button type="button" data-parking-step="-1" aria-label="Vorherige Parkreihe">‹</button><span data-parking-progress>Parkreihe 1 / '+layout.pages+'</span><button type="button" data-parking-step="1" aria-label="Nächste Parkreihe">›</button></div>'
    +'<div class="parkingCrewStrip" role="group" aria-label="Alle '+ordered.length+' Spieler in der Lobby">'+ordered.map(player=>{
      const owner=player.id===lobby.hostId;
      const page=owner?0:(layout.slots.find(slot=>slot.player.id===player.id)?.page || 0);
      return '<button class="parkingCrewMember '+(owner?'isHost':'')+' '+(player.ready?'isReady':'')+'" type="button" data-parking-page="'+page+'" data-parking-player="'+esc(player.id)+'" aria-label="'+esc(player.name)+', '+(owner?'Host, ':'')+parkingStatus(player)+', '+(player.hasLocation?'GPS bereit':'GPS fehlt')+'"><span class="parkingStripAvatar">'+parkingAvatarMarkup(player)+'</span><strong>'+(owner?'♛ ':'')+esc(player.name)+'</strong><small>'+parkingStatus(player)+'</small></button>';
    }).join('')+'</div><p class="parkingReadiness" aria-live="polite">'+readiness+'</p>'
    +(lobby.players.length<2?'<button class="parkingInvite" type="button" data-open-lobby-invite>＋ Freunde auf den Parkplatz einladen</button>':'');
}
function syncParkingNavigation(crew) {
  const viewport=crew.querySelector('.parkingViewport');
  if(!viewport)return;
  const pages=Math.max(1,Math.round(viewport.scrollWidth/viewport.clientWidth));
  const page=Math.min(pages-1,Math.round(viewport.scrollLeft/viewport.clientWidth));
  const label=crew.querySelector('[data-parking-progress]');
  if(label)label.textContent='Parkreihe '+(page+1)+' / '+pages;
  const back=crew.querySelector('[data-parking-step="-1"]'),next=crew.querySelector('[data-parking-step="1"]');
  if(back)back.disabled=page===0;
  if(next)next.disabled=page>=pages-1;
}

function renderFreshLobby() {
  if(!state?.lobby)return;
  ensureFreshLobby();
  const lobby=state.lobby,waiting=lobby.state==='LOBBY',host=lobby.hostId===lobby.me.id;
  const game=document.getElementById('game');game.classList.toggle('freshWaiting',waiting);game.classList.toggle('liveRound',!waiting);
  document.getElementById('freshRoomLabel').textContent=waiting?'DEIN WARTERAUM':lobby.state==='HEADSTART'?'VERSTECKPHASE':lobby.state==='RESULT'?'RUNDE BEENDET':'RUNDE LÄUFT';
  const settings=document.getElementById('lobbySettingsPanel');
  const settingsDialog=document.getElementById('freshSettingsDialog');
  if(settings&&settings.parentNode!==settingsDialog)settingsDialog.append(settings);
  updateLobbySettingsAccess(lobby);
  const phase=lobby.code + ':' + waiting + ':' + host;
  const mapFold=document.getElementById('freshMapFold');
  if(freshLobbyPhase!==phase){
    if(mapFold)mapFold.open=!waiting||!host;
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
    if(mapFold.nextElementSibling!==targetPanel)mapFold.after(targetPanel);
    if(targetPanel.nextElementSibling!==crewPanel)targetPanel.after(crewPanel);
  } else {
    if(crewPanel.nextElementSibling!==mapFold)mapFold.before(crewPanel);
    if(mapFold.nextElementSibling!==targetPanel)mapFold.after(targetPanel);
  }
  const hostPlayer=lobby.players.find(player=>player.id===lobby.hostId);
  const others=lobby.players.filter(player=>player.id!==lobby.hostId);
  const half=Math.ceil(others.length/2);
  const displayPlayers=hostPlayer?[...others.slice(0,half),hostPlayer,...others.slice(half)]:[...lobby.players];
  const crew=document.getElementById('players');
  crew.dataset.formation=lobby.players.length===1?'solo':lobby.players.length===2?'pair':'crew';
  crew.dataset.background=lobbyScene.background(lobby.background);
  game.dataset.background=crew.dataset.background;
  game.style?.setProperty('--lobby-background','url("'+lobbyScene.backgrounds.find(b=>b.id===crew.dataset.background).image+'")');
  const sameLobby=crew.dataset.lobbyCode===lobby.code;
  if(!sameLobby){crew.dataset.lobbyCode=lobby.code;delete crew.dataset.selectedPlayer;}
  const renderPlayer=player=>{
    const mine=player.id===lobby.me.id,owner=player.id===lobby.hostId;
    const status=player.eliminated?'AUSGESCHIEDEN':player.found?'GEFUNDEN':!player.connected?'VERBINDUNG…':waiting?(player.ready?'BEREIT':'WARTET'):player.role==='SEEKER'?'SUCHER':'VERSTECKER';
    return `<article class="freshPlayerCard ${mine?'isYou':''} ${owner?'isHost':''} ${player.ready?'isReady':''} ${player.found?'isFound':''}" style="--crew-color:${freshPlayerColor(player.id)};--car-color:${lobbyCarColor(player.color)}">
      <div class="freshPlayerTop"><span>${owner?'♛ HOST':mine?'DU':'CREW'}</span><span class="freshConnection ${player.connected?'online':''}"></span></div>
      <div class="freshPlayerIdentity"><span class="parkingStripAvatar">${parkingAvatarMarkup(player)}</span><h3>${esc(player.name)}${mine?'<small>DU</small>':''}</h3>${lobbyProfileMarkup(player)}</div>
      <div class="freshAvatarStage">${lobbyCarMarkup(player,mine)}${waiting?lobbyCharacterMarkup(player):''}<span class="freshPlatform"></span></div>
      <p class="freshVehicleName">${esc(player.vehicle||'Kein Fahrzeug')}</p>
      <p class="freshVehicleColor">${esc(player.color||'Keine Farbe')} · Level ${Number(player.level)||1}</p>
      <div class="freshPlayerStatus">${player.ready||player.found?'✓ ':''}${status}</div>
      <small class="freshGpsState">${player.hasLocation?'● GPS bereit':'○ Warte auf GPS'}</small>
      ${!mine && player.profileId ? `<button type="button" class="lobbyFriendButton" data-lobby-profile="${esc(player.id)}">Freundschaft</button>` : ''}
    </article>`;
  };
  const crewMarkup=waiting
    ? parkingLobbyMarkup(lobby, hostPlayer, others)
    : displayPlayers.map(renderPlayer).join('');
  if(crew.dataset.markup!==crewMarkup){
    const previousScroll=sameLobby ? crew.querySelector?.('.parkingViewport')?.scrollLeft || 0 : 0;
    crew.innerHTML=crewMarkup;crew.dataset.markup=crewMarkup;
    const viewport=crew.querySelector?.('.parkingViewport');
    if(viewport){
      const offset=sameLobby&&crew.dataset.targetPage!==undefined ? Number(crew.dataset.targetPage)*viewport.clientWidth : previousScroll;
      viewport.scrollTo({left:offset,behavior:'instant'});
      delete crew.dataset.targetPage;
      viewport.addEventListener('scroll',()=>syncParkingNavigation(crew),{passive:true});
      viewport.addEventListener('scrollend',()=>{delete crew.dataset.targetPage;},{passive:true});
      viewport.addEventListener('pointerdown',()=>{delete crew.dataset.targetPage;},{passive:true});
      viewport.addEventListener('wheel',()=>{delete crew.dataset.targetPage;},{passive:true});
      syncParkingNavigation(crew);
      if(crew.dataset.selectedPlayer){
        crew.querySelectorAll('.parkingPlayer').forEach(player=>player.classList.toggle('isSelected',player.dataset.parkingId===crew.dataset.selectedPlayer));
        crew.querySelectorAll('.parkingCrewMember').forEach(member=>member.setAttribute('aria-pressed',String(member.dataset.parkingPlayer===crew.dataset.selectedPlayer)));
      }
    }
  }
  if(typeof renderLobbyChat==='function')renderLobbyChat();
  if(typeof syncLobbyInviteButton==='function')syncLobbyInviteButton();
  updateFreshChat();
  if(typeof window!=='undefined')window.communityUI?.renderLobby(lobby);
}

function lobbyBackgroundKey() { return 'chsLobbyBackground:'+ (authSession?.user?.id || 'guest'); }
function getLobbyBackground() {
  const local=localStorage.getItem(lobbyBackgroundKey());
  return lobbyScene.background(lobbyScene.validBackground(local)?local:authSession?.user?.user_metadata?.lobby_background);
}
function lobbyBackgroundOptions() {
  return lobbyScene.backgrounds.map(background=>'<option value="'+background.id+'">'+background.name+'</option>').join('');
}
async function changeLobbyBackground(event) {
  const field=event.currentTarget;
  if(state?.lobby?.hostId!==state?.lobby?.me?.id||state?.lobby?.state!=='LOBBY')return;
  field.disabled=true;
  try {
    await api('background',gameCredentials({background:field.value}));
    await poll();
    toast('Hintergrund für die Crew geändert.');
  } catch(error) { toast(error.message); }
  finally { field.disabled=false;fillLobbySettings();window.mobileDesign?.syncSettings(); }
}
