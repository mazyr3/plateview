import {getUser,parseJson,send,method,errorResponse} from '../server/lib.js';

export default async function handler(req,res){
  if(!method(req,res,['POST']))return;
  try{
    const {user,admin}=await getUser(req);
    const {data:me,error:meError}=await admin.from('profiles').select('role').eq('user_id',user.id).maybeSingle();
    if(meError)throw meError;
    if(me?.role!=='admin')throw Object.assign(new Error('Admin access required.'),{status:403});

    const body=await parseJson(req);
    const targetUserId=String(body.user_id||'');
    const action=String(body.action||'');
    if(!targetUserId)throw Object.assign(new Error('Missing user_id.'),{status:400});
    if(targetUserId===user.id)throw Object.assign(new Error('You cannot suspend your own admin account.'),{status:400});
    if(!['suspend','restore'].includes(action))throw Object.assign(new Error('Unknown action.'),{status:400});

    const now=new Date().toISOString();

    if(action==='suspend'){
      const {error:profileError}=await admin.from('profiles').update({account_status:'suspended',updated_at:now}).eq('user_id',targetUserId);
      if(profileError)throw profileError;

      const {data:restaurants,error:restaurantsError}=await admin.from('restaurants')
        .select('id,published,menu_theme')
        .eq('owner_id',targetUserId);
      if(restaurantsError)throw restaurantsError;

      for(const r of restaurants||[]){
        const theme={...(r.menu_theme||{})};
        if(r.published!==false)theme._published_before_admin_suspend=true;
        theme._suspended_by_admin=true;
        const {error}=await admin.from('restaurants').update({published:false,menu_theme:theme,updated_at:now}).eq('id',r.id);
        if(error)throw error;
      }

      return send(res,200,{ok:true,account_status:'suspended',menus_suspended:(restaurants||[]).length});
    }

    const {error:profileError}=await admin.from('profiles').update({account_status:'active',updated_at:now}).eq('user_id',targetUserId);
    if(profileError)throw profileError;

    const {data:restaurants,error:restaurantsError}=await admin.from('restaurants')
      .select('id,published,menu_theme')
      .eq('owner_id',targetUserId);
    if(restaurantsError)throw restaurantsError;

    let restored=0;
    for(const r of restaurants||[]){
      const theme={...(r.menu_theme||{})};
      const shouldRepublish=theme._suspended_by_admin===true && theme._published_before_admin_suspend===true;
      delete theme._suspended_by_admin;
      delete theme._published_before_admin_suspend;
      const {error}=await admin.from('restaurants').update({published:shouldRepublish?true:r.published,menu_theme:theme,updated_at:now}).eq('id',r.id);
      if(error)throw error;
      if(shouldRepublish)restored++;
    }

    return send(res,200,{ok:true,account_status:'active',menus_restored:restored});
  }catch(e){errorResponse(res,e)}
}
