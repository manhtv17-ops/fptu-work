import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

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
        {
          status: 500
        }
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
        {
          status: 400
        }
      )
    }

    if (!subject) {
      return Response.json(
        {
          success: false,
          error: 'Subject is required'
        },
        {
          status: 400
        }
      )
    }

    const transporter = getTransporter()

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
          display:flex;
          align-items:center;
          gap:12px;
          margin-bottom:24px;
        ">
          <div style="
            width:44px;
            height:44px;
            border-radius:10px;
            background:#f47721;
            color:#ffffff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:22px;
            font-weight:700;
          ">
            F
          </div>

          <div>
            <div style="
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

    const info = await transporter.sendMail({
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

    return Response.json({
      success: true,
      messageId: info.messageId
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
      {
        status: 500
      }
    )
  }
}
