# Deploy steps

1. Supabase → SQL Editor → run `supabase/upgrade_v7_project_workspace.sql`.
2. Verify the final result row says `FPTU Work v7 Project-centric upgrade completed`.
3. Backup the current GitHub repository (optional: create a branch/tag `v6-backup`).
4. Upload/replace the v7 source keeping this folder structure:
   - `app/`
   - `lib/`
   - `supabase/`
   - `package.json`
   - `.env.example`
5. Commit: `Upgrade to FPTU Work v7 project workspace`.
6. Vercel will redeploy automatically.
7. Environment Variables must already contain:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
8. Open production and Ctrl+F5.
9. Test with Manager + Team Lead + Member accounts.
