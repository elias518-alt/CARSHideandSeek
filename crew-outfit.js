(function(root){
 'use strict';
 const fields=['top','pants','topColor','pantsColor'];
 const choices={top:{tshirt:'T-Shirt',hoodie:'Hoodie',bomber:'Bomberjacke',oversized:'Oversized Shirt',tank:'Tanktop',halfzip:'Half-Zip',pullover:'Pullover',jacket:'Leichte Jacke'},pants:{cargo:'Cargohose',jeans:'Straight Jeans',jogger:'Jogger',baggy:'Baggy Jeans',trousers:'Stoffhose',linen:'Leinenhose',shorts:'Kurze Hose',sportshorts:'Sportshorts'}};
 const indices={male:{top:{tshirt:0,hoodie:1,bomber:2,oversized:3,tank:4,halfzip:6,pullover:7,jacket:9},pants:{cargo:0,jeans:1,jogger:2,baggy:4,trousers:5,linen:7,shorts:8,sportshorts:9}},female:{top:{tshirt:0,hoodie:1,bomber:2,oversized:3,tank:4,halfzip:8,pullover:9,jacket:11},pants:{cargo:0,jeans:1,jogger:2,baggy:3,trousers:5,linen:6,shorts:7,sportshorts:8}}};
 function normalize(rule={}){return Object.fromEntries(fields.map(key=>[key,typeof rule?.[key]==='string'?rule[key]:'any']));}
 function expected(rule,key,gender){return key.endsWith('Color')?rule[key]:indices[gender==='female'?'female':'male'][key][rule[key]];}
 function matches(rule,appearance){return fields.every(key=>!rule?.[key]||rule[key]==='any'||(appearance?.collection==='studio'&&String(appearance[key])===String(expected(rule,key,appearance.gender))));}
 function draft(rule,appearance){const value={...appearance};for(const key of fields)if(rule?.[key]&&rule[key]!=='any'){const v=expected(rule,key,value.gender);if(v!==undefined)value[key]=v;}return value;}
 const api={choices,indices,normalize,matches,draft};if(typeof module==='object'&&module.exports)module.exports=api;else root.crewOutfit=api;
})(typeof globalThis==='object'?globalThis:this);
