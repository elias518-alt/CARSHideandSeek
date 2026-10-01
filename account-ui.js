'use strict';
/* Cosmetic data is editable user metadata. Moderation and legal evidence are
   always fetched from the authenticated server, never from localStorage. */
(function(){
  let currentAccount=null,accountCheck=0;
  function stopActivity(){clearTimeout(pollTimer);clearInterval(gpsHeartbeat);gpsHeartbeat=null;gpsPhase='STOPPED';}
  const appearance=()=>wardrobe.normalize(authSession?.user?.user_metadata?.chs_appearance||{classic:getCharacterStyle()});
  function accountDialog(id,title){
    let dialog=document.getElementById(id);
    if(!dialog){dialog=document.createElement('dialog');dialog.id=id;dialog.className='productDialog';document.body.append(dialog);}
    dialog.innerHTML=`<button class="dialogClose" type="button" aria-label="Schließen">×</button><h2>${esc(title)}</h2>`;
    dialog.querySelector('.dialogClose').addEventListener('click',()=>dialog.close());return dialog;
  }
  function closePrivateViews(){
    accountCheck++;
    stopActivity();
    currentAccount=null;document.getElementById('adminMenuButton')?.setAttribute('hidden','');
    for(const id of ['adminDialog','wardrobeDialog','accountGate'])document.getElementById(id)?.remove();
  }
  async function initialize(){
    const userId=authSession?.user?.id,attempt=++accountCheck;if(!userId)return false;
    const valid=()=>attempt===accountCheck&&authSession?.user?.id===userId;
    try{
      const account=await api('account-status',{},'GET');
      if(!valid())return false;
      currentAccount=account;
      const previewNotice=document.getElementById('developerPreviewNotice');if(previewNotice)previewNotice.hidden=!account.developerPreview;
      const button=document.getElementById('adminMenuButton');if(button)button.hidden=!currentAccount.admin||currentAccount.banned;
      if(currentAccount.banned){await gate(currentAccount);return false;}
      if(!currentAccount.developerPreview&&(!currentAccount.legal.ready||!currentAccount.accepted)){await gate(currentAccount);return false;}
      return true;
    }catch(error){if(valid())await gate({error:error.message});return false;}
  }
  async function gate(account){
    stopActivity();
    let dialog=document.getElementById('accountGate');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='accountGate';dialog.className='accountGate';document.body.append(dialog);dialog.addEventListener('cancel',event=>event.preventDefault());}
    const legal=account.legal;
    const banned=account.banned;
    dialog.innerHTML=`<h2>${banned?'Konto gesperrt':'Vor deiner Teilnahme'}</h2><div data-gate-content></div><p class="accountError" role="alert"></p><button type="button" data-account-logout>ABMELDEN</button>`;
    const output=dialog.querySelector('[data-gate-content]');
    if(banned){
      output.innerHTML=`<p>${esc(account.ban.reason)}</p><p>${account.ban.until?'Bis '+esc(new Date(account.ban.until).toLocaleString('de-DE')):'Dauerhafte Sperre'}</p><p>Zur Überprüfung deiner Sperre: ${esc(legal?.operator?.email||'Betreiberkontakt im Impressum')}.</p>`;
    }else if(account.error){output.innerHTML=`<p>${esc(account.error)}</p><button type="button" data-account-retry>ERNEUT PRÜFEN</button>`;}
    else if(!legal.ready){output.innerHTML='<p>Die Betreiberangaben und die rechtliche Freigabe werden noch vervollständigt. Eine Zustimmung ist erst danach möglich.</p><button type="button" data-account-retry>ERNEUT PRÜFEN</button>';}
    else{
      output.innerHTML=`<p>Bitte lies die <a href="/legal/terms" target="_blank" rel="noopener">Nutzungsbedingungen und Sicherheitshinweise</a> sowie die <a href="/legal/privacy" target="_blank" rel="noopener">Datenschutzhinweise</a>. Fassung ${esc(legal.version)}.</p>
      <form data-consent-form><div class="consentChoices">
      <label><input name="terms" type="checkbox" required><span>Ich akzeptiere die Nutzungsbedingungen.</span></label>
      <label><input name="safety" type="checkbox" required><span>Ich beachte Verkehrs- und Sicherheitsregeln. Als Fahrer bediene ich die App nur nach sicherem Parken. Keine Rennen oder riskanten Verfolgungsfahrten.</span></label>
      <label><input name="adult" type="checkbox" required><span>Ich bin mindestens 18 Jahre alt.</span></label>
      <label><input name="privacyRead" type="checkbox" required><span>Ich habe die Datenschutzhinweise gelesen, einschließlich Standortanzeige und öffentlicher Bildadressen. Dies ist keine pauschale Einwilligung in Werbung oder Tracking.</span></label>
      </div><button type="submit" class="primaryButton">BESTÄTIGEN UND WEITER</button></form>`;
      output.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
        try{
          await api('legal-accept',{version:legal.version,hash:legal.hash,terms:form.elements.terms.checked,safety:form.elements.safety.checked,adult:form.elements.adult.checked,privacyRead:form.elements.privacyRead.checked});
          dialog.close();dialog.remove();await initializeAuth();
        }catch(error){dialog.querySelector('[role=alert]').textContent=error.message;if(error.status===409)await initialize();}
        finally{button.disabled=false;}
      });
    }
    const links=document.createElement('p');links.innerHTML='<a href="/legal/terms" target="_blank" rel="noopener">Nutzungsbedingungen</a> · <a href="/legal/privacy" target="_blank" rel="noopener">Datenschutz</a> · <a href="/legal/imprint" target="_blank" rel="noopener">Impressum</a>';output.append(links);
    dialog.querySelector('[data-account-retry]')?.addEventListener('click',async()=>{dialog.close();await initializeAuth();});
    dialog.querySelector('[data-account-logout]').addEventListener('click',async()=>{stopActivity();await logout();});
    if(!dialog.open)dialog.showModal();
  }
  function wardrobeOptions(v){
    const group=wardrobe.choices(v.character),option=(value,label)=>`<option value="${value}">${esc(label)}</option>`;
    return `<label>DARSTELLUNG<select name="collection">${option('classic','Vorhandene Lobbyfiguren')}${option('modular','Modulare Charaktere · Quaternius')}</select></label>
      <div data-classic-fields><label>CHARAKTER<select name="classic">${['Dunkle Jacke','Helle Jacke','Orange Jacke'].map((n,i)=>option(i,n)).join('')}</select></label></div>
      <div data-modular-fields class="wardrobeForm"><label>CHARAKTER<select name="character">${wardrobe.characters.map((n,i)=>option(i,n)).join('')}</select></label>
      <label>HAARE<select name="hair">${group.map((index,i)=>option(i,wardrobe.hair[index])).join('')}</select></label>
      ${['top','pants','shoes'].map((key,column)=>`<label>${['OBERTEIL','HOSE','SCHUHE'][column]}<select name="${key}">${group.map((index,i)=>option(i,wardrobe.outfits[index][column])).join('')}</select></label>`).join('')}
      <label>SCHMUCK<select name="jewelry">${Object.entries(wardrobe.jewelry).map(([key,n])=>option(key,n)).join('')}</select></label></div>`;
  }
  function openWardrobe(){
    if(!authSession?.user?.id){toast('Bitte zuerst anmelden.');return;}
    const dialog=accountDialog('wardrobeDialog','DEIN KLEIDERSCHRANK');dialog.classList.add('wardrobeDialog');
    dialog.insertAdjacentHTML('beforeend','<p>Dein Look hat keinen Einfluss auf Spielwerte.</p><div class="wardrobeLayout"><div class="wardrobePreview" data-wardrobe-preview></div><form class="wardrobeForm"><div data-wardrobe-fields></div><p class="accountError" role="alert"></p><button type="submit" class="primaryButton">LOOK SPEICHERN</button></form></div><p class="assetCredits">Charaktere: <a href="https://quaternius.com/packs/ultimatemodularcharacters.html" target="_blank" rel="noopener">Quaternius</a>, CC0. Anhänger: <a href="https://game-icons.net/1x1/lorc/gem-pendant.html" target="_blank" rel="noopener">Lorc / Game-icons.net</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a> (Farbe und Größe angepasst).</p>');
    const userId=authSession.user.id,form=dialog.querySelector('form');let draft=appearance(),busy=false;
    function render(){
      const fields=form.querySelector('[data-wardrobe-fields]');fields.innerHTML=wardrobeOptions(draft);
      for(const [key,value]of Object.entries(draft))if(form.elements[key])form.elements[key].value=String(value);
      fields.querySelector('[data-classic-fields]').hidden=draft.collection!=='classic';fields.querySelector('[data-modular-fields]').hidden=draft.collection!=='modular';
      dialog.querySelector('[data-wardrobe-preview]').innerHTML=wardrobe.markup(draft);
    }
    render();
    form.addEventListener('change',event=>{
      const field=event.target;if(!field.name)return;
      draft=wardrobe.normalize({...draft,[field.name]:['character','classic','hair','top','pants','shoes'].includes(field.name)?Number(field.value):field.value});
      const focusName=field.name;render();form.elements[focusName]?.focus();
    });
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;form.querySelectorAll('button,select').forEach(e=>e.disabled=true);dialog.querySelector('.dialogClose').disabled=true;
      try{
        if(authSession?.user?.id!==userId)throw new Error('Konto wurde gewechselt. Bitte neu öffnen.');
        const {data,error}=await supabaseClient.auth.updateUser({data:{chs_appearance:draft,character_style:draft.classic}});if(error)throw error;
        if(authSession?.user?.id!==userId)return;
        authSession={...authSession,user:data.user};setCharacterStyle(draft.classic);
        let synced=true;
        if(gameSession){try{await api('join',{...playerData(),code:gameSession.code});await poll();}catch{synced=false;}}
        dialog.close();toast(synced?'Look im Konto gespeichert ✓':'Look gespeichert. Die Lobby wird beim Wiederbeitritt aktualisiert.');
      }catch(error){form.querySelector('[role=alert]').textContent=error.message;}
      finally{busy=false;form.querySelectorAll('button,select').forEach(e=>e.disabled=false);dialog.querySelector('.dialogClose').disabled=false;}
    });
    dialog.showModal();
  }
  async function openAdmin(){
    if(!currentAccount?.admin)return;
    const actor=authSession?.user?.id,dialog=accountDialog('adminDialog','ENTWICKLER · MODERATION');dialog.classList.add('adminDialog');
    dialog.insertAdjacentHTML('beforeend','<p>Spieler verwalten und Meldungen prüfen. Standortkoordinaten und private Nachrichten werden hier nicht angezeigt.</p><div class="adminTabs"><button data-admin-view="players">SPIELER</button><button data-admin-view="reports">MELDUNGEN</button><button data-admin-view="audit">PROTOKOLL</button></div><div class="adminList" data-admin-output></div><p class="accountError" role="alert"></p>');
    const output=dialog.querySelector('[data-admin-output]'),errorNode=dialog.querySelector('[role=alert]');let query='',page=0,generation=0;
    const valid=()=>authSession?.user?.id===actor&&dialog.isConnected;
    async function show(view){
      const attempt=++generation;errorNode.textContent='';output.textContent='Wird geladen …';
      try{
        const result=await api('admin-'+view,view==='players'?{q:query,page}:{},'GET');if(!valid()||attempt!==generation)return;
        if(view==='players'){
          output.innerHTML=`<form class="adminForm" data-admin-search><label>Spielername oder Tag<input name="query" maxlength="40" value="${esc(query)}"></label><button>SUCHEN</button></form><div>${result.players.map(p=>`<article class="adminPlayer"><div><strong>${esc(p.username)} · ${esc(p.player_tag)}</strong><p>Level ${esc(p.level)} · ${esc(p.rounds_played)} Runden · ${esc(p.wins)} Siege</p><code>${esc(p.id)}</code><p>${p.admin?'Administrator':p.ban?'Gesperrt: '+esc(p.ban.reason):'Keine aktive Sperre'}</p></div>${p.admin?'':`<button type="button" data-admin-target="${esc(p.id)}" data-admin-unban="${!!p.ban}">${p.ban?'SPERRE AUFHEBEN':'SPERREN'}</button>`}</article>`).join('')||'<p>Keine Spieler gefunden.</p>'}</div><div class="adminTabs"><button type="button" data-admin-prev ${page===0?'disabled':''}>ZURÜCK</button><span>Seite ${page+1}</span><button type="button" data-admin-next ${result.hasMore?'':'disabled'}>WEITER</button></div>`;
          output.querySelector('[data-admin-search]').addEventListener('submit',event=>{event.preventDefault();query=event.currentTarget.elements.query.value;page=0;void show('players');});
          output.querySelector('[data-admin-prev]').addEventListener('click',()=>{page=Math.max(0,page-1);void show('players');});output.querySelector('[data-admin-next]').addEventListener('click',()=>{page++;void show('players');});
          output.querySelectorAll('[data-admin-target]').forEach(button=>button.addEventListener('click',()=>banForm(button.dataset.adminTarget,button.dataset.adminUnban==='true')));
        }else{
          const rows=view==='reports'?result.reports:result.actions;
          output.innerHTML=rows.map(row=>`<article class="adminPlayer"><div><strong>${esc(view==='reports'?'Meldung':row.action)} · ${esc(new Date(row.at||row.created_at).toLocaleString('de-DE'))}</strong><p>${esc(row.reason)}</p><p>Zielkonto: <code>${esc(row.target||row.target_id||'gelöscht')}</code></p></div>${view==='reports'?`<button type="button" data-admin-target="${esc(row.target)}">SPERRE PRÜFEN</button>`:''}</article>`).join('')||'<p>Keine Einträge.</p>';
          output.querySelectorAll('[data-admin-target]').forEach(button=>button.addEventListener('click',()=>banForm(button.dataset.adminTarget,false)));
        }
      }catch(error){if(valid()&&attempt===generation){errorNode.textContent=error.message;output.textContent='Ansicht konnte nicht geladen werden.';}}
    }
    function banForm(targetId,unban){
      output.querySelector('[data-ban-form]')?.remove();
      const form=document.createElement('form');form.className='adminForm adminBanForm';form.dataset.banForm='1';
      form.innerHTML=`<h3>${unban?'Sperre aufheben':'Kontosperre prüfen'}</h3><p>Zielkonto: <code>${esc(targetId)}</code></p><label>Begründung<textarea name="reason" minlength="5" maxlength="500" required></textarea></label>${unban?'':`<label>Dauer<select name="hours"><option value="1">1 Stunde</option><option value="24" selected>24 Stunden</option><option value="168">7 Tage</option><option value="720">30 Tage</option><option value="0">Dauerhaft</option></select></label>`}<label><input name="confirmed" type="checkbox" required> Ich habe Zielkonto und Begründung geprüft.</label><button type="submit">${unban?'SPERRE AUFHEBEN':'SPERRE VERBINDLICH SPEICHERN'}</button><button type="button" data-cancel-ban>ABBRECHEN</button>`;
      form.querySelector('[data-cancel-ban]').addEventListener('click',()=>form.remove());
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!valid())return;form.querySelectorAll('button').forEach(e=>e.disabled=true);
        try{await api('admin-ban',{targetId,unban,reason:form.elements.reason.value,hours:Number(form.elements.hours?.value||0)});toast(unban?'Sperre aufgehoben':'Kontosperre gespeichert');await show('players');}
        catch(error){errorNode.textContent=error.message;form.querySelectorAll('button').forEach(e=>e.disabled=false);}
      });output.prepend(form);form.elements.reason.focus();
    }
    dialog.querySelectorAll('[data-admin-view]').forEach(button=>button.addEventListener('click',()=>void show(button.dataset.adminView)));
    dialog.showModal();await show('players');
  }
  function setup(){
    document.getElementById('wardrobeMenuButton')?.addEventListener('click',openWardrobe);
    document.getElementById('adminMenuButton')?.addEventListener('click',()=>void openAdmin());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
  window.accountUI={initialize,appearance,openWardrobe,closePrivateViews,handleError:async error=>{if(error.data?.code==='ACCOUNT_BANNED'||error.data?.code==='LEGAL_REQUIRED'){stopActivity();await initialize();}}};
})();
