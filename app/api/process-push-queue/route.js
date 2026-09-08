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

async function claimNextItem(supabase){
  const {data,error}=await supabase.rpc(
    'claim_push_queue_item',
    {p_id:null}
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

    return {sent:0,failed:1,skipped:0}
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

    return {sent:0,failed:0,skipped:1}
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

    return {sent:1,failed:0,skipped:0}
  }

  await supabase
    .from('push_queue')
    .update({
      status:'pending',
      processing_at:null,
      last_error:lastError||'No push delivered'
    })
    .eq('id',item.id)

  return {sent:0,failed:1,skipped:0}
}

async function processQueue(request){
  if(!isAuthorized(request)){
    return Response.json(
      {error:'Unauthorized'},
      {status:401}
    )
  }

  configureWebPush()

  const supabase=adminClient()

  let processed=0
  let sent=0
  let failed=0
  let skipped=0

  // Backup/retry worker. Realtime delivery is handled by /api/push/immediate.
  // This loop also reclaims stale "processing" rows after 2 minutes via the RPC.
  for(let i=0;i<50;i+=1){
    const item=await claimNextItem(supabase)

    if(!item){
      break
    }

    processed+=1

    const result=await deliverItem(
      supabase,
      item
    )

    sent+=result.sent||0
    failed+=result.failed||0
    skipped+=result.skipped||0
  }

  return Response.json({
    ok:true,
    processed,
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
      {error:error?.message||'Push queue failed'},
      {status:500}
    )
  }
}

export async function POST(request){
  return GET(request)
}
