import {createClient} from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime='nodejs'
export const dynamic='force-dynamic'

function isAuthorized(request){
  const value=request.headers.get('authorization')||''
  return value===`Bearer ${process.env.CRON_SECRET}`
}

function adminClient(){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth:{
        persistSession:false,
        autoRefreshToken:false
      }
    }
  )
}

function pushUrl(item){
  const params=new URLSearchParams()

  if(item.project_id){
    params.set('project',item.project_id)
  }

  if(item.task_id){
    params.set('task',item.task_id)
  }

  if(item.comment_id){
    params.set('comment',item.comment_id)
  }

  const query=params.toString()
  return query?`/?${query}`:'/'
}

async function processQueue(request){
  if(!isAuthorized(request)){
    return Response.json(
      {error:'Unauthorized'},
      {status:401}
    )
  }

  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey=process.env.VAPID_PRIVATE_KEY
  const subject=process.env.VAPID_SUBJECT||'mailto:daihoc.hcm@fpt.edu.vn'

  if(!publicKey||!privateKey){
    return Response.json(
      {error:'Missing VAPID keys'},
      {status:500}
    )
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  )

  const supabase=adminClient()

  const {data:queue,error:queueError}=await supabase
    .from('push_queue')
    .select('*')
    .eq('status','pending')
    .order('created_at',{ascending:true})
    .limit(50)

  if(queueError){
    throw queueError
  }

  let sent=0
  let failed=0
  let skipped=0

  for(const item of queue||[]){
    const {data:subscriptions,error:subError}=await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id',item.user_id)
      .is('disabled_at',null)

    if(subError){
      await supabase
        .from('push_queue')
        .update({
          status:'failed',
          attempts:(item.attempts||0)+1,
          last_error:subError.message
        })
        .eq('id',item.id)

      failed+=1
      continue
    }

    if(!subscriptions?.length){
      await supabase
        .from('push_queue')
        .update({
          status:'skipped',
          attempts:(item.attempts||0)+1,
          last_error:'No active push subscription'
        })
        .eq('id',item.id)

      skipped+=1
      continue
    }

    const payload=JSON.stringify({
      title:item.title||'FPTU MKT Work',
      body:item.body||'Bạn có cập nhật mới.',
      url:pushUrl(item),
      tag:`fptu-work-${item.notification_id||item.id}`,
      type:item.type||'notification'
    })

    let delivered=0
    let lastError=null

    for(const subscription of subscriptions){
      try{
        await webpush.sendNotification(
          {
            endpoint:subscription.endpoint,
            keys:{
              p256dh:subscription.p256dh,
              auth:subscription.auth
            }
          },
          payload,
          {
            TTL:60*60*24
          }
        )

        delivered+=1

      }catch(error){
        lastError=error?.message||'Push send failed'

        if(
          error?.statusCode===404
          ||
          error?.statusCode===410
        ){
          await supabase
            .from('push_subscriptions')
            .update({
              disabled_at:new Date().toISOString(),
              updated_at:new Date().toISOString()
            })
            .eq('id',subscription.id)
        }
      }
    }

    if(delivered>0){
      await supabase
        .from('push_queue')
        .update({
          status:'sent',
          attempts:(item.attempts||0)+1,
          last_error:null,
          sent_at:new Date().toISOString()
        })
        .eq('id',item.id)

      sent+=1

    }else{
      await supabase
        .from('push_queue')
        .update({
          status:'failed',
          attempts:(item.attempts||0)+1,
          last_error:lastError||'No push delivered'
        })
        .eq('id',item.id)

      failed+=1
    }
  }

  return Response.json({
    ok:true,
    processed:(queue||[]).length,
    sent,
    failed,
    skipped
  })
}

export async function GET(request){
  try{
    return await processQueue(request)
  }catch(error){
    console.error('push queue error',error)
    return Response.json(
      {error:error.message||'Push queue failed'},
      {status:500}
    )
  }
}

export async function POST(request){
  return GET(request)
}
