'use strict';
(function(){
 const palette={orange:['Orange','#ff8a1f'],pink:['Rosa','#f599cf'],purple:['Lila','#bea4ff'],blue:['Blau','#8fc5ff'],turquoise:['Türkis','#79e0ce'],white:['Weiß','#eff3fa']};
 let owner='',epoch=0,data=null,timer=null,expiryTimer=null,busy=false,refreshing=false;
 const $=id=>document.getElementById(id);
 const eligible=()=>!!authSession?.user?.id&&!!window.accountUI?.currentAccount&&!accountUI.currentAccount.banned&&!accountUI.currentAccount.onboardingRequired&&(accountUI.currentAccount.accepted||accountUI.currentAccount.developerPreview);
 function theme(accent='orange'){
  const [name,color]=palette[accent]||palette.orange;
  document.documentElement.dataset.playerAccent=accent;
  document.documentElement.style.setProperty('--player-accent',color);
  document.documentElement.style.setProperty('--player-accent-soft',color+'20');
 }
 function notifyAppearance(){document.dispatchEvent(new Event('chs:plus-changed'));window.referenceUI?.renderOwn();}
 function reset(){epoch++;owner='';data=null;busy=refreshing=false;clearTimeout(timer);clearTimeout(expiryTimer);theme();notifyAppearance();$('plusDialog')?.remove();$('plusAdminDialog')?.remove();}
 async function rpc(name,args={}){let timeout;try{const r=await Promise.race([supabaseClient.rpc(name,args),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('PLUS nicht erreichbar. Bitte erneut laden.')),8000);})]);if(r.error)throw new Error(/function|schema cache/i.test(r.error.message)?'PLUS wird vorbereitet. Bitte später erneut versuchen.':r.error.message);return r.data;}finally{clearTimeout(timeout);}}
 function apply(result){
  if(!result||typeof result.active!=='boolean')throw Error('PLUS derzeit nicht verfügbar.');
  data=result;clearTimeout(expiryTimer);theme(data.active?data.accent:'orange');
  if(data.active&&data.expires_at){const remaining=Date.parse(data.expires_at)-Date.parse(data.server_time);if(!Number.isFinite(remaining)||remaining<=0){data.active=false;theme();}else expiryTimer=setTimeout(()=>{data.active=false;theme();paint();notifyAppearance();void refresh();},Math.min(remaining,2147483647));}
  paint();notifyAppearance();
 }
 async function refresh(){
  if(!eligible()){reset();return;}const id=authSession.user.id;if(owner!==id){reset();owner=id;}if(refreshing)return;
  refreshing=true;const e=epoch;
  try{const result=await rpc('chs_plus_read');if(e!==epoch||id!==authSession?.user?.id)return;apply(result);}
  catch(err){if(e===epoch){data=null;theme();paint();notifyAppearance();if($('plusStatus'))$('plusStatus').textContent=err.message;}}
  finally{if(e===epoch){refreshing=false;clearTimeout(timer);if(!document.hidden)timer=setTimeout(refresh,30000);}}
 }
 function dialog(id,title){let d=$(id);if(d)return d;d=document.createElement('dialog');d.id=id;d.className='hubSheet plusDialog';d.innerHTML='<header><h2>'+title+'</h2><button type="button" class="hubButton" aria-label="Schließen">×</button></header><div class="hubSheetBody"></div>';d.querySelector('header button').onclick=()=>d.close();document.body.append(d);return d;}
 function paint(){const d=$('plusDialog');if(!d)return;const active=data?.active===true;const status=$('plusStatus');if(status)status.textContent=data?(active?'PLUS aktiv'+(data.expires_at?' · bis '+new Date(data.expires_at).toLocaleString('de-DE'):''):'PLUS ist noch nicht erhältlich.'): 'PLUS wird geladen …';
  d.querySelectorAll('[data-accent]').forEach(b=>{b.disabled=busy||!data||(b.dataset.accent!=='orange'&&!active);b.setAttribute('aria-pressed',String(b.dataset.accent===(active?data?.accent:'orange')));});
  const admin=d.querySelector('[data-plus-admin]');if(admin)admin.hidden=!data?.can_manage;
 }
 async function choose(accent){if(busy||!eligible())return;busy=true;paint();const e=epoch,id=authSession.user.id;try{const result=await rpc('chs_plus_action',{action:'accent',payload:{accent}});if(e===epoch&&id===authSession?.user?.id)apply(result);}catch(err){if(e===epoch){$('plusError').textContent=err.message;await refresh();}}finally{if(e===epoch){busy=false;paint();}}}
 async function open(){if(!eligible()){toast('Bitte zuerst anmelden.');return;}const d=dialog('plusDialog','Dein PLUS-Look');d.querySelector('.hubSheetBody').innerHTML='<p id="plusStatus" role="status">PLUS wird geladen …</p><p>Wähle aus den Originalfiguren und neuen realistischen Streetwear-Charakteren mit eigenen Kleidungsfarben. Im separaten Haustierstudio wartet dein tierischer Begleiter mit Fell- und Augenfarben. Deine Wunschfarbe gilt für die Buttons, „Schnell beitreten“ und die untere Navigationsleiste.</p><div class="plusPalette" role="group" aria-label="Akzentfarbe">'+Object.entries(palette).map(([key,[label,color]])=>'<button type="button" data-accent="'+key+'" style="--swatch:'+color+'" aria-pressed="false" disabled><span aria-hidden="true"></span>'+label+'</button>').join('')+'</div><p id="plusError" role="alert"></p><p class="hubHint">Käufe sind noch nicht verfügbar. Bereits freigeschaltete PLUS-Rechte kannst du hier nutzen.</p><button type="button" class="hubButton" data-plus-admin hidden>PLUS verwalten</button>';
  d.querySelectorAll('[data-accent]').forEach(b=>b.onclick=()=>{ $('plusError').textContent='';void choose(b.dataset.accent);});d.querySelector('[data-plus-admin]').onclick=openAdmin;if(!d.open)d.showModal();paint();await refresh();
 }
 function openAdmin(){if(!data?.can_manage)return;const d=dialog('plusAdminDialog','PLUS verwalten');d.querySelector('.hubSheetBody').innerHTML='<form><label>Spieler suchen<input name="search" placeholder="Spielername oder Tag" minlength="2" maxlength="24" autocomplete="off"></label><button type="button" class="hubButton" data-search>Suchen</button><label>Spieler auswählen<select name="target" required><option value="">Bitte zuerst suchen</option></select></label><label>Ablaufdatum (optional, lokale Zeit)<input name="expiry" type="datetime-local"></label><label>Begründung<input name="reason" required minlength="3" maxlength="300"></label><div class="plusAdminActions"><button type="submit" class="hubButton" name="action" value="grant">Freischalten / verlängern</button><button type="submit" class="hubButton" name="action" value="revoke">Entziehen</button></div><p role="status" data-result></p></form>';
  const form=d.querySelector('form'),message=form.querySelector('[data-result]'),e=epoch,id=owner;form.elements.target.append(new Option('Eigenes Konto',owner));
  form.querySelector('[data-search]').onclick=async()=>{const q=form.elements.search.value.trim();if(q.length<2)return;try{const rows=await rpc('chs_search_players_v2',{q});if(e!==epoch||id!==owner||q!==form.elements.search.value.trim())return;form.elements.target.replaceChildren(new Option('Spieler auswählen',''),new Option('Eigenes Konto',owner));for(const p of rows)form.elements.target.append(new Option(p.username+' · '+p.player_tag,p.user_id));message.textContent=rows.length?'':'Kein Spieler gefunden.';}catch(err){if(e===epoch)message.textContent=err.message;}};
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const action=event.submitter?.value;if(!['grant','revoke'].includes(action))return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{await rpc('chs_plus_action',{action,payload:{target:form.elements.target.value,reason:form.elements.reason.value,expires_at:form.elements.expiry.value?new Date(form.elements.expiry.value).toISOString():null}});if(e!==epoch||id!==owner)return;message.textContent=action==='grant'?'PLUS freigeschaltet.':'PLUS entzogen. Offene Sitzungen aktualisieren sich spätestens nach 30 Sekunden.';await refresh();}catch(err){if(e===epoch)message.textContent=err.message;}finally{if(e===epoch){busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}}};if(!d.open)d.showModal();
 }
 function setup(){const b=document.querySelector('.plusCard button');if(b){b.textContent='PLUS ENTDECKEN';b.type='button';b.onclick=open;}document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);theme();}else void refresh();});window.addEventListener('offline',()=>{epoch++;refreshing=busy=false;clearTimeout(timer);clearTimeout(expiryTimer);data=null;theme();paint();notifyAppearance();});void refresh();}
 window.plusUI={refresh,reset,open,get active(){return owner===authSession?.user?.id&&data?.active===true;}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
