'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const USERS = [
  { id: 1, name: 'Mạnh', role: 'Trưởng phòng', team: 'MKT', email: 'manh@fpt.edu.vn' },
  { id: 2, name: 'Thùy Dương', role: 'Team Lead', team: 'SOCIAL', email: 'duong@fpt.edu.vn' },
  { id: 3, name: 'Na Uyên', role: 'Nhân viên/CTV', team: 'SOCIAL', email: 'uyen@fpt.edu.vn' },
  { id: 4, name: 'Ái Nhi', role: 'Nhân viên/CTV', team: 'PR', email: 'nhi@fpt.edu.vn' },
  { id: 5, name: 'Huỳnh Anh', role: 'Team Lead', team: 'MEDIA', email: 'anh@fpt.edu.vn' },
  { id: 6, name: 'Khánh Toàn', role: 'Nhân viên/CTV', team: 'DESIGN', email: 'toan@fpt.edu.vn' },
];

const SEED_TASKS = [
  { id: 1, code: 'MEDIA-2026-014', title: 'Hoàn thiện kế hoạch Welcome K22', project: 'K22 Orientation', team: 'MEDIA', assigner: 'Mạnh', assignee: 'Huỳnh Anh', watchers: ['Thùy Dương'], priority: 'Cao', status: 'In Progress', progress: 65, due: '2026-09-05', created: '2026-09-01', accepted: '2026-09-01', completed: '', recurring: 'Không', archived: false, cancelled: false, activityCount: 6, review: '', deliverable: '', description: 'Chốt timeline, key visual, checklist vận hành và owner theo từng hạng mục.', comments: 4 },
  { id: 2, code: 'SOCIAL-2026-025', title: 'Báo cáo performance Meta Ads', project: 'Digital Ads', team: 'SOCIAL', assigner: 'Mạnh', assignee: 'Thùy Dương', watchers: ['Huỳnh Anh'], priority: 'Cao', status: 'Review', progress: 100, due: '2026-09-03', created: '2026-08-31', accepted: '2026-08-31', completed: '', recurring: 'Hằng tuần', archived: false, cancelled: false, activityCount: 9, review: 'Đang chờ duyệt', deliverable: 'https://lookerstudio.google.com/', description: 'Đối chiếu CPL, chất lượng lead và đề xuất giữ/giảm/tắt campaign.', comments: 8 },
  { id: 3, code: 'SOCIAL-2026-026', title: 'Lên 10 ý tưởng TikTok Student Life', project: 'TikTok Growth', team: 'SOCIAL', assigner: 'Thùy Dương', assignee: 'Na Uyên', watchers: ['Mạnh'], priority: 'Trung bình', status: 'To-do', progress: 0, due: '2026-09-06', created: '2026-09-02', accepted: '', completed: '', recurring: 'Hằng tuần', archived: false, cancelled: false, activityCount: 1, review: '', deliverable: '', description: 'Ưu tiên format dễ quay bằng điện thoại, có hook 3 giây đầu.', comments: 2 },
  { id: 4, code: 'PR-2026-008', title: 'Cập nhật portal nội bộ', project: 'Inside-out Viral', team: 'PR', assigner: 'Mạnh', assignee: 'Ái Nhi', watchers: [], priority: 'Trung bình', status: 'Done', progress: 100, due: '2026-09-02', created: '2026-08-28', accepted: '2026-08-28', completed: '2026-09-02', recurring: 'Hằng ngày', archived: false, cancelled: false, activityCount: 8, review: 'Đã duyệt', deliverable: 'https://daihoc.fpt.edu.vn/', description: 'Cập nhật bài nổi bật và nội dung viral inside-out.', comments: 5 },
  { id: 5, code: 'DESIGN-2026-011', title: 'Thiết kế POSM tuyển CTV', project: 'OJT / CTV', team: 'DESIGN', assigner: 'Mạnh', assignee: 'Khánh Toàn', watchers: ['Huỳnh Anh'], priority: 'Thấp', status: 'In Progress', progress: 35, due: '2026-09-08', created: '2026-09-01', accepted: '2026-09-01', completed: '', recurring: 'Không', archived: false, cancelled: false, activityCount: 4, review: '', deliverable: '', description: 'Tối giản, trẻ, dễ đọc trên mobile, chuẩn nhận diện FPT.', comments: 3 },
];

const STATUSES = ['To-do', 'In Progress', 'Review', 'Done'];
const PRIORITIES = ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'];
const TEAMS = ['MKT', 'SOCIAL', 'MEDIA', 'PR', 'DESIGN'];
const PROJECTS = ['K22 Orientation', 'Digital Ads', 'TikTok Growth', 'Inside-out Viral', 'OJT / CTV'];

const STATUS_LABEL = { 'To-do': 'Cần làm', 'In Progress': 'Đang làm', 'Review': 'Chờ duyệt', 'Done': 'Hoàn thành' };
const STATUS_ICON = { 'To-do': '○', 'In Progress': '◐', 'Review': '◌', 'Done': '✓' };

function fmt(date) {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function isOverdue(task) {
  return task.status !== 'Done' && !task.cancelled && new Date(`${task.due}T23:59:59`) < new Date();
}

function dueText(task) {
  if (task.status === 'Done') return task.completed ? `Xong ${fmt(task.completed)}` : 'Đã xong';
  const today = new Date('2026-09-03T12:00:00');
  const due = new Date(`${task.due}T12:00:00`);
  const diff = Math.ceil((due - today) / 86400000);
  if (diff < 0) return `Trễ ${Math.abs(diff)} ngày`;
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  return fmt(task.due);
}

function Avatar({ name, small = false }) {
  return <span className={`avatar ${small ? 'small' : ''}`} title={name}>{name?.slice(0, 1) || '?'}</span>;
}

function PriorityDot({ priority }) {
  return <span className={`priorityDot priority-${priority.replace(' ', '-').toLowerCase()}`} title={priority} />;
}

export default function Home() {
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [role, setRole] = useState('Trưởng phòng');
  const [screen, setScreen] = useState('tasks');
  const [view, setView] = useState('list');
  const [scope, setScope] = useState('Tất cả');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Tất cả');
  const [drawerId, setDrawerId] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickColumn, setQuickColumn] = useState(null);
  const [toast, setToast] = useState(null);
  const [logs, setLogs] = useState([
    { id: 1, actor: 'Mạnh', action: 'Duyệt hoàn thành', task: 'PR-2026-008', time: '15:05' },
    { id: 2, actor: 'Thùy Dương', action: 'Gửi duyệt', task: 'SOCIAL-2026-025', time: '14:42' },
    { id: 3, actor: 'Mạnh', action: 'Đổi deadline → 03/09', task: 'SOCIAL-2026-025', time: '13:40' },
  ]);
  const [invite, setInvite] = useState({ active: true, token: 'MKT-HCM-2026', expires: '2026-12-31', uses: 7, maxUses: 50, role: 'Nhân viên/CTV' });
  const dragId = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fptu-work-ux-v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.logs) setLogs(parsed.logs);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('fptu-work-ux-v3', JSON.stringify({ tasks, logs })); } catch {}
  }, [tasks, logs]);

  const currentUser = role === 'Trưởng phòng' ? 'Mạnh' : role === 'Team Lead' ? 'Thùy Dương' : 'Na Uyên';
  const canApprove = role !== 'Nhân viên/CTV';

  const activeTasks = useMemo(() => tasks.filter(t => !t.archived && !t.cancelled), [tasks]);

  const filteredTasks = useMemo(() => {
    return activeTasks.filter(task => {
      const haystack = `${task.code} ${task.title} ${task.project} ${task.team} ${task.assignee} ${task.assigner}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
      if (scope === 'Của tôi' && task.assignee !== currentUser) return false;
      if (scope === 'Tôi giao' && task.assigner !== currentUser) return false;
      if (scope === 'Theo dõi' && !task.watchers.includes(currentUser)) return false;
      if (filter === 'Quá hạn' && !isOverdue(task)) return false;
      if (filter === 'Hôm nay' && task.due !== '2026-09-03') return false;
      if (filter === 'Ưu tiên cao' && !['Cao', 'Khẩn cấp'].includes(task.priority)) return false;
      if (filter === 'Chờ duyệt' && task.status !== 'Review') return false;
      return true;
    });
  }, [activeTasks, query, scope, filter, currentUser]);

  const drawerTask = tasks.find(t => t.id === drawerId) || null;

  const stats = {
    todo: activeTasks.filter(t => t.status === 'To-do').length,
    doing: activeTasks.filter(t => t.status === 'In Progress').length,
    review: activeTasks.filter(t => t.status === 'Review').length,
    overdue: activeTasks.filter(isOverdue).length,
  };

  function addLog(task, action) {
    setLogs(prev => [{ id: Date.now(), actor: currentUser, action, task: task.code, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
  }

  function applyTask(id, patch, label, { undo = true } = {}) {
    const before = tasks.find(t => t.id === id);
    if (!before) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch, activityCount: (t.activityCount || 0) + 1 } : t));
    addLog(before, label);
    if (undo) {
      setToast({ message: label, undo: () => setTasks(prev => prev.map(t => t.id === id ? before : t)) });
    } else {
      setToast({ message: label });
    }
  }

  function toggleComplete(task) {
    if (task.status === 'Done') {
      applyTask(task.id, { status: 'In Progress', progress: 90, completed: '', review: '' }, 'Mở lại task');
      return;
    }
    if (role === 'Nhân viên/CTV') {
      applyTask(task.id, { status: 'Review', progress: 100, accepted: task.accepted || '2026-09-03', review: 'Đang chờ duyệt' }, 'Đã gửi duyệt');
    } else {
      applyTask(task.id, { status: 'Done', progress: 100, completed: '2026-09-03', review: 'Đã duyệt' }, 'Đã hoàn thành task');
    }
  }

  function changeStatus(task, status) {
    const patch = { status };
    if (status === 'Done') Object.assign(patch, { progress: 100, completed: '2026-09-03', review: 'Đã duyệt' });
    if (status === 'Review') Object.assign(patch, { progress: 100, review: 'Đang chờ duyệt' });
    if (status === 'In Progress' && !task.accepted) patch.accepted = '2026-09-03';
    applyTask(task.id, patch, `Chuyển sang ${STATUS_LABEL[status]}`);
  }

  function nextCode(team) {
    const nums = tasks.filter(t => t.code.startsWith(`${team}-2026-`)).map(t => Number(t.code.split('-').pop()) || 0);
    return `${team}-2026-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  }

  function createQuickTask(title, status = 'To-do') {
    const clean = title.trim();
    if (!clean) return;
    const team = scope === 'Của tôi' ? (USERS.find(u => u.name === currentUser)?.team || 'MKT') : 'MKT';
    const task = {
      id: Date.now(), code: nextCode(team), title: clean, project: PROJECTS[0], team,
      assigner: currentUser, assignee: currentUser, watchers: [], priority: 'Trung bình', status,
      progress: status === 'Done' ? 100 : status === 'Review' ? 100 : status === 'In Progress' ? 20 : 0,
      due: '2026-09-10', created: '2026-09-03', accepted: status === 'To-do' ? '' : '2026-09-03',
      completed: status === 'Done' ? '2026-09-03' : '', recurring: 'Không', archived: false, cancelled: false,
      activityCount: 1, review: status === 'Review' ? 'Đang chờ duyệt' : '', deliverable: '', description: '', comments: 0,
    };
    setTasks(prev => [task, ...prev]);
    addLog(task, 'Tạo task nhanh');
    setQuickTitle('');
    setQuickColumn(null);
    setToast({ message: `Đã tạo ${task.code}` });
  }

  function exportExcel() {
    const rows = filteredTasks.map(t => ({
      'Mã task': t.code, 'Công việc': t.title, 'Dự án': t.project, 'Team': t.team,
      'Người giao': t.assigner, 'Người thực hiện': t.assignee, 'Watchers': t.watchers.join(', '),
      'Ngày tạo': t.created, 'Ngày xác nhận': t.accepted, 'Deadline': t.due, 'Ngày hoàn thành': t.completed,
      'Trạng thái': STATUS_LABEL[t.status], 'Tiến độ %': t.progress, 'Ưu tiên': t.priority,
      'Kết quả review': t.review, 'Link bàn giao': t.deliverable,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'FPTU-Work-Report.xlsx');
  }

  function copyInvite() {
    navigator.clipboard?.writeText(`https://fptu-work.vercel.app/join/${invite.token}`);
    setToast({ message: 'Đã copy link mời' });
  }

  function TaskRow({ task }) {
    return (
      <div className={`taskRow ${task.status === 'Done' ? 'done' : ''} ${isOverdue(task) ? 'overdue' : ''}`}>
        <button className={`checkCircle status-${task.status.replace(' ', '-').toLowerCase()}`} onClick={() => toggleComplete(task)} title={role === 'Nhân viên/CTV' && task.status !== 'Done' ? 'Tick để gửi duyệt' : 'Tick để hoàn thành'}>
          {task.status === 'Done' ? '✓' : task.status === 'Review' ? '◌' : ''}
        </button>
        <div className="taskMain">
          <button className="taskTitle" onClick={() => setDrawerId(task.id)}>{task.title}</button>
          <div className="taskSub">
            <span>{task.code}</span><span>•</span><span>{task.project}</span>
            {task.recurring !== 'Không' && <span className="repeatTag">↻ {task.recurring}</span>}
          </div>
        </div>
        <div className="inlineField assigneeField">
          <Avatar name={task.assignee} small />
          <select value={task.assignee} onChange={e => applyTask(task.id, { assignee: e.target.value }, `Đổi người phụ trách → ${e.target.value}`)}>
            {USERS.map(u => <option key={u.id}>{u.name}</option>)}
          </select>
        </div>
        <label className={`dueField ${isOverdue(task) ? 'late' : ''}`}>
          <span>⌚ {dueText(task)}</span>
          <input type="date" value={task.due} onChange={e => applyTask(task.id, { due: e.target.value }, `Đổi deadline → ${fmt(e.target.value)}`)} />
        </label>
        <label className="priorityField">
          <PriorityDot priority={task.priority} />
          <select value={task.priority} onChange={e => applyTask(task.id, { priority: e.target.value }, `Đổi ưu tiên → ${e.target.value}`)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </label>
        <button className="commentCount" onClick={() => setDrawerId(task.id)}>💬 {task.comments || 0}</button>
        <button className="moreBtn" onClick={() => setDrawerId(task.id)}>•••</button>
      </div>
    );
  }

  function KanbanCard({ task }) {
    return (
      <article className={`kanbanCard ${isOverdue(task) ? 'overdue' : ''}`} draggable onDragStart={() => { dragId.current = task.id; }} onClick={() => setDrawerId(task.id)}>
        <div className="cardTop"><span className="codeTiny">{task.code}</span><PriorityDot priority={task.priority} /></div>
        <div className="cardTitleWrap">
          <button className={`checkCircle mini status-${task.status.replace(' ', '-').toLowerCase()}`} onClick={(e) => { e.stopPropagation(); toggleComplete(task); }}>{task.status === 'Done' ? '✓' : task.status === 'Review' ? '◌' : ''}</button>
          <h3>{task.title}</h3>
        </div>
        <div className="cardBottom"><div className="avatarStack"><Avatar name={task.assignee} small /></div><span className={isOverdue(task) ? 'lateText' : ''}>⌚ {dueText(task)}</span><span>💬 {task.comments || 0}</span></div>
      </article>
    );
  }

  function Drawer() {
    if (!drawerTask) return null;
    const task = drawerTask;
    return (
      <div className="drawerOverlay" onMouseDown={e => { if (e.target === e.currentTarget) setDrawerId(null); }}>
        <aside className="drawer">
          <div className="drawerTop">
            <div><span className="codeTiny">{task.code}</span><span className={`statusPill s-${task.status.replace(' ', '-').toLowerCase()}`}>{STATUS_ICON[task.status]} {STATUS_LABEL[task.status]}</span></div>
            <button onClick={() => setDrawerId(null)}>×</button>
          </div>

          <div className="drawerBody">
            <textarea className="drawerTitle" value={task.title} rows={2} onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))} onBlur={() => addLog(task, 'Sửa tên task')} />
            <textarea className="descriptionBox" value={task.description || ''} placeholder="Thêm mô tả…" rows={3} onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, description: e.target.value } : t))} />

            <div className="propertyGrid">
              <span>Trạng thái</span><select value={task.status} onChange={e => changeStatus(task, e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
              <span>Người phụ trách</span><select value={task.assignee} onChange={e => applyTask(task.id, { assignee: e.target.value }, `Đổi người phụ trách → ${e.target.value}`)}>{USERS.map(u => <option key={u.id}>{u.name}</option>)}</select>
              <span>Deadline</span><input type="date" value={task.due} onChange={e => applyTask(task.id, { due: e.target.value }, `Đổi deadline → ${fmt(e.target.value)}`)} />
              <span>Ưu tiên</span><select value={task.priority} onChange={e => applyTask(task.id, { priority: e.target.value }, `Đổi ưu tiên → ${e.target.value}`)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              <span>Dự án</span><select value={task.project} onChange={e => applyTask(task.id, { project: e.target.value }, `Đổi dự án → ${e.target.value}`)}>{PROJECTS.map(p => <option key={p}>{p}</option>)}</select>
              <span>Team</span><select value={task.team} onChange={e => applyTask(task.id, { team: e.target.value }, `Đổi team → ${e.target.value}`)}>{TEAMS.map(p => <option key={p}>{p}</option>)}</select>
            </div>

            <section className="progressSection">
              <div><strong>Tiến độ</strong><span>{task.progress}%</span></div>
              <input type="range" min="0" max="100" step="5" value={task.progress} onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: Number(e.target.value) } : t))} onMouseUp={() => addLog(task, `Cập nhật tiến độ → ${task.progress}%`)} />
            </section>

            <section className="drawerSection"><h4>Bàn giao</h4><input className="fullInput" value={task.deliverable || ''} placeholder="Dán link sản phẩm bàn giao…" onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, deliverable: e.target.value } : t))} /></section>

            <section className="drawerSection"><div className="sectionTitle"><h4>Hoạt động</h4><span>{task.activityCount || 0} cập nhật</span></div>
              <div className="activityList">{logs.filter(l => l.task === task.code).slice(0, 5).map(l => <div key={l.id} className="activityItem"><Avatar name={l.actor} small /><div><strong>{l.actor}</strong> {l.action}<small>{l.time}</small></div></div>)}{!logs.some(l => l.task === task.code) && <p className="emptySmall">Chưa có hoạt động mới.</p>}</div>
            </section>
          </div>

          <div className="drawerFooter">
            {task.status === 'Review' && canApprove ? <><button className="secondaryAction" onClick={() => applyTask(task.id, { status: 'In Progress', review: 'Yêu cầu chỉnh sửa', progress: 90 }, 'Yêu cầu chỉnh sửa')}>↩ Yêu cầu sửa</button><button className="primaryAction" onClick={() => toggleComplete(task)}>✓ Duyệt hoàn thành</button></> : <button className="primaryAction grow" onClick={() => toggleComplete(task)}>{role === 'Nhân viên/CTV' ? '✓ Gửi duyệt' : '✓ Hoàn thành'}</button>}
            <button className="iconAction" title="Lưu trữ" onClick={() => { applyTask(task.id, { archived: true }, 'Đã lưu trữ'); setDrawerId(null); }}>⌁</button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">F</div><div><strong>FPTU Work</strong><span>Marketing & Truyền thông</span></div></div>
        <button className="createBtn" onClick={() => { setScreen('tasks'); setView('list'); setTimeout(() => document.getElementById('quick-add')?.focus(), 50); }}>＋ Tạo công việc</button>
        <nav>
          <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><span>⌂</span>Tổng quan</button>
          <button className={screen === 'tasks' ? 'active' : ''} onClick={() => setScreen('tasks')}><span>✓</span>Công việc <em>{activeTasks.length}</em></button>
          <button className={screen === 'projects' ? 'active' : ''} onClick={() => setScreen('projects')}><span>▦</span>Dự án</button>
          <button className={screen === 'team' ? 'active' : ''} onClick={() => setScreen('team')}><span>♙</span>Nhân sự</button>
          <button className={screen === 'activity' ? 'active' : ''} onClick={() => setScreen('activity')}><span>◴</span>Nhật ký</button>
        </nav>
        <div className="sidebarSection"><label>KHÔNG GIAN</label><button><span className="dot orange" /> Marketing HCM</button><button><span className="dot blue" /> Social</button><button><span className="dot green" /> Media</button></div>
        <div className="sidebarBottom"><label>Test quyền</label><select value={role} onChange={e => setRole(e.target.value)}><option>Trưởng phòng</option><option>Team Lead</option><option>Nhân viên/CTV</option></select><div className="profile"><Avatar name={currentUser} /><div><strong>{currentUser}</strong><span>{role}</span></div><button>•••</button></div></div>
      </aside>

      <main className="main">
        {screen === 'tasks' && <>
          <header className="pageHeader"><div><h1>Công việc</h1><p>Mọi thứ cần làm, trong một nơi.</p></div><div className="headerActions"><button className="lightBtn" onClick={exportExcel}>⇩ Xuất Excel</button><button className="lightBtn" onClick={() => setScreen('invite')}>♧ Mời thành viên</button></div></header>

          <div className="scopeTabs">{['Tất cả', 'Của tôi', 'Tôi giao', 'Theo dõi'].map(s => <button key={s} className={scope === s ? 'active' : ''} onClick={() => setScope(s)}>{s}</button>)}</div>

          <section className="taskWorkspace">
            <div className="workspaceToolbar">
              <div className="searchBox">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm công việc, mã task, người phụ trách…" /></div>
              <div className="filterChips">{['Tất cả', 'Hôm nay', 'Quá hạn', 'Ưu tiên cao', 'Chờ duyệt'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}{f === 'Quá hạn' && stats.overdue > 0 ? ` · ${stats.overdue}` : ''}</button>)}</div>
              <div className="viewSwitch"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☷</button><button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>▦</button></div>
            </div>

            {view === 'list' ? <div className="listView">
              <div className="listHeader"><span></span><span>CÔNG VIỆC</span><span>NGƯỜI PHỤ TRÁCH</span><span>DEADLINE</span><span>ƯU TIÊN</span><span></span><span></span></div>
              <div className="quickAddRow"><span className="quickPlus">＋</span><input id="quick-add" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createQuickTask(quickTitle); if (e.key === 'Escape') setQuickTitle(''); }} placeholder="Thêm công việc… (Enter để tạo)" /></div>
              {filteredTasks.map(task => <TaskRow key={task.id} task={task} />)}
              {filteredTasks.length === 0 && <div className="emptyState"><div>✓</div><strong>Không có công việc nào</strong><span>Thử đổi bộ lọc hoặc tạo task mới.</span></div>}
            </div> : <div className="kanbanBoard">{STATUSES.map(status => <section key={status} className="kanbanColumn" onDragOver={e => e.preventDefault()} onDrop={() => { const task = tasks.find(t => t.id === dragId.current); if (task && task.status !== status) changeStatus(task, status); dragId.current = null; }}><div className="kanbanHead"><div><span className={`statusMini st-${status.replace(' ', '-').toLowerCase()}`}>{STATUS_ICON[status]}</span><strong>{STATUS_LABEL[status]}</strong><em>{filteredTasks.filter(t => t.status === status).length}</em></div><button onClick={() => setQuickColumn(status)}>＋</button></div>{quickColumn === status && <input autoFocus className="kanbanQuickInput" placeholder="Nhập task rồi Enter…" onKeyDown={e => { if (e.key === 'Enter') createQuickTask(e.currentTarget.value, status); if (e.key === 'Escape') setQuickColumn(null); }} />}{filteredTasks.filter(t => t.status === status).map(task => <KanbanCard key={task.id} task={task} />)}<button className="addCardBtn" onClick={() => setQuickColumn(status)}>＋ Thêm công việc</button></section>)}</div>}
          </section>
        </>}

        {screen === 'home' && <><header className="pageHeader"><div><h1>Chào {currentUser} 👋</h1><p>Đây là những việc cần chú ý hôm nay.</p></div></header><div className="metricGrid"><div><span>Cần làm</span><strong>{stats.todo}</strong><small>task đang chờ bắt đầu</small></div><div><span>Đang làm</span><strong>{stats.doing}</strong><small>task đang thực hiện</small></div><div><span>Chờ duyệt</span><strong>{stats.review}</strong><small>cần Lead xử lý</small></div><div className="dangerMetric"><span>Quá hạn</span><strong>{stats.overdue}</strong><small>cần ưu tiên ngay</small></div></div><section className="dashboardPanel"><div className="panelTitle"><h2>Cần xử lý</h2><button onClick={() => setScreen('tasks')}>Xem tất cả →</button></div>{activeTasks.filter(t => t.status !== 'Done').slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}</section></>}

        {screen === 'projects' && <><header className="pageHeader"><div><h1>Dự án</h1><p>Theo dõi tiến độ theo nhóm công việc.</p></div></header><div className="projectGrid">{PROJECTS.map(p => { const pTasks = activeTasks.filter(t => t.project === p); const done = pTasks.filter(t => t.status === 'Done').length; const pct = pTasks.length ? Math.round(done / pTasks.length * 100) : 0; return <article key={p}><div className="projectIcon">▦</div><h3>{p}</h3><p>{pTasks.length} công việc · {done} hoàn thành</p><div className="bar"><i style={{ width: `${pct}%` }} /></div><footer><span>{pct}%</span><div className="avatarStack">{[...new Set(pTasks.map(t => t.assignee))].slice(0, 3).map(n => <Avatar key={n} name={n} small />)}</div></footer></article>; })}</div></>}

        {screen === 'team' && <><header className="pageHeader"><div><h1>Nhân sự</h1><p>Vai trò, team và khối lượng công việc.</p></div></header><div className="peopleTable">{USERS.map(u => { const count = activeTasks.filter(t => t.assignee === u.name).length; return <div key={u.id}><Avatar name={u.name} /><div><strong>{u.name}</strong><span>{u.email}</span></div><span className="rolePill">{u.role}</span><span>{u.team}</span><strong>{count} task</strong><button>•••</button></div>; })}</div></>}

        {screen === 'activity' && <><header className="pageHeader"><div><h1>Nhật ký hoạt động</h1><p>Chỉ đọc · không thể sửa hoặc xóa.</p></div></header><section className="activityPanel">{logs.map(l => <div key={l.id} className="activityLine"><Avatar name={l.actor} /><div><strong>{l.actor}</strong><span>{l.action}</span><button onClick={() => { const t = tasks.find(x => x.code === l.task); if (t) setDrawerId(t.id); }}>{l.task}</button></div><time>{l.time}</time></div>)}</section></>}

        {screen === 'invite' && <><header className="pageHeader"><div><button className="backBtn" onClick={() => setScreen('tasks')}>←</button><h1>Mời thành viên</h1><p>Một link dùng cho nhiều người, có thể giới hạn và thu hồi.</p></div></header><section className="invitePanel"><div className="inviteHero"><div><span>LINK MỜI WORKSPACE</span><strong>Marketing HCM</strong><p>Vai trò mặc định: {invite.role}</p></div><button className={invite.active ? 'activeStatus' : 'inactiveStatus'} onClick={() => setInvite(v => ({ ...v, active: !v.active }))}>{invite.active ? '● Đang hoạt động' : '○ Đã thu hồi'}</button></div><div className="inviteLink"><code>https://fptu-work.vercel.app/join/{invite.token}</code><button onClick={copyInvite}>Copy link</button></div><div className="inviteConfig"><label>Vai trò mặc định<select value={invite.role} onChange={e => setInvite(v => ({ ...v, role: e.target.value }))}><option>Nhân viên/CTV</option><option>Team Lead</option></select></label><label>Hết hạn<input type="date" value={invite.expires} onChange={e => setInvite(v => ({ ...v, expires: e.target.value }))} /></label><label>Số lượt tối đa<input type="number" value={invite.maxUses} onChange={e => setInvite(v => ({ ...v, maxUses: Number(e.target.value) }))} /></label></div><div className="inviteUsage"><div><strong>{invite.uses}</strong><span>đã tham gia</span></div><div><strong>{invite.maxUses - invite.uses}</strong><span>lượt còn lại</span></div><div><strong>{fmt(invite.expires)}</strong><span>ngày hết hạn</span></div></div></section></>}
      </main>

      <Drawer />
      {toast && <div className="toast"><span>{toast.message}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Hoàn tác</button>}<button className="toastClose" onClick={() => setToast(null)}>×</button></div>}
    </div>
  );
}
