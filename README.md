# FPTU Work Manager

Demo webapp quản lý task/project/nhân sự cho team Marketing & Truyền thông.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Deploy Vercel

1. Upload source lên GitHub.
2. Vào Vercel > Add New > Project > Import repository.
3. Framework tự nhận Next.js.
4. Deploy.

## Có sẵn trong demo
- List + Kanban view
- Search + filter task
- Role: Trưởng phòng / Team Lead / Nhân viên-CTV
- Nhật ký hoạt động
- Task lặp lại ngày/tuần/tháng
- Mã task tự động dạng MKT-2026-001
- Task có hoạt động chỉ lưu trữ, không hard delete
- Invite link dùng cho nhiều người
- Mô phỏng email notification
- Xuất Excel
- Roboto
- Dữ liệu lưu ở localStorage để test nhanh

## Backend production đề xuất
- Supabase: Auth + Postgres + RLS
- Resend: email invite/notification
- Vercel: hosting

