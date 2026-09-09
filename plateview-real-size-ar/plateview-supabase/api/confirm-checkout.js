import {getUser,stripeClient,syncSubscription,parseJson,send,method,errorResponse} from '../server/lib.js';
export default async function handler(req,res){
  if(!method(req,res,['POST']))return;
  try{
    const {user,admin}=await getUser(req);
    const body=await parseJson(req);
    const sessionId=String(body.session_id||'');
    if(!sessionId)throw Object.assign(new Error('Missing checkout session.'),{status:400});
    const stripe=stripeClient();
    const session=await stripe.checkout.sessions.retrieve(sessionId,{expand:['subscription']});
    if(session.client_reference_id!==user.id&&session.metadata?.user_id!==user.id)throw Object.assign(new Error('This checkout session does not belong to your account.'),{status:403});
    let sub=session.subscription;
    if(typeof sub==='string')sub=await stripe.subscriptions.retrieve(sub);
    if(!sub)throw Object.assign(new Error('Stripe has not created the subscription yet.'),{status:409});
    await syncSubscription(admin,sub,user.id);
    send(res,200,{ok:true,status:sub.status});
  }catch(e){errorResponse(res,e)}
}
