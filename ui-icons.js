'use strict';
/* Small local icon set; no network dependency or emoji rendering differences. */
const appIconPaths={
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
function appIcon(name){return '<svg class="uiIcon" viewBox="0 0 24 24" aria-hidden="true">'+appIconPaths[name]+'</svg>';}
const glyphIcons={'⌂':'home','🚘':'car','🚗':'car','♟':'people','👥':'people','👤':'person','●':'person','♛':'chart','⚙':'settings','▶':'play','💬':'chat','📊':'chart','🏁':'flag','🏆':'trophy'};
for(const element of document.querySelectorAll('.navButton>span,.navPlay>span,.actionSymbol,.menuRow>span,.stageSettings,.settingsButton,.statIcon')){
  const name=glyphIcons[element.textContent.trim()];if(name)element.innerHTML=appIcon(name);
}
for(const [id,name] of [['freshSettingsButton','settings'],['freshInviteButton','people'],['freshChatButton','chat']]){
  const button=document.getElementById(id);if(!button)continue;
  for(const node of [...button.childNodes])if(node.nodeType===3 && node.textContent.trim())node.remove();
  button.insertAdjacentHTML('afterbegin',appIcon(name));
}
