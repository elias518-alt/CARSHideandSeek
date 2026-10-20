'use strict';
/* Accessible presentation controls proxy the existing validated inputs/handlers. */
(function(){
 const byId=id=>document.getElementById(id);
 let draftOpen=false,busy=false;
 const presets={quick:[500,300,120,10],normal:[1000,900,180,15],large:[3000,1800,180,15]};
 const segments=['lobbyDuration','lobbyHeadstart','lobbyEscape','lobbyPreset','lobbyBackground'];
 function changed(field,value){
  if(field.disabled||typeof lobbySettingsSaving!=='undefined'&&lobbySettingsSaving)return;
  field.value=String(value);field.dispatchEvent(new Event('change',{bubbles:true}));syncSettings();
 }
 function syncSettings(){
  const keys=['lobbyRadius','lobbyDuration','lobbyHeadstart','lobbyEscape'],values=keys.map(id=>Number(byId(id)?.value));
  if(byId('lobbyPreset'))byId('lobbyPreset').value=Object.keys(presets).find(key=>presets[key].every((n,i)=>n===values[i]))||'custom';
  if(byId('lobbyDraftSummary'))byId('lobbyDraftSummary').textContent=(values[0]||0)+' m Radius · '+((values[1]||0)/60)+' Minuten';
  const editable=state?.lobby?.hostId===state?.lobby?.me?.id&&state?.lobby?.state==='LOBBY';
  byId('lobbySettingsPanel')?.querySelectorAll('input,select').forEach(field=>field.disabled=!editable||busy||lobbySettingsSaving);
  if(byId('lobbySaveButton')){byId('lobbySaveButton').disabled=!editable||busy;byId('lobbySaveButton').textContent=busy?'Wird gespeichert …':editable?'Regeln speichern':'Nur der Host kann speichern';}

  for(const id of [...segments,'lobbyVisibility','lobbyReplacement','lobbyMaxPlayers']){
   const field=byId(id),controls=byId(id+'Controls');if(!field||!controls)continue;
   controls.querySelectorAll('button').forEach(button=>{
    button.disabled=field.disabled||lobbySettingsSaving;
    if(button.dataset.value!==undefined)button.setAttribute('aria-pressed',String(button.dataset.value===field.value));
    if(button.getAttribute('role')==='switch')button.setAttribute('aria-checked',String(field.value===(id==='lobbyVisibility'?'PUBLIC':'true')));
   });
   const value=controls.querySelector('output');if(value)value.textContent=field.value;
  }
  const radius=byId('lobbyRadius'),slider=byId('lobbyRadiusSlider');if(slider&&radius){slider.value=radius.value;slider.disabled=radius.disabled||lobbySettingsSaving;}
  const count=state?.lobby?.players?.length||0,seekers=byId('lobbySeekerSummary');
  if(seekers)seekers.textContent=(count<2?0:Math.min(count-1,Math.max(1,Math.floor(count/5))))+' Sucher · automatisch nach Crew-Größe';
 }
 function setup(){
  for(const id of segments){
   const field=byId(id);if(!field)continue;
   if(id==='lobbyBackground'&&!field.options.length)field.innerHTML=lobbyBackgroundOptions();
   const controls=document.createElement('div');controls.id=id+'Controls';controls.className='settingSegments'+(id==='lobbyBackground'?' sceneSegments':'');controls.setAttribute('role','group');controls.setAttribute('aria-label',field.closest('label')?.childNodes[0]?.textContent.trim()||id);
   for(const option of field.options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.textContent.trim();button.onclick=()=>changed(field,option.value);controls.append(button);}
   field.classList.add('nativeSetting');field.after(controls);field.addEventListener('change',syncSettings);
  }
  for(const id of ['lobbyVisibility','lobbyReplacement']){
   const field=byId(id);if(!field)continue;const controls=document.createElement('div');controls.id=id+'Controls';controls.className='settingSwitchRow';
   const label=document.createElement('span');label.textContent=id==='lobbyVisibility'?'Öffentliche Lobby':'Ersatzsucher aktiv';const button=document.createElement('button');button.type='button';button.className='settingSwitch';button.setAttribute('role','switch');button.setAttribute('aria-label',label.textContent);button.onclick=()=>changed(field,field.value===(id==='lobbyVisibility'?'PUBLIC':'true')?(id==='lobbyVisibility'?'PRIVATE':'false'):(id==='lobbyVisibility'?'PUBLIC':'true'));controls.append(label,button);field.classList.add('nativeSetting');field.after(controls);
  }
  const radius=byId('lobbyRadius');if(radius){const slider=document.createElement('input');slider.type='range';slider.id='lobbyRadiusSlider';slider.min='50';slider.max='10000';slider.step='50';slider.setAttribute('aria-label','Spielradius in Metern');slider.oninput=()=>{radius.value=slider.value;};slider.onchange=()=>changed(radius,slider.value);radius.before(slider);}
  const limit=byId('lobbyMaxPlayers');if(limit){const controls=document.createElement('div');controls.id=limit.id+'Controls';controls.className='settingStepper';for(const delta of [-1,1]){const button=document.createElement('button');button.type='button';button.textContent=delta<0?'−':'+';button.setAttribute('aria-label',delta<0?'Weniger Spielerplätze':'Mehr Spielerplätze');button.onclick=()=>changed(limit,Math.max(state?.lobby?.players?.length||2,2,Math.min(20,Number(limit.value)+delta)));controls.append(button);if(delta<0)controls.append(document.createElement('output'));}limit.classList.add('nativeSetting');limit.after(controls);}
  const summary=document.createElement('p');summary.id='lobbySeekerSummary';summary.className='settingsExplanation';byId('lobbySettingsPanel')?.append(summary);
  // Controls inside labels must not cause a second, implicit click on their input.
  byId('lobbySettingsPanel')?.addEventListener('click',event=>{if(event.target.closest('button'))event.preventDefault();});
  const panel=byId('lobbySettingsPanel'),dialog=byId('freshSettingsDialog');
  const preview=document.createElement('div');preview.className='lobbySettingsPreview';preview.innerHTML='<span class="lobbyPreviewCircle" aria-hidden="true"></span><strong id="lobbyDraftSummary"></strong><small>Schematisches Spielgebiet · keine Spielerpositionen</small>';panel.prepend(preview);
  const more=document.createElement('details');more.className='gameSettingsMore';more.innerHTML='<summary>Weitere Regeln & Hintergrund</summary>';panel.append(more);
  ['lobbyBackground','lobbyReplacement','lobbyHeadstart','lobbyEscape'].forEach(id=>{const label=byId(id)?.closest('label');if(label)more.append(label);});
  dialog.setAttribute('aria-labelledby','lobbySettingsTitle');dialog.querySelector('h3').id='lobbySettingsTitle';byId('freshSettingsClose').setAttribute('aria-label','Schließen');
  const footer=document.createElement('footer');footer.className='lobbySettingsFooter';footer.innerHTML='<p id="lobbyDraftStatus" role="status">Änderungen werden erst beim Speichern übernommen.</p><button id="lobbySaveButton" type="button">Regeln speichern</button>';dialog.append(footer);
  // Keep changes local until explicit save; the original API remains authoritative.
  panel.addEventListener('change',event=>{if(!draftOpen)return;event.stopImmediatePropagation();const field=event.target;
    if(field.id==='lobbyPreset'&&presets[field.value])['lobbyRadius','lobbyDuration','lobbyHeadstart','lobbyEscape'].forEach((id,i)=>byId(id).value=presets[field.value][i]);
    byId('lobbyDraftStatus').textContent='Ungespeicherte Änderungen';syncSettings();
  },true);
  panel.addEventListener('input',()=>{if(draftOpen)byId('lobbyDraftStatus').textContent='Ungespeicherte Änderungen';});
  byId('lobbySaveButton').onclick=async()=>{
    if(busy||!draftOpen)return;for(const field of panel.querySelectorAll('input,select'))if(!field.checkValidity()){field.reportValidity();return;}
    const background=byId('lobbyBackground').value,code=state?.lobby?.code,actor=authSession?.user?.id;busy=true;syncSettings();
    try{const ok=await saveFreshLobbySettings();if(authSession?.user?.id!==actor||state?.lobby?.code!==code)return;if(!ok){byId('lobbyDraftStatus').textContent='Nicht gespeichert. Bitte Werte prüfen oder erneut öffnen.';return;}
      if(background!==state?.lobby?.background){try{await api('background',gameCredentials({background}));await poll();}catch(error){byId('lobbyDraftStatus').textContent='Regeln gespeichert. Hintergrund nicht gespeichert: '+error.message;return;}}
      draftOpen=false;fillLobbySettings(true);dialog.close();
    }finally{busy=false;syncSettings();}
  };
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  byId('freshSettingsClose').addEventListener('click',event=>{if(busy)event.stopImmediatePropagation();},true);
  dialog.addEventListener('close',()=>{draftOpen=false;});
  syncSettings();
 }
 window.mobileDesign={syncSettings,begin(){draftOpen=true;const host=state?.lobby?.hostId===state?.lobby?.me?.id;byId('freshSettingsDialog').querySelector('.freshDrawerHeader span').textContent=host?'HOST':'REGELN · NUR ANSEHEN';byId('lobbyDraftStatus').textContent='Änderungen werden erst beim Speichern übernommen.';syncSettings();}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
