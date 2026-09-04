# FPTU Work v10

Project-centric workspace management for FPTU teams.

## v10 includes

- Manager-only Team creation with optional Team Lead assignment.
- Project creation through atomic Supabase RPC.
- Invite links for Google accounts from any domain.
- Member/Team Lead/Manager roles + custom permission overrides.
- Member removal without hard-deleting audit history, with optional active-task reassignment.
- In-app notification center with unread counter and realtime refresh.
- Notification preferences per user.
- Email queue for important task events.
- Vercel Cron endpoint to deliver queued emails through Resend.

## Update order

1. Run `supabase/upgrade_v10_workspace_admin.sql` in Supabase SQL Editor.
2. Replace/upload the v10 source to GitHub.
3. Add these Vercel environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=FPTU Work <work@yourdomain.com>
CRON_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CRON_SECRET` are server-only secrets. Never expose them as `NEXT_PUBLIC_*` variables.

4. Redeploy on Vercel.
5. Test Team create, Project create, Invite, notifications and email queue.

## Email behavior

In-app notifications are created for assignment, deadline changes, review events, comments and project membership. Email is queued only for important events and respects each user's preferences.

The cron endpoint `/api/cron/email` checks pending rows in `email_queue` and sends them via Resend every 10 minutes.
