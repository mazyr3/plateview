const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
let restaurant=null, items=[], lang='en', activeCategory='All', activeDish=null;

const ui={
  en:{eyebrow:'THE MENU, BROUGHT TO YOUR TABLE',hero1:'See your dish',hero2:'before it arrives.',explore:'Explore menu',tryar:'Try AR',rotate:'Drag to rotate',heroTrust:'3D preview · real-size AR on supported phones',discover:'DISCOVER',ourmenu:'Our menu',intro:'Tap any dish to inspect it in 3D, then place it on your table in augmented reality.',step1h:'Choose a dish',step1p:'Browse the visual menu and allergen information.',step2h:'Explore in 3D',step2p:'Rotate, zoom and inspect the plate from every angle.',step3h:'Place it in AR',step3p:'Use your phone camera to preview it on your table.',all:'All',unavailable:'Unavailable',allergens:'Allergens',viewTable:'View on your table',openCamera:'Open camera AR',viewerHint:'Drag to rotate · pinch to zoom',tap3d:'Tap to explore in 3D',scrollHint:'Scroll normally until activated',active3d:'3D active',arStep1:'Point at your table',arStep2:'Move slowly to detect it',arStep3:'Tap to place the dish',table:'Table',view3d:'View in 3D'},
  nl:{eyebrow:'HET MENU, OP JOUW TAFEL',hero1:'Bekijk je gerecht',hero2:'voor het arriveert.',explore:'Bekijk menu',tryar:'Probeer AR',rotate:'Sleep om te draaien',heroTrust:'3D-preview · AR op ware grootte op ondersteunde telefoons',discover:'ONTDEK',ourmenu:'Ons menu',intro:'Tik op een gerecht om het in 3D te bekijken en plaats het daarna in AR op je tafel.',step1h:'Kies een gerecht',step1p:'Bekijk het visuele menu en allergenen.',step2h:'Bekijk in 3D',step2p:'Draai, zoom en bekijk het bord vanuit elke hoek.',step3h:'Plaats in AR',step3p:'Gebruik je camera om het gerecht op tafel te bekijken.',all:'Alles',unavailable:'Niet beschikbaar',allergens:'Allergenen',viewTable:'Bekijk op je tafel',openCamera:'Open camera AR',viewerHint:'Sleep om te draaien · knijp om te zoomen',tap3d:'Tik om 3D te bedienen',scrollHint:'Scroll normaal totdat 3D actief is',active3d:'3D actief',arStep1:'Richt op je tafel',arStep2:'Beweeg langzaam om te detecteren',arStep3:'Tik om het gerecht te plaatsen',table:'Tafel',view3d:'Bekijk in 3D'},
  fr:{eyebrow:'LE MENU, DIRECTEMENT À TABLE',hero1:'Voyez votre plat',hero2:'avant son arrivée.',explore:'Voir le menu',tryar:'Essayer la RA',rotate:'Glissez pour tourner',heroTrust:'Aperçu 3D · RA à taille réelle sur téléphones compatibles',discover:'DÉCOUVRIR',ourmenu:'Notre menu',intro:'Touchez un plat pour l’examiner en 3D puis placez-le sur votre table en réalité augmentée.',step1h:'Choisissez un plat',step1p:'Parcourez le menu visuel et les allergènes.',step2h:'Explorez en 3D',step2p:'Tournez, zoomez et inspectez l’assiette sous tous les angles.',step3h:'Placez-le en RA',step3p:'Utilisez votre caméra pour le prévisualiser sur votre table.',all:'Tous',unavailable:'Indisponible',allergens:'Allergènes',viewTable:'Voir sur votre table',openCamera:'Ouvrir la caméra RA',viewerHint:'Glissez pour tourner · pincez pour zoomer',tap3d:'Touchez pour explorer en 3D',scrollHint:'Faites défiler normalement avant activation',active3d:'3D actif',arStep1:'Visez votre table',arStep2:'Bougez lentement pour la détecter',arStep3:'Touchez pour placer le plat',table:'Table',view3d:'Voir en 3D'}
};


function setViewerInteraction(viewerId,active){
  const viewer=document.getElementById(viewerId);
  const wrap=viewer?.closest('.tap-gated-viewer');
  if(!viewer||!wrap)return;
  wrap.classList.toggle('viewer-active',active);
  viewer.toggleAttribute('camera-controls',active);
  const gate=wrap.querySelector('.viewer-activation');
  if(gate)gate.setAttribute('aria-pressed',active?'true':'false');
}
function resetViewerInteraction(viewerId){setViewerInteraction(viewerId,false)}
function setupViewerGates(){
  $$('.viewer-activation').forEach(gate=>{
    gate.addEventListener('click',()=>setViewerInteraction(gate.dataset.viewerTarget,true));
  });
  $$('.viewer-lock').forEach(lock=>{
    lock.addEventListener('click',e=>{e.stopPropagation();setViewerInteraction(lock.dataset.viewerTarget,false)});
  });
}

function tItem(i){return i.translations?.[lang]||i.translations?.en||{name:'Dish',description:''}}
function esc(v=''){return String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function applyBrand(){
  document.documentElement.style.setProperty('--accent',restaurant.accent||'#b7482d');
  $('#restaurantName').textContent=restaurant.name;
  const mark=$('#brandMark');
  if(restaurant.logo_url){mark.innerHTML=`<img src="${esc(restaurant.logo_url)}" alt="${esc(restaurant.name)} logo">`;mark.classList.add('has-logo')}else{mark.textContent=(restaurant.name||'M').trim().charAt(0).toUpperCase();mark.classList.remove('has-logo')}
  $('#footerName').textContent=restaurant.name;
  $('#tagline').textContent=restaurant.tagline||'Explore every dish before you choose.';
  document.title=`${restaurant.name} — 3D & AR Menu`;
  $('#langSelect').value=lang;
  $$('[data-i18n]').forEach(el=>el.textContent=ui[lang]?.[el.dataset.i18n]||ui.en[el.dataset.i18n]||el.textContent);
  const table=params.get('table');
  $('#tableLabel').textContent=table?`${ui[lang].table} ${table}`:'3D & AR menu';
  $('#tableChip').textContent=table?`${ui[lang].table} ${table}`:'';
  $('#tableChip').classList.toggle('hidden',!table);
  $('#draftBanner').classList.add('hidden');
}
function setHero(){
  const card=$('#heroViewerWrap'),viewer=$('#heroViewer'),gate=card.querySelector('.viewer-activation'),lock=card.querySelector('.viewer-lock');
  const useImage=(restaurant.hero_mode==='image'&&restaurant.hero_image_url);
  card.classList.toggle('hero-image-mode',!!useImage);
  if(useImage){
    viewer.removeAttribute('src');card.style.backgroundImage=`url("${restaurant.hero_image_url}")`;gate.classList.add('hidden');lock.classList.add('hidden');
    return;
  }
  card.style.backgroundImage='';gate.classList.remove('hidden');
  const i=items.find(x=>x.model_url&&x.available&&x.published)||items.find(x=>x.model_url&&x.published)||items[0];
  if(i){viewer.src=i.model_url||'';}
}
function renderFilters(){
  const cats=['All',...new Set(items.filter(i=>i.published).map(i=>i.category).filter(Boolean))];
  $('#filters').innerHTML=cats.map((c,idx)=>`<button class="filter-btn ${activeCategory===c?'active':''}" data-cat="${esc(c)}">${idx===0?ui[lang].all:esc(c)}</button>`).join('');
  $$('.filter-btn').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;$$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));renderMenu()});
}
function renderMenu(){
  const list=items.filter(i=>i.published&&(activeCategory==='All'||i.category===activeCategory));
  $('#menuGrid').innerHTML=list.map(i=>{
    const t=tItem(i);
    const visual=i.model_url
      ? `<model-viewer src="${esc(i.model_url)}" camera-orbit="25deg 70deg auto" field-of-view="30deg" auto-rotate interaction-prompt="none" shadow-intensity="1" environment-image="neutral"></model-viewer>`
      : (i.photo_url?`<img src="${esc(i.photo_url)}" alt="${esc(t.name)}">`:'<div class="empty-visual">No preview</div>');
    const hasAr=!!i.model_url;
    return `<article class="menu-card ${i.available?'':'unavailable'}" data-id="${i.id}" tabindex="0" aria-label="${esc(t.name)}">
      <div class="model-preview">${visual}${hasAr?`<span class="view-pill">↻ ${ui[lang].view3d}</span>`:''}</div>
      <div class="card-copy">
        <div class="card-top"><h3>${esc(t.name)}</h3><span class="price">${ARAPP.money(i.price,restaurant.currency)}</span></div>
        ${t.description?`<p>${esc(t.description)}</p>`:''}
        <div class="tags">${(i.tags||[]).slice(0,2).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}${!i.available?`<span class="tag warning">${ui[lang].unavailable}</span>`:''}</div>
      </div>
    </article>`;
  }).join('')||'<div class="menu-empty">No dishes in this category yet.</div>';
  $$('.menu-card').forEach(c=>{const fn=()=>openDish(c.dataset.id);c.onclick=fn;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}}});
}
function targetWidthCm(item){return Number(item?.translations?._meta?.width_cm)||0}
function applyRealScale(viewer,item){
  const targetCm=targetWidthCm(item);
  if(!viewer||!targetCm)return;
  try{
    const d=viewer.getDimensions();
    if(!d?.x)return;
    const factor=(targetCm/100)/d.x;
    viewer.scale=`${factor} ${factor} ${factor}`;
    viewer.setAttribute('scale',`${factor} ${factor} ${factor}`);
    $('#arSizeNote').textContent=`≈ ${targetCm} cm wide · calibrated size`;
  }catch(e){console.warn('Could not calibrate model scale',e)}
}
function updateArCapability(){
  const viewer=$('#dishViewer'), btn=$('#mobileArTrigger');
  if(!viewer||!btn)return;
  const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
  const hasModel=!!activeDish?.model_url;
  btn.disabled=!hasModel;
  $('#arReadyCard').classList.toggle('disabled',!hasModel);
  if(!hasModel){$('#arCompatibilityNote').textContent='A 3D model has not been added for this dish yet.';}
  else if(!secure){$('#arCompatibilityNote').textContent='Camera AR needs HTTPS. Open the deployed PlateView link on your phone.';}
  else if(viewer.canActivateAR===false){$('#arCompatibilityNote').textContent='3D works here, but this browser does not expose native AR.';}
  else{$('#arCompatibilityNote').textContent='Camera AR will place the dish at its calibrated size on supported phones.';}
}
function openDish(id){
  activeDish=items.find(i=>i.id===id); if(!activeDish)return;
  resetViewerInteraction('dishViewer');
  const t=tItem(activeDish), viewer=$('#dishViewer');
  viewer.scale='1 1 1';viewer.setAttribute('scale','1 1 1');viewer.src=activeDish.model_url||'';
  $('#arSizeNote').textContent=targetWidthCm(activeDish)?`Calibrating to ${targetWidthCm(activeDish)} cm wide…`:'Real-size calibration not set';
  $('#dialogCategory').textContent=activeDish.category||'';
  $('#dialogAvailability').textContent=activeDish.available?'':ui[lang].unavailable;
  $('#dialogName').textContent=t.name; $('#dialogDescription').textContent=t.description||'';
  $('#dialogPrice').textContent=ARAPP.money(activeDish.price,restaurant.currency);
  $('#dialogAllergens').textContent=(activeDish.allergens||[]).length?`${ui[lang].allergens}: ${activeDish.allergens.join(', ')}`:'';
  updateArCapability();
  $('#dishDialog').showModal();
  document.body.classList.add('dialog-open');
  ARAPP.track(restaurant.id,'dish_view',activeDish.id,params.get('table'));
}
async function launchAR(){
  if(!activeDish?.model_url){alert('This dish does not have a 3D model yet.');return;}
  const button=$('#mobileArTrigger'); button.classList.add('loading');
  try{
    await ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table'));
    await $('#dishViewer').activateAR();
  }catch(e){alert('AR could not start. Try opening PlateView in Chrome on Android or Safari on iPhone.');}
  finally{button.classList.remove('loading')}
}
function closeDish(){if($('#dishDialog').open)$('#dishDialog').close();document.body.classList.remove('dialog-open')}
async function boot(){
  const slug=params.get('r')||'maison-table';
  const result=await ARAPP.getPublicRestaurant(slug);
  if(!result){document.body.innerHTML='<main style="padding:10vw;font-family:system-ui"><h1>Menu unavailable</h1><p>This restaurant is not published or the link is incorrect.</p></main>';return;}
  restaurant=result.restaurant; items=result.items;
  lang=params.get('lang')||restaurant.default_language||'en'; if(!ui[lang])lang='en';
  applyBrand();setHero();renderFilters();renderMenu();setupViewerGates();
  await ARAPP.track(restaurant.id,'menu_view',null,params.get('table'));
}
$('#closeDialog').onclick=closeDish;
$('#dishDialog').addEventListener('click',e=>{if(e.target===$('#dishDialog'))closeDish()});
$('#dishDialog').addEventListener('close',()=>document.body.classList.remove('dialog-open'));
$('#demoArBtn').onclick=()=>{const i=items.find(x=>x.available&&x.model_url);if(i)openDish(i.id)};
$('#mobileArTrigger').onclick=launchAR;
$('#dishViewer').addEventListener('load',()=>{if(activeDish){applyRealScale($('#dishViewer'),activeDish);updateArCapability()}});
$('#arSlotBtn').onclick=()=>{if(activeDish)ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table'))};
$('#langSelect').onchange=()=>{lang=$('#langSelect').value;activeCategory='All';applyBrand();renderFilters();renderMenu()};
boot().catch(e=>{console.error(e);document.body.innerHTML=`<main style="padding:10vw;font-family:system-ui"><h1>Could not load menu</h1><p>${esc(e.message)}</p></main>`});
