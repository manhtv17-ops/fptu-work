FPTU MKT Work v18.14.1 - Backup System (12h)
================================================

Muc tieu
- Backup 2 lan/ngay: 00:00 va 12:00 gio Viet Nam.
- Backup database: roles + schema + data.
- Backup Supabase Storage objects.
- Upload sang Google Drive hien co.
- Giu 30 ngay, tu dong xoa ban cu.
- Khong commit du lieu backup vao GitHub repository.

Luu y quan trong
- Repo fptu-work hien la PUBLIC. KHONG bao gio commit database dump hoac secret vao repo.
- Tat ca credential phai de trong GitHub Actions Secrets.

File can dua vao repo
1) .github/workflows/backup-12h.yml
2) scripts/backup-storage.mjs

GitHub Secrets can co
1) SUPABASE_DB_URL
   Supabase > Project Settings > Database > Connection string.
   Day la secret vi co database password.

2) NEXT_PUBLIC_SUPABASE_URL
   Gia tri nay app hien co the da dung tren Vercel, nhung GitHub Actions cung can secret rieng.

3) SUPABASE_SERVICE_ROLE_KEY
   Supabase > Project Settings > API.
   Tuyet doi khong paste vao chat/public repo.

4) RCLONE_CONFIG
   Cau hinh OAuth de GitHub Actions upload vao Google Drive hien co.
   Day la secret. Khong commit file rclone.conf.

Folder Drive mac dinh
FPTU MKT Work Backup/YYYY-MM-DD/fptu-work-YYYY-MM-DD_HH-MM-SS.tar.gz

Lich
- cron 0 5,17 * * * theo UTC
- tuong ung 12:00 va 00:00 Viet Nam (UTC+7)

Cach test
- GitHub > Actions > FPTU Work Backup 12h > Run workflow.
- Cho job xanh.
- Mo Google Drive > FPTU MKT Work Backup > ngay hom nay.
- Phai co .tar.gz va .sha256.

Restore
- Tai file .tar.gz ve.
- Giai nen se co database/roles.sql, schema.sql, data.sql va storage/.
- Restore vao môi truong test truoc, khong restore truc tiep Production khi chua kiem tra.
