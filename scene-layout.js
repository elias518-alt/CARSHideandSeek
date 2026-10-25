/* Normalized coordinates; a shared floor and separate vehicle/companion lanes. */
(function(root){
 'use strict';
 const petAnchors={parrot:{kind:'shoulder',scale:.28,footX:.63,footY:.64},monkey:{kind:'shoulder',scale:.24,footX:.5,footY:1},hamster:{kind:'shoulder',scale:.11,footX:.5,footY:.96},horse:{kind:'ground',scale:.78},donkey:{kind:'ground',scale:.61},shepherd:{kind:'ground',scale:.43},husky:{kind:'ground',scale:.4},doberman:{kind:'ground',scale:.46},bengal:{kind:'ground',scale:.25},shorthair:{kind:'ground',scale:.25},fish:{kind:'ground',scale:.22}};
 function layout({width,ratio=2,pet,petRatio=1,petScale=1,petFlip=false,pose=0,mode='home',scale=1,translateX=0,hasCharacter=true}){
  width=Math.max(1,Number(width)||1);ratio=Math.max(.3,Math.min(8,Number(ratio)||2));
  const anchor=petAnchors[pet]||null,large=anchor&&anchor.scale>.5;
  const fraction=hasCharacter?(large?.56:.70):.90;
  const carWidth=Math.min(width*fraction,Math.min(width*fraction,mode==='profile'?550:680,width*.64*ratio)*Math.min(1.15,Math.max(.75,Number(scale)||1)));
  const carHeight=carWidth/ratio,personHeight=Math.min(width*.55,carHeight*1.08,280),personWidth=personHeight*.40;
  const personLeft=Math.min(width-personWidth-8,width*(large?.63:.79));
  const desiredCenter=width*.035+carWidth/2+width*Math.min(.08,Math.max(-.08,Number(translateX)||0));
  const center=Math.max(carWidth/2+width*.02,Math.min(desiredCenter,(hasCharacter?personLeft-6:width-width*.02)-carWidth/2));
  const ground=18,petHeight=anchor?personHeight*anchor.scale*Math.max(.86,Math.min(1.12,Number(petScale)||1)):0,shoulder=anchor?.kind==='shoulder';
  return {carWidth,carHeight,center,personHeight,personLeft,ground,personDepth:0,petHeight,petLeft:shoulder?Math.min(width-petHeight*petRatio-6,personLeft+personWidth*(pose===1?.28:.72)-petHeight*petRatio*(petFlip?1-(anchor.footX||0):anchor.footX||0)):Math.max(width*.76,center+carWidth/2+4),petBottom:shoulder?ground+personHeight*.80-petHeight*(1-(anchor.footY||1)):ground,sceneHeight:Math.max(carHeight,personHeight+petHeight*.15)+ground+32,petKind:anchor?.kind||'ground'};
 }
 const api={layout,petAnchors};if(typeof module==='object'&&module.exports)module.exports=api;else root.sceneLayout=api;
})(typeof globalThis==='object'?globalThis:this);
