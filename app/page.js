'use client'

// FPTU Work v18.14 - Assigned by Me, deadline follow-up, deep-link reminders

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import * as XLSX from 'xlsx'

import {
  supabase,
  appUrl
} from '../lib/supabase'

import {
  canManageWorkspace,
  canReviewTask
} from '../lib/permissions'


// =====================================================
// CONSTANTS
// =====================================================

const STATUS = [
  'todo',
  'in_progress',
  'review',
  'done'
]

const LABEL = {
  todo:'To-do',
  in_progress:'In Progress',
  review:'Review',
  done:'Done',

  planning:'Planning',
  active:'Active',
  on_hold:'On Hold',
  completed:'Completed',
  cancelled:'Cancelled',
  archived:'Archived'
}

const PRIORITY = {
  low:'Low',
  medium:'Medium',
  high:'High',
  urgent:'Urgent'
}


// =====================================================
// HELPERS
// =====================================================

function fmtDate(v){

  if(!v) return '—'

  return new Intl.DateTimeFormat(
    'vi-VN',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }
  ).format(
    new Date(v)
  )
}


function fmtDateTime(v){

  if(!v) return ''

  return new Intl.DateTimeFormat(
    'vi-VN',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    }
  ).format(
    new Date(v)
  )
}


function initials(name=''){

  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map(x=>x[0])
      .join('')
      .toUpperCase()
    ||
    '?'
  )
}



// =====================================================
// UI LANGUAGE (Vietnamese / English)
// =====================================================

const UI_TEXT = [
  ['Home','Trang chủ'],['My Tasks','Công việc của tôi'],['My Projects','Dự án tôi quản lý'],['Projects','Dự án'],['Teams','Nhóm'],['Members','Thành viên'],['Reports','Báo cáo'],
  ['Project Workspace','Không gian công việc'],['Members & Permissions','Thành viên & Phân quyền'],['Member permissions','Phân quyền thành viên'],
  ['Custom permissions','Quyền tùy chỉnh'],['Role','Vai trò'],['Team','Nhóm'],['Project','Dự án'],['Task','Công việc'],['Sub-task','Công việc con'],
  ['To-do','Cần làm'],['In Progress','Đang làm'],['Review','Chờ duyệt'],['Done','Hoàn thành'],['Planning','Lập kế hoạch'],['Active','Đang hoạt động'],
  ['On Hold','Tạm dừng'],['Completed','Hoàn tất'],['Cancelled','Đã hủy'],['Archived','Đã lưu trữ'],
  ['Low','Thấp'],['Medium','Trung bình'],['High','Cao'],['Urgent','Khẩn cấp'],
  ['Add member to Project','Thêm thành viên vào Dự án'],['Edit Project member','Sửa thành viên trong Dự án'],['Add to Project','Thêm vào Dự án'],
  ['Member','Thành viên'],['Viewer','Chỉ xem'],['Lead','Trưởng dự án'],['Team Lead','Trưởng nhóm'],['Manager','Trưởng phòng'],
  ['Create Team','Tạo Team'],['Create Task','Tạo Task mới'],['Create & open Task','Tạo & mở Task'],['Invite member','Mời thành viên'],
  ['Save permissions','Lưu quyền'],['Save changes','Lưu thay đổi'],['Remove from Project','Gỡ khỏi Project'],['Remove from Workspace','Xóa khỏi Workspace'],
  ['All','Tất cả'],['To do','Cần làm'],['Newly assigned','Mới được giao'],['Overdue','Trễ hạn'],['Priority','Ưu tiên'],['In progress','Đang làm'],
  ['Waiting review','Chờ Review'],['Completed','Hoàn thành'],['All Projects','Tất cả Project'],['All priorities','Mọi mức ưu tiên'],
  ['List','Danh sách'],['Cards','Khối'],['Search members...','Tìm thành viên...'],['Search by name or email...','Tìm theo tên hoặc email...'],
  ['Description','Mô tả'],['Deadline','Hạn chót'],['Assignees','Người phụ trách'],['Delivery link','Liên kết bàn giao'],['Comments','Bình luận'],
  ['Enable notifications','Bật thông báo'],['Notifications','Thông báo'],['Edit profile','Chỉnh sửa hồ sơ'],['Manager','Trưởng phòng'],['Member/CTV','Member/CTV'],
  ['Can create tasks','Được tạo task'],['Can assign tasks','Được assign task'],['Can manage Project members','Được quản lý member Project'],
  ['Draft is auto-saved on this device. You can leave and come back without losing content.','Nháp được tự động lưu trên thiết bị này. Có thể đóng/mở lại form mà không mất nội dung.'],
  ['No tasks match the current filters.','Không có task phù hợp với bộ lọc hiện tại.'],['No data.','Không có dữ liệu.'],
  ['Healthy','Ổn định'],['Watch','Cần theo dõi'],['At risk','Có rủi ro'],['Balanced','Cân bằng'],['Overloaded','Quá tải'],['Workload','Tải công việc'],['On-time','Đúng hạn'],['Review backlog','Tồn đọng duyệt'],
  ['Assigned by Me','Tôi đã giao'],['Due soon','Sắp đến hạn'],['Due today','Đến hạn hôm nay'],['Remind now','Nhắc ngay'],['Assigned to','Đã giao cho'],['Last updated','Cập nhật gần nhất']
]

const UI_ALIASES = {
  'Add member vào Project':{vi:'Thêm thành viên vào Dự án',en:'Add member to Project'},
  'Sửa member trong Project':{vi:'Sửa thành viên trong Dự án',en:'Edit Project member'},
  'Team, Team Lead và Project trong Workspace.':{vi:'Nhóm, Trưởng nhóm và Dự án trong không gian làm việc.',en:'Teams, Team Leads and Projects in the workspace.'},
  'Trưởng phòng quản lý role, team và quyền Workspace.':{vi:'Trưởng phòng quản lý vai trò, nhóm và quyền trong không gian làm việc.',en:'Managers control roles, teams and workspace permissions.'},
  'Smart Reports & Workload Intelligence — theo dõi Project, Task, workload và rủi ro theo quyền truy cập hiện tại.':{vi:'Báo cáo thông minh — theo dõi dự án, công việc, tải công việc và rủi ro theo quyền truy cập hiện tại.',en:'Smart reports — track projects, tasks, workload and risk based on current access.'},
  'Mô tả Project':{vi:'Mô tả Dự án',en:'Project description'},
  'Links làm việc':{vi:'Liên kết làm việc',en:'Working links'},
  'Project overview':{vi:'Tổng quan Dự án',en:'Project overview'},
  'Total tasks':{vi:'Tổng công việc',en:'Total tasks'},
  'Overdue':{vi:'Trễ hạn',en:'Overdue'},
  'Progress':{vi:'Tiến độ',en:'Progress'},
  'Project Lead':{vi:'Trưởng dự án',en:'Project Lead'},
  'Workspace':{vi:'Không gian làm việc',en:'Workspace'},
  'Search task...':{vi:'Tìm công việc...',en:'Search tasks...'},
  'Tìm người assign...':{vi:'Tìm người phụ trách...',en:'Search assignees...'},
  'Chưa assign':{vi:'Chưa giao',en:'Unassigned'},
  'Chưa gán':{vi:'Chưa gán',en:'Unassigned'},
  'Add Member':{vi:'Thêm thành viên',en:'Add member'},
  'Role trong Project':{vi:'Vai trò trong Dự án',en:'Project role'},
  'Member permissions':{vi:'Phân quyền thành viên',en:'Member permissions'},
  'Custom permissions':{vi:'Quyền tùy chỉnh',en:'Custom permissions'},
  'Delivery URL':{vi:'Liên kết bàn giao',en:'Delivery URL'},
  'Người phụ trách':{vi:'Người phụ trách',en:'Assignees'},
  'Tạo Sub-task mới':{vi:'Tạo công việc con mới',en:'Create sub-task'},
  'Chưa có Sub-task.':{vi:'Chưa có công việc con.',en:'No sub-tasks yet.'},
  'Công việc con có status, deadline, priority, delivery link và nhiều người phụ trách như Task.':{vi:'Công việc con có trạng thái, hạn chót, mức ưu tiên, liên kết bàn giao và nhiều người phụ trách như công việc chính.',en:'Sub-tasks support status, deadline, priority, delivery link and multiple assignees like tasks.'}
}

function getUILang(){
  try{return typeof window!=='undefined'?(window.localStorage.getItem('fptu-work-ui-lang')||'vi'):'vi'}catch{return 'vi'}
}
function workspaceRoleLabel(role){
  const lang=getUILang()
  const map={manager:{vi:'Trưởng phòng',en:'Manager'},team_lead:{vi:'Trưởng nhóm',en:'Team Lead'},member:{vi:'Thành viên/CTV',en:'Member/CTV'}}
  return map[role]?.[lang]||role||''
}

const VI_TO_EN = Object.fromEntries(UI_TEXT.map(([en,vi])=>[vi,en]))
const EN_TO_VI = Object.fromEntries(UI_TEXT.map(([en,vi])=>[en,vi]))

function translateExactText(value,lang){
  const raw=String(value??'')
  const lead=raw.match(/^\s*/)?.[0]||''
  const tail=raw.match(/\s*$/)?.[0]||''
  const core=raw.trim()
  if(!core) return raw
  if(UI_ALIASES[core]) return lead+UI_ALIASES[core][lang]+tail
  const map=lang==='en'?VI_TO_EN:EN_TO_VI
  return Object.prototype.hasOwnProperty.call(map,core)?lead+map[core]+tail:raw
}

function applyUILanguage(lang){
  if(typeof document==='undefined') return
  document.documentElement.lang=lang==='en'?'en':'vi'
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
  const nodes=[]
  while(walker.nextNode()) nodes.push(walker.currentNode)
  nodes.forEach(n=>{
    const parent=n.parentElement
    if(!parent || ['SCRIPT','STYLE'].includes(parent.tagName)) return
    const next=translateExactText(n.nodeValue,lang)
    if(next!==n.nodeValue) n.nodeValue=next
  })
  document.querySelectorAll('input[placeholder],textarea[placeholder],button[title]').forEach(el=>{
    if(el.placeholder){const next=translateExactText(el.placeholder,lang);if(next!==el.placeholder)el.placeholder=next}
    if(el.title){const next=translateExactText(el.title,lang);if(next!==el.title)el.title=next}
  })
}

// =====================================================
// MAIN
// =====================================================

export default function Home(){

  const [session,setSession]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const [profile,setProfile]=useState(null)
  const [membership,setMembership]=useState(null)
  const [workspace,setWorkspace]=useState(null)

  const [projects,setProjects]=useState([])
  const [project,setProject]=useState(null)
  const [projectMembers,setProjectMembers]=useState([])
  const [tasks,setTasks]=useState([])

  const [members,setMembers]=useState([])
  const [teams,setTeams]=useState([])

  const [view,setView]=useState('home')
  const [projectTab,setProjectTab]=useState('overview')

  const [taskDrawer,setTaskDrawer]=useState(null)
  const [focusCommentId,setFocusCommentId]=useState(null)

  const [memberDrawer,setMemberDrawer]=useState(null)
  const [profileEditOpen,setProfileEditOpen]=useState(false)
  const [teamEdit,setTeamEdit]=useState(null)

  const [projectCreateOpen,setProjectCreateOpen]=useState(false)
  const [inviteOpen,setInviteOpen]=useState(false)
  const [teamCreateOpen,setTeamCreateOpen]=useState(false)

  const [search,setSearch]=useState('')
  const [quickTitle,setQuickTitle]=useState('')

  const [toast,setToast]=useState('')

  const [notifications,setNotifications]=useState([])
  const [notificationOpen,setNotificationOpen]=useState(false)
  const [mobileMoreOpen,setMobileMoreOpen]=useState(false)
  const [notificationPrefs,setNotificationPrefs]=useState(null)

  const [taskFilter,setTaskFilter]=useState('all')

  const [pushStatus,setPushStatus]=useState('checking')
  const [uiLang,setUiLang]=useState(()=>{
    if(typeof window==='undefined') return 'vi'
    return window.localStorage.getItem('fptu-work-ui-lang')||'vi'
  })
  const deepLinkHandledRef=useRef(false)
  const managerLandingAppliedRef=useRef(false)

  useEffect(()=>{
    if(!membership?.id || managerLandingAppliedRef.current) return
    const params=new URLSearchParams(typeof window!=='undefined'?window.location.search:'')
    if(params.get('project')||params.get('project_id')||params.get('task')||params.get('task_id')||params.get('invite')) return
    managerLandingAppliedRef.current=true
    if(String(membership.role||'').toLowerCase()==='manager') setView('reports')
  },[membership?.id,membership?.role])

  useEffect(()=>{
    if(typeof window==='undefined') return
    window.localStorage.setItem('fptu-work-ui-lang',uiLang)
    applyUILanguage(uiLang)
    const obs=new MutationObserver(()=>applyUILanguage(uiLang))
    obs.observe(document.body,{childList:true,subtree:true})
    return ()=>obs.disconnect()
  },[uiLang])


  // ===================================================
  // PWA / WEB PUSH
  // ===================================================

  function urlBase64ToUint8Array(base64String){

    const padding='='.repeat(
      (4-base64String.length%4)%4
    )

    const base64=(
      base64String+padding
    )
      .replace(/-/g,'+')
      .replace(/_/g,'/')

    const rawData=window.atob(base64)

    return Uint8Array.from(
      [...rawData].map(
        char=>char.charCodeAt(0)
      )
    )
  }


  async function syncPushSubscription(subscription){

    if(
      !subscription
      ||
      !session?.access_token
    ){
      return false
    }

    const res=await fetch(
      '/api/push/subscribe',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:
            `Bearer ${session.access_token}`
        },
        body:JSON.stringify(
          subscription.toJSON()
        )
      }
    )

    if(!res.ok){

      const payload=
        await res.json()
          .catch(()=>({}))

      throw new Error(
        payload.error
        ||
        'Không lưu được thiết bị nhận thông báo'
      )
    }

    return true
  }


  async function checkPushStatus(){

    if(
      typeof window==='undefined'
      ||
      !('serviceWorker' in navigator)
      ||
      !('PushManager' in window)
      ||
      !('Notification' in window)
    ){
      setPushStatus('unsupported')
      return
    }

    try{

      await navigator.serviceWorker
        .register('/sw.js')

      const registration=
        await navigator.serviceWorker.ready

      const subscription=
        await registration.pushManager
          .getSubscription()

      if(
        Notification.permission==='granted'
        &&
        subscription
      ){

        setPushStatus('enabled')

        if(session?.access_token){
          await syncPushSubscription(
            subscription
          )
        }

      }else if(
        Notification.permission==='denied'
      ){

        setPushStatus('blocked')

      }else{

        setPushStatus('disabled')
      }

    }catch(e){

      console.error(
        'Push status error',
        e
      )

      setPushStatus('disabled')
    }
  }


  async function enablePush(){

    if(
      typeof window==='undefined'
    ){
      return
    }


    const isIOS=
      /iPad|iPhone|iPod/.test(
        navigator.userAgent
      )

    const isStandalone=
      window.matchMedia(
        '(display-mode: standalone)'
      ).matches
      ||
      window.navigator.standalone===true


    if(
      isIOS
      &&
      !isStandalone
    ){

      alert(
        'Trên iPhone/iPad: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Sau đó mở FPTU MKT Work từ icon ngoài màn hình và bấm “Bật thông báo” lần nữa.'
      )

      return
    }


    if(
      !('serviceWorker' in navigator)
      ||
      !('PushManager' in window)
      ||
      !('Notification' in window)
    ){

      alert(
        'Trình duyệt/thiết bị này chưa hỗ trợ Web Push.'
      )

      return
    }


    const vapidPublicKey=
      process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY


    if(!vapidPublicKey){

      alert(
        'Hệ thống chưa cấu hình VAPID Public Key.'
      )

      return
    }


    try{

      setPushStatus('checking')

      const registration=
        await navigator.serviceWorker
          .register('/sw.js')

      const permission=
        await Notification
          .requestPermission()


      if(permission!=='granted'){

        setPushStatus(
          permission==='denied'
            ? 'blocked'
            : 'disabled'
        )

        return
      }


      let subscription=
        await registration
          .pushManager
          .getSubscription()


      if(!subscription){

        subscription=
          await registration
            .pushManager
            .subscribe({
              userVisibleOnly:true,
              applicationServerKey:
                urlBase64ToUint8Array(
                  vapidPublicKey
                )
            })
      }


      await syncPushSubscription(
        subscription
      )

      setPushStatus('enabled')

      if(
        navigator.setAppBadge
      ){
        navigator.setAppBadge(0)
          .catch(()=>{})
      }

      showToast(
        'Đã bật thông báo trên thiết bị này'
      )

    }catch(e){

      setPushStatus('disabled')

      alert(
        'Không bật được thông báo: '+
        e.message
      )
    }
  }


  useEffect(()=>{

    if(
      !session?.user?.id
    ){
      return
    }

    checkPushStatus()

  },[
    session?.user?.id
  ])


  // ===================================================
  // AUTH
  // ===================================================

  useEffect(()=>{

    if(!supabase){

      setError(
        'Thiếu biến môi trường Supabase.'
      )

      setLoading(false)

      return
    }


    supabase.auth
      .getSession()
      .then(({data})=>{

        setSession(
          data.session
        )

        if(data.session){

          bootstrap(
            data.session.user
          )

        }else{

          setLoading(false)
        }
      })


    const {data:sub}=
      supabase.auth
        .onAuthStateChange(
          (_event,s)=>{

            setSession(s)

            if(s){

              bootstrap(
                s.user
              )

            }else{

              setProfile(null)
              setMembership(null)
              setWorkspace(null)

              setLoading(false)
            }
          }
        )


    return ()=>{

      sub.subscription.unsubscribe()
    }

  },[])


  // ===================================================
  // OPEN MEMBER PERMISSION DRAWER WITH FRESH DATA
  // ===================================================

  async function openMemberDrawerFresh(item){

    if(!item?.id) return

    const {
      data:freshMembership,
      error:membershipError
    } = await supabase
      .from('memberships')
      .select('*')
      .eq('id',item.id)
      .single()

    if(membershipError){

      alert(
        'Không tải được quyền thành viên: '+
        membershipError.message
      )

      return
    }

    const {
      data:freshProfile
    } = await supabase
      .from('profiles')
      .select('*')
      .eq(
        'id',
        freshMembership.user_id
      )
      .maybeSingle()

    const freshTeam=
      teams.find(
        t=>t.id===freshMembership.team_id
      )||null

    setMemberDrawer({
      ...freshMembership,
      profiles:freshProfile||item.profiles||null,
      teams:freshTeam
    })
  }


  // ===================================================
  // MEMBER DEFAULT FILTER
  // ===================================================

  useEffect(()=>{

    if(!membership) return

    if(
      membership.role==='member'
    ){

      setTaskFilter('my')

    }else{

      setTaskFilter('all')
    }

  },[
    membership?.role
  ])


  // ===================================================
  // REALTIME NOTIFICATION
  // ===================================================

  useEffect(()=>{

    if(
      !supabase
      ||
      !session?.user?.id
    ){
      return
    }


    const channel=
      supabase
        .channel(
          'notifications-'+
          session.user.id
        )
        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'notifications',
            filter:
              `user_id=eq.${session.user.id}`
          },
          ()=>{
            loadNotifications()
          }
        )
        .subscribe()


    return ()=>{

      supabase.removeChannel(
        channel
      )
    }

  },[
    session?.user?.id
  ])


  // ===================================================
  // REALTIME PROJECT TASKS / MEMBERS
  // ===================================================

  useEffect(()=>{

    if(
      !supabase
      ||
      !project?.id
      ||
      view!=='project'
    ){
      return
    }


    const refresh=()=>{
      openProject(
        project,
        {
          tab:projectTab,
          preserveTaskFilter:true
        }
      )
    }


    const taskChannel=
      supabase
        .channel(
          'project-tasks-'+project.id
        )
        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'tasks',
            filter:`project_id=eq.${project.id}`
          },
          refresh
        )
        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'project_members',
            filter:`project_id=eq.${project.id}`
          },
          refresh
        )
        .subscribe()


    return ()=>{
      supabase.removeChannel(
        taskChannel
      )
    }

  },[
    project?.id,
    projectTab,
    view
  ])


  // ===================================================
  // PUSH / URL DEEP LINK
  // ===================================================

  useEffect(()=>{

    if(
      loading
      ||
      !session?.user?.id
      ||
      !membership?.id
      ||
      deepLinkHandledRef.current
    ){
      return
    }


    const params=
      new URLSearchParams(
        window.location.search
      )

    const projectId=
      params.get('project')
      ||
      params.get('project_id')

    const taskId=
      params.get('task')
      ||
      params.get('task_id')

    const commentId=
      params.get('comment')
      ||
      params.get('comment_id')


    if(
      !projectId
      &&
      !taskId
    ){
      return
    }


    deepLinkHandledRef.current=true


    openNotification({
      id:null,
      is_read:true,
      project_id:projectId||null,
      task_id:taskId||null,
      comment_id:commentId||null
    })
      .finally(()=>{

        const invite=
          params.get('invite')

        const cleanUrl=
          invite
            ? `/?invite=${encodeURIComponent(invite)}`
            : '/'

        history.replaceState(
          {},
          '',
          cleanUrl
        )
      })

  },[
    loading,
    session?.user?.id,
    membership?.id
  ])


  // ===================================================
  // BOOTSTRAP
  // ===================================================

  async function bootstrap(user){

    try{

      setLoading(true)
      setError('')


      // -----------------------------------------------
      // Invite token
      // -----------------------------------------------

      const invite =
        new URLSearchParams(
          window.location.search
        ).get('invite')
        ||
        sessionStorage.getItem(
          'fptu_invite'
        )


      if(invite){

        sessionStorage.setItem(
          'fptu_invite',
          invite
        )


        const {
          error:inviteError
        } = await supabase.rpc(
          'accept_invitation',
          {
            p_token:invite
          }
        )


        if(inviteError){

          throw new Error(
            'Không thể nhận lời mời: '+
            inviteError.message
          )
        }


        sessionStorage.removeItem(
          'fptu_invite'
        )


        if(
          window.location.search
            .includes('invite=')
        ){

          history.replaceState(
            {},
            '',
            window.location.pathname
          )
        }
      }


      // -----------------------------------------------
      // Profile
      // -----------------------------------------------

      const {
        data:p
      } = await supabase
        .from('profiles')
        .select('*')
        .eq(
          'id',
          user.id
        )
        .maybeSingle()


      setProfile(
        p
        ||
        {
          id:user.id,

          full_name:
            user.user_metadata
              ?.full_name,

          email:
            user.email,

          avatar_url:
            user.user_metadata
              ?.avatar_url
        }
      )


      // -----------------------------------------------
      // Membership
      // -----------------------------------------------

      const {
        data:m
      } = await supabase
        .from('memberships')
        .select(
          '*, teams(*)'
        )
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'status',
          'active'
        )
        .limit(1)
        .maybeSingle()


      setMembership(m)


      if(!m){

        setLoading(false)

        return
      }


      // -----------------------------------------------
      // Workspace
      // -----------------------------------------------

      const {
        data:w
      } = await supabase
        .from('workspaces')
        .select('*')
        .eq(
          'id',
          m.workspace_id
        )
        .single()


      setWorkspace(w)


      // -----------------------------------------------
      // Load common data
      // -----------------------------------------------

      const [
        projectRes,
        teamRes,
        memberRes,
        notificationRes,
        prefRes
      ] = await Promise.all([

        supabase
          .from('projects')
          .select(
            '*, teams(name,code), profiles!projects_lead_id_fkey(full_name,avatar_url)'
          )
          .eq(
            'workspace_id',
            m.workspace_id
          )
          .is(
            'archived_at',
            null
          )
          .order(
            'created_at',
            {
              ascending:false
            }
          ),

        supabase
          .from('teams')
          .select(
            '*, lead:profiles!teams_lead_id_fkey(full_name,email,avatar_url)'
          )
          .eq(
            'workspace_id',
            m.workspace_id
          )
          .is(
            'archived_at',
            null
          )
          .order('name'),

        supabase.rpc(
          'get_active_workspace_members'
        ),

        supabase
          .from('notifications')
          .select('*')
          .eq(
            'user_id',
            user.id
          )
          .order(
            'created_at',
            {
              ascending:false
            }
          )
          .limit(50),

        supabase
          .from(
            'notification_preferences'
          )
          .select('*')
          .eq(
            'user_id',
            user.id
          )
          .maybeSingle()

      ])


      if(
        memberRes.error
      ){

        throw new Error(
          'Không tải được danh sách thành viên: '+
          memberRes.error.message
        )
      }


      const normalizedMembers=
        (memberRes.data||[])
          .map(
            x=>({

              ...x,

              profiles:{
                id:x.user_id,
                full_name:x.full_name,
                email:x.email,
                avatar_url:x.avatar_url,
                birth_date:x.birth_date||null
              },

              teams:
                x.team_id
                  ? {
                      id:x.team_id,
                      name:x.team_name,
                      code:x.team_code
                    }
                  : null
            })
          )


      setProjects(
        projectRes.data||[]
      )

      setTeams(
        teamRes.data||[]
      )

      setMembers(
        normalizedMembers
      )

      setNotifications(
        notificationRes.data||[]
      )

      setNotificationPrefs(
        prefRes.data||null
      )


      setLoading(false)

    }catch(e){

      setError(
        e.message
      )

      setLoading(false)
    }
  }


  // ===================================================
  // NOTIFICATION LOAD
  // ===================================================

  async function loadNotifications(){

    if(
      !session?.user?.id
    ){
      return
    }


    const {
      data
    } = await supabase
      .from('notifications')
      .select('*')
      .eq(
        'user_id',
        session.user.id
      )
      .order(
        'created_at',
        {
          ascending:false
        }
      )
      .limit(50)


    setNotifications(
      data||[]
    )
  }


  // ===================================================
  // LOGIN
  // ===================================================

  async function login(){

    const invite=
      new URLSearchParams(
        window.location.search
      ).get('invite')


    if(invite){

      sessionStorage.setItem(
        'fptu_invite',
        invite
      )
    }


    const baseUrl=
      String(appUrl||'')
        .replace(/\/$/,'')

    const redirectTo=
      window.location.search
        ? `${baseUrl}/${window.location.search}`
        : baseUrl


    await supabase.auth
      .signInWithOAuth({
        provider:'google',

        options:{
          redirectTo
        }
      })
  }


  async function logout(){

    await supabase.auth
      .signOut()

    location.href='/'
  }


  // ===================================================
  // PROJECT LEAD CHECK
  // ===================================================

  function isProjectLead(
    p,
    pmList
  ){

    return (
      p?.lead_id===
        session?.user?.id
      ||
      (pmList||[])
        .some(
          x=>
            x.user_id===
              session?.user?.id
            &&
            x.role_in_project===
              'lead'
        )
    )
  }


  // ===================================================
  // OPEN PROJECT
  // ===================================================

  async function openProject(
    p,
    options={}
  ){

    if(!p) return null


    setProject(p)
    setView('project')


    if(
      options.tab
    ){

      setProjectTab(
        options.tab
      )

    }else{

      setProjectTab(
        'overview'
      )
    }


    const {
      data:pm,
      error:pmError
    } = await supabase
      .from('project_members')
      .select(
        '*, profiles(*)'
      )
      .eq(
        'project_id',
        p.id
      )


    if(pmError){

      alert(
        'Không tải được Project Members: '+
        pmError.message
      )
    }


    const pmList=
      pm||[]


    const projectLead=
      isProjectLead(
        p,
        pmList
      )


    const canSeeAll=
      membership?.role==='manager'
      ||
      membership?.role==='team_lead'
      ||
      projectLead


    let query=
      supabase
        .from('tasks')
        .select(
          '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*)), project:projects(name,code)'
        )
        .eq(
          'project_id',
          p.id
        )
        .is(
          'archived_at',
          null
        )
        .is(
          'parent_task_id',
          null
        )


    const {
      data:t,
      error:taskError
    } = await query
      .order(
        'created_at',
        {
          ascending:false
        }
      )


    if(taskError){

      alert(
        'Không tải được task: '+
        taskError.message
      )
    }


    const taskList=
      (t||[]).filter(x=>
        canSeeAll
        || x.assignee_id===session.user.id
        || (x.task_assignees||[]).some(a=>a.user_id===session.user.id)
      )


    setProjectMembers(
      pmList
    )

    setTasks(
      taskList
    )


    if(!options.preserveTaskFilter){
      setTaskFilter(
        canSeeAll
          ? 'all'
          : 'my'
      )
    }


    return {
      members:pmList,
      tasks:taskList
    }
  }


  // ===================================================
  // NOTIFICATION DEEP LINK
  // ===================================================

  async function openNotification(n){

    try{

      // mark read trước
      if(!n.is_read){

        await supabase
          .from('notifications')
          .update({
            is_read:true
          })
          .eq(
            'id',
            n.id
          )
      }


      setNotifications(
        prev=>
          prev.map(
            x=>
              x.id===n.id
                ? {
                    ...x,
                    is_read:true
                  }
                : x
          )
      )


      setNotificationOpen(false)


      let projectId=
        n.project_id||null

      let taskId=
        n.task_id||null


      // Notification cũ chỉ có task_id
      if(
        !projectId
        &&
        taskId
      ){

        const {
          data:t
        } = await supabase
          .from('tasks')
          .select(
            'id,project_id'
          )
          .eq(
            'id',
            taskId
          )
          .maybeSingle()


        projectId=
          t?.project_id||null
      }


      if(!projectId){

        showToast(
          'Thông báo này chưa có liên kết Project'
        )

        return
      }


      let targetProject=
        projects.find(
          x=>x.id===projectId
        )


      if(!targetProject){

        const {
          data:p
        } = await supabase
          .from('projects')
          .select(
            '*, teams(name,code), profiles!projects_lead_id_fkey(full_name,avatar_url)'
          )
          .eq(
            'id',
            projectId
          )
          .maybeSingle()


        targetProject=p
      }


      if(!targetProject){

        showToast(
          'Không tìm thấy Project'
        )

        return
      }


      const opened=
        await openProject(
          targetProject,
          {
            tab:'list'
          }
        )


      if(!taskId){

        return
      }


      let targetTask=
        opened?.tasks
          ?.find(
            x=>x.id===taskId
          )


      // Task có thể chưa nằm trong query hiện tại
      if(!targetTask){

        const {
          data:t
        } = await supabase
          .from('tasks')
          .select(
            '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*)), project:projects(name,code)'
          )
          .eq(
            'id',
            taskId
          )
          .maybeSingle()


        targetTask=t
      }


      if(!targetTask){

        showToast(
          'Không tìm thấy Task'
        )

        return
      }


      setFocusCommentId(
        n.comment_id||null
      )


      setTaskDrawer(
        targetTask
      )

    }catch(e){

      alert(
        'Không mở được thông báo: '+
        e.message
      )
    }
  }


  // ===================================================
  // CREATE TEAM
  // ===================================================

  async function createTeam(
    payload
  ){

    if(
      !canManageWorkspace(
        membership
      )
    ){

      return {
        error:new Error(
          'Chỉ Trưởng phòng được tạo Team'
        )
      }
    }


    const {
      data,
      error:e
    } = await supabase.rpc(
      'create_team_safe',
      {
        p_name:
          payload.name,

        p_code:
          payload.code||null,

        p_description:
          payload.description||null,

        p_lead_id:
          payload.lead_id||null
      }
    )


    if(e){

      return {
        error:e
      }
    }


    setTeamCreateOpen(false)

    showToast(
      'Đã tạo Team'
    )


    await bootstrap(
      session.user
    )


    return {
      data
    }
  }


  // ===================================================
  // CREATE PROJECT
  // ===================================================

  async function createProject(
    payload
  ){

    const {
      data,
      error:e
    } = await supabase.rpc(
      'create_project_atomic',
      {
        p_name:
          payload.name,

        p_code:
          payload.code||null,

        p_team_id:
          payload.team_id,

        p_description:
          payload.description||null,

        p_start_at:
          payload.start_at||null,

        p_due_at:
          payload.due_at||null,

        p_visibility:
          payload.visibility||'team',

        p_require_task_review:
          payload
            .require_task_review!==false
      }
    )


    if(e){

      return {
        error:e
      }
    }


    const id=
      data?.id||data


    const {
      data:created,
      error:readError
    } = await supabase
      .from('projects')
      .select(
        '*, teams(name,code), profiles!projects_lead_id_fkey(full_name,avatar_url)'
      )
      .eq(
        'id',
        id
      )
      .single()


    if(readError){

      return {
        error:readError
      }
    }


    setProjects(
      prev=>[
        created,
        ...prev.filter(
          x=>x.id!==created.id
        )
      ]
    )


    setProjectCreateOpen(false)


    showToast(
      'Đã tạo Project'
    )


    await openProject(
      created
    )


    return {
      data:created
    }
  }


  // ===================================================
  // CANCEL PROJECT
  // ===================================================

  async function cancelProject(p){

    if(!p) return


    const reason=
      window.prompt(
        'Lý do hủy Project (bắt buộc):',
        ''
      )


    if(reason===null) return


    if(!reason.trim()){
      alert('Vui lòng nhập lý do hủy Project.')
      return
    }


    const ok=
      window.confirm(
        `Xác nhận hủy Project "${p.name}"? Project sẽ được ẩn khỏi danh sách đang hoạt động nhưng dữ liệu không bị xóa.`
      )


    if(!ok) return


    const {error:e}=
      await supabase.rpc(
        'cancel_project_safe',
        {
          p_project_id:p.id,
          p_reason:reason.trim()
        }
      )


    if(e){
      alert(
        'Không hủy được Project: '+
        e.message
      )
      return
    }


    setProjects(
      prev=>prev.filter(
        x=>x.id!==p.id
      )
    )

    setProject(null)
    setTasks([])
    setProjectMembers([])
    setView('projects')

    showToast('Đã hủy Project')
  }


  // ===================================================
  // CURRENT PROJECT PERMISSION
  // ===================================================

  const currentProjectMember=
    projectMembers.find(
      x=>
        x.user_id===
          session?.user?.id
    )


  const currentUserIsProjectLead=
    project
      ? (
          project.lead_id===
            session?.user?.id
          ||
          currentProjectMember
            ?.role_in_project===
            'lead'
        )
      : false


  const canTask=
    !!project
    &&
    (
      membership?.role==='manager'
      ||
      membership?.role==='team_lead'
      ||
      currentProjectMember
        ?.can_create_task===true
      ||
      currentUserIsProjectLead
    )


  const canAutoAddTaskAssignee=
    !!project
    &&
    (
      membership?.role==='manager'
      ||
      membership?.role==='team_lead'
      ||
      currentUserIsProjectLead
      ||
      currentProjectMember
        ?.can_manage_project_members===true
    )


  const assignableTaskMembers=
    canAutoAddTaskAssignee
      ? members
      : projectMembers


  // ===================================================
  // CREATE TASK
  // ===================================================

  async function quickCreateTask(){

    const title=
      quickTitle.trim()


    if(
      !title
      ||
      !project
      ||
      !canTask
    ){
      return
    }


    const {
      data:taskId,
      error:e
    } = await supabase.rpc(
      'create_project_task_safe',
      {
        p_project_id:
          project.id,

        p_title:
          title,

        p_assignee_id:
          session.user.id
      }
    )


    if(e){

      alert(
        'Không tạo được task: '+
        e.message
      )

      return
    }


    const {
      data
    } = await supabase
      .from('tasks')
      .select(
        '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))'
      )
      .eq(
        'id',
        taskId
      )
      .single()


    if(data){

      setTasks(
        prev=>[
          data,
          ...prev.filter(
            x=>x.id!==data.id
          )
        ]
      )
    }


    setQuickTitle('')


    showToast(
      'Đã thêm task'
    )
  }


  async function createTaskDetailed(form){
    const title=(form?.title||'').trim()
    if(!title||!project||!canTask){
      return {ok:false,error:'Vui lòng nhập tên Task.'}
    }

    const selectedIds=[...new Set((form?.assignee_ids||[]).filter(Boolean))]
    if(!selectedIds.length && form?.assignee_id) selectedIds.push(form.assignee_id)
    if(!selectedIds.length) selectedIds.push(session.user.id)

    for(const assigneeId of selectedIds){
      if(!projectMembers.some(m=>m.user_id===assigneeId)){
        const targetMember=members.find(m=>m.user_id===assigneeId)
        if(!targetMember){
          return {ok:false,error:'Không tìm thấy người được giao trong Workspace.'}
        }
        if(!canAutoAddTaskAssignee){
          return {ok:false,error:'Có người chưa thuộc Project. Hãy Add member vào Project trước khi giao Task.'}
        }
        const {error:addError}=await supabase.rpc('add_project_member_safe',{
          p_project_id:project.id,
          p_user_id:assigneeId,
          p_role_in_project:'member',
          p_can_create_task:true,
          p_can_assign_task:true,
          p_can_manage_project_members:false
        })
        if(addError){
          return {ok:false,error:'Không thể thêm người này vào Project: '+addError.message}
        }
        setProjectMembers(prev=>prev.some(x=>x.user_id===assigneeId)?prev:[...prev,{
          project_id:project.id,user_id:assigneeId,role_in_project:'member',
          can_create_task:true,can_assign_task:true,can_manage_project_members:false,
          profiles:targetMember.profiles
        }])
      }
    }

    const primaryAssignee=selectedIds[0]||null
    const {data:taskId,error:createError}=await supabase.rpc('create_project_task_safe',{
      p_project_id:project.id,
      p_title:title,
      p_assignee_id:primaryAssignee
    })
    if(createError){
      return {ok:false,error:'Không tạo được Task: '+createError.message}
    }

    const {error:assigneeError}=await supabase.rpc('set_task_assignees_safe',{
      p_task_id:taskId,
      p_user_ids:selectedIds
    })
    if(assigneeError){
      return {ok:false,error:'Task đã tạo nhưng chưa lưu được danh sách người phụ trách: '+assigneeError.message}
    }

    const deliveryUrl=(form?.delivery_url||'').trim()
    if(deliveryUrl){
      try{
        const u=new URL(deliveryUrl)
        if(!['http:','https:'].includes(u.protocol)) return {ok:false,error:'Delivery URL không hợp lệ.'}
      }catch{return {ok:false,error:'Delivery URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://'} }
    }
    const patch={
      description:(form?.description||'').trim()||null,
      priority:form?.priority||'medium',
      due_at:form?.due_at?new Date(form.due_at+'T17:00:00').toISOString():null,
      delivery_url:deliveryUrl||null
    }
    const {error:updateError}=await supabase.from('tasks').update(patch).eq('id',taskId)
    if(updateError){
      return {ok:false,error:'Task đã được tạo nhưng không lưu đủ thông tin: '+updateError.message}
    }

    const {data,error:loadError}=await supabase
      .from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))')
      .eq('id',taskId)
      .single()
    if(loadError){
      return {ok:false,error:'Task đã được tạo nhưng chưa tải lại được: '+loadError.message}
    }

    if(data){
      setTasks(prev=>[data,...prev.filter(x=>x.id!==data.id)])
      setFocusCommentId(null)
      setTaskDrawer(data)
    }
    showToast('Đã tạo Task')
    return {ok:true,task:data}
  }


  async function updateTaskAssignees(taskId,userIds){
    const ids=[...new Set((userIds||[]).filter(Boolean))]
    for(const uid of ids){
      if(project && !projectMembers.some(m=>m.user_id===uid)){
        const targetMember=members.find(m=>m.user_id===uid)
        if(!targetMember){ alert('Không tìm thấy người này trong Workspace.'); return }
        if(!canAutoAddTaskAssignee){ alert('Người này chưa thuộc Project. Hãy Add member vào Project trước.'); return }
        const {error:addError}=await supabase.rpc('add_project_member_safe',{
          p_project_id:project.id,p_user_id:uid,p_role_in_project:'member',
          p_can_create_task:true,p_can_assign_task:true,p_can_manage_project_members:false
        })
        if(addError){alert('Không thể thêm người này vào Project: '+addError.message);return}
      }
    }
    const {error}=await supabase.rpc('set_task_assignees_safe',{p_task_id:taskId,p_user_ids:ids})
    if(error){alert('Không lưu được người phụ trách: '+error.message);return}
    const {data}=await supabase.from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))')
      .eq('id',taskId).single()
    if(data){
      setTasks(prev=>prev.map(x=>x.id===taskId?{...x,...data}:x))
      if(taskDrawer?.id===taskId) setTaskDrawer(prev=>({...prev,...data}))
    }
    showToast('Đã cập nhật người phụ trách')
  }



  async function loadTaskIntoDrawer(taskId){
    if(!taskId) return
    const {data,error}=await supabase
      .from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*)), project:projects(name,code)')
      .eq('id',taskId)
      .single()
    if(error){alert('Không mở được Task: '+error.message);return}
    if(data) setTaskDrawer(data)
  }

  async function createSubtaskDetailed(parentTask,form){
    const title=(form?.title||'').trim()
    if(!parentTask?.id||!title) return {ok:false,error:'Vui lòng nhập tên Sub-task.'}
    const selectedIds=[...new Set((form?.assignee_ids||[]).filter(Boolean))]

    for(const uid of selectedIds){
      if(project && !projectMembers.some(m=>m.user_id===uid)){
        const targetMember=members.find(m=>m.user_id===uid)
        if(!targetMember) return {ok:false,error:'Không tìm thấy người phụ trách trong Workspace.'}
        if(!canAutoAddTaskAssignee) return {ok:false,error:'Có người chưa thuộc Project. Hãy Add member vào Project trước.'}
        const {error:addError}=await supabase.rpc('add_project_member_safe',{
          p_project_id:project.id,p_user_id:uid,p_role_in_project:'member',
          p_can_create_task:true,p_can_assign_task:true,p_can_manage_project_members:false
        })
        if(addError) return {ok:false,error:'Không thêm được người phụ trách vào Project: '+addError.message}
      }
    }

    const {data:taskId,error:createError}=await supabase.rpc('create_subtask_safe',{
      p_parent_task_id:parentTask.id,
      p_title:title,
      p_assignee_ids:selectedIds
    })
    if(createError) return {ok:false,error:'Không tạo được Sub-task: '+createError.message}

    const deliveryUrl=(form?.delivery_url||'').trim()
    if(deliveryUrl){
      try{const u=new URL(deliveryUrl);if(!['http:','https:'].includes(u.protocol))throw new Error('invalid')}
      catch{return {ok:false,error:'Delivery URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://'}}
    }
    const patch={
      description:(form?.description||'').trim()||null,
      priority:form?.priority||'medium',
      due_at:form?.due_at?new Date(form.due_at+'T17:00:00').toISOString():null,
      delivery_url:deliveryUrl||null
    }
    const {error:updateError}=await supabase.from('tasks').update(patch).eq('id',taskId)
    if(updateError) return {ok:false,error:'Sub-task đã tạo nhưng chưa lưu đủ thông tin: '+updateError.message}

    const {data}=await supabase
      .from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))')
      .eq('id',taskId).single()
    showToast('Đã tạo Sub-task')
    return {ok:true,task:data}
  }

  // ===================================================
  // UPDATE TASK
  // ===================================================

  async function updateTask(
    id,
    patch
  ){

    if(Object.prototype.hasOwnProperty.call(patch,'delivery_url')){
      const raw=(patch.delivery_url||'').trim()
      if(raw){
        try{
          const u=new URL(raw)
          if(!['http:','https:'].includes(u.protocol)){
            alert('URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://')
            return
          }
        }catch{
          alert('URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://')
          return
        }
      }
      patch={...patch,delivery_url:raw||null}
    }

    if(
      Object.prototype
        .hasOwnProperty
        .call(
          patch,
          'assignee_id'
        )
      &&
      patch.assignee_id
      &&
      project
      &&
      !projectMembers.some(
        m=>m.user_id===patch.assignee_id
      )
    ){

      const targetMember=
        members.find(
          m=>m.user_id===patch.assignee_id
        )


      if(!targetMember){
        alert('Không tìm thấy người này trong Workspace.')
        return
      }


      const canAutoAdd=
        membership?.role==='manager'
        ||
        membership?.role==='team_lead'
        ||
        currentUserIsProjectLead
        ||
        currentProjectMember
          ?.can_manage_project_members===true


      if(!canAutoAdd){
        alert(
          'Người này chưa thuộc Project. Bạn không có quyền thêm member vào Project.'
        )
        return
      }


      const targetName=
        targetMember.profiles?.full_name
        ||
        targetMember.profiles?.email
        ||
        'người này'


      const ok=
        window.confirm(
          `${targetName} chưa thuộc Project. Thêm người này vào Project với role Member rồi giao task luôn?`
        )


      if(!ok) return


      const {error:addError}=
        await supabase.rpc(
          'add_project_member_safe',
          {
            p_project_id:project.id,
            p_user_id:patch.assignee_id,
            p_role_in_project:'member',
            p_can_create_task:true,
            p_can_assign_task:true,
            p_can_manage_project_members:false
          }
        )


      if(addError){
        alert(
          'Không thể thêm người này vào Project: '+
          addError.message
        )
        return
      }


      setProjectMembers(
        prev=>[
          ...prev,
          {
            project_id:project.id,
            user_id:patch.assignee_id,
            role_in_project:'member',
            can_create_task:true,
            can_assign_task:true,
            can_manage_project_members:false,
            profiles:targetMember.profiles
          }
        ]
      )
    }


    const old=
      tasks.find(
        t=>t.id===id
      )


    setTasks(
      prev=>
        prev.map(
          t=>
            t.id===id
              ? {
                  ...t,
                  ...patch
                }
              : t
        )
    )


    if(
      taskDrawer?.id===id
    ){

      setTaskDrawer(
        prev=>({
          ...prev,
          ...patch
        })
      )
    }


    let dbError=null


    // -----------------------------------------------
    // ASSIGNEE
    // -----------------------------------------------

    if(
      Object.prototype
        .hasOwnProperty
        .call(
          patch,
          'assignee_id'
        )
    ){

      const r=
        await supabase.rpc(
          'assign_task_safe',
          {
            p_task_id:
              id,

            p_assignee_id:
              patch.assignee_id||null
          }
        )


      dbError=
        r.error
    }


    // -----------------------------------------------
    // STATUS
    // -----------------------------------------------

    else if(
      Object.prototype
        .hasOwnProperty
        .call(
          patch,
          'status'
        )
    ){

      const r=
        await supabase.rpc(
          'update_task_status_safe',
          {
            p_task_id:
              id,

            p_status:
              patch.status
          }
        )


      dbError=
        r.error
    }


    // -----------------------------------------------
    // NORMAL UPDATE
    // -----------------------------------------------

    else{

      const r=
        await supabase
          .from('tasks')
          .update(patch)
          .eq(
            'id',
            id
          )


      dbError=
        r.error
    }


    if(dbError){

      setTasks(
        prev=>
          prev.map(
            t=>
              t.id===id
                ? old
                : t
          )
      )


      if(
        taskDrawer?.id===id
      ){

        setTaskDrawer(
          old
        )
      }


      alert(
        'Không lưu được task: '+
        dbError.message
      )

      return
    }


    showToast(
      'Đã lưu'
    )
  }


  // ===================================================
  // ARCHIVE / DELETE TEST TASK
  // ===================================================

  async function archiveTask(task){
    if(!task?.id) return

    const ok=window.confirm(
      `Archive task "${task.title}"? Task sẽ được ẩn khỏi My Tasks/Reports mặc định nhưng vẫn giữ lịch sử.`
    )
    if(!ok) return

    const archivedAt=new Date().toISOString()
    const {error}=await supabase
      .from('tasks')
      .update({archived_at:archivedAt})
      .eq('id',task.id)

    if(error){
      alert('Không archive được task: '+error.message)
      return
    }

    setTasks(prev=>prev.filter(t=>t.id!==task.id))
    if(taskDrawer?.id===task.id){
      setTaskDrawer(null)
      setFocusCommentId(null)
    }
    showToast('Đã archive Task')
  }

  async function deleteTestTask(task){
    if(!task?.id) return

    const ok=window.confirm(
      `XÓA HẲN task test "${task.title}"?\n\nChỉ nên dùng cho dữ liệu test. Thao tác này không thể hoàn tác.`
    )
    if(!ok) return

    const confirmAgain=window.prompt(
      'Nhập DELETE để xác nhận xóa hẳn task test:'
    )
    if(confirmAgain!=='DELETE') return

    const {data,error}=await supabase.rpc(
      'manager_delete_test_task',
      {p_task_id:task.id}
    )

    if(error){
      alert('Không xóa được task test: '+error.message)
      return
    }

    if(data?.ok===false){
      alert(data?.message||'Task này không đủ điều kiện để xóa hẳn. Hãy Archive thay thế.')
      return
    }

    setTasks(prev=>prev.filter(t=>t.id!==task.id))
    if(taskDrawer?.id===task.id){
      setTaskDrawer(null)
      setFocusCommentId(null)
    }
    showToast('Đã xóa task test')
  }


  // ===================================================
  // CHECKBOX
  // ===================================================

  async function completeByCheckbox(
    t
  ){

    if(
      t.status==='done'
    ){

      await updateTask(
        t.id,
        {
          status:'in_progress'
        }
      )

      return
    }


    const requireReview=
      project
        ?.require_task_review!==false


    const next=
      requireReview
      &&
      !canReviewTask(
        membership,
        currentProjectMember
      )
        ? 'review'
        : 'done'


    await updateTask(
      t.id,
      {
        status:next
      }
    )
  }


  // ===================================================
  // TOAST
  // ===================================================

  function showToast(msg){

    setToast(msg)

    setTimeout(
      ()=>{
        setToast('')
      },
      2200
    )
  }


  // ===================================================
  // FILTER TASKS
  // ===================================================

  const filtered=
    useMemo(
      ()=>{

        let rows=[
          ...tasks
        ]


        if(
          taskFilter==='my'
        ){

          rows=
            rows.filter(
              t=>
                t.assignee_id===session?.user?.id
                || (t.task_assignees||[]).some(a=>a.user_id===session?.user?.id)
            )
        }


        if(
          taskFilter==='overdue'
        ){

          rows=
            rows.filter(
              t=>
                t.due_at
                &&
                new Date(
                  t.due_at
                )<
                new Date()
                &&
                t.status!=='done'
            )
        }


        if(
          taskFilter==='review'
        ){

          rows=
            rows.filter(
              t=>
                t.status==='review'
            )
        }


        if(
          search.trim()
        ){

          const q=
            search
              .toLowerCase()


          rows=
            rows.filter(
              t=>
                `${t.code} ${t.title} ${t.profiles?.full_name||''} ${(t.task_assignees||[]).map(a=>a.profiles?.full_name||a.profiles?.email||'').join(' ')}`
                  .toLowerCase()
                  .includes(q)
            )
        }


        return rows

      },
      [
        tasks,
        search,
        taskFilter,
        session?.user?.id
      ]
    )


  // ===================================================
  // STATS
  // ===================================================

  const stats=
    useMemo(
      ()=>({

        total:
          tasks.length,

        done:
          tasks.filter(
            x=>
              x.status==='done'
          ).length,

        review:
          tasks.filter(
            x=>
              x.status==='review'
          ).length,

        overdue:
          tasks.filter(
            x=>
              x.due_at
              &&
              new Date(
                x.due_at
              )<
              new Date()
              &&
              x.status!=='done'
          ).length

      }),
      [tasks]
    )


  const progress=
    stats.total
      ? Math.round(
          stats.done/
          stats.total*
          100
        )
      : 0


  // ===================================================
  // EXPORT
  // ===================================================

  function exportExcel(){

    const rows=
      filtered.map(
        t=>({

          Project:
            project?.name,

          'Task code':
            t.code,

          'Task name':
            t.title,

          Assignee:
            t.profiles
              ?.full_name||'',

          Status:
            LABEL[t.status]
            ||
            t.status,

          Progress:
            t.progress,

          Priority:
            PRIORITY[t.priority]
            ||
            t.priority,

          Deadline:
            t.due_at||'',

          Completed:
            t.completed_at||'',

          Description:
            t.description||'',

          Delivery:
            t.delivery_url||''
        })
      )


    const ws=
      XLSX.utils
        .json_to_sheet(
          rows
        )


    const wb=
      XLSX.utils
        .book_new()


    XLSX.utils
      .book_append_sheet(
        wb,
        ws,
        'Tasks'
      )


    XLSX.writeFile(
      wb,
      `${project?.code||'project'}-report.xlsx`
    )
  }


  // ===================================================
  // STATES
  // ===================================================

  if(loading){

    return <div className="center">

      <div className="spinner"/>

      Đang tải FPTU Work...

    </div>
  }


  if(error){

    return <div className="center errorBox">

      {error}

    </div>
  }


  if(!session){

    return <Login
      onLogin={login}
    />
  }


  if(!membership){

    return <NoMembership
      profile={profile}
      onLogout={logout}
    />
  }


  const canCreateAnyProject=
    membership.status==='active'


  // ===================================================
  // UI
  // ===================================================

  return <div className="appShell">

    <style jsx global>{`
      .mobileProjectActions,.mobileProjectMenu,.mobileBottomNav,.mobileMoreMenu{display:none}
      .projectHeaderActions{display:flex;align-items:center;gap:10px;position:relative}
      .quickAddSave{margin-left:8px;white-space:nowrap}
      .taskCreateSticky{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
      .taskActionMenu{position:relative;display:flex;align-items:center;gap:8px}
      .taskMenuPopover{position:absolute;right:0;top:44px;z-index:1800;min-width:230px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 18px 42px rgba(15,23,42,.18);padding:7px}
      .taskMenuPopover button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:11px 12px;border-radius:9px;font-size:14px}
      .taskMenuPopover button:hover{background:#f8fafc}
      .taskMenuPopover .danger{color:#b42318;font-weight:700}
      .taskArchiveHint{font-size:12px;line-height:1.4;color:#64748b;padding:8px 10px 4px}
      .kanbanMobileStatus{display:none}

      .segmentedControl{display:inline-flex;border:1px solid #dfe3e8;border-radius:10px;overflow:hidden;background:#fff}
      .segmentedControl button{border:0;background:#fff;padding:9px 12px;font-weight:700;color:#64748b;cursor:pointer}
      .segmentedControl button.active{background:#eff6ff;color:#1d4ed8}
      .teamListPanel{overflow:hidden}
      .teamListHeader,.teamListRow{display:grid;grid-template-columns:minmax(240px,1.7fr) minmax(180px,1fr) 110px 90px;gap:14px;align-items:center;padding:12px 16px}
      .teamListHeader{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;background:#f8fafc;border-bottom:1px solid #e5e7eb}
      .teamListRow{border-bottom:1px solid #edf0f3}
      .teamListRow:last-child{border-bottom:0}
      .teamListRow small{display:block;color:#64748b;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .projectIcon.small{width:34px;height:34px;min-width:34px;font-size:12px}
      .subtaskSection{margin-top:18px;border-top:1px solid #e5e7eb;padding-top:18px}
      .subtaskList{display:grid;gap:8px}
      .subtaskRow{width:100%;display:flex;align-items:center;gap:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:10px 12px;cursor:pointer}
      .subtaskRow:hover{background:#f8fafc}
      .subtaskRow small{display:block;color:#64748b;margin-top:3px;white-space:normal}
      @media (max-width: 760px){
        .teamListPanel{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
        .teamListHeader{display:none!important}
        .teamListRow{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;padding:13px 12px!important;min-width:0!important}
        .teamListRow>span:nth-child(1){grid-column:1!important;min-width:0!important}
        .teamListRow>span:nth-child(2){grid-column:1!important;color:#64748b!important;font-size:13px!important;padding-left:44px!important}
        .teamListRow>span:nth-child(3){grid-column:1!important;color:#64748b!important;font-size:13px!important;padding-left:44px!important}
        .teamListRow>span:nth-child(4){grid-column:2!important;grid-row:1/4!important;align-self:center!important}
        .segmentedControl{width:100%!important}
        .segmentedControl button{flex:1!important;min-height:42px!important}
        .subtaskRow{align-items:flex-start!important}

        html,body{overflow-x:hidden}
        .appShell{display:block!important;min-width:0!important}
        .sidebar{display:none!important}
        .main{margin-left:0!important;width:100%!important;min-width:0!important}
        .topbar{padding:10px 14px!important;gap:8px!important;position:sticky!important;top:0!important;z-index:500!important;background:#fff!important}
        .topbar>div:first-child{min-width:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:ellipsis!important}
        .page{padding:18px 14px 96px!important;min-width:0!important}
        .projectPage{padding-top:16px!important}
        .projectHeader{display:grid!important;grid-template-columns:52px minmax(0,1fr) auto!important;gap:12px!important;align-items:start!important}
        .projectHeader .grow{min-width:0!important;width:100%!important}
        .projectHeader h1{font-size:28px!important;line-height:1.12!important;margin:4px 0 8px!important;word-break:normal!important;overflow-wrap:anywhere!important}
        .projectHeader .desc{font-size:15px!important;line-height:1.45!important;max-width:none!important;white-space:normal!important;overflow:visible!important;display:-webkit-box!important;-webkit-line-clamp:4!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
        .projectHeaderActions{align-self:start!important}
        .desktopProjectAction{display:none!important}
        .mobileProjectMenu{display:block!important;position:relative!important}
        .mobileProjectMenuPopover{position:absolute;right:0;top:44px;z-index:1400;min-width:180px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 16px 35px rgba(15,23,42,.18);padding:6px}
        .mobileProjectMenuPopover button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:11px;border-radius:8px;font-size:15px}
        .tabs{display:flex!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;gap:8px!important;-webkit-overflow-scrolling:touch!important;padding-bottom:3px!important;scrollbar-width:none!important}
        .tabs::-webkit-scrollbar{display:none!important}
        .tabs button{flex:0 0 auto!important;padding:12px 14px!important}
        .statGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .overviewGrid{grid-template-columns:1fr!important}
        .panel{border-radius:14px!important;min-width:0!important}
        .taskToolbar{display:block!important;padding:12px!important}
        .taskToolbar>input{width:100%!important;box-sizing:border-box!important;margin-bottom:10px!important}
        .chips{display:flex!important;overflow-x:auto!important;gap:8px!important;white-space:nowrap!important;padding-bottom:3px!important;scrollbar-width:none!important}
        .chips::-webkit-scrollbar{display:none!important}
        .chips button{flex:0 0 auto!important}
        .createTaskButton{background:#f97316!important;color:#fff!important;border-color:#f97316!important}
        .taskHeader{display:none!important}
        .taskRow{display:grid!important;grid-template-columns:42px minmax(0,1fr)!important;gap:8px!important;padding:14px 12px!important;border-top:1px solid #edf0f3!important;align-items:start!important}
        .taskRow>.check{grid-column:1!important;grid-row:1!important}
        .taskRow>.taskTitle{grid-column:2!important;grid-row:1!important;min-width:0!important;text-align:left!important}
        .taskRow>div,.taskRow>input,.taskRow>select{display:none!important}
        .taskTitle b{font-size:17px!important;white-space:normal!important;word-break:break-word!important}
        .taskTitle small{margin-top:4px!important}
        .quickAdd{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:8px!important;padding:12px!important;position:sticky!important;bottom:70px!important;background:#fff!important;z-index:80!important;border-top:1px solid #edf0f3!important}
        .quickAdd input{min-width:0!important;width:100%!important}
        .quickAddSave{margin-left:0!important;padding:10px 14px!important}
        .mobileProjectActions{display:flex!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:900!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(12px)!important;border-top:1px solid #e5e7eb!important;padding:10px 14px calc(10px + env(safe-area-inset-bottom))!important;gap:10px!important}
        .mobileProjectActions button{flex:1!important;min-height:46px!important;font-size:16px!important;font-weight:700!important}
        body:has(.drawerWrap){overflow:hidden!important;overscroll-behavior:none!important}
        .drawerWrap{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;display:flex!important;align-items:flex-end!important;padding:0!important;z-index:2500!important;background:rgba(15,23,42,.35)!important;overscroll-behavior:contain!important;touch-action:none!important}
        .drawerWrap .drawer{position:relative!important;z-index:2501!important;display:flex!important;flex-direction:column!important;width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;background:#fff!important}
        .drawerBody{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;padding-bottom:calc(120px + env(safe-area-inset-bottom))!important}
        .appShell:has(.drawerWrap) .mobileProjectActions,.appShell:has(.drawerWrap) .mobileBottomNav{display:none!important}
        .mobileProjectActions,.mobileBottomNav{transition:opacity .15s ease!important}
        .reportTabs{display:flex!important;gap:8px!important;overflow-x:auto!important;flex-wrap:nowrap!important;white-space:nowrap!important;padding-bottom:4px!important;scrollbar-width:none!important}
        .reportTabs::-webkit-scrollbar{display:none!important}
        .reportTabs button{flex:0 0 auto!important}
        .reportFilters{display:flex!important;gap:9px!important;overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important;padding:2px 0 8px!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important;scroll-snap-type:x proximity!important}
        .reportFilters::-webkit-scrollbar{display:none!important}
        .reportFilters input,.reportFilters select{flex:0 0 210px!important;width:210px!important;min-width:210px!important;font-size:16px!important;min-height:46px!important;scroll-snap-align:start!important}
        .reportQuick{display:flex!important;gap:8px!important;overflow-x:auto!important;flex-wrap:nowrap!important;white-space:nowrap!important;padding-bottom:4px!important;scrollbar-width:none!important}
        .reportQuick::-webkit-scrollbar{display:none!important}
        .reportQuick button,.reportQuick select{flex:0 0 auto!important}
        .reportStatGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .reportTwoCol{grid-template-columns:1fr!important}
        .reportWorkloadGrid{grid-template-columns:1fr!important}
        .reportTableWrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;max-width:100%!important}
        .reportTableWrap table{min-width:820px!important}
        .mobileStickyAction{position:sticky!important;bottom:0!important;z-index:2605!important;background:#fff!important;border-top:1px solid #e5e7eb!important;margin:16px -16px calc(-120px - env(safe-area-inset-bottom))!important;padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;box-shadow:0 -8px 24px rgba(15,23,42,.08)!important}
        .mobileStickyAction button{min-height:48px!important;font-size:16px!important}
        .deliveryLinkRow{display:flex!important;gap:8px!important;align-items:center!important}
        .deliveryLinkRow input{min-width:0!important;flex:1!important}
        .deliveryOpenBtn{flex:0 0 auto!important;min-height:46px!important;white-space:nowrap!important}
        .kanban{display:flex!important;overflow-x:auto!important;gap:12px!important;padding-bottom:10px!important;scroll-snap-type:x proximity!important;-webkit-overflow-scrolling:touch!important}
        .kanbanCol{flex:0 0 86vw!important;max-width:360px!important;scroll-snap-align:start!important}
        .kanbanCard{cursor:pointer!important}
        .kanbanMobileStatus{display:block!important;width:100%!important;margin-top:10px!important;min-height:42px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;background:#fff!important;padding:8px 10px!important;font-size:15px!important}
        .mobileTaskMeta{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin-top:8px!important}
        .mobileTaskMeta span{display:inline-flex!important;align-items:center!important;border:1px solid #e5e7eb!important;border-radius:999px!important;padding:4px 7px!important;font-size:12px!important;background:#fff!important}
        .taskRow>.taskTitle{padding-right:0!important}

        .drawer,.drawer.narrow{width:100%!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;overflow:hidden!important}
        .drawerHead{padding:14px 16px!important;position:sticky!important;top:0!important;background:#fff!important;z-index:20!important}
        .drawerHead>div:first-child{min-width:0!important;flex:1!important}
        .drawerTitle{font-size:21px!important;line-height:1.25!important;min-width:0!important;width:100%!important}
        .taskActionMenu{gap:6px!important;flex:0 0 auto!important}
        .taskActionMenu>button{min-width:44px!important;min-height:44px!important;font-size:22px!important}
        .taskMenuPopover{position:fixed!important;left:12px!important;right:12px!important;top:auto!important;bottom:calc(82px + env(safe-area-inset-bottom))!important;min-width:0!important;border-radius:18px!important;padding:8px!important;box-shadow:0 24px 60px rgba(15,23,42,.28)!important}
        .taskMenuPopover button{min-height:50px!important;font-size:16px!important;padding:13px 14px!important}
        .taskMenuPopover .taskArchiveHint{font-size:13px!important;padding:9px 12px!important}
        .drawerBody{padding:14px 16px calc(120px + env(safe-area-inset-bottom))!important;overflow-y:auto!important;max-height:none!important}
        .fieldGrid,.taskCreateGrid{grid-template-columns:1fr!important}
        .field input,.field select,.field textarea,.fullInput{font-size:16px!important;min-height:46px!important;width:100%!important;box-sizing:border-box!important}
        .taskCreateDrawer{height:100dvh!important;max-height:100dvh!important}
        .taskCreateBody{padding-bottom:calc(120px + env(safe-area-inset-bottom))!important}
        .taskCreateSticky{position:sticky!important;bottom:0!important;background:#fff!important;border-top:1px solid #e5e7eb!important;margin:18px -16px calc(-120px - env(safe-area-inset-bottom))!important;padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;z-index:2605!important;display:grid!important;grid-template-columns:1fr 1.5fr!important;box-shadow:0 -8px 24px rgba(15,23,42,.08)!important}
        .taskCreateSticky button{min-height:48px!important;font-size:16px!important;font-weight:700!important}
        .notificationPopover{left:12px!important;right:12px!important;width:auto!important;max-width:none!important}
        .mobileBottomNav{display:grid!important;grid-template-columns:repeat(5,1fr)!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:1000!important;background:rgba(255,255,255,.98)!important;backdrop-filter:blur(14px)!important;border-top:1px solid #dbe5f0!important;padding:7px 6px calc(7px + env(safe-area-inset-bottom))!important;box-shadow:0 -8px 28px rgba(15,57,104,.08)!important}
        .mobileBottomNav button{border:0!important;background:transparent!important;color:#64748b!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;font-size:11px!important;font-weight:700!important;min-height:48px!important;padding:3px!important}
        .mobileBottomNav button span:first-child{font-size:21px!important;line-height:1!important}
        .mobileBottomNav button.active{color:#1367d1!important}
        .mobileMoreMenu{display:block!important;position:fixed!important;left:12px!important;right:12px!important;bottom:calc(76px + env(safe-area-inset-bottom))!important;z-index:2200!important;max-height:65dvh!important;overflow-y:auto!important;background:#fff!important;border:1px solid #dbe5f0!important;border-radius:18px!important;box-shadow:0 20px 50px rgba(15,57,104,.22)!important;padding:8px!important}
        .mobileMoreMenu button{display:flex!important;width:100%!important;align-items:center!important;gap:10px!important;border:0!important;background:#fff!important;text-align:left!important;padding:13px 14px!important;border-radius:12px!important;font-size:15px!important;font-weight:700!important;color:#1e293b!important}
        .mobileMoreMenu button:active{background:#eff6ff!important}
        .mobileProjectActions{bottom:66px!important}
        .quickAdd{bottom:136px!important}
        .page{padding-bottom:150px!important}
        .homeHero{border-radius:22px!important;padding:20px!important}
        .homeHero h1{font-size:29px!important}
        .homeKpiGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .homeTwoCol{grid-template-columns:1fr!important}
        .birthdayHero{padding:20px!important;border-radius:22px!important}
        .birthdayHero h2{font-size:25px!important}
      }
    `}</style>

    <aside className="sidebar">

      <div className="brand">

        <div className="brandMark">
          F
        </div>

        <div>

          <b>
            FPTU Work
          </b>

          <small>
            Project Workspace
          </small>

        </div>

      </div>


      <nav>

        <button
          className={
            view==='home'
              ? 'active'
              : ''
          }
          onClick={()=>
            setView('home')
          }
        >
          ⌂ <span>Home</span>
        </button>


        <button
          className={
            view==='mytasks'
              ? 'active'
              : ''
          }
          onClick={()=>
            setView('mytasks')
          }
        >
          ✓ <span>My Tasks</span>
        </button>


        <button
          className={
            (
              view==='projects'
              ||
              view==='project'
            )
              ? 'active'
              : ''
          }
          onClick={()=>{

            setView('projects')
            setProject(null)
          }}
        >
          ▦ <span>Projects</span>
        </button>


        <button
          className={
            view==='teams'
              ? 'active'
              : ''
          }
          onClick={()=>
            setView('teams')
          }
        >
          ♟ <span>Teams</span>
        </button>


        {canManageWorkspace(
          membership
        ) &&
          <button
            className={
              view==='members'
                ? 'active'
                : ''
            }
            onClick={()=>
              setView('members')
            }
          >
            ♙ <span>Members</span>
          </button>
        }


        <button
          className={
            view==='reports'
              ? 'active'
              : ''
          }
          onClick={()=>
            setView('reports')
          }
        >
          ▥ <span>Reports</span>
        </button>

      </nav>


      <div className="sideProjects">

        <div className="sectionLabel">
          PROJECTS
        </div>

        {projects
          .slice(0,8)
          .map(
            p=>
              <button
                key={p.id}
                onClick={()=>
                  openProject(p)
                }
              >

                <i/>

                <span>
                  {p.name}
                </span>

              </button>
          )
        }

      </div>


      <div className="userMini">

        <button
          type="button"
          className="avatarButton"
          title="Chỉnh sửa hồ sơ"
          onClick={()=>setProfileEditOpen(true)}
        >
          <Avatar p={profile}/>
        </button>

        <div>

          <b>
            {
              profile?.full_name
              ||
              profile?.email
            }
          </b>

          <small>

            {
              membership.role==='manager'
                ? 'Trưởng phòng'

                : membership.role==='team_lead'
                  ? 'Team Lead'

                  : 'Member/CTV'
            }

          </small>

        </div>

        <button
          onClick={logout}
        >
          ↪
        </button>

      </div>

    </aside>


    <main className="main">

      <header className="topbar">

        <div>

          <b>
            {
              workspace?.name
              ||
              'FPTU Work'
            }
          </b>

          <span className="crumb">

            {' / '}

            {
              view==='project'
                ? project?.name
                : view
            }

          </span>

        </div>


        <div className="topActions">

          <select
            aria-label="Language"
            value={uiLang}
            onChange={e=>setUiLang(e.target.value)}
            style={{border:'1px solid #dbe4ef',background:'#fff',borderRadius:10,padding:'8px 10px',fontWeight:700,color:'#334155'}}
          >
            <option value="vi">VI</option>
            <option value="en">EN</option>
          </select>

          <button
            type="button"
            onClick={enablePush}
            title={
              pushStatus==='enabled'
                ? 'Thông báo hệ điều hành đã bật'
                : pushStatus==='blocked'
                  ? 'Thông báo đang bị chặn trong trình duyệt'
                  : 'Bật thông báo trên thiết bị này'
            }
            style={{
              border:'1px solid #f2b27b',
              background:
                pushStatus==='enabled'
                  ? '#fff3e8'
                  : '#fff',
              color:'#9a4b00',
              borderRadius:10,
              padding:'8px 10px',
              fontWeight:700,
              cursor:'pointer',
              whiteSpace:'nowrap'
            }}
          >
            {
              pushStatus==='enabled'
                ? '🔔 Push ON'
                : pushStatus==='checking'
                  ? '🔔 ...'
                  : '🔔 Bật thông báo'
            }
          </button>


          <button
            className="iconBtn"
            title="Thông báo"
            onClick={()=>
              setNotificationOpen(
                !notificationOpen
              )
            }
          >

            🔔

            {
              notifications
                .filter(
                  n=>!n.is_read
                )
                .length>0
              &&
              <em>

                {
                  notifications
                    .filter(
                      n=>!n.is_read
                    )
                    .length
                }

              </em>
            }

          </button>


          <button
            type="button"
            className="avatarButton"
            title="Chỉnh sửa hồ sơ"
            onClick={()=>setProfileEditOpen(true)}
          >
            <Avatar p={profile}/>
          </button>

        </div>

      </header>


      {view==='projects' &&
        <Projects
          projects={projects}
          onOpen={openProject}
          onCreate={()=>
            setProjectCreateOpen(true)
          }
          canCreate={
            canCreateAnyProject
          }
        />
      }


      {view==='project' &&
        project &&
        <ProjectPage
          project={project}
          setProject={setProject}

          tab={projectTab}
          setTab={setProjectTab}

          stats={stats}
          progress={progress}

          tasks={filtered}

          search={search}
          setSearch={setSearch}

          taskFilter={taskFilter}
          setTaskFilter={setTaskFilter}

          quickTitle={quickTitle}
          setQuickTitle={setQuickTitle}

          quickCreateTask={quickCreateTask}
          createTaskDetailed={createTaskDetailed}

          canTask={canTask}

          members={projectMembers}
          workspaceMembers={members}
          assignableTaskMembers={
            assignableTaskMembers
          }

          onCancelProject={()=>
            cancelProject(project)
          }

          openTask={(task)=>{

            setFocusCommentId(null)
            setTaskDrawer(task)
          }}

          updateTask={updateTask}
          updateTaskAssignees={updateTaskAssignees}

          completeByCheckbox={
            completeByCheckbox
          }

          exportExcel={exportExcel}

          membership={membership}

          currentProjectMember={
            currentProjectMember
          }

          currentUserIsProjectLead={
            currentUserIsProjectLead
          }

          onProjectMembersChanged={()=>
            openProject(
              project,
              {
                tab:'overview'
              }
            )
          }
        />
      }


      {view==='home' &&
        <HomeDashboard
          projects={projects}
          members={members}
          teams={teams}
          profile={profile}
          membership={membership}
          onNavigate={(next)=>{setMobileMoreOpen(false);setView(next)}}
        />
      }


      {view==='mytasks' &&
        <MyTasks
          membership={membership}
          projects={projects}
          members={members}
          onOpenProject={async(p)=>{await openProject(p,{tab:'overview'})}}
          onOpenTask={async(task)=>{
            if(!task?.project) return

            const opened=await openProject(
              task.project,
              {tab:'list'}
            )

            const targetTask=
              opened?.tasks?.find(
                x=>x.id===task.id
              )
              || task

            setFocusCommentId(null)
            setTaskDrawer(targetTask)
          }}
        />
      }


      {view==='teams' &&
        <Teams
          teams={teams}
          projects={projects}
          membership={membership}
          currentUserId={session.user.id}

          canCreate={
            canManageWorkspace(
              membership
            )
          }

          onCreate={()=>
            setTeamCreateOpen(true)
          }

          onEdit={setTeamEdit}
        />
      }


      {view==='members' &&
        canManageWorkspace(
          membership
        ) &&
        <Members
          members={members}

          onOpen={
            openMemberDrawerFresh
          }

          onInvite={()=>
            setInviteOpen(true)
          }
        />
      }


      {view==='reports' &&
        <Reports
          projects={projects}
          members={members}
          teams={teams}
          membership={membership}
          onOpenProject={p=>openProject(p,{tab:'overview'})}
          onOpenTask={async(task)=>{
            const p=projectMapSafe(projects,task?.project_id,task?.project)
            if(!p) return
            const opened=await openProject(p,{tab:'list'})
            const targetTask=opened?.tasks?.find(x=>x.id===task.id)||task
            setFocusCommentId(null)
            setTaskDrawer(targetTask)
          }}
        />
      }

      {mobileMoreOpen && <div className="mobileMoreMenu">
        <button onClick={()=>{setMobileMoreOpen(false);setView('teams')}}>♟ Teams</button>
        {canManageWorkspace(membership) && <button onClick={()=>{setMobileMoreOpen(false);setView('members')}}>♙ Members & Permissions</button>}
        <button onClick={()=>{setMobileMoreOpen(false);setProfileEditOpen(true)}}>☺ Hồ sơ cá nhân</button>
        <button onClick={()=>{setMobileMoreOpen(false);setNotificationOpen(true)}}>🔔 Notifications</button>
      </div>}

      <nav className="mobileBottomNav">
        <button className={view==='home'?'active':''} onClick={()=>{setMobileMoreOpen(false);setView('home')}}><span>⌂</span><span>Home</span></button>
        <button className={view==='mytasks'?'active':''} onClick={()=>{setMobileMoreOpen(false);setView('mytasks')}}><span>✓</span><span>My Tasks</span></button>
        <button className={(view==='projects'||view==='project')?'active':''} onClick={()=>{setMobileMoreOpen(false);setView('projects');setProject(null)}}><span>▦</span><span>Projects</span></button>
        <button className={view==='reports'?'active':''} onClick={()=>{setMobileMoreOpen(false);setView('reports')}}><span>▥</span><span>Reports</span></button>
        <button className={mobileMoreOpen||view==='teams'||view==='members'?'active':''} onClick={()=>setMobileMoreOpen(v=>!v)}><span>•••</span><span>More</span></button>
      </nav>

    </main>


    {taskDrawer &&
      <TaskDrawer
        key={taskDrawer.id}
        task={taskDrawer}

        project={project}

        projectMembers={
          assignableTaskMembers
        }

        focusCommentId={
          focusCommentId
        }

        onFocusDone={()=>
          setFocusCommentId(null)
        }

        onClose={()=>{

          setTaskDrawer(null)
          setFocusCommentId(null)
        }}

        onUpdate={
          updateTask
        }

        onUpdateAssignees={updateTaskAssignees}
        onCreateSubtask={createSubtaskDetailed}
        onOpenTask={t=>setTaskDrawer(t)}
        onOpenParent={loadTaskIntoDrawer}

        canArchive={
          membership?.role==='manager'
          || membership?.role==='team_lead'
          || currentUserIsProjectLead
        }

        canDeleteTest={
          membership?.role==='manager'
        }

        onArchive={archiveTask}
        onDeleteTest={deleteTestTask}
      />
    }


    {memberDrawer &&
      <MemberDrawer
        item={memberDrawer}
        teams={teams}

        onClose={()=>
          setMemberDrawer(null)
        }

        onSaved={()=>
          bootstrap(
            session.user
          )
        }
      />
    }




    {profileEditOpen &&
      <ProfileEditDrawer
        profile={profile}
        onClose={()=>setProfileEditOpen(false)}
        onSaved={async updated=>{
          setProfile(updated)
          setProfileEditOpen(false)
          showToast('Đã cập nhật hồ sơ')
        }}
      />
    }


    {teamEdit &&
      <TeamEditDrawer
        team={teamEdit}
        members={members}
        membership={membership}
        onClose={()=>setTeamEdit(null)}
        onSaved={async updated=>{
          setTeams(prev=>prev.map(t=>t.id===updated.id ? {...t,...updated} : t))
          setTeamEdit(null)
          await bootstrap(session.user)
          showToast('Đã cập nhật Team')
        }}
      />
    }

    {projectCreateOpen &&
      <ProjectCreateDrawer
        teams={teams}
        membership={membership}

        onClose={()=>
          setProjectCreateOpen(false)
        }

        onCreate={
          createProject
        }
      />
    }


    {inviteOpen &&
      <InviteDrawer
        teams={teams}
        projects={projects}
        membership={membership}

        onClose={()=>
          setInviteOpen(false)
        }

        onCreated={()=>
          showToast(
            'Đã tạo link mời'
          )
        }
      />
    }


    {notificationOpen &&
      <NotificationPanel
        notifications={
          notifications
        }

        onClose={()=>
          setNotificationOpen(false)
        }

        onOpenNotification={
          openNotification
        }

        onMarkAll={async()=>{

          await supabase
            .from('notifications')
            .update({
              is_read:true
            })
            .eq(
              'user_id',
              session.user.id
            )
            .eq(
              'is_read',
              false
            )

          await loadNotifications()
        }}
      />
    }


    {teamCreateOpen &&
      <TeamCreateDrawer
        members={members}

        onClose={()=>
          setTeamCreateOpen(false)
        }

        onCreate={
          createTeam
        }
      />
    }


    {toast &&
      <div className="toast">

        ✓ {toast}

      </div>
    }

  </div>
}


// =====================================================
// LOGIN
// =====================================================

function Login({
  onLogin
}){

  return <div className="loginPage">

    <div className="loginCard">

      <div className="loginLogo">
        F
      </div>

      <h1>
        FPTU Work
      </h1>

      <p>
        Project Management Workspace
      </p>

      <button
        className="googleBtn"
        onClick={onLogin}
      >
        <span>G</span>
        Tiếp tục với Google
      </button>

      <small>
        Bất kỳ tài khoản Google nào cũng có thể đăng nhập.
        Quyền truy cập được quản lý theo Workspace và Project.
      </small>

    </div>

  </div>
}


// =====================================================
// NO MEMBERSHIP
// =====================================================

function NoMembership({
  profile,
  onLogout
}){

  return <div className="loginPage">

    <div className="loginCard">

      <Avatar
        p={profile}
        big
      />

      <h2>
        {profile?.full_name}
      </h2>

      <p>
        Bạn đã đăng nhập nhưng chưa thuộc Workspace.
        Hãy mở lại link mời.
      </p>

      <button
        className="secondary"
        onClick={onLogout}
      >
        Đăng xuất
      </button>

    </div>

  </div>
}


// =====================================================
// AVATAR
// =====================================================

function Avatar({
  p,
  big
}){

  return p?.avatar_url

    ? <img
        className={
          big
            ? 'avatar big'
            : 'avatar'
        }

        src={p.avatar_url}

        alt=""
      />

    : <div
        className={
          big
            ? 'avatar fallback big'
            : 'avatar fallback'
        }
      >

        {
          initials(
            p?.full_name
            ||
            p?.email
          )
        }

      </div>
}


// =====================================================
// PROJECT LIST
// =====================================================

function Projects({
  projects,
  onOpen,
  onCreate,
  canCreate
}){

  return <section className="page">

    <div className="pageHead">

      <div>

        <h1>
          Projects
        </h1>

        <p>
          Quản lý toàn bộ chiến dịch và không gian phối hợp công việc.
        </p>

      </div>


      {canCreate &&
        <button
          className="primary"
          onClick={onCreate}
        >
          ＋ New Project
        </button>
      }

    </div>


    <div className="projectGrid">

      {projects.map(
        p=>
          <article
            className="projectCard"

            key={p.id}

            onClick={()=>
              onOpen(p)
            }
          >

            <div className="projectIcon">

              {
                (p.code||'P')
                  .slice(0,2)
              }

            </div>


            <div className="projectMeta">

              <span
                className={
                  'pill '+p.status
                }
              >

                {
                  LABEL[p.status]
                  ||
                  p.status
                }

              </span>


              <span>
                {p.teams?.name||''}
              </span>

            </div>


            <h3>
              {p.name}
            </h3>


            <p>

              {
                p.description
                ||
                'Chưa có mô tả.'
              }

            </p>


            <div className="projectFoot">

              <span>

                Lead: {
                  p.profiles
                    ?.full_name
                  ||
                  '—'
                }

              </span>


              <span>

                {
                  fmtDate(
                    p.due_at
                  )
                }

              </span>

            </div>

          </article>
      )}


      {!projects.length &&
        <div className="empty">
          Chưa có Project nào.
        </div>
      }

    </div>

  </section>
}


// =====================================================
// PROJECT PAGE
// =====================================================

function ProjectPage({
  project,
  setProject,

  tab,
  setTab,

  stats,
  progress,

  tasks,

  search,
  setSearch,

  taskFilter,
  setTaskFilter,

  quickTitle,
  setQuickTitle,

  quickCreateTask,
  createTaskDetailed,
  canTask,

  members,
  workspaceMembers,
  assignableTaskMembers,

  onCancelProject,

  openTask,

  updateTask,
  updateTaskAssignees,
  completeByCheckbox,

  exportExcel,

  membership,

  currentProjectMember,
  currentUserIsProjectLead,

  onProjectMembersChanged
}){

  const [
    projectMemberOpen,
    setProjectMemberOpen
  ] = useState(false)


  const [projectMemberEdit,setProjectMemberEdit]=
    useState(null)

  const [projectEditOpen,setProjectEditOpen]=useState(false)
  const [taskCreateOpen,setTaskCreateOpen]=useState(false)
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false)


  const canManageProjectMembers=
    membership?.role==='manager'
    ||
    currentUserIsProjectLead
    ||
    !!currentProjectMember
      ?.can_manage_project_members


  const canCancelProject=
    membership?.role==='manager'
    ||
    currentUserIsProjectLead

  const canEditProject=canCancelProject


  const canSeeAllTaskFilter=
    membership?.role==='manager'
    ||
    membership?.role==='team_lead'
    ||
    currentUserIsProjectLead


  function openProjectEditorFromDescription(){
    if(canEditProject){
      setProjectEditOpen(true)
    }
  }


  return <section className="page projectPage">

    <div className="projectHeader">

      <div className="projectIcon large">

        {
          (project.code||'P')
            .slice(0,2)
        }

      </div>


      <div className="grow">

        <div className="eyebrow">

          {project.code}

          {' · '}

          {project.teams?.name||''}

        </div>


        <h1>
          {project.name}
        </h1>


        <div
          className="desc"
          onClick={openProjectEditorFromDescription}
        >

          {
            project.description
            ||
            '+ Thêm mô tả Project'
          }

        </div>

      </div>


      <div className="projectHeaderActions">

        <span
          className={
            'pill '+project.status
          }
        >

          {
            LABEL[project.status]
            ||
            project.status
          }

        </span>


        {canEditProject &&
          <button
            type="button"
            className="secondary desktopProjectAction"
            onClick={()=>setProjectEditOpen(true)}
          >
            ✎ Sửa Project
          </button>
        }

        {canCancelProject &&
          <button
            type="button"
            className="secondary desktopProjectAction"
            onClick={onCancelProject}
            title="Hủy Project tạo nhầm hoặc không còn sử dụng"
          >
            Hủy Project
          </button>
        }

        {(canEditProject||canCancelProject) && <div className="mobileProjectMenu">
          <button type="button" className="secondary" onClick={()=>setMobileMenuOpen(v=>!v)}>⋯</button>
          {mobileMenuOpen && <div className="mobileProjectMenuPopover">
            {canEditProject && <button type="button" onClick={()=>{setMobileMenuOpen(false);setProjectEditOpen(true)}}>✎ Sửa Project</button>}
            {canCancelProject && <button type="button" onClick={()=>{setMobileMenuOpen(false);onCancelProject()}}>Hủy Project</button>}
          </div>}
        </div>}

      </div>

    </div>


    <div className="tabs">

      {[
        'overview',
        'list',
        'kanban',
        'files',
        'activity',
        'report'
      ].map(
        x=>
          <button
            key={x}

            className={
              tab===x
                ? 'active'
                : ''
            }

            onClick={()=>
              setTab(x)
            }
          >

            {
              x[0].toUpperCase()
              +
              x.slice(1)
            }

          </button>
      )}

    </div>


    {tab==='overview' &&
      <>

        <div className="statGrid">

          <Stat
            label="Progress"
            value={`${progress}%`}
          />

          <Stat
            label="Total tasks"
            value={stats.total}
          />

          <Stat
            label="Review"
            value={stats.review}
          />

          <Stat
            label="Overdue"
            value={stats.overdue}
            danger
          />

        </div>


        <div className="panel" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:10}}>
            <h3 style={{margin:0}}>Mô tả Project</h3>
            {canEditProject && <button className="secondary" onClick={()=>setProjectEditOpen(true)}>✎ Chỉnh sửa</button>}
          </div>
          <div style={{whiteSpace:'pre-wrap',lineHeight:1.65,color:project.description?'#273142':'#8a94a6',minHeight:72}}>
            {project.description||'Chưa có mô tả. Hãy bổ sung mục tiêu, phạm vi, đầu ra và lưu ý quan trọng của Project.'}
          </div>
        </div>

        <div className="panel" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:12}}>
            <div>
              <h3 style={{margin:'0 0 4px'}}>Links làm việc</h3>
              <small style={{color:'#8a94a6'}}>Ưu tiên gắn Google Drive/Docs/Sheets, Figma, Canva hoặc URL tài liệu thay vì upload file lớn.</small>
            </div>
            {canEditProject && <button className="secondary" onClick={()=>setProjectEditOpen(true)}>Quản lý links</button>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
            {[
              {name:project.primary_link_name||'Link chính',url:project.primary_link_url,main:true},
              {name:project.link1_name||'Link phụ 1',url:project.link1_url},
              {name:project.link2_name||'Link phụ 2',url:project.link2_url},
              {name:project.link3_name||'Link phụ 3',url:project.link3_url}
            ].map((x,i)=>
              <div key={i} style={{border:'1px solid #e8ebef',borderRadius:12,padding:12,background:x.main?'#fff8f2':'#fff'}}>
                <div style={{fontSize:12,color:'#8a94a6',marginBottom:4}}>{x.main?'★ Link chính':'🔗 Link phụ'}</div>
                <div style={{fontWeight:700,marginBottom:8,wordBreak:'break-word'}}>{x.name}</div>
                {x.url
                  ? <a href={x.url} target="_blank" rel="noreferrer" className="secondary" style={{display:'inline-block',textDecoration:'none'}}>Mở link ↗</a>
                  : <span style={{fontSize:13,color:'#a2a9b3'}}>Chưa gắn link</span>
                }
              </div>
            )}
          </div>
        </div>

        <div className="overviewGrid">

          <div className="panel">

            <h3>
              Project overview
            </h3>

            <Info
              label="Team"
              value={
                project.teams?.name
                ||
                '—'
              }
            />

            <Info
              label="Bắt đầu"
              value={
                fmtDate(
                  project.start_at
                )
              }
            />

            <Info
              label="Deadline"
              value={
                fmtDate(
                  project.due_at
                )
              }
            />

            <Info
              label="Visibility"
              value={
                project.visibility
                ||
                'team'
              }
            />

            <Info
              label="Require review"
              value={
                project
                  .require_task_review===false
                  ? 'Off'
                  : 'On'
              }
            />

          </div>


          <div className="panel">

            <div
              style={{
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                gap:12,
                marginBottom:12
              }}
            >

              <h3
                style={{
                  margin:0
                }}
              >
                Members
              </h3>


              {canManageProjectMembers &&
                <button
                  className="primary"

                  onClick={()=>{
                    setProjectMemberEdit(null)
                    setProjectMemberOpen(true)
                  }}
                >
                  ＋ Add member
                </button>
              }

            </div>


            {members.map(
              m=>
                <div
                  className="memberLine"
                  key={m.user_id}
                >

                  <Avatar
                    p={m.profiles}
                  />

                  <span>

                    {
                      m.profiles
                        ?.full_name
                      ||
                      m.profiles
                        ?.email
                    }

                  </span>

                  <small>
                    {m.role_in_project}
                  </small>

                  {canManageProjectMembers &&
                    <button
                      type="button"
                      className="secondary"
                      style={{
                        marginLeft:'auto',
                        padding:'6px 10px'
                      }}
                      onClick={()=>{
                        setProjectMemberEdit(m)
                        setProjectMemberOpen(true)
                      }}
                    >
                      Sửa
                    </button>
                  }

                </div>
            )}


            {!members.length &&
              <div className="empty">
                Project chưa có member.
              </div>
            }


          </div>

        </div>

      </>
    }


    {tab==='list' &&
      <TaskList
        tasks={tasks}

        search={search}
        setSearch={setSearch}

        taskFilter={taskFilter}
        setTaskFilter={setTaskFilter}

        canSeeAllTaskFilter={
          canSeeAllTaskFilter
        }

        quickTitle={quickTitle}
        setQuickTitle={setQuickTitle}

        quickCreateTask={
          quickCreateTask
        }
        onCreateTask={()=>setTaskCreateOpen(true)}

        canTask={canTask}

        openTask={openTask}

        completeByCheckbox={
          completeByCheckbox
        }

        updateTask={updateTask}
        updateTaskAssignees={updateTaskAssignees}

        members={
          assignableTaskMembers||members
        }
      />
    }


    {tab==='kanban' &&
      <Kanban
        tasks={tasks}
        openTask={openTask}
        updateTask={updateTask}
      />
    }


    {tab==='files' &&
      <ProjectFiles
        project={project}
        canManage={canEditProject}
      />
    }


    {tab==='activity' &&
      <ProjectActivity
        project={project}
      />
    }


    {tab==='report' &&
      <div className="panel reportPanel">

        <h3>
          Project Report
        </h3>

        <p>
          Xuất task hiện tại của Project ra Excel.
        </p>

        <button
          className="primary"
          onClick={exportExcel}
        >
          Export Excel
        </button>

      </div>
    }

  

  {projectMemberOpen &&
    <ProjectMemberDrawer
      project={project}
      item={projectMemberEdit}
      projectMembers={members}
      workspaceMembers={workspaceMembers||[]}
      onClose={()=>{setProjectMemberOpen(false);setProjectMemberEdit(null)}}
      onSaved={async()=>{
        setProjectMemberOpen(false);setProjectMemberEdit(null)
        await onProjectMembersChanged?.()
      }}
    />
  }

  <div className="mobileProjectActions">
    {canTask && <button className="primary" onClick={()=>setTaskCreateOpen(true)}>＋ Task</button>}
    {canManageProjectMembers && <button className="secondary" onClick={()=>{setProjectMemberEdit(null);setProjectMemberOpen(true)}}>＋ Member</button>}
  </div>

  {taskCreateOpen && <TaskCreateDrawer
    project={project}
    members={assignableTaskMembers||members}
    onClose={()=>setTaskCreateOpen(false)}
    onCreate={async form=>{
      const result=await createTaskDetailed(form)
      if(result?.ok)setTaskCreateOpen(false)
      return result
    }}
  />}

  {projectEditOpen &&
    <ProjectEditDrawer
      project={project}
      workspaceMembers={workspaceMembers}
      membership={membership}
      onClose={()=>setProjectEditOpen(false)}
      onSaved={updated=>{
        setProject({...project,...updated})
        setProjectEditOpen(false)
      }}
    />
  }

  </section>
}


// =====================================================
// STAT
// =====================================================

function Stat({
  label,
  value,
  danger
}){

  return <div
    className={
      'stat '+
      (
        danger
          ? 'danger'
          : ''
      )
    }
  >

    <span>
      {label}
    </span>

    <b>
      {value}
    </b>

  </div>
}


// =====================================================
// INFO
// =====================================================

function Info({
  label,
  value
}){

  return <div className="infoRow">

    <span>
      {label}
    </span>

    <b>
      {value}
    </b>

  </div>
}


// =====================================================
// TASK LIST
// =====================================================

function TaskList({
  tasks,

  search,
  setSearch,

  taskFilter,
  setTaskFilter,

  canSeeAllTaskFilter,

  quickTitle,
  setQuickTitle,

  quickCreateTask,
  onCreateTask,

  canTask,

  openTask,

  completeByCheckbox,

  updateTask,
  updateTaskAssignees,

  members
}){

  return <div className="panel taskPanel">

    <div className="taskToolbar">

      <input
        placeholder="Search task..."

        value={search}

        onChange={e=>
          setSearch(
            e.target.value
          )
        }
      />


      <div className="chips">
        {canTask && <button className="createTaskButton" onClick={onCreateTask}>＋ Tạo Task</button>}

        <button
          className={
            taskFilter==='my'
              ? 'active'
              : ''
          }

          onClick={()=>
            setTaskFilter('my')
          }
        >
          My Tasks
        </button>


        <button
          className={
            taskFilter==='overdue'
              ? 'active'
              : ''
          }

          onClick={()=>
            setTaskFilter(
              'overdue'
            )
          }
        >
          Overdue
        </button>


        <button
          className={
            taskFilter==='review'
              ? 'active'
              : ''
          }

          onClick={()=>
            setTaskFilter(
              'review'
            )
          }
        >
          Review
        </button>


        {canSeeAllTaskFilter &&
          <button
            className={
              taskFilter==='all'
                ? 'active'
                : ''
            }

            onClick={()=>
              setTaskFilter(
                'all'
              )
            }
          >
            All
          </button>
        }

      </div>

    </div>


    <div className="taskHeader">

      <span></span>
      <span>Task</span>
      <span>Assignee</span>
      <span>Deadline</span>
      <span>Priority</span>
      <span>Status</span>

    </div>


    {tasks.map(
      t=>
        <div
          className="taskRow"
          key={t.id}
        >

          <button
            className={
              'check '+
              (
                t.status==='done'
                  ? 'done'
                  : ''
              )
            }

            onClick={()=>
              completeByCheckbox(
                t
              )
            }
          >

            {
              t.status==='done'
                ? '✓'
                : ''
            }

          </button>


          <button
            className="taskTitle"

            onClick={()=>
              openTask(t)
            }
          >

            <b>
              {t.title}
            </b>

            <small>
              {t.code}
            </small>
            <span className="mobileTaskMeta">
              <span>{LABEL[t.status]||t.status}</span>
              <span>{PRIORITY[t.priority]||t.priority}</span>
              <span>{(t.task_assignees||[]).map(a=>a.profiles?.full_name||a.profiles?.email).filter(Boolean).join(', ')||t.profiles?.full_name||'Chưa assign'}</span>
              {t.due_at&&<span>{fmtDate(t.due_at)}</span>}
            </span>

          </button>


          <MultiMemberPicker
            members={members}
            values={(t.task_assignees||[]).map(x=>x.user_id).length?(t.task_assignees||[]).map(x=>x.user_id):(t.assignee_id?[t.assignee_id]:[])}
            onChange={ids=>updateTaskAssignees?.(t.id,ids)}
            placeholder="Tìm người assign..."
          />


          <input
            type="date"

            value={
              t.due_at
                ? t.due_at.slice(
                    0,
                    10
                  )
                : ''
            }

            onChange={e=>
              updateTask(
                t.id,
                {
                  due_at:
                    e.target.value
                      ? new Date(
                          e.target.value+
                          'T17:00:00'
                        ).toISOString()
                      : null
                }
              )
            }
          />


          <select
            value={
              t.priority
            }

            onChange={e=>
              updateTask(
                t.id,
                {
                  priority:
                    e.target.value
                }
              )
            }
          >

            {Object.keys(
              PRIORITY
            ).map(
              x=>
                <option
                  key={x}
                  value={x}
                >
                  {PRIORITY[x]}
                </option>
            )}

          </select>


          <select
            value={
              t.status
            }

            onChange={e=>
              updateTask(
                t.id,
                {
                  status:
                    e.target.value
                }
              )
            }
          >

            {STATUS.map(
              x=>
                <option
                  key={x}
                  value={x}
                >
                  {LABEL[x]}
                </option>
            )}

          </select>

        </div>
    )}


    {!tasks.length &&
      <div className="empty">

        Không có task phù hợp với bộ lọc hiện tại.

      </div>
    }


    {canTask &&
      <div className="quickAdd">

        <span>
          ＋
        </span>

        <input
          placeholder="Thêm nhanh task..."

          value={quickTitle}

          onChange={e=>
            setQuickTitle(
              e.target.value
            )
          }

          onKeyDown={e=>
            e.key==='Enter'
            &&
            quickCreateTask()
          }
        />
        <button type="button" className="primary quickAddSave" disabled={!quickTitle.trim()} onClick={quickCreateTask}>Lưu</button>

      </div>
    }

  </div>
}


// =====================================================
// KANBAN
// =====================================================

function Kanban({
  tasks,
  openTask,
  updateTask
}){

  return <div className="kanban">

    {STATUS.map(
      status=>
        <div
          className="kanbanCol"

          key={status}

          onDragOver={e=>
            e.preventDefault()
          }

          onDrop={e=>{

            const id=
              e.dataTransfer
                .getData('task')

            if(id){

              updateTask(
                id,
                {
                  status
                }
              )
            }
          }}
        >

          <div className="kanbanHead">

            <b>
              {LABEL[status]}
            </b>

            <span>

              {
                tasks.filter(
                  t=>
                    t.status===status
                ).length
              }

            </span>

          </div>


          {tasks
            .filter(
              t=>
                t.status===status
            )
            .map(
              t=>
                <div
                  draggable

                  key={t.id}

                  className="kanbanCard"

                  onDragStart={e=>
                    e.dataTransfer
                      .setData(
                        'task',
                        t.id
                      )
                  }

                  onClick={()=>openTask(t)}
                  onDoubleClick={()=>openTask(t)}
                >

                  <small>
                    {t.code}
                  </small>

                  <b>
                    {t.title}
                  </b>


                  <div>

                    <span
                      className={
                        'priority '+
                        t.priority
                      }
                    >
                      {
                        PRIORITY[
                          t.priority
                        ]
                      }
                    </span>


                    <span>
                      {fmtDate(t.due_at)}
                    </span>

                  </div>

                  <select
                    className="kanbanMobileStatus"
                    value={t.status}
                    aria-label="Chuyển trạng thái task"
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>{
                      e.stopPropagation()
                      updateTask(t.id,{status:e.target.value})
                    }}
                  >
                    {STATUS.map(s=><option key={s} value={s}>{LABEL[s]}</option>)}
                  </select>

                </div>
            )
          }

        </div>
    )}

  </div>
}


// =====================================================
// TASK DRAWER
// =====================================================

function TaskDrawer({
  task,
  project,
  projectMembers,

  focusCommentId,
  onFocusDone,

  onClose,
  onUpdate,
  onUpdateAssignees,
  onCreateSubtask,
  onOpenTask,
  onOpenParent,
  canArchive=false,
  canDeleteTest=false,
  onArchive,
  onDeleteTest
}){

  const [comments,setComments]=useState([])
  const [activity,setActivity]=useState([])
  const [subtasks,setSubtasks]=useState([])
  const [subtaskCreateOpen,setSubtaskCreateOpen]=useState(false)

  const commentDraftKey=`fptu-work-comment-draft-${task.id}`
  const [comment,setComment]=useState(()=>{
    try{return typeof window!=='undefined'?(window.localStorage.getItem(commentDraftKey)||''):''}catch{return ''}
  })

  useEffect(()=>{
    try{
      if(comment) window.localStorage.setItem(commentDraftKey,comment)
      else window.localStorage.removeItem(commentDraftKey)
    }catch{}
  },[comment,commentDraftKey])

  const [mentionedUsers,setMentionedUsers]=useState([])

  const [mentionOpen,setMentionOpen]=useState(false)
  const [mentionQuery,setMentionQuery]=useState('')

  const [highlightComment,setHighlightComment]=useState(null)

  const textareaRef=useRef(null)
  const [taskMenuOpen,setTaskMenuOpen]=useState(false)


  useEffect(()=>{

    load()

    const channel=
      supabase
        .channel(
          'task-'+task.id
        )
        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'task_comments',
            filter:
              `task_id=eq.${task.id}`
          },
          ()=>{
            load()
          }
        )
        .subscribe()


    return ()=>{

      supabase.removeChannel(
        channel
      )
    }

  },[
    task.id
  ])


  useEffect(()=>{

    if(
      !focusCommentId
      ||
      !comments.length
    ){
      return
    }


    const timer=
      setTimeout(
        ()=>{

          const el=
            document.getElementById(
              `comment-${focusCommentId}`
            )


          if(el){

            el.scrollIntoView({
              behavior:'smooth',
              block:'center'
            })


            setHighlightComment(
              focusCommentId
            )


            setTimeout(
              ()=>{
                setHighlightComment(
                  null
                )
              },
              3500
            )
          }


          onFocusDone?.()

        },
        350
      )


    return ()=>{

      clearTimeout(timer)
    }

  },[
    focusCommentId,
    comments.length
  ])


  async function load(){

    const [
      commentRes,
      activityRes,
      subtaskRes
    ] = await Promise.all([

      supabase
        .from('task_comments')
        .select('*, profiles(*)')
        .eq('task_id',task.id)
        .is('deleted_at',null)
        .order('created_at'),

      supabase
        .from('task_activity_logs')
        .select('*, profiles(*)')
        .eq('task_id',task.id)
        .order('created_at',{ascending:false})
        .limit(50),

      supabase
        .from('tasks')
        .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))')
        .eq('parent_task_id',task.id)
        .is('archived_at',null)
        .order('created_at',{ascending:true})
    ])

    setComments(commentRes.data||[])
    setActivity(activityRes.data||[])
    setSubtasks(subtaskRes.data||[])
  }


  // ===================================================
  // MENTION INPUT
  // ===================================================

  function handleCommentChange(e){

    const value=
      e.target.value


    setComment(value)


    const cursor=
      e.target.selectionStart


    const before=
      value.slice(
        0,
        cursor
      )


    const match=
      before.match(
        /@([^@\n]*)$/
      )


    if(match){

      setMentionQuery(
        match[1].trim()
      )

      setMentionOpen(true)

    }else{

      setMentionQuery('')
      setMentionOpen(false)
    }
  }


  const mentionCandidates=
    projectMembers
      .filter(
        m=>{

          const text=
            `${m.profiles?.full_name||''} ${m.profiles?.email||''} ${m.teams?.name||''} ${m.role||''} ${m.role_in_project||''}`
              .toLowerCase()


          return text.includes(
            mentionQuery
              .toLowerCase()
          )
        }
      )
      .slice(0,8)


  function chooseMention(member){

    const textarea=
      textareaRef.current


    const cursor=
      textarea
        ?.selectionStart
      ??
      comment.length


    const before=
      comment.slice(
        0,
        cursor
      )


    const after=
      comment.slice(
        cursor
      )


    const at=
      before.lastIndexOf('@')


    if(at<0){

      return
    }


    const name=
      member.profiles
        ?.full_name
      ||
      member.profiles
        ?.email
      ||
      'Member'


    const next=
      before.slice(
        0,
        at
      )
      +
      '@'+name+' '
      +
      after


    setComment(next)


    setMentionedUsers(
      prev=>
        prev.some(
          x=>
            x.user_id===
            member.user_id
        )
          ? prev
          : [
              ...prev,
              member
            ]
    )


    setMentionOpen(false)
    setMentionQuery('')


    setTimeout(
      ()=>{

        textarea?.focus()

      },
      50
    )
  }


  // ===================================================
  // ADD COMMENT WITH MENTION
  // ===================================================

  async function addComment(){

    const content=
      comment.trim()


    if(!content){

      return
    }


    const ids=
      mentionedUsers
        .map(
          x=>x.user_id
        )


    const {
      error
    } = await supabase.rpc(
      'add_task_comment_with_mentions',
      {
        p_task_id:
          task.id,

        p_content:
          content,

        p_mentioned_user_ids:
          ids
      }
    )


    if(error){

      alert(
        'Không gửi được bình luận: '+
        error.message
      )

      return
    }


    setComment('')
    try{window.localStorage.removeItem(commentDraftKey)}catch{}
    setMentionedUsers([])
    setMentionOpen(false)
    setMentionQuery('')


    await load()
  }


  return <div
    className="drawerWrap"

    onMouseDown={e=>
      e.target===
        e.currentTarget
      &&
      onClose()
    }
  >

    <aside className="drawer">

      <div className="drawerHead">

        <div>

          <small>
            {task.code}
          </small>


          <input
            className="drawerTitle"

            value={task.title}

            onChange={e=>
              onUpdate(
                task.id,
                {
                  title:
                    e.target.value
                }
              )
            }
          />

        </div>


        <div className="taskActionMenu">

          {(canArchive||canDeleteTest) && <button
            aria-label="Thao tác Task"
            title="Thao tác Task"
            onClick={()=>setTaskMenuOpen(v=>!v)}
          >
            ⋯
          </button>}

          <button
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>

          {taskMenuOpen && <div className="taskMenuPopover">
            {canArchive && <button onClick={()=>{setTaskMenuOpen(false);onArchive?.(task)}}>
              📦 Archive Task
            </button>}
            {canDeleteTest && <button className="danger" onClick={()=>{setTaskMenuOpen(false);onDeleteTest?.(task)}}>
              🗑 Delete Test Task
            </button>}
            <div className="taskArchiveHint">
              Archive giữ lịch sử. Delete Test Task chỉ dành cho Manager và dữ liệu test đủ điều kiện.
            </div>
          </div>}

        </div>

      </div>


      <div className="drawerBody">

        {task.parent_task_id && <button type="button" className="secondary compactBtn" style={{marginBottom:12}} onClick={()=>onOpenParent?.(task.parent_task_id)}>← Task cha</button>}

        <div className="fieldGrid">

          <Field label="Status">

            <select
              value={task.status}

              onChange={e=>
                onUpdate(
                  task.id,
                  {
                    status:
                      e.target.value
                  }
                )
              }
            >

              {STATUS.map(
                x=>
                  <option
                    key={x}
                    value={x}
                  >
                    {LABEL[x]}
                  </option>
              )}

            </select>

          </Field>


          <Field label="Assignees">
            <MultiMemberPicker
              members={projectMembers}
              values={(task.task_assignees||[]).map(x=>x.user_id).length
                ? (task.task_assignees||[]).map(x=>x.user_id)
                : (task.assignee_id?[task.assignee_id]:[])}
              onChange={ids=>onUpdateAssignees?.(task.id,ids)}
              placeholder="Gõ tên hoặc email để assign nhiều người..."
            />
          </Field>


          <Field label="Deadline">

            <input
              type="date"

              value={
                task.due_at
                  ? task.due_at.slice(
                      0,
                      10
                    )
                  : ''
              }

              onChange={e=>
                onUpdate(
                  task.id,
                  {
                    due_at:
                      e.target.value
                        ? new Date(
                            e.target.value+
                            'T17:00:00'
                          ).toISOString()
                        : null
                  }
                )
              }
            />

          </Field>


          <Field label="Progress">

            <input
              type="number"
              min="0"
              max="100"

              value={
                task.progress||0
              }

              onChange={e=>
                onUpdate(
                  task.id,
                  {
                    progress:
                      +e.target.value
                  }
                )
              }
            />

          </Field>

        </div>


        <section>

          <h3>
            Mô tả
          </h3>

          <textarea
            rows="7"

            placeholder="+ Thêm mô tả task..."

            value={
              task.description||''
            }

            onChange={e=>
              onUpdate(
                task.id,
                {
                  description:
                    e.target.value
                }
              )
            }
          />

        </section>


        <section>

          <h3>
            Delivery link
          </h3>

          <div className="deliveryLinkRow">
          <input
            className="fullInput"
            type="url"
            inputMode="url"
            placeholder="https://..."

            value={
              task.delivery_url||''
            }

            onChange={e=>
              onUpdate(
                task.id,
                {
                  delivery_url:
                    e.target.value
                }
              )
            }
          />
          {/^(https?:\/\/)/i.test(task.delivery_url||'')&&<button type="button" className="secondary deliveryOpenBtn" onClick={()=>window.open(task.delivery_url,'_blank','noopener,noreferrer')}>Mở ↗</button>}
          </div>

        </section>


        <section className="subtaskSection">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:10}}>
            <div>
              <h3 style={{margin:0}}>Sub-task</h3>
              <small style={{color:'#64748b'}}>Công việc con có status, deadline, priority, delivery link và nhiều người phụ trách như Task.</small>
            </div>
            <button type="button" className="secondary compactBtn" onClick={()=>setSubtaskCreateOpen(true)}>＋ Sub-task</button>
          </div>
          <div className="subtaskList">
            {subtasks.length?subtasks.map(st=><button type="button" key={st.id} className="subtaskRow" onClick={()=>onOpenTask?.(st)}>
              <span className={'statusBadge '+st.status}>{LABEL[st.status]||st.status}</span>
              <span style={{minWidth:0,flex:1,textAlign:'left'}}>
                <b style={{display:'block',whiteSpace:'normal'}}>{st.title}</b>
                <small>{(st.task_assignees||[]).map(a=>a.profiles?.full_name||a.profiles?.email).filter(Boolean).join(', ')||'Chưa assign'} · {PRIORITY[st.priority]||st.priority} · {fmtDate(st.due_at)}</small>
              </span>
            </button>):<div className="empty" style={{padding:'12px 0'}}>Chưa có Sub-task.</div>}
          </div>
        </section>

        <section>

          <h3>
            Comments
          </h3>


          <div className="comments">

            {comments.map(
              c=>
                <div
                  id={
                    `comment-${c.id}`
                  }

                  className="comment"

                  key={c.id}

                  style={
                    highlightComment===c.id
                      ? {
                          background:'#fff3e8',
                          border:'1px solid #f28c38',
                          borderRadius:10,
                          padding:10,
                          transition:'all .25s ease'
                        }
                      : {
                          transition:'all .25s ease'
                        }
                  }
                >

                  <Avatar
                    p={c.profiles}
                  />


                  <div>

                    <div className="commentMeta">

                      <b>

                        {
                          c.profiles
                            ?.full_name
                          ||
                          c.profiles
                            ?.email
                        }

                      </b>


                      <span>

                        {
                          fmtDateTime(
                            c.created_at
                          )
                        }

                      </span>

                    </div>


                    <p
                      style={{
                        whiteSpace:'pre-wrap'
                      }}
                    >
                      {c.content}
                    </p>

                  </div>

                </div>
            )}

          </div>


          <div
            style={{
              position:'relative'
            }}
          >

            {mentionOpen &&
              <div
                style={{
                  position:'absolute',
                  left:0,
                  right:70,
                  bottom:'calc(100% + 8px)',
                  background:'#fff',
                  border:'1px solid #e5e7eb',
                  borderRadius:12,
                  boxShadow:'0 10px 30px rgba(0,0,0,.12)',
                  zIndex:100,
                  maxHeight:280,
                  overflowY:'auto'
                }}
              >

                {mentionCandidates.length
                  ? mentionCandidates.map(
                      m=>
                        <button
                          key={m.user_id}

                          type="button"

                          onMouseDown={e=>{
                            e.preventDefault()

                            chooseMention(m)
                          }}

                          style={{
                            display:'flex',
                            width:'100%',
                            border:0,
                            background:'transparent',
                            padding:'10px 12px',
                            gap:10,
                            alignItems:'center',
                            textAlign:'left',
                            cursor:'pointer'
                          }}
                        >

                          <Avatar
                            p={m.profiles}
                          />

                          <span
                            style={{
                              display:'flex',
                              flexDirection:'column'
                            }}
                          >

                            <b>

                              {
                                m.profiles
                                  ?.full_name
                                ||
                                m.profiles
                                  ?.email
                              }

                            </b>

                            <small>

                              {
                                m.role_in_project==='lead'
                                  ? 'Project Lead'
                                  : 'Project Member'
                              }

                            </small>

                          </span>

                        </button>
                    )

                  : <div
                      style={{
                        padding:12,
                        color:'#777'
                      }}
                    >
                      Không tìm thấy member.
                    </div>
                }

              </div>
            }


            <div className="commentBox">

              <textarea
                ref={textareaRef}

                placeholder="Viết bình luận... Gõ @ để tag member"

                value={comment}

                onChange={
                  handleCommentChange
                }

                onKeyDown={e=>{

                  if(
                    (
                      e.ctrlKey
                      ||
                      e.metaKey
                    )
                    &&
                    e.key==='Enter'
                  ){

                    addComment()
                  }
                }}
              />


              <button
                className="primary"

                onClick={
                  addComment
                }
              >
                Gửi
              </button>

            </div>

          </div>


          {!!mentionedUsers.length &&
            <div
              style={{
                marginTop:8,
                display:'flex',
                flexWrap:'wrap',
                gap:6
              }}
            >

              {mentionedUsers.map(
                m=>
                  <span
                    key={m.user_id}

                    style={{
                      background:'#fff3e8',
                      padding:'4px 8px',
                      borderRadius:999,
                      fontSize:12
                    }}
                  >

                    @
                    {
                      m.profiles
                        ?.full_name
                      ||
                      m.profiles
                        ?.email
                    }

                  </span>
              )}

            </div>
          }

        </section>


        <section>

          <h3>
            Activity
          </h3>


          {activity.map(
            a=>
              <div
                className="activityLine"
                key={a.id}
              >

                <span>
                  •
                </span>


                <div>

                  <b>

                    {
                      a.profiles
                        ?.full_name
                      ||
                      'System'
                    }

                  </b>

                  {' '}

                  {
                    a.action
                      ?.replaceAll(
                        '_',
                        ' '
                      )
                  }


                  <small>

                    {
                      fmtDateTime(
                        a.created_at
                      )
                    }

                  </small>

                </div>

              </div>
          )}

        </section>

      </div>

    </aside>

    {subtaskCreateOpen && <TaskCreateDrawer
      project={project}
      members={projectMembers}
      draftScope={`subtask-${task.id}`}
      titleLabel="Tạo Sub-task mới"
      onClose={()=>setSubtaskCreateOpen(false)}
      onCreate={async form=>{
        const result=await onCreateSubtask?.(task,form)
        if(result?.ok){setSubtaskCreateOpen(false);await load()}
        return result
      }}
    />}

  </div>
}


// =====================================================
// SMART MEMBER PICKER v18.7 (includes v18.6)
// =====================================================

function SmartMemberPicker({
  members=[],
  value='',
  onChange,
  placeholder='Gõ tên, email, team hoặc role...',
  disabled=false,
  compact=false,
  emptyLabel='— Chưa gán —',
  currentTeamId=null
}){
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [activeIndex,setActiveIndex]=useState(0)
  const wrapRef=useRef(null)

  const selected=members.find(m=>m.user_id===value)
  const roleLabel=(role)=>role==='manager'?workspaceRoleLabel('manager'):role==='team_lead'?workspaceRoleLabel('team_lead'):role==='lead'?(getUILang()==='en'?'Project Lead':'Trưởng dự án'):role==='viewer'?(getUILang()==='en'?'Viewer':'Chỉ xem'):(getUILang()==='en'?'Member':'Thành viên')
  const memberText=(m)=>[
    m.profiles?.full_name,
    m.profiles?.email,
    m.teams?.name,
    m.team?.name,
    m.role,
    m.role_in_project,
    roleLabel(m.role||m.role_in_project)
  ].filter(Boolean).join(' ').toLowerCase()

  const q=query.trim().toLowerCase()
  const filtered=[...members]
    .filter(m=>!q || memberText(m).includes(q))
    .sort((a,b)=>{
      const aSame=Number(!!currentTeamId && (a.team_id===currentTeamId || a.teams?.id===currentTeamId))
      const bSame=Number(!!currentTeamId && (b.team_id===currentTeamId || b.teams?.id===currentTeamId))
      if(aSame!==bSame) return bSame-aSame
      return String(a.profiles?.full_name||a.profiles?.email||'').localeCompare(String(b.profiles?.full_name||b.profiles?.email||''),'vi')
    })
    .slice(0,10)

  useEffect(()=>{
    function close(e){
      if(wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown',close)
    return ()=>document.removeEventListener('mousedown',close)
  },[])

  function choose(id){
    onChange?.(id||'')
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function keyDown(e){
    if(!open && ['ArrowDown','Enter'].includes(e.key)){
      setOpen(true); return
    }
    if(e.key==='ArrowDown'){
      e.preventDefault(); setActiveIndex(i=>Math.min(i+1,Math.max(0,filtered.length-1)))
    }else if(e.key==='ArrowUp'){
      e.preventDefault(); setActiveIndex(i=>Math.max(0,i-1))
    }else if(e.key==='Enter' && open){
      e.preventDefault(); if(filtered[activeIndex]) choose(filtered[activeIndex].user_id)
    }else if(e.key==='Escape') setOpen(false)
  }

  const selectedName=selected?.profiles?.full_name||selected?.profiles?.email||''

  return <div ref={wrapRef} style={{position:'relative',width:'100%'}}>
    <button
      type="button"
      disabled={disabled}
      onClick={()=>{setOpen(v=>!v);setQuery('');setActiveIndex(0)}}
      style={{
        width:'100%', minHeight:compact?34:42, padding:compact?'6px 9px':'9px 11px',
        border:'1px solid #dfe3e8',borderRadius:9,background:disabled?'#f5f6f7':'#fff',
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,textAlign:'left',cursor:disabled?'not-allowed':'pointer'
      }}
    >
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedName||emptyLabel}</span>
      <span style={{color:'#89919b'}}>⌄</span>
    </button>

    {open && !disabled && <div style={{
      position:'absolute',zIndex:1200,top:'calc(100% + 5px)',left:0,right:0,
      background:'#fff',border:'1px solid #dfe3e8',borderRadius:11,boxShadow:'0 12px 32px rgba(15,23,42,.16)',overflow:'hidden'
    }}>
      <div style={{padding:8,borderBottom:'1px solid #eef0f2'}}>
        <input
          autoFocus value={query} onChange={e=>{setQuery(e.target.value);setActiveIndex(0)}} onKeyDown={keyDown}
          placeholder={placeholder}
          style={{width:'100%',border:'1px solid #e2e5e9',borderRadius:8,padding:'9px 10px',outline:'none'}}
        />
      </div>
      <div style={{maxHeight:320,overflowY:'auto',padding:5}}>
        {emptyLabel && <button type="button" onClick={()=>choose('')} style={{width:'100%',border:0,background:'transparent',textAlign:'left',padding:'9px 10px',borderRadius:8,cursor:'pointer',color:'#6b7280'}}>{emptyLabel}</button>}
        {filtered.length ? filtered.map((m,i)=>{
          const name=m.profiles?.full_name||m.profiles?.email||'Member'
          const secondary=[roleLabel(m.role||m.role_in_project),m.teams?.name||m.team?.name,m.profiles?.email!==name?m.profiles?.email:null].filter(Boolean).join(' · ')
          return <button
            type="button" key={m.user_id} onMouseEnter={()=>setActiveIndex(i)} onClick={()=>choose(m.user_id)}
            style={{width:'100%',border:0,background:i===activeIndex?'#fff3e8':'#fff',textAlign:'left',padding:'9px 10px',borderRadius:8,cursor:'pointer',display:'flex',gap:9,alignItems:'center'}}
          >
            <Avatar p={m.profiles}/>
            <span style={{minWidth:0}}><b style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</b><small style={{display:'block',color:'#7b8491',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{secondary}</small></span>
          </button>
        }):<div style={{padding:14,color:'#7b8491',textAlign:'center'}}>Không tìm thấy thành viên phù hợp.</div>}
      </div>
    </div>}
  </div>
}


// =====================================================
// MULTI MEMBER PICKER v18.13
// =====================================================

function MultiMemberPicker({members=[],values=[],onChange,placeholder='Gõ tên hoặc email...',disabled=false}){
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const wrapRef=useRef(null)
  const selectedIds=[...new Set((values||[]).filter(Boolean))]
  const memberMap=new Map(members.map(m=>[m.user_id,m]))

  useEffect(()=>{
    function close(e){if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',close)
    return()=>document.removeEventListener('mousedown',close)
  },[])

  const q=query.trim().toLowerCase()
  const filtered=members.filter(m=>{
    const text=[m.profiles?.full_name,m.profiles?.email,m.teams?.name,m.team?.name,m.role,m.role_in_project].filter(Boolean).join(' ').toLowerCase()
    return !q||text.includes(q)
  }).slice(0,20)

  function toggle(id){
    const next=selectedIds.includes(id)?selectedIds.filter(x=>x!==id):[...selectedIds,id]
    onChange?.(next)
  }

  return <div ref={wrapRef} style={{position:'relative',width:'100%'}}>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',padding:'7px 9px',border:'1px solid #dfe3e8',borderRadius:10,background:disabled?'#f5f6f7':'#fff',minHeight:44,cursor:disabled?'not-allowed':'text'}} onClick={()=>!disabled&&setOpen(true)}>
      {selectedIds.map(id=>{
        const m=memberMap.get(id)
        const name=m?.profiles?.full_name||m?.profiles?.email||'Member'
        return <span key={id} style={{display:'inline-flex',alignItems:'center',gap:5,borderRadius:999,background:'#eef5ff',color:'#1d4ed8',padding:'5px 8px',fontSize:13,fontWeight:700}}>
          {name}
          {!disabled&&<button type="button" onClick={e=>{e.stopPropagation();toggle(id)}} style={{border:0,background:'transparent',padding:0,cursor:'pointer',color:'#1d4ed8'}}>×</button>}
        </span>
      })}
      {!selectedIds.length&&<span style={{color:'#94a3b8',padding:'4px 2px'}}>— Chưa assign —</span>}
      {!disabled&&<input value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true)}} placeholder={placeholder} style={{border:0,outline:'none',minWidth:170,flex:1,padding:'4px 2px',background:'transparent'}}/>}
    </div>
    {open&&!disabled&&<div style={{position:'absolute',zIndex:1500,top:'calc(100% + 5px)',left:0,right:0,background:'#fff',border:'1px solid #dfe3e8',borderRadius:12,boxShadow:'0 12px 32px rgba(15,23,42,.16)',maxHeight:330,overflowY:'auto',padding:6}}>
      {filtered.length?filtered.map(m=>{
        const checked=selectedIds.includes(m.user_id)
        const name=m.profiles?.full_name||m.profiles?.email||'Member'
        return <button type="button" key={m.user_id} onClick={()=>toggle(m.user_id)} style={{width:'100%',border:0,background:checked?'#fff3e8':'#fff',textAlign:'left',padding:'9px 10px',borderRadius:9,cursor:'pointer',display:'flex',gap:9,alignItems:'center'}}>
          <input type="checkbox" readOnly checked={checked}/>
          <Avatar p={m.profiles}/>
          <span style={{minWidth:0}}><b style={{display:'block'}}>{name}</b><small style={{color:'#64748b'}}>{[m.teams?.name||m.team?.name,m.role||m.role_in_project,m.profiles?.email!==name?m.profiles?.email:null].filter(Boolean).join(' · ')}</small></span>
        </button>
      }):<div style={{padding:14,color:'#7b8491',textAlign:'center'}}>Không tìm thấy thành viên phù hợp.</div>}
    </div>}
  </div>
}

// =====================================================
// FIELD
// =====================================================

function Field({
  label,
  children
}){

  return <label className="field">

    <span>
      {label}
    </span>

    {children}

  </label>
}


function projectMapSafe(projects,id,fallback){
  if(fallback?.id) return (projects||[]).find(p=>p.id===fallback.id)||fallback
  return (projects||[]).find(p=>p.id===id)||fallback||null
}

// =====================================================
// HOME
// =====================================================

function HomeDashboard({
  projects,
  members,
  teams,
  profile,
  membership,
  onNavigate
}){
  const [taskRows,setTaskRows]=useState([])

  useEffect(()=>{
    let alive=true
    supabase
      .from('tasks')
      .select('id,status,due_at,priority,project_id,assignee_id,created_at,completed_at')
      .is('archived_at',null)
      .then(({data})=>{if(alive)setTaskRows(data||[])})
    return()=>{alive=false}
  },[projects?.length,membership?.user_id])

  const now=new Date()
  const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()
  const isDone=t=>t.status==='done'
  const overdue=taskRows.filter(t=>t.due_at&&!isDone(t)&&new Date(t.due_at).getTime()<todayStart)
  const review=taskRows.filter(t=>t.status==='review')
  const activeTasks=taskRows.filter(t=>['todo','in_progress'].includes(t.status))
  const high=taskRows.filter(t=>['urgent','high'].includes(t.priority)&&!isDone(t))
  const atRisk=(projects||[]).filter(p=>p.health==='at_risk')

  const [birthdayProfiles,setBirthdayProfiles]=useState([])
  useEffect(()=>{
    let cancelled=false
    async function loadBirthdays(){
      const ids=(members||[]).map(m=>m.user_id).filter(Boolean)
      if(!ids.length){setBirthdayProfiles([]);return}
      const {data,error}=await supabase.from('profiles').select('id,full_name,email,avatar_url,birth_date').in('id',ids)
      if(!cancelled&&!error)setBirthdayProfiles(data||[])
    }
    loadBirthdays()
    return ()=>{cancelled=true}
  },[JSON.stringify((members||[]).map(m=>m.user_id))])

  const birthdayRows=(birthdayProfiles||[])
    .map(p=>({
      member:(members||[]).find(m=>m.user_id===p.id),
      name:p.full_name||p.email||'Thành viên',
      avatar:p,
      birth:p.birth_date
    }))
    .filter(x=>x.birth)
    .map(x=>{
      const d=new Date(x.birth+'T00:00:00')
      let next=new Date(now.getFullYear(),d.getMonth(),d.getDate())
      const today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
      if(next<today) next=new Date(now.getFullYear()+1,d.getMonth(),d.getDate())
      return {...x,next,days:Math.round((next-today)/(24*60*60*1000))}
    })
    .sort((a,b)=>a.days-b.days)

  const todayBirthdays=birthdayRows.filter(x=>x.days===0)
  const upcoming=birthdayRows.filter(x=>x.days>0&&x.days<=7).slice(0,6)
  const birthdayLead=todayBirthdays[0]

  const hour=now.getHours()
  const greeting=hour<11?'Chào buổi sáng':hour<18?'Chào buổi chiều':'Chào buổi tối'
  const displayName=(profile?.full_name||profile?.email||'').split(' ')[0]||'bạn'

  const kpis=[
    {label:'Project',value:(projects||[]).length,icon:'▦',accent:'#1367d1',bg:'#eff6ff',go:'projects'},
    {label:'Task cần làm',value:activeTasks.length,icon:'✓',accent:'#0b70d8',bg:'#eaf5ff',go:'mytasks'},
    {label:'Trễ hạn',value:overdue.length,icon:'!',accent:'#ef6c00',bg:'#fff4e8',go:'reports'},
    {label:'Chờ Review',value:review.length,icon:'◷',accent:'#7c3aed',bg:'#f5f3ff',go:'reports'},
    {label:'Priority cao',value:high.length,icon:'↑',accent:'#f97316',bg:'#fff7ed',go:'mytasks'},
    {label:'At risk',value:atRisk.length,icon:'⚠',accent:'#dc2626',bg:'#fff1f2',go:'reports'}
  ]

  return <section className="page" style={{background:'linear-gradient(180deg,#f7fbff 0%,#ffffff 52%,#fffaf5 100%)',minHeight:'calc(100vh - 64px)'}}>
    <div className="homeHero" style={{background:'linear-gradient(120deg,#0f5fb8 0%,#1976d2 55%,#ff8a24 150%)',color:'#fff',padding:'26px 28px',borderRadius:26,boxShadow:'0 20px 50px rgba(17,92,164,.18)',marginBottom:18,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',right:-35,top:-45,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,.10)'}}/>
      <div style={{position:'absolute',right:95,bottom:-70,width:150,height:150,borderRadius:'50%',background:'rgba(255,145,43,.28)'}}/>
      <div style={{position:'relative',zIndex:2}}>
        <div style={{fontWeight:700,opacity:.9}}>{greeting},</div>
        <h1 style={{margin:'4px 0 7px',fontSize:36,lineHeight:1.1,color:'#fff'}}>{displayName} 👋</h1>
        <p style={{margin:0,opacity:.92,maxWidth:720}}>Đây là tình hình công việc của team hôm nay. Ưu tiên xử lý task trễ hạn, việc quan trọng và các đầu việc đang chờ Review.</p>
      </div>
    </div>

    {birthdayLead && <div className="birthdayHero" style={{position:'relative',overflow:'hidden',background:'linear-gradient(120deg,#fff 0%,#fff7ed 52%,#eaf5ff 100%)',border:'1px solid #ffd6ad',borderRadius:24,padding:'24px 26px',marginBottom:18,boxShadow:'0 15px 40px rgba(245,124,0,.12)'}}>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',opacity:.65,backgroundImage:'radial-gradient(circle at 10% 20%,#ff9a3d 0 3px,transparent 4px),radial-gradient(circle at 90% 25%,#2d83da 0 3px,transparent 4px),radial-gradient(circle at 75% 75%,#ffb45e 0 4px,transparent 5px),radial-gradient(circle at 20% 80%,#60a5fa 0 3px,transparent 4px)'}}/>
      <div style={{position:'relative',display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:72,height:72,borderRadius:22,background:'#fff',display:'grid',placeItems:'center',boxShadow:'0 8px 24px rgba(15,95,184,.12)',flex:'0 0 auto'}}><Avatar p={birthdayLead.avatar}/></div>
        <div><div style={{fontWeight:900,color:'#f97316',letterSpacing:.5}}>🎉 HAPPY BIRTHDAY</div><h2 style={{margin:'4px 0',color:'#0f5fb8'}}>Chúc mừng sinh nhật {birthdayLead.name} 🎂</h2><p style={{margin:0,color:'#475569'}}>Chúc một tuổi mới nhiều năng lượng, nhiều niềm vui và thật nhiều project thành công!</p></div>
      </div>
    </div>}

    {!birthdayLead && upcoming[0] && upcoming[0].days<=3 && <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:16,padding:'13px 16px',marginBottom:16,color:'#9a4b00',fontWeight:700}}>🎂 {upcoming[0].days} ngày nữa là sinh nhật <b>{upcoming[0].name}</b>.</div>}

    <div className="homeKpiGrid" style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(120px,1fr))',gap:12,marginBottom:18}}>
      {kpis.map(k=><button key={k.label} onClick={()=>onNavigate?.(k.go)} style={{textAlign:'left',border:'1px solid #e2e8f0',background:'#fff',borderRadius:18,padding:'15px 16px',cursor:'pointer',boxShadow:'0 8px 24px rgba(15,57,104,.05)'}}><div style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:k.bg,color:k.accent,fontSize:20,fontWeight:900,marginBottom:10}}>{k.icon}</div><b style={{display:'block',fontSize:25,color:'#0f2847'}}>{k.value}</b><small style={{color:'#64748b',fontWeight:700}}>{k.label}</small></button>)}
    </div>

    <div className="homeTwoCol" style={{display:'grid',gridTemplateColumns:'1.25fr .75fr',gap:14}}>
      <div className="panel" style={{padding:18,border:'1px solid #dce7f4',boxShadow:'0 10px 30px rgba(15,57,104,.05)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8}}><div><h3 style={{margin:0,color:'#123a63'}}>Cần chú ý</h3><small>Những tín hiệu nên xử lý trước.</small></div><button className="secondary" onClick={()=>onNavigate?.('reports')}>Xem Reports</button></div>
        {[
          {t:`${overdue.length} task đang trễ hạn`,c:'#dc2626',show:overdue.length>0},
          {t:`${review.length} task đang chờ Review`,c:'#7c3aed',show:review.length>0},
          {t:`${atRisk.length} Project đang At risk`,c:'#f97316',show:atRisk.length>0},
          {t:`${high.length} task High/Urgent chưa hoàn thành`,c:'#0f5fb8',show:high.length>0}
        ].filter(x=>x.show).map(x=><div key={x.t} style={{display:'flex',gap:10,alignItems:'center',padding:'11px 0',borderBottom:'1px solid #edf2f7'}}><span style={{width:10,height:10,borderRadius:'50%',background:x.c}}/><b style={{color:'#334155'}}>{x.t}</b></div>)}
        {!overdue.length&&!review.length&&!atRisk.length&&!high.length&&<div className="empty">Không có cảnh báo nổi bật. Team đang vận hành khá ổn.</div>}
      </div>

      <div className="panel" style={{padding:18,border:'1px solid #ffe0bf',boxShadow:'0 10px 30px rgba(245,124,0,.05)'}}>
        <h3 style={{margin:'0 0 10px',color:'#c75d00'}}>🎂 Sinh nhật sắp tới</h3>
        {upcoming.length?upcoming.map(x=><div key={x.member.user_id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #fff0e1'}}><Avatar p={x.avatar}/><div style={{minWidth:0,flex:1}}><b style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.name}</b><small>{x.days===1?'Ngày mai':`${x.days} ngày nữa`} · {String(x.next.getDate()).padStart(2,'0')}/{String(x.next.getMonth()+1).padStart(2,'0')}</small></div></div>):<div className="empty">7 ngày tới chưa có sinh nhật thành viên. Nếu vừa cập nhật ngày sinh, hãy tải lại trang sau khi lưu hồ sơ.</div>}
      </div>
    </div>

    <div style={{marginTop:14,display:'flex',gap:10,flexWrap:'wrap'}}>
      <button className="primary" onClick={()=>onNavigate?.('mytasks')}>✓ Mở My Tasks</button>
      <button className="secondary" onClick={()=>onNavigate?.('projects')}>▦ Xem Projects</button>
      <button className="secondary" onClick={()=>onNavigate?.('reports')}>▥ Management Reports</button>
    </div>
  </section>
}


// =====================================================
// MY TASKS
// =====================================================

function MyTasks({
  membership,
  projects=[],
  members=[],
  onOpenTask,
  onOpenProject
}){

  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('all')
  const [searchText,setSearchText]=useState('')
  const [projectFilter,setProjectFilter]=useState('all')
  const [priorityFilter,setPriorityFilter]=useState('all')
  const [myTab,setMyTab]=useState('tasks')
  const [managedPermissionProjectIds,setManagedPermissionProjectIds]=useState([])
  const [managedTaskRows,setManagedTaskRows]=useState([])
  const [managedLoading,setManagedLoading]=useState(false)
  const [projectQuick,setProjectQuick]=useState('all')
  const [expandedProject,setExpandedProject]=useState(null)
  const [assignedByMeRows,setAssignedByMeRows]=useState([])
  const [assignedByMeLoading,setAssignedByMeLoading]=useState(false)
  const [assignedByMeFilter,setAssignedByMeFilter]=useState('all')
  const [assignedByMeSearch,setAssignedByMeSearch]=useState('')
  const [remindingTaskId,setRemindingTaskId]=useState(null)
  const isManager=String(membership?.role||'').toLowerCase()==='manager'

  async function deletePersonalOrOrphanTask(task){
    if(!task?.id || !isManager) return

    const ok=window.confirm(
      `XÓA HẲN task "${task.title}"?\n\nDùng cho task test / task bị mồ côi sau khi Project đã bị xóa. Thao tác này không thể hoàn tác.`
    )
    if(!ok) return

    const confirmAgain=window.prompt('Nhập DELETE để xác nhận:')
    if(confirmAgain!=='DELETE') return

    const {data,error}=await supabase.rpc(
      'manager_delete_personal_or_orphan_task',
      {p_task_id:task.id}
    )

    if(error){
      alert('Không xóa được task: '+error.message)
      return
    }

    if(data?.ok===false){
      alert(data?.message||'Không thể xóa task.')
      return
    }

    setRows(prev=>prev.filter(t=>t.id!==task.id))
  }

  useEffect(()=>{

    if(!membership?.user_id){
      return
    }

    let active=true
    setLoading(true)

    ;(async()=>{
      const {data:assignedRows}=await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id',membership.user_id)

      const ids=[...new Set((assignedRows||[]).map(x=>x.task_id).filter(Boolean))]
      let query=supabase
        .from('tasks')
        .select('*, project:projects(*), task_assignees(user_id, profiles(*))')
        .is('archived_at',null)
        .order('created_at',{ascending:false})

      if(ids.length){
        query=query.or(`assignee_id.eq.${membership.user_id},id.in.(${ids.join(',')})`)
      }else{
        query=query.eq('assignee_id',membership.user_id)
      }

      const {data}=await query
      if(active){setRows(data||[]);setLoading(false)}
    })()

    return()=>{active=false}
  },[membership?.user_id])


  useEffect(()=>{
    let active=true
    async function loadAssignedByMe(){
      if(myTab!=='assigned' || !membership?.user_id) return
      setAssignedByMeLoading(true)
      const {data,error}=await supabase
        .from('tasks')
        .select('*, project:projects(*), task_assignees(user_id, profiles(*)), profiles!tasks_assignee_id_fkey(full_name,avatar_url,email)')
        .eq('assigner_id',membership.user_id)
        .is('archived_at',null)
        .order('created_at',{ascending:false})
      if(!active) return
      if(error){
        console.error(error)
        setAssignedByMeRows([])
      }else{
        setAssignedByMeRows(data||[])
      }
      setAssignedByMeLoading(false)
    }
    loadAssignedByMe()
    return()=>{active=false}
  },[myTab,membership?.user_id])

  async function remindAssignedTask(task){
    if(!task?.id || remindingTaskId) return
    setRemindingTaskId(task.id)
    const {data,error}=await supabase.rpc('send_task_followup_reminder_safe',{p_task_id:task.id})
    setRemindingTaskId(null)
    if(error){alert('Không gửi được nhắc việc: '+error.message);return}
    const count=Number(data||0)
    alert(count>0?`Đã gửi nhắc việc tới ${count} người phụ trách.`:'Task này chưa có người phụ trách để nhắc.')
  }

  useEffect(()=>{
    let active=true
    async function loadManagedPermissions(){
      if(!membership?.user_id){setManagedPermissionProjectIds([]);return}
      const {data,error}=await supabase
        .from('project_members')
        .select('project_id,role_in_project,can_manage_project_members,can_assign_task')
        .eq('user_id',membership.user_id)
      if(!active) return
      if(error){console.error(error);setManagedPermissionProjectIds([]);return}
      setManagedPermissionProjectIds((data||[])
        .filter(x=>x.role_in_project==='lead'||x.can_manage_project_members||x.can_assign_task)
        .map(x=>x.project_id))
    }
    loadManagedPermissions()
    return()=>{active=false}
  },[membership?.user_id])

  const managedProjects=(projects||[])
    .filter(p=>{
      if(isManager) return true
      if(p.lead_id===membership?.user_id) return true
      if(managedPermissionProjectIds.includes(p.id)) return true
      if(String(membership?.role||'').toLowerCase()==='team_lead' && membership?.team_id && p.team_id===membership.team_id) return true
      return false
    })
    .filter(p=>!['archived','cancelled'].includes(String(p.status||'').toLowerCase()))

  useEffect(()=>{
    let active=true
    async function loadManagedTasks(){
      if(myTab!=='projects'){return}
      const ids=managedProjects.map(p=>p.id)
      if(!ids.length){setManagedTaskRows([]);setManagedLoading(false);return}
      setManagedLoading(true)
      let all=[]
      let from=0
      const size=1000
      while(true){
        const {data,error}=await supabase
          .from('tasks')
          .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*))')
          .in('project_id',ids)
          .is('archived_at',null)
          .order('created_at',{ascending:false})
          .range(from,from+size-1)
        if(error){console.error(error);break}
        all=all.concat(data||[])
        if(!data || data.length<size) break
        from+=size
        if(from>=10000) break
      }
      if(active){setManagedTaskRows(all);setManagedLoading(false)}
    }
    loadManagedTasks()
    return()=>{active=false}
  },[myTab,JSON.stringify(managedProjects.map(p=>p.id))])

  const projectDayMs=24*60*60*1000
  const projectNow=Date.now()
  const projectIsDone=t=>t.status==='done'
  const projectIsActive=t=>['todo','in_progress','review'].includes(t.status)
  const projectIsOverdue=t=>!!t.due_at&&!projectIsDone(t)&&new Date(t.due_at).getTime()<projectNow
  const projectIsOnTime=t=>projectIsDone(t)&&t.due_at&&t.completed_at&&new Date(t.completed_at).getTime()<=new Date(t.due_at).getTime()
  const projectIsLateDone=t=>projectIsDone(t)&&t.due_at&&t.completed_at&&new Date(t.completed_at).getTime()>new Date(t.due_at).getTime()

  function projectOnTime(list){
    const measured=list.filter(t=>projectIsOnTime(t)||projectIsLateDone(t))
    return measured.length?Math.round(measured.filter(projectIsOnTime).length/measured.length*100):null
  }

  function projectMetric(p){
    const list=managedTaskRows.filter(t=>t.project_id===p.id)
    const topLevel=list.filter(t=>!t.parent_task_id)
    const total=topLevel.length
    const done=topLevel.filter(projectIsDone).length
    const active=topLevel.filter(projectIsActive).length
    const review=topLevel.filter(t=>t.status==='review').length
    const overdue=topLevel.filter(projectIsOverdue).length
    const subtasks=list.filter(t=>!!t.parent_task_id).length
    const progress=total?Math.round(done/total*100):0
    const due=p.due_at?new Date(p.due_at).getTime():null
    const daysLeft=due?Math.ceil((due-projectNow)/projectDayMs):null
    const latestTs=Math.max(
      new Date(p.updated_at||p.created_at||0).getTime()||0,
      ...list.map(t=>new Date(t.updated_at||t.created_at||0).getTime()||0)
    )
    const staleDays=latestTs?Math.floor((projectNow-latestTs)/projectDayMs):null
    let health='Healthy'
    if(overdue>=2||(total&&overdue/total>=.2)||(daysLeft!==null&&daysLeft<=7&&daysLeft>=0&&progress<70)) health='At risk'
    else if(overdue>0||review>=3||(daysLeft!==null&&daysLeft<=7&&daysLeft>=0&&progress<85)||(staleDays!==null&&staleDays>=5)) health='Watch'

    const peopleMap=new Map()
    list.forEach(t=>{
      const ids=[
        ...(t.assignee_id?[t.assignee_id]:[]),
        ...(t.task_assignees||[]).map(a=>a.user_id)
      ].filter(Boolean)
      ;[...new Set(ids)].forEach(userId=>{
        if(!peopleMap.has(userId)) peopleMap.set(userId,[])
        peopleMap.get(userId).push(t)
      })
    })
    const people=[...peopleMap.entries()].map(([userId,tasks])=>{
      const member=(members||[]).find(m=>m.user_id===userId)
      const activeTasks=tasks.filter(projectIsActive)
      const overdueTasks=tasks.filter(projectIsOverdue)
      const reviewTasks=tasks.filter(t=>t.status==='review')
      const highTasks=activeTasks.filter(t=>['urgent','high'].includes(t.priority))
      const score=Math.round((activeTasks.length+highTasks.length*2+overdueTasks.length*3+reviewTasks.length*.5)*10)/10
      const workload=score<=3?'Low':score<=7?'Balanced':score<=11?'High':'Overloaded'
      return {
        userId,member,tasks:tasks.length,active:activeTasks.length,done:tasks.filter(projectIsDone).length,
        overdue:overdueTasks.length,review:reviewTasks.length,ontime:projectOnTime(tasks),workload,score
      }
    }).sort((a,b)=>b.overdue-a.overdue||b.score-a.score)

    return {p,list,total,done,active,review,overdue,subtasks,progress,daysLeft,staleDays,health,ontime:projectOnTime(topLevel),people}
  }

  const myProjectMetrics=managedProjects.map(projectMetric).sort((a,b)=>{
    const hr={'At risk':0,'Watch':1,'Healthy':2}
    return (hr[a.health]??9)-(hr[b.health]??9)||b.overdue-a.overdue||(a.daysLeft??9999)-(b.daysLeft??9999)
  })

  const visibleProjectMetrics=myProjectMetrics.filter(x=>{
    if(projectQuick==='at_risk') return x.health==='At risk'
    if(projectQuick==='overdue') return x.overdue>0
    if(projectQuick==='review') return x.review>0
    if(projectQuick==='due_soon') return x.daysLeft!==null&&x.daysLeft>=0&&x.daysLeft<=7
    if(projectQuick==='stale') return x.staleDays!==null&&x.staleDays>=5
    return true
  })

  const myProjectSummary={
    total:myProjectMetrics.length,
    atRisk:myProjectMetrics.filter(x=>x.health==='At risk').length,
    overdue:myProjectMetrics.reduce((n,x)=>n+x.overdue,0),
    review:myProjectMetrics.reduce((n,x)=>n+x.review,0),
    overloaded:myProjectMetrics.reduce((n,x)=>n+x.people.filter(p=>p.workload==='Overloaded').length,0)
  }


  const now=Date.now()
  const dayMs=24*60*60*1000

  const isDone=(t)=>t.status==='done'

  const isOverdue=(t)=>{
    if(!t.due_at || isDone(t)) return false
    return new Date(t.due_at).getTime()<now
  }

  const isNew=(t)=>{
    if(!t.created_at || isDone(t)) return false
    return now-new Date(t.created_at).getTime()<=3*dayMs
  }

  const isPriority=(t)=>
    ['urgent','high'].includes(t.priority)
    && !isDone(t)

  const needDo=(t)=>
    ['todo','in_progress'].includes(t.status)

  const counts={
    all:rows.length,
    need:rows.filter(needDo).length,
    new:rows.filter(isNew).length,
    overdue:rows.filter(isOverdue).length,
    priority:rows.filter(isPriority).length,
    in_progress:rows.filter(t=>t.status==='in_progress').length,
    review:rows.filter(t=>t.status==='review').length,
    done:rows.filter(isDone).length
  }

  const taskProjects=[...new Map(
    rows
      .filter(t=>t.project?.id)
      .map(t=>[t.project.id,t.project])
  ).values()]

  const matchesQuick=(t)=>{
    if(filter==='need') return needDo(t)
    if(filter==='new') return isNew(t)
    if(filter==='overdue') return isOverdue(t)
    if(filter==='priority') return isPriority(t)
    if(filter==='in_progress') return t.status==='in_progress'
    if(filter==='review') return t.status==='review'
    if(filter==='done') return isDone(t)
    return true
  }

  const q=searchText.trim().toLowerCase()

  const visibleRows=rows
    .filter(matchesQuick)
    .filter(t=>
      projectFilter==='all'
      || t.project?.id===projectFilter
    )
    .filter(t=>
      priorityFilter==='all'
      || t.priority===priorityFilter
    )
    .filter(t=>{
      if(!q) return true
      return [
        t.title,
        t.code,
        t.project?.name,
        t.project?.code
      ]
        .filter(Boolean)
        .some(v=>String(v).toLowerCase().includes(q))
    })
    .sort((a,b)=>{
      const overdueDiff=Number(isOverdue(b))-Number(isOverdue(a))
      if(overdueDiff) return overdueDiff

      const rank={urgent:0,high:1,medium:2,low:3}
      const priorityDiff=(rank[a.priority]??9)-(rank[b.priority]??9)
      if(priorityDiff) return priorityDiff

      const aDue=a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER
      const bDue=b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER
      if(aDue!==bDue) return aDue-bDue

      return new Date(b.created_at||0)-new Date(a.created_at||0)
    })

  const assignedDueState=(t)=>{
    if(!t?.due_at || isDone(t)) return 'none'
    const diff=Math.ceil((new Date(t.due_at).getTime()-now)/dayMs)
    if(diff<0) return 'overdue'
    if(diff===0) return 'today'
    if(diff<=3) return 'soon'
    return 'normal'
  }

  const assignedByMeCounts={
    all:assignedByMeRows.length,
    soon:assignedByMeRows.filter(t=>assignedDueState(t)==='soon').length,
    today:assignedByMeRows.filter(t=>assignedDueState(t)==='today').length,
    overdue:assignedByMeRows.filter(t=>assignedDueState(t)==='overdue').length,
    todo:assignedByMeRows.filter(t=>t.status==='todo').length,
    in_progress:assignedByMeRows.filter(t=>t.status==='in_progress').length,
    review:assignedByMeRows.filter(t=>t.status==='review').length,
    done:assignedByMeRows.filter(t=>t.status==='done').length
  }

  const visibleAssignedByMe=assignedByMeRows
    .filter(t=>{
      if(assignedByMeFilter==='soon') return assignedDueState(t)==='soon'
      if(assignedByMeFilter==='today') return assignedDueState(t)==='today'
      if(assignedByMeFilter==='overdue') return assignedDueState(t)==='overdue'
      if(['todo','in_progress','review','done'].includes(assignedByMeFilter)) return t.status===assignedByMeFilter
      return true
    })
    .filter(t=>{
      const q=assignedByMeSearch.trim().toLowerCase()
      if(!q) return true
      return [
        t.title,t.code,t.project?.name,t.project?.code,t.profiles?.full_name,t.profiles?.email,
        ...(t.task_assignees||[]).flatMap(a=>[a.profiles?.full_name,a.profiles?.email])
      ].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))
    })
    .sort((a,b)=>{
      const rank={overdue:0,today:1,soon:2,normal:3,none:4}
      const d=(rank[assignedDueState(a)]??9)-(rank[assignedDueState(b)]??9)
      if(d) return d
      const aDue=a.due_at?new Date(a.due_at).getTime():Number.MAX_SAFE_INTEGER
      const bDue=b.due_at?new Date(b.due_at).getTime():Number.MAX_SAFE_INTEGER
      return aDue-bDue
    })

  const quickFilters=[
    ['all','Tất cả'],
    ['need','Cần làm'],
    ['new','Mới được giao'],
    ['overdue','Trễ hạn'],
    ['priority','Ưu tiên'],
    ['in_progress','Đang làm'],
    ['review','Chờ Review'],
    ['done','Hoàn thành']
  ]

  function overdueText(t){
    if(!isOverdue(t)) return ''
    const diff=Math.max(1,Math.ceil((now-new Date(t.due_at).getTime())/dayMs))
    return `Trễ ${diff} ngày`
  }

  return <section className="page">

    <div className="pageHead">
      <div>
        <h1>{myTab==='tasks'?'My Tasks':myTab==='assigned'?'Assigned by Me':'My Projects'}</h1>
        <p>{myTab==='tasks'
          ?'Việc của bạn từ tất cả Project — ưu tiên việc trễ hạn, quan trọng và sắp đến deadline.'
          :myTab==='assigned'
            ?'Các Task bạn đã giao — theo dõi người thực hiện, deadline, trạng thái và nhắc việc ngay khi cần.'
            :'Các Project bạn đang chịu trách nhiệm — xem tiến độ, rủi ro và tình hình nhân sự ngay tại đây.'}</p>
      </div>
    </div>

    <div style={{display:'inline-flex',gap:4,padding:4,border:'1px solid #dbe4ee',borderRadius:14,background:'#fff',marginBottom:16}}>
      <button type="button" onClick={()=>setMyTab('tasks')} style={{border:0,borderRadius:10,padding:'9px 14px',fontWeight:900,cursor:'pointer',background:myTab==='tasks'?'#0f67c6':'transparent',color:myTab==='tasks'?'#fff':'#475569'}}>My Tasks</button>
      <button type="button" onClick={()=>setMyTab('assigned')} style={{border:0,borderRadius:10,padding:'9px 14px',fontWeight:900,cursor:'pointer',background:myTab==='assigned'?'#0f67c6':'transparent',color:myTab==='assigned'?'#fff':'#475569'}}>Assigned by Me ({assignedByMeRows.length})</button>
      <button type="button" onClick={()=>setMyTab('projects')} style={{border:0,borderRadius:10,padding:'9px 14px',fontWeight:900,cursor:'pointer',background:myTab==='projects'?'#0f67c6':'transparent',color:myTab==='projects'?'#fff':'#475569'}}>My Projects ({managedProjects.length})</button>
    </div>

    {myTab==='tasks' && <>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
      {quickFilters.map(([key,label])=>
        <button
          key={key}
          type="button"
          onClick={()=>setFilter(key)}
          style={{
            border:'1px solid #e5e7eb',
            background:filter===key ? '#fff3e8' : '#fff',
            color:filter===key ? '#b45309' : '#374151',
            borderRadius:999,
            padding:'8px 12px',
            fontWeight:700,
            cursor:'pointer'
          }}
        >
          {label} ({counts[key]||0})
        </button>
      )}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1fr) 220px 180px',gap:10,marginBottom:14}}>
      <input
        value={searchText}
        onChange={e=>setSearchText(e.target.value)}
        placeholder="Tìm theo tên task, mã task hoặc Project..."
        style={{border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 12px',background:'#fff'}}
      />

      <select
        value={projectFilter}
        onChange={e=>setProjectFilter(e.target.value)}
        style={{border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 12px',background:'#fff'}}
      >
        <option value="all">Tất cả Project</option>
        {taskProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <select
        value={priorityFilter}
        onChange={e=>setPriorityFilter(e.target.value)}
        style={{border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 12px',background:'#fff'}}
      >
        <option value="all">Mọi mức ưu tiên</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>

    <div className="panel taskPanel">

      {loading
        ? <div className="empty">Đang tải...</div>
        : visibleRows.length
          ? visibleRows.map(t=>{
              const isPersonalOrOrphan=!t.project?.id
              return <div key={t.id} style={{display:'flex',alignItems:'stretch',borderBottom:'1px solid #edf0f3'}}>
                <button
                  className="memberRow"
                  onClick={()=>{
                    if(t.project?.id) onOpenTask?.(t)
                    else if(!isManager) alert('Task này không còn Project để mở. Vui lòng báo Manager xử lý.')
                  }}
                  style={{alignItems:'center',flex:1,borderBottom:0}}
                >
                  <span className={'statusBadge '+t.status}>
                    {LABEL[t.status]||t.status}
                  </span>

                  <span style={{minWidth:0}}>
                    <b>{t.title}</b>

                    <small style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                      <span>{t.project?.name||(isPersonalOrOrphan?'Task không còn Project':'Personal task')} · {t.code}</span>

                      {isPersonalOrOrphan && <span style={{fontWeight:800,color:'#b45309'}}>Cần dọn dữ liệu</span>}
                      {isNew(t) && <span style={{fontWeight:800,color:'#2563eb'}}>Mới</span>}

                      {t.priority &&
                        <span style={{fontWeight:800,color:['urgent','high'].includes(t.priority)?'#b91c1c':'#6b7280'}}>
                          {PRIORITY[t.priority]||t.priority}
                        </span>
                      }
                    </small>
                  </span>

                  <span style={{textAlign:'right'}}>
                    <div>{fmtDate(t.due_at)}</div>
                    {isOverdue(t) &&
                      <small style={{display:'block',fontWeight:800,color:'#b91c1c'}}>
                        {overdueText(t)}
                      </small>
                    }
                  </span>
                </button>

                {isManager && isPersonalOrOrphan &&
                  <button
                    type="button"
                    onClick={()=>deletePersonalOrOrphanTask(t)}
                    title="Xóa task test / task mồ côi"
                    style={{minWidth:64,border:0,borderLeft:'1px solid #fee2e2',background:'#fff7f7',color:'#b91c1c',fontWeight:900,cursor:'pointer',fontSize:20}}
                  >
                    🗑
                  </button>
                }
              </div>
            })
          : <div className="empty">
              Không có task phù hợp với bộ lọc hiện tại.
            </div>
      }

    </div>

    </>}


    {myTab==='assigned' && <>
      <div className="homeKpiGrid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(118px,1fr))',gap:10,marginBottom:14}}>
        {[
          ['Đã giao',assignedByMeCounts.all,'#0f67c6','#eff6ff'],
          ['Sắp đến hạn',assignedByMeCounts.soon,'#d97706','#fff7ed'],
          ['Hôm nay',assignedByMeCounts.today,'#ea580c','#fff7ed'],
          ['Trễ hạn',assignedByMeCounts.overdue,'#dc2626','#fff1f2'],
          ['Chờ Review',assignedByMeCounts.review,'#7c3aed','#f5f3ff']
        ].map(([label,value,color,bg])=><div key={label} className="panel" style={{padding:'13px 14px',border:'1px solid #e2e8f0',background:bg}}><b style={{display:'block',fontSize:23,color}}>{value}</b><small style={{fontWeight:800,color:'#475569'}}>{label}</small></div>)}
      </div>

      <div className="mobileFilterScroller" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:12}}>
        {[
          ['all','Tất cả'],['soon','Sắp đến hạn'],['today','Hôm nay'],['overdue','Trễ hạn'],['todo','Chưa bắt đầu'],['in_progress','Đang làm'],['review','Chờ Review'],['done','Hoàn thành']
        ].map(([key,label])=><button key={key} type="button" onClick={()=>setAssignedByMeFilter(key)} style={{flex:'0 0 auto',border:'1px solid #e2e8f0',background:assignedByMeFilter===key?'#fff3e8':'#fff',color:assignedByMeFilter===key?'#b45309':'#475569',borderRadius:999,padding:'8px 12px',fontWeight:800,cursor:'pointer'}}>{label} ({assignedByMeCounts[key]||0})</button>)}
      </div>

      <input value={assignedByMeSearch} onChange={e=>setAssignedByMeSearch(e.target.value)} placeholder="Tìm theo Task, Project hoặc tên người được giao..." style={{width:'100%',boxSizing:'border-box',border:'1px solid #e5e7eb',borderRadius:12,padding:'11px 13px',background:'#fff',marginBottom:12}} />

      <div className="panel taskPanel">
        {assignedByMeLoading?<div className="empty">Đang tải Task bạn đã giao...</div>:visibleAssignedByMe.length?visibleAssignedByMe.map(t=>{
          const dueState=assignedDueState(t)
          const assigneeNames=[...(t.task_assignees||[]).map(a=>a.profiles?.full_name||a.profiles?.email),...(t.task_assignees||[]).length?[]:[t.profiles?.full_name||t.profiles?.email]].filter(Boolean)
          const dueLabel=dueState==='overdue'?overdueText(t):dueState==='today'?'Đến hạn hôm nay':dueState==='soon'?`Còn ${Math.max(1,Math.ceil((new Date(t.due_at).getTime()-now)/dayMs))} ngày`:fmtDate(t.due_at)
          const dueColor=dueState==='overdue'?'#b91c1c':dueState==='today'?'#ea580c':dueState==='soon'?'#d97706':'#64748b'
          return <div key={t.id} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:0,borderBottom:'1px solid #edf0f3'}}>
            <button type="button" className="memberRow" onClick={()=>t.project?.id?onOpenTask?.(t):alert('Task này không còn Project để mở.')} style={{alignItems:'center',borderBottom:0,textAlign:'left'}}>
              <span className={'statusBadge '+t.status}>{LABEL[t.status]||t.status}</span>
              <span style={{minWidth:0}}>
                <b style={{display:'block'}}>{t.title}</b>
                <small style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}><span>{t.project?.name||'Task không còn Project'} · {t.code}</span>{t.priority&&<span style={{fontWeight:900,color:['urgent','high'].includes(t.priority)?'#b91c1c':'#64748b'}}>{PRIORITY[t.priority]||t.priority}</span>}</small>
                <small style={{display:'block',marginTop:5,color:'#475569'}}><b>Đã giao cho:</b> {assigneeNames.join(', ')||'Chưa assign'}</small>
                <small style={{display:'block',marginTop:3,color:'#94a3b8'}}>Cập nhật gần nhất: {fmtDateTime(t.updated_at||t.created_at)}</small>
              </span>
              <span style={{textAlign:'right',minWidth:110}}><b style={{color:dueColor}}>{dueLabel}</b><small style={{display:'block',color:'#64748b',marginTop:4}}>Bấm để mở Task →</small></span>
            </button>
            {!isDone(t)&&<button type="button" onClick={(e)=>{e.stopPropagation();remindAssignedTask(t)}} disabled={remindingTaskId===t.id} style={{border:0,borderLeft:'1px solid #edf0f3',background:'#fff7ed',color:'#b45309',padding:'0 14px',fontWeight:900,cursor:'pointer',minWidth:92}}>{remindingTaskId===t.id?'Đang gửi...':'🔔 Nhắc ngay'}</button>}
          </div>
        }):<div className="empty">Chưa có Task nào bạn đã giao phù hợp với bộ lọc.</div>}
      </div>
    </>}

    {myTab==='projects' && <>
      <div className="homeKpiGrid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:10,marginBottom:14}}>
        {[
          ['Project quản lý',myProjectSummary.total,'#0f67c6','#eff6ff'],
          ['At risk',myProjectSummary.atRisk,'#dc2626','#fff1f2'],
          ['Task trễ',myProjectSummary.overdue,'#ea580c','#fff7ed'],
          ['Chờ Review',myProjectSummary.review,'#7c3aed','#f5f3ff'],
          ['Member quá tải',myProjectSummary.overloaded,'#b91c1c','#fef2f2']
        ].map(([label,value,color,bg])=><div key={label} className="panel" style={{padding:'14px 15px',border:'1px solid #e2e8f0',background:bg}}><b style={{display:'block',fontSize:24,color}}>{value}</b><small style={{fontWeight:800,color:'#475569'}}>{label}</small></div>)}
      </div>

      <div className="mobileFilterScroller" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:14}}>
        {[
          ['all','Tất cả'],['at_risk','At risk'],['overdue','Có task trễ'],['review','Review backlog'],['due_soon','Sắp deadline'],['stale','Không activity ≥5 ngày']
        ].map(([key,label])=><button key={key} type="button" onClick={()=>setProjectQuick(key)} style={{flex:'0 0 auto',border:'1px solid #e2e8f0',background:projectQuick===key?'#fff3e8':'#fff',color:projectQuick===key?'#b45309':'#475569',borderRadius:999,padding:'8px 12px',fontWeight:800,cursor:'pointer'}}>{label}</button>)}
      </div>

      {managedLoading?<div className="empty">Đang tải tình hình Project...</div>:visibleProjectMetrics.length?(
        <div style={{display:'grid',gap:12}}>
          {visibleProjectMetrics.map(x=>{
            const healthColor=x.health==='At risk'?'#b91c1c':x.health==='Watch'?'#c2410c':'#166534'
            const open=expandedProject===x.p.id
            return <div key={x.p.id} className="panel" style={{padding:0,overflow:'hidden',border:'1px solid #dfe7ef',boxShadow:'0 8px 25px rgba(15,57,104,.05)'}}>
              <div style={{padding:'16px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
                  <div style={{minWidth:0,flex:'1 1 300px'}}>
                    <small style={{fontWeight:800,color:'#64748b'}}>{x.p.code||'PROJECT'}</small>
                    <h3 style={{margin:'3px 0 6px',fontSize:20,color:'#0f2847'}}>{x.p.name}</h3>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{fontWeight:900,color:healthColor}}>{x.health}</span>
                      <span style={{color:'#64748b'}}>•</span>
                      <span style={{color:'#64748b'}}>{x.daysLeft===null?'Chưa có deadline':x.daysLeft<0?`Trễ deadline ${Math.abs(x.daysLeft)} ngày`:x.daysLeft===0?'Deadline hôm nay':`Còn ${x.daysLeft} ngày`}</span>
                      {x.staleDays!==null&&x.staleDays>=5&&<span style={{color:'#c2410c',fontWeight:800}}>• {x.staleDays} ngày chưa cập nhật</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="secondary" type="button" onClick={()=>setExpandedProject(open?null:x.p.id)}>{open?'Ẩn nhân sự':'Xem nhân sự'}</button>
                    <button className="primary" type="button" onClick={()=>onOpenProject?.(x.p)}>Mở Project</button>
                  </div>
                </div>

                <div style={{marginTop:14,height:9,borderRadius:999,background:'#e8eef5',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,x.progress))}%`,background:x.health==='At risk'?'#ef4444':x.health==='Watch'?'#f59e0b':'#22c55e'}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:6,color:'#64748b',fontSize:13}}><span>Tiến độ {x.progress}%</span><span>On-time {x.ontime===null?'—':x.ontime+'%'}</span></div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(82px,1fr))',gap:8,marginTop:14}}>
                  {[
                    ['Task',x.total],['Sub-task',x.subtasks],['Đang làm',x.active],['Done',x.done],['Review',x.review],['Overdue',x.overdue]
                  ].map(([k,v])=><div key={k} style={{border:'1px solid #edf1f5',borderRadius:12,padding:'9px 10px',background:'#fbfdff'}}><b style={{display:'block',fontSize:17,color:k==='Overdue'&&v?'#b91c1c':'#0f2847'}}>{v}</b><small style={{color:'#64748b'}}>{k}</small></div>)}
                </div>
              </div>

              {open&&<div style={{borderTop:'1px solid #e5e7eb',padding:'14px 18px',background:'#fbfdff'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10}}><b>Tiến độ nhân sự trong Project</b><small>{x.people.length} người đang có Task/Sub-task</small></div>
                {x.people.length?<div className="reportTableWrap" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:720}}><thead><tr>{['Member','Active','Done','Overdue','Review','On-time','Workload'].map(h=><th key={h} style={{textAlign:'left',padding:'9px 8px',borderBottom:'1px solid #e5e7eb',fontSize:12,color:'#64748b'}}>{h}</th>)}</tr></thead><tbody>{x.people.map(pm=>{
                  const name=pm.member?.profiles?.full_name||pm.member?.profiles?.email||(managedTaskRows.find(t=>(t.task_assignees||[]).some(a=>a.user_id===pm.userId))?.task_assignees||[]).find(a=>a.user_id===pm.userId)?.profiles?.full_name||'Member'
                  const wc=pm.workload==='Overloaded'?'#b91c1c':pm.workload==='High'?'#c2410c':pm.workload==='Balanced'?'#166534':'#2563eb'
                  return <tr key={pm.userId}><td style={{padding:'10px 8px',borderBottom:'1px solid #eef2f6'}}><b>{name}</b></td><td>{pm.active}</td><td>{pm.done}</td><td style={{color:pm.overdue?'#b91c1c':undefined,fontWeight:pm.overdue?900:400}}>{pm.overdue}</td><td>{pm.review}</td><td>{pm.ontime===null?'—':pm.ontime+'%'}</td><td style={{color:wc,fontWeight:900}}>{pm.workload}</td></tr>
                })}</tbody></table></div>:<div className="empty">Project chưa có Task được assign cho thành viên.</div>}
              </div>}
            </div>
          })}
        </div>
      ):<div className="empty">Bạn chưa có Project nào đang quản lý theo quyền hiện tại.</div>}
    </>}

  </section>
}


// =====================================================
// TEAMS
// =====================================================

function Teams({
  teams,
  projects,
  membership,
  currentUserId,
  canCreate,
  onCreate,
  onEdit
}){
  const [mode,setMode]=useState(()=>{
    try{return window.localStorage.getItem('fptu-work-team-view')||'list'}catch{return 'list'}
  })
  useEffect(()=>{try{window.localStorage.setItem('fptu-work-team-view',mode)}catch{}},[mode])

  const canEditTeam=(t)=>membership?.role==='manager'||(membership?.role==='team_lead'&&t.lead_id===currentUserId)
  const projectCount=(t)=>projects.filter(p=>p.team_id===t.id).length

  return <section className="page">
    <div className="pageHead">
      <div><h1>Teams</h1><p>Team, Team Lead và Project trong Workspace.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <div className="segmentedControl">
          <button type="button" className={mode==='list'?'active':''} onClick={()=>setMode('list')}>☷ Danh sách</button>
          <button type="button" className={mode==='grid'?'active':''} onClick={()=>setMode('grid')}>▦ Khối</button>
        </div>
        {canCreate&&<button className="primary" onClick={onCreate}>＋ Tạo Team</button>}
      </div>
    </div>

    {mode==='list'?<div className="panel teamListPanel">
      <div className="teamListHeader"><span>Team</span><span>Team Lead</span><span>Projects</span><span></span></div>
      {teams.map(t=><div className="teamListRow" key={t.id}>
        <span style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}><span className="projectIcon small">{(t.code||'T').slice(0,2)}</span><span style={{minWidth:0}}><b>{t.name}</b><small>{t.description||'Chưa có mô tả Team.'}</small></span></span>
        <span>{t.lead?.full_name||'Chưa gán'}</span>
        <span>{projectCount(t)}</span>
        <span>{canEditTeam(t)&&<button type="button" className="secondary compactBtn" onClick={()=>onEdit?.(t)}>✎ Sửa</button>}</span>
      </div>)}
    </div>:<div className="projectGrid">
      {teams.map(t=><article className="projectCard" key={t.id}>
        <div className="projectIcon">{(t.code||'T').slice(0,2)}</div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><h3 style={{margin:0}}>{t.name}</h3>{canEditTeam(t)&&<button type="button" className="secondary compactBtn" onClick={()=>onEdit?.(t)}>✎ Sửa</button>}</div>
        <p>{t.description||'Chưa có mô tả Team.'}</p>
        <div className="projectFoot"><span>Lead: {t.lead?.full_name||'Chưa gán'}</span><span>{projectCount(t)} Projects</span></div>
      </article>)}
    </div>}
  </section>
}


// =====================================================
// MEMBERS
// =====================================================

function Members({
  members,
  onOpen,
  onInvite
}){
  const [query,setQuery]=useState('')
  const q=query.trim().toLowerCase()
  const filtered=members.filter(m=>{
    const text=[m.profiles?.full_name,m.profiles?.email,m.teams?.name,m.role].filter(Boolean).join(' ').toLowerCase()
    return !q||text.includes(q)
  })

  return <section className="page">
    <div className="pageHead">
      <div><h1>Members & Permissions</h1><p>Trưởng phòng quản lý role, team và quyền Workspace.</p></div>
      <button className="primary" onClick={onInvite}>＋ Mời thành viên</button>
    </div>

    <div style={{marginBottom:12}}>
      <input
        value={query}
        onChange={e=>setQuery(e.target.value)}
        placeholder="Tìm theo tên hoặc email..."
        style={{width:'100%',maxWidth:520,border:'1px solid #dfe3e8',borderRadius:10,padding:'11px 12px',background:'#fff'}}
      />
    </div>

    <div className="panel memberTable">
      {filtered.map(m=><button className="memberRow" key={m.id} onClick={()=>onOpen(m)}>
        <Avatar p={m.profiles}/>
        <span><b>{m.profiles?.full_name||m.profiles?.email}</b><small>{m.profiles?.email}</small></span>
        <span>{m.teams?.name||'—'}</span>
        <span className="rolePill">{workspaceRoleLabel(m.role)}</span>
      </button>)}
      {!filtered.length&&<div className="empty">Không tìm thấy thành viên phù hợp.</div>}
    </div>
  </section>
}


// =====================================================
// REPORTS
// =====================================================

function Reports({projects,members,teams,membership,onOpenTask,onOpenProject}){
  const isManager=String(membership?.role||'').toLowerCase()==='manager'
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState(isManager?'executive':'management')
  const [period,setPeriod]=useState(()=>typeof window!=='undefined'?(localStorage.getItem('fptu-report-period')||'week'):'week')
  const [customFrom,setCustomFrom]=useState('')
  const [customTo,setCustomTo]=useState('')
  const [teamFilter,setTeamFilter]=useState('all')
  const [projectFilter,setProjectFilter]=useState('all')
  const [leadFilter,setLeadFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [detail,setDetail]=useState('all')

  useEffect(()=>{if(typeof window!=='undefined')localStorage.setItem('fptu-report-period',period)},[period])
  useEffect(()=>{let dead=false;(async()=>{const ids=(projects||[]).map(p=>p.id);if(!ids.length){setRows([]);setLoading(false);return}setLoading(true);let all=[],from=0;while(true){const {data,error}=await supabase.from('tasks').select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), task_assignees(user_id, profiles(*)), project:projects(id,name,code,team_id,lead_id,due_at,status,updated_at)').in('project_id',ids).is('archived_at',null).order('created_at',{ascending:false}).range(from,from+999);if(error){console.error(error);break}all=all.concat(data||[]);if(!data||data.length<1000)break;from+=1000;if(from>=10000)break}if(!dead){setRows(all);setLoading(false)}})();return()=>{dead=true}},[JSON.stringify((projects||[]).map(p=>p.id))])

  const now=new Date(), nowMs=now.getTime(), dayMs=86400000
  const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()
  const endOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999).getTime()
  function range(){let s=null,e=endOfDay(now);if(period==='today')s=startOfDay(now);if(period==='week'){const d=new Date(now);const delta=(d.getDay()+6)%7;d.setDate(d.getDate()-delta);s=startOfDay(d)}if(period==='month')s=new Date(now.getFullYear(),now.getMonth(),1).getTime();if(period==='d7')s=nowMs-6*dayMs;if(period==='d30')s=nowMs-29*dayMs;if(period==='custom'){s=customFrom?startOfDay(new Date(customFrom+'T00:00:00')):null;e=customTo?endOfDay(new Date(customTo+'T00:00:00')):e}return [s,e]}
  const [rangeStart,rangeEnd]=range()
  const inRange=t=>{if(!rangeStart)return true;const vals=[t.updated_at,t.created_at,t.completed_at,t.due_at].filter(Boolean).map(x=>new Date(x).getTime());return vals.some(v=>v>=rangeStart&&v<=rangeEnd)}
  const done=t=>t.status==='done', active=t=>['todo','in_progress','review'].includes(t.status), overdue=t=>!!t.due_at&&!done(t)&&new Date(t.due_at).getTime()<nowMs
  const projectMap=new Map((projects||[]).map(p=>[p.id,p])); const memberMap=new Map((members||[]).map(m=>[m.user_id,m])); const teamMap=new Map((teams||[]).map(t=>[t.id,t]))
  const base=rows.filter(inRange).filter(t=>teamFilter==='all'||(projectMap.get(t.project_id)?.team_id||t.project?.team_id)===teamFilter).filter(t=>projectFilter==='all'||t.project_id===projectFilter).filter(t=>statusFilter==='all'||t.status===statusFilter).filter(t=>leadFilter==='all'||(projectMap.get(t.project_id)?.lead_id||t.project?.lead_id)===leadFilter)
  const projectsScoped=(projects||[]).filter(p=>teamFilter==='all'||p.team_id===teamFilter).filter(p=>projectFilter==='all'||p.id===projectFilter).filter(p=>leadFilter==='all'||p.lead_id===leadFilter)
  const metric=p=>{const list=base.filter(t=>t.project_id===p.id),total=list.length,dd=list.filter(done).length,od=list.filter(overdue).length,rv=list.filter(t=>t.status==='review').length,progress=total?Math.round(dd/total*100):0;let health='Healthy';if(od>=2||(total&&od/total>=.2)||(p.due_at&&new Date(p.due_at).getTime()-nowMs<7*dayMs&&progress<70))health='At Risk';else if(od||rv>=3)health='Watch';return {p,list,total,done:dd,overdue:od,review:rv,progress,health}}
  const pm=projectsScoped.map(metric).filter(x=>x.total||period==='all').sort((a,b)=>b.overdue-a.overdue||a.progress-b.progress)
  const health={Healthy:pm.filter(x=>x.health==='Healthy').length,Watch:pm.filter(x=>x.health==='Watch').length,'At Risk':pm.filter(x=>x.health==='At Risk').length}
  const assignees=t=>[t.assignee_id,...(t.task_assignees||[]).map(a=>a.user_id)].filter(Boolean)
  const people=(members||[]).map(m=>{const list=base.filter(t=>assignees(t).includes(m.user_id)),act=list.filter(active),od=list.filter(overdue).length,rv=list.filter(t=>t.status==='review').length,high=act.filter(t=>['high','urgent'].includes(t.priority)).length;const score=act.length+od*3+rv+high*2;return {m,active:act.length,overdue:od,review:rv,total:list.length,score,workload:score>=15?'High':score<=3?'Low':'Balanced'}}).filter(x=>x.total).sort((a,b)=>b.score-a.score)
  const activeMembers=people.filter(x=>x.active>0).length
  const overall={projects:pm.length,active:base.filter(active).length,overdue:base.filter(overdue).length,risk:health['At Risk'],review:base.filter(t=>t.status==='review').length,members:activeMembers}
  const dueToday=base.filter(t=>t.due_at&&!done(t)&&startOfDay(new Date(t.due_at))===startOfDay(now)).length
  const due3=base.filter(t=>t.due_at&&!done(t)&&new Date(t.due_at).getTime()>nowMs&&new Date(t.due_at).getTime()<=nowMs+3*dayMs).length
  const due7=base.filter(t=>t.due_at&&!done(t)&&new Date(t.due_at).getTime()>nowMs&&new Date(t.due_at).getTime()<=nowMs+7*dayMs).length
  const taskFlow=[['To-do',base.filter(t=>t.status==='todo').length,'#94a3b8'],['In Progress',base.filter(t=>t.status==='in_progress').length,'#3b82f6'],['Review',overall.review,'#f59e0b'],['Done',base.filter(done).length,'#22c55e']]
  const alerts=[...pm.filter(x=>x.overdue>0).map(x=>({label:`${x.p.name} có ${x.overdue} task quá hạn`,sev:x.health==='At Risk'?'High':'Medium',go:()=>onOpenProject?.(x.p)})),...(overall.review>0?[{label:`${overall.review} task đang chờ Review`,sev:'Medium',go:()=>setDetail('review')}]:[])].slice(0,5)
  const maxFlow=Math.max(1,...taskFlow.map(x=>x[1]))
  const donutTotal=Math.max(1,pm.length), healthyPct=health.Healthy/donutTotal*100, watchPct=health.Watch/donutTotal*100, riskPct=health['At Risk']/donutTotal*100
  const showTasks=detail==='overdue'?base.filter(overdue):detail==='review'?base.filter(t=>t.status==='review'):detail==='today'?base.filter(t=>t.due_at&&!done(t)&&startOfDay(new Date(t.due_at))===startOfDay(now)):[]
  const resetFilters=()=>{setPeriod('week');setCustomFrom('');setCustomTo('');setTeamFilter('all');setProjectFilter('all');setLeadFilter('all');setStatusFilter('all');setDetail('all')}

  const Kpi=({label,value,tone='#2563eb',onClick})=><button type="button" onClick={onClick} style={{textAlign:'left',border:'1px solid #e2e8f0',background:'#fff',borderRadius:18,padding:'14px 15px',minHeight:96,boxShadow:'0 8px 24px rgba(15,57,104,.05)',cursor:onClick?'pointer':'default'}}><div style={{fontSize:12,color:'#64748b',fontWeight:800,textTransform:'uppercase',letterSpacing:.35}}>{label}</div><div style={{fontSize:30,fontWeight:950,color:tone,marginTop:6}}>{value}</div></button>
  return <section className="page execReport" style={{background:'linear-gradient(180deg,#f7fbff 0,#fff 46%,#fffaf5 100%)',minHeight:'calc(100vh - 64px)'}}>
    <style>{`@media(max-width:768px){.execTop{align-items:flex-start!important}.execTitle{font-size:25px!important}.execMode{width:100%;display:grid!important;grid-template-columns:1fr 1fr}.execMode button{min-height:44px}.execFilters{display:flex!important;overflow-x:auto!important;gap:8px!important;padding-bottom:7px!important;scrollbar-width:none}.execFilters>*{flex:0 0 178px!important;min-height:44px!important;font-size:16px!important}.execKpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}.execGrid2{grid-template-columns:1fr!important}.execProjectRow{grid-template-columns:minmax(0,1fr) 70px!important}.execProjectRow .deskOnly{display:none!important}.execWorkload{display:flex!important;overflow-x:auto!important;scroll-snap-type:x mandatory!important}.execPerson{flex:0 0 84vw!important;max-width:340px!important;scroll-snap-align:start!important}.execRiskGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.execBottomSheet{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:2800!important;max-height:72dvh!important;border-radius:22px 22px 0 0!important;padding-bottom:env(safe-area-inset-bottom)!important;box-shadow:0 -18px 60px rgba(15,23,42,.25)!important}.execReport{padding-bottom:120px!important}}@media(max-width:390px){.execKpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}.execKpis button{padding:12px!important;min-height:90px!important}.execKpis button div:nth-child(2){font-size:27px!important}}`}</style>
    <div className="execTop" style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}><div><div style={{fontSize:12,fontWeight:900,color:'#f97316',letterSpacing:.8}}>FPTU MKT WORK</div><h1 className="execTitle" style={{margin:'4px 0',fontSize:34,color:'#0f2847'}}>Marketing Department Overview</h1><p style={{margin:0,color:'#64748b'}}>Tổng quan hoạt động, tiến độ và rủi ro của phòng Marketing.</p></div><div className="execMode" style={{display:'flex',gap:6,background:'#fff',border:'1px solid #dbe5ef',padding:4,borderRadius:14}}><button onClick={()=>setMode('executive')} className={mode==='executive'?'primary':'secondary'}>Executive</button><button onClick={()=>setMode('management')} className={mode==='management'?'primary':'secondary'}>Management</button></div></div>
    <div className="execFilters" style={{display:'grid',gridTemplateColumns:'170px 160px 1fr 180px 160px auto',gap:8,marginBottom:14}}><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="today">Hôm nay</option><option value="week">Tuần này</option><option value="month">Tháng này</option><option value="d7">7 ngày gần nhất</option><option value="d30">30 ngày gần nhất</option><option value="custom">Từ ngày → đến ngày</option><option value="all">Tất cả thời gian</option></select><select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="all">Team: Tất cả</option>{(teams||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Project: Tất cả</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={leadFilter} onChange={e=>setLeadFilter(e.target.value)}><option value="all">Project Lead: Tất cả</option>{(members||[]).map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Status: Tất cả</option>{STATUS.map(s=><option key={s} value={s}>{LABEL[s]||s}</option>)}</select><button className="secondary" onClick={resetFilters}>Đặt lại</button></div>
    {period==='custom'&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}><label style={{display:'flex',gap:8,alignItems:'center'}}>Từ ngày <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label style={{display:'flex',gap:8,alignItems:'center'}}>Đến ngày <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label></div>}
    {loading?<div className="panel"><div className="empty">Đang tải dashboard...</div></div>:<>
      <div className="execKpis" style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(120px,1fr))',gap:10,marginBottom:14}}><Kpi label="Projects" value={overall.projects}/><Kpi label="Active Tasks" value={overall.active} tone="#16a34a"/><Kpi label="Overdue" value={overall.overdue} tone="#dc2626" onClick={()=>setDetail('overdue')}/><Kpi label="At Risk" value={overall.risk} tone="#f97316"/><Kpi label="In Review" value={overall.review} tone="#7c3aed" onClick={()=>setDetail('review')}/><Kpi label="Active Members" value={overall.members} tone="#2563eb"/></div>
      <div className="execGrid2" style={{display:'grid',gridTemplateColumns:'1fr 1.15fr .8fr',gap:12,marginBottom:12}}>
        <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Project Health</h3><div style={{display:'flex',alignItems:'center',gap:18}}><div style={{width:128,height:128,borderRadius:'50%',background:`conic-gradient(#22c55e 0 ${healthyPct}%,#f59e0b ${healthyPct}% ${healthyPct+watchPct}%,#ef4444 ${healthyPct+watchPct}% ${healthyPct+watchPct+riskPct}%)`,display:'grid',placeItems:'center'}}><div style={{width:82,height:82,borderRadius:'50%',background:'#fff',display:'grid',placeItems:'center',textAlign:'center'}}><b style={{fontSize:26}}>{pm.length}</b><small>Projects</small></div></div><div style={{display:'grid',gap:8,flex:1}}><div>🟢 <b>{health.Healthy}</b> Healthy</div><div>🟠 <b>{health.Watch}</b> Watch</div><div>🔴 <b>{health['At Risk']}</b> At Risk</div></div></div></div>
        <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Task Flow</h3><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,alignItems:'end',height:150}}>{taskFlow.map(([l,v,c])=><div key={l} style={{display:'grid',gridTemplateRows:'1fr auto auto',height:'100%',alignItems:'end',textAlign:'center'}}><div style={{height:`${Math.max(10,v/maxFlow*100)}%`,background:c,borderRadius:'9px 9px 3px 3px'}}/><b style={{fontSize:19,marginTop:6}}>{v}</b><small>{l}</small></div>)}</div></div>
        <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Deadline Risk</h3><div className="execRiskGrid" style={{display:'grid',gap:8}}>{[['Overdue',overall.overdue,'#dc2626','overdue'],['Hôm nay',dueToday,'#f97316','today'],['3 ngày tới',due3,'#f59e0b','all'],['7 ngày tới',due7,'#2563eb','all']].map(([l,v,c,k])=><button key={l} onClick={()=>k!=='all'&&setDetail(k)} style={{border:'1px solid #e5e7eb',background:'#fff',borderRadius:12,padding:'11px 12px',display:'flex',justifyContent:'space-between',cursor:k==='all'?'default':'pointer'}}><span>{l}</span><b style={{color:c,fontSize:20}}>{v}</b></button>)}</div></div>
      </div>
      <div className="execGrid2" style={{display:'grid',gridTemplateColumns:'1.1fr .9fr',gap:12,marginBottom:12}}><div className="panel" style={{padding:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{margin:'0 0 12px'}}>Project Progress</h3><small>{pm.length} project</small></div><div style={{display:'grid',gap:10}}>{pm.slice(0,8).map(x=><button key={x.p.id} className="execProjectRow" onClick={()=>onOpenProject?.(x.p)} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 80px 110px',gap:10,alignItems:'center',border:0,borderBottom:'1px solid #eef2f7',background:'transparent',padding:'10px 0',textAlign:'left',cursor:'pointer'}}><div><b>{x.p.name}</b><div style={{height:7,background:'#eaf0f6',borderRadius:999,marginTop:7,overflow:'hidden'}}><div style={{height:'100%',width:`${x.progress}%`,background:x.health==='At Risk'?'#ef4444':x.health==='Watch'?'#f59e0b':'#3b82f6'}}/></div></div><b>{x.progress}%</b><span className="deskOnly" style={{color:x.health==='At Risk'?'#dc2626':x.health==='Watch'?'#d97706':'#15803d',fontWeight:800}}>{x.health}</span></button>)}</div></div>
        <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Team Workload</h3><div className="execWorkload" style={{display:'grid',gap:8}}>{people.slice(0,7).map(x=><article className="execPerson" key={x.m.user_id} style={{border:'1px solid #e5e7eb',borderRadius:14,padding:12,background:'#fff'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><b>{x.m.profiles?.full_name||x.m.profiles?.email}</b><span style={{fontWeight:850,color:x.workload==='High'?'#dc2626':x.workload==='Low'?'#2563eb':'#15803d'}}>{x.workload}</span></div><small>{teamMap.get(x.m.team_id)?.name||x.m.teams?.name||''}</small><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:10,textAlign:'center'}}><div><b>{x.active}</b><small style={{display:'block'}}>Active</small></div><div><b style={{color:x.overdue?'#dc2626':undefined}}>{x.overdue}</b><small style={{display:'block'}}>Overdue</small></div><div><b>{x.review}</b><small style={{display:'block'}}>Review</small></div></div></article>)}</div></div></div>
      <div className="execGrid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Executive Attention</h3>{alerts.length?alerts.map((a,i)=><button key={i} onClick={a.go} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:10,border:0,borderBottom:'1px solid #eef2f7',background:'transparent',padding:'12px 0',textAlign:'left',cursor:'pointer'}}><span><b style={{marginRight:8}}>{i+1}.</b>{a.label}</span><span style={{fontWeight:800,color:a.sev==='High'?'#dc2626':'#d97706'}}>{a.sev}</span></button>):<div className="empty">Không có cảnh báo nổi bật trong khoảng thời gian này.</div>}</div><div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Team Overview</h3>{(teams||[]).map(t=>{const list=base.filter(x=>(projectMap.get(x.project_id)?.team_id||x.project?.team_id)===t.id);return <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #eef2f7'}}><b>{t.name}</b><span>{list.filter(active).length} active · <b style={{color:list.filter(overdue).length?'#dc2626':undefined}}>{list.filter(overdue).length} overdue</b></span></div>})}</div></div>
      {mode==='management'&&<div className="panel" style={{marginTop:12,padding:16}}><h3 style={{marginTop:0}}>Management Drill-down</h3><div style={{display:'grid',gap:8}}>{base.slice(0,20).map(t=><button key={t.id} onClick={()=>onOpenTask?.(t)} className="memberRow" style={{width:'100%'}}><span><b>{t.title}</b><small>{t.project?.name||projectMap.get(t.project_id)?.name} · {LABEL[t.status]||t.status}</small></span><span style={{color:overdue(t)?'#dc2626':'#64748b',fontWeight:800}}>{t.due_at?fmtDate(t.due_at):'—'}</span></button>)}</div></div>}
      {detail!=='all'&&<div className="execBottomSheet panel" style={{marginTop:12,padding:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><h3 style={{margin:0}}>{detail==='overdue'?'Task quá hạn':detail==='review'?'Task chờ Review':'Task đến hạn hôm nay'}</h3><button className="secondary" onClick={()=>setDetail('all')}>Đóng</button></div>{showTasks.length?showTasks.map(t=><button key={t.id} onClick={()=>onOpenTask?.(t)} className="memberRow" style={{width:'100%'}}><span><b>{t.title}</b><small>{t.project?.name||projectMap.get(t.project_id)?.name}</small></span><span>{t.due_at?fmtDate(t.due_at):'—'}</span></button>):<div className="empty">Không có task phù hợp.</div>}</div>}
    </>}
  </section>
}

// =====================================================
// MEMBER PERMISSION DRAWER
// =====================================================

function MemberDrawer({
  item,
  teams,
  onClose,
  onSaved
}){

  const [role,setRole]=
    useState(
      item.role
    )


  const [teamId,setTeamId]=
    useState(
      item.team_id||''
    )


  const [perms,setPerms]=
    useState({

      can_create_project:
        !!item.can_create_project,

      can_review_task:
        !!item.can_review_task,

      can_assign_outside_project:
        !!item.can_assign_outside_project,

      can_view_team_report:
        !!item.can_view_team_report,

      can_archive_project:
        !!item.can_archive_project
    })


  const [saving,setSaving]=
    useState(false)


  const [saved,setSaved]=
    useState(false)


  async function save(){

    setSaving(true)
    setSaved(false)


    const {
      data,
      error
    } = await supabase.rpc(
      'update_member_permissions_safe',
      {
        p_membership_id:
          item.id,

        p_role:
          role,

        p_team_id:
          teamId||null,

        p_can_create_project:
          perms.can_create_project,

        p_can_review_task:
          perms.can_review_task,

        p_can_assign_outside_project:
          perms.can_assign_outside_project,

        p_can_view_team_report:
          perms.can_view_team_report,

        p_can_archive_project:
          perms.can_archive_project
      }
    )


    setSaving(false)


    if(error){

      alert(
        'Không lưu được quyền: '+
        error.message
      )

      return
    }


    setSaved(true)


    await onSaved?.(
      data
    )


    setTimeout(
      ()=>{
        setSaved(false)
      },
      1800
    )
  }



  async function removeWorkspaceMember(){
    const name=item.profiles?.full_name||item.profiles?.email||'thành viên này'
    const ok=window.confirm(`Xóa ${name} khỏi Workspace?\n\nTài khoản Google/Profile không bị xóa, nhưng membership sẽ chuyển Inactive và người này bị gỡ khỏi Project/Team đang quản lý.`)
    if(!ok) return
    const confirmText=window.prompt('Nhập REMOVE để xác nhận:')
    if(confirmText!=='REMOVE') return
    setSaving(true)
    const {error}=await supabase.rpc('remove_workspace_member_safe',{p_membership_id:item.id})
    setSaving(false)
    if(error){alert('Không xóa được member: '+error.message);return}
    await onSaved?.()
    onClose?.()
  }

  return <div className="drawerWrap">

    <aside className="drawer narrow">

      <div className="drawerHead">

        <h2>
          Member permissions
        </h2>

        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

        <div className="memberHero">

          <Avatar
            p={item.profiles}
            big
          />

          <h3>

            {
              item.profiles
                ?.full_name
            }

          </h3>

          <p>

            {
              item.profiles
                ?.email
            }

          </p>

        </div>


        <Field label="Role">

          <select
            value={role}

            onChange={e=>{

              setRole(
                e.target.value
              )

              setSaved(false)
            }}
          >

            <option value="manager">
              Trưởng phòng
            </option>

            <option value="team_lead">
              Team Lead
            </option>

            <option value="member">
              Member/CTV
            </option>

          </select>

        </Field>


        <Field label="Team">

          <select
            value={teamId}

            onChange={e=>{

              setTeamId(
                e.target.value
              )

              setSaved(false)
            }}
          >

            <option value="">
              —
            </option>


            {teams.map(
              t=>
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.name}
                </option>
            )}

          </select>

        </Field>


        <h3>
          Custom permissions
        </h3>


        {Object.keys(
          perms
        ).map(
          key=>
            <label
              className="toggleLine"
              key={key}
            >

              <span>

                {
                  key.replaceAll(
                    '_',
                    ' '
                  )
                }

              </span>


              <input
                type="checkbox"

                checked={
                  perms[key]
                }

                onChange={e=>{

                  setPerms({
                    ...perms,

                    [key]:
                      e.target.checked
                  })


                  setSaved(false)
                }}
              />

            </label>
        )}


        <div className="mobileStickyAction">
        <button
          className="primary full"

          disabled={saving}

          onClick={save}
        >

          {
            saving
              ? 'Đang lưu...'

              : saved
                ? '✓ Đã lưu'

                : 'Lưu quyền'
          }

        </button>
        <button
          type="button"
          className="secondary full"
          disabled={saving}
          onClick={removeWorkspaceMember}
          style={{marginTop:10,color:'#b42318',borderColor:'#f0b4ad'}}
        >
          🗑 Xóa khỏi Workspace
        </button>
        </div>

      </div>

    </aside>

  </div>
}


// =====================================================
// MOBILE / FULL TASK CREATE DRAWER
// =====================================================
function TaskCreateDrawer({project,members,onClose,onCreate,draftScope='task',titleLabel='Tạo Task mới'}){
  const draftKey=`fptu-work-${draftScope}-draft-${project?.id||'unknown'}`
  const emptyForm={title:'',description:'',assignee_ids:[],due_at:'',priority:'medium',delivery_url:''}
  const [form,setForm]=useState(()=>{
    try{
      const raw=typeof window!=='undefined'?window.localStorage.getItem(draftKey):null
      return raw?{...emptyForm,...JSON.parse(raw)}:emptyForm
    }catch{return emptyForm}
  })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    try{window.localStorage.setItem(draftKey,JSON.stringify(form))}catch{}
  },[draftKey,form])

  function validHttpUrl(v){
    const x=(v||'').trim()
    if(!x)return true
    try{const u=new URL(x);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}
  }

  async function submit(e){
    e?.preventDefault?.()
    if(!form.title.trim()){
      setError('Vui lòng nhập tên Task.')
      return
    }
    if(!validHttpUrl(form.delivery_url)){
      setError('Delivery URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://')
      return
    }
    setSaving(true); setError('')
    const result=await onCreate?.(form)
    setSaving(false)
    if(!result?.ok){
      setError(result?.error||'Không tạo được Task.')
    }else{
      try{window.localStorage.removeItem(draftKey)}catch{}
    }
  }

  return <div className="drawerWrap mobileTaskCreate" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <aside className="drawer taskCreateDrawer">
      <div className="drawerHead">
        <div><small>{project?.code}</small><h2 style={{margin:0}}>{titleLabel}</h2></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <form className="drawerBody taskCreateBody" onSubmit={submit}>
        <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>Nháp được tự động lưu trên thiết bị này. Có thể đóng/mở lại form mà không mất nội dung.</div>
        <Field label="Tên Task *">
          <input autoFocus className="fullInput" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ví dụ: Thiết kế KV Open Day" />
        </Field>
        <Field label="Mô tả / đầu ra cần bàn giao">
          <textarea rows="5" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mô tả rõ yêu cầu, đầu ra, lưu ý..." />
        </Field>
        <Field label="Người phụ trách">
          <MultiMemberPicker members={members||[]} values={form.assignee_ids||[]} onChange={ids=>setForm({...form,assignee_ids:ids})} placeholder="Gõ tên, email, Team hoặc role..." />
        </Field>
        <div className="fieldGrid taskCreateGrid">
          <Field label="Deadline"><input type="date" value={form.due_at} onChange={e=>setForm({...form,due_at:e.target.value})}/></Field>
          <Field label="Priority"><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.keys(PRIORITY).map(x=><option key={x} value={x}>{PRIORITY[x]}</option>)}</select></Field>
        </div>
        <Field label="Delivery URL">
          <div className="deliveryLinkRow">
            <input className="fullInput" type="url" inputMode="url" value={form.delivery_url} onChange={e=>setForm({...form,delivery_url:e.target.value})} placeholder="https://drive.google.com/..." />
            {validHttpUrl(form.delivery_url)&&form.delivery_url.trim()&&<button type="button" className="secondary deliveryOpenBtn" onClick={()=>window.open(form.delivery_url.trim(),'_blank','noopener,noreferrer')}>Mở ↗</button>}
          </div>
          {form.delivery_url.trim()&&!validHttpUrl(form.delivery_url)&&<small style={{color:'#b91c1c'}}>URL chưa hợp lệ.</small>}
        </Field>
        {error&&<div className="errorBox">{error}</div>}
        <div className="taskCreateSticky">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Hủy</button>
          <button type="submit" className="primary" disabled={saving||!form.title.trim()}>{saving?'Đang tạo...':'Tạo & mở Task'}</button>
        </div>
      </form>
    </aside>
  </div>
}


// =====================================================
// PROJECT MEMBER DRAWER
// =====================================================

function ProjectMemberDrawer({
  project,
  item,
  projectMembers,
  workspaceMembers,
  onClose,
  onSaved
}){

  const isEdit=
    !!item


  const existingIds=
    new Set(
      (projectMembers||[])
        .map(
          x=>x.user_id
        )
    )


  const available=
    (workspaceMembers||[])
      .filter(
        x=>
          x.status==='active'
          &&
          !existingIds.has(
            x.user_id
          )
      )


  const [userId,setUserId]=
    useState(
      item?.user_id
      ||
      ''
    )


  const [role,setRole]=
    useState(
      item?.role_in_project
      ||
      'member'
    )


  const [canCreateTask,setCanCreateTask]=
    useState(
      item
        ? !!item.can_create_task
        : true
    )


  const [canAssignTask,setCanAssignTask]=
    useState(
      item
        ? !!item.can_assign_task
        : true
    )


  const [canManageMembers,setCanManageMembers]=
    useState(
      item
        ? !!item.can_manage_project_members
        : false
    )


  const [saving,setSaving]=
    useState(false)


  const [error,setError]=
    useState('')


  async function submit(){

    if(!userId){

      setError(
        'Không còn member nào trong Workspace để thêm.'
      )

      return
    }


    setSaving(true)
    setError('')


    const rpcName=
      isEdit
        ? 'update_project_member_safe'
        : 'add_project_member_safe'


    const payload=
      isEdit
        ? {
            p_project_id:
              project.id,

            p_user_id:
              userId,

            p_role_in_project:
              role,

            p_can_create_task:
              canCreateTask,

            p_can_assign_task:
              canAssignTask,

            p_can_manage_project_members:
              canManageMembers
          }
        : {
            p_project_id:
              project.id,

            p_user_id:
              userId,

            p_role_in_project:
              role,

            p_can_create_task:
              canCreateTask,

            p_can_assign_task:
              canAssignTask,

            p_can_manage_project_members:
              canManageMembers
          }


    const {
      error:e
    } = await supabase.rpc(
      rpcName,
      payload
    )


    setSaving(false)


    if(e){

      setError(
        e.message
      )

      return
    }


    await onSaved?.()
  }


  async function removeMember(){

    if(!isEdit){
      return
    }


    const name=
      item?.profiles?.full_name
      ||
      item?.profiles?.email
      ||
      'member này'


    const ok=
      window.confirm(
        `Gỡ ${name} khỏi Project? Người này sẽ không còn quyền truy cập Project theo membership hiện tại.`
      )


    if(!ok){
      return
    }


    setSaving(true)
    setError('')


    const {
      error:e
    } = await supabase.rpc(
      'remove_project_member_safe',
      {
        p_project_id:
          project.id,

        p_user_id:
          item.user_id
      }
    )


    setSaving(false)


    if(e){

      setError(
        e.message
      )

      return
    }


    await onSaved?.()
  }


  return <div
    className="drawerWrap"

    onMouseDown={e=>
      e.target===
        e.currentTarget
      &&
      onClose()
    }
  >

    <aside className="drawer narrow">

      <div className="drawerHead">

        <div>

          <small>
            {project.code}
          </small>

          <h2
            style={{
              margin:0
            }}
          >
            {isEdit
              ? 'Sửa member trong Project'
              : 'Add member vào Project'
            }
          </h2>

        </div>


        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

        {!isEdit && <div className="mobileHelper" style={{marginBottom:10,color:'#6b7280',fontSize:13}}>Gõ tên, email, Team hoặc role để tìm nhanh thành viên.</div>}

        <Field label="Member">

          {isEdit
            ? <div
                className="fullInput"
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:10,
                  background:'#f8fafc'
                }}
              >

                <Avatar p={item?.profiles}/>

                <span>
                  <b>
                    {item?.profiles?.full_name
                      ||
                      item?.profiles?.email
                    }
                  </b>
                </span>

              </div>

            : <SmartMemberPicker
                members={available}
                value={userId}
                onChange={setUserId}
                emptyLabel={available.length?'— Chọn thành viên —':'Không còn member khả dụng'}
                placeholder="Gõ tên, email, Team hoặc role..."
              />
          }

        </Field>


        <Field label="Role trong Project">

          <select
            value={role}

            onChange={e=>{
              const next=e.target.value
              setRole(next)
              if(next==='viewer'){
                setCanCreateTask(false)
                setCanAssignTask(false)
                setCanManageMembers(false)
              }
            }}
          >

            <option value="member">
              Member
            </option>

            <option value="lead">
              Lead
            </option>

            <option value="viewer">
              Viewer
            </option>

          </select>

        </Field>


        <label className="toggleLine">

          <span>
            Được tạo task
          </span>

          <input
            type="checkbox"
            disabled={role==='viewer'}

            checked={
              canCreateTask
            }

            onChange={e=>
              setCanCreateTask(
                e.target.checked
              )
            }
          />

        </label>


        <label className="toggleLine">

          <span>
            Được assign task
          </span>

          <input
            type="checkbox"
            disabled={role==='viewer'}

            checked={
              canAssignTask
            }

            onChange={e=>
              setCanAssignTask(
                e.target.checked
              )
            }
          />

        </label>


        <label className="toggleLine">

          <span>
            Được quản lý member Project
          </span>

          <input
            type="checkbox"
            disabled={role==='viewer'}

            checked={
              canManageMembers
            }

            onChange={e=>
              setCanManageMembers(
                e.target.checked
              )
            }
          />

        </label>


        {error &&
          <div className="errorBox">
            {error}
          </div>
        }


        <div className="mobileStickyAction">
        <button
          className="primary full"

          disabled={
            saving
            ||
            !userId
          }

          onClick={submit}
        >

          {
            saving
              ? 'Đang lưu...'
              : isEdit
                ? 'Lưu thay đổi'
                : 'Add to Project'
          }

        </button>


        {isEdit &&
          <button
            type="button"
            className="secondary full"
            disabled={saving}
            onClick={removeMember}
            style={{
              marginTop:10,
              color:'#b42318',
              borderColor:'#f0b4ad'
            }}
          >
            Gỡ khỏi Project
          </button>
        }
        </div>

      </div>

    </aside>

  </div>
}


// =====================================================
// NOTIFICATION PANEL
// =====================================================

function NotificationPanel({
  notifications,
  onClose,
  onOpenNotification,
  onMarkAll
}){

  return <div className="notificationPopover">

    <div className="notificationHead">

      <div>

        <b>
          Thông báo
        </b>

        <small>

          {
            notifications.filter(
              n=>!n.is_read
            ).length
          }

          {' '}chưa đọc

        </small>

      </div>


      <div>

        <button
          onClick={
            onMarkAll
          }
        >
          Đánh dấu đã đọc
        </button>


        <button
          onClick={
            onClose
          }
        >
          ×
        </button>

      </div>

    </div>


    <div className="notificationList">

      {notifications.map(
        n=>
          <button
            key={n.id}

            className={
              'notificationItem '+
              (
                !n.is_read
                  ? 'unread'
                  : ''
              )
            }

            onClick={()=>
              onOpenNotification(
                n
              )
            }
          >

            <span className="notifDot"/>


            <span>

              <b>
                {n.title}
              </b>

              <small>
                {n.body}
              </small>

              <em>
                {fmtDateTime(n.created_at)}
              </em>

            </span>

          </button>
      )}


      {!notifications.length &&
        <div className="empty">
          Chưa có thông báo.
        </div>
      }

    </div>

  </div>
}




// =====================================================
// PROFILE EDIT
// =====================================================

function ProfileEditDrawer({profile,onClose,onSaved}){
  const [form,setForm]=useState({
    full_name:profile?.full_name||'',
    avatar_url:profile?.avatar_url||'',
    birth_date:profile?.birth_date||''
  })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')

  async function save(){
    if(!form.full_name.trim()){
      setError('Vui lòng nhập tên hiển thị')
      return
    }
    setSaving(true); setError('')
    const {data,error}=await supabase.rpc('update_my_profile_safe',{
      p_full_name:form.full_name.trim(),
      p_avatar_url:form.avatar_url.trim()||null,
      p_birth_date:form.birth_date||null
    })
    setSaving(false)
    if(error){ setError(error.message); return }
    onSaved?.(data)
  }

  return <div className="drawerWrap" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <aside className="drawer narrow">
      <div className="drawerHead"><h2>Chỉnh sửa hồ sơ</h2><button onClick={onClose}>×</button></div>
      <div className="drawerBody">
        <div className="memberHero"><Avatar p={{...profile,...form}} big/></div>
        <Field label="Tên hiển thị"><input className="fullInput" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></Field>
        <Field label="Ảnh đại diện (URL)"><input className="fullInput" placeholder="https://..." value={form.avatar_url} onChange={e=>setForm({...form,avatar_url:e.target.value})}/></Field>
        <Field label="Ngày sinh"><input className="fullInput" type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></Field>
        <Field label="Email đăng nhập"><input className="fullInput" value={profile?.email||''} disabled/></Field>
        {error&&<div className="errorBox">{error}</div>}
        <div className="mobileStickyAction"><button className="primary full" disabled={saving} onClick={save}>{saving?'Đang lưu...':'Lưu hồ sơ'}</button></div>
      </div>
    </aside>
  </div>
}


// =====================================================
// TEAM EDIT
// =====================================================

function TeamEditDrawer({team,members,membership,onClose,onSaved}){
  const isManager=membership?.role==='manager'
  const [form,setForm]=useState({
    name:team?.name||'',
    code:team?.code||'',
    description:team?.description||'',
    lead_id:team?.lead_id||''
  })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')

  async function save(){
    if(!form.name.trim()){setError('Vui lòng nhập tên Team');return}
    setSaving(true);setError('')
    const {error}=await supabase.rpc('update_team_safe',{
      p_team_id:team.id,
      p_name:form.name.trim(),
      p_code:form.code.trim().toUpperCase(),
      p_description:form.description.trim()||null,
      p_lead_id:form.lead_id||null
    })
    setSaving(false)
    if(error){setError(error.message);return}
    const lead=members.find(m=>m.user_id===form.lead_id)?.profiles||team.lead||null
    onSaved?.({...team,...form,lead_id:form.lead_id||null,lead})
  }

  return <div className="drawerWrap" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <aside className="drawer narrow">
      <div className="drawerHead"><h2>Sửa Team</h2><button onClick={onClose}>×</button></div>
      <div className="drawerBody">
        <Field label="Tên Team"><input className="fullInput" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Mã Team"><input className="fullInput" value={form.code} disabled={!isManager} onChange={e=>setForm({...form,code:e.target.value})}/></Field>
        <Field label="Mô tả"><textarea rows="5" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
        <Field label="Team Lead">
          <SmartMemberPicker members={members} value={form.lead_id} disabled={!isManager} onChange={id=>setForm({...form,lead_id:id})} placeholder="Tìm Team Lead..." emptyLabel="— Chưa gán —"/>
        </Field>
        {!isManager&&<small>Team Lead có thể sửa tên và mô tả Team. Chỉ Trưởng phòng được đổi mã hoặc Team Lead.</small>}
        {error&&<div className="errorBox">{error}</div>}
        <div className="mobileStickyAction"><button className="primary full" disabled={saving} onClick={save}>{saving?'Đang lưu...':'Lưu Team'}</button></div>
      </div>
    </aside>
  </div>
}


// =====================================================
// PROJECT EDIT
// =====================================================

function ProjectEditDrawer({project,workspaceMembers,membership,onClose,onSaved}){
  const isManager=membership?.role==='manager'
  const [form,setForm]=useState({
    name:project?.name||'',
    description:project?.description||'',
    start_at:project?.start_at?String(project.start_at).slice(0,10):'',
    due_at:project?.due_at?String(project.due_at).slice(0,10):'',
    lead_id:project?.lead_id||'',
    primary_link_name:project?.primary_link_name||'',
    primary_link_url:project?.primary_link_url||'',
    link1_name:project?.link1_name||'',
    link1_url:project?.link1_url||'',
    link2_name:project?.link2_name||'',
    link2_url:project?.link2_url||'',
    link3_name:project?.link3_name||'',
    link3_url:project?.link3_url||''
  })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')

  function normalizeUrl(v){
    const x=(v||'').trim()
    return x||null
  }

  function isValidWebUrl(v){
    const x=(v||'').trim()
    if(!x)return true
    try{
      const u=new URL(x)
      return ['http:','https:'].includes(u.protocol) && !!u.hostname
    }catch{return false}
  }

  async function save(){
    if(!form.name.trim()){setError('Vui lòng nhập tên Project');return}
    const links=[form.primary_link_url,form.link1_url,form.link2_url,form.link3_url]
    if(links.some(v=>!isValidWebUrl(v))){setError('URL không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://');return}
    setSaving(true);setError('')
    const {data,error}=await supabase.rpc('update_project_workspace_safe',{
      p_project_id:project.id,
      p_name:form.name.trim(),
      p_description:form.description.trim()||null,
      p_start_at:form.start_at?new Date(form.start_at+'T00:00:00').toISOString():null,
      p_due_at:form.due_at?new Date(form.due_at+'T23:59:59').toISOString():null,
      p_lead_id:form.lead_id||null,
      p_primary_link_name:form.primary_link_name.trim()||null,
      p_primary_link_url:normalizeUrl(form.primary_link_url),
      p_link1_name:form.link1_name.trim()||null,
      p_link1_url:normalizeUrl(form.link1_url),
      p_link2_name:form.link2_name.trim()||null,
      p_link2_url:normalizeUrl(form.link2_url),
      p_link3_name:form.link3_name.trim()||null,
      p_link3_url:normalizeUrl(form.link3_url)
    })
    setSaving(false)
    if(error){setError(error.message);return}
    onSaved?.(data||{...project,...form})
  }

  return <div className="drawerWrap" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <aside className="drawer" style={{maxWidth:760}}>
      <div className="drawerHead"><h2>Sửa Project</h2><button onClick={onClose}>×</button></div>
      <div className="drawerBody">
        <Field label="Tên Project"><input className="fullInput" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Mô tả Project"><textarea rows="11" style={{minHeight:220,resize:'vertical'}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mục tiêu, phạm vi, đầu ra, cách triển khai, lưu ý quan trọng..."/></Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Ngày bắt đầu"><input className="fullInput" type="date" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})}/></Field>
          <Field label="Deadline"><input className="fullInput" type="date" value={form.due_at} onChange={e=>setForm({...form,due_at:e.target.value})}/></Field>
        </div>
        {isManager&&<Field label="Project Lead"><SmartMemberPicker members={workspaceMembers} value={form.lead_id} onChange={id=>setForm({...form,lead_id:id})} placeholder="Tìm Project Lead..." emptyLabel="— Chưa gán —"/></Field>}

        <div style={{marginTop:10,paddingTop:14,borderTop:'1px solid #eceff3'}}>
          <h3 style={{margin:'0 0 4px'}}>Links làm việc</h3>
          <p style={{margin:'0 0 14px',fontSize:13,color:'#7b8491'}}>Link-first: ưu tiên Drive/Docs/Figma/Canva. File lớn nên lưu trên Drive để tiết kiệm dung lượng hệ thống.</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(150px,.65fr) minmax(260px,1.35fr)',gap:10}}>
            <input className="fullInput" placeholder="Tên link chính" value={form.primary_link_name} onChange={e=>setForm({...form,primary_link_name:e.target.value})}/>
            <input className="fullInput" placeholder="https://..." value={form.primary_link_url} onChange={e=>setForm({...form,primary_link_url:e.target.value})}/>
            <input className="fullInput" placeholder="Tên link phụ 1" value={form.link1_name} onChange={e=>setForm({...form,link1_name:e.target.value})}/>
            <input className="fullInput" placeholder="https://..." value={form.link1_url} onChange={e=>setForm({...form,link1_url:e.target.value})}/>
            <input className="fullInput" placeholder="Tên link phụ 2" value={form.link2_name} onChange={e=>setForm({...form,link2_name:e.target.value})}/>
            <input className="fullInput" placeholder="https://..." value={form.link2_url} onChange={e=>setForm({...form,link2_url:e.target.value})}/>
            <input className="fullInput" placeholder="Tên link phụ 3" value={form.link3_name} onChange={e=>setForm({...form,link3_name:e.target.value})}/>
            <input className="fullInput" placeholder="https://..." value={form.link3_url} onChange={e=>setForm({...form,link3_url:e.target.value})}/>
          </div>
        </div>

        {error&&<div className="errorBox">{error}</div>}
        <button className="primary full" disabled={saving} onClick={save}>{saving?'Đang lưu...':'Lưu Project'}</button>
      </div>
    </aside>
  </div>
}


// =====================================================
// TEAM CREATE
// =====================================================

function TeamCreateDrawer({
  members,
  onClose,
  onCreate
}){

  const [form,setForm]=
    useState({
      name:'',
      code:'',
      description:'',
      lead_id:''
    })


  const [saving,setSaving]=
    useState(false)


  const [error,setError]=
    useState('')


  async function submit(){

    if(
      !form.name.trim()
    ){

      setError(
        'Vui lòng nhập tên Team'
      )

      return
    }


    setSaving(true)
    setError('')


    const result=
      await onCreate({
        ...form,

        name:
          form.name.trim(),

        code:
          form.code
            .trim()
            .toUpperCase()
      })


    setSaving(false)


    if(
      result?.error
    ){

      setError(
        result.error.message
        ||
        String(
          result.error
        )
      )
    }
  }


  return <div
    className="drawerWrap"

    onMouseDown={e=>
      e.target===
        e.currentTarget
      &&
      onClose()
    }
  >

    <aside className="drawer narrow">

      <div className="drawerHead">

        <h2>
          Tạo Team mới
        </h2>

        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

        <Field label="Tên Team">

          <input
            className="fullInput"

            value={
              form.name
            }

            onChange={e=>
              setForm({
                ...form,
                name:
                  e.target.value
              })
            }
          />

        </Field>


        <Field label="Mã Team">

          <input
            className="fullInput"

            value={
              form.code
            }

            onChange={e=>
              setForm({
                ...form,
                code:
                  e.target.value
              })
            }
          />

        </Field>


        <Field label="Mô tả">

          <textarea
            rows="5"

            value={
              form.description
            }

            onChange={e=>
              setForm({
                ...form,
                description:
                  e.target.value
              })
            }
          />

        </Field>


        <Field label="Team Lead">

          <select
            value={
              form.lead_id
            }

            onChange={e=>
              setForm({
                ...form,
                lead_id:
                  e.target.value
              })
            }
          >

            <option value="">
              Chưa gán
            </option>


            {members.map(
              m=>
                <option
                  key={m.user_id}
                  value={m.user_id}
                >

                  {
                    m.profiles
                      ?.full_name
                    ||
                    m.profiles
                      ?.email
                  }

                </option>
            )}

          </select>

        </Field>


        {error &&
          <div className="errorBox">
            {error}
          </div>
        }


        <button
          className="primary full"

          disabled={saving}

          onClick={submit}
        >

          {
            saving
              ? 'Đang tạo...'
              : 'Tạo Team'
          }

        </button>

      </div>

    </aside>

  </div>
}


// =====================================================
// PROJECT CREATE
// =====================================================

function ProjectCreateDrawer({
  teams,
  membership,
  onClose,
  onCreate
}){

  const defaultTeam=
    membership?.team_id
    ||
    teams[0]?.id
    ||
    ''


  const [form,setForm]=
    useState({

      name:'',
      code:'',

      team_id:
        defaultTeam,

      description:'',

      start_at:'',
      due_at:'',

      visibility:'team',

      require_task_review:true
    })


  const [saving,setSaving]=
    useState(false)


  const [error,setError]=
    useState('')


  async function submit(){

    if(
      !form.name.trim()
    ){

      setError(
        'Vui lòng nhập tên Project'
      )

      return
    }


    if(
      !form.team_id
    ){

      setError(
        'Vui lòng chọn Team'
      )

      return
    }


    setSaving(true)
    setError('')


    const result=
      await onCreate({

        ...form,

        name:
          form.name.trim(),

        code:
          form.code
            .trim()
            .toUpperCase(),

        start_at:
          form.start_at
            ? new Date(
                form.start_at+
                'T08:00:00'
              ).toISOString()
            : null,

        due_at:
          form.due_at
            ? new Date(
                form.due_at+
                'T17:00:00'
              ).toISOString()
            : null
      })


    setSaving(false)


    if(
      result?.error
    ){

      setError(
        result.error.message
        ||
        String(
          result.error
        )
      )
    }
  }


  return <div
    className="drawerWrap"

    onMouseDown={e=>
      e.target===
        e.currentTarget
      &&
      onClose()
    }
  >

    <aside className="drawer narrow">

      <div className="drawerHead">

        <h2>
          Tạo Project mới
        </h2>

        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

        <Field label="Tên Project">

          <input
            className="fullInput"

            value={
              form.name
            }

            onChange={e=>
              setForm({
                ...form,
                name:
                  e.target.value
              })
            }
          />

        </Field>


        <Field label="Mã Project">

          <input
            className="fullInput"

            value={
              form.code
            }

            onChange={e=>
              setForm({
                ...form,
                code:
                  e.target.value
              })
            }
          />

        </Field>


        <Field label="Team">

          <select
            value={
              form.team_id
            }

            onChange={e=>
              setForm({
                ...form,
                team_id:
                  e.target.value
              })
            }
          >

            {teams.map(
              t=>
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.name}
                </option>
            )}

          </select>

        </Field>


        <Field label="Mô tả">

          <textarea
            rows="6"

            value={
              form.description
            }

            onChange={e=>
              setForm({
                ...form,
                description:
                  e.target.value
              })
            }
          />

        </Field>


        <div className="fieldGrid">

          <Field label="Bắt đầu">

            <input
              type="date"

              value={
                form.start_at
              }

              onChange={e=>
                setForm({
                  ...form,
                  start_at:
                    e.target.value
                })
              }
            />

          </Field>


          <Field label="Deadline">

            <input
              type="date"

              value={
                form.due_at
              }

              onChange={e=>
                setForm({
                  ...form,
                  due_at:
                    e.target.value
                })
              }
            />

          </Field>

        </div>


        <Field label="Visibility">

          <select
            value={
              form.visibility
            }

            onChange={e=>
              setForm({
                ...form,
                visibility:
                  e.target.value
              })
            }
          >

            <option value="private">
              Private
            </option>

            <option value="team">
              Team
            </option>

            <option value="workspace">
              Workspace
            </option>

          </select>

        </Field>


        <label className="toggleLine">

          <span>
            Require task review
          </span>

          <input
            type="checkbox"

            checked={
              form.require_task_review
            }

            onChange={e=>
              setForm({
                ...form,

                require_task_review:
                  e.target.checked
              })
            }
          />

        </label>


        {error &&
          <div className="errorBox">
            {error}
          </div>
        }


        <button
          className="primary full"

          disabled={saving}

          onClick={submit}
        >

          {
            saving
              ? 'Đang tạo...'
              : 'Tạo Project'
          }

        </button>

      </div>

    </aside>

  </div>
}


// =====================================================
// INVITE
// =====================================================

function InviteDrawer({
  teams,
  projects,
  membership,
  onClose,
  onCreated
}){

  const [form,setForm]=
    useState({

      team_id:
        membership?.team_id
        ||
        teams[0]?.id
        ||
        '',

      project_id:'',

      role:'member',

      max_uses:50,

      expires_days:30
    })


  const [saving,setSaving]=
    useState(false)


  const [error,setError]=
    useState('')


  const [link,setLink]=
    useState('')


  async function create(){

    setSaving(true)
    setError('')
    setLink('')


    const expires=
      form.expires_days
        ? new Date(
            Date.now()
            +
            Number(
              form.expires_days
            )*
            86400000
          ).toISOString()
        : null


    const {
      data,
      error:e
    } = await supabase.rpc(
      'create_invitation_v13',
      {
        p_team_id:
          form.team_id||null,

        p_project_id:
          form.project_id||null,

        p_role:
          form.role,

        p_expires_at:
          expires,

        p_max_uses:
          Number(
            form.max_uses
          )
          ||
          null
      }
    )


    setSaving(false)


    if(e){

      setError(
        e.message
      )

      return
    }


    const token=
      data?.token
      ||
      data


    const url=
      `${appUrl}/?invite=${encodeURIComponent(token)}`


    setLink(
      url
    )


    onCreated?.()
  }


  async function copy(){

    try{

      await navigator
        .clipboard
        .writeText(
          link
        )

    }catch{}
  }


  return <div
    className="drawerWrap"

    onMouseDown={e=>
      e.target===
        e.currentTarget
      &&
      onClose()
    }
  >

    <aside className="drawer narrow">

      <div className="drawerHead">

        <h2>
          Mời thành viên
        </h2>

        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

        <p>
          Tạo 1 link và gửi cho nhiều người.
          Bất kỳ tài khoản Google nào cũng có thể đăng nhập.
        </p>


        <Field label="Team">

          <select
            value={
              form.team_id
            }

            onChange={e=>
              setForm({
                ...form,
                team_id:
                  e.target.value
              })
            }
          >

            <option value="">
              Không gán Team
            </option>


            {teams.map(
              t=>
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.name}
                </option>
            )}

          </select>

        </Field>


        <Field label="Project">

          <select
            value={
              form.project_id
            }

            onChange={e=>
              setForm({
                ...form,
                project_id:
                  e.target.value
              })
            }
          >

            <option value="">
              Chỉ vào Workspace/Team
            </option>


            {projects.map(
              p=>
                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.name}
                </option>
            )}

          </select>

        </Field>


        <Field label="Role mặc định">

          <select
            value={
              form.role
            }

            onChange={e=>
              setForm({
                ...form,
                role:
                  e.target.value
              })
            }
          >

            <option value="member">
              Member/CTV
            </option>

            <option value="team_lead">
              Team Lead
            </option>

          </select>

        </Field>


        <div className="fieldGrid">

          <Field label="Số lượt dùng">

            <input
              type="number"
              min="1"

              value={
                form.max_uses
              }

              onChange={e=>
                setForm({
                  ...form,
                  max_uses:
                    e.target.value
                })
              }
            />

          </Field>


          <Field label="Hết hạn sau (ngày)">

            <input
              type="number"
              min="1"

              value={
                form.expires_days
              }

              onChange={e=>
                setForm({
                  ...form,
                  expires_days:
                    e.target.value
                })
              }
            />

          </Field>

        </div>


        {error &&
          <div className="errorBox">
            {error}
          </div>
        }


        {link

          ? <>

              <Field label="Invite link">

                <textarea
                  readOnly
                  rows="4"
                  value={link}
                />

              </Field>


              <button
                className="primary full"
                onClick={copy}
              >
                Copy link mời
              </button>


              <button
                className="secondary full"
                onClick={create}
              >
                Tạo link mới
              </button>

            </>

          : <button
              className="primary full"

              disabled={saving}

              onClick={create}
            >

              {
                saving
                  ? 'Đang tạo...'
                  : 'Tạo link mời'
              }

            </button>
        }

      </div>

    </aside>

  </div>
}


// =====================================================
// FILES
// =====================================================

function ProjectFiles({project,canManage}){
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState(false)
  const inputRef=useRef(null)

  async function load(){
    if(!project?.id)return
    setLoading(true)
    const {data,error}=await supabase
      .from('project_files')
      .select('id,project_id,file_name,storage_path,file_size,mime_type,uploaded_by,created_at,profiles:uploaded_by(full_name,email)')
      .eq('project_id',project.id)
      .order('created_at',{ascending:false})
    setLoading(false)
    if(error){console.error(error);return}
    setRows(data||[])
  }

  useEffect(()=>{load()},[project?.id])

  function humanBytes(n){
    const x=Number(n||0)
    if(x<1024)return x+' B'
    if(x<1024*1024)return (x/1024).toFixed(1)+' KB'
    return (x/1024/1024).toFixed(1)+' MB'
  }

  async function uploadFile(file){
    if(!file)return
    if(file.size>10*1024*1024){
      alert('File vượt 10 MB. Hãy upload lên Google Drive rồi gắn link vào Project để tiết kiệm dung lượng.')
      return
    }
    setUploading(true)
    try{
      const clean=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_')
      const path=`${project.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${clean}`
      const {error:upErr}=await supabase.storage.from('project-files').upload(path,file,{upsert:false,contentType:file.type||undefined})
      if(upErr)throw upErr
      const {error:metaErr}=await supabase.rpc('register_project_file_safe',{
        p_project_id:project.id,
        p_file_name:file.name,
        p_storage_path:path,
        p_file_size:file.size,
        p_mime_type:file.type||null
      })
      if(metaErr){
        await supabase.storage.from('project-files').remove([path])
        throw metaErr
      }
      await load()
    }catch(e){
      alert('Không upload được file: '+e.message)
    }finally{
      setUploading(false)
      if(inputRef.current)inputRef.current.value=''
    }
  }

  async function openFile(row){
    const {data,error}=await supabase.storage.from('project-files').createSignedUrl(row.storage_path,120)
    if(error){alert('Không mở được file: '+error.message);return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  async function removeFile(row){
    if(!confirm(`Xóa file "${row.file_name}" khỏi Project?`))return
    const {error:storageError}=await supabase.storage.from('project-files').remove([row.storage_path])
    if(storageError){alert('Không xóa được file: '+storageError.message);return}
    const {error}=await supabase.rpc('delete_project_file_metadata_safe',{p_file_id:row.id})
    if(error){alert('Đã xóa file khỏi Storage nhưng không xóa được metadata: '+error.message);return}
    setRows(v=>v.filter(x=>x.id!==row.id))
  }

  return <div className="panel">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:12}}>
      <div>
        <h3 style={{margin:'0 0 4px'}}>Files</h3>
        <p style={{margin:0,color:'#7b8491'}}>Chỉ upload file cần lưu trực tiếp. Giới hạn 10 MB/file; file lớn nên dùng Google Drive và gắn link ở Overview.</p>
      </div>
      {canManage&&<>
        <input ref={inputRef} type="file" style={{display:'none'}} onChange={e=>uploadFile(e.target.files?.[0])}/>
        <button className="primary" disabled={uploading} onClick={()=>inputRef.current?.click()}>{uploading?'Đang upload...':'＋ Upload file'}</button>
      </>}
    </div>

    {loading&&<div className="empty">Đang tải file...</div>}
    {!loading&&!rows.length&&<div className="empty">Chưa có file. Ưu tiên gắn link Drive/Docs/Figma ở Overview.</div>}
    {!loading&&rows.map(r=><div key={r.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:12,alignItems:'center',padding:'12px 0',borderTop:'1px solid #edf0f3'}}>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.file_name}</div>
        <small style={{color:'#8a94a6'}}>{humanBytes(r.file_size)} · {r.profiles?.full_name||r.profiles?.email||'User'} · {fmtDate(r.created_at)}</small>
      </div>
      <button className="secondary" onClick={()=>openFile(r)}>Mở / Tải</button>
      {canManage&&<button className="secondary" onClick={()=>removeFile(r)}>Xóa</button>}
    </div>)}
  </div>
}


// =====================================================
// PROJECT ACTIVITY
// =====================================================

function ProjectActivity({
  project
}){

  const [rows,setRows]=
    useState([])


  useEffect(()=>{

    supabase
      .from(
        'project_activity_logs'
      )
      .select('*')
      .eq(
        'project_id',
        project.id
      )
      .order(
        'created_at',
        {
          ascending:false
        }
      )
      .limit(100)
      .then(
        ({data})=>
          setRows(
            data||[]
          )
      )

  },[
    project.id
  ])


  return <div className="panel">

    <h3>
      Project Activity
    </h3>


    {rows.length

      ? rows.map(
          x=>
            <div
              className="activityLine"
              key={x.id}
            >

              <span>
                •
              </span>


              <div>

                {x.action}

                <small>
                  {
                    fmtDateTime(
                      x.created_at
                    )
                  }
                </small>

              </div>

            </div>
        )

      : <div className="empty">
          Chưa có activity riêng của Project.
        </div>
    }

  </div>
}
