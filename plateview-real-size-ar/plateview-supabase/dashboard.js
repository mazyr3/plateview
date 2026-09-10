
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let restaurants=[], currentRestaurant=null, items=[], editingId=null, editLang='en', pendingModel=null, pendingPhoto=null, pendingLogo=null, pendingHeroImage=null, pendingHeroVideo=null, removeLogoRequested=false, removeHeroRequested=false, removeHeroVideoRequested=false, accountAccess=null;

const MENU_TEMPLATE_DEFAULTS={
  editorial:{template:'editorial',background:'#f7f4ed',surface:'#fffdf8',text:'#171713',muted:'#746f65',category_background:'#f7f4ed',category_text:'#171713',card_radius:24,density:'comfortable',show_hero:true,sticky_categories:true,show_feature_strip:true},
  compact:{template:'compact',background:'#f3f3f3',surface:'#ffffff',text:'#171717',muted:'#6f6f6f',category_background:'#111111',category_text:'#ffffff',card_radius:14,density:'compact',show_hero:true,sticky_categories:true,show_feature_strip:false},
  gallery:{template:'gallery',background:'#f6f1e8',surface:'#fffdf8',text:'#1b1916',muted:'#766f65',category_background:'#fffdf8',category_text:'#1b1916',card_radius:30,density:'comfortable',show_hero:true,sticky_categories:true,show_feature_strip:false}
};
function normalizedTheme(source=currentRestaurant?.menu_theme||{}){const template=MENU_TEMPLATE_DEFAULTS[source?.template]?source.template:'editorial';return {...MENU_TEMPLATE_DEFAULTS[template],...(source||{}),template}}
function heroCopyFromControls(){return {eyebrow:$('#setHeroEyebrow')?.value.trim()||'',title:$('#setHeroTitle')?.value.trim()||'',accent:$('#setHeroAccentText')?.value.trim()||'',subtitle:$('#setHeroSubtitle')?.value.trim()||''}}
function themeControlsTheme(overrides={}){const template=$('.template-card.active')?.dataset.template||'editorial',defaults=MENU_TEMPLATE_DEFAULTS[template]||MENU_TEMPLATE_DEFAULTS.editorial,current=normalizedTheme(currentRestaurant?.menu_theme||{});return {...current,template,background:$('#setMenuBg').value,surface:$('#setMenuSurface').value,text:$('#setMenuText').value,muted:defaults.muted,category_background:$('#setCategoryBg').value,category_text:$('#setCategoryText').value,card_radius:Number($('#setCardRadius').value)||0,density:$('#setMenuDensity').value,show_hero:$('#setShowHero').checked,sticky_categories:$('#setStickyCategories').checked,show_feature_strip:$('#setShowFeatureStrip').checked,hero_item_id:$('#setHeroDish')?.value||'',hero_copy:heroCopyFromControls(),...overrides}}
function paintThemePreview(theme=themeControlsTheme()){const preview=$('#themePreview');if(!preview)return;preview.dataset.previewTemplate=theme.template;preview.style.setProperty('--p-bg',theme.background);preview.style.setProperty('--p-surface',theme.surface);preview.style.setProperty('--p-text',theme.text);preview.style.setProperty('--p-cat',theme.category_background);[['menuBgValue',theme.background],['menuSurfaceValue',theme.surface],['menuTextValue',theme.text],['categoryBgValue',theme.category_background],['categoryTextValue',theme.category_text]].forEach(([id,val])=>{const el=$('#'+id);if(el)el.textContent=val})}
function setThemeControls(theme){theme=normalizedTheme(theme);$$('.template-card').forEach(b=>b.classList.toggle('active',b.dataset.template===theme.template));$('#setMenuBg').value=theme.background;$('#setMenuSurface').value=theme.surface;$('#setMenuText').value=theme.text;$('#setCategoryBg').value=theme.category_background;$('#setCategoryText').value=theme.category_text;$('#setCardRadius').value=String(theme.card_radius);$('#setMenuDensity').value=theme.density;$('#setShowHero').checked=theme.show_hero!==false;$('#setStickyCategories').checked=theme.sticky_categories!==false;$('#setShowFeatureStrip').checked=theme.show_feature_strip!==false;paintThemePreview(theme)}

function msg(text){$('#authMessage').textContent=text||''}
function stat(label,value){return `<article class="stat"><small>${label}</small><strong>${value}</strong></article>`}
function tItem(i,l='en'){return i.translations?.[l]||i.translations?.en||{name:'Unnamed dish',description:''}}
function dishDisplayMode(item,place='card'){
  const meta=item?.translations?._meta||{};
  const pref=place==='detail'?(meta.detail_visual||'auto'):(meta.card_visual||'auto');
  if(pref==='photo'&&item?.photo_url)return 'photo';
  if(pref==='3d'&&item?.model_url)return '3d';
  if(item?.model_url)return '3d';
  if(item?.photo_url)return 'photo';
  return 'none';
}
function liveUrl(table){return `menu.html?r=${encodeURIComponent(currentRestaurant.slug)}${table?`&table=${table}`:''}`}
function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const title=name[0].toUpperCase()+name.slice(1); $('#pageTitle').textContent=title;$('#crumb').textContent=`Dashboard / ${title}`;
  if(name==='qr')renderQR(); if(name==='analytics')renderAnalytics(); if(name==='billing')renderBilling();
}
$$('.nav').forEach(n=>n.onclick=()=>setView(n.dataset.view));$$('[data-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.jump));

async function ensureAuth(){
  if(!ARAPP.configured){$('#setupScreen').classList.remove('hidden');return;}
  const s=await ARAPP.session();
  if(!s){$('#loginScreen').classList.remove('hidden');return;}
  accountAccess=await ARAPP.accountAccess();
  if(!accountAccess.allowed){
    $('#subscriptionScreen').classList.remove('hidden');
    if(accountAccess.reason==='suspended'){
      $('#lockTitle').textContent='Account suspended';
      $('#lockCopy').textContent='This PlateCrop account has been suspended. Contact PlateCrop support if you believe this is a mistake.';
      $('#lockBillingBtn').classList.add('hidden');
    }
    return;
  }
  $('#app').classList.remove('hidden');
  if(accountAccess.profile?.role==='admin') $('#adminLink').classList.remove('hidden');
  const plan=(accountAccess.subscription?.plan||'active').toUpperCase();
  $('#accountPlanBadge').textContent=plan==='LEGACY'?'LEGACY ACCESS':plan;
  await loadRestaurants();
}
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();msg('Signing in…');
  try{await ARAPP.signIn($('#loginEmail').value,$('#loginPassword').value);location.reload()}
  catch(err){msg(err.message)}
};
$('#logoutBtn').onclick=async()=>{await ARAPP.signOut();location.reload()};
$('#lockLogoutBtn').onclick=async()=>{await ARAPP.signOut();location.href='index.html'};
$('#lockBillingBtn').onclick=async()=>{const b=$('#lockBillingBtn');b.disabled=true;b.textContent='Opening…';try{const d=await ARAPP.apiWithAuth('/api/create-portal-session',{method:'POST'});location.href=d.url}catch(e){$('#lockMessage').textContent=e.message;b.disabled=false;b.textContent='Manage billing'}};

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
  const plan=(accountAccess?.subscription?.plan||'legacy').toLowerCase();
  const limit=accountAccess?.profile?.role==='admin'||plan==='legacy'?1000:(plan==='pro'?5:1);
  $('#newRestaurantBtn').disabled=restaurants.length>=limit;
  $('#newRestaurantBtn').title=restaurants.length>=limit?`Your ${plan} plan allows ${limit===1?'1 restaurant':limit+' restaurants'}. Manage billing to change plan.`:'Create another restaurant';
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

function categoryKey(item){return (item.category||'Uncategorised').trim()||'Uncategorised'}
function orderedCategories(source=items){
  const first=new Map();
  source.forEach((item,idx)=>{const c=categoryKey(item);const n=Number.isFinite(Number(item.sort_order))?Number(item.sort_order):idx;if(!first.has(c)||n<first.get(c))first.set(c,n)});
  return [...first.keys()].sort((a,b)=>(first.get(a)-first.get(b))||a.localeCompare(b));
}
function sortedItemsInCategory(category,source=items){
  return source.filter(i=>categoryKey(i)===category).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
}
async function persistGroupedOrder(){
  // `items` is already in the exact order chosen by the owner.
  // Do not sort it again here, otherwise the old sort_order values undo the move.
  const changed=[];
  items.forEach((item,index)=>{
    if(Number(item.sort_order)!==index){
      item.sort_order=index;
      changed.push(item);
    }
  });
  if(changed.length) await Promise.all(changed.map(item=>ARAPP.saveMenuItem(item)));
}
async function moveDish(id,direction){
  const item=items.find(i=>i.id===id);if(!item)return;
  const cat=categoryKey(item), group=sortedItemsInCategory(cat);
  const from=group.findIndex(i=>i.id===id),to=from+direction;
  if(from<0||to<0||to>=group.length)return;
  [group[from],group[to]]=[group[to],group[from]];
  const categories=orderedCategories(items);
  items=categories.flatMap(c=>c===cat?group:sortedItemsInCategory(c));
  renderMenu();
  try{await persistGroupedOrder();renderMenu()}catch(e){alert('Could not save the new order: '+e.message);await loadRestaurants(currentRestaurant.id)}
}
async function dropDish(draggedId,targetId){
  const dragged=items.find(i=>i.id===draggedId),target=items.find(i=>i.id===targetId);if(!dragged||!target)return;
  const cat=categoryKey(dragged);if(categoryKey(target)!==cat)return;
  const group=sortedItemsInCategory(cat),from=group.findIndex(i=>i.id===draggedId),to=group.findIndex(i=>i.id===targetId);
  if(from<0||to<0||from===to)return;
  const [moved]=group.splice(from,1);group.splice(to,0,moved);
  const categories=orderedCategories(items);
  items=categories.flatMap(c=>c===cat?group:sortedItemsInCategory(c));
  renderMenu();
  try{await persistGroupedOrder();renderMenu()}catch(e){alert('Could not save the new order: '+e.message);await loadRestaurants(currentRestaurant.id)}
}
function renderMenu(){
  if(!currentRestaurant)return;
  const q=($('#menuSearch')?.value||'').toLowerCase(),cat=$('#categoryFilter')?.value||'All categories';
  const cats=orderedCategories(items);
  const previous=cat;
  $('#categoryFilter').innerHTML='<option>All categories</option>'+cats.map(c=>`<option>${c}</option>`).join('');
  $('#categoryFilter').value=cats.includes(previous)?previous:'All categories';
  const activeCat=$('#categoryFilter').value;
  const filtered=items.filter(i=>{const t=tItem(i),c=categoryKey(i);return (!q||t.name.toLowerCase().includes(q)||c.toLowerCase().includes(q))&&(activeCat==='All categories'||c===activeCat)});
  const visibleCats=orderedCategories(filtered);
  $('#menuList').innerHTML=visibleCats.map(category=>{
    const group=sortedItemsInCategory(category,filtered);
    return `<section class="menu-category-group" data-category="${category.replaceAll('"','&quot;')}">
      <div class="category-heading"><div><span class="category-kicker">CATEGORY</span><h2>${category}</h2></div><span class="category-count">${group.length} ${group.length===1?'dish':'dishes'}</span></div>
      <div class="category-dishes">${group.map((i,index)=>{
        const t=tItem(i);
        const allergenText=(i.allergens||[]).slice(0,3).join(' · ');
        const dashboardVisual=dishDisplayMode(i,'card');
        const visual=dashboardVisual==='3d'
          ? `<model-viewer src="${i.model_url}" auto-rotate interaction-prompt="none" camera-controls shadow-intensity="1" environment-image="neutral"></model-viewer>`
          : (dashboardVisual==='photo' ? `<img src="${i.photo_url}" alt="${t.name}">` : `<span class="thumb-empty">No preview</span>`);
        return `<article class="menu-row" data-edit="${i.id}" data-order-id="${i.id}">
          <div class="reorder-controls" aria-label="Reorder ${t.name}">
            <button class="drag-handle" type="button" draggable="true" data-drag-id="${i.id}" title="Drag to reorder" aria-label="Drag ${t.name} to reorder">⋮⋮</button>
            <div class="order-arrows">
              <button type="button" class="order-btn move-up" data-move-id="${i.id}" ${index===0?'disabled':''} aria-label="Move ${t.name} up">↑</button>
              <button type="button" class="order-btn move-down" data-move-id="${i.id}" ${index===group.length-1?'disabled':''} aria-label="Move ${t.name} down">↓</button>
            </div>
          </div>
          <div class="dish-thumb">${visual}</div>
          <div class="menu-info">
            <div class="menu-title-line"><h3>${t.name}</h3><strong class="menu-price">${ARAPP.money(i.price,currentRestaurant.currency)}</strong></div>
            ${allergenText?`<p class="menu-allergens">${allergenText}${(i.allergens||[]).length>3?' · …':''}</p>`:''}
          </div>
          <div class="menu-badges">
            <button type="button" class="badge status quick-availability ${i.available?'available':'off'}" data-availability-id="${i.id}" title="Click to change availability"><span class="status-dot"></span>${i.available?'Available':'Unavailable'}</button>
            ${i.model_url?'<span class="badge model-ready">3D ready</span>':'<span class="badge model-missing">No 3D</span>'}
          </div>
          <button class="edit-dish-btn" type="button">Edit <span>→</span></button>
        </article>`;
      }).join('')}</div>
    </section>`;
  }).join('')||'<div class="empty">No dishes found. Click “Add dish” to create your first menu item.</div>';

  $$('[data-edit]').forEach(row=>row.addEventListener('click',e=>{if(e.target.closest('.reorder-controls')||e.target.closest('.quick-availability'))return;openEditor(row.dataset.edit)}));
  $$('.move-up').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();moveDish(b.dataset.moveId,-1)}));
  $$('.move-down').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();moveDish(b.dataset.moveId,1)}));
  $$('.quick-availability').forEach(b=>b.addEventListener('click',async e=>{e.stopPropagation();const item=items.find(i=>i.id===b.dataset.availabilityId);if(!item)return;b.disabled=true;try{const saved=await ARAPP.saveMenuItem({...item,available:!item.available});items=items.map(i=>i.id===saved.id?saved:i);renderMenu();renderOverview()}catch(err){alert('Could not update availability: '+err.message);b.disabled=false}}));
  $$('.drag-handle').forEach(handle=>{
    handle.addEventListener('click',e=>e.stopPropagation());
    handle.addEventListener('dragstart',e=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',handle.dataset.dragId);handle.closest('.menu-row')?.classList.add('dragging')});
    handle.addEventListener('dragend',()=>{$$('.menu-row').forEach(r=>r.classList.remove('dragging','drag-over'))});
  });
  $$('.menu-row').forEach(row=>{
    row.addEventListener('dragover',e=>{const draggedId=e.dataTransfer.types.includes('text/plain');if(!draggedId)return;e.preventDefault();row.classList.add('drag-over')});
    row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
    row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');dropDish(id,row.dataset.orderId)});
  });
}
$('#menuSearch').oninput=renderMenu;$('#categoryFilter').onchange=renderMenu;$('#addDishBtn').onclick=()=>openEditor();

function renderCategoryManager(){
  const cats=orderedCategories(items);
  $('#categoryManagerList').innerHTML=cats.length?cats.map((cat,index)=>{
    const count=items.filter(i=>categoryKey(i)===cat).length;
    return `<div class="category-manager-row" data-category-name="${cat.replaceAll('"','&quot;')}">
      <div class="category-order-buttons"><button type="button" class="order-btn category-up" ${index===0?'disabled':''} aria-label="Move ${cat} up">↑</button><button type="button" class="order-btn category-down" ${index===cats.length-1?'disabled':''} aria-label="Move ${cat} down">↓</button></div>
      <div class="category-manager-main"><input class="category-rename-input" value="${cat.replaceAll('"','&quot;')}" aria-label="Category name"><small>${count} ${count===1?'dish':'dishes'}</small></div>
      <button type="button" class="btn tiny secondary rename-category-btn">Rename</button>
    </div>`;
  }).join(''):'<div class="empty compact-empty">Add a dish to create your first category.</div>';
  $$('.category-up',$('#categoryManagerList')).forEach(b=>b.onclick=()=>moveCategory(b.closest('.category-manager-row').dataset.categoryName,-1));
  $$('.category-down',$('#categoryManagerList')).forEach(b=>b.onclick=()=>moveCategory(b.closest('.category-manager-row').dataset.categoryName,1));
  $$('.rename-category-btn',$('#categoryManagerList')).forEach(b=>b.onclick=()=>renameCategory(b.closest('.category-manager-row')));
}
async function moveCategory(category,direction){
  const cats=orderedCategories(items),from=cats.indexOf(category),to=from+direction;if(from<0||to<0||to>=cats.length)return;
  [cats[from],cats[to]]=[cats[to],cats[from]];
  items=cats.flatMap(c=>sortedItemsInCategory(c));renderCategoryManager();renderMenu();
  try{await persistGroupedOrder();renderCategoryManager();renderMenu()}catch(e){alert('Could not save category order: '+e.message);await loadRestaurants(currentRestaurant.id)}
}
async function renameCategory(row){
  const oldName=row.dataset.categoryName,newName=row.querySelector('.category-rename-input').value.trim();
  if(!newName||newName===oldName)return;
  if(orderedCategories(items).some(c=>c.toLowerCase()===newName.toLowerCase()&&c!==oldName)){alert('That category already exists.');return;}
  const affected=items.filter(i=>categoryKey(i)===oldName);if(!affected.length)return;
  const btn=row.querySelector('.rename-category-btn');btn.disabled=true;btn.textContent='Saving…';
  try{const saved=await Promise.all(affected.map(i=>ARAPP.saveMenuItem({...i,category:newName})));const map=new Map(saved.map(i=>[i.id,i]));items=items.map(i=>map.get(i.id)||i);renderCategoryManager();renderMenu();}
  catch(e){alert('Could not rename category: '+e.message);btn.disabled=false;btn.textContent='Rename'}
}
$('#manageCategoriesBtn').onclick=()=>{renderCategoryManager();$('#categoryModal').showModal()};

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
function renderTranslation(){
  $('#translationFields').innerHTML=translationMarkup();
  const item=editingId?items.find(i=>i.id===editingId):window.__newDraft;
  $$('.lang-tab').forEach(b=>{const tr=item?.translations?.[b.dataset.lang]||{};b.classList.toggle('active',b.dataset.lang===editLang);b.classList.toggle('complete',!!tr.name?.trim())});
  $('#copyEnglishBtn').classList.toggle('hidden',editLang==='en');
}
$$('.lang-tab').forEach(b=>b.onclick=()=>{persistTranslationDraft();editLang=b.dataset.lang;renderTranslation()});
$('#copyEnglishBtn').onclick=()=>{
  persistTranslationDraft();const item=editingId?items.find(i=>i.id===editingId):window.__newDraft;if(!item)return;
  const en=item.translations?.en||{};item.translations=item.translations||{};item.translations[editLang]={name:en.name||'',description:en.description||''};renderTranslation();
};
function updateAllergenCount(){const n=$$('#allergenGrid input:checked').length;$('#allergenCount').textContent=`${n} selected`;}
$('#clearAllergensBtn').onclick=()=>{$$('#allergenGrid input').forEach(x=>x.checked=false);updateAllergenCount()};

function openEditor(id=null){
  editingId=id;editLang='en';pendingModel=null;pendingPhoto=null;
  let item=id?items.find(i=>i.id===id):null;
  if(!item){
    item={restaurant_id:currentRestaurant.id,category:'Mains',price:0,available:true,published:true,model_url:'',photo_url:'',allergens:[],tags:[],translations:{en:{name:'',description:''},nl:{name:'',description:''},fr:{name:'',description:''}},sort_order:items.length};
    window.__newDraft=item;
  } else window.__newDraft=null;
  $('#editorTitle').textContent=id?'Edit dish':'Add dish';
  $('#dishAvailable').checked=item.available!==false;$('#dishCategory').value=item.category||'';$('#dishPrice').value=item.price||0;$('#dishWidthCm').value=item.translations?._meta?.width_cm||'';$('#dishTags').value=(item.tags||[]).join(', ');
  $('#dishCardVisual').value=item.translations?._meta?.card_visual||'auto';
  $('#dishDetailVisual').value=item.translations?._meta?.detail_visual||'auto';
  $('#allergenGrid').innerHTML=ARAPP.allergens.map(a=>`<label><input type="checkbox" value="${a}" ${(item.allergens||[]).includes(a)?'checked':''}> ${a}</label>`).join('');
  $$('#allergenGrid input').forEach(x=>x.addEventListener('change',updateAllergenCount));updateAllergenCount();
  $('#deleteDish').classList.toggle('hidden',!id);$('#duplicateDish').classList.toggle('hidden',!id);
  $('#editorModel').src=item.model_url||'';$('#modelEmpty').classList.toggle('hidden',!!item.model_url);
  $('#photoPreview').innerHTML=item.photo_url?`<img src="${item.photo_url}" alt="Dish photo preview">`:'<span>No photo</span>';
  $('#assetState').textContent=item.model_url?'3D model stored in cloud.':'No 3D model uploaded yet.';
  renderTranslation();$('#dishModal').showModal();
}
$('#modelUpload').onchange=e=>{pendingModel=e.target.files[0]||null;if(pendingModel){const u=URL.createObjectURL(pendingModel);$('#editorModel').src=u;$('#modelEmpty').classList.add('hidden');$('#assetState').textContent=`Ready to upload: ${pendingModel.name}`}};
$('#photoUpload').onchange=e=>{pendingPhoto=e.target.files[0]||null;if(pendingPhoto){const u=URL.createObjectURL(pendingPhoto);$('#photoPreview').innerHTML=`<img src="${u}" alt="Dish photo preview">`;}};

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
    item.translations._meta.card_visual=$('#dishCardVisual').value||'auto';
    item.translations._meta.detail_visual=$('#dishDetailVisual').value||'auto';
    if(!item.translations?.en?.name){alert('Please add an English dish name.');return;}
    if(pendingModel)item.model_url=await ARAPP.uploadAsset(pendingModel,currentRestaurant.id,'models');
    if(pendingPhoto)item.photo_url=await ARAPP.uploadAsset(pendingPhoto,currentRestaurant.id,'photos');
    const saved=await ARAPP.saveMenuItem(item);
    if(editingId)items=items.map(x=>x.id===saved.id?saved:x);else items.push(saved);
    $('#dishModal').close();renderAll();
  }catch(e){alert(e.message)}
  finally{button.disabled=false;button.textContent='Save dish'}
};
$('#duplicateDish').onclick=async()=>{
  if(!editingId)return;persistTranslationDraft();const source=items.find(i=>i.id===editingId);if(!source)return;
  const copy=JSON.parse(JSON.stringify(source));delete copy.id;copy.sort_order=items.length;copy.translations=copy.translations||{};
  ['en','nl','fr'].forEach(lang=>{if(copy.translations[lang]?.name)copy.translations[lang].name+=lang==='en'?' (copy)':' (copy)'});
  const btn=$('#duplicateDish');btn.disabled=true;btn.textContent='Duplicating…';
  try{const saved=await ARAPP.saveMenuItem(copy);items.push(saved);$('#dishModal').close();renderAll();openEditor(saved.id)}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Duplicate'}
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
  if($('#qrRestaurantName'))$('#qrRestaurantName').textContent=currentRestaurant.name;
  if($('#qrBrandLogo')){const el=$('#qrBrandLogo');el.innerHTML=currentRestaurant.logo_url?`<img src="${currentRestaurant.logo_url}" alt="">`:'';el.classList.toggle('hidden',!currentRestaurant.logo_url)}
  if($('#qrTableLabel'))$('#qrTableLabel').textContent=`Table ${t}`;
  if($('#qrLiveBadge'))$('#qrLiveBadge').textContent=currentRestaurant.published?'Live':'Draft';
}
$('#copyQrBtn').onclick=async()=>{await navigator.clipboard.writeText($('#qrUrl').value);$('#copyQrBtn').textContent='Copied ✓';setTimeout(()=>$('#copyQrBtn').textContent='Copy link',1200)};
$('#openQrBtn').onclick=()=>window.open($('#qrUrl').value,'_blank','noopener');
$('#shareQrBtn').onclick=async()=>{
  const url=$('#qrUrl').value,t=$('#tableSelect').value||1;
  if(navigator.share){try{await navigator.share({title:`${currentRestaurant.name} — Table ${t}`,text:'Open the 3D & AR menu',url});return}catch(e){if(e.name==='AbortError')return}}
  await navigator.clipboard.writeText(url);$('#shareQrBtn').textContent='Link copied ✓';setTimeout(()=>$('#shareQrBtn').textContent='Share',1200);
};
$('#downloadQrBtn').onclick=()=>{const img=$('#qrCode img')||$('#qrCode canvas');if(!img)return;const a=document.createElement('a');a.download=`${currentRestaurant.slug}-table-${$('#tableSelect').value}-qr.png`;a.href=img.src||img.toDataURL('image/png');a.click()};
$('#printAllQrBtn').onclick=()=>{
  const n=Math.max(1,Number(currentRestaurant.tables)||1),base=location.href;
  const logo=currentRestaurant.logo_url?`<img class="logo" src="${currentRestaurant.logo_url}" alt="">`:'';const cards=Array.from({length:n},(_,i)=>{const table=i+1,url=new URL(liveUrl(table),base).href;return `<div class="card">${logo}<div class="qr" data-url="${url.replaceAll('&','&amp;')}"></div><h2>${currentRestaurant.name}</h2><b>Table ${table}</b><p>Scan to view the menu in 3D & AR</p></div>`}).join('');
  const w=window.open('','_blank');if(!w)return alert('Allow pop-ups to print all table QR codes.');
  w.document.write(`<!doctype html><html><head><title>${currentRestaurant.name} QR codes</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#171713}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}.card{border:1px solid #ddd;border-radius:18px;padding:22px;text-align:center;break-inside:avoid}.logo{width:58px;height:58px;object-fit:contain;margin:0 auto 10px;display:block;border-radius:12px}.qr{display:flex;justify-content:center;margin-bottom:10px}h2{font-family:Georgia,serif;margin:8px 0 4px;font-size:24px}b{font-size:14px}p{font-size:11px;color:#666}@media print{body{margin:10mm}.grid{gap:10mm}.card{min-height:115mm;display:flex;flex-direction:column;justify-content:center;align-items:center}}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script></head><body><div class="grid">${cards}</div><script>window.onload=()=>{document.querySelectorAll('.qr').forEach(el=>new QRCode(el,{text:el.dataset.url,width:180,height:180,correctLevel:QRCode.CorrectLevel.M}));setTimeout(()=>window.print(),400)}<\/script></body></html>`);w.document.close();
};

async function renderAnalytics(){
  if(!currentRestaurant)return;
  try{
    const a=await ARAPP.analytics(currentRestaurant.id);
    const conversion=a.dish_view?Math.round((a.ar_launch/a.dish_view)*100):0;
    const unique=a.unique_sessions||0;
    const vals=[['Menu views',a.menu_view],['Dish opens',a.dish_view],['AR launches',a.ar_launch],['Dish → AR',`${conversion}%`]];
    $('#analyticsStats').innerHTML=vals.map(([l,v])=>stat(l,v)).join('');
    $('#conversionLabel').textContent=`${conversion}% of dish opens launch AR`;
    const funnelVals=[['Menu views',a.menu_view],['Dish opens',a.dish_view],['AR launches',a.ar_launch]];
    const max=Math.max(1,...funnelVals.map(v=>v[1]));
    $('#funnel').innerHTML=funnelVals.map(([l,v],idx)=>{const prev=idx?funnelVals[idx-1][1]:null;const rate=prev?Math.round(v/prev*100):100;return `<div class="funnel-row"><span>${l}${idx?` <small>${rate}%</small>`:''}</span><div class="bar"><span style="width:${Math.max(v?3:0,v/max*100)}%"></span></div><b>${v}</b></div>`}).join('')+`<p class="analytics-note">${unique} unique menu ${unique===1?'session':'sessions'} recorded.</p>`;
    const nameFor=id=>tItem(items.find(i=>i.id===id)||{}).name||'Deleted dish';
    const ranking=(rows,type)=>rows.length?rows.slice(0,6).map((row,index)=>`<div class="ranking-row"><span class="rank">${index+1}</span><div><b>${nameFor(row.item_id)}</b><small>${type==='ar'?`${row.ar_launch} AR launches`:`${row.dish_view} opens`}</small></div><strong>${type==='ar'?row.ar_launch:row.dish_view}</strong></div>`).join(''):'<div class="empty compact-empty">No activity recorded yet.</div>';
    $('#topDishAnalytics').innerHTML=ranking((a.by_item||[]).filter(x=>x.dish_view).sort((x,y)=>y.dish_view-x.dish_view),'dish');
    $('#topArAnalytics').innerHTML=ranking((a.by_item||[]).filter(x=>x.ar_launch).sort((x,y)=>y.ar_launch-x.ar_launch),'ar');
    const byTable=a.by_table||[];
    $('#tableAnalytics').innerHTML=byTable.length?byTable.map(row=>`<div class="table-analytics-row"><b>Table ${row.table}</b><span>${row.menu_view} views</span><span>${row.dish_view} opens</span><span>${row.ar_launch} AR</span></div>`).join(''):'<div class="empty compact-empty">No table scans recorded yet.</div>';
  }catch(e){$('#analyticsStats').innerHTML=`<div class="empty">${e.message}</div>`}
}

function dashboardEsc(v=''){return String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function renderHeroDishOptions(){
  const select=$('#setHeroDish');if(!select)return;
  const currentId=currentRestaurant?.menu_theme?.hero_item_id||'';
  const dishes=items.filter(i=>i.model_url);
  select.innerHTML='<option value="">Automatic — first 3D dish</option>'+dishes.map(i=>`<option value="${dashboardEsc(i.id)}">${dashboardEsc(tItem(i,'en').name)}</option>`).join('');
  select.value=dishes.some(i=>i.id===currentId)?currentId:'';
}
function updateHeroMediaControls(){
  const mode=$('#setHeroMode')?.value||'3d';
  $('#heroDishField')?.classList.toggle('hidden',mode!=='3d');
  $('#heroImageFields')?.classList.toggle('hidden',mode!=='image');
  $('#heroVideoFields')?.classList.toggle('hidden',mode!=='video');
}
function previewBrandAssets(){
  const name=currentRestaurant?.name||'Restaurant';
  const logoUrl=pendingLogo?URL.createObjectURL(pendingLogo):(removeLogoRequested?'':currentRestaurant?.logo_url||'');
  $('#logoPreview').innerHTML=logoUrl?`<img src="${logoUrl}" alt="Logo preview">`:`<span>${name.trim().charAt(0).toUpperCase()||'R'}</span>`;
  const preview=$('#heroMediaPreview');if(!preview)return;
  const mode=$('#setHeroMode')?.value||currentRestaurant?.hero_mode||'3d';
  updateHeroMediaControls();
  if(mode==='image'){
    const heroUrl=pendingHeroImage?URL.createObjectURL(pendingHeroImage):(removeHeroRequested?'':currentRestaurant?.hero_image_url||'');
    preview.innerHTML=heroUrl?`<img src="${heroUrl}" alt="Hero image preview">`:'<span>Choose a hero image</span>';return;
  }
  if(mode==='video'){
    const saved=currentRestaurant?.menu_theme?.hero_video_url||'';
    const videoUrl=pendingHeroVideo?URL.createObjectURL(pendingHeroVideo):(removeHeroVideoRequested?'':saved);
    preview.innerHTML=videoUrl?`<video src="${videoUrl}" muted loop playsinline autoplay controls></video>`:'<span>Choose a hero video</span>';return;
  }
  const selected=$('#setHeroDish')?.value||'';
  const dish=items.find(i=>i.id===selected&&i.model_url)||items.find(i=>i.model_url);
  preview.innerHTML=dish?`<model-viewer src="${dashboardEsc(dish.model_url)}" auto-rotate camera-controls interaction-prompt="none" shadow-intensity="1" environment-image="neutral"></model-viewer>`:'<span>Add a 3D model to a dish first</span>';
}
function renderSettings(){
  if(!currentRestaurant)return;
  pendingLogo=null;pendingHeroImage=null;pendingHeroVideo=null;removeLogoRequested=false;removeHeroRequested=false;removeHeroVideoRequested=false;
  $('#setName').value=currentRestaurant.name;$('#setSlug').value=currentRestaurant.slug;$('#setTagline').value=currentRestaurant.tagline||'';$('#setAccent').value=currentRestaurant.accent||'#b7482d';$('#accentValue').textContent=$('#setAccent').value;$('#setTables').value=currentRestaurant.tables||1;$('#setDefaultLang').value=currentRestaurant.default_language||'en';$('#setHeroMode').value=['3d','image','video'].includes(currentRestaurant.hero_mode)?currentRestaurant.hero_mode:'3d';
  setThemeControls(currentRestaurant.menu_theme||{});renderHeroDishOptions();
  const copy=currentRestaurant.menu_theme?.hero_copy||{};$('#setHeroEyebrow').value=copy.eyebrow||'';$('#setHeroTitle').value=copy.title||'';$('#setHeroAccentText').value=copy.accent||'';$('#setHeroSubtitle').value=copy.subtitle||'';
  $('#openThemePreview').href=liveUrl();previewBrandAssets();
}
$('#setAccent').addEventListener('input',()=>$('#accentValue').textContent=$('#setAccent').value);
$$('.template-card').forEach(card=>card.addEventListener('click',()=>setThemeControls(MENU_TEMPLATE_DEFAULTS[card.dataset.template])));
['setMenuBg','setMenuSurface','setMenuText','setCategoryBg','setCategoryText','setCardRadius','setMenuDensity','setShowHero','setStickyCategories','setShowFeatureStrip'].forEach(id=>$('#'+id)?.addEventListener('input',()=>paintThemePreview()));
$('#resetThemeBtn').onclick=()=>{const template=$('.template-card.active')?.dataset.template||'editorial';setThemeControls(MENU_TEMPLATE_DEFAULTS[template])};
$('#logoUpload').addEventListener('change',e=>{pendingLogo=e.target.files?.[0]||null;removeLogoRequested=false;previewBrandAssets()});
$('#setHeroMode').addEventListener('change',previewBrandAssets);
$('#setHeroDish').addEventListener('change',previewBrandAssets);
$('#heroImageUpload').addEventListener('change',e=>{pendingHeroImage=e.target.files?.[0]||null;removeHeroRequested=false;previewBrandAssets()});
$('#heroVideoUpload').addEventListener('change',e=>{pendingHeroVideo=e.target.files?.[0]||null;removeHeroVideoRequested=false;previewBrandAssets()});
$('#removeLogo').onclick=()=>{pendingLogo=null;removeLogoRequested=true;$('#logoUpload').value='';previewBrandAssets()};
$('#removeHeroImage').onclick=()=>{pendingHeroImage=null;removeHeroRequested=true;$('#heroImageUpload').value='';previewBrandAssets()};
$('#removeHeroVideo').onclick=()=>{pendingHeroVideo=null;removeHeroVideoRequested=true;$('#heroVideoUpload').value='';previewBrandAssets()};
$('#saveSettings').onclick=async()=>{
  if(!currentRestaurant)return;
  const button=$('#saveSettings');button.disabled=true;button.textContent='Saving…';
  try{
    let logoUrl=removeLogoRequested?'':(currentRestaurant.logo_url||'');
    let heroUrl=removeHeroRequested?'':(currentRestaurant.hero_image_url||'');
    let heroVideoUrl=removeHeroVideoRequested?'':(currentRestaurant.menu_theme?.hero_video_url||'');
    if(pendingLogo)logoUrl=await ARAPP.uploadAsset(pendingLogo,currentRestaurant.id,'branding/logo');
    if(pendingHeroImage)heroUrl=await ARAPP.uploadAsset(pendingHeroImage,currentRestaurant.id,'branding/hero-image');
    if(pendingHeroVideo)heroVideoUrl=await ARAPP.uploadAsset(pendingHeroVideo,currentRestaurant.id,'branding/hero-video');
    const theme=themeControlsTheme({hero_video_url:heroVideoUrl,hero_item_id:$('#setHeroDish').value||'',hero_copy:heroCopyFromControls()});
    const patch={name:$('#setName').value.trim()||'Restaurant',slug:ARAPP.slugify($('#setSlug').value||$('#setName').value),tagline:$('#setTagline').value.trim(),accent:$('#setAccent').value,tables:Math.max(1,Number($('#setTables').value)||1),default_language:$('#setDefaultLang').value,logo_url:logoUrl,hero_image_url:heroUrl,hero_mode:$('#setHeroMode').value,menu_theme:theme};
    currentRestaurant=await ARAPP.updateRestaurant(currentRestaurant.id,patch);restaurants=restaurants.map(r=>r.id===currentRestaurant.id?currentRestaurant:r);renderAll();
  }catch(e){alert(e.message)}
  finally{button.disabled=false;button.textContent='Save settings'}
};
async function renderBilling(){
  try{
    accountAccess=await ARAPP.accountAccess();
    const sub=accountAccess.subscription||{};
    const plan=(sub.plan||'No active plan').replace(/^./,c=>c.toUpperCase());
    $('#billingPlan').textContent=plan==='Legacy'?'Legacy PlateCrop access':`${plan} plan`;
    $('#billingStatus').textContent=(sub.status||'inactive').replaceAll('_',' ');
    $('#billingStatus').className=`billing-status ${['active','trialing','legacy'].includes(sub.status)?'ok':'warn'}`;
    if(sub.current_period_end){
      const d=new Date(sub.current_period_end);
      $('#billingRenewal').textContent=sub.cancel_at_period_end?`Ends ${d.toLocaleDateString()}`:`Renews ${d.toLocaleDateString()}`;
    }else $('#billingRenewal').textContent='';
    $('#manageBillingBtn').disabled=!sub.stripe_customer_id;
    $('#manageBillingBtn').title=sub.stripe_customer_id?'Open Stripe billing portal':'Billing portal becomes available after a Stripe checkout.';
  }catch(e){$('#billingStatus').textContent=e.message}
}
$('#manageBillingBtn').onclick=async()=>{const b=$('#manageBillingBtn');b.disabled=true;b.textContent='Opening…';try{const d=await ARAPP.apiWithAuth('/api/create-portal-session',{method:'POST'});location.href=d.url}catch(e){alert(e.message);b.disabled=false;b.textContent='Manage billing'}};

$('#refreshData').onclick=()=>loadRestaurants(currentRestaurant?.id);

ensureAuth().catch(e=>{console.error(e);alert(e.message)});
