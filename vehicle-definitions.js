/* Data-driven art capabilities. A package is not rendered until its asset is calibrated. */
(function(root){
 'use strict';const node=typeof module==='object'&&module.exports;
 const studio=node?require('./vehicle-studio'):root.vehicleStudio,rewards=node?require('./vehicle-rewards'):root.vehicleRewards;
 const rules=[
 {brand:'BMW',model:/3er|E36|E46|2er|M2/i,packages:['Standard','Sport','M-Sport-inspiriert','Street','Clean','Track']},
 {brand:'BMW',model:/5er|6er|7er|8er/i,packages:['Standard','Sport','Luxury','Alpina-inspiriert','Clean']},
 {brand:'BMW',model:/.*/,packages:['Standard','Sport','Street']},
 {brand:'Mercedes-Benz',model:/S-Klasse|GLS/i,packages:['Standard','Sport','Luxury','Maybach-inspiriert']},
 {brand:'Mercedes-Benz',model:/.*/,packages:['Standard','AMG-Line-inspiriert','Street','Luxury']},
 {brand:'Audi',model:/.*/,packages:['Standard','S-Line-inspiriert','Street','Track']},
 {brand:'Volkswagen',model:/Golf|Polo/i,packages:['Standard','R-Line-inspiriert','GTI-inspiriert','Street']},
 {brand:'Volkswagen',model:/.*/,packages:['Standard','R-Line-inspiriert','Street']},
 {brand:'Opel',model:/Astra|Corsa|Insignia/i,packages:['Standard','Sport','GSi-inspiriert','Street','Track']},
 {brand:'Porsche',model:/911|718/i,packages:['Standard','SportDesign-inspiriert','Touring','Track']},
 {brand:'Toyota',model:/Yaris|Corolla|Supra/i,packages:['Standard','GR-Sport-inspiriert','Street','Track']},
 {brand:'Cupra',model:/.*/,packages:['Standard','Performance','VZ-inspiriert','Track']},
 {brand:'Volvo',model:/.*/,packages:['Standard','Sport','R-Design-inspiriert']},
 {brand:'Renault',model:/Clio|Megane/i,before:2023,packages:['Standard','Sport','R.S.-inspiriert','Track']},
 {brand:'Renault',model:/Austral|Scenic|Clio/i,from:2023,packages:['Standard','Sport','Esprit-Alpine-inspiriert']},
 {brand:'Dacia',model:/Duster/i,packages:['Standard','Adventure','Offroad']},
 {brand:'Dacia',model:/.*/,packages:['Standard','Adventure']},
 {brand:'Ferrari',model:/.*/,packages:['Standard','Aero','Track','Lightweight']}
 ];
 function definition(car={}){const selected=studio.select(car),year=Number(car.year||car.model_year),rule=rules.find(r=>r.brand.toLowerCase()===String(car.brand).toLowerCase()&&r.model.test(car.model||'')&&(!r.from||year>=r.from)&&(!r.before||year<r.before));
  return {key:[car.brand,selected?.model||car.model,selected?.code||car.series||'unknown'].join('/'),generation:selected?.code||null,asset:selected?(selected.asset?.[0]||selected.family):null,view:'front-left-three-quarter',wheelAnchors:rewards.anchors(car),paint:'magenta-material-mask',packages:(rule?.packages||['Standard','Sport','Street']).map(label=>({label,official:false,requiresGenerationReview:true})),availableCosmetics:rewards.supports(car)?['rims','package','glow']:['glow'],requiredAsset:{width:1024,height:512,format:'webp-alpha',logos:false,wheels:['front: x,y,width,height,rotation,perspective','rear: x,y,width,height,rotation,perspective'],variants:['paint mask','wheel masks','front bumper','rear bumper','skirts','spoiler','glass mask','body/wheel separation for suspension']}};
 }
 const api={definition,rules};if(node)module.exports=api;else root.vehicleDefinitions=api;
})(typeof globalThis==='object'?globalThis:this);
