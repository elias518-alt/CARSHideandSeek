/* Local-only photo composition. No face recognition or remote AI service. */
(function(root){
 'use strict';
 function create(container,{onChange,onError}){
  container.innerHTML=`<h3>DEIN GESICHT · PLUS</h3><p>Nutze ein frontales Foto bei gleichmäßigem Licht. Passe Augen und Kinn in den Ausschnitt ein. Dein Foto wird auf die Figur gelegt; Körper und Frisur bleiben erhalten.</p><div class="photoActions"><button type="button" data-photo-gallery>FOTO AUSWÄHLEN</button><button type="button" data-photo-camera>FOTO AUFNEHMEN</button><button type="button" data-photo-remove>FOTO ENTFERNEN</button></div><input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file hidden><input type="file" accept="image/*" capture="user" data-photo-capture hidden><div data-photo-editor hidden><div class="photoCrop"><canvas width="192" height="256" aria-label="Gesichtsausschnitt"></canvas><span aria-hidden="true">Augen auf diese Linie</span></div><div class="photoSliders">${[['zoom','Zoom',1,5,.01,1],['horizontal','Links / rechts',0,100,1,50],['vertical','Oben / unten',0,100,1,50],['rotation','Drehen',-30,30,1,0]].map(([name,label,min,max,step,value])=>`<label>${label}<input type="range" name="photo-${name}" data-crop="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`).join('')}</div><label class="photoConsent"><input type="checkbox" data-photo-consent><span>Meinen Gesichtsausschnitt mit dem Look veröffentlichen. Er ist für Mitspieler und über eine öffentliche Bildadresse sichtbar.</span></label></div><p class="photoHint">Erst „Look speichern“ lädt den Ausschnitt hoch. Das Original bleibt auf deinem Gerät. Keine Gesichtserkennung und kein kostenpflichtiger KI-Dienst. Auf dem Handy öffnet „Foto aufnehmen“ die Kamera, am Computer gegebenenfalls die Dateiauswahl. Entfernen wird ebenfalls mit „Look speichern“ übernommen.</p>`;
  let source=null,sourceUrl='',previewUrl='',blob=null,revision=0,loading=false,disposed=false,enabled=false,removed=false;
  const canvas=container.querySelector('canvas'),ctx=canvas.getContext('2d'),settings={zoom:1,horizontal:50,vertical:50,rotation:0};
  const error=message=>onError(message);
  const changed=()=>onChange({url:previewUrl,removed});
  function clear(){revision++;source=null;blob=null;loading=false;removed=true;if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(previewUrl)URL.revokeObjectURL(previewUrl);sourceUrl=previewUrl='';container.querySelector('[data-photo-editor]').hidden=true;container.querySelector('[data-photo-consent]').checked=false;changed();}
  async function draw(){
   if(!source||disposed)return;const ticket=++revision;loading=true;
   ctx.clearRect(0,0,192,256);ctx.save();ctx.translate(96,128);ctx.rotate(settings.rotation*Math.PI/180);
   const factor=Math.max(192/source.width,256/source.height)*settings.zoom,w=source.width*factor,h=source.height*factor;
   ctx.drawImage(source,-96-(w-192)*settings.horizontal/100,-128-(h-256)*settings.vertical/100,w,h);ctx.restore();
   // Feathered ellipse contains only the selected face; EXIF and the original are never uploaded.
   ctx.save();ctx.globalCompositeOperation='destination-in';ctx.translate(96,128);ctx.scale(86,121);const fade=ctx.createRadialGradient(0,0,.82,0,0,1);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');ctx.fillStyle=fade;ctx.fillRect(-2,-2,4,4);ctx.restore();
   const next=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(disposed||ticket!==revision)return;
   loading=false;if(!next){error('Der Ausschnitt konnte nicht erstellt werden. Bitte ein anderes Foto wählen.');return;}
   const old=previewUrl;blob=next;previewUrl=URL.createObjectURL(next);removed=false;changed();if(old)URL.revokeObjectURL(old);
  }
  async function load(file){
   if(!enabled||!file)return;
   if(!/^image\/(jpeg|png|webp)$/.test(file.type)){error('Bitte ein JPG-, PNG- oder WebP-Foto wählen. HEIC gegebenenfalls als JPG exportieren.');return;}
   if(file.size>12*1024*1024){error('Bitte ein Foto unter 12 MB wählen.');return;}
   const ticket=++revision,url=URL.createObjectURL(file);loading=true;
   try{const img=new Image();img.src=url;await img.decode();if(disposed||ticket!==revision){URL.revokeObjectURL(url);return;}
    if(img.width*img.height>40000000||Math.min(img.width,img.height)<64)throw Error('Bitte ein Foto zwischen 64 Pixeln und 40 Megapixeln wählen.');
    if(sourceUrl)URL.revokeObjectURL(sourceUrl);source=img;sourceUrl=url;
    Object.assign(settings,{zoom:1,horizontal:50,vertical:50,rotation:0});container.querySelectorAll('[data-crop]').forEach(e=>e.value=settings[e.dataset.crop]);
    container.querySelector('[data-photo-consent]').checked=false;container.querySelector('[data-photo-editor]').hidden=false;error('');await draw();
   }catch(e){URL.revokeObjectURL(url);if(ticket===revision){loading=false;error(e.message.startsWith('Bitte')?e.message:'Dieses Foto konnte nicht geöffnet werden. Bitte JPG, PNG oder WebP verwenden.');}}
  }
  for(const [button,input] of [['gallery','file'],['camera','capture']]){
   const file=container.querySelector('[data-photo-'+input+']');container.querySelector('[data-photo-'+button+']').addEventListener('click',()=>{if(enabled)file.click();});
   file.addEventListener('change',()=>{void load(file.files[0]);file.value='';});
  }
  container.querySelector('[data-photo-remove]').addEventListener('click',clear);
  container.addEventListener('input',e=>{if(!enabled||!e.target.dataset.crop)return;settings[e.target.dataset.crop]=Number(e.target.value);void draw();});
  return {get url(){return previewUrl;},get blob(){return blob;},get processing(){return loading;},get consent(){return container.querySelector('[data-photo-consent]').checked;},get removed(){return removed;},clear,
   setState({editable,visible,busy=false,hasFace=false}){enabled=editable&&!busy;container.hidden=!visible;container.querySelectorAll('button,input').forEach(e=>e.disabled=!enabled);container.querySelector('[data-photo-remove]').disabled=busy||!(hasFace||blob);},
   acceptSaved(){revision++;source=null;blob=null;loading=false;if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(previewUrl)URL.revokeObjectURL(previewUrl);sourceUrl=previewUrl='';container.querySelector('[data-photo-editor]').hidden=true;},
   dispose(){disposed=true;revision++;if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(previewUrl)URL.revokeObjectURL(previewUrl);source=blob=null;}
  };
 }
 root.characterPhoto={create};
})(window);
