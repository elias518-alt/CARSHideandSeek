(function(root){
  'use strict';
  const models=['men-casual','men-hoodie','men-punk','women-casual','women-formal','women-punk'];
  const characters=['Männlich · Casual','Männlich · Hoodie','Männlich · Punk','Weiblich · Casual','Weiblich · Formal','Weiblich · Punk'];
  const hair=['Kurz','Hoodie-Frisur','Irokesenschnitt','Bob','Hochgesteckt','Irokesenschnitt'];
  const outfits=[['Casual-Oberteil','Casual-Hose','Casual-Schuhe'],['Hoodie','Freizeitshorts','Freizeitschuhe'],['Punk-Oberteil','Punk-Hose','Punk-Schuhe'],['Freizeit-Oberteil','Freizeithose','Freizeitschuhe'],['Formal-Oberteil','Formal-Rock','Formal-Schuhe'],['Punk-Oberteil','Punk-Hose','Punk-Schuhe']];
  const jewelry={none:'Kein Schmuck',gold:'Goldfarbener Anhänger',silver:'Silberfarbener Anhänger'};
  const integer=(v,max,fallback=0)=>Number.isInteger(v)&&v>=0&&v<=max?v:fallback;
  function normalize(value){
    const v=value&&typeof value==='object'?value:{};
    return {version:1,collection:v.collection==='modular'?'modular':'classic',character:integer(v.character,5),classic:integer(v.classic,2),
      hair:integer(v.hair,2),top:integer(v.top,2),pants:integer(v.pants,2),shoes:integer(v.shoes,2),jewelry:Object.hasOwn(jewelry,v.jewelry)?v.jewelry:'none'};
  }
  function choices(character){return character<3?[0,1,2]:[3,4,5];}
  function parts(value){
    const v=normalize(value),group=choices(v.character);
    return {legskin:v.character<3?'men-hoodie':'women-formal',pants:models[group[v.pants]],shoes:models[group[v.shoes]],top:models[group[v.top]],head:models[v.character],hair:models[group[v.hair]]};
  }
  function markup(value){
    const v=normalize(value);
    if(v.collection==='classic')return `<span class="lobbyCrewCharacter lobbyCrewCharacter--${v.classic} lobbyCrewPose--side" aria-hidden="true"></span>`;
    const layers=Object.entries(parts(v)).map(([part,model])=>`<img src="assets/characters/quaternius/${model}-${part}.webp" alt="" decoding="async" width="384" height="540">`).join('');
    const ornament=v.jewelry==='none'?'':`<span class="wardrobeJewelry wardrobeJewelry--${v.jewelry}"></span>`;
    return `<span class="lobbyCrewCharacter wardrobeCharacter lobbyCrewPose--side" aria-hidden="true">${layers}${ornament}</span>`;
  }
  const api={models,characters,hair,outfits,jewelry,normalize,choices,parts,markup};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.wardrobe=api;
})(typeof globalThis==='object'?globalThis:this);
