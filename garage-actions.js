'use strict';
let editingVehicleId = null;

function refreshVehicleForm() {
  const brand=$('#newCarBrand').value.trim(), model=$('#newCarModel').value.trim();
  const select=$('#newCarGeneration');
  const signature=brand.toLowerCase()+'|'+model.toLowerCase();
  if(select.dataset.model!==signature) {
    $('#newCarSeries').value='';
    select.dataset.model=signature;
    select.replaceChildren(new Option('Baureihe selbst angeben / unbekannt',''));
    for(const item of vehicleCatalog.ranges(brand,model))select.add(new Option(item.label,item.label));
  }
  $('#generationHint').textContent=select.options.length>1
    ? 'Bauzeiten für Europa; Karosserievarianten können abweichen. Alternativ eigene Baureihe eintragen.'
    : 'Für dieses Modell bitte Baujahr und bei Bedarf die Baureihe selbst angeben.';
  if(!pendingCarPhoto){
    const existing=localGarage.find(car=>car.id===editingVehicleId);
    $('#newCarPhotoPreview').innerHTML=carPhotoMarkup({brand,model,body:$('#newCarBody').value,photo:existing?.photo});
  }
}

function editVehicle(id) {
  if(gameSession){toast('Verlasse zuerst die Lobby, um deine Garage zu bearbeiten.');return;}
  const car=localGarage.find(item=>item.id===id);if(!car)return;
  openCarModal();editingVehicleId=id;
  $('#newCarBrand').value=car.brand;$('#newCarModel').value=car.model;
  $('#newCarYear').value=car.year||'';$('#newCarBody').value=car.body||'';
  $('#newCarColor').value=car.color||'';$('#newCarSeries').value=car.series||'';
  $('#saveCar').textContent='Änderungen speichern';
  $('#carModal h2').textContent='FAHRZEUG BEARBEITEN';
  refreshVehicleForm();
  $('#newCarSeries').value=car.series||'';
  if([...$('#newCarGeneration').options].some(option=>option.value===car.series))$('#newCarGeneration').value=car.series;
  $('#newCarPhotoPreview').innerHTML=carPhotoMarkup(car);
}

function askDeleteVehicle(id) {
  const car=localGarage.find(item=>item.id===id);if(!car)return;
  let dialog=$('#deleteVehicleDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='deleteVehicleDialog';dialog.className='productDialog';
    dialog.setAttribute('aria-labelledby','deleteVehicleTitle');
    dialog.innerHTML='<h2 id="deleteVehicleTitle">Fahrzeug löschen?</h2><p data-delete-description></p><p data-delete-error role="alert"></p><div class="dialogActions"><button type="button" data-delete-cancel>Abbrechen</button><button type="button" class="danger" data-delete-confirm>Fahrzeug löschen</button></div>';
    document.body.append(dialog);
    dialog.querySelector('[data-delete-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-delete-confirm]').onclick=()=>deleteVehicle(dialog.dataset.vehicleId,dialog);
    dialog.addEventListener('cancel',event=>{if(dialog.dataset.busy==='true')event.preventDefault();});
  }
  dialog.dataset.vehicleId=id;
  dialog.querySelector('[data-delete-description]').textContent=car.brand+' '+car.model+' wird aus deinem Konto entfernt. Ein vorhandenes Fahrzeugfoto wird ebenfalls gelöscht.';
  dialog.querySelector('[data-delete-error]').textContent='';
  dialog.showModal();
}

async function deleteVehicle(id,dialog) {
  if(garageSyncBusy)return;
  const car=localGarage.find(item=>item.id===id),userId=authSession?.user?.id;
  if(!car||!userId)return;
  if(gameSession){dialog.querySelector('[data-delete-error]').textContent='Verlasse zuerst die Lobby, bevor du ein Fahrzeug löschst.';return;}
  garageSyncBusy=true;dialog.dataset.busy='true';
  dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
  try {
    const {data,error}=await supabaseClient.from('vehicles').delete().eq('id',id).eq('user_id',userId).select('id');
    if(error)throw error;
    if(!data?.some(row=>row.id===id))throw new Error('Löschen wurde nicht bestätigt. Bitte Garage neu laden und erneut versuchen.');
    const wasActive=car.active || dbProfile?.active_vehicle_id===id;
    localGarage=localGarage.filter(item=>item.id!==id);
    if(dbProfile?.active_vehicle_id===id)dbProfile.active_vehicle_id=null;
    saveGarage();syncVehicleUI();
    let photoWarning=false;
    if(car.photoPath){
      try{const result=await supabaseClient.storage.from('vehicle-images').remove([car.photoPath]);photoWarning=!!result.error;}
      catch{photoWarning=true;}
    }
    garageSyncBusy=false;
    if(wasActive && localGarage.length)await activateCloudVehicle(localGarage[0].id);
    await loadCloudGarage({migrateLocal:false});
    dialog.close();
    toast(photoWarning?'Fahrzeug gelöscht. Das alte Foto konnte noch nicht aus dem Speicher entfernt werden.':'Fahrzeug gelöscht.');
  }catch(error){dialog.querySelector('[data-delete-error]').textContent=error.message||'Fahrzeug konnte nicht gelöscht werden.';}
  finally{garageSyncBusy=false;dialog.dataset.busy='false';dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}
}

$('#garageCars').addEventListener('click',event=>{
  const remove=event.target.closest('[data-delete-car]'),edit=event.target.closest('[data-edit-car]');
  if(remove)askDeleteVehicle(remove.dataset.deleteCar);
  if(edit)editVehicle(edit.dataset.editCar);
});
$('#newCarBody').addEventListener('input',refreshVehicleForm);
$('#newCarGeneration').addEventListener('change',()=>{
  $('#newCarSeries').value=$('#newCarGeneration').value;
});
