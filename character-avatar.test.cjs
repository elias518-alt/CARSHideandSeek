'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const avatar=require('./character-avatar'),studio=require('./character-studio'),selfie=require('./selfie-avatar');
test('visual traits are bounded and discard photo/landmark data and injected strings',()=>{
 const input={skin:99,hair:-1,hairColor:'red',eyes:Infinity,shape:3,beard:2,glasses:'true',eyeSpacing:99,eyeSize:NaN,nose:-2,mouth:1.123456,photo:'secret',landmarks:[1,2]};
 assert.deepEqual(avatar.traits(input),{skin:1,hair:0,hairColor:1,eyes:0,shape:3,beard:2,glasses:false,eyeSpacing:1.15,eyeSize:1,nose:.8,mouth:1.12});
 assert.equal(avatar.traits(null,'female').hair,4);
 const v=studio.normalize({shoes:99,pose:-1,winPose:99,traits:input});assert.equal(v.shoes,0);assert.equal(v.pose,0);assert.equal(v.winPose,0);assert.equal(v.traits.photo,undefined);
});
test('all stand and victory poses have distinct limbs with a shared ground plane',()=>{
 const renders=[];for(let pose=0;pose<5;pose++){const html=studio.render({pose});assert.match(html,new RegExp('data-pose="'+pose+'"'));assert.doesNotMatch(html,/avatarCelebrating/);assert.match(html,/viewBox="0 30 320 610"/);renders.push(html.match(/class="avatarArm avatarArm--right">([\s\S]*?)<g transform/)[1]);}
 assert.ok(new Set(renders).size>=3);
 for(let winPose=0;winPose<3;winPose++){const html=studio.render({winPose},'victory');assert.match(html,/avatarCelebrating/);assert.match(html,new RegExp('data-pose="'+(5+winPose)+'"'));assert.doesNotMatch(html,/<image|href=/);}
});
test('only a surviving winner celebrates, including valid seekers and hidden hiders',()=>{
 const outcome=(role,seekersWin,more={})=>avatar.won({result:{seekersWin,players:[{id:'me',role,...more}]}},'me');
 assert.equal(outcome('SEEKER',true),true);assert.equal(outcome('SEEKER',false),false);assert.equal(outcome('HIDER',false),true);assert.equal(outcome('HIDER',true),false);
 for(const extra of [{eliminated:true},{found:true},{foundBy:'seeker'}])assert.equal(outcome('HIDER',false,extra),false);
 assert.equal(outcome('SEEKER',true,{eliminated:true}),false);assert.equal(outcome('SPECTATOR',false),false);assert.equal(outcome('HIDER',undefined),false);assert.equal(avatar.won({},'me'),false);assert.equal(avatar.won({result:{aborted:true,seekersWin:true,players:[{id:'me',role:'SEEKER'}]}},'me'),false);
});
test('local landmarks reject malformed input; valid proportions and palette matching are bounded',()=>{
 for(const p of [[],Array(68).fill({x:0,y:0}),Array(68).fill({x:NaN,y:0})])assert.throws(()=>selfie.proportions(p));
 const p=Array.from({length:68},(_,i)=>({x:i*3,y:50+i}));p[8].y=180;
 const traits=avatar.traits(selfie.proportions(p));assert.ok(traits.eyeSpacing>=.85&&traits.eyeSpacing<=1.15);assert.ok(traits.nose>=.8&&traits.nose<=1.2);
 assert.equal(selfie.nearest([255,255,255],['#000000','#ffffff']),1);
});
test('only the two vendored public face model binaries are served',async()=>{
 const server=http.createServer(require('./server').handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+server.address().port;
 for(const file of ['tiny_face_detector_model.bin','face_landmark_68_tiny_model.bin']){const r=await fetch(base+'/assets/vendor/face-api/models/'+file);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.ok((await r.arrayBuffer()).byteLength>50000);}
 assert.equal((await fetch(base+'/server.bin')).status,404);assert.equal((await fetch(base+'/server.js')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
