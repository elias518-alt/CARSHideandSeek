let session =
  JSON.parse(
    localStorage.getItem('chs') || 'null'
  );

let watch = null;
let state = null;
let pollTimer = null;
let gpsStarting = false;

const $ = s =>
  document.querySelector(s);

const $$ = s =>
  [...document.querySelectorAll(s)];

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[m])
  );


/* ========================================
   LOCAL PROFILE
======================================== */

let localProfile =
  JSON.parse(
    localStorage.getItem('chsProfile') ||
    JSON.stringify({
      name:'Elias',

      cars:[
        {
          id:'car1',
          brand:'BMW',
          model:'E36 328i Coupé',
          year:'1996',
          color:'Madeira Violett',
          active:true
        }
      ]
    })
  );


function saveLocalProfile(){

  localStorage.setItem(
    'chsProfile',
    JSON.stringify(localProfile)
  );

}


function activeCar(){

  return (
    localProfile.cars.find(
      car => car.active
    ) ||
    localProfile.cars[0]
  );

}


function syncProfile(){

  const car = activeCar();

  if($('#name')){
    $('#name').value =
      localProfile.name || 'Spieler';
  }

  if($('#headerName')){
    $('#headerName').textContent =
      localProfile.name || 'Spieler';
  }

  if(car){

    if($('#vehicle')){
      $('#vehicle').value =
        `${car.brand} ${car.model}`.trim();
    }

    if($('#color')){
      $('#color').value =
        car.color;
    }

    if($('#homeVehicle')){
      $('#homeVehicle').textContent =
        car.model;
    }

    if($('#homeColor')){
      $('#homeColor').textContent =
        car.color;
    }

  }

}


/* ========================================
   TOAST
======================================== */

function toast(message){

  const el = $('#toast');

  if(!el){
    console.log(message);
    return;
  }

  el.textContent = message;

  el.classList.add('show');

  clearTimeout(el._timer);

  el._timer =
    setTimeout(
      () =>
        el.classList.remove('show'),
      2800
    );

}


/* ========================================
   PAGE NAVIGATION
======================================== */

function openPage(page){

  $$('.page').forEach(
    p => p.classList.remove('active')
  );

  const target =
    document.getElementById(page);

  if(target){
    target.classList.add('active');
  }


  $$('.navButton').forEach(btn => {

    btn.classList.toggle(
      'active',
      btn.dataset.page === page
    );

  });


  /*
   During the actual game we don't want
   normal navigation to distract the user.
  */

  if($('#bottomNav')){

    $('#bottomNav').classList.toggle(
      'hidden',
      page === 'game'
    );

  }


  window.scrollTo({
    top:0,
    behavior:'smooth'
  });

}


/* ========================================
   API
======================================== */

async function api(
  path,
  data = {},
  method = 'POST'
){

  let url =
    '/api/' + path;

  const options = {
    method,
    headers:{
      'Content-Type':'application/json'
    }
  };


  if(method === 'GET'){

    url +=
      '?' +
      new URLSearchParams(data);

  }

  else{

    options.body =
      JSON.stringify(data);

  }


  const response =
    await fetch(
      url,
      options
    );


  let json;

  try{

    json =
      await response.json();

  }

  catch{

    throw new Error(
      'Serverantwort konnte nicht gelesen werden.'
    );

  }


  if(!response.ok){

    const error =
      new Error(
        json.error ||
        'Unbekannter Fehler'
      );

    error.data = json;

    throw error;

  }


  return json;

}


/* ========================================
   SESSION DATA
======================================== */

const creds = extra => ({

  code:
    session?.code,

  userId:
    session?.userId,

  ...(extra || {})

});


function profile(){

  const car =
    activeCar();

  localProfile.name =
    $('#name')?.value.trim() ||
    localProfile.name ||
    'Spieler';

  saveLocalProfile();


  return {

    name:
      localProfile.name,

    vehicle:
      car
        ? `${car.brand} ${car.model}`.trim()
        : 'Unbekannt',

    color:
      car?.color ||
      'Unbekannt',

    mode:
      $('#mode')?.value ||
      'PASSENGER'

  };

}


/* ========================================
   CREATE LOBBY
======================================== */

async function create(){

  try{

    const result =
      await api(
        'create',
        {

          ...profile(),

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


    saveSession(result);

    showGame();

  }

  catch(error){

    toast(
      error.message
    );

  }

}


/* ========================================
   JOIN LOBBY
======================================== */

async function join(){

  const lobbyCode =
    ($('#code')?.value || '')
      .trim()
      .toUpperCase();


  if(!lobbyCode){

    toast(
      'Bitte einen Lobby-Code eingeben.'
    );

    return;

  }


  try{

    const result =
      await api(
        'join',
        {

          ...profile(),

          code:
            lobbyCode

        }
      );


    saveSession(result);

    showGame();

  }

  catch(error){

    toast(
      error.message
    );

  }

}


/* ========================================
   SAVE SESSION
======================================== */

function saveSession(result){

  session = {

    code:
      result.lobby.code,

    userId:
      result.userId

  };


  localStorage.setItem(
    'chs',
    JSON.stringify(session)
  );

}


/* ========================================
   GAME SCREEN
======================================== */

function showGame(){

  openPage('game');

  poll();

  /*
   GPS automatically starts.
  */

  setTimeout(
    () => {

      if(
        watch === null &&
        !gpsStarting
      ){
        gps();
      }

    },
    400
  );

}


/* ========================================
   POLLING
======================================== */

async function poll(){

  clearTimeout(
    pollTimer
  );


  if(!session){
    return;
  }


  try{

    state =
      await api(
        'state',
        creds(),
        'GET'
      );


    renderGame();

  }

  catch(error){

    console.error(error);


    if(
      error.message.includes(
        'Lobby nicht gefunden'
      ) ||
      error.message.includes(
        'Session'
      )
    ){

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


/* ========================================
   TIMER
======================================== */

function fmt(seconds){

  seconds =
    Math.max(
      0,
      Math.ceil(seconds)
    );


  return (
    `${Math.floor(seconds / 60)}:` +
    `${String(seconds % 60).padStart(2,'0')}`
  );

}


/* ========================================
   GAME RENDER
======================================== */

function renderGame(){

  if(
    !state ||
    !state.lobby
  ){
    return;
  }


  const lobby =
    state.lobby;

  const me =
    lobby.me;

  const time =
    state.serverTime;


  if(!me){
    return;
  }


  $('#lobbyName').textContent =
    lobby.name;

  $('#lobbyCode').textContent =
    lobby.code;

  $('#state').textContent =
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
    .classList.toggle(
      'hidden',
      me.mode !== 'DRIVER'
    );


  let end;


  if(
    lobby.state === 'COUNTDOWN'
  ){

    end =
      lobby.countdownEndsAt;

  }

  else if(
    lobby.state === 'HEADSTART'
  ){

    end =
      lobby.headstartEndsAt;

  }

  else{

    end =
      lobby.endsAt;

  }


  $('#timer').textContent =
    end
      ? fmt(
          (end - time) / 1000
        )
      : '–';


  /* READY */

  $('#ready').textContent =
    me.ready
      ? '✓ BEREIT'
      : 'BEREIT';


  $('#ready')
    .classList.toggle(
      'active',
      me.ready
    );


  $('#ready')
    .classList.toggle(
      'hidden',
      lobby.state !== 'LOBBY'
    );


  /* GPS */

  $('#gpsDot')
    .classList.toggle(
      'on',
      me.hasLocation
    );


  if(me.hasLocation){

    $('#gps').textContent =
      'GPS AKTIV ✓';

  }


  /* Manual start point hidden */

  $('#setStart')
    ?.classList.add(
      'hidden'
    );


  /* START */

  const isHost =
    lobby.hostId === me.id;

  const enoughPlayers =
    lobby.players.length >= 2;

  const inLobby =
    lobby.state === 'LOBBY';


  $('#start')
    .classList.toggle(
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


  if(
    isHost &&
    enoughPlayers &&
    inLobby &&
    !me.hasLocation
  ){

    $('#start').textContent =
      'POSITION WIRD ERMITTELT...';

  }

  else{

    $('#start').textContent =
      'SPIEL STARTEN';

  }


  /* PROXIMITY */

  const proximity =
    state.proximity;


  let proximityText =
    me.hasLocation
      ? 'GPS aktiv · keine Gegnerdaten in direkter Nähe.'
      : 'Standort wird ermittelt...';


  if(proximity){

    if(
      proximity.level ===
      'VERY_CLOSE'
    ){

      proximityText =
        `⚠ EXTREM NAH · ca. ${proximity.distance} m`;

    }

    else if(
      proximity.level ===
      'CLOSE'
    ){

      proximityText =
        `⚠ SEHR NAH · ca. ${proximity.distance} m`;

    }

    else if(
      proximity.level ===
      'NEAR'
    ){

      proximityText =
        `⚠ JEMAND NÄHERT SICH · ca. ${proximity.distance} m`;

    }

    else{

      proximityText =
        `Kein Gegner in direkter Nähe · ca. ${proximity.distance} m`;

    }


    $('#enemyDot')
      .classList.remove(
        'hidden'
      );


    const distance =
      Math.min(
        115,
        25 +
        proximity.distance / 2
      );


    $('#enemyDot').style.transform =
      `translate(` +
      `${Math.cos(time / 700) * distance}px,` +
      `${Math.sin(time / 700) * distance}px)`;


  }

  else{

    $('#enemyDot')
      .classList.add(
        'hidden'
      );

  }


  $('#proximity').textContent =
    proximityText;


  $('#proximity')
    .classList.toggle(
      'hot',
      !!proximity &&
      proximity.distance < 50
    );


  /* ESCAPE */

  const escapeLeft =
    Math.ceil(
      (
        state.escapeUntil -
        time
      ) / 1000
    );


  $('#escapeBox')
    .classList.toggle(
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


  /* PLAYERS */

  $('#players').innerHTML =

    lobby.players
      .map(
        player => `

          <div class="player ${player.found ? 'found' : ''}">

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

        `
      )
      .join('');


  /* FIND TARGETS */

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
    .classList.toggle(
      'hidden',
      !canFind
    );


  $('#targetButtons').innerHTML =

    targets
      .map(
        player => `

          <button
            class="danger"
            onclick="found('${player.id}')"
          >

            🚘
            ${esc(player.vehicle)}
            ·
            ${esc(player.color)}

          </button>

        `
      )
      .join('');


  /* COOLDOWN */

  const cooldown =
    Math.ceil(
      (
        state.cooldownUntil -
        time
      ) / 1000
    );


  $('#cooldown').textContent =

    cooldown > 0
      ? `Nächster Fundversuch in ${fmt(cooldown)}`
      : '';


  /* RESULT */

  $('#result')
    .classList.toggle(
      'hidden',
      lobby.state !== 'RESULT'
    );


  if(
    lobby.state === 'RESULT'
  ){

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
      .classList.toggle(
        'hidden',
        lobby.hostId !== me.id
      );

  }

}


/* ========================================
   GPS
======================================== */

function gps(){

  if(
    !navigator.geolocation
  ){

    toast(
      'Dieses Gerät unterstützt keine Standortabfrage.'
    );

    return;

  }


  if(
    watch !== null ||
    gpsStarting
  ){
    return;
  }


  gpsStarting = true;


  $('#gps').textContent =
    'GPS WIRD ERMITTELT...';


  watch =
    navigator.geolocation.watchPosition(

      async position => {

        gpsStarting = false;


        try{

          await api(
            'location',
            creds({

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
            .classList.add(
              'on'
            );

        }

        catch(error){

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


        if(
          watch !== null
        ){

          navigator.geolocation
            .clearWatch(
              watch
            );

        }


        watch = null;


        $('#gps').textContent =
          'GPS ERNEUT VERSUCHEN';


        if(
          error.code === 1
        ){

          toast(
            'Standortzugriff nicht erlaubt. Bitte Standort für diese Webseite freigeben.'
          );

        }

        else if(
          error.code === 2
        ){

          toast(
            'Aktuelle Position konnte nicht bestimmt werden.'
          );

        }

        else if(
          error.code === 3
        ){

          toast(
            'GPS benötigt länger. Bitte erneut versuchen.'
          );

        }

        else{

          toast(
            'GPS: ' +
            error.message
          );

        }

      },


      {
        enableHighAccuracy:true,
        maximumAge:0,
        timeout:20000
      }

    );

}


/* ========================================
   READY
======================================== */

async function ready(){

  if(
    !state?.lobby?.me
  ){
    return;
  }


  try{

    await api(
      'ready',
      creds({

        ready:
          !state.lobby.me.ready

      })
    );


    poll();

  }

  catch(error){

    toast(
      error.message
    );

  }

}


/* ========================================
   START GAME
======================================== */

async function start(){

  if(
    !state?.lobby?.me?.hasLocation
  ){

    toast(
      'Aktuelle Position wird noch ermittelt.'
    );


    if(
      watch === null
    ){
      gps();
    }


    return;

  }


  try{

    await api(
      'start',
      creds()
    );


    toast(
      'Countdown gestartet'
    );


    poll();

  }

  catch(error){

    toast(
      error.message
    );

  }

}


/* ========================================
   FIND
======================================== */

async function found(
  targetId
){

  try{

    const result =
      await api(
        'found',
        creds({
          targetId
        })
      );


    toast(
      `✓ FUND BESTÄTIGT · ${result.distance} m`
    );


    poll();

  }

  catch(error){

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


/* ========================================
   REMATCH
======================================== */

async function rematch(){

  try{

    await api(
      'rematch',
      creds()
    );


    toast(
      'Neue Runde vorbereitet'
    );


    poll();

  }

  catch(error){

    toast(
      error.message
    );

  }

}


/* ========================================
   LEAVE
======================================== */

async function leave(){

  try{

    await api(
      'leave',
      creds()
    );

  }

  catch(error){

    console.error(
      error
    );

  }


  resetGame();

}


/* ========================================
   RESET GAME
======================================== */

function resetGame(){

  clearTimeout(
    pollTimer
  );


  if(
    watch !== null &&
    navigator.geolocation
  ){

    navigator.geolocation
      .clearWatch(
        watch
      );

  }


  watch = null;
  gpsStarting = false;
  state = null;
  session = null;


  localStorage.removeItem(
    'chs'
  );


  openPage(
    'home'
  );

}


/* ========================================
   GARAGE
======================================== */

function openCarModal(){

  $('#carModal')
    .classList.remove(
      'hidden'
    );

}


function closeCarModal(){

  $('#carModal')
    .classList.add(
      'hidden'
    );

}


function saveCar(){

  const brand =
    $('#newCarBrand')
      .value
      .trim();

  const model =
    $('#newCarModel')
      .value
      .trim();

  const year =
    $('#newCarYear')
      .value
      .trim();

  const color =
    $('#newCarColor')
      .value
      .trim();


  if(
    !brand ||
    !model ||
    !color
  ){

    toast(
      'Bitte Marke, Modell und Farbe angeben.'
    );

    return;

  }


  /*
   For now the new vehicle becomes
   the active vehicle.
  */

  localProfile.cars.forEach(
    car =>
      car.active = false
  );


  localProfile.cars.push({

    id:
      'car_' +
      Date.now(),

    brand,
    model,
    year,
    color,

    active:true

  });


  saveLocalProfile();

  syncProfile();

  closeCarModal();


  toast(
    'Fahrzeug gespeichert ✓'
  );


  /*
   Backend accounts will later replace
   localStorage persistence.
  */

}


/* ========================================
   EVENT LISTENERS
======================================== */

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
    () =>
      openPage('play')
  );


$('#navPlay')
  ?.addEventListener(
    'click',
    () =>
      openPage('play')
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


/* ========================================
   INITIALIZE
======================================== */

syncProfile();


if(session){

  showGame();

}

else{

  openPage(
    'home'
  );

}
