/* One compatibility boundary for saved cars, public players and legacy garages. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const studio=()=>node?require('./vehicle-studio'):root.vehicleStudio;
 const rewards=()=>node?require('./vehicle-rewards'):root.vehicleRewards;
 const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
 function transform(v={}){v=v&&typeof v==='object'?v:{};return {scale:clamp(v.scale,.75,1.15,1),translateX:clamp(v.translateX,-.08,.08,0),translateY:0,groundY:0,visualWidth:clamp(v.visualWidth,.05,1,1),visualHeight:clamp(v.visualHeight,.05,1,1),characterOffset:clamp(v.characterOffset,0,.08,0),petOffset:clamp(v.petOffset,0,.08,0)};}
 function presentation(v={}){v=v&&typeof v==='object'?v:{};return {mode:v.mode==='model'?'model':'photo',customVehicleTransform:transform(v.customVehicleTransform)};}
 function normalize(input={}){
  const v=input||{},base=v.vehicleConfig||v;
  const car={id:base.id||v.id||'',brand:base.brand||v.brand||'',model:base.model||v.model||'',vehicle:base.vehicle||v.vehicle||'',series:base.series||base.generation||v.vehicleSeries||'',body:base.body||base.bodyType||base.body_type||v.bodyType||'',year:base.year||base.model_year||v.vehicleYear||'',color:base.paintColor||base.color||v.color||'',photo:base.customUploadedVehicle||base.photo||v.photoUrl||'',cosmetics:rewards().normalize(base.cosmetics||v.cosmetics)};
  const selected=studio()?.select(car),p=presentation(base.presentation||v.presentation);
  return {...car,version:1,generation:selected?.code||car.series,bodyType:car.body,paintColor:studio().color(car.color),baseVehicleAsset:selected?.asset||selected?.family||null,wheelId:car.cosmetics.rims,wheelSize:'factory',bodyKitId:car.cosmetics.package,frontBumper:'stock',rearBumper:'stock',sideSkirts:car.cosmetics.package,spoiler:car.cosmetics.spoiler||'stock',suspension:car.cosmetics.suspension||'stock',exhaust:'stock',tint:car.cosmetics.tint||'stock',accessories:[],customUploadedVehicle:car.photo,presentation:p,customVehicleTransform:p.customVehicleTransform};
 }
 const api={normalize,presentation,transform};if(node)module.exports=api;else root.vehicleConfiguration=api;
})(typeof globalThis==='object'?globalThis:this);
