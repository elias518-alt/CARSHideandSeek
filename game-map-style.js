/* Recolour the provider's existing style; sources, data and attribution stay intact. */
(function(root){
 'use strict';
 function paintFor(layer){const name=(layer.id+' '+(layer['source-layer']||'')).toLowerCase();if(layer.type==='background')return {'background-color':'#111723'};
  if(layer.type==='fill'){if(/water/.test(name))return {'fill-color':'#17394e'};if(/park|wood|forest|grass|landcover/.test(name))return {'fill-color':'#203d39'};if(/building/.test(name))return {'fill-color':'#343447','fill-opacity':.72};if(/landuse|residential/.test(name))return {'fill-color':'#1c2532'};}
  if(layer.type==='line'&&/road|transport|motorway|trunk|primary|secondary/.test(name)){if(/motorway|trunk|primary/.test(name))return {'line-color':'#bf8b65'};if(/secondary|tertiary/.test(name))return {'line-color':'#81779a'};return {'line-color':'#475166'};}
  if(layer.type==='symbol'&&layer.layout?.['text-field'])return {'text-color':'#c8d5df','text-halo-color':'#151c29','text-halo-width':1.3};return {};
 }
 function apply(map){for(const layer of map.getStyle()?.layers||[])for(const [key,value]of Object.entries(paintFor(layer)))try{map.setPaintProperty(layer.id,key,value);}catch{/* Unsupported provider layer keeps its original style. */}}
 const api={apply,paintFor};if(typeof module==='object'&&module.exports)module.exports=api;else root.gameMapStyle=api;
})(typeof globalThis==='object'?globalThis:this);
