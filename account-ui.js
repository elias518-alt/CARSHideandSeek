'use strict';
/* Cosmetic data is editable user metadata. Moderation and legal evidence are
   always fetched from the authenticated server, never from localStorage. */
(function(){
  let currentAccount=null,accountCheck=0;
  function stopActivity(){clearTimeout(pollTimer);clearInterval(gpsHeartbeat);gpsHeartbeat=null;gpsPhase='STOPPED';window.socialMap?.reset();window.plusUI?.reset();window.adsUI?.reset();}
  const appearance=()=>wardrobe.restrict(authSession?.user?.user_metadata?.chs_appearance||{classic:getCharacterStyle()},window.plusUI?.active===true);
  function accountDialog(id,title){
    let dialog=document.getElementById(id);
    if(!dialog){dialog=document.createElement('dialog');dialog.id=id;dialog.className='productDialog';document.body.append(dialog);}
    dialog.innerHTML=`<button class="dialogClose" type="button" aria-label="Schließen">×</button><h2>${esc(title)}</h2>`;
    dialog.querySelector('.dialogClose').addEventListener('click',()=>dialog.close());return dialog;
  }
  function closePrivateViews(){
    accountCheck++;
    window.communityUI?.closePrivateViews();
    stopActivity();
    currentAccount=null;document.getElementById('adminMenuButton')?.setAttribute('hidden','');
    for(const id of ['adminDialog','wardrobeDialog','accountGate','onboardingDialog','reportDialog'])document.getElementById(id)?.remove();
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
      if(!currentAccount.developerPreview&&(!(currentAccount.legal.canAccept??currentAccount.legal.ready)||!currentAccount.accepted)){await gate(currentAccount);return false;}
      if(account.onboardingRequired){stopActivity();window.betaUI.onboard(account);return false;}
      window.socialMap?.onPage();window.plusUI?.refresh();
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
    else if(!(legal.canAccept??legal.ready)){output.innerHTML='<p>Die App ist noch nicht für weitere Spieler freigegeben. Der Betreiber muss zuerst die Betreiberangaben vervollständigen und die Rechtstexte freigeben.</p><p>Das liegt nicht an deinem Konto oder deinem Handy. Erneutes Versuchen behebt diese Sperre nicht. Du musst derzeit nichts bestätigen.</p>';}
    else{
      output.innerHTML=`<p>Bitte lies die <a href="/legal/terms" target="_blank" rel="noopener">Nutzungsbedingungen und Sicherheitshinweise</a> sowie die <a href="/legal/privacy" target="_blank" rel="noopener">Datenschutzhinweise</a>. Fassung ${esc(legal.version)}.</p>
      <form data-consent-form><div class="consentChoices">
      <label><input name="terms" type="checkbox" required><span>Ich akzeptiere die Nutzungsbedingungen.</span></label>
      <label><input name="safety" type="checkbox" required><span>Ich beachte Verkehrs- und Sicherheitsregeln. Als Fahrer bediene ich die App nur nach sicherem Parken. Keine Rennen oder riskanten Verfolgungsfahrten.</span></label>
      <label><input name="adult" type="checkbox" required><span>Ich bin mindestens 18 Jahre alt.</span></label>
      <label><input name="privacyRead" type="checkbox" required><span>Ich habe die Datenschutzhinweise gelesen, einschließlich Standortanzeige und öffentlicher Bildadressen. Dies ist keine pauschale Einwilligung in Werbung oder Tracking.</span></label>
      </div><button type="submit" class="primaryButton">BESTÄTIGEN UND WEITER</button></form>`;
      if(legal.betaAccess){const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Vorläufiger Beta-Test: Betreiberangaben und rechtliche Prüfung sind noch nicht abgeschlossen. Die verlinkten Hinweise sind als Entwurf gekennzeichnet. Deine Bestätigung ist keine rechtliche Freigabe der App.';output.prepend(notice);output.querySelector('button[type=submit]').textContent='AKZEPTIEREN UND ZUR BETA';}
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
  async function openWardrobe(){
    if(!authSession?.user?.id){toast('Bitte zuerst anmelden.');return;}
    const userId=authSession.user.id;
    const dialog=accountDialog('wardrobeDialog','DEIN LOOK');dialog.classList.add('wardrobeDialog');
    dialog.insertAdjacentHTML('beforeend','<p class="wardrobeIntro">Wähle deine Figur. Mit PLUS gestaltest du deinen eigenen Streetwear-Look.</p><div class="wardrobeLayout"><div class="wardrobePreview" data-wardrobe-preview></div><form class="wardrobeForm"><div data-wardrobe-fields></div><p class="accountError" role="alert"></p><button type="submit" class="primaryButton">LOOK SPEICHERN</button></form></div>');
    const form=dialog.querySelector('form');let draft=appearance(),busy=false;
    if(draft.collection!=='classic')draft=characterStudio.normalize(draft);
    const plus=()=>window.plusUI?.active===true;
    const card=(value,label,look,premium=false)=>'<button type="button" class="characterChoice" data-character-choice="'+value+'" aria-pressed="'+(draft.collection==='classic'?value==='classic-'+draft.classic:value===draft.gender)+'" '+(premium&&!plus()?'disabled':'')+'>'+wardrobe.markup(look)+'<strong>'+label+'</strong><small>'+(premium?'PLUS · anpassbar':'Kostenlos')+'</small></button>';
    function render(){
      const fields=form.querySelector('[data-wardrobe-fields]');
      const select=(name,label,values)=>'<label>'+label+'<select name="'+name+'">'+values.map(([value,text])=>'<option value="'+value+'">'+esc(text)+'</option>').join('')+'</select></label>';
      fields.innerHTML='<h3>Deine Crew-Figuren</h3><div class="characterChoices">'+['Night Rider','Silver Line','Orange Shift'].map((name,i)=>card('classic-'+i,name,{classic:i})).join('')+'</div><h3>Dein PLUS-Studio</h3><div class="characterChoices characterChoices--plus">'+card('male','Alex',{collection:'studio',gender:'male',outfit:1},true)+card('female','Maya',{collection:'studio',gender:'female',outfit:2,topColor:'cream',pantsColor:'black'},true)+'</div><p class="wardrobeAccess" role="status">'+(plus()?'PLUS aktiv · beide Studio-Figuren freigeschaltet.':'Alle drei Crew-Figuren sind frei wählbar. Alex und Maya sind mit PLUS anpassbar. Käufe sind noch nicht verfügbar.')+'</p>'+(draft.collection==='studio'&&plus()?'<div class="studioControls">'+select('outfit','OUTFIT',characterStudio.outfits.map((name,i)=>[i,name]))+['topColor','pantsColor'].map((key,i)=>select(key,i?'FARBE HOSE':'FARBE OBERTEIL',Object.entries(characterStudio.colors).map(([key,value])=>[key,value[0]]))).join('')+'</div>':'');
      for(const field of fields.querySelectorAll('select'))field.value=String(draft[field.name]);
      dialog.querySelector('[data-wardrobe-preview]').innerHTML='<span class="studioPreviewTag">'+(draft.collection==='classic'?'CREW':'PLUS STUDIO')+'</span>'+wardrobe.markup(draft)+'<span class="studioPreviewGround"></span>';
    }
    render();dialog.showModal();
    form.addEventListener('click',event=>{const button=event.target.closest('[data-character-choice]');if(!button||busy)return;const choice=button.dataset.characterChoice;if(choice.startsWith('classic-'))draft=wardrobe.normalize({classic:Number(choice.slice(-1))});else if(plus())draft=characterStudio.normalize({...draft,collection:'studio',gender:choice});render();});
    form.addEventListener('change',event=>{const field=event.target;if(!field.name||busy||!plus())return;draft=characterStudio.normalize({...draft,[field.name]:field.name==='outfit'?Number(field.value):field.value});render();form.querySelector('[name="'+field.name+'"]').focus();});
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    const refreshAccess=()=>{if(!dialog.open)return;if(!plus()&&draft.collection!=='classic')draft=wardrobe.restrict(draft,false);render();};
    document.addEventListener('chs:plus-changed',refreshAccess);dialog.addEventListener('close',()=>document.removeEventListener('chs:plus-changed',refreshAccess),{once:true});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;form.querySelectorAll('button,select').forEach(e=>e.disabled=true);dialog.querySelector('.dialogClose').disabled=true;
      try{
        if(authSession?.user?.id!==userId)throw new Error('Konto wurde gewechselt. Bitte neu öffnen.');
        const data=await api('wardrobe-save',{appearance:draft});
        if(authSession?.user?.id!==userId)return;
        authSession={...authSession,user:data.user};await supabaseClient.auth.refreshSession();setCharacterStyle(draft.classic);
        window.referenceUI?.renderOwn();if(typeof renderGarage==='function')renderGarage();
        let synced=true;if(gameSession){try{await api('join',{...playerData(),code:gameSession.code});await poll();}catch{synced=false;}}
        dialog.close();toast(synced?'Dein Look ist gespeichert ✓':'Look gespeichert. Die Lobby wird beim Wiederbeitritt aktualisiert.');
      }catch(error){form.querySelector('[role=alert]').textContent=error.message;}
      finally{busy=false;render();form.querySelector('button[type=submit]').disabled=false;dialog.querySelector('.dialogClose').disabled=false;}
    });
    await window.plusUI?.refresh();if(authSession?.user?.id===userId&&dialog.open)refreshAccess();
  }
  async function openAdmin(){
    if(!currentAccount?.admin)return;
    return window.betaUI.openAdmin(currentAccount);
  }
  function setup(){
    document.getElementById('wardrobeMenuButton')?.addEventListener('click',openWardrobe);
    document.getElementById('adminMenuButton')?.addEventListener('click',()=>void openAdmin());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
  window.accountUI={get currentAccount(){return currentAccount;},initialize,appearance,openWardrobe,closePrivateViews,handleError:async error=>{if(error.data?.code==='ACCOUNT_BANNED'||error.data?.code==='LEGAL_REQUIRED'||error.data?.code==='ONBOARDING_REQUIRED'){stopActivity();await initialize();}}};
})();
