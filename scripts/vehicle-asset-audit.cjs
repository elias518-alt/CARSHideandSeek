const fs=require('node:fs'),search=require('../vehicle-search'),generations=require('../vehicle-generations'),definitions=require('../vehicle-definitions');
const rows=[];
for(const brand of search.brands())for(const model of search.modelsForBrand(brand)){
 const name=typeof model==='string'?model:model.model,car={brand,model:name,...(typeof model==='object'?model:{})};
 const ranges=generations.ranges(car);
 for(const range of ranges.length?ranges:[null]){
  const base={...car,...(range?{series:range.name,year:range.from}:{})};
  const variants=[base];
  if(brand==='BMW'&&definitions.definition(base).generation==='E36')variants.push({...base,body:'Coupé'});
  for(const v of variants){const d=definitions.definition(v);rows.push({...v,...d,missing:[...(!d.asset?['model-specific image','paint mask']:[]),...(!d.wheelAnchors?['measured wheel anchors','wheel masks']:[]),...(d.asset==='bmwe36coupe'?[]:['verified logo-free source']),'generation-specific bodykit assets','spoiler mask','suspension split','tint mask']});}
 }
}
const metadata={generated:'2026-10-22',note:'Existing illustrations are preserved. Package labels are art briefs, not claims of official availability. No uncalibrated package is selectable.'};
// One complete definition per line keeps generated diffs reviewable.
fs.writeFileSync('docs/vehicle-asset-audit.json','{\n  "generated": '+JSON.stringify(metadata.generated)+',\n  "note": '+JSON.stringify(metadata.note)+',\n  "vehicles": [\n'+rows.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
console.log(JSON.stringify({definitions:rows.length,withArt:rows.filter(x=>x.asset).length,withWheelAnchors:rows.filter(x=>x.wheelAnchors).length}));
