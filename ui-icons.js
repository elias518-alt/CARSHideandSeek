'use strict';
/* Small local icon set; no network dependency or emoji rendering differences. */
const appIconPaths={
  crown:'<path d="m3 6 5 4 4-7 4 7 5-4-2 13H5Z"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM3 3v3m-1-1h3"/>',
  arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 6-5 12 0 18 5-6 5-12 0-18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  qr:'<path d="M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h3v3h3v3h-6Z"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  gear:'<path d="m9 3 1-2h4l1 2 3 2 2 1 2 4-1 2 1 2-2 4-2 1-3 2-1 2h-4l-1-2-3-2-2-1-2-4 1-2-1-2 2-4 2-1Z"/><circle cx="12" cy="12" r="4"/>',
  home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  car:'<path d="m5 7 2-3h10l2 3 2 3v8H3v-8Z"/><path d="M5 7h14M3 12h18M6 15h2m8 0h2M5 18v3m14-3v3"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  chat:'<path d="M3 4h18v13H9l-6 4Z"/><path d="M7 8h10M7 12h7"/>',
  chart:'<path d="M4 20V4M4 20h17M8 16v-4m5 4V7m5 9v-6"/>'
  ,flag:'<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>'
  ,trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 1h10"/>'
};
function appIcon(name){return '<svg class="uiIcon" viewBox="0 0 24 24" aria-hidden="true">'+(appIconPaths[name]||appIconPaths.star)+'</svg>';}
const glyphIcons={'⌂':'home','🚘':'car','🚗':'car','♟':'people','👥':'people','👤':'person','●':'person','♛':'chart','⚙':'gear','▶':'play','💬':'chat','📊':'chart','🏁':'flag','🏆':'trophy'};
for(const element of document.querySelectorAll('.navButton>span,.navPlay>span,.actionSymbol,.menuRow>span,.stageSettings,.settingsButton,.statIcon')){
  const name=glyphIcons[element.textContent.trim()];if(name)element.innerHTML=appIcon(name);
}
for(const [id,name] of [['freshSettingsButton','settings'],['freshInviteButton','people'],['freshChatButton','chat']]){
  const button=document.getElementById(id);if(!button)continue;
  for(const node of [...button.childNodes])if(node.nodeType===3 && node.textContent.trim())node.remove();
  button.insertAdjacentHTML('afterbegin',appIcon(name));
}
const addCarIcon=document.getElementById('addCar');if(addCarIcon){addCarIcon.innerHTML=appIcon('plus');addCarIcon.setAttribute('aria-label','Fahrzeug hinzufügen');}
const addVehicleIcon=document.querySelector('#garageAddCar>span');if(addVehicleIcon)addVehicleIcon.innerHTML=appIcon('plus');
