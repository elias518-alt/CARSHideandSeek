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
    for(const id of ['adminDialog','wardrobeDialog','accountGate','onboardingDialog','reportDialog']){const view=document.getElementById(id);view?.disposeWardrobe?.();view?.remove();}
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
    if(document.getElementById('wardrobeDialog')?.open)return;
    const userId=authSession.user.id;document.getElementById('wardrobeDialog')?.disposeWardrobe?.();
    const dialog=accountDialog('wardrobeDialog','DEIN LOOK');dialog.classList.add('wardrobeDialog');const editorToken={};dialog.wardrobeEditor=editorToken;
    dialog.insertAdjacentHTML('beforeend','<p class="wardrobeIntro">Deine Crew-Figur oder dein eigener PLUS-Avatar: Kleidung, Gesicht und Posen.</p><div class="wardrobeLayout"><div class="wardrobePreview" data-wardrobe-preview></div><form class="wardrobeForm"><div data-wardrobe-fields></div><section class="characterPhoto" data-character-photo hidden></section><p class="accountError" role="alert"></p><button type="submit" class="primaryButton">LOOK SPEICHERN</button></form></div>');
    const form=dialog.querySelector('form');let draft=appearance(),busy=false,previewVictory=false;
    if(draft.collection!=='classic')draft=characterStudio.normalize(draft);
    let oldFace=characterStudio.normalizeFace(authSession.user.user_metadata?.chs_appearance?.face);
    if(oldFace?.path.split('/')[0]!==userId)oldFace=null;
    const plus=()=>window.plusUI?.active===true;
    const photo=characterPhoto.create(form.querySelector('[data-character-photo]'),{getLook:()=>draft,onError:message=>form.querySelector('[role=alert]').textContent=message,onChange:traits=>{if(plus()&&draft.collection==='studio'&&authSession?.user?.id===userId){draft=characterStudio.normalize({...draft,traits});render();}}});
    const options=values=>values.map((name,i)=>[i,name]);
    const select=(name,label,values)=>'<label>'+label+'<select name="'+name+'">'+values.map(([value,text])=>'<option value="'+value+'">'+esc(text)+'</option>').join('')+'</select></label>';
    const card=(value,label,look,premium=false)=>'<button type="button" class="characterChoice" data-character-choice="'+value+'" aria-pressed="'+(draft.collection==='classic'?value==='classic-'+draft.classic:value===draft.gender)+'" '+(premium&&!plus()?'disabled':'')+'>'+wardrobe.markup(look)+'<strong>'+label+'</strong><small>'+(premium?'PLUS · anpassbar':'Kostenlos')+'</small></button>';
    function preview(){dialog.querySelector('[data-wardrobe-preview]').innerHTML='<span class="studioPreviewTag">'+(draft.collection==='classic'?'CREW':previewVictory?'DEIN SIEGERMOMENT':'PLUS AVATAR')+'</span>'+wardrobe.markup(draft,previewVictory?'victory':'standing')+'<span class="studioPreviewGround"></span>';}
    function render(){
      if(dialog.wardrobeEditor!==editorToken)return;
      const fields=form.querySelector('[data-wardrobe-fields]'),open=[...fields.querySelectorAll('details[open]')].map(el=>el.dataset.section);
      let controls='';
      if(draft.collection==='studio'&&plus()){
        const garment=characterStudio.garments[draft.gender],colors=Object.entries(characterStudio.colors).map(([key,value])=>[key,value[0]]);
        controls='<div class="studioControls">'+select('top','OBERTEIL',options(garment.tops))+select('pants','HOSE',options(garment.pants))+select('shoes','SCHUHE',options(characterStudio.shoes))+'<details data-section="colors"><summary>Deine Farben</summary><div class="avatarFieldGrid">'+[['topColor','Oberteil'],['pantsColor','Hose'],['shoeColor','Schuhe']].map(([key,label])=>select(key,label,colors)).join('')+'</div></details>'+select('pose','POSE NEBEN DEM AUTO',options(characterAvatar.poses))+select('winPose','JUBEL BEIM GEWINNEN',options(characterAvatar.celebrations))+'<button type="button" data-victory-preview aria-pressed="'+previewVictory+'">'+(previewVictory?'STANDPOSE ANSEHEN':'JUBEL ANSEHEN')+'</button><details data-section="face"><summary>Gesicht &amp; Haare</summary><div class="avatarFieldGrid">'+select('trait-shape','Gesichtsform',options(characterAvatar.shapes))+select('trait-skin','Hautton',options(['Porzellan','Hell','Warm','Bronze','Braun','Dunkelbraun']))+select('trait-hair','Frisur',options(characterAvatar.hairstyles))+select('trait-hairColor','Haarfarbe',options(['Schwarz','Dunkelbraun','Braun','Blond','Hellblond','Kupfer','Grau','Weiß']))+select('trait-eyes','Augenfarbe',options(['Braun','Grün','Blau','Grau']))+select('trait-beard','Bart',options(characterAvatar.beards))+select('trait-glasses','Brille',[[0,'Ohne Brille'],[1,'Mit Brille']])+[['eyeSpacing','Augenabstand',.85,1.15],['eyeSize','Augengröße',.8,1.2],['nose','Nasenbreite',.8,1.2],['mouth','Mundbreite',.8,1.2]].map(([key,label,min,max])=>'<label>'+label+'<input type="range" data-trait-range="'+key+'" min="'+min+'" max="'+max+'" step=".01" value="'+draft.traits[key]+'"></label>').join('')+'</div></details></div>';
      }
      fields.innerHTML='<h3>Deine Crew-Figuren</h3><div class="characterChoices">'+['Night Rider','Silver Line','Orange Shift'].map((name,i)=>card('classic-'+i,name,{classic:i})).join('')+'</div><h3>Dein PLUS-Studio</h3><div class="characterChoices characterChoices--plus">'+card('male','Männliche Figur',{collection:'studio',gender:'male',top:5},true)+card('female','Weibliche Figur',{collection:'studio',gender:'female',top:3,topColor:'cream'},true)+'</div><p class="wardrobeAccess" role="status">'+(plus()?'PLUS aktiv · Kleidung, Posen und Selfie-Avatar freigeschaltet.':'Die drei Crew-Figuren sind kostenlos. Kleidung, Posen und Selfie-Avatar benötigen PLUS. Käufe sind noch nicht verfügbar.')+'</p>'+(oldFace?'<p class="avatarMigration">Dein früheres Gesichtsfoto wird nicht mehr dargestellt. Beim Speichern wird es aus dem Bildspeicher entfernt. Du kannst jetzt einen gezeichneten Avatar aus einem neuen Selfie erstellen.</p>':'')+controls;
      for(const field of fields.querySelectorAll('select')){const key=field.name;field.value=String(key.startsWith('trait-')?(key==='trait-glasses'?Number(draft.traits.glasses):draft.traits[key.slice(6)]):draft[key]);}
      fields.querySelectorAll('details').forEach(el=>el.open=open.includes(el.dataset.section));preview();
      photo.setState({editable:plus()&&draft.collection==='studio',visible:plus()&&draft.collection==='studio',busy});
      if(busy)form.querySelectorAll('button,select,input').forEach(el=>el.disabled=true);
    }
    render();dialog.showModal();
    form.addEventListener('click',event=>{
      if(busy)return;
      if(event.target.closest('[data-victory-preview]')){previewVictory=!previewVictory;render();return;}
      const button=event.target.closest('[data-character-choice]');if(!button)return;
      const choice=button.dataset.characterChoice;if(choice.startsWith('classic-'))draft=wardrobe.normalize({classic:Number(choice.slice(-1))});else if(plus())draft=characterStudio.normalize({...draft,collection:'studio',gender:choice});previewVictory=false;render();
    });
    form.addEventListener('change',event=>{
      const field=event.target,key=field.name;if(busy||!plus()||draft.collection!=='studio'||!key)return;
      if(key.startsWith('trait-'))draft=characterStudio.normalize({...draft,traits:{...draft.traits,[key.slice(6)]:key==='trait-glasses'?field.value==='1':Number(field.value)}});
      else if(['top','pants','shoes','pose','winPose','topColor','pantsColor','shoeColor'].includes(key)){draft=characterStudio.normalize({...draft,[key]:key.endsWith('Color')?field.value:Number(field.value)});if(key==='winPose')previewVictory=true;if(key==='pose')previewVictory=false;}else return;
      render();form.querySelector('[name="'+key+'"]')?.focus();
    });
    form.addEventListener('input',event=>{const key=event.target.dataset.traitRange;if(!key||busy||!plus()||draft.collection!=='studio')return;draft=characterStudio.normalize({...draft,traits:{...draft.traits,[key]:Number(event.target.value)}});preview();});
    const refreshAccess=()=>{if(!dialog.open)return;if(!plus()&&draft.collection!=='classic'){draft=wardrobe.restrict(draft,false);previewVictory=false;}render();};
    const onCancel=event=>{if(busy)event.preventDefault();},onClose=()=>{if(!dialog.open)dispose();};
    const dispose=()=>{document.removeEventListener('chs:plus-changed',refreshAccess);dialog.removeEventListener('cancel',onCancel);dialog.removeEventListener('close',onClose);photo.dispose();};dialog.disposeWardrobe=dispose;
    document.addEventListener('chs:plus-changed',refreshAccess);dialog.addEventListener('cancel',onCancel);dialog.addEventListener('close',onClose);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;if(photo.processing){form.querySelector('[role=alert]').textContent='Der Avatar wird noch vorbereitet. Bitte kurz warten.';return;}
      const candidate=wardrobe.normalize(draft);busy=true;render();dialog.querySelector('.dialogClose').disabled=true;
      try{
        if(authSession?.user?.id!==userId)throw Error('Konto wurde gewechselt. Bitte neu öffnen.');
        const data=await api('wardrobe-save',{appearance:candidate});
        if(authSession?.user?.id!==userId)return;
        draft=candidate;authSession={...authSession,user:data.user};
        let cleanupFailed=false;if(oldFace){try{const result=await supabaseClient.storage.from('profile-images').remove([oldFace.path]);cleanupFailed=!!result.error;if(!cleanupFailed)oldFace=null;}catch{cleanupFailed=true;}}
        try{await supabaseClient.auth.refreshSession();}catch{}
        if(authSession?.user?.id!==userId)return;
        setCharacterStyle(draft.classic);window.referenceUI?.renderOwn();if(typeof renderGarage==='function')renderGarage();
        let synced=true;if(gameSession){try{await api('join',{...playerData(),code:gameSession.code});await poll();}catch{synced=false;}}
        if(cleanupFailed){form.querySelector('[role=alert]').textContent='Avatar gespeichert. Das alte Gesichtsfoto konnte noch nicht gelöscht werden. Bitte nochmals speichern, um die Löschung zu wiederholen.';return;}
        dialog.close();toast(synced?'Dein Look ist gespeichert ✓':'Look gespeichert. Die Lobby wird beim Wiederbeitritt aktualisiert.');
      }catch(error){form.querySelector('[role=alert]').textContent=error.message;}
      finally{busy=false;if(dialog.isConnected&&dialog.open&&dialog.wardrobeEditor===editorToken){render();form.querySelector('button[type=submit]').disabled=false;dialog.querySelector('.dialogClose').disabled=false;}}
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
