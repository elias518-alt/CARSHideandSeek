let session = JSON.parse(localStorage.getItem('chs') || 'null');
let watch = null;
let state = null;
let pollTimer = null;
let gpsStarting = false;
let gpsPositionReceived = false;

const $ = s => document.querySelector(s);

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

/* =========================
   TOAST / MELDUNGEN
========================= */

const toast = t => {
  const x = $('#toast');

  if (!x) {
    console.log(t);
    return;
  }

  x.textContent = t;
  x.classList.add('show');

  setTimeout(() => {
    x.classList.remove('show');
  }, 2800);
};


/* =========================
   API
========================= */

async function api(path, data = {}, method = 'POST') {

  let url = '/api/' + path;

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (method === 'GET') {
    url += '?' + new URLSearchParams(data);
  } else {
    opts.body = JSON.stringify(data);
  }

  const r = await fetch(url, opts);

  let j;

  try {
    j = await r.json();
  } catch {
    throw new Error('Ungültige Serverantwort');
  }

  if (!r.ok) {
    const e = new Error(j.error || 'Unbekannter Fehler');
    e.data = j;
    throw e;
  }

  return j;
}


/* =========================
   SESSION
========================= */

const creds = x => ({
  code: session?.code,
  userId: session?.userId,
  ...(x || {})
});

const profile = () => ({
  name: $('#name')?.value.trim() || 'Spieler',
  vehicle: $('#vehicle')?.value.trim() || 'Unbekannt',
  color: $('#color')?.value.trim() || 'Unbekannt',
  mode: $('#mode')?.value || 'PASSENGER'
});


/* =========================
   LOBBY ERSTELLEN
========================= */

async function create() {

  try {

    const j = await api('create', {
      ...profile(),

      lobbyName:
        $('#lname')?.value || 'NIGHT HUNT',

      radius:
        +$('#radius')?.value || 3000,

      duration:
        +$('#duration')?.value || 900,

      headstart:
        +$('#headstart')?.value || 180,

      escape:
        +$('#escape')?.value || 15
    });

    save(j);

    show();

  } catch (e) {

    toast(e.message);

  }
}


/* =========================
   LOBBY BEITRETEN
========================= */

async function join() {

  try {

    const lobbyCode =
      ($('#code')?.value || '')
        .trim()
        .toUpperCase();

    if (!lobbyCode) {
      toast('Bitte Lobby-Code eingeben.');
      return;
    }

    const j = await api('join', {
      ...profile(),
      code: lobbyCode
    });

    save(j);

    show();

  } catch (e) {

    toast(e.message);

  }
}


/* =========================
   SESSION SPEICHERN
========================= */

function save(j) {

  session = {
    code: j.lobby.code,
    userId: j.userId
  };

  localStorage.setItem(
    'chs',
    JSON.stringify(session)
  );
}


/* =========================
   GAME SCREEN
========================= */

function show() {

  $('#home')?.classList.add('hidden');
  $('#game')?.classList.remove('hidden');

  poll();

  /*
   GPS AUTOMATISCH STARTEN

   Der Spieler muss NICHT mehr manuell
   auf GPS klicken.
  */

  setTimeout(() => {

    if (watch === null && !gpsStarting) {
      gps();
    }

  }, 500);
}


/* =========================
   SERVER POLLING
========================= */

async function poll() {

  clearTimeout(pollTimer);

  if (!session) return;

  try {

    state = await api(
      'state',
      creds(),
      'GET'
    );

    render();

  } catch (e) {

    console.error(e);

    /*
     Wenn Render neu gestartet wurde,
     existiert die alte In-Memory-Lobby
     nicht mehr.
    */

    if (
      e.message.includes('Session') ||
      e.message.includes('Lobby nicht gefunden')
    ) {

      toast(
        e.message.includes('Lobby')
          ? 'Die Lobby existiert nicht mehr.'
          : 'Deine Sitzung ist nicht mehr gültig.'
      );

      setTimeout(() => {
        reset();
      }, 1500);

      return;
    }

    toast(e.message);
  }

  pollTimer = setTimeout(
    poll,
    1000
  );
}


/* =========================
   TIMER
========================= */

function fmt(sec) {

  sec = Math.max(
    0,
    Math.ceil(sec)
  );

  return (
    `${Math.floor(sec / 60)}:` +
    `${String(sec % 60).padStart(2, '0')}`
  );
}


/* =========================
   RENDER
========================= */

function render() {

  if (!state?.lobby) return;

  const l = state.lobby;
  const me = l.me;
  const t = state.serverTime;

  if (!me) return;


  /* Lobby Informationen */

  if ($('#lobbyName'))
    $('#lobbyName').textContent = l.name;

  if ($('#lobbyCode'))
    $('#lobbyCode').textContent = l.code;

  if ($('#state'))
    $('#state').textContent = l.state;

  if ($('#count'))
    $('#count').textContent = `${l.players.length}`;


  /* Rolle */

  if ($('#role')) {

    $('#role').textContent =
      me.role === 'SEEKER'
        ? '🔎 SUCHER'
        : me.role === 'HIDER'
        ? '👤 VERSTECKER'
        : 'OFFEN';

  }


  /* Fahrer Warnung */

  $('#driverWarning')?.classList.toggle(
    'hidden',
    me.mode !== 'DRIVER'
  );


  /* Timer */

  let end;

  if (l.state === 'COUNTDOWN') {
    end = l.countdownEndsAt;
  }

  else if (l.state === 'HEADSTART') {
    end = l.headstartEndsAt;
  }

  else {
    end = l.endsAt;
  }

  if ($('#timer')) {

    $('#timer').textContent =
      end
        ? fmt((end - t) / 1000)
        : '–';

  }


  /* Bereit */

  if ($('#ready')) {

    $('#ready').textContent =
      me.ready
        ? '✓ BEREIT'
        : 'BEREIT';

    $('#ready').classList.toggle(
      'active',
      me.ready
    );

    $('#ready').classList.toggle(
      'hidden',
      l.state !== 'LOBBY'
    );

  }


  /* =========================
     GPS STATUS
  ========================= */

  if ($('#gpsDot')) {

    $('#gpsDot').classList.toggle(
      'on',
      me.hasLocation
    );

  }

  /*
   Sobald der Server bestätigt,
   dass er eine Position besitzt,
   wissen wir sicher, dass GPS
   übertragen wurde.
  */

  if (me.hasLocation) {

    gpsPositionReceived = true;

    if ($('#gps')) {
      $('#gps').textContent =
        'GPS AKTIV ✓';
    }

  }


  /* =========================
     MANUELLER STARTPUNKT
     NICHT MEHR BENÖTIGT
  ========================= */

  if ($('#setStart')) {

    $('#setStart').classList.add(
      'hidden'
    );

  }


  /* =========================
     SPIEL STARTEN
  ========================= */

  if ($('#start')) {

    const isHost =
      l.hostId === me.id;

    const enoughPlayers =
      l.players.length >= 2;

    const inLobby =
      l.state === 'LOBBY';

    $('#start').classList.toggle(
      'hidden',
      !isHost || !inLobby || !enoughPlayers
    );

    /*
     Start erst erlauben,
     wenn Host GPS besitzt.
    */

    $('#start').disabled =
      isHost &&
      inLobby &&
      enoughPlayers &&
      !me.hasLocation;

    if (
      isHost &&
      inLobby &&
      enoughPlayers &&
      !me.hasLocation
    ) {

      $('#start').textContent =
        'POSITION WIRD ERMITTELT...';

    }

    else {

      $('#start').textContent =
        'SPIEL STARTEN';

    }

  }


  /* =========================
     NÄHE / GEGNER
  ========================= */

  const pr = state.proximity;

  let txt =
    me.hasLocation
      ? 'GPS aktiv. Warte auf verwertbare Gegnerdaten.'
      : 'Standort wird ermittelt...';

  if (pr) {

    if (pr.level === 'VERY_CLOSE') {

      txt =
        `⚠️ EXTREM NAH · ca. ${pr.distance} m`;

    }

    else if (pr.level === 'CLOSE') {

      txt =
        `⚠️ SEHR NAH · ca. ${pr.distance} m`;

    }

    else if (pr.level === 'NEAR') {

      txt =
        `⚠️ JEMAND NÄHERT SICH · ca. ${pr.distance} m`;

    }

    else {

      txt =
        `Kein Gegner in direkter Nähe · ca. ${pr.distance} m`;

    }


    if ($('#enemyDot')) {

      $('#enemyDot').classList.remove(
        'hidden'
      );

      const px =
        Math.min(
          115,
          25 + pr.distance / 2
        );

      $('#enemyDot').style.transform =
        `translate(` +
        `${Math.cos(t / 700) * px}px,` +
        `${Math.sin(t / 700) * px}px)`;

    }

  }

  else {

    $('#enemyDot')?.classList.add(
      'hidden'
    );

  }


  if ($('#proximity')) {

    $('#proximity').textContent = txt;

    $('#proximity').classList.toggle(
      'hot',
      !!pr && pr.distance < 50
    );

  }


  /* =========================
     ESCAPE TIMER
  ========================= */

  const escLeft =
    Math.ceil(
      (state.escapeUntil - t) / 1000
    );

  if ($('#escapeBox')) {

    $('#escapeBox').classList.toggle(
      'hidden',
      !(
        escLeft > 0 &&
        me.role === 'HIDER'
      )
    );

  }

  if ($('#escapeTimer')) {

    $('#escapeTimer').textContent =
      Math.max(
        0,
        escLeft
      );

  }


  /* =========================
     SPIELERLISTE
  ========================= */

  if ($('#players')) {

    $('#players').innerHTML =
      l.players.map(p => `

        <div class="player ${p.found ? 'found' : ''}">

          <div class="avatar">
            ${
              p.role === 'SEEKER'
                ? '🔎'
                : p.role === 'HIDER'
                ? '👤'
                : '🚘'
            }
          </div>

          <div class="pdata">

            <b>
              ${esc(p.name)}
              ${
                p.id === l.hostId
                  ? '<em>HOST</em>'
                  : ''
              }
            </b>

            <small>
              ${esc(p.vehicle)}
              ·
              ${esc(p.color)}
            </small>

            <small>
              ${
                p.connected
                  ? '● Online'
                  : '○ Reconnect…'
              }
              · Lv. ${p.level}
            </small>

          </div>

          <div>
            ${p.ready ? '✓' : ''}
            ${p.found ? ' FOUND' : ''}
          </div>

        </div>

      `).join('');

  }


  /* =========================
     FUNDZIELE
  ========================= */

  const targets =
    l.players.filter(
      p =>
        p.role === 'HIDER' &&
        !p.found
    );

  const canFind =
    me.role === 'SEEKER' &&
    l.state === 'ACTIVE';


  $('#targets')?.classList.toggle(
    'hidden',
    !canFind
  );


  if ($('#targetButtons')) {

    $('#targetButtons').innerHTML =
      targets.map(p => `

        <button
          class="danger"
          onclick="found('${p.id}')"
        >
          🚘
          ${esc(p.vehicle)}
          ·
          ${esc(p.color)}
        </button>

      `).join('');

  }


  /* Fund Cooldown */

  const cd =
    Math.ceil(
      (state.cooldownUntil - t) / 1000
    );

  if ($('#cooldown')) {

    $('#cooldown').textContent =
      cd > 0
        ? `Nächster Fundversuch in ${fmt(cd)}`
        : '';

  }


  /* =========================
     RESULT
  ========================= */

  $('#result')?.classList.toggle(
    'hidden',
    l.state !== 'RESULT'
  );


  if (l.state === 'RESULT') {

    const win =
      l.result?.seekersWin;

    if ($('#resultTitle')) {

      $('#resultTitle').textContent =
        win
          ? 'SUCHER GEWINNEN'
          : 'VERSTECKER GEWINNEN';

    }


    if ($('#resultText')) {

      $('#resultText').textContent =
        `${l.result?.found || 0} von ` +
        `${l.result?.totalHiders || 0} ` +
        `Versteckern gefunden.`;

    }


    if ($('#xpGain')) {

      $('#xpGain').textContent =
        me.role === 'SEEKER'
          ? 100 +
            (l.result?.found || 0) * 80
          : me.found
          ? 140
          : 280;

    }


    $('#rematch')?.classList.toggle(
      'hidden',
      l.hostId !== me.id
    );

  }

}


/* =========================
   GPS
========================= */

function gps() {

  if (!navigator.geolocation) {

    toast(
      'Dieses Gerät unterstützt keine Standortabfrage.'
    );

    return;
  }


  if (watch !== null || gpsStarting) {
    return;
  }


  gpsStarting = true;

  if ($('#gps')) {

    $('#gps').textContent =
      'GPS WIRD ERMITTELT...';

  }


  /*
   watchPosition bleibt aktiv und
   liefert laufend neue Positionen.
  */

  watch =
    navigator.geolocation.watchPosition(

      async position => {

        gpsStarting = false;

        const coords =
          position.coords;

        try {

          await api(
            'location',
            creds({
              lat: coords.latitude,
              lng: coords.longitude,
              accuracy:
                coords.accuracy,
              altitude:
                coords.altitude,
              speed:
                coords.speed
            })
          );


          gpsPositionReceived = true;


          if ($('#gps')) {

            $('#gps').textContent =
              'GPS AKTIV ✓';

          }


          $('#gpsDot')?.classList.add(
            'on'
          );

        }

        catch (e) {

          console.error(
            'Standortübertragung fehlgeschlagen:',
            e
          );

        }

      },


      error => {

        console.error(
          'GPS Fehler:',
          error
        );

        gpsStarting = false;

        /*
         Watch zurücksetzen,
         damit erneut versucht werden kann.
        */

        if (watch !== null) {

          navigator.geolocation.clearWatch(
            watch
          );

        }

        watch = null;


        if ($('#gps')) {

          $('#gps').textContent =
            'GPS ERNEUT VERSUCHEN';

        }


        if (error.code === 1) {

          toast(
            'Standortzugriff wurde nicht erlaubt. Bitte Standort für diese Webseite freigeben.'
          );

        }

        else if (error.code === 2) {

          toast(
            'Deine aktuelle Position konnte nicht bestimmt werden.'
          );

        }

        else if (error.code === 3) {

          toast(
            'GPS benötigt länger. Bitte erneut versuchen.'
          );

        }

        else {

          toast(
            'GPS: ' + error.message
          );

        }

      },


      {
        enableHighAccuracy: true,

        /*
         Keine alte gecachte Position
         verwenden.
        */

        maximumAge: 0,

        /*
         Bis zu 20 Sekunden auf
         GPS warten.
        */

        timeout: 20000
      }

    );

}


/* =========================
   READY
========================= */

async function ready() {

  if (!state?.lobby?.me) return;

  try {

    await api(
      'ready',
      creds({
        ready:
          !state.lobby.me.ready
      })
    );

    poll();

  }

  catch (e) {

    toast(e.message);

  }

}


/* =========================
   STARTPUNKT
   Nur noch Fallback.
========================= */

async function setStart() {

  try {

    await api(
      'startpoint',
      creds()
    );

    toast(
      '📍 Startpunkt aktualisiert'
    );

  }

  catch (e) {

    toast(e.message);

  }

}


/* =========================
   SPIEL STARTEN
========================= */

async function start() {

  try {

    /*
     Zusätzliche Prüfung im Frontend.
    */

    if (
      !state?.lobby?.me?.hasLocation
    ) {

      toast(
        'Aktuelle Position wird noch ermittelt.'
      );

      /*
       Falls GPS aus irgendeinem Grund
       noch nicht läuft, erneut starten.
      */

      if (watch === null) {
        gps();
      }

      return;
    }


    await api(
      'start',
      creds()
    );


    toast(
      'Countdown gestartet'
    );


    poll();

  }

  catch (e) {

    toast(e.message);

  }

}


/* =========================
   FUND BESTÄTIGEN
========================= */

async function found(targetId) {

  try {

    const j =
      await api(
        'found',
        creds({
          targetId
        })
      );


    toast(
      `✅ FUND BESTÄTIGT · ${j.distance} m`
    );


    poll();

  }

  catch (e) {

    toast(
      `❌ ${e.message}` +
      (
        e.data?.distance != null
          ? ` · ${e.data.distance} m`
          : ''
      )
    );

  }

}


/* =========================
   REMATCH
========================= */

async function rematch() {

  try {

    await api(
      'rematch',
      creds()
    );

    toast(
      'Neue Runde vorbereitet'
    );

    poll();

  }

  catch (e) {

    toast(e.message);

  }

}


/* =========================
   LOBBY VERLASSEN
========================= */

async function leave() {

  try {

    await api(
      'leave',
      creds()
    );

  }

  catch (e) {

    console.error(e);

  }

  reset();

}


/* =========================
   RESET
========================= */

function reset() {

  clearTimeout(
    pollTimer
  );


  if (
    watch !== null &&
    navigator.geolocation
  ) {

    navigator.geolocation.clearWatch(
      watch
    );

  }


  watch = null;
  gpsStarting = false;
  gpsPositionReceived = false;
  state = null;
  session = null;


  localStorage.removeItem(
    'chs'
  );


  location.reload();

}


/* =========================
   BUTTON EVENTS
========================= */

if ($('#create'))
  $('#create').onclick = create;

if ($('#join'))
  $('#join').onclick = join;

if ($('#gps'))
  $('#gps').onclick = gps;

if ($('#ready'))
  $('#ready').onclick = ready;

if ($('#setStart'))
  $('#setStart').onclick = setStart;

if ($('#start'))
  $('#start').onclick = start;

if ($('#rematch'))
  $('#rematch').onclick = rematch;

if ($('#leave'))
  $('#leave').onclick = leave;


/* =========================
   BESTEHENDE SESSION
========================= */

if (session) {
  show();
}
