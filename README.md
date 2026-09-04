# FPTU Work v5 — Supabase Production Test

Bản này đã nối dữ liệu thật qua Supabase:
- Google OAuth
- profile/session
- workspace membership
- bootstrap user đầu tiên thành Trưởng phòng
- task thật + mã task backend
- comment có ngày/giờ
- activity log
- notification cơ bản
- invite link nhiều người
- realtime refresh
- Excel export

## Trước khi deploy
1. Đã chạy `fptu_work_schema_v1.sql`.
2. Chạy tiếp `supabase/patch_v2.sql` trong SQL Editor.
3. Vercel có 3 env:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - NEXT_PUBLIC_APP_URL=https://fptu-work.vercel.app
4. Supabase Google provider đã Enabled.
5. Supabase Site URL / Redirect URLs đã cấu hình domain Vercel.

## Cập nhật GitHub
Upload đè toàn bộ source này vào repo `fptu-work`. Sau commit, Vercel tự deploy.

## Lần đăng nhập đầu tiên
Nếu workspace chưa có membership nào, tài khoản Google đầu tiên đăng nhập sẽ tự trở thành `manager` (Trưởng phòng). Từ đó Trưởng phòng tạo link mời cho team.

## Link mời
Trưởng phòng bấm `Mời thành viên` → `Tạo & copy link`. Thành viên mở link, login Google và tự join workspace với role Nhân viên/CTV.
