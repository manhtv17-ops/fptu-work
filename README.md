# FPTU Work v14

Project-centric workspace management for FPTU teams.

## Core features
- Google login via Supabase Auth; invite links work with any Google account.
- Workspace → Team → Project → Task structure.
- Manager, Team Lead, Member/CTV roles + custom permissions.
- Team management, Project creation, Project members.
- Project List/Kanban, quick task creation, flexible assignment.
- Task descriptions, comments with timestamps, activity log.
- In-app realtime notifications and email queue.
- Resend email delivery through `/api/send-email` cron route.
- Member offboarding while preserving historical task/comment/activity data.

## Required Vercel environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=FPTU Work <Daihoc.hcm@fpt.edu.vn>
CRON_SECRET=
```

Before email sending works, the sender domain must be verified in Resend.

## Deploy
1. Run the SQL patches in `supabase/` in order if they are not already applied.
2. Push this repo to GitHub.
3. Connect to Vercel and add environment variables.
4. `npm run build` must pass before production deployment.
