
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
let restaurant=null, items=[], lang='en', activeCategory='All', activeDish=null;

const ui={
en:{eyebrow:'THE MENU, BROUGHT TO YOUR TABLE',hero1:'See your dish',hero2:'before it arrives.',explore:'Explore menu',tryar:'Try AR demo',rotate:'Drag to rotate',discover:'DISCOVER',ourmenu:'Our menu',intro:'Tap any dish to inspect it in 3D, then place it on your table in augmented reality.',step1h:'Choose a dish',step1p:'Browse the visual menu and allergen information.',step2h:'Explore in 3D',step2p:'Rotate, zoom and inspect the plate from every angle.',step3h:'Place it in AR',step3p:'Use your phone camera to preview it on your table.',all:'All',unavailable:'Unavailable',allergens:'Allergens'},
nl:{eyebrow:'HET MENU, OP JOUW TAFEL',hero1:'Bekijk je gerecht',hero2:'voor het arriveert.',explore:'Bekijk menu',tryar:'Probeer AR',rotate:'Sleep om te draaien',discover:'ONTDEK',ourmenu:'Ons menu',intro:'Tik op een gerecht om het in 3D te bekijken en plaats het daarna in AR op je tafel.',step1h:'Kies een gerecht',step1p:'Bekijk het visuele menu en allergenen.',step2h:'Bekijk in 3D',step2p:'Draai, zoom en bekijk het bord vanuit elke hoek.',step3h:'Plaats in AR',step3p:'Gebruik je camera om het gerecht op tafel te bekijken.',all:'Alles',unavailable:'Niet beschikbaar',allergens:'Allergenen'},
fr:{eyebrow:'LE MENU, DIRECTEMENT À TABLE',hero1:'Voyez votre plat',hero2:'avant son arrivée.',explore:'Voir le menu',tryar:'Essayer la RA',rotate:'Glissez pour tourner',discover:'DÉCOUVRIR',ourmenu:'Notre menu',intro:'Touchez un plat pour l’examiner en 3D puis placez-le sur votre table en réalité augmentée.',step1h:'Choisissez un plat',step1p:'Parcourez le menu visuel et les allergènes.',step2h:'Explorez en 3D',step2p:'Tournez, zoomez et inspectez l’assiette sous tous les angles.',step3h:'Placez-le en RA',step3p:'Utilisez votre caméra pour le prévisualiser sur votre table.',all:'Tous',unavailable:'Indisponible',allergens:'Allergènes'}
};

function tItem(i){return i.translations?.[lang]||i.translations?.en||{name:'Dish',description:''}}
function applyBrand(){
  document.documentElement.style.setProperty('--accent',restaurant.accent||'#b7482d');
  $('#restaurantName').textContent=restaurant.name;
  $('#footerName').textContent=restaurant.name;
  $('#tagline').textContent=restaurant.tagline||'';
  document.title=`${restaurant.name} — 3D & AR Menu`;
  $('#langSelect').value=lang;
  $$('[data-i18n]').forEach(el=>el.textContent=ui[lang]?.[el.dataset.i18n]||ui.en[el.dataset.i18n]||el.textContent);
  const table=params.get('table'); $('#tableLabel').textContent=table?`Table ${table}`:'3D & AR menu';
  $('#draftBanner').classList.add('hidden');
}
function setHero(){
  const i=items.find(x=>x.model_url&&x.available&&x.published)||items[0];
  if(i) $('#heroViewer').src=i.model_url||'';
}
function renderFilters(){
  const cats=['All',...new Set(items.filter(i=>i.published).map(i=>i.category).filter(Boolean))];
  $('#filters').innerHTML=cats.map((c,idx)=>`<button class="filter-btn ${idx===0?'active':''}" data-cat="${c}">${idx===0?ui[lang].all:c}</button>`).join('');
  $$('.filter-btn').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;$$('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));renderMenu()});
}
function renderMenu(){
  const list=items.filter(i=>i.published&&(activeCategory==='All'||i.category===activeCategory));
  $('#menuGrid').innerHTML=list.map(i=>{
    const t=tItem(i);
    const visual=i.model_url
      ? `<model-viewer src="${i.model_url}" camera-orbit="25deg 70deg 2.7m" auto-rotate interaction-prompt="none" shadow-intensity="1"></model-viewer>`
      : (i.photo_url?`<img src="${i.photo_url}" alt="${t.name}">`:'');
    return `<article class="menu-card ${i.available?'':'unavailable'}" data-id="${i.id}" tabindex="0">
      <div class="model-preview">${visual}<span class="view-pill">↻ 3D</span></div>
      <div class="card-copy"><div class="card-top"><h3>${t.name}</h3><span class="price">${ARAPP.money(i.price,restaurant.currency)}</span></div>
      <p>${t.description}</p><div class="tags">${(i.tags||[]).map(x=>`<span class="tag">${x}</span>`).join('')}${!i.available?`<span class="tag warning">${ui[lang].unavailable}</span>`:''}</div></div>
    </article>`;
  }).join('');
  $$('.menu-card').forEach(c=>{const fn=()=>openDish(c.dataset.id);c.onclick=fn;c.onkeydown=e=>{if(e.key==='Enter')fn()}});
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
    $('#arSizeNote').textContent=`Calibrated to approximately ${targetCm} cm wide`;
  }catch(e){console.warn('Could not calibrate model scale',e)}
}
function updateArCapability(){
  const viewer=$('#dishViewer');
  const btn=$('#mobileArTrigger');
  if(!viewer||!btn)return;
  const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
  if(!secure){$('#arCompatibilityNote').textContent='Camera AR needs HTTPS. Open the deployed PlateView link on your phone.';}
  else if(viewer.canActivateAR===false){$('#arCompatibilityNote').textContent='3D works on this device, but native AR is not available in this browser.';}
  else{$('#arCompatibilityNote').textContent='On supported phones, this opens the camera and places the dish at its calibrated size.';}
}
function openDish(id){
  activeDish=items.find(i=>i.id===id); if(!activeDish)return;
  const t=tItem(activeDish);
  const viewer=$('#dishViewer');viewer.scale='1 1 1';viewer.setAttribute('scale','1 1 1');viewer.src=activeDish.model_url||'';$('#arSizeNote').textContent=targetWidthCm(activeDish)?`Calibrating to ${targetWidthCm(activeDish)} cm wide…`:'Real-size calibration not set for this dish';updateArCapability();
  $('#dialogCategory').textContent=activeDish.category||'';
  $('#dialogAvailability').textContent=activeDish.available?'':ui[lang].unavailable;
  $('#dialogName').textContent=t.name; $('#dialogDescription').textContent=t.description;
  $('#dialogPrice').textContent=ARAPP.money(activeDish.price,restaurant.currency);
  $('#dialogAllergens').textContent=(activeDish.allergens||[]).length?`${ui[lang].allergens}: ${activeDish.allergens.join(', ')}`:'';
  $('#dishDialog').showModal();
  ARAPP.track(restaurant.id,'dish_view',activeDish.id,params.get('table'));
}
async function launchAR(){
  if(!activeDish?.model_url){alert('This dish does not have a 3D model yet.');return;}
  try{
    await ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table'));
    await $('#dishViewer').activateAR();
  }catch{alert('AR could not start. Open the deployed HTTPS PlateView link on a compatible Android or iPhone, then try again.');}
}
async function boot(){
  const slug=params.get('r')||'maison-table';
  const result=await ARAPP.getPublicRestaurant(slug);
  if(!result){
    document.body.innerHTML='<main style="padding:10vw;font-family:system-ui"><h1>Menu unavailable</h1><p>This restaurant is not published or the link is incorrect.</p></main>';
    return;
  }
  restaurant=result.restaurant; items=result.items;
  lang=params.get('lang')||restaurant.default_language||'en';
  if(!ui[lang]) lang='en';
  applyBrand();setHero();renderFilters();renderMenu();
  await ARAPP.track(restaurant.id,'menu_view',null,params.get('table'));
}
$('#closeDialog').onclick=()=>$('#dishDialog').close();
$('#demoArBtn').onclick=()=>{const i=items.find(x=>x.available&&x.model_url);if(i)openDish(i.id)};
$('#mobileArTrigger').onclick=launchAR;
$('#dishViewer').addEventListener('load',()=>{if(activeDish){applyRealScale($('#dishViewer'),activeDish);updateArCapability();}});
$('#arSlotBtn').onclick=()=>{ if(activeDish) ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table')); };
$('#langSelect').onchange=()=>{lang=$('#langSelect').value;activeCategory='All';applyBrand();renderFilters();renderMenu()};
boot().catch(e=>{console.error(e);document.body.innerHTML=`<main style="padding:10vw;font-family:system-ui"><h1>Could not load menu</h1><p>${e.message}</p></main>`});
