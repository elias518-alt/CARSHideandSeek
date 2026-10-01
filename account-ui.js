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
      if(!currentAccount.developerPreview&&(!currentAccount.legal.ready||!currentAccount.accepted)){await gate(currentAccount);return false;}
      if(account.onboardingRequired){stopActivity();window.betaUI.onboard(account);return false;}
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
    return `<label>DARSTELLUNG<select name="collection">${option('classic','Vorhandene Lobbyfiguren')}${option('modular','Modulare Charaktere · Quaternius')}${option('realistic','Realistische Figuren · NoEdge')}</select></label>
      <div data-classic-fields><label>CHARAKTER<select name="classic">${['Dunkle Jacke','Helle Jacke','Orange Jacke'].map((n,i)=>option(i,n)).join('')}</select></label></div>
      <div data-modular-fields class="wardrobeForm"><label>CHARAKTER<select name="character">${wardrobe.characters.map((n,i)=>option(i,n)).join('')}</select></label>
      <label>HAARE<select name="hair">${group.map((index,i)=>option(i,wardrobe.hair[index])).join('')}</select></label>
      ${['top','pants','shoes'].map((key,column)=>`<label>${['OBERTEIL','HOSE','SCHUHE'][column]}<select name="${key}">${group.map((index,i)=>option(i,wardrobe.outfits[index][column])).join('')}</select></label>`).join('')}
      <label>SCHMUCK<select name="jewelry">${Object.entries(wardrobe.jewelry).map(([key,n])=>option(key,n)).join('')}</select></label></div>${realisticOptions(v,option)}`;
  }
  function realisticOptions(v,option){
    const female=v.gender==='female';
    const select=(name,label,values)=>`<label>${label}<select name="${name}">${values.map(([key,text])=>option(key,text)).join('')}</select></label>`;
    return `<div data-realistic-fields class="wardrobeForm">
      ${select('gender','FIGUR',[['male','Männlich · NoEdge'],['female','Weiblich · Camilia']])}
      ${select('hair','FRISUR',(female?['Lange Locken','Bob','Pferdeschwanz']:['Mittelscheitel','Kurz','Zurückgekämmt']).map((text,i)=>[i,text]))}
      ${select('hairColor','HAARFARBE',Object.entries(wardrobe.hairColors).map(([key,v])=>[key,v[0]]))}
      ${select('top','OBERTEIL',(female?['T-Shirt','Hoodie','Bauchfreies Oberteil']:['T-Shirt','Hoodie','Halfzip mit T-Shirt']).map((text,i)=>[i,text]))}
      ${select('topColor','FARBE OBERTEIL',Object.entries(wardrobe.colors).map(([key,v])=>[key,v[0]]))}
      ${select('pants','HOSE',['Kurze Hose','Jeans','Lockere Jogger · offener Beinabschluss'].map((text,i)=>[i,text]))}
      ${select('pantsColor','FARBE HOSE',Object.entries(wardrobe.colors).map(([key,v])=>[key,v[0]]))}
      ${select('jewelry',female?'KETTE':'KÖNIGSKETTE',[['none','Keine'],['gold','Gold'],['silver','Silber']])}
      ${select('glasses','SONNENBRILLE',[['false','Keine'],['true','Sonnenbrille']])}
      ${female?select('earrings','OHRRINGE',[['false','Keine'],['true','Creolen']]):''}
      <p class="assetCredits">Realistische Figuren: <a href="https://www.fab.com/listings/5e145586-3955-4688-8666-dc4b242e78e9" target="_blank" rel="noopener">NoEdge</a>. Schuhe passend zur Figur.</p>
    </div>`;
  }
  function openWardrobe(){
    if(!authSession?.user?.id){toast('Bitte zuerst anmelden.');return;}
    const dialog=accountDialog('wardrobeDialog','DEIN KLEIDERSCHRANK');dialog.classList.add('wardrobeDialog');
    dialog.insertAdjacentHTML('beforeend','<p>Dein Look hat keinen Einfluss auf Spielwerte.</p><div class="wardrobeLayout"><div class="wardrobePreview" data-wardrobe-preview></div><form class="wardrobeForm"><div data-wardrobe-fields></div><p class="accountError" role="alert"></p><button type="submit" class="primaryButton">LOOK SPEICHERN</button></form></div><p class="assetCredits">Charaktere: <a href="https://quaternius.com/packs/ultimatemodularcharacters.html" target="_blank" rel="noopener">Quaternius</a>, CC0. Anhänger: <a href="https://game-icons.net/1x1/lorc/gem-pendant.html" target="_blank" rel="noopener">Lorc / Game-icons.net</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a> (Farbe und Größe angepasst).</p>');
    const userId=authSession.user.id,form=dialog.querySelector('form');let draft=appearance(),busy=false;
    function render(){
      const fields=form.querySelector('[data-wardrobe-fields]');fields.innerHTML=wardrobeOptions(draft);
      for(const field of fields.querySelectorAll('select'))if(Object.hasOwn(draft,field.name))field.value=String(draft[field.name]);
      fields.querySelector('[data-classic-fields]').hidden=draft.collection!=='classic';fields.querySelector('[data-modular-fields]').hidden=draft.collection!=='modular';fields.querySelector('[data-realistic-fields]').hidden=draft.collection!=='realistic';
      dialog.querySelector('[data-wardrobe-preview]').innerHTML=wardrobe.markup(draft);
    }
    render();
    form.addEventListener('change',event=>{
      const field=event.target;if(!field.name)return;
      draft=wardrobe.normalize({...draft,[field.name]:['character','classic','hair','top','pants','shoes'].includes(field.name)?Number(field.value):['glasses','earrings'].includes(field.name)?field.value==='true':field.value});
      const focusName=field.name;render();Array.from(form.querySelectorAll('select')).find(e=>e.name===focusName&&!e.closest('[hidden]'))?.focus();
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
    return window.betaUI.openAdmin(currentAccount);
  }
  function setup(){
    document.getElementById('wardrobeMenuButton')?.addEventListener('click',openWardrobe);
    document.getElementById('adminMenuButton')?.addEventListener('click',()=>void openAdmin());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
  window.accountUI={initialize,appearance,openWardrobe,closePrivateViews,handleError:async error=>{if(error.data?.code==='ACCOUNT_BANNED'||error.data?.code==='LEGAL_REQUIRED'||error.data?.code==='ONBOARDING_REQUIRED'){stopActivity();await initialize();}}};
})();
