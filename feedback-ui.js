'use strict';
(function(){
 const areas={home:'Start',lobby:'Lobby',garage:'Garage',profile:'Profil',stats:'Statistik',friends:'Freunde',crew:'Crew',map:'Spielkarte',wardrobe:'Kleiderschrank',pets:'Haustiere',other:'Sonstiges'};
 const categories={feedback:{bug:'Fehler',ui:'Darstellung / Bedienung',idea:'Idee / Verbesserung'},player:{harassment:'Beleidigung / Belästigung',cheating:'Unfaires Spiel / Manipulation',dangerous_driving:'Gefährliches Fahren',privacy:'Privatsphäre',other:'Sonstiger Regelverstoß'}};
 const options=entries=>Object.entries(entries).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('');
 let pending=false,epoch=0;
 function open(config={}){
  if(!authSession?.user?.id){toast('Bitte zuerst anmelden.');return;}
  document.getElementById('feedbackDialog')?.remove();
  const actor=authSession.user.id,d=document.createElement('dialog');d.id='feedbackDialog';d.className='productDialog betaDialog';
  const page=document.querySelector('.page.active')?.id;
  d.innerHTML='<button type="button" class="dialogClose" aria-label="Schließen">×</button><h2>FEEDBACK & MELDUNGEN</h2><form><label>Was möchtest du senden?<select name="kind">'+options({feedback:'Feedback zur App',player:'Spieler melden'})+'</select></label><label>Bereich<select name="area">'+options(areas)+'</select></label><div data-player><label>Spieler suchen<input name="search" maxlength="40" placeholder="Name oder Spieler-Tag"></label><button type="button" data-search>Spieler suchen</button><label>Betroffener Spieler<select name="target"><option value="">Bitte auswählen</option></select></label></div><label>Kategorie<select name="category"></select></label><label>Was ist passiert?<textarea name="comment" required minlength="5" maxlength="500" rows="4" placeholder="Beschreibe kurz, was du gesehen hast."></textarea></label><p class="feedbackEvidenceHint"></p><button type="submit">AN ADMINS SENDEN</button></form><p role="alert" class="accountError"></p>';
  document.body.append(d);d.querySelector('.dialogClose').onclick=()=>d.close();
  const form=d.querySelector('form'),f=form.elements,err=d.querySelector('[role=alert]');
  f.kind.value=config.kind||'feedback';f.area.value=config.area||({game:'map',play:'lobby'}[page]|| (areas[page]?page:'other'));
  if(config.targetId){const option=new Option(config.name||'Ausgewählter Spieler',config.targetId,true,true);f.target.add(option);}
  const hint=()=>{d.querySelector('.feedbackEvidenceHint').textContent=config.messageId?'Die ausgewählte empfangene Nachricht wird den Admins als Beleg übermittelt.':gameSession&&['lobby','map'].includes(f.area.value)?'Admins sehen deine Beschreibung sowie bis zu 30 letzte Lobby-Nachrichten und 50 Spielereignisse dieser Lobby, ohne GPS-Koordinaten.':'Deine Beschreibung geht an den separaten Admin-Eingang.';};
  const update=()=>{d.querySelector('[data-player]').hidden=f.kind.value!=='player';f.target.required=f.kind.value==='player';f.category.innerHTML=options(categories[f.kind.value]);hint();};
  f.kind.onchange=update;f.area.onchange=hint;update();
  if(config.messageId){f.kind.disabled=true;f.target.disabled=true;d.querySelector('[data-search]').hidden=true;f.search.hidden=true;}
  let generation=0;
  d.querySelector('[data-search]').onclick=async()=>{
   const request=++generation;err.textContent='';
   try{const data=await api('feedback-targets',{q:f.search.value},'GET');if(!d.isConnected||authSession?.user?.id!==actor||request!==generation)return;
    f.target.replaceChildren(new Option('Bitte auswählen',''));for(const p of data.players)f.target.add(new Option(p.username+' · '+p.player_tag,p.id));
    if(!data.players.length)err.textContent='Keine Spieler gefunden.';
   }catch(error){if(d.isConnected&&authSession?.user?.id===actor)err.textContent=error.message;}
  };
  let busy=false;
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;busy=true;err.textContent='';
   const submit=form.querySelector('[type=submit]');submit.disabled=true;
   const payload={kind:f.kind.value,area:f.area.value,category:f.category.value,comment:f.comment.value,targetId:f.target.value||null,...(config.messageId?{messageId:config.messageId}:{}),...(config.lobbyPlayerId?{lobbyPlayerId:config.lobbyPlayerId}:{}),...(gameSession?{code:gameSession.code,userId:gameSession.userId}:{})};
   try{if(authSession?.user?.id!==actor)throw Error('Bitte erneut anmelden.');await api('feedback',payload);if(d.isConnected&&authSession?.user?.id===actor){d.close();d.remove();toast('Gesendet. Die Admins prüfen deinen Hinweis.');void refreshInbox();}}
   catch(error){if(d.isConnected&&authSession?.user?.id===actor)err.textContent=error.message;}
   finally{busy=false;submit.disabled=false;}
  };
  d.showModal();
 }
 async function refreshInbox(){
  const button=document.getElementById('adminInboxButton'),account=window.accountUI?.currentAccount,actor=authSession?.user?.id;
  if(!button)return;
  const allowed=actor&&account?.permissions?.includes('reports')&&!account.banned;
  button.hidden=!allowed;if(!allowed){button.textContent='Admin-Eingang';return;}
  if(pending||document.hidden)return;pending=true;const version=epoch;
  try{const data=await api('admin-inbox',{},'GET');if(actor!==authSession?.user?.id||version!==epoch)return;
   button.textContent='Admin-Eingang · '+data.open;button.setAttribute('aria-label',data.open+' offene Eingänge: '+data.feedback+' Feedback, '+data.players+' Spielermeldungen');
  }catch{if(actor===authSession?.user?.id&&version===epoch){button.textContent='Admin-Eingang · nicht erreichbar';}}
  finally{if(version===epoch)pending=false;}
 }
 function reset(){epoch++;pending=false;document.getElementById('feedbackDialog')?.remove();const b=document.getElementById('adminInboxButton');if(b){b.hidden=true;b.textContent='Admin-Eingang';}}
 function setup(){
  const footer=document.querySelector('.legalFooter'),feedback=document.createElement('button');feedback.type='button';feedback.textContent='Feedback & Spieler melden';feedback.id='feedbackMenuButton';feedback.onclick=()=>open();footer?.prepend(feedback);
  const admin=document.createElement('button');admin.type='button';admin.id='adminInboxButton';admin.hidden=true;admin.onclick=()=>window.betaUI.openAdmin(window.accountUI.currentAccount);
  document.getElementById('adminMenuButton')?.before(admin);
  document.addEventListener('click',event=>{const b=event.target.closest('[data-report-peer]');if(b)open({kind:'player',area:'friends',targetId:b.dataset.reportPeer,name:b.dataset.reportName,messageId:b.dataset.reportMessage});});
  setInterval(()=>void refreshInbox(),30000);void refreshInbox();
 }
 window.feedbackUI={open,refreshInbox,reset,areas};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
