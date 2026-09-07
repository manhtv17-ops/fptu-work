export const runtime = 'nodejs'

export async function GET() {
  return Response.json({
    ok: true,
    message: 'Use POST to send test email'
  })
}

export async function POST(request) {
  try {
    const body = await request.json()

    const to = body?.to

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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://fptu-work.vercel.app'

    const response = await fetch(
      `${appUrl}/api/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          subject: 'Test email từ FPTU Work',
          text:
            'Đây là email test SMTP từ FPTU Work.',

          html: `
            <div style="
              font-family:Arial,sans-serif;
              max-width:640px;
              margin:auto;
              padding:24px;
            ">
              <h2>
                FPTU Work SMTP Test
              </h2>

              <p>
                Nếu bạn nhận được email này thì SMTP đã cấu hình thành công.
              </p>

              <p>
                Sender:
                <b>daihoc.hcm@fpt.edu.vn</b>
              </p>

              <a
                href="${appUrl}"
                style="
                  display:inline-block;
                  padding:12px 20px;
                  background:#f47721;
                  color:white;
                  text-decoration:none;
                  border-radius:8px;
                  margin-top:12px;
                "
              >
                Mở FPTU Work
              </a>
            </div>
          `
        })
      }
    )

    const result =
      await response.json()

    return Response.json(
      result,
      {
        status:
          response.ok
            ? 200
            : 500
      }
    )

  } catch (error) {

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Test email failed'
      },
      {
        status: 500
      }
    )
  }
}
