import {requireAdmin,send,method,errorResponse} from '../server/lib.js';
export default async function handler(req,res){
  if(!method(req,res,['GET']))return;
  try{
    const {admin}=await requireAdmin(req);
    const [profilesQ,subsQ,restaurantsQ,menuViewsQ,dishViewsQ,arQ]=await Promise.all([
      admin.from('profiles').select('user_id,email,role,account_status,created_at'),
      admin.from('subscriptions').select('*'),
      admin.from('restaurants').select('id,owner_id,name,slug,published,created_at'),
      admin.from('analytics_events').select('*',{count:'exact',head:true}).eq('event_type','menu_view'),
      admin.from('analytics_events').select('*',{count:'exact',head:true}).eq('event_type','dish_view'),
      admin.from('analytics_events').select('*',{count:'exact',head:true}).eq('event_type','ar_launch')
    ]);
    for(const q of [profilesQ,subsQ,restaurantsQ,menuViewsQ,dishViewsQ,arQ])if(q.error)throw q.error;
    const profiles=profilesQ.data||[],subs=subsQ.data||[],restaurants=restaurantsQ.data||[];
    const subMap=new Map(subs.map(x=>[x.user_id,x]));
    const restByOwner=new Map();restaurants.forEach(r=>{if(!restByOwner.has(r.owner_id))restByOwner.set(r.owner_id,[]);restByOwner.get(r.owner_id).push(r)});
    const accounts=profiles.map(p=>({user_id:p.user_id,email:p.email,role:p.role,account_status:p.account_status,created_at:p.created_at,subscription:subMap.get(p.user_id)||null,restaurants:restByOwner.get(p.user_id)||[]}));
    const activeSubs=subs.filter(s=>['active','trialing'].includes(s.status));
    let mrrCents=0;for(const s of activeSubs){const amount=Number(s.unit_amount)||0;if(s.interval==='year')mrrCents+=amount/12;else if(s.interval==='week')mrrCents+=amount*52/12;else mrrCents+=amount}
    send(res,200,{totals:{accounts:accounts.length,restaurants:restaurants.length,active_subscriptions:activeSubs.length,mrr_cents:Math.round(mrrCents),menu_views:menuViewsQ.count||0,dish_views:dishViewsQ.count||0,ar_launches:arQ.count||0},accounts});
  }catch(e){errorResponse(res,e)}
}
