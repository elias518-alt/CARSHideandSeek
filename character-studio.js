(function(root){
 'use strict';
 const avatar=typeof module==='object'&&module.exports?require('./character-avatar'):root.characterAvatar;
 const colors={black:['Schwarz','#20252c'],white:['Weiß','#e6e7e2'],navy:['Nachtblau','#263b60'],green:['Salbei','#657a65'],purple:['Violett','#79508e'],red:['Bordeaux','#843c4c'],cream:['Sand','#bcae91'],pink:['Rosa','#cf759a'],orange:['Orange','#d87934'],blue:['Eisblau','#6facc8']};
 const outfits=['Cargo & T-Shirt','Denim & Hoodie','Bomber & Jogger'];
 const garments={male:{tops:['T-Shirt','Hoodie','Bomberjacke','Overshirt','Poloshirt','Collegejacke','Mantel','Sportshirt'],pants:['Cargohose','Straight Jeans','Jogger','Shorts','Wide-Leg Hose','Chino']},female:{tops:['Fitted T-Shirt','Taillierter Hoodie','Kurze Bomberjacke','Overshirt','Poloshirt','Collegejacke','Mantel','Sportshirt'],pants:['Cargohose','Straight Jeans','Jogger','Bermudashorts','Wide-Leg Hose','Chino']}};
 const shoes=['Sneaker','High-Tops','Boots','Runner'];
 const choice=(n,max,fallback=0)=>Number.isInteger(n)&&n>=0&&n<=max?n:fallback;
 const color=(v,f)=>Object.hasOwn(colors,v)?v:f;
 const faceBase='https://yyvljkzitodxhtkilsxm.supabase.co/storage/v1/object/public/profile-images/';
 const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',facePattern=new RegExp('^'+uuid+'/character-face-'+uuid+'\\.png$');
 // Read legacy photo paths only for removal. They are never rendered in v5.
 function normalizeFace(face){return face&&typeof face.path==='string'&&facePattern.test(face.path)&&!/[\r\n]/.test(face.path)?{path:face.path}:null;}
 function ownsFace(value,userId){const face=normalizeFace(value?.face);return !face||face.path.split('/')[0]===userId;}
 function normalize(input={}){const v=input&&typeof input==='object'?input:{},legacy=choice(v.outfit,2),gender=v.gender==='female'||v.collection==='modular'&&v.character>=3?'female':'male';return {version:5,collection:'studio',gender,top:choice(v.top,7,legacy),pants:choice(v.pants,5,legacy),shoes:choice(v.shoes,3),topColor:color(v.topColor,'black'),pantsColor:color(v.pantsColor,'navy'),shoeColor:color(v.shoeColor,'white'),pose:choice(v.pose,4),winPose:choice(v.winPose,2),traits:avatar.traits(v.traits,gender),classic:choice(v.classic,2),face:null};}
 function render(value,context='standing'){const v=normalize(value);return avatar.render({...v,_colors:colors},context==='victory'?'victory':'standing');}
 const api={normalize,normalizeFace,ownsFace,render,colors,outfits,garments,shoes,faceBase};if(typeof module==='object'&&module.exports)module.exports=api;else root.characterStudio=api;
})(typeof globalThis==='object'?globalThis:this);
