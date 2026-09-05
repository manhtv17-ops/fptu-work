# Deploy FPTU Work v14

1. Supabase SQL Editor: run `supabase/upgrade_v14_latest.sql` once on the existing FPTU Work database.
2. Replace the GitHub repo contents with this source, preserving folder structure.
3. Vercel environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
   - SUPABASE_SERVICE_ROLE_KEY
   - RESEND_API_KEY
   - EMAIL_FROM=FPTU Work <Daihoc.hcm@fpt.edu.vn>
   - CRON_SECRET (optional but recommended)
4. Redeploy/commit to main.
5. Verify Google OAuth redirect URL remains `https://fptu-work.vercel.app/**` in Supabase Auth.
6. Resend must verify the sender domain before real email can be sent from Daihoc.hcm@fpt.edu.vn.

## Smoke test order
1. Manager creates Team.
2. Team Lead/Manager creates Project.
3. Manager creates invite link and a second Google account joins.
4. Manager changes member Role/Team/Custom Permissions, closes and reopens drawer.
5. Member creates a task inside a Project and assigns it to another Project member.
6. Assignee sees My Tasks + in-app notification.
7. Add a comment; relevant users receive notification.
8. Check `email_queue`; invoke `/api/send-email` after Resend env is configured.
