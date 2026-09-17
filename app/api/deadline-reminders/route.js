import {createClient} from '@supabase/supabase-js'

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
    {auth:{persistSession:false,autoRefreshToken:false}}
  )
}

export async function GET(request){
  if(!isAuthorized(request)){
    return Response.json({error:'Unauthorized'},{status:401})
  }

  try{
    const supabase=adminClient()
    const {data,error}=await supabase.rpc('run_task_deadline_reminders_v1814')
    if(error) throw error
    return Response.json({ok:true,notifications_created:Number(data||0)})
  }catch(error){
    console.error('deadline reminder error',error)
    return Response.json({error:error.message||'Deadline reminder failed'},{status:500})
  }
}

export async function POST(request){
  return GET(request)
}
