import nodemailer from 'nodemailer'
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

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
}

function getVietnamDayRange() {
  const now = new Date()

  const parts = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(now)

  const year = parts.find(x => x.type === 'year')?.value
  const month = parts.find(x => x.type === 'month')?.value
  const day = parts.find(x => x.type === 'day')?.value

  const start = new Date(
    `${year}-${month}-${day}T00:00:00+07:00`
  )

  const end = new Date(
    `${year}-${month}-${day}T23:59:59.999+07:00`
  )

  return {
    start: start.toISOString(),
    end: end.toISOString()
  }
}

export async function POST(request) {
  try {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      return Response.json(
        {
          success: false,
          error: 'SMTP environment variables are missing'
        },
        { status: 500 }
      )
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return Response.json(
        {
          success: false,
          error: 'Supabase admin environment variables are missing'
        },
        { status: 500 }
      )
    }

    const body = await request.json()

    const {
      to,
      subject,
      html,
      text,
      taskUrl
    } = body || {}

    if (!to) {
      return Response.json(
        {
          success: false,
          error: 'Recipient email is required'
        },
        { status: 400 }
      )
    }

    if (!subject) {
      return Response.json(
        {
          success: false,
          error: 'Subject is required'
        },
        { status: 400 }
      )
    }

    const dailyLimit =
      Number(
        process.env.EMAIL_DAILY_LIMIT || 200
      )

    const supabaseAdmin =
      getSupabaseAdmin()

    const {
      start,
      end
    } = getVietnamDayRange()

    const {
      count,
      error: countError
    } = await supabaseAdmin
      .from('email_send_log')
      .select(
        'id',
        {
          count: 'exact',
          head: true
        }
      )
      .eq('status', 'sent')
      .gte('created_at', start)
      .lte('created_at', end)

    if (countError) {
      return Response.json(
        {
          success: false,
          error:
            'Cannot read email daily usage: ' +
            countError.message
        },
        { status: 500 }
      )
    }

    const sentToday =
      count || 0

    if (sentToday >= dailyLimit) {
      return Response.json(
        {
          success: false,
          error:
            `Daily email limit of ${dailyLimit} reached`,
          sentToday,
          dailyLimit,
          remainingToday: 0
        },
        { status: 429 }
      )
    }

    const transporter =
      getTransporter()

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://fptu-work.vercel.app'

    const targetUrl =
      taskUrl ||
      appUrl

    const defaultHtml = `
      <div style="
        font-family:Arial,sans-serif;
        max-width:640px;
        margin:0 auto;
        padding:24px;
        background:#ffffff;
        color:#1f2937;
      ">
        <div style="
          margin-bottom:24px;
        ">
          <div style="
            display:inline-block;
            background:#f47721;
            color:#ffffff;
            padding:10px 14px;
            border-radius:10px;
            font-size:20px;
            font-weight:700;
          ">
            F
          </div>

          <div style="
            margin-top:10px;
            font-size:20px;
            font-weight:700;
          ">
            FPTU Work
          </div>

          <div style="
            font-size:13px;
            color:#6b7280;
          ">
            Project Workspace
          </div>
        </div>

        <h2 style="
          margin:0 0 12px;
          font-size:22px;
        ">
          ${subject}
        </h2>

        <p style="
          font-size:15px;
          line-height:1.6;
          margin:0 0 20px;
        ">
          Bạn có một thông báo mới trên FPTU Work.
        </p>

        <a
          href="${targetUrl}"
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
          Mở FPTU Work
        </a>

        <div style="
          margin-top:28px;
          padding-top:16px;
          border-top:1px solid #e5e7eb;
          font-size:12px;
          color:#9ca3af;
        ">
          Email tự động từ FPTU Work
        </div>
      </div>
    `

    const info =
      await transporter.sendMail({
        from:
          process.env.EMAIL_FROM ||
          `FPTU Work <${process.env.SMTP_USER}>`,

        to,

        subject,

        text:
          text ||
          'Bạn có một thông báo mới từ FPTU Work.',

        html:
          html ||
          defaultHtml
      })

    const {
      error: logError
    } = await supabaseAdmin
      .from('email_send_log')
      .insert({
        recipient: to,
        subject,
        message_id:
          info.messageId || null,
        status: 'sent'
      })

    if (logError) {
      console.error(
        'Email sent but log failed:',
        logError
      )
    }

    const newSentToday =
      sentToday + 1

    return Response.json({
      success: true,
      messageId:
        info.messageId,

      sentToday:
        newSentToday,

      dailyLimit,

      remainingToday:
        Math.max(
          dailyLimit - newSentToday,
          0
        )
    })

  } catch (error) {
    console.error(
      'SMTP send error:',
      error
    )

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Email sending failed'
      },
      { status: 500 }
    )
  }
}
