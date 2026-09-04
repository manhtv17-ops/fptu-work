# FPTU Work v7 — Project Management Workspace

Project-centric rewrite of FPTU Work.

## Core model
Workspace → Team → Project → Task → Subtask / Comment / File / Activity.

## What is implemented
- Google/Supabase authentication and invite-token preservation.
- Project list and Project creation for Manager / Team Lead / custom permission.
- Project Overview, List, Kanban, Files, Activity and Report tabs.
- Project description inline update.
- Project members and per-project permission model.
- Members are active contributors: create tasks, self-assign or assign to Project members.
- Quick Add task (Enter to create).
- Task drawer with editable description, assignee, deadline, status, progress and delivery link.
- Task comments with author + timestamp + realtime refresh.
- Task activity log.
- Kanban drag/drop status changes.
- Manager Members & Permissions screen.
- Excel export per Project.
- Responsive desktop/tablet/mobile UI.

## 1. Supabase
Run:

`supabase/upgrade_v7_project_workspace.sql`

This is intended as an upgrade on top of the database already used by FPTU Work v5/v6.

## 2. Vercel environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
```

## 3. Deploy
Replace the current GitHub repository contents with this source (keep your secrets only in Vercel), commit, and let Vercel deploy.

## 4. Important production notes
- Existing RLS remains the source of truth; v7 adds project-centric access functions and policies.
- Members can create tasks inside projects they can access.
- Assign dropdown is scoped to Project members.
- Manager can grant workspace-level custom permissions.
- The Files tab currently exposes the project-file area but the UI upload workflow is intentionally left minimal; schema is ready for Supabase Storage/URL integration.
- Recurring rules remain in the existing backend schema; cron generation can continue using the prior recurring setup.

## Recommended smoke test
1. Manager login.
2. Promote one user to Team Lead and assign a Team.
3. Team Lead creates Project.
4. Add 2 Project members.
5. Member creates Task and assigns another Project member.
6. Edit description/deadline inline.
7. Add comment and verify timestamp/activity.
8. Drag task To-do → In Progress → Review.
9. Review and complete.
10. Export Project Excel.
