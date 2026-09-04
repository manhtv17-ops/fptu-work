# Deploy steps — FPTU Work v10

1. Supabase > SQL Editor > run `supabase/upgrade_v10_workspace_admin.sql`.
2. GitHub > replace `app/page.js`, `app/globals.css`, add `app/api/cron/email/route.js`, `vercel.json`, and keep existing `lib/` files.
3. Vercel > Settings > Environment Variables > add server secrets for Supabase Service Role and Resend.
4. Deploy.
5. Test with 3 users: Manager, Team Lead, Member.
6. Check `notifications` and `email_queue` tables in Supabase.
7. Trigger `/api/cron/email` manually once or wait for Vercel Cron.
