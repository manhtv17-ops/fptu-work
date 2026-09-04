'use client'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase, appUrl } from '../lib/supabase'
import { canCreateProject, canManageWorkspace, canCreateTask, canReviewTask } from '../lib/permissions'

const STATUS = ['todo','in_progress','review','done']
const LABEL = { todo:'To-do', in_progress:'In Progress', review:'Review', done:'Done', planning:'Planning', active:'Active', on_hold:'On Hold', completed:'Completed', cancelled:'Cancelled', archived:'Archived' }
const PRIORITY = { low:'Low', medium:'Medium', high:'High', urgent:'Urgent' }

function fmtDate(v){ if(!v) return '—'; return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v)) }
function fmtDateTime(v){ if(!v) return ''; return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)) }
function initials(name=''){ return name.split(' ').slice(-2).map(x=>x[0]).join('').toUpperCase() || '?' }

export default function Home(){
  const [session,setSession]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState('')
  const [profile,setProfile]=useState(null), [membership,setMembership]=useState(null), [workspace,setWorkspace]=useState(null)
  const [projects,setProjects]=useState([]), [project,setProject]=useState(null), [projectMembers,setProjectMembers]=useState([]), [tasks,setTasks]=useState([])
  const [members,setMembers]=useState([]), [teams,setTeams]=useState([]), [view,setView]=useState('projects'), [projectTab,setProjectTab]=useState('overview')
  const [taskDrawer,setTaskDrawer]=useState(null), [memberDrawer,setMemberDrawer]=useState(null), [search,setSearch]=useState(''), [quickTitle,setQuickTitle]=useState('')
  const [toast,setToast]=useState(''), [notifications,setNotifications]=useState([])

  useEffect(()=>{
    if(!supabase){ setError('Thiếu biến môi trường Supabase.'); setLoading(false); return }
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); if(data.session) bootstrap(data.session.user); else setLoading(false) })
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{ setSession(s); if(s) bootstrap(s.user); else {setProfile(null);setMembership(null);setLoading(false)} })
    return ()=>sub.subscription.unsubscribe()
  },[])

  async function bootstrap(user){
    try{
      setLoading(true); setError('')
      const invite = new URLSearchParams(window.location.search).get('invite') || sessionStorage.getItem('fptu_invite')
      if(invite) sessionStorage.setItem('fptu_invite', invite)
      if(invite){ await supabase.rpc('accept_invitation',{p_token:invite}).catch(()=>{}) }
      const {data:p}=await supabase.from('profiles').select('*').eq('id',user.id).single(); setProfile(p || {id:user.id,full_name:user.user_metadata?.full_name,email:user.email,avatar_url:user.user_metadata?.avatar_url})
      const {data:m}=await supabase.from('memberships').select('*, teams(*)').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle(); setMembership(m)
      if(!m){ setLoading(false); return }
      const {data:w}=await supabase.from('workspaces').select('*').eq('id',m.workspace_id).single(); setWorkspace(w)
      const [{data:ps},{data:ts},{data:ms},{data:ns}] = await Promise.all([
        supabase.from('projects').select('*, teams(name,code), profiles!projects_lead_id_fkey(full_name,avatar_url)').eq('workspace_id',m.workspace_id).is('archived_at',null).order('created_at',{ascending:false}),
        supabase.from('teams').select('*').eq('workspace_id',m.workspace_id).order('name'),
        supabase.from('memberships').select('*, profiles(*), teams(*)').eq('workspace_id',m.workspace_id).eq('status','active'),
        supabase.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
      ])
      setProjects(ps||[]); setTeams(ts||[]); setMembers(ms||[]); setNotifications(ns||[])
      setLoading(false)
    }catch(e){ setError(e.message); setLoading(false) }
  }

  async function login(){
    const invite = new URLSearchParams(window.location.search).get('invite')
    if(invite) sessionStorage.setItem('fptu_invite',invite)
    const redirectTo = invite ? `${appUrl}/?invite=${encodeURIComponent(invite)}` : appUrl
    await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}})
  }
  async function logout(){ await supabase.auth.signOut(); location.href='/' }

  async function openProject(p){
    setProject(p); setView('project'); setProjectTab('overview')
    const [{data:pm},{data:t}] = await Promise.all([
      supabase.from('project_members').select('*, profiles(*)').eq('project_id',p.id),
      supabase.from('tasks').select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), project:projects(name,code)').eq('project_id',p.id).is('archived_at',null).order('created_at',{ascending:false})
    ])
    setProjectMembers(pm||[]); setTasks(t||[])
  }

  async function createProject(){
    if(!canCreateProject(membership)) return
    const name=prompt('Tên Project'); if(!name) return
    const team = teams.find(x=>x.id===membership.team_id) || teams[0]; if(!team) return alert('Chưa có Team')
    const code = prompt('Mã Project (VD: ORT-K22)','PROJECT') || 'PROJECT'
    const {data,error:e}=await supabase.from('projects').insert({workspace_id:membership.workspace_id,team_id:team.id,name,code:code.toUpperCase(),lead_id:session.user.id,created_by:session.user.id,status:'active',visibility:'team'}).select().single()
    if(e) return alert(e.message)
    await supabase.from('project_members').insert({project_id:data.id,user_id:session.user.id,role_in_project:'lead',can_create_task:true,can_assign_task:true,can_review_task:true,can_manage_members:true})
    setProjects([data,...projects]); showToast('Đã tạo Project'); openProject(data)
  }

  const currentProjectMember = projectMembers.find(x=>x.user_id===session?.user?.id)
  const canTask = project ? canCreateTask(membership,currentProjectMember) : false

  async function quickCreateTask(){
    const title=quickTitle.trim(); if(!title || !project || !canTask) return
    const {data:code}=await supabase.rpc('next_task_code',{p_team_id:project.team_id})
    const {data,error:e}=await supabase.from('tasks').insert({workspace_id:membership.workspace_id,project_id:project.id,team_id:project.team_id,code,title,status:'todo',priority:'medium',progress:0,assigner_id:session.user.id,assignee_id:session.user.id}).select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email)').single()
    if(e) return alert(e.message)
    setTasks([data,...tasks]); setQuickTitle(''); showToast('Đã thêm task')
  }

  async function updateTask(id, patch){
    const old=tasks.find(t=>t.id===id); setTasks(tasks.map(t=>t.id===id?{...t,...patch}:t)); if(taskDrawer?.id===id) setTaskDrawer({...taskDrawer,...patch})
    const {error:e}=await supabase.from('tasks').update(patch).eq('id',id)
    if(e){ setTasks(tasks.map(t=>t.id===id?old:t)); alert(e.message) } else showToast('Đã lưu')
  }

  async function completeByCheckbox(t){
    if(t.status==='done') return updateTask(t.id,{status:'in_progress',completed_at:null})
    const requireReview=project?.require_task_review !== false
    const next = requireReview && !canReviewTask(membership,currentProjectMember) ? 'review':'done'
    await updateTask(t.id,{status:next,progress:next==='done'?100:t.progress,completed_at:next==='done'?new Date().toISOString():null})
  }

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(''),2200) }
  const filtered = useMemo(()=>tasks.filter(t=>`${t.code} ${t.title} ${t.profiles?.full_name||''}`.toLowerCase().includes(search.toLowerCase())),[tasks,search])
  const stats = useMemo(()=>({total:tasks.length,done:tasks.filter(x=>x.status==='done').length,review:tasks.filter(x=>x.status==='review').length,overdue:tasks.filter(x=>x.due_at&&new Date(x.due_at)<new Date()&&x.status!=='done').length}),[tasks])
  const progress = stats.total ? Math.round(stats.done/stats.total*100):0

  async function exportExcel(){
    const rows=filtered.map(t=>({Project:project?.name,'Task code':t.code,'Task name':t.title,Assignee:t.profiles?.full_name||'',Status:LABEL[t.status]||t.status,Progress:t.progress,Priority:PRIORITY[t.priority]||t.priority,Deadline:t.due_at||'',Completed:t.completed_at||'',Description:t.description||'',Delivery:t.delivery_url||''}))
    const ws=XLSX.utils.json_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Tasks'); XLSX.writeFile(wb,`${project?.code||'project'}-report.xlsx`)
  }

  if(loading) return <div className="center"><div className="spinner"/>Đang tải FPTU Work...</div>
  if(error) return <div className="center errorBox">{error}</div>
  if(!session) return <Login onLogin={login}/>
  if(!membership) return <NoMembership profile={profile} onLogout={logout}/>

  return <div className="appShell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">F</div><div><b>FPTU Work</b><small>Project Workspace</small></div></div>
      <nav>
        <button className={view==='home'?'active':''} onClick={()=>setView('home')}>⌂ <span>Home</span></button>
        <button className={view==='mytasks'?'active':''} onClick={()=>setView('mytasks')}>✓ <span>My Tasks</span></button>
        <button className={view==='projects'||view==='project'?'active':''} onClick={()=>{setView('projects');setProject(null)}}>▦ <span>Projects</span></button>
        <button className={view==='teams'?'active':''} onClick={()=>setView('teams')}>♟ <span>Teams</span></button>
        {canManageWorkspace(membership)&&<button className={view==='members'?'active':''} onClick={()=>setView('members')}>♙ <span>Members</span></button>}
        <button className={view==='reports'?'active':''} onClick={()=>setView('reports')}>▥ <span>Reports</span></button>
      </nav>
      <div className="sideProjects"><div className="sectionLabel">PROJECTS</div>{projects.slice(0,7).map(p=><button key={p.id} onClick={()=>openProject(p)}><i/> <span>{p.name}</span></button>)}</div>
      <div className="userMini"><Avatar p={profile}/><div><b>{profile?.full_name||profile?.email}</b><small>{membership.role==='manager'?'Trưởng phòng':membership.role==='team_lead'?'Team Lead':'Member/CTV'}</small></div><button onClick={logout}>↪</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><b>{workspace?.name||'FPTU Work'}</b><span className="crumb"> / {view==='project'?project?.name:view}</span></div><div className="topActions"><button className="iconBtn" title="Thông báo">🔔{notifications.filter(n=>!n.is_read).length>0&&<em>{notifications.filter(n=>!n.is_read).length}</em>}</button><Avatar p={profile}/></div></header>
      {view==='projects'&&<Projects projects={projects} onOpen={openProject} onCreate={createProject} canCreate={canCreateProject(membership)}/>} 
      {view==='project'&&project&&<ProjectPage project={project} setProject={setProject} tab={projectTab} setTab={setProjectTab} stats={stats} progress={progress} tasks={filtered} search={search} setSearch={setSearch} quickTitle={quickTitle} setQuickTitle={setQuickTitle} quickCreateTask={quickCreateTask} canTask={canTask} members={projectMembers} openTask={setTaskDrawer} updateTask={updateTask} completeByCheckbox={completeByCheckbox} exportExcel={exportExcel} membership={membership} currentProjectMember={currentProjectMember}/>} 
      {view==='home'&&<HomeDashboard projects={projects} members={members}/>} 
      {view==='mytasks'&&<MyTasks membership={membership} onOpenProject={openProject}/>} 
      {view==='teams'&&<Teams teams={teams} projects={projects}/>} 
      {view==='members'&&canManageWorkspace(membership)&&<Members members={members} teams={teams} onOpen={setMemberDrawer}/>} 
      {view==='reports'&&<Reports projects={projects} members={members}/>} 
    </main>
    {taskDrawer&&<TaskDrawer task={taskDrawer} project={project} projectMembers={projectMembers} membership={membership} currentProjectMember={currentProjectMember} onClose={()=>setTaskDrawer(null)} onUpdate={updateTask}/>} 
    {memberDrawer&&<MemberDrawer item={memberDrawer} teams={teams} onClose={()=>setMemberDrawer(null)} onSaved={()=>bootstrap(session.user)}/>} 
    {toast&&<div className="toast">✓ {toast}</div>}
  </div>
}

function Login({onLogin}){ return <div className="loginPage"><div className="loginCard"><div className="loginLogo">F</div><h1>FPTU Work</h1><p>Project Management Workspace</p><button className="googleBtn" onClick={onLogin}><span>G</span> Tiếp tục với Google</button><small>Bất kỳ tài khoản Google nào cũng có thể đăng nhập. Quyền truy cập được kiểm soát bằng workspace/project membership.</small></div></div> }
function NoMembership({profile,onLogout}){ return <div className="loginPage"><div className="loginCard"><Avatar p={profile} big/><h2>{profile?.full_name}</h2><p>Bạn đã đăng nhập nhưng chưa thuộc workspace. Hãy mở lại link mời từ Trưởng phòng/Team Lead.</p><button className="secondary" onClick={onLogout}>Đăng xuất</button></div></div> }
function Avatar({p,big}){ return p?.avatar_url?<img className={big?'avatar big':'avatar'} src={p.avatar_url} alt=""/>:<div className={big?'avatar fallback big':'avatar fallback'}>{initials(p?.full_name||p?.email)}</div> }

function Projects({projects,onOpen,onCreate,canCreate}){ return <section className="page"><div className="pageHead"><div><h1>Projects</h1><p>Quản lý toàn bộ chiến dịch và không gian phối hợp công việc.</p></div>{canCreate&&<button className="primary" onClick={onCreate}>＋ New Project</button>}</div><div className="projectGrid">{projects.map(p=><article className="projectCard" key={p.id} onClick={()=>onOpen(p)}><div className="projectIcon">{(p.code||'P').slice(0,2)}</div><div className="projectMeta"><span className={'pill '+p.status}>{LABEL[p.status]||p.status}</span><span>{p.teams?.name||''}</span></div><h3>{p.name}</h3><p>{p.description||'Chưa có mô tả. Click vào Project để bổ sung.'}</p><div className="projectFoot"><span>Lead: {p.profiles?.full_name||'—'}</span><span>{fmtDate(p.due_at)}</span></div></article>)}{!projects.length&&<div className="empty">Chưa có Project nào.</div>}</div></section> }

function ProjectPage({project,setProject,tab,setTab,stats,progress,tasks,search,setSearch,quickTitle,setQuickTitle,quickCreateTask,canTask,members,openTask,updateTask,completeByCheckbox,exportExcel,membership,currentProjectMember}){
  async function saveDescription(){ const v=prompt('Mô tả Project',project.description||''); if(v===null)return; const {error}=await supabase.from('projects').update({description:v}).eq('id',project.id); if(!error) setProject({...project,description:v}) }
  return <section className="page projectPage"><div className="projectHeader"><div className="projectIcon large">{(project.code||'P').slice(0,2)}</div><div className="grow"><div className="eyebrow">{project.code} · {project.teams?.name||''}</div><h1>{project.name}</h1><div className="desc" onClick={saveDescription}>{project.description||'+ Thêm mô tả Project'}</div></div><span className={'pill '+project.status}>{LABEL[project.status]||project.status}</span></div>
  <div className="tabs">{['overview','list','kanban','files','activity','report'].map(x=><button className={tab===x?'active':''} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>
  {tab==='overview'&&<><div className="statGrid"><Stat label="Progress" value={`${progress}%`}/><Stat label="Total tasks" value={stats.total}/><Stat label="Review" value={stats.review}/><Stat label="Overdue" value={stats.overdue} danger/></div><div className="overviewGrid"><div className="panel"><h3>Project overview</h3><Info label="Team" value={project.teams?.name||'—'}/><Info label="Bắt đầu" value={fmtDate(project.start_at)}/><Info label="Deadline" value={fmtDate(project.due_at)}/><Info label="Visibility" value={project.visibility||'team'}/><Info label="Require review" value={project.require_task_review===false?'Off':'On'}/></div><div className="panel"><h3>Members</h3>{members.map(m=><div className="memberLine" key={m.user_id}><Avatar p={m.profiles}/><span>{m.profiles?.full_name||m.profiles?.email}</span><small>{m.role_in_project}</small></div>)}</div></div></>}
  {tab==='list'&&<TaskList tasks={tasks} search={search} setSearch={setSearch} quickTitle={quickTitle} setQuickTitle={setQuickTitle} quickCreateTask={quickCreateTask} canTask={canTask} openTask={openTask} completeByCheckbox={completeByCheckbox} updateTask={updateTask} members={members}/>} 
  {tab==='kanban'&&<Kanban tasks={tasks} openTask={openTask} updateTask={updateTask}/>} 
  {tab==='files'&&<ProjectFiles project={project}/>} 
  {tab==='activity'&&<ProjectActivity project={project}/>} 
  {tab==='report'&&<div className="panel reportPanel"><h3>Project Report</h3><p>Xuất task hiện tại của Project ra Excel.</p><button className="primary" onClick={exportExcel}>Export Excel</button></div>}
  </section>
}
function Stat({label,value,danger}){return <div className={'stat '+(danger?'danger':'')}><span>{label}</span><b>{value}</b></div>}
function Info({label,value}){return <div className="infoRow"><span>{label}</span><b>{value}</b></div>}

function TaskList({tasks,search,setSearch,quickTitle,setQuickTitle,quickCreateTask,canTask,openTask,completeByCheckbox,updateTask,members}){ return <div className="panel taskPanel"><div className="taskToolbar"><input placeholder="Search task..." value={search} onChange={e=>setSearch(e.target.value)}/><div className="chips"><button>My tasks</button><button>Overdue</button><button>Review</button></div></div><div className="taskHeader"><span></span><span>Task</span><span>Assignee</span><span>Deadline</span><span>Priority</span><span>Status</span></div>{tasks.map(t=><div className="taskRow" key={t.id}><button className={'check '+(t.status==='done'?'done':'')} onClick={()=>completeByCheckbox(t)}>{t.status==='done'?'✓':''}</button><button className="taskTitle" onClick={()=>openTask(t)}><b>{t.title}</b><small>{t.code}</small></button><select value={t.assignee_id||''} onChange={e=>updateTask(t.id,{assignee_id:e.target.value||null})}><option value="">—</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email}</option>)}</select><input type="date" value={t.due_at?t.due_at.slice(0,10):''} onChange={e=>updateTask(t.id,{due_at:e.target.value?new Date(e.target.value+'T17:00:00').toISOString():null})}/><select value={t.priority} onChange={e=>updateTask(t.id,{priority:e.target.value})}>{Object.keys(PRIORITY).map(x=><option key={x} value={x}>{PRIORITY[x]}</option>)}</select><span className={'statusBadge '+t.status}>{LABEL[t.status]}</span></div>)}{canTask&&<div className="quickAdd"><span>＋</span><input placeholder="Thêm task và nhấn Enter..." value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&quickCreateTask()}/></div>}</div> }

function Kanban({tasks,openTask,updateTask}){ return <div className="kanban">{STATUS.map(s=><div className="kanbanCol" key={s} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('task'); if(id) updateTask(id,{status:s,completed_at:s==='done'?new Date().toISOString():null})}}><div className="kanbanHead"><b>{LABEL[s]}</b><span>{tasks.filter(t=>t.status===s).length}</span></div>{tasks.filter(t=>t.status===s).map(t=><div draggable onDragStart={e=>e.dataTransfer.setData('task',t.id)} className="kanbanCard" key={t.id} onDoubleClick={()=>openTask(t)}><small>{t.code}</small><b>{t.title}</b><div><span className={'priority '+t.priority}>{PRIORITY[t.priority]}</span><span>{fmtDate(t.due_at)}</span></div></div>)}</div>)}</div> }

function TaskDrawer({task,project,projectMembers,membership,currentProjectMember,onClose,onUpdate}){ const [comments,setComments]=useState([]),[activity,setActivity]=useState([]),[comment,setComment]=useState('')
  useEffect(()=>{ load(); const ch=supabase.channel('task-'+task.id).on('postgres_changes',{event:'*',schema:'public',table:'task_comments',filter:`task_id=eq.${task.id}`},load).subscribe(); return()=>supabase.removeChannel(ch)},[task.id])
  async function load(){ const [{data:c},{data:a}]=await Promise.all([supabase.from('task_comments').select('*, profiles(*)').eq('task_id',task.id).is('deleted_at',null).order('created_at'),supabase.from('task_activity_logs').select('*, profiles(*)').eq('task_id',task.id).order('created_at',{ascending:false}).limit(50)]); setComments(c||[]);setActivity(a||[]) }
  async function addComment(){ if(!comment.trim())return; await supabase.from('task_comments').insert({task_id:task.id,user_id:(await supabase.auth.getUser()).data.user.id,content:comment.trim()}); setComment(''); load() }
  return <div className="drawerWrap" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="drawer"><div className="drawerHead"><div><small>{task.code}</small><input className="drawerTitle" value={task.title} onChange={e=>onUpdate(task.id,{title:e.target.value})}/></div><button onClick={onClose}>×</button></div><div className="drawerBody"><div className="fieldGrid"><Field label="Status"><select value={task.status} onChange={e=>onUpdate(task.id,{status:e.target.value})}>{STATUS.map(x=><option key={x} value={x}>{LABEL[x]}</option>)}</select></Field><Field label="Assignee"><select value={task.assignee_id||''} onChange={e=>onUpdate(task.id,{assignee_id:e.target.value||null})}><option value="">—</option>{projectMembers.map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email}</option>)}</select></Field><Field label="Deadline"><input type="date" value={task.due_at?task.due_at.slice(0,10):''} onChange={e=>onUpdate(task.id,{due_at:e.target.value?new Date(e.target.value+'T17:00:00').toISOString():null})}/></Field><Field label="Progress"><input type="number" min="0" max="100" value={task.progress||0} onChange={e=>onUpdate(task.id,{progress:+e.target.value})}/></Field></div><section><h3>Mô tả</h3><textarea rows="7" placeholder="+ Thêm mô tả task..." value={task.description||''} onChange={e=>onUpdate(task.id,{description:e.target.value})}/></section><section><h3>Delivery link</h3><input className="fullInput" placeholder="https://..." value={task.delivery_url||''} onChange={e=>onUpdate(task.id,{delivery_url:e.target.value})}/></section><section><h3>Comments</h3><div className="comments">{comments.map(c=><div className="comment" key={c.id}><Avatar p={c.profiles}/><div><div className="commentMeta"><b>{c.profiles?.full_name||c.profiles?.email}</b><span>{fmtDateTime(c.created_at)}</span>{c.updated_at&&<em>Edited</em>}</div><p>{c.content}</p></div></div>)}</div><div className="commentBox"><textarea placeholder="Viết bình luận... @mention" value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')addComment()}}/><button className="primary" onClick={addComment}>Gửi</button></div></section><section><h3>Activity</h3>{activity.map(a=><div className="activityLine" key={a.id}><span>•</span><div><b>{a.profiles?.full_name||'System'}</b> {a.action.replaceAll('_',' ')}<small>{fmtDateTime(a.created_at)}</small></div></div>)}</section></div></aside></div> }
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}

function HomeDashboard({projects,members}){return <section className="page"><div className="pageHead"><div><h1>Home</h1><p>Tổng quan workspace.</p></div></div><div className="statGrid"><Stat label="Projects" value={projects.length}/><Stat label="Active" value={projects.filter(p=>p.status==='active').length}/><Stat label="Members" value={members.length}/><Stat label="At risk" value={projects.filter(p=>p.health==='at_risk').length}/></div></section>}
function MyTasks(){return <section className="page"><div className="pageHead"><div><h1>My Tasks</h1><p>Task của bạn từ tất cả Project sẽ được tổng hợp tại đây.</p></div></div><div className="panel empty">Dùng Project List/Kanban để quản lý chi tiết; My Tasks realtime sẽ dùng query theo assignee khi mở rộng.</div></section>}
function Teams({teams,projects}){return <section className="page"><div className="pageHead"><div><h1>Teams</h1><p>Team, Project và workload.</p></div></div><div className="projectGrid">{teams.map(t=><article className="projectCard" key={t.id}><div className="projectIcon">{t.code.slice(0,2)}</div><h3>{t.name}</h3><p>{projects.filter(p=>p.team_id===t.id).length} Projects</p></article>)}</div></section>}
function Members({members,onOpen}){return <section className="page"><div className="pageHead"><div><h1>Members & Permissions</h1><p>Trưởng phòng quản lý role, team và quyền mở rộng.</p></div></div><div className="panel memberTable">{members.map(m=><button className="memberRow" key={m.id} onClick={()=>onOpen(m)}><Avatar p={m.profiles}/><span><b>{m.profiles?.full_name||m.profiles?.email}</b><small>{m.profiles?.email}</small></span><span>{m.teams?.name||'—'}</span><span className="rolePill">{m.role}</span></button>)}</div></section>}
function Reports({projects,members}){return <section className="page"><div className="pageHead"><div><h1>Reports</h1><p>Report theo Project, Team, Member và deadline.</p></div></div><div className="statGrid"><Stat label="Projects" value={projects.length}/><Stat label="Members" value={members.length}/></div></section>}

function MemberDrawer({item,teams,onClose,onSaved}){const [role,setRole]=useState(item.role),[teamId,setTeamId]=useState(item.team_id||''),[perms,setPerms]=useState({can_create_project:!!item.can_create_project,can_review_task:!!item.can_review_task,can_assign_outside_project:!!item.can_assign_outside_project,can_view_team_report:!!item.can_view_team_report})
 async function save(){ const {error}=await supabase.from('memberships').update({role,team_id:teamId||null,...perms}).eq('id',item.id); if(error)alert(error.message); else {onSaved();onClose()} }
 return <div className="drawerWrap"><aside className="drawer narrow"><div className="drawerHead"><h2>Member permissions</h2><button onClick={onClose}>×</button></div><div className="drawerBody"><div className="memberHero"><Avatar p={item.profiles} big/><h3>{item.profiles?.full_name}</h3><p>{item.profiles?.email}</p></div><Field label="Role"><select value={role} onChange={e=>setRole(e.target.value)}><option value="manager">Trưởng phòng</option><option value="team_lead">Team Lead</option><option value="member">Member/CTV</option></select></Field><Field label="Team"><select value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="">—</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><h3>Custom permissions</h3>{Object.keys(perms).map(k=><label className="toggleLine" key={k}><span>{k.replaceAll('_',' ')}</span><input type="checkbox" checked={perms[k]} onChange={e=>setPerms({...perms,[k]:e.target.checked})}/></label>)}<button className="primary full" onClick={save}>Lưu quyền</button></div></aside></div>}

function ProjectFiles({project}){return <div className="panel"><h3>Files</h3><p>Khu vực file chung của Project. Có thể lưu Drive URL hoặc tích hợp Supabase Storage.</p><div className="empty">Chưa có file.</div></div>}
function ProjectActivity({project}){const [rows,setRows]=useState([]);useEffect(()=>{supabase.from('project_activity_logs').select('*').eq('project_id',project.id).order('created_at',{ascending:false}).limit(100).then(({data})=>setRows(data||[]))},[project.id]);return <div className="panel"><h3>Project Activity</h3>{rows.length?rows.map(x=><div className="activityLine" key={x.id}><span>•</span><div>{x.action}<small>{fmtDateTime(x.created_at)}</small></div></div>):<div className="empty">Chưa có activity riêng của Project.</div>}</div>}
