'use strict';
(function(){
 const plus=()=>window.plusUI?.active===true;
 const selection=()=>pets.restrict(authSession?.user?.user_metadata?.chs_pet,plus());
 async function open(){
  if(!authSession?.user?.id){toast('Bitte zuerst anmelden.');return;}
  let dialog=document.getElementById('petsDialog');if(dialog?.open)return;dialog?.disposePets?.();dialog?.remove();
  const userId=authSession.user.id;let draft=pets.normalize(authSession.user.user_metadata?.chs_pet),busy=false,disposed=false;
  dialog=document.createElement('dialog');dialog.id='petsDialog';dialog.className='productDialog petsDialog';
  dialog.innerHTML='<button type="button" class="dialogClose" aria-label="Schließen">×</button><span class="petEyebrow">DEIN BEGLEITER · PLUS</span><h2>Ein Platz an deiner Seite.</h2><p class="petIntro">Wähle deinen Begleiter für Startseite, Lobby und deinen Siegermoment.</p><form><div class="petLayout"><div class="petPreview" data-pet-preview></div><div><div class="petCategories" data-pet-categories></div><div class="petChoices" data-pet-choices></div><div class="petControls" data-pet-controls></div></div></div><p class="petAccess" role="status"></p><p class="accountError" role="alert"></p><button class="primaryButton" type="submit">BEGLEITER SPEICHERN</button></form>';
  dialog.setAttribute('aria-labelledby','petsDialogTitle');dialog.querySelector('h2').id='petsDialogTitle';
  document.body.append(dialog);const form=dialog.querySelector('form');let category=draft?pets.breeds[draft.breed].group:'Hunde';
  const option=(name,label,values,value)=>'<fieldset class="petControlGroup"><legend>'+label+'</legend><div class="'+(['coat','eyes'].includes(name)?'petSwatches':'petSegments')+'">'+values.map(([key,text])=>'<button type="button" data-pet-field="'+name+'" data-pet-value="'+key+'" aria-pressed="'+(String(key)===String(value))+'">'+(['coat','eyes'].includes(name)?'<i style="--swatch:'+(name==='coat'?pets.coats[key][1]:pets.eyes[key][1])+'"></i>':'')+'<span>'+text+'</span></button>').join('')+'</div></fieldset>';
  function render(){if(disposed)return;
   dialog.querySelector('[data-pet-preview]').innerHTML=draft?pets.render(draft)+'<span class="petPreviewName">'+pets.breeds[draft.breed].name+'</span>':'<span class="petEmpty">Dein Auto. Deine Crew.<br>Dein Begleiter.</span>';
   dialog.querySelector('[data-pet-categories]').innerHTML=['Hunde','Katzen','Weitere Tiere'].map(c=>'<button type="button" data-pet-category="'+c+'" aria-pressed="'+(category===c)+'">'+c+'</button>').join('');
   dialog.querySelector('[data-pet-choices]').innerHTML='<button type="button" class="petChoice petChoice--none" data-pet-choice="none" aria-pressed="'+!draft+'"><span>○</span><strong>Ohne Begleiter</strong></button>'+Object.entries(pets.breeds).filter(([,b])=>b.group===category).map(([id,b])=>'<button type="button" class="petChoice" data-pet-choice="'+id+'" aria-pressed="'+(draft?.breed===id)+'">'+pets.render({breed:id})+'<strong>'+b.name+'</strong></button>').join('');
   const b=draft&&pets.breeds[draft.breed];
   dialog.querySelector('[data-pet-controls]').innerHTML=b?option('coat',draft.breed==='parrot'?'GEFIEDER':draft.breed==='fish'?'SCHUPPENFARBE':'FELLFARBE',b.coats.map(k=>[k,pets.coats[k][0]]),draft.coat)+option('eyes','AUGENFARBE',b.eyes.map(k=>[k,pets.eyes[k][0]]),draft.eyes)+option('size','GRÖSSE',[[0,'Klein'],[1,'Normal'],[2,'Groß']],draft.size)+option('flip','BLICKRICHTUNG',[[0,'Original'],[1,'Gespiegelt']],Number(draft.flip))+(b.stances?option('stance','HALTUNG',b.stances.map((s,i)=>[i,s]),draft.stance):''):'';
   dialog.querySelector('.petAccess').textContent=plus()?'PLUS aktiv · Dein Begleiter wird unabhängig vom Outfit gespeichert.':'Nur Vorschau · Begleiter speichern benötigt PLUS. Ohne Begleiter bleibt kostenlos. Käufe sind noch nicht verfügbar.';
   form.querySelectorAll('select').forEach(el=>el.disabled=busy||!plus());form.querySelectorAll('button').forEach(el=>{if(busy)el.disabled=true;});form.querySelector('button[type=submit]').disabled=busy||!!draft&&!plus();dialog.querySelector('.dialogClose').disabled=busy;
  }
  function dispose(){disposed=true;document.removeEventListener('chs:plus-changed',refreshAccess);}dialog.disposePets=dispose;
  function refreshAccess(){if(!plus())draft=null;render();}
  document.addEventListener('chs:plus-changed',refreshAccess);dialog.addEventListener('close',dispose);dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.querySelector('.dialogClose').onclick=()=>{if(!busy)dialog.close();};
  form.addEventListener('click',event=>{if(busy)return;const control=event.target.closest('[data-pet-field]');if(control&&draft){const name=control.dataset.petField,value=control.dataset.petValue;draft=pets.normalize({...draft,[name]:name==='flip'?value==='1':['size','stance'].includes(name)?Number(value):value});render();form.querySelector('[data-pet-field="'+name+'"][data-pet-value="'+value+'"]')?.focus();return;}const tab=event.target.closest('[data-pet-category]'),card=event.target.closest('[data-pet-choice]');if(tab){category=tab.dataset.petCategory;render();}if(card){const id=card.dataset.petChoice;if(id==='none')draft=null;else draft=pets.normalize({breed:id});render();}});
  form.addEventListener('change',event=>{if(busy||!plus()||!draft)return;const {name,value}=event.target;if(!['coat','eyes','size','flip','stance'].includes(name))return;draft=pets.normalize({...draft,[name]:name==='flip'?value==='1':['size','stance'].includes(name)?Number(value):value});render();form.querySelector('[name='+name+']')?.focus();});
  form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;render();form.querySelector('[role=alert]').textContent='';
   try{if(authSession?.user?.id!==userId)throw Error('Bitte das Studio mit deinem aktuellen Konto erneut öffnen.');const data=await api('pets-save',{pet:pets.normalize(draft)});if(disposed||authSession?.user?.id!==userId)return;authSession={...authSession,user:data.user};window.referenceUI?.renderOwn();if(state?.lobby?.result)window.referenceUI?.renderResult(state.lobby);let synced=true;if(gameSession){try{await api('join',{...playerData(),code:gameSession.code});await poll();}catch{synced=false;}}dialog.close();toast(synced?'Dein Begleiter ist gespeichert ✓':'Begleiter gespeichert. Die Lobby wird beim Wiederbeitritt aktualisiert.');
   }catch(error){if(!disposed)form.querySelector('[role=alert]').textContent=error.message;}finally{busy=false;if(!disposed)render();}
  });
  render();dialog.showModal();await window.plusUI?.refresh();if(authSession?.user?.id===userId&&!disposed)refreshAccess();
 }
 function setup(){document.getElementById('petsMenuButton')?.addEventListener('click',open);}
 window.petUI={selection,open};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
