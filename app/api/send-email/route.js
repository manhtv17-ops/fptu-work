import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'FPTU Work <onboarding@resend.dev>'
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fptu-work.vercel.app'

function renderEmail(template, payload = {}) {
  const task = payload.task_title || 'Công việc'
  const code = payload.task_code ? `${payload.task_code} · ` : ''
  const project = payload.project ? `<p><b>Project:</b> ${payload.project}</p>` : ''
  const deadline = payload.deadline || payload.new_deadline
  const deadlineHtml = deadline ? `<p><b>Deadline:</b> ${new Date(deadline).toLocaleString('vi-VN')}</p>` : ''
  const taskLink = payload.task_id ? `${appUrl}/?task=${encodeURIComponent(payload.task_id)}` : appUrl

  const map = {
    task_assigned: ['Bạn được giao công việc mới', `${code}${task}`],
    task_comment: ['Có phản hồi mới trong công việc', `${payload.actor || 'Một thành viên'} đã bình luận: “${payload.comment || ''}”`],
    review_requested: ['Có công việc đang chờ bạn duyệt', `${code}${task}`],
    review_approved: ['Công việc đã được duyệt', `${code}${task}`],
    changes_requested: ['Công việc cần chỉnh sửa', `${code}${task}`],
    deadline_changed: ['Deadline công việc đã thay đổi', `${code}${task}`],
  }
  const [subject, lead] = map[template] || ['FPTU Work notification', task]
  return {
    subject: `[FPTU Work] ${subject}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px"><h2>${subject}</h2><p>${lead}</p>${project}${deadlineHtml}<p><a href="${taskLink}" style="display:inline-block;padding:10px 16px;background:#ff6b00;color:#fff;text-decoration:none;border-radius:8px">Mở FPTU Work</a></p><p style="color:#777;font-size:12px">Email này được gửi tự động từ FPTU Work.</p></div>`
  }
}

export async function GET(request) {
  const auth = request.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabaseUrl || !serviceRole || !resendKey) {
    return Response.json({ error: 'Missing email environment variables' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
  const { data: jobs, error } = await admin.from('email_queue').select('*').eq('status', 'pending').lt('retry_count', 5).order('created_at').limit(25)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const job of jobs || []) {
    const mail = renderEmail(job.template, job.payload || {})
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: emailFrom, to: [job.recipient], subject: mail.subject, html: mail.html })
      })
      const body = await r.text()
      if (!r.ok) throw new Error(body || `Resend ${r.status}`)
      await admin.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      sent += 1
    } catch (e) {
      await admin.from('email_queue').update({ retry_count: (job.retry_count || 0) + 1, last_error: String(e.message || e) }).eq('id', job.id)
    }
  }
  return Response.json({ ok: true, processed: jobs?.length || 0, sent })
}
