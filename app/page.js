'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getSupabase } from '../lib/supabase';

const STATUS = {
  todo: { label: 'Cần làm', icon: '○' },
  in_progress: { label: 'Đang làm', icon: '◐' },
  review: { label: 'Chờ duyệt', icon: '◌' },
  done: { label: 'Hoàn thành', icon: '✓' },
  cancelled: { label: 'Đã hủy', icon: '×' },
};
const PRIORITY = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' };
const ROLE = { manager: 'Trưởng phòng', team_lead: 'Team Lead', member: 'Nhân viên/CTV' };
const KANBAN = ['todo', 'in_progress', 'review', 'done'];

function viDate(value, withTime = false) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', withTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dueLabel(task) {
  if (!task.due_at) return 'Chưa có hạn';
  if (task.status === 'done') return `Xong ${viDate(task.completed_at)}`;
  const ms = new Date(task.due_at).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return `Trễ ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return viDate(task.due_at);
}

function Avatar({ profile, size = 'normal' }) {
  const name = profile?.full_name || profile?.email || '?';
  if (profile?.avatar_url) return <img className={`avatar ${size}`} src={profile.avatar_url} alt={name} />;
  return <span className={`avatar fallback ${size}`}>{name.slice(0, 1).toUpperCase()}</span>;
}

function LoginScreen({ onLogin, error }) {
  return (
    <main className="authShell">
      <section className="authCard">
        <div className="brandMark">F</div>
        <h1>FPTU Work</h1>
        <p>Giao việc, phối hợp, review và theo dõi tiến độ trong một nơi.</p>
        {error ? <div className="errorBox">{error}</div> : null}
        <button className="googleButton" onClick={onLogin}>
          <span className="googleG">G</span> Tiếp tục với Google
        </button>
        <small>Bất kỳ tài khoản Google nào cũng có thể đăng nhập. Quyền dữ liệu được kiểm soát bằng workspace/invite.</small>
      </section>
    </main>
  );
}

function AccessGate({ profile, onLogout, inviteError }) {
  return (
    <main className="authShell">
      <section className="authCard">
        <Avatar profile={profile} />
        <h2>Chào {profile?.full_name || profile?.email}</h2>
        <p>Bạn đã đăng nhập Google nhưng chưa thuộc workspace FPTU Work.</p>
        {inviteError ? <div className="errorBox">{inviteError}</div> : null}
        <p className="hint">Hãy mở đúng link mời do Trưởng phòng gửi. Link mời có dạng <b>https://fptu-work.vercel.app/?invite=...</b></p>
        <button className="secondaryButton" onClick={onLogout}>Đăng xuất</button>
      </section>
    </main>
  );
}

export default function Home() {
  const supabase = useMemo(() => getSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTeam, setQuickTeam] = useState('');
  const [quickAssignee, setQuickAssignee] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [toast, setToast] = useState('');
  const [invitePanel, setInvitePanel] = useState(false);
  const [invites, setInvites] = useState([]);
  const [inviteError, setInviteError] = useState('');

  const role = membership?.role;
  const canManage = role === 'manager' || role === 'team_lead';
  const isManager = role === 'manager';

  const flash = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const loadMembership = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    setMembership(data || null);
    return data || null;
  }, [supabase]);

  const loadWorkspaceData = useCallback(async (m) => {
    if (!m) return;
    const [w, t, mem, p, taskRes, n] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', m.workspace_id).single(),
      supabase.from('teams').select('*').eq('workspace_id', m.workspace_id).order('name'),
      supabase.from('memberships').select('*').eq('workspace_id', m.workspace_id).eq('status', 'active'),
      supabase.from('projects').select('*').eq('workspace_id', m.workspace_id).order('created_at'),
      supabase.from('tasks').select('*').eq('workspace_id', m.workspace_id).is('archived_at', null).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    if (w.error) throw w.error;
    if (t.error) throw t.error;
    if (mem.error) throw mem.error;
    if (p.error) throw p.error;
    if (taskRes.error) throw taskRes.error;
    setWorkspace(w.data);
    setTeams(t.data || []);
    setProjects(p.data || []);
    setTasks(taskRes.data || []);
    setNotifications(n.data || []);

    const ids = [...new Set((mem.data || []).map(x => x.user_id))];
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('*').in('id', ids)
      : { data: [] };
    const pMap = Object.fromEntries((profiles || []).map(x => [x.id, x]));
    setMembers((mem.data || []).map(x => ({ ...x, profile: pMap[x.user_id] || null })));

    if (!quickTeam) setQuickTeam(m.team_id || t.data?.[0]?.id || '');
    if (!quickAssignee) setQuickAssignee(m.user_id);
  }, [supabase, quickTeam, quickAssignee]);

  const boot = useCallback(async () => {
    if (!supabase) {
      setAuthError('Thiếu biến môi trường Supabase trên Vercel.');
      setLoading(false);
      return;
    }
    try {
      const { data: { session: current } } = await supabase.auth.getSession();
      setSession(current);
      if (!current?.user) { setLoading(false); return; }

      const { data: me } = await supabase.from('profiles').select('*').eq('id', current.user.id).maybeSingle();
      setProfile(me || { id: current.user.id, email: current.user.email, full_name: current.user.user_metadata?.full_name });

      let m = await loadMembership(current.user.id);
      const invite = new URLSearchParams(window.location.search).get('invite');
      if (!m && invite) {
        const { error } = await supabase.rpc('accept_invitation', { p_token: invite });
        if (error) setInviteError(error.message);
        else {
          window.history.replaceState({}, '', window.location.pathname);
          m = await loadMembership(current.user.id);
        }
      }
      if (!m) {
        const { data: result } = await supabase.rpc('bootstrap_first_manager');
        if (result?.bootstrapped) m = await loadMembership(current.user.id);
      }
      if (m) await loadWorkspaceData(m);
    } catch (e) {
      setAuthError(e.message || 'Không thể khởi tạo ứng dụng.');
    } finally {
      setLoading(false);
    }
  }, [supabase, loadMembership, loadWorkspaceData]);

  useEffect(() => {
    boot();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [boot, supabase]);

  useEffect(() => {
    if (!supabase || !membership) return;
    const channel = supabase.channel('fptu-work-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadWorkspaceData(membership))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadWorkspaceData(membership))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [supabase, membership, loadWorkspaceData]);

  async function login() {
    setAuthError('');
    const redirectTo = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setAuthError(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const profileMap = useMemo(() => Object.fromEntries(members.map(m => [m.user_id, m.profile])), [members]);
  const teamMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  const visibleTasks = useMemo(() => tasks.filter(t => {
    const q = query.trim().toLowerCase();
    const assignee = profileMap[t.assignee_id]?.full_name || profileMap[t.assignee_id]?.email || '';
    const text = `${t.code} ${t.title} ${teamMap[t.team_id]?.name || ''} ${assignee}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (scope === 'mine' && t.assignee_id !== session?.user?.id) return false;
    if (scope === 'assigned' && t.assigner_id !== session?.user?.id) return false;
    if (scope === 'review' && t.status !== 'review') return false;
    if (scope === 'overdue' && (!t.due_at || ['done', 'cancelled'].includes(t.status) || new Date(t.due_at) >= new Date())) return false;
    return true;
  }), [tasks, query, scope, profileMap, teamMap, session]);

  const selected = tasks.find(t => t.id === selectedId) || null;

  async function openTask(task) {
    setSelectedId(task.id);
    const [c, a] = await Promise.all([
      supabase.from('task_comments').select('*').eq('task_id', task.id).is('deleted_at', null).order('created_at'),
      supabase.from('task_activity_logs').select('*').eq('task_id', task.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setComments(c.data || []);
    setActivity(a.data || []);
  }

  async function updateTask(task, patch, message = 'Đã cập nhật') {
    const old = { ...task };
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...patch } : t));
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? old : t));
      flash(`Không thể cập nhật: ${error.message}`);
      return false;
    }
    flash(message);
    return true;
  }

  async function tickTask(task) {
    if (task.status === 'done') {
      if (!canManage) return flash('Bạn không có quyền mở lại task đã duyệt');
      return updateTask(task, { status: 'in_progress', progress: Math.min(task.progress || 90, 90), completed_at: null }, 'Đã mở lại task');
    }
    if (role === 'member') {
      return updateTask(task, { status: 'review', progress: 100, accepted_at: task.accepted_at || new Date().toISOString() }, 'Đã gửi duyệt');
    }
    return updateTask(task, { status: 'done', progress: 100, completed_at: new Date().toISOString() }, 'Đã hoàn thành');
  }

  async function createTask(e) {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || !canManage) return;
    const teamId = quickTeam || membership.team_id || teams[0]?.id;
    if (!teamId) return flash('Chưa có team');
    const { data: code, error: codeError } = await supabase.rpc('next_task_code', { p_team_id: teamId });
    if (codeError) return flash(codeError.message);
    const assignee = quickAssignee || session.user.id;
    const { error } = await supabase.from('tasks').insert({
      workspace_id: membership.workspace_id,
      team_id: teamId,
      code,
      title,
      assigner_id: session.user.id,
      assignee_id: assignee,
      due_at: quickDue ? new Date(`${quickDue}T17:00:00`).toISOString() : null,
      priority: 'medium',
    });
    if (error) return flash(error.message);
    setQuickTitle(''); setQuickDue(''); flash(`Đã tạo ${code}`);
    await loadWorkspaceData(membership);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!selected || !commentDraft.trim()) return;
    const { error } = await supabase.from('task_comments').insert({
      task_id: selected.id,
      user_id: session.user.id,
      content: commentDraft.trim(),
    });
    if (error) return flash(error.message);
    setCommentDraft('');
    await openTask(selected);
    flash('Đã bình luận');
  }

  async function editComment(c) {
    if (c.user_id !== session.user.id) return;
    const next = window.prompt('Chỉnh sửa bình luận', c.content);
    if (!next?.trim()) return;
    const { error } = await supabase.from('task_comments').update({ content: next.trim(), updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) return flash(error.message);
    await openTask(selected);
  }

  async function deleteComment(c) {
    if (c.user_id !== session.user.id) return;
    const { error } = await supabase.from('task_comments').update({ deleted_at: new Date().toISOString() }).eq('id', c.id);
    if (error) return flash(error.message);
    await openTask(selected);
  }

  async function createInvite() {
    if (!isManager) return;
    const teamId = membership.team_id || teams[0]?.id || null;
    const expires = new Date(); expires.setDate(expires.getDate() + 14);
    const { data, error } = await supabase.from('invitations').insert({
      workspace_id: membership.workspace_id,
      team_id: teamId,
      role: 'member',
      expires_at: expires.toISOString(),
      max_uses: 50,
      created_by: session.user.id,
    }).select().single();
    if (error) return flash(error.message);
    const url = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/?invite=${data.token}`;
    await navigator.clipboard.writeText(url);
    flash('Đã tạo và copy link mời');
    loadInvites();
  }

  async function loadInvites() {
    if (!isManager) return;
    const { data } = await supabase.from('invitations').select('*').eq('workspace_id', membership.workspace_id).order('created_at', { ascending: false });
    setInvites(data || []);
  }

  async function toggleInvitePanel() {
    const next = !invitePanel; setInvitePanel(next);
    if (next) await loadInvites();
  }

  async function revokeInvite(inv) {
    await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', inv.id);
    loadInvites(); flash('Đã thu hồi link');
  }

  async function markNotificationsRead() {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  function exportExcel() {
    const rows = visibleTasks.map(t => ({
      'Mã task': t.code,
      'Công việc': t.title,
      'Team': teamMap[t.team_id]?.name || '',
      'Dự án': projectMap[t.project_id]?.name || '',
      'Người giao': profileMap[t.assigner_id]?.full_name || profileMap[t.assigner_id]?.email || '',
      'Người thực hiện': profileMap[t.assignee_id]?.full_name || profileMap[t.assignee_id]?.email || '',
      'Ngày tạo': viDate(t.created_at, true),
      'Ngày xác nhận': viDate(t.accepted_at, true),
      'Deadline': viDate(t.due_at, true),
      'Ngày hoàn thành': viDate(t.completed_at, true),
      'Trạng thái': STATUS[t.status]?.label || t.status,
      'Tiến độ %': t.progress,
      'Ưu tiên': PRIORITY[t.priority] || t.priority,
      'Link bàn giao': t.delivery_url || '',
      'Lý do hủy': t.cancel_reason || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tasks');
    XLSX.writeFile(wb, `FPTU-Work-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  if (loading) return <main className="loadingScreen"><div className="spinner" />Đang tải FPTU Work…</main>;
  if (!session?.user) return <LoginScreen onLogin={login} error={authError} />;
  if (!membership) return <AccessGate profile={profile} onLogout={logout} inviteError={inviteError || authError} />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark smallMark">F</span><b>FPTU Work</b></div>
        <nav>
          <button className="navActive">✓ <span>Tasks</span></button>
          <button onClick={() => setScope('mine')}>◎ <span>Của tôi</span></button>
          <button onClick={() => setScope('review')}>◌ <span>Chờ duyệt</span></button>
          <button onClick={exportExcel}>⇩ <span>Xuất Excel</span></button>
        </nav>
        <div className="sidebarBottom">
          <div className="meRow"><Avatar profile={profile} size="small"/><div><b>{profile?.full_name || profile?.email}</b><small>{ROLE[role]}</small></div></div>
          <button className="textButton" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="mainArea">
        <header className="topbar">
          <div>
            <h1>Tasks</h1>
            <p>{workspace?.name} · {teamMap[membership.team_id]?.name || 'Toàn workspace'}</p>
          </div>
          <div className="topActions">
            {isManager && <button className="secondaryButton" onClick={toggleInvitePanel}>＋ Mời thành viên</button>}
            <button className="iconButton" onClick={markNotificationsRead} title="Thông báo">🔔{unreadCount ? <span>{unreadCount}</span> : null}</button>
            <Avatar profile={profile} />
          </div>
        </header>

        {invitePanel && isManager ? (
          <section className="invitePanel">
            <div className="sectionHead"><div><h3>Link mời nhiều người</h3><p>Mặc định role Nhân viên/CTV, tối đa 50 lượt, hết hạn sau 14 ngày.</p></div><button className="primaryButton" onClick={createInvite}>Tạo & copy link</button></div>
            {invites.map(inv => <div className="inviteRow" key={inv.id}>
              <code>{`${process.env.NEXT_PUBLIC_APP_URL || ''}/?invite=${inv.token}`}</code>
              <span>{inv.usage_count}/{inv.max_uses || '∞'} lượt</span>
              <span>{inv.revoked_at ? 'Đã thu hồi' : `Hết hạn ${viDate(inv.expires_at)}`}</span>
              {!inv.revoked_at && <button onClick={() => revokeInvite(inv)}>Thu hồi</button>}
            </div>)}
          </section>
        ) : null}

        <section className="toolbar">
          <input className="search" placeholder="Tìm mã task, công việc, người phụ trách…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="chips">
            {[['all','Tất cả'],['mine','Của tôi'],['assigned','Tôi giao'],['review','Chờ duyệt'],['overdue','Quá hạn']].map(([k,l]) => <button key={k} className={scope===k?'chip active':'chip'} onClick={() => setScope(k)}>{l}</button>)}
          </div>
          <div className="viewSwitch"><button className={view==='list'?'active':''} onClick={() => setView('list')}>☷ List</button><button className={view==='kanban'?'active':''} onClick={() => setView('kanban')}>▦ Kanban</button></div>
        </section>

        {canManage ? (
          <form className="quickAdd" onSubmit={createTask}>
            <span>＋</span>
            <input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} placeholder="Thêm task nhanh rồi nhấn Enter…" />
            <select value={quickTeam} onChange={e => { setQuickTeam(e.target.value); setQuickAssignee(''); }}>
              {teams.filter(t => role==='manager' || t.id===membership.team_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={quickAssignee} onChange={e => setQuickAssignee(e.target.value)}>
              <option value={session.user.id}>Tôi</option>
              {members.filter(m => !quickTeam || m.team_id===quickTeam || role==='manager').map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.profile?.email || m.user_id}</option>)}
            </select>
            <input type="date" value={quickDue} onChange={e => setQuickDue(e.target.value)} />
            <button className="primaryButton">Tạo</button>
          </form>
        ) : null}

        {view === 'list' ? (
          <section className="taskList">
            <div className="taskHeader"><span></span><span>Công việc</span><span>Người thực hiện</span><span>Deadline</span><span>Ưu tiên</span><span>Trạng thái</span></div>
            {visibleTasks.map(task => (
              <div className={`taskRow ${task.status==='done'?'done':''}`} key={task.id}>
                <button className={`check ${task.status==='done'?'checked':''}`} onClick={() => tickTask(task)}>{task.status==='done'?'✓':''}</button>
                <button className="taskTitle" onClick={() => openTask(task)}><small>{task.code}</small><b>{task.title}</b></button>
                <div className="personCell"><Avatar profile={profileMap[task.assignee_id]} size="small"/><span>{profileMap[task.assignee_id]?.full_name || profileMap[task.assignee_id]?.email || 'Chưa giao'}</span></div>
                <span className={task.due_at && new Date(task.due_at)<new Date() && !['done','cancelled'].includes(task.status)?'overdue':''}>{dueLabel(task)}</span>
                {canManage ? <select value={task.priority} onChange={e => updateTask(task,{priority:e.target.value},'Đã đổi ưu tiên')}>{Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select> : <span>{PRIORITY[task.priority]}</span>}
                <span className={`statusPill s-${task.status}`}>{STATUS[task.status]?.icon} {STATUS[task.status]?.label}</span>
              </div>
            ))}
            {!visibleTasks.length && <div className="empty">Không có task phù hợp.</div>}
          </section>
        ) : (
          <section className="kanban">
            {KANBAN.map(status => <div className="kanbanCol" key={status} onDragOver={e => e.preventDefault()} onDrop={async e => {
              const id=e.dataTransfer.getData('text/task-id'); const task=tasks.find(t=>t.id===id); if(task) await updateTask(task,{status: role==='member'&&status==='done'?'review':status},`Đã chuyển ${STATUS[status].label}`);
            }}>
              <div className="kanbanHead"><b>{STATUS[status].label}</b><span>{visibleTasks.filter(t=>t.status===status).length}</span></div>
              {visibleTasks.filter(t=>t.status===status).map(task => <article className="kanbanCard" key={task.id} draggable onDragStart={e=>e.dataTransfer.setData('text/task-id',task.id)} onClick={()=>openTask(task)}>
                <small>{task.code}</small><h4>{task.title}</h4><div className="cardFoot"><Avatar profile={profileMap[task.assignee_id]} size="small"/><span className={task.due_at&&new Date(task.due_at)<new Date()?'overdue':''}>{dueLabel(task)}</span></div>
              </article>)}
            </div>)}
          </section>
        )}
      </main>

      {selected ? <aside className="drawer">
        <div className="drawerTop"><div><small>{selected.code}</small><h2>{selected.title}</h2></div><button className="closeButton" onClick={()=>setSelectedId(null)}>×</button></div>
        <div className="drawerFields">
          <label><span>Trạng thái</span>{canManage ? <select value={selected.status} onChange={e=>updateTask(selected,{status:e.target.value},'Đã đổi trạng thái')}>{KANBAN.map(s=><option key={s} value={s}>{STATUS[s].label}</option>)}<option value="cancelled">Đã hủy</option></select> : <b>{STATUS[selected.status]?.label}</b>}</label>
          <label><span>Người thực hiện</span><div className="personCell"><Avatar profile={profileMap[selected.assignee_id]} size="small"/><b>{profileMap[selected.assignee_id]?.full_name || profileMap[selected.assignee_id]?.email || '—'}</b></div></label>
          <label><span>Team</span><b>{teamMap[selected.team_id]?.name || '—'}</b></label>
          <label><span>Deadline</span>{canManage ? <input type="datetime-local" value={selected.due_at ? new Date(new Date(selected.due_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : ''} onChange={e=>updateTask(selected,{due_at:e.target.value?new Date(e.target.value).toISOString():null},'Đã đổi deadline')} /> : <b>{viDate(selected.due_at,true)}</b>}</label>
          <label><span>Tiến độ</span><div className="progressEdit"><input type="range" min="0" max="100" value={selected.progress||0} onChange={e=>setTasks(prev=>prev.map(t=>t.id===selected.id?{...t,progress:Number(e.target.value)}:t))} onMouseUp={e=>updateTask(selected,{progress:Number(e.currentTarget.value)},'Đã cập nhật tiến độ')} /><b>{selected.progress||0}%</b></div></label>
          <label><span>Link bàn giao</span><input placeholder="https://..." value={selected.delivery_url||''} onChange={e=>setTasks(prev=>prev.map(t=>t.id===selected.id?{...t,delivery_url:e.target.value}:t))} onBlur={e=>updateTask(selected,{delivery_url:e.target.value},'Đã lưu link bàn giao')} /></label>
        </div>
        <section className="drawerSection"><h3>Mô tả</h3><p>{selected.description || 'Chưa có mô tả.'}</p></section>
        <section className="drawerSection"><h3>Bình luận <span>{comments.length}</span></h3>
          <form className="commentComposer" onSubmit={addComment}><textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder="Viết bình luận, @mention, dán link…"/><button className="primaryButton">Gửi</button></form>
          <div className="commentList">{comments.map(c=><article className="comment" key={c.id}><Avatar profile={profileMap[c.user_id] || (c.user_id===session.user.id?profile:null)} size="small"/><div><div className="commentMeta"><b>{profileMap[c.user_id]?.full_name || (c.user_id===session.user.id?profile?.full_name:null) || 'Thành viên'}</b><span>{viDate(c.created_at,true)}{c.updated_at?' · đã sửa':''}</span></div><p>{c.content}</p>{c.user_id===session.user.id?<div className="commentActions"><button onClick={()=>editComment(c)}>Sửa</button><button onClick={()=>deleteComment(c)}>Xóa</button></div>:null}</div></article>)}</div>
        </section>
        <section className="drawerSection"><h3>Nhật ký hoạt động</h3>{activity.map(a=><div className="activityItem" key={a.id}><span>•</span><div><b>{a.action.replaceAll('_',' ')}</b><small>{viDate(a.created_at,true)}</small></div></div>)}</section>
      </aside> : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
