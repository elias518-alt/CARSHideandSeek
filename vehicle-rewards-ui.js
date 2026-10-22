'use strict';
(function(){
 let presentations={},presentationDraft=null;
 let owner='',epoch=0,loading=false,busy=false,verified=false,level=1,loadouts={},selected='',draft=null,error='',tuning=false;
 const $=id=>document.getElementById(id);
 const valid=data=>{if(!Number.isFinite(data?.level)||!data?.loadouts||typeof data.loadouts!=='object'||Array.isArray(data.loadouts))throw Error('Fahrzeugbelohnungen sind auf dem Server noch nicht verfügbar.');return data;};
 function reset(){epoch++;owner='';loading=busy=verified=false;level=1;loadouts={};presentations={};presentationDraft=null;selected='';draft=null;error='';tuning=false;$('garageShowroom')?.remove();for(const car of localGarage){delete car.cosmetics;delete car.presentation;}}
 function identity(){const id=authSession?.user?.id;if(owner!==id){reset();owner=id||'';}return !!id;}
 function vehicle(){return localGarage.find(car=>car.id===selected)||activeCar()||localGarage[0];}
 function apply(){for(const car of localGarage){car.cosmetics=loadouts[car.id]||vehicleRewards.defaults;car.presentation=presentations[car.id]||vehicleConfiguration.presentation();}window.referenceUI?.renderOwn();}
 async function refresh(){
  if(!identity()||loading||busy)return;loading=true;const actor=owner,version=epoch;render();
  try{const data=valid(await api('vehicle-rewards',{},'GET'));if(owner!==actor||authSession?.user?.id!==actor||version!==epoch)return;level=data.level;loadouts=data.loadouts;presentations=data.presentations||{};verified=true;error='';draft=null;presentationDraft=null;apply();}
  catch(err){if(owner===actor&&version===epoch){verified=false;error=err.message;}}
  finally{if(owner===actor&&version===epoch){loading=false;render();}}
 }
 function render(){
  if(!identity())return;
  let box=$('garageShowroom');if(!box){box=document.createElement('section');box.id='garageShowroom';box.setAttribute('aria-label','Dein Fahrzeug und Belohnungen');$('garageCars')?.before(box);}
  const car=vehicle();box.hidden=!car;$('garageCars').hidden=!!car&&tuning;if(!car){$('garageCars')?.querySelectorAll('.garageCar').forEach(node=>node.hidden=false);return;}
  if(selected!==car.id){selected=car.id;draft=null;presentationDraft=null;}
  const presentation=presentationDraft||presentations[car.id]||vehicleConfiguration.presentation();
  const current=draft||loadouts[car.id]||vehicleRewards.defaults,supported=vehicleRewards.supports(car);
  box.innerHTML='<div class="garageViewTabs" role="group" aria-label="Garagenansicht"><button type="button" data-garage-view="vehicle" aria-pressed="'+!tuning+'">Mein Fahrzeug</button><button type="button" data-garage-view="tuning" aria-pressed="'+tuning+'">Tuning & Belohnungen</button></div><div class="garageScene"><span class="garageSceneLabel">'+(tuning?'TUNING · SPIELMODELL':car.active?'DEIN AKTIVES FAHRZEUG':'FAHRZEUGVORSCHAU')+'</span><div class="garageSceneCar" data-glow="'+current.glow+'">'+(tuning?vehicleIllustration({...car,cosmetics:current},'profile'):carPhotoMarkup({...car,cosmetics:current,presentation},'profile'))+'</div><h2>'+esc(car.brand+' '+car.model)+'</h2><p>'+esc([car.series,car.year?'Baujahr '+car.year:'',car.color].filter(Boolean).join(' · '))+'</p></div><div class="garageSelector" role="group" aria-label="Fahrzeug auswählen">'+localGarage.map(item=>'<button type="button" data-show-car="'+esc(item.id)+'" aria-pressed="'+(item.id===car.id)+'">'+carPhotoMarkup(item,'profile')+'<strong>'+esc(item.brand+' '+item.model)+'</strong><small>'+esc(item.year||'Baujahr offen')+(item.active?' · Aktiv':'')+'</small></button>').join('')+'</div><div class="vehicleRewards" '+(tuning?'':'hidden')+'><header><div><small>ERSPIELTE EXTRAS</small><h3>Dein Fahrzeug. Dein Look.</h3></div><span>'+ (verified?'Level '+level:'Fortschritt prüfen')+'</span></header><p>Rein kosmetisch · mit deinem gespeicherten Level freigeschaltet. Kein Kauf und kein Werbevideo nötig.</p>'+Object.entries(vehicleRewards.catalog).map(([key,items])=>'<fieldset><legend>'+({rims:'Felgen',package:'Sportdetail · Seitenschweller',glow:'Unterbodenlicht'}[key])+'</legend><div class="vehicleRewardChoices">'+items.map(item=>{const locked=item.level>level||!verified,unavailable=key!=='glow'&&item.id!=='stock'&&!supported;return '<button type="button" data-vehicle-reward="'+key+'" data-value="'+item.id+'" aria-pressed="'+(current[key]===item.id)+'" aria-disabled="'+(locked||unavailable)+'"><span class="rewardSample rewardSample--'+key+' rewardSample--'+item.id+'" aria-hidden="true"></span><strong>'+esc(item.label)+'</strong><small>'+(unavailable?'Passende Grafik fehlt':item.level===1?'Serie':locked?'Ab Level '+item.level:'Freigeschaltet · Level '+item.level)+'</small></button>';}).join('')+'</div></fieldset>').join('')+'<p class="vehicleRewardNotice">'+(supported?'Die Felgen und Seitenschweller sind auf diese Fahrzeugillustration abgestimmt.':'Für diese Baureihe ist derzeit Unterbodenlicht verfügbar. Felgen und Sportdetails folgen mit passend angepassten Illustrationen.')+(car.photo?' Dein eigenes Foto bleibt erhalten; die Tuningvorschau verwendet die Modellillustration.':'')+'</p><p id="vehicleRewardStatus" role="'+(error?'alert':'status')+'">'+esc(error||(loading?'Fortschritt wird geladen …':gameSession?'Zum Anpassen bitte zuerst die Lobby verlassen.':draft?'Ungespeicherte Auswahl.':'Auswahl wird pro Fahrzeug gespeichert.'))+'</p><div class="vehicleRewardActions"><button type="button" data-save-vehicle-rewards '+(busy||loading||!verified||!draft||gameSession?'disabled':'')+'>'+(busy?'Wird gespeichert …':'Look ausrüsten')+'</button><button type="button" data-refresh-vehicle-rewards '+(busy||loading?'disabled':'')+'>Neu prüfen</button></div></div>';
  if(car.photo){box.querySelector('.garageScene').insertAdjacentHTML('afterend','<fieldset class="vehiclePresentation"><legend>Dein Fahrzeug auf allen Seiten</legend><div class="garageViewTabs"><button type="button" data-vehicle-mode="photo" aria-pressed="'+(presentation.mode==='photo')+'">Eigenes Foto</button><button type="button" data-vehicle-mode="model" aria-pressed="'+(presentation.mode==='model')+'">Getuntes Spielmodell</button></div><p>Die gespeicherte Auswahl gilt auch auf Startseite, Profil und in der Lobby. Tuningteile sind am Spielmodell sichtbar.</p><label>Fotogröße <input type="range" data-photo-scale min="75" max="115" value="'+Math.round(presentation.customVehicleTransform.scale*100)+'"></label><label>Fotoposition <input type="range" data-photo-x min="-8" max="8" value="'+Math.round(presentation.customVehicleTransform.translateX*100)+'"></label><small>Die Räder bleiben auf dem Boden; der Platz für Figur und Tier bleibt frei.</small><button type="button" data-save-vehicle-rewards '+(busy||loading||!verified||!presentationDraft||gameSession?'disabled':'')+'>Darstellung speichern</button></fieldset>');}
  box.querySelectorAll('.garageSceneCar svg').forEach(svg=>svg.setAttribute('preserveAspectRatio','xMidYMax meet'));
  if(busy)box.querySelectorAll('button').forEach(node=>node.disabled=true);
  $('garageCars')?.querySelectorAll('.garageCar').forEach(node=>{node.hidden=node.querySelector('[data-edit-car]')?.dataset.editCar!==car.id;});
 }
 async function save(){
  if(!identity()||busy||loading||(!draft&&!presentationDraft)||!verified||gameSession)return;
  const actor=owner,version=epoch,id=vehicle()?.id,candidate={...(draft||loadouts[vehicle().id]||vehicleRewards.defaults)},presentation=presentationDraft;busy=true;error='';render();
  try{const data=valid(await api('vehicle-rewards',{vehicleId:id,loadout:candidate,...(presentation?{presentation}:{})}));if(owner!==actor||authSession?.user?.id!==actor||version!==epoch)return;loadouts=data.loadouts;presentations=data.presentations||{};level=data.level;draft=null;presentationDraft=null;apply();syncVehicleUI();toast('Fahrzeug-Look ausgerüstet.');}
  catch(err){if(owner===actor&&version===epoch)error=err.message;}
  finally{if(owner===actor&&version===epoch){busy=false;render();}}
 }
 document.addEventListener('click',event=>{
  const mode=event.target.closest('[data-vehicle-mode]');if(mode&&!busy&&!loading&&!gameSession){presentationDraft=vehicleConfiguration.presentation({...(presentationDraft||presentations[vehicle().id]),mode:mode.dataset.vehicleMode});render();return;}
  const view=event.target.closest('[data-garage-view]');if(view&&!busy){tuning=view.dataset.garageView==='tuning';render();document.querySelector('[data-garage-view="'+view.dataset.garageView+'"]')?.focus();return;}
  const choice=event.target.closest('[data-show-car]');if(choice&&!busy){selected=choice.dataset.showCar;draft=null;presentationDraft=null;render();return;}
  const option=event.target.closest('[data-vehicle-reward]');if(option&&!busy&&!loading){
   if(gameSession){toast('Verlasse zuerst die Lobby, um dein Fahrzeug anzupassen.');return;}
   if(option.getAttribute('aria-disabled')==='true'){toast(option.querySelector('small').textContent);return;}
   const key=option.dataset.vehicleReward,value=option.dataset.value;draft={...(draft||loadouts[vehicle().id]||vehicleRewards.defaults),[key]:value};render();document.querySelector('[data-vehicle-reward="'+key+'"][data-value="'+value+'"]')?.focus();return;
  }
  if(event.target.closest('[data-save-vehicle-rewards]'))void save();
  if(event.target.closest('[data-refresh-vehicle-rewards]'))void refresh();
 });
 document.addEventListener('change',event=>{if(event.target.matches('[data-photo-scale],[data-photo-x]')&&!busy&&!loading&&!gameSession){const p=presentationDraft||presentations[vehicle().id]||{};presentationDraft=vehicleConfiguration.presentation({...p,customVehicleTransform:{...p.customVehicleTransform,[event.target.matches('[data-photo-scale]')?'scale':'translateX']:Number(event.target.value)/100}});render();}});
 window.vehicleRewardsUI={refresh,render,reset};
})();
