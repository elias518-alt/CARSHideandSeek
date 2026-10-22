'use strict';
/* Mobile game presentation. Existing actions and account data stay authoritative. */
(function(){
 const $=id=>document.getElementById(id);
 function profileScene(car,player){
  const box=$('profileVehicleStage');if(!box)return;
  const html=car?carPhotoMarkup(car,'profile')+lobbyCharacterMarkup(player):'<button type="button" data-page="garage" class="profileNoVehicle">'+appIcon('car')+'<span>Dein Fahrzeug wartet<small>In der Garage hinzufügen</small></span></button>';
  const signature=html.replace(/(avatar|character-studio|studio-car|pet)-\d+/g,'$1-id');
  if(box.dataset.designMarkup!==signature||!box.querySelector('.lobbyCrewCharacter,.profileNoVehicle')){box.innerHTML=html;box.dataset.designMarkup=signature;window.showroom?.refresh();}
 }
 function destinationArt(){for(const button of document.querySelectorAll('.profileDestination')){let art=button.querySelector('.destinationArt');if(!art){art=document.createElement('div');art.className='destinationArt';art.setAttribute('aria-hidden','true');button.prepend(art);}const type=button.dataset.destination;const html=type==='look'?wardrobe.markup(window.accountUI?.appearance?.()):type==='pets'?pets.render(window.petUI?.selection?.()||{breed:'husky'}):type==='statistik'?appIcon('trophy'):'';const signature=html.replace(/(character-studio|pet)-\d+/g,'$1-id');if(art.dataset.signature!==signature){art.innerHTML=html;art.dataset.signature=signature;}}}
 function identity(){destinationArt();
  const badge=$('profileMembership');if(badge){badge.textContent=window.plusUI?.active?'PLUS':'BASIS';badge.dataset.plus=String(window.plusUI?.active===true);}
 }
 function setupProfile(){
  const profile=$('profile'),hero=profile.querySelector('.profileHero');
  const title=document.createElement('div');title.className='profileHeading';title.innerHTML='<span class="gameEyebrow">CAR HIDE & SEEK</span><h2>DEIN PROFIL</h2>';
  hero.prepend(title);const settings=hero.querySelector('.settingsButton');settings.innerHTML=appIcon('gear');settings.setAttribute('aria-label','Profileinstellungen öffnen');
  const identityBox=document.createElement('div');identityBox.className='profileIdentity';
  const text=document.createElement('div');text.className='profileIdentityText';
  identityBox.append($('profileAvatar'),text);text.append($('profileName'),$('profileTag'));
  const badge=document.createElement('span');badge.id='profileMembership';text.append(badge);$('profileVehicleStage').after(identityBox);
  const menu=document.createElement('section');menu.className='profileDestinations';menu.setAttribute('aria-label','Dein Profil gestalten');
  const destinations={STATISTIKEN:['chart','statistik','Deine Runden im Überblick'],KLEIDERSCHRANK:['people','look','Figuren, Outfits und Posen'],'HAUSTIERE · PLUS':['star','pets','Dein Begleiter'],GARAGE:['car','garage','Fahrzeuge und Belohnungen']};
  const oldPanels=new Set();
  for(const button of profile.querySelectorAll('.menuRow')){
   const title=button.querySelector('strong')?.textContent.trim(),entry=destinations[title];if(!entry)continue;
   oldPanels.add(button.parentElement);button.className='profileDestination';button.dataset.destination=entry[1];
   button.querySelector('span').innerHTML=appIcon(entry[0]);button.querySelector('small').textContent=entry[2];menu.append(button);
  }
  const ordered=['statistik','look','pets','garage'];ordered.forEach(key=>{const item=menu.querySelector('[data-destination='+key+']');if(item)menu.append(item);});
  profile.querySelector('.profileStats').after(menu);
  for(const panel of oldPanels){panel.classList.add('profileUtilityMenu');for(const button of panel.querySelectorAll('.menuRow'))if(button.id!=='adminMenuButton')button.hidden=true;}
  const stats=profile.querySelectorAll('.profileStatIcon');['flag','trophy','target','chart'].forEach((name,i)=>{if(stats[i])stats[i].innerHTML=appIcon(name);});
  profile.querySelector('.plusCard')?.classList.add('profilePlusCompact');identity();window.referenceUI?.renderOwn();
 }
 function onPage(page){
  if(page==='garage')window.vehicleRewardsUI?.refresh();
  if(page==='profile'){identity();window.referenceUI?.renderOwn();}
 }
 function setup(){
  setupProfile();
  document.addEventListener('chs:plus-changed',identity);
  document.addEventListener('click',event=>{
   if(event.target.closest('[data-all-achievements]')){document.getElementById('allAchievementsButton')?.click();return;}
   const action=event.target.closest('[data-design-action]')?.dataset.designAction;if(!action)return;
   if(action==='privacy')void window.socialMap?.settings();
   if(action==='accent')void window.plusUI?.open();
   if(action==='wardrobe')void window.accountUI?.openWardrobe();
   if(action==='logout'){$('profileEditDialog')?.close();void logout();}
  });
  const reward=$('garageRewardCard');if(reward)$('garageAddCar')?.after(reward);
 }
 window.gameDesign={destinationArt,identity,profileScene,onPage};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
