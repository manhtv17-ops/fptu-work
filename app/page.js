'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

const USERS = [
  { id: 1, name: 'Mạnh', role: 'Trưởng phòng', team: 'Marketing & Truyền thông', avatar: 'M' },
  { id: 2, name: 'Thùy Dương', role: 'Team Lead', team: 'Social', avatar: 'D' },
  { id: 3, name: 'Na Uyên', role: 'Nhân viên', team: 'TikTok', avatar: 'U' },
  { id: 4, name: 'Ái Nhi', role: 'Nhân viên', team: 'Website / PR', avatar: 'N' },
  { id: 5, name: 'Huỳnh Anh', role: 'Team Lead', team: 'Production', avatar: 'H' },
  { id: 6, name: 'Khánh Toàn', role: 'CTV', team: 'Design', avatar: 'K' },
];

const SEED_TASKS = [
  { id: 1, code: 'MKT-2026-001', title: 'Hoàn thiện kế hoạch Welcome K22', project: 'K22 Orientation', assignee: 'Huỳnh Anh', priority: 'Cao', status: 'Đang làm', due: '2026-09-05', recurring: 'Không', archived: false },
  { id: 2, code: 'MKT-2026-002', title: 'Báo cáo performance Meta Ads', project: 'Digital Ads', assignee: 'Thùy Dương', priority: 'Cao', status: 'Chờ duyệt', due: '2026-09-03', recurring: 'Hằng tuần', archived: false },
  { id: 3, code: 'MKT-2026-003', title: 'Lên 10 ý tưởng TikTok Student Life', project: 'TikTok Growth', assignee: 'Na Uyên', priority: 'Trung bình', status: 'Todo', due: '2026-09-06', recurring: 'Hằng tuần', archived: false },
  { id: 4, code: 'MKT-2026-004', title: 'Cập nhật portal nội bộ', project: 'Inside-out Viral', assignee: 'Ái Nhi', priority: 'Trung bình', status: 'Hoàn thành', due: '2026-09-02', recurring: 'Hằng ngày', archived: false },
  { id: 5, code: 'MKT-2026-005', title: 'Thiết kế POSM tuyển CTV', project: 'OJT / CTV', assignee: 'Khánh Toàn', priority: 'Thấp', status: 'Đang làm', due: '2026-09-08', recurring: 'Không', archived: false },
];

const STATUSES = ['Todo', 'Đang làm', 'Chờ duyệt', 'Hoàn thành'];

function Badge({ children, tone = 'default' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export default function Home() {
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [view, setView] = useState('list');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [projectFilter, setProjectFilter] = useState('Tất cả');
  const [modal, setModal] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [logs, setLogs] = useState([
    { time: '14:15', text: 'Mạnh duyệt task MKT-2026-002' },
    { time: '13:40', text: 'Thùy Dương đổi deadline MKT-2026-002' },
    { time: '11:05', text: 'Na Uyên chuyển MKT-2026-003 sang Todo' },
  ]);
  const [form, setForm] = useState({ title: '', project: 'K22 Orientation', assignee: 'Thùy Dương', priority: 'Trung bình', due: '2026-09-10', recurring: 'Không' });

  useEffect(() => {
    const saved = localStorage.getItem('fpt-work-manager-tasks');
    if (saved) setTasks(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('fpt-work-manager-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const projects = useMemo(() => ['Tất cả', ...new Set(tasks.map(t => t.project))], [tasks]);
  const filtered = useMemo(() => tasks.filter(t => !t.archived)
    .filter(t => statusFilter === 'Tất cả' || t.status === statusFilter)
    .filter(t => projectFilter === 'Tất cả' || t.project === projectFilter)
    .filter(t => `${t.code} ${t.title} ${t.assignee}`.toLowerCase().includes(query.toLowerCase())), [tasks, statusFilter, projectFilter, query]);

  const stats = {
    total: tasks.filter(t => !t.archived).length,
    doing: tasks.filter(t => !t.archived && t.status === 'Đang làm').length,
    review: tasks.filter(t => !t.archived && t.status === 'Chờ duyệt').length,
    done: tasks.filter(t => !t.archived && t.status === 'Hoàn thành').length,
  };

  function addTask(e) {
    e.preventDefault();
    const seq = Math.max(...tasks.map(t => Number(t.code.split('-').pop())), 0) + 1;
    const code = `MKT-2026-${String(seq).padStart(3, '0')}`;
    const task = { id: Date.now(), code, ...form, status: 'Todo', archived: false };
    setTasks([task, ...tasks]);
    setLogs([{ time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), text: `Mạnh tạo task ${code}` }, ...logs]);
    setModal(false);
    setForm({ title: '', project: 'K22 Orientation', assignee: 'Thùy Dương', priority: 'Trung bình', due: '2026-09-10', recurring: 'Không' });
  }

  function moveTask(id, status) {
    const task = tasks.find(t => t.id === id);
    setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
    setLogs([{ time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), text: `Mạnh đổi ${task.code} sang ${status}` }, ...logs]);
  }

  function archiveTask(id) {
    const task = tasks.find(t => t.id === id);
    setTasks(tasks.map(t => t.id === id ? { ...t, archived: true } : t));
    setLogs([{ time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), text: `Mạnh lưu trữ ${task.code} (không xóa lịch sử)` }, ...logs]);
  }

  function exportExcel() {
    const rows = filtered.map(({ code, title, project, assignee, priority, status, due, recurring }) => ({
      'Mã task': code, 'Công việc': title, 'Dự án': project, 'Phụ trách': assignee, 'Ưu tiên': priority,
      'Trạng thái': status, 'Deadline': due, 'Lặp lại': recurring
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'FPTU-Work-Report.xlsx');
  }

  const inviteLink = 'https://fptu-work.vercel.app/join/MKT-HCM-2026';

  return (
    <main>
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">F</div><div><strong>FPTU Work</strong><span>Command Center</span></div></div>
        <nav>
          <button className="navItem active">▦ Tổng quan</button>
          <button className="navItem">✓ Công việc <em>{stats.total}</em></button>
          <button className="navItem">◇ Dự án</button>
          <button className="navItem">👥 Nhân sự</button>
          <button className="navItem">▤ Báo cáo</button>
          <button className="navItem">⌁ Nhật ký</button>
        </nav>
        <div className="sidebarBottom">
          <div className="miniProfile"><div className="avatar">M</div><div><strong>Mạnh</strong><span>Trưởng phòng</span></div></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><h1>Chào buổi chiều, Mạnh 👋</h1><p>Quản lý task, project và hiệu suất team tại một nơi.</p></div>
          <div className="actions"><button className="btn secondary" onClick={() => setInviteOpen(true)}>🔗 Mời thành viên</button><button className="btn primary" onClick={() => setModal(true)}>＋ Tạo task</button></div>
        </header>

        <section className="stats">
          <div className="stat"><span>Tổng task</span><strong>{stats.total}</strong><small>Đang hoạt động</small></div>
          <div className="stat"><span>Đang làm</span><strong>{stats.doing}</strong><small>Đang triển khai</small></div>
          <div className="stat"><span>Chờ duyệt</span><strong>{stats.review}</strong><small>Cần xử lý</small></div>
          <div className="stat"><span>Hoàn thành</span><strong>{stats.done}</strong><small>Trong kỳ này</small></div>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div><h2>Công việc</h2><p>Theo dõi tiến độ theo team và dự án</p></div>
            <button className="btn secondary" onClick={exportExcel}>⇩ Xuất Excel</button>
          </div>
          <div className="toolbar">
            <input placeholder="Tìm theo mã task, tên, nhân sự..." value={query} onChange={e => setQuery(e.target.value)} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>Tất cả</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>{projects.map(p => <option key={p}>{p}</option>)}</select>
            <div className="viewToggle"><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>☷ List</button><button className={view === 'kanban' ? 'on' : ''} onClick={() => setView('kanban')}>▦ Kanban</button></div>
          </div>

          {view === 'list' ? <div className="tableWrap"><table><thead><tr><th>Mã</th><th>Công việc</th><th>Dự án</th><th>Phụ trách</th><th>Ưu tiên</th><th>Trạng thái</th><th>Deadline</th><th></th></tr></thead><tbody>{filtered.map(t => <tr key={t.id}><td><b>{t.code}</b></td><td><div className="taskTitle">{t.title}{t.recurring !== 'Không' && <span title="Task lặp lại">↻</span>}</div></td><td>{t.project}</td><td>{t.assignee}</td><td><Badge tone={t.priority === 'Cao' ? 'danger' : t.priority === 'Thấp' ? 'muted' : 'warn'}>{t.priority}</Badge></td><td><select className="statusSelect" value={t.status} onChange={e => moveTask(t.id, e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td><td>{new Date(t.due).toLocaleDateString('vi-VN')}</td><td><button className="iconBtn" title="Lưu trữ, không xóa" onClick={() => archiveTask(t.id)}>⋯</button></td></tr>)}</tbody></table></div> :
          <div className="kanban">{STATUSES.map(status => <div className="column" key={status}><div className="columnHead"><strong>{status}</strong><span>{filtered.filter(t => t.status === status).length}</span></div>{filtered.filter(t => t.status === status).map(t => <div className="card" key={t.id}><small>{t.code}</small><h3>{t.title}</h3><div className="cardMeta"><Badge tone={t.priority === 'Cao' ? 'danger' : 'warn'}>{t.priority}</Badge><span>{t.due}</span></div><div className="cardBottom"><span>{t.assignee}</span><select value={t.status} onChange={e => moveTask(t.id, e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div></div>)}</div>)}</div>}
        </section>

        <section className="lowerGrid">
          <div className="panel"><div className="panelHead"><div><h2>Nhật ký hoạt động</h2><p>Không thể xóa lịch sử phát sinh</p></div></div><div className="logList">{logs.slice(0, 5).map((l, i) => <div className="log" key={i}><span>{l.time}</span><p>{l.text}</p></div>)}</div></div>
          <div className="panel"><div className="panelHead"><div><h2>Phân quyền</h2><p>Quyền truy cập theo vai trò</p></div></div><div className="roles"><div><Badge tone="danger">Trưởng phòng</Badge><p>Toàn quyền, duyệt, báo cáo, phân quyền.</p></div><div><Badge tone="warn">Team Lead</Badge><p>Tạo/giao task trong team, duyệt cấp team.</p></div><div><Badge tone="muted">Nhân viên / CTV</Badge><p>Cập nhật task được giao, bình luận, upload file.</p></div></div></div>
        </section>
      </section>

      {modal && <div className="overlay"><form className="modal" onSubmit={addTask}><div className="modalHead"><div><h2>Tạo task mới</h2><p>Mã task được sinh tự động.</p></div><button type="button" onClick={() => setModal(false)}>×</button></div><label>Tên công việc<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><div className="formGrid"><label>Dự án<input value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} /></label><label>Phụ trách<select value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}>{USERS.map(u => <option key={u.id}>{u.name}</option>)}</select></label><label>Ưu tiên<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Thấp</option><option>Trung bình</option><option>Cao</option></select></label><label>Deadline<input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></label><label>Lặp lại<select value={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.value })}><option>Không</option><option>Hằng ngày</option><option>Hằng tuần</option><option>Hằng tháng</option></select></label></div><div className="modalActions"><button type="button" className="btn secondary" onClick={() => setModal(false)}>Hủy</button><button className="btn primary">Tạo task</button></div></form></div>}

      {inviteOpen && <div className="overlay"><div className="modal"><div className="modalHead"><div><h2>Mời nhiều thành viên bằng link</h2><p>Một link có thể dùng cho nhiều người. Admin có thể thu hồi link.</p></div><button onClick={() => setInviteOpen(false)}>×</button></div><div className="inviteBox"><input readOnly value={inviteLink}/><button className="btn primary" onClick={() => navigator.clipboard?.writeText(inviteLink)}>Sao chép</button></div><div className="inviteOptions"><label><input type="checkbox" defaultChecked/> Cho phép nhiều người dùng cùng link</label><label><input type="checkbox" defaultChecked/> Gửi email thông báo sau khi tham gia</label><label>Vai trò mặc định<select defaultValue="Nhân viên / CTV"><option>Nhân viên / CTV</option><option>Team Lead</option></select></label></div><div className="notice">Email ở bản demo đang mô phỏng. Khi nối backend có thể dùng Resend hoặc SMTP của đơn vị.</div></div></div>}
    </main>
  );
}
