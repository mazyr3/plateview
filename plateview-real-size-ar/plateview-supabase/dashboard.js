
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let restaurants=[], currentRestaurant=null, items=[], editingId=null, editLang='en', pendingModel=null, pendingPhoto=null;

function msg(text){$('#authMessage').textContent=text||''}
function stat(label,value){return `<article class="stat"><small>${label}</small><strong>${value}</strong></article>`}
function tItem(i,l='en'){return i.translations?.[l]||i.translations?.en||{name:'Unnamed dish',description:''}}
function liveUrl(table){return `index.html?r=${encodeURIComponent(currentRestaurant.slug)}${table?`&table=${table}`:''}`}
function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const title=name[0].toUpperCase()+name.slice(1); $('#pageTitle').textContent=title;$('#crumb').textContent=`Dashboard / ${title}`;
  if(name==='qr')renderQR(); if(name==='analytics')renderAnalytics();
}
$$('.nav').forEach(n=>n.onclick=()=>setView(n.dataset.view));$$('[data-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.jump));

async function ensureAuth(){
  if(!ARAPP.configured){$('#setupScreen').classList.remove('hidden');return;}
  const s=await ARAPP.session();
  if(!s){$('#loginScreen').classList.remove('hidden');return;}
  $('#app').classList.remove('hidden');
  await loadRestaurants();
}
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();msg('Signing in…');
  try{await ARAPP.signIn($('#loginEmail').value,$('#loginPassword').value);location.reload()}
  catch(err){msg(err.message)}
};
$('#signupBtn').onclick=async()=>{
  msg('Creating account…');
  try{
    const d=await ARAPP.signUp($('#loginEmail').value,$('#loginPassword').value);
    msg(d.session?'Account created. Signing you in…':'Account created. Check your email to confirm, then sign in.');
    if(d.session) location.reload();
  }catch(err){msg(err.message)}
};
$('#logoutBtn').onclick=async()=>{await ARAPP.signOut();location.reload()};

async function loadRestaurants(preferredId=null){
  restaurants=await ARAPP.restaurantsForOwner();
  if(!restaurants.length){
    $('#restaurantModal').showModal();
    $('#restaurantSelect').innerHTML='<option>No restaurants yet</option>';
    currentRestaurant=null; items=[]; renderAll(); return;
  }
  const id=preferredId || $('#restaurantSelect').value || restaurants[0].id;
  const result=await ARAPP.getOwnerRestaurant(restaurants.some(r=>r.id===id)?id:restaurants[0].id);
  currentRestaurant=result.restaurant; items=result.items;
  renderAll();
}
function renderRestaurantSelect(){
  $('#restaurantSelect').innerHTML=restaurants.map(r=>`<option value="${r.id}" ${r.id===currentRestaurant?.id?'selected':''}>${r.name}</option>`).join('');
}
$('#restaurantSelect').onchange=()=>loadRestaurants($('#restaurantSelect').value);
$('#newRestaurantBtn').onclick=()=>{$('#newRestaurantName').value='';$('#newRestaurantSlug').value='';$('#restaurantModal').showModal()};
$('#createRestaurantBtn').onclick=async()=>{
  const name=$('#newRestaurantName').value.trim(); if(!name)return;
  try{
    const r=await ARAPP.createRestaurant({name,slug:$('#newRestaurantSlug').value});
    $('#restaurantModal').close(); await loadRestaurants(r.id);
  }catch(e){alert(e.message)}
};

function renderAll(){
  renderRestaurantSelect();
  if(!currentRestaurant){
    $('#welcomeName').textContent='Create your first restaurant';
    $('#overviewStats').innerHTML=stat('Restaurants',0);
    $('#menuList').innerHTML='<div class="empty">Create a restaurant to start building its menu.</div>';
    return;
  }
  $('#welcomeName').textContent=currentRestaurant.name;
  $('#liveState').textContent=currentRestaurant.published?'Live':'Draft';
  $('#publishBtn').textContent=currentRestaurant.published?'Unpublish':'Publish';
  $('#viewLive').href=liveUrl();
  renderOverview();renderMenu();renderSettings();
}
function renderOverview(){
  const available=items.filter(i=>i.available).length, models=items.filter(i=>i.model_url).length;
  $('#overviewStats').innerHTML=stat('Menu items',items.length)+stat('Available',available)+stat('3D ready',models);
  $('#menuHealth').innerHTML=`<div class="health-line"><span>3D coverage</span><b>${items.length?Math.round(models/items.length*100):0}%</b></div><div class="health-line"><span>Available dishes</span><b>${available}/${items.length}</b></div>`;
}
$('#publishBtn').onclick=async()=>{
  if(!currentRestaurant)return;
  try{
    currentRestaurant=await ARAPP.updateRestaurant(currentRestaurant.id,{published:!currentRestaurant.published});
    restaurants=restaurants.map(r=>r.id===currentRestaurant.id?currentRestaurant:r);renderAll();
  }catch(e){alert(e.message)}
};

function renderMenu(){
  if(!currentRestaurant)return;
  const q=($('#menuSearch')?.value||'').toLowerCase(),cat=$('#categoryFilter')?.value||'All categories';
  const cats=[...new Set(items.map(i=>i.category).filter(Boolean))];
  $('#categoryFilter').innerHTML='<option>All categories</option>'+cats.map(c=>`<option>${c}</option>`).join('');
  const list=items.filter(i=>{const t=tItem(i);return (!q||t.name.toLowerCase().includes(q)||i.category.toLowerCase().includes(q))&&(cat==='All categories'||i.category===cat)});
  $('#menuList').innerHTML=list.map(i=>{
    const t=tItem(i);
    const allergenText=(i.allergens||[]).slice(0,3).join(' · ');
    const visual=i.model_url
      ? `<model-viewer src="${i.model_url}" auto-rotate interaction-prompt="none" camera-controls shadow-intensity="1" environment-image="neutral"></model-viewer>`
      : (i.photo_url ? `<img src="${i.photo_url}" alt="${t.name}">` : `<span class="thumb-empty">No preview</span>`);
    return `<article class="menu-row" data-edit="${i.id}">
      <div class="dish-thumb">${visual}</div>
      <div class="menu-info">
        <div class="menu-title-line">
          <h3>${t.name}</h3>
          <strong class="menu-price">${ARAPP.money(i.price,currentRestaurant.currency)}</strong>
        </div>
        <p class="menu-category">${i.category||'Uncategorised'}</p>
        ${allergenText?`<p class="menu-allergens">${allergenText}${(i.allergens||[]).length>3?' · …':''}</p>`:''}
      </div>
      <div class="menu-badges">
        <span class="badge status ${i.available?'available':'off'}"><span class="status-dot"></span>${i.available?'Available':'Unavailable'}</span>
        ${i.model_url?'<span class="badge model-ready">3D ready</span>':'<span class="badge model-missing">No 3D</span>'}
      </div>
      <button class="edit-dish-btn" type="button">Edit <span>→</span></button>
    </article>`;
  }).join('')||'<div class="empty">No dishes yet. Click “Add dish” to create your first menu item.</div>';
  $$('[data-edit]').forEach(x=>x.onclick=()=>openEditor(x.dataset.edit));
}
$('#menuSearch').oninput=renderMenu;$('#categoryFilter').onchange=renderMenu;$('#addDishBtn').onclick=()=>openEditor();

function translationMarkup(){
  const item=editingId?items.find(i=>i.id===editingId):null;
  const t=item?.translations?.[editLang]||{};
  return `<label>Dish name (${editLang.toUpperCase()})<input id="trName" value="${(t.name||'').replaceAll('"','&quot;')}" placeholder="Dish name"></label><label style="margin-top:12px">Description (${editLang.toUpperCase()})<textarea id="trDescription" rows="5" placeholder="Describe the dish">${t.description||''}</textarea></label>`;
}
function persistTranslationDraft(){
  const item=editingId?items.find(i=>i.id===editingId):window.__newDraft;
  if(!item||!$('#trName'))return;
  item.translations=item.translations||{};
  item.translations[editLang]={name:$('#trName').value.trim(),description:$('#trDescription').value.trim()};
}
function renderTranslation(){ $('#translationFields').innerHTML=translationMarkup(); $$('.lang-tab').forEach(b=>b.classList.toggle('active',b.dataset.lang===editLang)); }
$$('.lang-tab').forEach(b=>b.onclick=()=>{persistTranslationDraft();editLang=b.dataset.lang;renderTranslation()});

function openEditor(id=null){
  editingId=id;editLang='en';pendingModel=null;pendingPhoto=null;
  let item=id?items.find(i=>i.id===id):null;
  if(!item){
    item={restaurant_id:currentRestaurant.id,category:'Mains',price:0,available:true,published:true,model_url:'',photo_url:'',allergens:[],tags:[],translations:{en:{name:'',description:''},nl:{name:'',description:''},fr:{name:'',description:''}},sort_order:items.length};
    window.__newDraft=item;
  } else window.__newDraft=null;
  $('#editorTitle').textContent=id?'Edit dish':'Add dish';
  $('#dishAvailable').checked=item.available!==false;$('#dishCategory').value=item.category||'';$('#dishPrice').value=item.price||0;$('#dishWidthCm').value=item.translations?._meta?.width_cm||'';$('#dishTags').value=(item.tags||[]).join(', ');
  $('#allergenGrid').innerHTML=ARAPP.allergens.map(a=>`<label><input type="checkbox" value="${a}" ${(item.allergens||[]).includes(a)?'checked':''}> ${a}</label>`).join('');
  $('#deleteDish').classList.toggle('hidden',!id);
  $('#editorModel').src=item.model_url||'';$('#modelEmpty').classList.toggle('hidden',!!item.model_url);
  $('#assetState').textContent=item.model_url?'3D model stored in cloud.':'No 3D model uploaded yet.';
  renderTranslation();$('#dishModal').showModal();
}
$('#modelUpload').onchange=e=>{pendingModel=e.target.files[0]||null;if(pendingModel){const u=URL.createObjectURL(pendingModel);$('#editorModel').src=u;$('#modelEmpty').classList.add('hidden');$('#assetState').textContent=`Ready to upload: ${pendingModel.name}`}};
$('#photoUpload').onchange=e=>{pendingPhoto=e.target.files[0]||null};

async function updateCalibrationPreview(){
  const viewer=$('#editorModel');
  if(!viewer?.src)return;
  try{
    const d=viewer.getDimensions();
    const nativeCm=d.x*100;
    const target=Number($('#dishWidthCm').value);
    if(target>0 && nativeCm>0){
      const factor=target/nativeCm;
      $('#assetState').textContent=`Model width: ${nativeCm.toFixed(1)} cm · AR target: ${target.toFixed(1)} cm · scale ×${factor.toFixed(3)}`;
    }else if(nativeCm>0){
      $('#assetState').textContent=`Detected model width: ${nativeCm.toFixed(1)} cm. Enter the real dish width for accurate AR sizing.`;
    }
  }catch(e){}
}
$('#editorModel').addEventListener('load',updateCalibrationPreview);
$('#dishWidthCm').addEventListener('input',updateCalibrationPreview);

$('#saveDish').onclick=async()=>{
  const button=$('#saveDish');button.disabled=true;button.textContent='Saving…';
  try{
    persistTranslationDraft();
    const item=editingId?{...items.find(i=>i.id===editingId)}:{...window.__newDraft};
    item.restaurant_id=currentRestaurant.id;item.available=$('#dishAvailable').checked;item.published=true;item.category=$('#dishCategory').value.trim();item.price=Number($('#dishPrice').value)||0;item.tags=$('#dishTags').value.split(',').map(x=>x.trim()).filter(Boolean);item.allergens=$$('#allergenGrid input:checked').map(x=>x.value);item.translations=item.translations||{};item.translations._meta=item.translations._meta||{};const widthCm=Number($('#dishWidthCm').value);if(widthCm>0)item.translations._meta.width_cm=widthCm;else delete item.translations._meta.width_cm;
    if(!item.translations?.en?.name){alert('Please add an English dish name.');return;}
    if(pendingModel)item.model_url=await ARAPP.uploadAsset(pendingModel,currentRestaurant.id,'models');
    if(pendingPhoto)item.photo_url=await ARAPP.uploadAsset(pendingPhoto,currentRestaurant.id,'photos');
    const saved=await ARAPP.saveMenuItem(item);
    if(editingId)items=items.map(x=>x.id===saved.id?saved:x);else items.push(saved);
    $('#dishModal').close();renderAll();
  }catch(e){alert(e.message)}
  finally{button.disabled=false;button.textContent='Save dish'}
};
$('#deleteDish').onclick=async()=>{if(!editingId)return;if(confirm('Delete this dish?')){try{await ARAPP.deleteMenuItem(editingId);items=items.filter(x=>x.id!==editingId);$('#dishModal').close();renderAll()}catch(e){alert(e.message)}}};

function renderQR(){
  if(!currentRestaurant)return;
  const n=Math.max(1,Number(currentRestaurant.tables)||1);
  $('#tableSelect').innerHTML=Array.from({length:n},(_,i)=>`<option value="${i+1}">Table ${i+1}</option>`).join('');
  $('#tableSelect').onchange=drawQR;drawQR();
}
function drawQR(){
  const isLocal=['localhost','127.0.0.1'].includes(location.hostname);$('#localQrWarning').classList.toggle('hidden',!isLocal);
  const t=$('#tableSelect').value||1,absolute=new URL(liveUrl(t),location.href).href;
  $('#qrUrl').value=absolute;$('#qrCode').innerHTML='';
  if(window.QRCode)new QRCode($('#qrCode'),{text:absolute,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});
  $('#phonePreview').src=liveUrl(t);
}
$('#copyQrBtn').onclick=async()=>{await navigator.clipboard.writeText($('#qrUrl').value);$('#copyQrBtn').textContent='Copied';setTimeout(()=>$('#copyQrBtn').textContent='Copy link',1200)};
$('#downloadQrBtn').onclick=()=>{const img=$('#qrCode img')||$('#qrCode canvas');if(!img)return;const a=document.createElement('a');a.download=`${currentRestaurant.slug}-table-${$('#tableSelect').value}-qr.png`;a.href=img.src||img.toDataURL('image/png');a.click()};

async function renderAnalytics(){
  if(!currentRestaurant)return;
  try{
    const a=await ARAPP.analytics(currentRestaurant.id),vals=[['Menu views',a.menu_view],['Dish opens',a.dish_view],['AR launches',a.ar_launch]];
    $('#analyticsStats').innerHTML=vals.map(([l,v])=>stat(l,v)).join('');
    const max=Math.max(1,...vals.map(v=>v[1]));
    $('#funnel').innerHTML=vals.map(([l,v])=>`<div class="funnel-row"><span>${l}</span><div class="bar"><span style="width:${Math.max(3,v/max*100)}%"></span></div><b>${v}</b></div>`).join('');
  }catch(e){$('#analyticsStats').innerHTML=`<div class="empty">${e.message}</div>`}
}
function renderSettings(){
  if(!currentRestaurant)return;
  $('#setName').value=currentRestaurant.name;$('#setSlug').value=currentRestaurant.slug;$('#setTagline').value=currentRestaurant.tagline||'';$('#setAccent').value=currentRestaurant.accent||'#b7482d';$('#setTables').value=currentRestaurant.tables||1;$('#setDefaultLang').value=currentRestaurant.default_language||'en';
}
$('#saveSettings').onclick=async()=>{
  if(!currentRestaurant)return;
  try{
    const patch={name:$('#setName').value.trim()||'Restaurant',slug:ARAPP.slugify($('#setSlug').value||$('#setName').value),tagline:$('#setTagline').value.trim(),accent:$('#setAccent').value,tables:Math.max(1,Number($('#setTables').value)||1),default_language:$('#setDefaultLang').value};
    currentRestaurant=await ARAPP.updateRestaurant(currentRestaurant.id,patch);restaurants=restaurants.map(r=>r.id===currentRestaurant.id?currentRestaurant:r);renderAll();
  }catch(e){alert(e.message)}
};
$('#refreshData').onclick=()=>loadRestaurants(currentRestaurant?.id);

ensureAuth().catch(e=>{console.error(e);alert(e.message)});
