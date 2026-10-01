(function(root){
  'use strict';
  const models=['men-casual','men-hoodie','men-punk','women-casual','women-formal','women-punk'];
  const characters=['Männlich · Casual','Männlich · Hoodie','Männlich · Punk','Weiblich · Casual','Weiblich · Formal','Weiblich · Punk'];
  const hair=['Kurz','Hoodie-Frisur','Irokesenschnitt','Bob','Hochgesteckt','Irokesenschnitt'];
  const outfits=[['Casual-Oberteil','Casual-Hose','Casual-Schuhe'],['Hoodie','Freizeitshorts','Freizeitschuhe'],['Punk-Oberteil','Punk-Hose','Punk-Schuhe'],['Freizeit-Oberteil','Freizeithose','Freizeitschuhe'],['Formal-Oberteil','Formal-Rock','Formal-Schuhe'],['Punk-Oberteil','Punk-Hose','Punk-Schuhe']];
  const jewelry={none:'Kein Schmuck',gold:'Goldfarbener Anhänger',silver:'Silberfarbener Anhänger'};
  const colors={black:['Schwarz','grayscale(1) brightness(.24)'],white:['Weiß','grayscale(1) brightness(1.6)'],navy:['Dunkelblau','grayscale(1) sepia(1) saturate(3) hue-rotate(165deg) brightness(.48)'],green:['Grün','grayscale(1) sepia(1) saturate(2) hue-rotate(65deg) brightness(.65)'],purple:['Violett','grayscale(1) sepia(1) saturate(3) hue-rotate(225deg) brightness(.7)'],red:['Bordeaux','grayscale(1) sepia(1) saturate(4) hue-rotate(310deg) brightness(.6)'],cream:['Beige','grayscale(1) sepia(.5) brightness(1.3)']};
  const hairColors={black:['Schwarz','grayscale(1) brightness(.35)'],brown:['Braun','grayscale(1) sepia(.8) brightness(.7)'],blonde:['Blond','grayscale(1) sepia(.7) brightness(1.65)'],auburn:['Kupfer','grayscale(1) sepia(1) saturate(2.5) hue-rotate(330deg) brightness(.85)']};
  const validColor=(v,palette,fallback)=>Object.hasOwn(palette,v)?v:fallback;
  const integer=(v,max,fallback=0)=>Number.isInteger(v)&&v>=0&&v<=max?v:fallback;
  function normalize(value){
    const v=value&&typeof value==='object'?value:{};
    if(v.collection==='realistic')return {version:2,collection:'realistic',gender:v.gender==='female'?'female':'male',classic:integer(v.classic,2),character:integer(v.character,5),hair:integer(v.hair,2),top:integer(v.top,2),pants:integer(v.pants,2),shoes:0,hairColor:validColor(v.hairColor,hairColors,'brown'),topColor:validColor(v.topColor,colors,'black'),pantsColor:validColor(v.pantsColor,colors,'navy'),jewelry:Object.hasOwn(jewelry,v.jewelry)?v.jewelry:'none',glasses:v.glasses===true,earrings:v.earrings===true};
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
    if(v.collection==='realistic'){
      const folder=`assets/characters/noedge/${v.gender}/`;
      const layer=(name,filter='')=>`<img src="${folder}${name}.webp" alt="" decoding="async" width="384" height="540"${filter?` style="filter:${filter}"`:''}>`;
      return `<span class="lobbyCrewCharacter wardrobeCharacter wardrobeRealistic lobbyCrewPose--side" aria-hidden="true">${layer('base')}${layer('pants-'+v.pants,colors[v.pantsColor][1])}${layer('top-'+v.top,colors[v.topColor][1])}${layer('shoes')}${layer('hair-'+v.hair,hairColors[v.hairColor][1])}${v.jewelry!=='none'?layer('chain',v.jewelry==='silver'?'grayscale(1) brightness(1.3)':''):''}${v.glasses?layer('glasses'):''}${v.gender==='female'&&v.earrings?layer('earrings',v.jewelry==='silver'?'grayscale(1) brightness(1.3)':''):''}</span>`;
    }
    if(v.collection==='classic')return `<span class="lobbyCrewCharacter lobbyCrewCharacter--${v.classic} lobbyCrewPose--side" aria-hidden="true"></span>`;
    const layers=Object.entries(parts(v)).map(([part,model])=>`<img src="assets/characters/quaternius/${model}-${part}.webp" alt="" decoding="async" width="384" height="540">`).join('');
    const ornament=v.jewelry==='none'?'':`<span class="wardrobeJewelry wardrobeJewelry--${v.jewelry}"></span>`;
    return `<span class="lobbyCrewCharacter wardrobeCharacter lobbyCrewPose--side" aria-hidden="true">${layers}${ornament}</span>`;
  }
  const api={models,characters,hair,outfits,jewelry,colors,hairColors,normalize,choices,parts,markup};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.wardrobe=api;
})(typeof globalThis==='object'?globalThis:this);
