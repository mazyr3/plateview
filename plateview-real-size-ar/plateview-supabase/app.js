const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
let restaurant=null, items=[], lang='en', activeCategory='All', activeDish=null;

const MENU_TEMPLATE_DEFAULTS={
  editorial:{template:'editorial',background:'#f7f4ed',surface:'#fffdf8',text:'#171713',muted:'#746f65',category_background:'#f7f4ed',category_text:'#171713',card_radius:24,density:'comfortable',mobile_columns:1,show_hero:true,sticky_categories:true,show_feature_strip:true},
  compact:{template:'compact',background:'#f3f3f3',surface:'#ffffff',text:'#171717',muted:'#6f6f6f',category_background:'#111111',category_text:'#ffffff',card_radius:14,density:'compact',mobile_columns:1,show_hero:true,sticky_categories:true,show_feature_strip:false},
  gallery:{template:'gallery',background:'#f6f1e8',surface:'#fffdf8',text:'#1b1916',muted:'#766f65',category_background:'#fffdf8',category_text:'#1b1916',card_radius:30,density:'comfortable',mobile_columns:2,show_hero:true,sticky_categories:true,show_feature_strip:false}
};
function menuTheme(){const saved=restaurant?.menu_theme||{};const template=MENU_TEMPLATE_DEFAULTS[saved.template]?saved.template:'editorial';return {...MENU_TEMPLATE_DEFAULTS[template],...saved,template}}
function applyMenuTheme(){const theme=menuTheme(),root=document.documentElement;document.body.dataset.template=theme.template;document.body.dataset.density=theme.density||'comfortable';document.body.dataset.mobileColumns=String(Number(theme.mobile_columns)||1);root.style.setProperty('--bg',theme.background);root.style.setProperty('--surface',theme.surface);root.style.setProperty('--ink',theme.text);root.style.setProperty('--muted',theme.muted);root.style.setProperty('--category-bg',theme.category_background);root.style.setProperty('--category-text',theme.category_text);root.style.setProperty('--radius',`${Number(theme.card_radius)||0}px`);$('.hero')?.classList.toggle('theme-hidden',theme.show_hero===false);$('.feature-strip')?.classList.toggle('theme-hidden',theme.show_feature_strip===false);$('.filter-wrap')?.classList.toggle('category-static',theme.sticky_categories===false)}

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
function dishVisualPreference(item,place='card'){
  const meta=item?.translations?._meta||{};
  return place==='detail'?(meta.detail_visual||'auto'):(meta.card_visual||'auto');
}
function resolvedDishVisual(item,place='card'){
  const pref=dishVisualPreference(item,place);
  if(pref==='photo'&&item?.photo_url)return 'photo';
  if(pref==='3d'&&item?.model_url)return '3d';
  if(item?.model_url)return '3d';
  if(item?.photo_url)return 'photo';
  return 'none';
}
function applyBrand(){
  document.documentElement.style.setProperty('--accent',restaurant.accent||'#b7482d');
  $('#restaurantName').textContent=restaurant.name;
  const mark=$('#brandMark');
  if(restaurant.logo_url){mark.innerHTML=`<img src="${esc(restaurant.logo_url)}" alt="${esc(restaurant.name)} logo">`;mark.classList.add('has-logo')}else{mark.textContent=(restaurant.name||'M').trim().charAt(0).toUpperCase();mark.classList.remove('has-logo')}
  $('#footerName').textContent=restaurant.name;
  document.title=`${restaurant.name} — 3D & AR Menu`;
  $('#langSelect').value=lang;
  $$('[data-i18n]').forEach(el=>el.textContent=ui[lang]?.[el.dataset.i18n]||ui.en[el.dataset.i18n]||el.textContent);
  const copy=menuTheme().hero_copy||{};
  $('#heroEyebrow').textContent=copy.eyebrow||ui[lang].eyebrow;
  $('#heroTitle').textContent=copy.title||ui[lang].hero1;
  $('#heroAccent').textContent=copy.accent||ui[lang].hero2;
  $('#tagline').textContent=copy.subtitle||restaurant.tagline||'Explore every dish before you choose.';
  const table=params.get('table');
  $('#tableLabel').textContent=table?`${ui[lang].table} ${table}`:'3D & AR menu';
  $('#tableChip').textContent=table?`${ui[lang].table} ${table}`:'';
  $('#tableChip').classList.toggle('hidden',!table);
  $('#draftBanner').classList.add('hidden');
}
function heroItem(){
  const selectedId=menuTheme().hero_item_id||'';
  return items.find(x=>x.id===selectedId&&x.model_url&&x.published)||items.find(x=>x.model_url&&x.available&&x.published)||items.find(x=>x.model_url&&x.published)||null;
}
function setHero(){
  const card=$('#heroViewerWrap'),viewer=$('#heroViewer'),video=$('#heroVideo'),gate=card.querySelector('.viewer-activation'),lock=card.querySelector('.viewer-lock');
  const mode=restaurant.hero_mode||'3d',theme=menuTheme();
  card.classList.remove('hero-image-mode','hero-video-mode');card.style.backgroundImage='';
  video.pause();video.removeAttribute('src');video.load();viewer.removeAttribute('src');gate.classList.add('hidden');lock.classList.add('hidden');resetViewerInteraction('heroViewer');
  if(mode==='image'&&restaurant.hero_image_url){card.classList.add('hero-image-mode');card.style.backgroundImage=`url("${restaurant.hero_image_url}")`;return;}
  if(mode==='video'&&theme.hero_video_url){card.classList.add('hero-video-mode');video.src=theme.hero_video_url;video.load();video.play().catch(()=>{});return;}
  const i=heroItem();
  if(i){viewer.src=i.model_url||'';gate.classList.remove('hidden');}
}
let categoryScrollRaf=0;
let categoryScrollLockUntil=0;
function menuCategories(){return [...new Set(items.filter(i=>i.published).map(i=>i.category||'Other'))]}
function setActiveCategory(category,bringIntoView=true){
  activeCategory=category;
  const buttons=$$('.filter-btn');
  buttons.forEach(b=>b.classList.toggle('active',b.dataset.cat===category));
  if(bringIntoView){
    const active=buttons.find(b=>b.dataset.cat===category);
    active?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }
}
function categoryStickyOffset(){
  const topbar=$('.topbar')?.getBoundingClientRect().height||0;
  const filters=$('.filter-wrap')?.getBoundingClientRect().height||0;
  return topbar+filters+14;
}
function scrollToMenuCategory(category){
  categoryScrollLockUntil=Date.now()+650;
  setActiveCategory(category,true);
  let target;
  if(category==='All') target=$('#menuGrid');
  else target=$$('.category-section').find(s=>s.dataset.category===category);
  if(!target)return;
  const y=target.getBoundingClientRect().top+window.scrollY-categoryStickyOffset();
  window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
}
function updateActiveCategoryFromScroll(){
  categoryScrollRaf=0;
  if(Date.now()<categoryScrollLockUntil)return;
  const sections=$$('.category-section');
  if(!sections.length)return;
  const line=categoryStickyOffset()+20;
  let current='All';
  for(const section of sections){
    if(section.getBoundingClientRect().top<=line)current=section.dataset.category;
    else break;
  }
  const firstTop=sections[0].getBoundingClientRect().top;
  if(firstTop>line+35)current='All';
  if(current!==activeCategory)setActiveCategory(current,true);
}
function bindCategoryScrollSpy(){
  if(window.__platecropCategoryScrollSpy)return;
  window.__platecropCategoryScrollSpy=true;
  window.addEventListener('scroll',()=>{
    if(categoryScrollRaf)return;
    categoryScrollRaf=requestAnimationFrame(updateActiveCategoryFromScroll);
  },{passive:true});
  window.addEventListener('resize',()=>{
    if(categoryScrollRaf)return;
    categoryScrollRaf=requestAnimationFrame(updateActiveCategoryFromScroll);
  });
}
function renderFilters(){
  const cats=['All',...menuCategories()];
  $('#filters').innerHTML=cats.map((c,idx)=>`<button class="filter-btn ${activeCategory===c?'active':''}" data-cat="${esc(c)}">${idx===0?ui[lang].all:esc(c)}</button>`).join('');
  $$('.filter-btn').forEach(b=>b.onclick=()=>scrollToMenuCategory(b.dataset.cat));
  bindCategoryScrollSpy();
}
function dishCardMarkup(i){
  const t=tItem(i);
  const cardVisual=resolvedDishVisual(i,'card');
  const visual=cardVisual==='3d'
    ? `<model-viewer src="${esc(i.model_url)}" camera-orbit="25deg 70deg auto" field-of-view="30deg" auto-rotate interaction-prompt="none" shadow-intensity="1" environment-image="neutral"></model-viewer>`
    : (cardVisual==='photo'?`<img src="${esc(i.photo_url)}" alt="${esc(t.name)}">`:'<div class="empty-visual">No preview</div>');
  const hasAr=!!i.model_url;
  return `<article class="menu-card ${i.available?'':'unavailable'}" data-id="${i.id}" tabindex="0" aria-label="${esc(t.name)}">
    <div class="model-preview">${visual}${hasAr?`<span class="view-pill">↻ ${ui[lang].view3d}</span>`:''}</div>
    <div class="card-copy">
      <div class="card-top"><h3>${esc(t.name)}</h3><span class="price">${ARAPP.money(i.price,restaurant.currency)}</span></div>
      ${t.description?`<p>${esc(t.description)}</p>`:''}
      <div class="tags">${(i.tags||[]).slice(0,2).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}${!i.available?`<span class="tag warning">${ui[lang].unavailable}</span>`:''}</div>
    </div>
  </article>`;
}
function renderMenu(){
  const visible=items.filter(i=>i.published);
  const categories=menuCategories();
  const menu=$('#menuGrid');
  if(!visible.length){menu.innerHTML='<div class="menu-empty">No dishes are currently available on this menu.</div>';return;}
  menu.innerHTML=categories.map((category,index)=>{
    const group=visible.filter(i=>(i.category||'Other')===category);
    return `<section class="category-section" data-category="${esc(category)}" data-category-index="${index}">
      <header class="category-heading"><div><span class="category-kicker">${String(index+1).padStart(2,'0')}</span><h2>${esc(category)}</h2></div><span class="category-count">${group.length} ${group.length===1?'item':'items'}</span></header>
      <div class="category-grid">${group.map(dishCardMarkup).join('')}</div>
    </section>`;
  }).join('');
  $$('.menu-card').forEach(c=>{const fn=()=>openDish(c.dataset.id);c.onclick=fn;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}}});
  requestAnimationFrame(updateActiveCategoryFromScroll);
}
function targetWidthCm(item){return Number(item?.translations?._meta?.width_cm)||0}
function showcaseScalePercent(item){
  const raw=Number(item?.translations?._meta?.showcase_scale)||100;
  return Math.max(40,Math.min(250,raw));
}
function applyShowcaseScale(viewer,item){
  if(!viewer)return;
  const factor=showcaseScalePercent(item)/100;
  viewer.scale=`${factor} ${factor} ${factor}`;
  viewer.setAttribute('scale',`${factor} ${factor} ${factor}`);
}
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
  else if(!secure){$('#arCompatibilityNote').textContent='Camera AR needs HTTPS. Open the deployed PlateCrop link on your phone.';}
  else if(viewer.canActivateAR===false){$('#arCompatibilityNote').textContent='3D works here, but this browser does not expose native AR.';}
  else{$('#arCompatibilityNote').textContent='Camera AR will place the dish at its calibrated size on supported phones.';}
}
function openDish(id){
  activeDish=items.find(i=>i.id===id); if(!activeDish)return;
  resetViewerInteraction('dishViewer');
  const t=tItem(activeDish), viewer=$('#dishViewer'), photo=$('#dishPhoto'), wrap=$('#dishViewerWrap');
  const detailVisual=resolvedDishVisual(activeDish,'detail');
  viewer.scale='1 1 1';viewer.setAttribute('scale','1 1 1');viewer.src=activeDish.model_url||'';applyShowcaseScale(viewer,activeDish);
  if(photo){
    photo.src=activeDish.photo_url||'';
    photo.alt=t.name||'Dish photo';
  }
  wrap?.classList.toggle('photo-mode',detailVisual==='photo');
  wrap?.classList.toggle('empty-mode',detailVisual==='none');
  const gate=wrap?.querySelector('.viewer-activation');
  const lock=wrap?.querySelector('.viewer-lock');
  if(gate)gate.classList.toggle('hidden',detailVisual!=='3d');
  if(lock&&detailVisual!=='3d')lock.classList.add('hidden');
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
  const button=$('#mobileArTrigger'), viewer=$('#dishViewer'); button.classList.add('loading');
  try{
    // The normal 3D preview has its own visual scale. Only switch to the
    // real-world calibration immediately before entering camera AR.
    applyRealScale(viewer,activeDish);
    await ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table'));
    await viewer.activateAR();
  }catch(e){alert('AR could not start. Try opening PlateCrop in Chrome on Android or Safari on iPhone.');}
  finally{applyShowcaseScale(viewer,activeDish);button.classList.remove('loading')}
}
function closeDish(){if($('#dishDialog').open)$('#dishDialog').close();document.body.classList.remove('dialog-open')}
async function boot(){
  const demo=params.get('demo')==='1';
  const slug=params.get('r')||'maison-table';
  const result=demo?{restaurant:ARAPP.demoRestaurant,items:ARAPP.demoItems}:await ARAPP.getPublicRestaurant(slug);
  if(!result){document.body.innerHTML='<main style="padding:10vw;font-family:system-ui"><h1>Menu unavailable</h1><p>This restaurant is not published or the link is incorrect.</p></main>';return;}
  restaurant=result.restaurant; items=result.items;
  lang=params.get('lang')||restaurant.default_language||'en'; if(!ui[lang])lang='en';
  applyMenuTheme();applyBrand();setHero();renderFilters();renderMenu();setupViewerGates();
  await ARAPP.track(restaurant.id,'menu_view',null,params.get('table'));
}
$('#closeDialog').onclick=closeDish;
$('#dishDialog').addEventListener('click',e=>{if(e.target===$('#dishDialog'))closeDish()});
$('#dishDialog').addEventListener('close',()=>document.body.classList.remove('dialog-open'));
$('#demoArBtn').onclick=()=>{const i=heroItem()||items.find(x=>x.available&&x.model_url);if(i)openDish(i.id)};
$('#mobileArTrigger').onclick=launchAR;
$('#dishViewer').addEventListener('load',()=>{if(activeDish){applyShowcaseScale($('#dishViewer'),activeDish);updateArCapability()}});
$('#arSlotBtn').onclick=()=>{if(activeDish){applyRealScale($('#dishViewer'),activeDish);ARAPP.track(restaurant.id,'ar_launch',activeDish.id,params.get('table'))}};
$('#dishViewer').addEventListener('ar-status',e=>{if(activeDish&&['not-presenting','failed'].includes(e.detail?.status))applyShowcaseScale($('#dishViewer'),activeDish)});

$('#langSelect').onchange=()=>{lang=$('#langSelect').value;activeCategory='All';applyBrand();renderFilters();renderMenu()};
boot().catch(e=>{console.error(e);document.body.innerHTML=`<main style="padding:10vw;font-family:system-ui"><h1>Could not load menu</h1><p>${esc(e.message)}</p></main>`});
