
const ARAPP = (() => {
  const cfg = window.PLATEVIEW_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_PUBLISHABLE_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") &&
    !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

  const supabase = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const allergens = ['Gluten','Crustaceans','Eggs','Fish','Peanuts','Soy','Milk','Nuts','Celery','Mustard','Sesame','Sulphites','Lupin','Molluscs'];

  const demoRestaurant = {
    id: 'demo',
    owner_id: null,
    name: 'Maison Table',
    slug: 'maison-table',
    tagline: 'See your dish before it arrives.',
    currency: 'EUR',
    published: true,
    accent: '#b7482d',
    languages: ['en','nl','fr'],
    default_language: 'en',
    tables: 12,
    logo_url:'',
    hero_image_url:'',
    hero_mode:'3d',
    menu_theme:{}
  };

  const demoItems = [
    {id:'signature-burger',restaurant_id:'demo',category:'Mains',price:19.5,available:true,published:true,model_url:'assets/models/burger.glb',photo_url:'',allergens:['Gluten','Milk','Eggs'],tags:['Popular'],sort_order:0,translations:{
      en:{name:'Signature Burger',description:'Dry-aged beef, smoked cheddar, pickles, lettuce and house sauce on a toasted brioche bun.'},
      nl:{name:'Signature Burger',description:'Dry-aged rundvlees, gerookte cheddar, augurk, sla en huisgemaakte saus op een geroosterd briochebroodje.'},
      fr:{name:'Signature Burger',description:'Bœuf maturé, cheddar fumé, cornichons, salade et sauce maison sur un pain brioché grillé.'}
    }},
    {id:'truffle-pizza',restaurant_id:'demo',category:'Mains',price:18,available:true,published:true,model_url:'assets/models/pizza.glb',photo_url:'',allergens:['Gluten','Milk'],tags:['Vegetarian'],sort_order:1,translations:{
      en:{name:'Truffle Pizza',description:'Slow-fermented dough, tomato, fior di latte, roasted mushroom and truffle finish.'},
      nl:{name:'Truffelpizza',description:'Langzaam gerezen deeg, tomaat, fior di latte, geroosterde champignons en truffel.'},
      fr:{name:'Pizza à la truffe',description:'Pâte fermentée lentement, tomate, fior di latte, champignons rôtis et finition à la truffe.'}
    }},
    {id:'salmon-sushi',restaurant_id:'demo',category:'Starters',price:14,available:true,published:true,model_url:'assets/models/sushi.glb',photo_url:'',allergens:['Fish','Soy'],tags:['Fresh'],sort_order:2,translations:{
      en:{name:'Salmon Nigiri',description:'Five pieces of seasoned rice topped with fresh salmon and a delicate citrus-soy glaze.'},
      nl:{name:'Zalm Nigiri',description:'Vijf stukjes gekruide rijst met verse zalm en een lichte citrus-sojaglazuur.'},
      fr:{name:'Nigiri au saumon',description:'Cinq bouchées de riz assaisonné, saumon frais et glaçage soja-agrumes.'}
    }}
  ];

  const slugify = s => (s || 'restaurant')
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  const money = (v, currency='EUR') =>
    new Intl.NumberFormat('en-BE',{style:'currency',currency}).format(Number(v)||0);

  async function session() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async function signIn(email,password){
    if(!supabase) throw new Error('Supabase is not configured.');
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    return data;
  }

  async function signUp(email,password,redirectTo=null){
    if(!supabase) throw new Error('Supabase is not configured.');
    const emailRedirectTo=redirectTo||(typeof location!=='undefined'?`${location.origin}/auth.html?mode=login`:undefined);
    const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo}});
    if(error) throw error;
    return data;
  }

  async function signOut(){
    if(!supabase) return;
    const {error}=await supabase.auth.signOut();
    if(error) throw error;
  }

  async function restaurantsForOwner(){
    if(!supabase) return [];
    const s=await session(); if(!s) return [];
    const {data,error}=await supabase.from('restaurants').select('*').eq('owner_id',s.user.id).order('created_at');
    if(error) throw error;
    return data || [];
  }

  async function createRestaurant(input){
    if(!supabase) throw new Error('Supabase is not configured.');
    const s = await session();
    if(!s) throw new Error('Please sign in first.');
    const row = {
      owner_id:s.user.id,
      name:input.name || 'My Restaurant',
      slug:slugify(input.slug || input.name || 'my-restaurant'),
      tagline:input.tagline || 'Explore our menu in 3D and AR.',
      currency:'EUR',
      published:false,
      accent:input.accent || '#b7482d',
      languages:['en','nl','fr'],
      default_language:'en',
      tables:10,
      logo_url:'',
      hero_image_url:'',
      hero_mode:'3d',
      menu_theme:input.menu_theme || {}
    };
    const {data,error}=await supabase.from('restaurants').insert(row).select().single();
    if(error) throw error;
    return data;
  }

  async function updateRestaurant(id,patch){
    const {data,error}=await supabase.from('restaurants').update(patch).eq('id',id).select().single();
    if(error) throw error;
    return data;
  }

  async function getPublicRestaurant(slug){
    if(!supabase){
      if(!slug || slug===demoRestaurant.slug) return {restaurant:demoRestaurant,items:demoItems};
      return null;
    }
    const {data:restaurant,error}=await supabase
      .from('restaurants')
      .select('*')
      .eq('slug',slug)
      .eq('published',true)
      .maybeSingle();
    if(error) throw error;
    if(!restaurant) return null;
    const {data:items,error:itemError}=await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id',restaurant.id)
      .eq('published',true)
      .order('sort_order');
    if(itemError) throw itemError;
    return {restaurant,items:items||[]};
  }

  async function getOwnerRestaurant(id){
    if(!supabase) return null;
    const {data:restaurant,error}=await supabase.from('restaurants').select('*').eq('id',id).single();
    if(error) throw error;
    const {data:items,error:itemError}=await supabase.from('menu_items').select('*').eq('restaurant_id',id).order('sort_order');
    if(itemError) throw itemError;
    return {restaurant,items:items||[]};
  }

  async function saveMenuItem(item){
    const payload = {
      restaurant_id:item.restaurant_id,
      category:item.category || '',
      price:Number(item.price)||0,
      available:item.available !== false,
      published:item.published !== false,
      model_url:item.model_url || '',
      photo_url:item.photo_url || '',
      allergens:item.allergens || [],
      tags:item.tags || [],
      translations:item.translations || {},
      sort_order:Number(item.sort_order)||0
    };
    if(item.id){
      const {data,error}=await supabase.from('menu_items').update(payload).eq('id',item.id).select().single();
      if(error) throw error; return data;
    }
    const {data,error}=await supabase.from('menu_items').insert(payload).select().single();
    if(error) throw error; return data;
  }

  async function deleteMenuItem(id){
    const {error}=await supabase.from('menu_items').delete().eq('id',id);
    if(error) throw error;
  }

  function safeName(name){
    const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
    return `${crypto.randomUUID()}.${ext}`;
  }

  async function uploadAsset(file,restaurantId,kind='asset'){
    if(!supabase) throw new Error('Supabase is not configured.');
    const s=await session(); if(!s) throw new Error('Please sign in.');
    const path=`${s.user.id}/${restaurantId}/${kind}/${safeName(file.name)}`;
    const {error}=await supabase.storage.from(cfg.ASSET_BUCKET||'menu-assets').upload(path,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:file.type || undefined
    });
    if(error) throw error;
    const {data}=supabase.storage.from(cfg.ASSET_BUCKET||'menu-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function track(restaurantId,eventType,itemId=null,tableNumber=null){
    if(!supabase || !restaurantId || restaurantId==='demo') return;
    const key=`pv_session_${restaurantId}`;
    let sid=sessionStorage.getItem(key);
    if(!sid){sid=crypto.randomUUID();sessionStorage.setItem(key,sid);}
    try{
      await supabase.from('analytics_events').insert({
        restaurant_id:restaurantId,
        menu_item_id:itemId || null,
        event_type:eventType,
        session_id:sid,
        table_number:tableNumber ? Number(tableNumber) : null
      });
    }catch(e){ console.warn('Analytics event not recorded',e); }
  }

  async function analytics(restaurantId){
    if(!supabase) return {menu_view:0,dish_view:0,ar_launch:0,unique_sessions:0,by_table:[],by_item:[]};
    const {data,error}=await supabase.from('analytics_events').select('event_type,table_number,menu_item_id,session_id,created_at').eq('restaurant_id',restaurantId);
    if(error) throw error;
    const counts={menu_view:0,dish_view:0,ar_launch:0,unique_sessions:0,by_table:[],by_item:[]},tableMap=new Map(),itemMap=new Map(),sessions=new Set();
    (data||[]).forEach(x=>{
      if(counts[x.event_type]!==undefined) counts[x.event_type]++;
      if(x.session_id)sessions.add(x.session_id);
      if(x.table_number){
        if(!tableMap.has(x.table_number))tableMap.set(x.table_number,{table:x.table_number,menu_view:0,dish_view:0,ar_launch:0});
        const row=tableMap.get(x.table_number);if(row[x.event_type]!==undefined)row[x.event_type]++;
      }
      if(x.menu_item_id){
        if(!itemMap.has(x.menu_item_id))itemMap.set(x.menu_item_id,{item_id:x.menu_item_id,dish_view:0,ar_launch:0});
        const row=itemMap.get(x.menu_item_id);if(row[x.event_type]!==undefined)row[x.event_type]++;
      }
    });
    counts.unique_sessions=sessions.size;
    counts.by_table=[...tableMap.values()].sort((a,b)=>a.table-b.table);
    counts.by_item=[...itemMap.values()];
    return counts;
  }

  async function profile(){
    if(!supabase) return null;
    const s=await session(); if(!s) return null;
    const {data,error}=await supabase.from('profiles').select('*').eq('user_id',s.user.id).maybeSingle();
    if(error){
      // Backwards-compatible while the SaaS upgrade SQL has not been run yet.
      if(String(error.message||'').toLowerCase().includes('profiles')) return null;
      throw error;
    }
    return data;
  }

  async function subscription(){
    if(!supabase) return null;
    const s=await session(); if(!s) return null;
    const {data,error}=await supabase.from('subscriptions').select('*').eq('user_id',s.user.id).maybeSingle();
    if(error){
      if(String(error.message||'').toLowerCase().includes('subscriptions')) return null;
      throw error;
    }
    return data;
  }

  async function accountAccess(){
    const s=await session();
    if(!s) return {signedIn:false,allowed:false,reason:'signed_out',profile:null,subscription:null};
    let p=null,sub=null;
    try{[p,sub]=await Promise.all([profile(),subscription()]);}catch(e){console.warn('Account access lookup failed',e)}
    // If the SaaS tables are not installed yet, preserve the old dashboard instead of locking the owner out.
    if(!p && !sub) return {signedIn:true,allowed:true,reason:'legacy_schema',profile:null,subscription:{status:'legacy',plan:'legacy'}};
    const role=p?.role||'customer';
    const accountStatus=p?.account_status||'active';
    const status=sub?.status||'inactive';
    const billingOk=['active','trialing','legacy'].includes(status);
    const allowed=role==='admin'||(accountStatus==='active'&&billingOk);
    return {signedIn:true,allowed,reason:accountStatus==='suspended'?'suspended':(billingOk?'ok':'subscription_required'),profile:p,subscription:sub};
  }

  async function apiWithAuth(path,options={}){
    const s=await session(); if(!s) throw new Error('Please sign in first.');
    const headers={...(options.headers||{}),Authorization:`Bearer ${s.access_token}`};
    if(options.body && !headers['Content-Type']) headers['Content-Type']='application/json';
    const res=await fetch(path,{...options,headers});
    let data={}; try{data=await res.json()}catch(e){}
    if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
    return data;
  }

  return {
    configured,supabase,allergens,slugify,money,session,signIn,signUp,signOut,
    restaurantsForOwner,createRestaurant,updateRestaurant,getPublicRestaurant,getOwnerRestaurant,
    saveMenuItem,deleteMenuItem,uploadAsset,track,analytics,profile,subscription,accountAccess,apiWithAuth,demoRestaurant,demoItems
  };
})();
