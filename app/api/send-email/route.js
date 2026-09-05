import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function htmlEscape(v='') {
  return String(v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))
}

function renderEmail(row) {
  const p = row.payload || {}
  const title = p.title || p.task_title || 'FPTU Work'
  const subject = p.subject || `[FPTU Work] ${title}`
  const body = p.body || p.message || 'Bạn có cập nhật mới trên FPTU Work.'
  const url = p.url || p.task_url || process.env.NEXT_PUBLIC_APP_URL || 'https://fptu-work.vercel.app'
  const html = p.html || `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2329;line-height:1.55"><div style="max-width:620px;margin:auto;padding:28px"><div style="font-size:20px;font-weight:700;margin-bottom:18px">FPTU Work</div><h2 style="margin:0 0 12px">${htmlEscape(title)}</h2><p>${htmlEscape(body)}</p><p><a href="${htmlEscape(url)}" style="display:inline-block;background:#f37021;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px">Mở FPTU Work</a></p></div></body></html>`
  return { subject, html }
}

async function handle(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization') || ''
    const vercelCron = request.headers.get('x-vercel-cron')
    if (!vercelCron && auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!url || !serviceKey || !resendKey || !from) {
    return Response.json({ error: 'Missing email environment variables' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: rows, error } = await admin.from('email_queue').select('*').eq('status','pending').order('created_at',{ascending:true}).limit(20)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = []
  for (const row of rows || []) {
    try {
      const { subject, html } = renderEmail(row)
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient], subject, html })
      })
      const body = await r.json().catch(()=>({}))
      if (!r.ok) throw new Error(body?.message || `Resend ${r.status}`)
      await admin.from('email_queue').update({ status:'sent', sent_at:new Date().toISOString(), last_error:null }).eq('id',row.id)
      result.push({ id: row.id, status:'sent' })
    } catch (e) {
      await admin.from('email_queue').update({ status:'pending', retry_count:(row.retry_count||0)+1, last_error:String(e.message||e) }).eq('id',row.id)
      result.push({ id: row.id, status:'error', error:String(e.message||e) })
    }
  }
  return Response.json({ processed: result.length, result })
}

export async function GET(request){ return handle(request) }
export async function POST(request){ return handle(request) }
