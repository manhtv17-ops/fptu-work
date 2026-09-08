import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'

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

function bearerToken(request){
  const value=request.headers.get('authorization')||''

  if(!value.startsWith('Bearer ')){
    return null
  }

  return value.slice(7).trim()
}

export async function POST(request){
  try{
    const token=bearerToken(request)

    if(!token){
      return Response.json(
        {error:'Unauthorized'},
        {status:401}
      )
    }

    const supabase=adminClient()

    const {
      data:{user},
      error:userError
    }=await supabase.auth.getUser(token)

    if(userError||!user){
      return Response.json(
        {error:'Unauthorized'},
        {status:401}
      )
    }

    const body=await request.json()
    const endpoint=body?.endpoint
    const p256dh=body?.keys?.p256dh
    const auth=body?.keys?.auth

    if(!endpoint||!p256dh||!auth){
      return Response.json(
        {error:'Push subscription không hợp lệ'},
        {status:400}
      )
    }

    const {error}=await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id:user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:
            request.headers.get('user-agent')||null,
          disabled_at:null,
          updated_at:new Date().toISOString()
        },
        {
          onConflict:'endpoint'
        }
      )

    if(error){
      throw error
    }

    return Response.json({ok:true})

  }catch(error){
    console.error('push subscribe error',error)

    return Response.json(
      {
        error:error.message||'Không lưu được push subscription'
      },
      {status:500}
    )
  }
}

export async function DELETE(request){
  try{
    const token=bearerToken(request)

    if(!token){
      return Response.json(
        {error:'Unauthorized'},
        {status:401}
      )
    }

    const supabase=adminClient()

    const {
      data:{user},
      error:userError
    }=await supabase.auth.getUser(token)

    if(userError||!user){
      return Response.json(
        {error:'Unauthorized'},
        {status:401}
      )
    }

    const body=await request.json()
    const endpoint=body?.endpoint

    if(!endpoint){
      return Response.json(
        {error:'Thiếu endpoint'},
        {status:400}
      )
    }

    const {error}=await supabase
      .from('push_subscriptions')
      .update({
        disabled_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      })
      .eq('user_id',user.id)
      .eq('endpoint',endpoint)

    if(error){
      throw error
    }

    return Response.json({ok:true})

  }catch(error){
    console.error('push unsubscribe error',error)

    return Response.json(
      {
        error:error.message||'Không tắt được push subscription'
      },
      {status:500}
    )
  }
}
