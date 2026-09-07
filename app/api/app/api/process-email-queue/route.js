import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://fptu-work.vercel.app'
  )
}

function buildTaskUrl(payload = {}) {
  const appUrl = getAppUrl()

  const params = new URLSearchParams()

  if (payload.project_id) {
    params.set('project', payload.project_id)
  }

  if (payload.task_id) {
    params.set('task', payload.task_id)
  }

  if (payload.comment_id) {
    params.set('comment', payload.comment_id)
  }

  const query = params.toString()

  return query
    ? `${appUrl}/?${query}`
    : appUrl
}

function getSubject(template, payload = {}) {
  const taskName =
    payload.task_title ||
    payload.task_name ||
    payload.task_code ||
    'công việc'

  switch (template) {
    case 'task_assigned':
      return `Bạn được giao task: ${taskName}`

    case 'review_requested':
      return `Task đang chờ bạn review: ${taskName}`

    case 'review_approved':
      return `Task đã được duyệt: ${taskName}`

    case 'changes_requested':
      return `Task cần chỉnh sửa: ${taskName}`

    case 'mention':
      return `Bạn được nhắc đến trong FPTU Work`

    case 'deadline':
      return `Nhắc deadline: ${taskName}`

    default:
      return `Thông báo mới từ FPTU Work`
  }
}

function getMessage(template, payload = {}) {
  const taskName =
    payload.task_title ||
    payload.task_name ||
    payload.task_code ||
    'công việc'

  const actor =
    payload.actor_name ||
    payload.assigner_name ||
    payload.reviewer_name ||
    ''

  const project =
    payload.project_name ||
    payload.project ||
    ''

  switch (template) {
    case 'task_assigned':
      return actor
        ? `${actor} vừa giao cho bạn task "${taskName}".`
        : `Bạn vừa được giao task "${taskName}".`

    case 'review_requested':
      return `Task "${taskName}" đang chờ bạn review.`

    case 'review_approved':
      return `Task "${taskName}" đã được duyệt.`

    case 'changes_requested':
      return `Task "${taskName}" cần được chỉnh sửa thêm.`

    case 'mention':
      return actor
        ? `${actor} vừa nhắc đến bạn trong một bình luận.`
        : `Bạn vừa được nhắc đến trong một bình luận.`

    case 'deadline':
      return `Task "${taskName}" sắp đến hạn.`

    default:
      return project
        ? `Bạn có thông báo mới trong Project "${project}".`
        : `Bạn có thông báo mới trên FPTU Work.`
  }
}

function buildHtml(template, payload = {}) {
  const subject =
    getSubject(template, payload)

  const message =
    getMessage(template, payload)

  const taskUrl =
    buildTaskUrl(payload)

  const projectName =
    payload.project_name ||
    payload.project ||
    ''

  const taskName =
    payload.task_title ||
    payload.task_name ||
    payload.task_code ||
    ''

  const deadline =
    payload.deadline ||
    payload.due_at ||
    ''

  return `
    <div style="
      font-family:Arial,sans-serif;
      max-width:640px;
      margin:0 auto;
      padding:28px;
      color:#1f2937;
      background:#ffffff;
    ">

      <div style="
        display:inline-block;
        background:#f47721;
        color:#ffffff;
        width:44px;
        height:44px;
        line-height:44px;
        text-align:center;
        border-radius:10px;
        font-size:22px;
        font-weight:700;
      ">
        F
      </div>

      <div style="
        font-size:20px;
        font-weight:700;
        margin-top:10px;
      ">
        FPTU Work
      </div>

      <div style="
        color:#6b7280;
        font-size:13px;
        margin-bottom:28px;
      ">
        Project Workspace
      </div>

      <h2 style="
        font-size:21px;
        margin:0 0 14px;
      ">
        ${subject}
      </h2>

      <p style="
        font-size:15px;
        line-height:1.6;
      ">
        ${message}
      </p>

      ${
        projectName
          ? `
            <div style="
              margin-top:18px;
              padding:14px;
              background:#f9fafb;
              border-radius:8px;
            ">
              <b>Project:</b>
              ${projectName}
            </div>
          `
          : ''
      }

      ${
        taskName
          ? `
            <div style="
              margin-top:8px;
              padding:14px;
              background:#f9fafb;
              border-radius:8px;
            ">
              <b>Task:</b>
              ${taskName}
            </div>
          `
          : ''
      }

      ${
        deadline
          ? `
            <div style="
              margin-top:8px;
              padding:14px;
              background:#f9fafb;
              border-radius:8px;
            ">
              <b>Deadline:</b>
              ${deadline}
            </div>
          `
          : ''
      }

      <div style="
        margin-top:24px;
      ">
        <a
          href="${taskUrl}"
          style="
            display:inline-block;
            background:#f47721;
            color:#ffffff;
            text-decoration:none;
            padding:12px 20px;
            border-radius:8px;
            font-weight:600;
          "
        >
          Mở task
        </a>
      </div>

      <div style="
        margin-top:28px;
        padding-top:16px;
        border-top:1px solid #e5e7eb;
        color:#9ca3af;
        font-size:12px;
      ">
        Email tự động từ FPTU Work
      </div>

    </div>
  `
}

async function processQueue() {
  const supabaseAdmin =
    getSupabaseAdmin()

  const appUrl =
    getAppUrl()

  const {
    data:queue,
    error
  } = await supabaseAdmin
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', {
      ascending: true
    })
    .limit(20)

  if (error) {
    throw new Error(
      `Không đọc được email_queue: ${error.message}`
    )
  }

  if (!queue?.length) {
    return {
      success: true,
      processed: 0,
      sent: 0,
      failed: 0,
      message: 'Không có email pending'
    }
  }

  let sent = 0
  let failed = 0

  const results = []

  for (const item of queue) {
    try {
      const payload =
        item.payload || {}

      const subject =
        getSubject(
          item.template,
          payload
        )

      const taskUrl =
        buildTaskUrl(payload)

      const response =
        await fetch(
          `${appUrl}/api/send-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              to:
                item.recipient,

              subject,

              text:
                getMessage(
                  item.template,
                  payload
                ),

              html:
                buildHtml(
                  item.template,
                  payload
                ),

              taskUrl
            })
          }
        )

      const result =
        await response.json()

      if (
        response.ok &&
        result.success
      ) {
        await supabaseAdmin
          .from('email_queue')
          .update({
            status: 'sent'
          })
          .eq(
            'id',
            item.id
          )

        sent++

        results.push({
          id: item.id,
          recipient:
            item.recipient,
          success: true
        })

      } else {
        await supabaseAdmin
          .from('email_queue')
          .update({
            status: 'failed'
          })
          .eq(
            'id',
            item.id
          )

        failed++

        results.push({
          id: item.id,
          recipient:
            item.recipient,
          success: false,
          error:
            result.error ||
            'Send failed'
        })

        /*
          Nếu chạm limit 200 mail/ngày,
          dừng luôn để không đánh dấu các mail
          còn lại là failed.
        */
        if (
          response.status === 429
        ) {
          break
        }
      }

    } catch (e) {
      await supabaseAdmin
        .from('email_queue')
        .update({
          status: 'failed'
        })
        .eq(
          'id',
          item.id
        )

      failed++

      results.push({
        id: item.id,
        recipient:
          item.recipient,
        success: false,
        error:
          e.message
      })
    }
  }

  return {
    success: true,
    processed:
      sent + failed,
    sent,
    failed,
    results
  }
}


// =====================================================
// TEST MANUAL
// =====================================================

export async function GET() {
  try {
    const result =
      await processQueue()

    return Response.json(
      result
    )

  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Process email queue failed'
      },
      {
        status: 500
      }
    )
  }
}


// =====================================================
// AUTOMATION / CRON
// =====================================================

export async function POST() {
  try {
    const result =
      await processQueue()

    return Response.json(
      result
    )

  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Process email queue failed'
      },
      {
        status: 500
      }
    )
  }
}
