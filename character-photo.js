/* The selected photo exists only in this editor and is discarded after analysis. */
(function(root){
 'use strict';
 function create(container,{onChange,onError,getLook}){
  container.innerHTML='<h3>AVATAR AUS DEINEM SELFIE · PLUS</h3><p>Aus Gesichtsform, Proportionen und Farbvorschlägen entsteht deine gezeichnete Spielfigur. Das Foto wird nicht in die Figur eingesetzt und bleibt auf deinem Gerät.</p><div class="photoActions"><button type="button" data-photo-gallery>FOTO AUSWÄHLEN</button><button type="button" data-photo-camera>SELFIE AUFNEHMEN</button></div><input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file hidden><input type="file" accept="image/*" capture="user" data-photo-capture hidden><p data-avatar-status role="status" aria-live="polite"></p><p class="photoHint">Ein Gesicht, frontal und bei gutem Licht. Prüfe den Vorschlag anschließend unter Gesicht &amp; Haare. Frisur, Bart und Brille wählst du selbst. Die Ähnlichkeit ist stilisiert; Licht und Perspektive können Farbvorschläge verändern. Erst „Look speichern“ übernimmt deine Figur.</p>';
  let enabled=false,disposed=false,loading=false,revision=0,photoUrl='';
  const status=container.querySelector('[data-avatar-status]');
  function controls(){container.querySelectorAll('button,input').forEach(el=>el.disabled=!enabled||loading);}
  async function load(file){
   if(!enabled||loading||!file)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)){onError('Bitte JPG, PNG oder WebP wählen. HEIC vorher als JPG exportieren.');return;}
   if(file.size>12*1024*1024){onError('Bitte ein Foto unter 12 MB wählen.');return;}
   const ticket=++revision;loading=true;controls();onError('');status.textContent='Gesicht wird auf deinem Gerät analysiert …';photoUrl=URL.createObjectURL(file);const url=photoUrl;
   let canvas;
   try{
    const image=new Image();image.src=url;await image.decode();if(disposed||ticket!==revision)return;
    if(image.naturalWidth*image.naturalHeight>40000000)throw Error('Bitte ein Foto mit höchstens 40 Megapixeln wählen.');
    const scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const look=getLook(),traits=await root.selfieAvatar.analyze(canvas,look.traits,look.gender);
    if(disposed||ticket!==revision||!enabled)return;
    onChange(traits);status.textContent='Dein Avatar-Vorschlag ist bereit. Prüfe Gesicht, Haare und Farben. Das Foto wurde verworfen.';
   }catch(error){if(!disposed&&ticket===revision){onError(error.message||'Das Selfie konnte nicht verarbeitet werden. Du kannst deinen Avatar auch manuell gestalten.');status.textContent='';}}
   finally{URL.revokeObjectURL(url);if(photoUrl===url)photoUrl='';if(canvas){canvas.width=canvas.height=1;}if(ticket===revision){loading=false;controls();}}
  }
  for(const [button,input]of [['gallery','file'],['camera','capture']]){const field=container.querySelector('[data-photo-'+input+']');container.querySelector('[data-photo-'+button+']').addEventListener('click',()=>{if(enabled&&!loading)field.click();});field.addEventListener('change',()=>{void load(field.files[0]);field.value='';});}
  return {get processing(){return loading;},setState({editable,visible,busy=false}){enabled=editable&&!busy;container.hidden=!visible;if(!editable&&loading){revision++;loading=false;status.textContent='';if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';}controls();},dispose(){disposed=true;revision++;enabled=false;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';}};
 }
 root.characterPhoto={create};
})(window);
