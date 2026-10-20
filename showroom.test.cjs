'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{alphaBounds,composition}=require('./showroom');
test('transparent padding and faint extraction shadows do not set the vehicle floor',()=>{
 const w=120,h=100,pixels=new Uint8ClampedArray(w*h*4);
 for(let y=25;y<75;y++)for(let x=30;x<100;x++)pixels[(y*w+x)*4+3]=255;
 for(let y=75;y<95;y++)for(let x=15;x<110;x++)pixels[(y*w+x)*4+3]=20;
 const box=alphaBounds(pixels,w,h);assert.equal(box.x*w,29);assert.equal(box.y*h,24);assert.equal(box.w*w,72);assert.equal(box.h*h,52);
});
test('opaque photos and empty alpha are preserved without invalid cropping',()=>{
 const pixels=new Uint8ClampedArray(40*30*4).fill(255);assert.deepEqual(alphaBounds(pixels,40,30),{x:0,y:0,w:1,h:1});
 assert.deepEqual(alphaBounds(new Uint8ClampedArray(40*30*4),40,30),{x:0,y:0,w:1,h:1});
});
test('front and side views share a car-relative figure scale on narrow and wide screens',()=>{
 for(const width of [320,360,390,568,1000])for(const ratio of [1.15,1.6,2.5]){
  const v=composition(width,ratio);assert.ok(v.carWidth>=width*.4);assert.ok(v.center-v.carWidth/2>=0);assert.ok(v.center+v.carWidth/2<=width);assert.ok(v.personHeight<=v.carWidth*.9);assert.ok(v.personHeight<=v.carHeight*1.1);
  const p=composition(width,ratio,true);assert.equal(p.center,width/2);assert.ok(p.carHeight<=380);assert.equal(p.ground,0);
 }
});
