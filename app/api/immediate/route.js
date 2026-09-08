import {createClient} from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime='nodejs'
export const dynamic='force-dynamic'

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

function configureWebPush(){
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey=process.env.VAPID_PRIVATE_KEY
  const subject=process.env.VAPID_SUBJECT||'mailto:daihoc.hcm@fpt.edu.vn'

  if(!publicKey||!privateKey){
    throw new Error('Missing VAPID keys')
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  )
}

async function claimQueueItem(supabase,queueId){
  const {data,error}=await supabase.rpc(
    'claim_push_queue_item',
    {p_id:queueId}
  )

  if(error){
    throw error
  }

  return Array.isArray(data)?data[0]:null
}

async function deliverItem(supabase,item){
  const {data:subscriptions,error:subError}=await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id',item.user_id)
    .is('disabled_at',null)

  if(subError){
    await supabase
      .from('push_queue')
      .update({
        status:'pending',
        processing_at:null,
        last_error:subError.message
      })
      .eq('id',item.id)

    throw subError
  }

  if(!subscriptions?.length){
    await supabase
      .from('push_queue')
      .update({
        status:'skipped',
        processing_at:null,
        last_error:'No active push subscription'
      })
      .eq('id',item.id)

    return {
      sent:0,
      skipped:1,
      failed:0
    }
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
        {TTL:60*60*24}
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
        processing_at:null,
        last_error:null,
        sent_at:new Date().toISOString()
      })
      .eq('id',item.id)

    return {
      sent:1,
      skipped:0,
      failed:0,
      devices:delivered
    }
  }

  await supabase
    .from('push_queue')
    .update({
      status:'pending',
      processing_at:null,
      last_error:lastError||'No push delivered'
    })
    .eq('id',item.id)

  return {
    sent:0,
    skipped:0,
    failed:1
  }
}

export async function POST(request){
  try{
    configureWebPush()

    const payload=await request.json().catch(()=>({}))
    const queueId=payload?.queue_id

    if(!queueId){
      return Response.json(
        {error:'Missing queue_id'},
        {status:400}
      )
    }

    const supabase=adminClient()
    const item=await claimQueueItem(
      supabase,
      queueId
    )

    // Already processed or another worker claimed it.
    // Return 200 so pg_net does not keep retrying the same HTTP call.
    if(!item){
      return Response.json({
        ok:true,
        already_processed:true
      })
    }

    const result=await deliverItem(
      supabase,
      item
    )

    return Response.json({
      ok:true,
      queue_id:queueId,
      ...result
    })

  }catch(error){
    console.error('Immediate push error',error)

    return Response.json(
      {error:error?.message||'Immediate push failed'},
      {status:500}
    )
  }
}

export async function GET(){
  return Response.json({
    ok:true,
    service:'FPTU Work realtime push v18.2'
  })
}
