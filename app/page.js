'use client'

// FPTU Work v18.8 - Mobile UX Optimization

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
  const deepLinkHandledRef=useRef(false)


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
                avatar_url:x.avatar_url
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
          '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), project:projects(name,code)'
        )
        .eq(
          'project_id',
          p.id
        )
        .is(
          'archived_at',
          null
        )


    if(!canSeeAll){

      query=query.eq(
        'assignee_id',
        session.user.id
      )
    }


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
      t||[]


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
            '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), project:projects(name,code)'
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
        '*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email)'
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

    const assigneeId=form?.assignee_id||session.user.id

    if(assigneeId && !projectMembers.some(m=>m.user_id===assigneeId)){
      const targetMember=members.find(m=>m.user_id===assigneeId)
      if(!targetMember){
        return {ok:false,error:'Không tìm thấy người được giao trong Workspace.'}
      }
      if(!canAutoAddTaskAssignee){
        return {ok:false,error:'Người này chưa thuộc Project. Hãy Add member vào Project trước khi giao Task.'}
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
      setProjectMembers(prev=>[...prev,{
        project_id:project.id,user_id:assigneeId,role_in_project:'member',
        can_create_task:true,can_assign_task:true,can_manage_project_members:false,
        profiles:targetMember.profiles
      }])
    }

    const {data:taskId,error:createError}=await supabase.rpc('create_project_task_safe',{
      p_project_id:project.id,
      p_title:title,
      p_assignee_id:assigneeId||null
    })
    if(createError){
      return {ok:false,error:'Không tạo được Task: '+createError.message}
    }

    const patch={
      description:(form?.description||'').trim()||null,
      priority:form?.priority||'medium',
      due_at:form?.due_at?new Date(form.due_at+'T17:00:00').toISOString():null,
      delivery_url:(form?.delivery_url||'').trim()||null
    }
    const {error:updateError}=await supabase.from('tasks').update(patch).eq('id',taskId)
    if(updateError){
      return {ok:false,error:'Task đã được tạo nhưng không lưu đủ thông tin: '+updateError.message}
    }

    const {data,error:loadError}=await supabase
      .from('tasks')
      .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email)')
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


  // ===================================================
  // UPDATE TASK
  // ===================================================

  async function updateTask(
    id,
    patch
  ){

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
                t.assignee_id===
                  session?.user?.id
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
                `${t.code} ${t.title} ${t.profiles?.full_name||''}`
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

      @media (max-width: 760px){
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
        .drawerWrap{align-items:flex-end!important;padding:0!important}
        .drawer,.drawer.narrow{width:100%!important;max-width:none!important;height:auto!important;max-height:94dvh!important;border-radius:18px 18px 0 0!important;overflow:hidden!important}
        .drawerHead{padding:14px 16px!important;position:sticky!important;top:0!important;background:#fff!important;z-index:20!important}
        .drawerBody{padding:14px 16px calc(24px + env(safe-area-inset-bottom))!important;overflow-y:auto!important;max-height:calc(94dvh - 68px)!important}
        .fieldGrid,.taskCreateGrid{grid-template-columns:1fr!important}
        .field input,.field select,.field textarea,.fullInput{font-size:16px!important;min-height:46px!important;width:100%!important;box-sizing:border-box!important}
        .taskCreateDrawer{height:94dvh!important;max-height:94dvh!important}
        .taskCreateBody{padding-bottom:96px!important}
        .taskCreateSticky{position:sticky!important;bottom:0!important;background:#fff!important;border-top:1px solid #e5e7eb!important;margin:18px -16px -24px!important;padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;z-index:30!important;display:grid!important;grid-template-columns:1fr 1.5fr!important}
        .taskCreateSticky button{min-height:48px!important;font-size:16px!important;font-weight:700!important}
        .notificationPopover{left:12px!important;right:12px!important;width:auto!important;max-width:none!important}
        .mobileBottomNav{display:grid!important;grid-template-columns:repeat(5,1fr)!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:1000!important;background:rgba(255,255,255,.98)!important;backdrop-filter:blur(14px)!important;border-top:1px solid #dbe5f0!important;padding:7px 6px calc(7px + env(safe-area-inset-bottom))!important;box-shadow:0 -8px 28px rgba(15,57,104,.08)!important}
        .mobileBottomNav button{border:0!important;background:transparent!important;color:#64748b!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;font-size:11px!important;font-weight:700!important;min-height:48px!important;padding:3px!important}
        .mobileBottomNav button span:first-child{font-size:21px!important;line-height:1!important}
        .mobileBottomNav button.active{color:#1367d1!important}
        .mobileMoreMenu{display:block!important;position:fixed!important;left:12px!important;right:12px!important;bottom:76px!important;z-index:1100!important;background:#fff!important;border:1px solid #dbe5f0!important;border-radius:18px!important;box-shadow:0 20px 50px rgba(15,57,104,.22)!important;padding:8px!important}
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

          </button>


          <SmartMemberPicker
            members={members}
            value={t.assignee_id||''}
            onChange={id=>updateTask(t.id,{assignee_id:id||null})}
            placeholder="Tìm người assign..."
            emptyLabel="—"
            compact
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

                  onDoubleClick={()=>
                    openTask(t)
                  }
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
  onUpdate
}){

  const [comments,setComments]=useState([])
  const [activity,setActivity]=useState([])

  const [comment,setComment]=useState('')

  const [mentionedUsers,setMentionedUsers]=useState([])

  const [mentionOpen,setMentionOpen]=useState(false)
  const [mentionQuery,setMentionQuery]=useState('')

  const [highlightComment,setHighlightComment]=useState(null)

  const textareaRef=useRef(null)


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
      activityRes
    ] = await Promise.all([

      supabase
        .from('task_comments')
        .select(
          '*, profiles(*)'
        )
        .eq(
          'task_id',
          task.id
        )
        .is(
          'deleted_at',
          null
        )
        .order(
          'created_at'
        ),

      supabase
        .from(
          'task_activity_logs'
        )
        .select(
          '*, profiles(*)'
        )
        .eq(
          'task_id',
          task.id
        )
        .order(
          'created_at',
          {
            ascending:false
          }
        )
        .limit(50)

    ])


    setComments(
      commentRes.data||[]
    )

    setActivity(
      activityRes.data||[]
    )
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


        <button
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <div className="drawerBody">

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


          <Field label="Assignee">

            <SmartMemberPicker
              members={projectMembers}
              value={task.assignee_id||''}
              onChange={id=>onUpdate(task.id,{assignee_id:id||null})}
              placeholder="Gõ tên hoặc email để assign..."
              emptyLabel="— Chưa assign —"
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

          <input
            className="fullInput"

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
  const roleLabel=(role)=>role==='manager'?'Trưởng phòng':role==='team_lead'?'Team Lead':role==='lead'?'Project Lead':role==='viewer'?'Viewer':'Member'
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

  const birthdayRows=(members||[])
    .map(m=>({
      member:m,
      name:m.profiles?.full_name||m.profiles?.email||'Thành viên',
      avatar:m.profiles,
      birth:m.profiles?.birth_date
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
        {upcoming.length?upcoming.map(x=><div key={x.member.user_id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #fff0e1'}}><Avatar p={x.avatar}/><div style={{minWidth:0,flex:1}}><b style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.name}</b><small>{x.days===1?'Ngày mai':`${x.days} ngày nữa`} · {String(x.next.getDate()).padStart(2,'0')}/{String(x.next.getMonth()+1).padStart(2,'0')}</small></div></div>):<div className="empty">7 ngày tới chưa có sinh nhật thành viên.</div>}
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
  onOpenTask
}){

  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('all')
  const [searchText,setSearchText]=useState('')
  const [projectFilter,setProjectFilter]=useState('all')
  const [priorityFilter,setPriorityFilter]=useState('all')

  useEffect(()=>{

    if(!membership?.user_id){
      return
    }

    setLoading(true)

    supabase
      .from('tasks')
      .select('*, project:projects(*)')
      .eq('assignee_id',membership.user_id)
      .is('archived_at',null)
      .order('created_at',{ascending:false})
      .then(({data})=>{
        setRows(data||[])
        setLoading(false)
      })

  },[membership?.user_id])


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

  const projects=[...new Map(
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
        <h1>My Tasks</h1>
        <p>Việc của bạn từ tất cả Project — ưu tiên việc trễ hạn, quan trọng và sắp đến deadline.</p>
      </div>
    </div>

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
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
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
          ? visibleRows.map(t=>
              <button
                className="memberRow"
                key={t.id}
                onClick={()=>onOpenTask?.(t)}
                style={{alignItems:'center'}}
              >
                <span className={'statusBadge '+t.status}>
                  {LABEL[t.status]||t.status}
                </span>

                <span style={{minWidth:0}}>
                  <b>{t.title}</b>

                  <small style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                    <span>{t.project?.name||'Personal task'} · {t.code}</span>

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
            )
          : <div className="empty">
              Không có task phù hợp với bộ lọc hiện tại.
            </div>
      }

    </div>

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

  return <section className="page">

    <div className="pageHead">

      <div>

        <h1>
          Teams
        </h1>

        <p>
          Team, Team Lead và Project trong Workspace.
        </p>

      </div>


      {canCreate &&
        <button
          className="primary"
          onClick={onCreate}
        >
          ＋ Tạo Team
        </button>
      }

    </div>


    <div className="projectGrid">

      {teams.map(
        t=>
          <article
            className="projectCard"
            key={t.id}
          >

            <div className="projectIcon">

              {
                (t.code||'T')
                  .slice(0,2)
              }

            </div>


            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
              <h3 style={{margin:0}}>
                {t.name}
              </h3>

              {(membership?.role==='manager' || (membership?.role==='team_lead' && t.lead_id===currentUserId)) &&
                <button
                  type="button"
                  className="secondary compactBtn"
                  onClick={()=>onEdit?.(t)}
                >
                  ✎ Sửa
                </button>
              }
            </div>


            <p>

              {
                t.description
                ||
                'Chưa có mô tả Team.'
              }

            </p>


            <div className="projectFoot">

              <span>

                Lead: {
                  t.lead?.full_name
                  ||
                  'Chưa gán'
                }

              </span>


              <span>

                {
                  projects.filter(
                    p=>
                      p.team_id===t.id
                  ).length
                }

                {' '}Projects

              </span>

            </div>

          </article>
      )}

    </div>

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

  return <section className="page">

    <div className="pageHead">

      <div>

        <h1>
          Members & Permissions
        </h1>

        <p>
          Trưởng phòng quản lý role, team và quyền Workspace.
        </p>

      </div>


      <button
        className="primary"
        onClick={onInvite}
      >
        ＋ Mời thành viên
      </button>

    </div>


    <div className="panel memberTable">

      {members.map(
        m=>
          <button
            className="memberRow"

            key={m.id}

            onClick={()=>
              onOpen(m)
            }
          >

            <Avatar
              p={m.profiles}
            />


            <span>

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
                  m.profiles
                    ?.email
                }

              </small>

            </span>


            <span>

              {
                m.teams?.name
                ||
                '—'
              }

            </span>


            <span className="rolePill">
              {m.role}
            </span>

          </button>
      )}

    </div>

  </section>
}


// =====================================================
// REPORTS
// =====================================================

function Reports({
  projects,
  members,
  teams,
  membership,
  onOpenTask,
  onOpenProject
}){
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('overview')
  const [period,setPeriod]=useState('all')
  const [projectFilter,setProjectFilter]=useState('all')
  const [teamFilter,setTeamFilter]=useState('all')
  const [memberFilter,setMemberFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [quick,setQuick]=useState('all')
  const [searchText,setSearchText]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function load(){
      const ids=(projects||[]).map(p=>p.id)
      if(!ids.length){setRows([]);setLoading(false);return}
      setLoading(true)
      let all=[]
      let from=0
      const size=1000
      while(true){
        const {data,error}=await supabase
          .from('tasks')
          .select('*, profiles!tasks_assignee_id_fkey(full_name,avatar_url,email), project:projects(id,name,code,team_id,lead_id,due_at,status,updated_at)')
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
      if(!cancelled){setRows(all);setLoading(false)}
    }
    load()
    return ()=>{cancelled=true}
  },[JSON.stringify((projects||[]).map(p=>p.id))])

  const now=Date.now()
  const dayMs=86400000
  const isDone=t=>t.status==='done'
  const isActive=t=>['todo','in_progress','review'].includes(t.status)
  const isOverdue=t=>!!t.due_at && !isDone(t) && new Date(t.due_at).getTime()<now
  const isHigh=t=>['urgent','high'].includes(t.priority) && !isDone(t)
  const isOnTime=t=>isDone(t)&&t.due_at&&t.completed_at&&new Date(t.completed_at).getTime()<=new Date(t.due_at).getTime()
  const isLateDone=t=>isDone(t)&&t.due_at&&t.completed_at&&new Date(t.completed_at).getTime()>new Date(t.due_at).getTime()
  const periodDays={d7:7,d30:30,d90:90}[period]
  const cutoff=periodDays?now-periodDays*dayMs:null
  const inPeriod=t=>!cutoff || !isDone(t) || new Date(t.completed_at||t.updated_at||t.created_at||0).getTime()>=cutoff

  const projectMap=new Map((projects||[]).map(p=>[p.id,p]))
  const memberMap=new Map((members||[]).map(m=>[m.user_id,m]))
  const q=searchText.trim().toLowerCase()

  const filtered=rows
    .filter(inPeriod)
    .filter(t=>projectFilter==='all'||t.project_id===projectFilter)
    .filter(t=>memberFilter==='all'||t.assignee_id===memberFilter)
    .filter(t=>statusFilter==='all'||t.status===statusFilter)
    .filter(t=>teamFilter==='all'||(projectMap.get(t.project_id)?.team_id||t.project?.team_id)===teamFilter)
    .filter(t=>quick==='all'||(quick==='overdue'&&isOverdue(t))||(quick==='review'&&t.status==='review')||(quick==='priority'&&isHigh(t))||(quick==='unassigned'&&!t.assignee_id))
    .filter(t=>!q||[t.title,t.code,t.project?.name,t.project?.code,t.profiles?.full_name,t.profiles?.email].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))

  function calcOnTime(list){
    const measured=list.filter(t=>isOnTime(t)||isLateDone(t))
    return measured.length?Math.round(measured.filter(isOnTime).length/measured.length*100):null
  }

  const overall={
    projects:new Set(filtered.map(t=>t.project_id)).size,
    tasks:filtered.length,
    active:filtered.filter(isActive).length,
    overdue:filtered.filter(isOverdue).length,
    review:filtered.filter(t=>t.status==='review').length,
    done:filtered.filter(isDone).length,
    ontime:calcOnTime(filtered)
  }

  function pMetric(p){
    const list=filtered.filter(t=>t.project_id===p.id)
    const total=list.length, done=list.filter(isDone).length, overdue=list.filter(isOverdue).length, review=list.filter(t=>t.status==='review').length
    const progress=total?Math.round(done/total*100):0
    const due=p.due_at?new Date(p.due_at).getTime():null
    const daysLeft=due?Math.ceil((due-now)/dayMs):null
    let health='Healthy'
    if(overdue>=2 || (total&&overdue/total>=.2) || (daysLeft!==null&&daysLeft<=7&&daysLeft>=0&&progress<70)) health='At risk'
    else if(overdue>0 || review>=3 || (daysLeft!==null&&daysLeft<=7&&daysLeft>=0&&progress<85)) health='Watch'
    return {p,list,total,done,active:list.filter(isActive).length,overdue,review,progress,ontime:calcOnTime(list),health,daysLeft}
  }
  const projectMetrics=(projects||[]).map(pMetric).filter(x=>projectFilter==='all'||x.p.id===projectFilter).sort((a,b)=>b.overdue-a.overdue||b.total-a.total)

  function personMetric(m){
    const list=filtered.filter(t=>t.assignee_id===m.user_id)
    const active=list.filter(isActive)
    const activeProjects=new Set(active.map(t=>t.project_id)).size
    const overdue=list.filter(isOverdue).length
    const review=list.filter(t=>t.status==='review').length
    const high=active.filter(isHigh).length
    const inProgress=active.filter(t=>t.status==='in_progress').length
    const score=Math.round((active.length + inProgress + high*2 + overdue*3 + activeProjects*1.5 + review*.5)*10)/10
    const workload=score<=4?'Low':score<=10?'Balanced':score<=16?'High':'Overloaded'
    return {m,list,total:list.length,active:active.length,projects:activeProjects,overdue,review,done:list.filter(isDone).length,ontime:calcOnTime(list),score,workload}
  }
  const peopleMetrics=(members||[]).map(personMetric).filter(x=>memberFilter==='all'||x.m.user_id===memberFilter).sort((a,b)=>b.score-a.score)

  const atRisk=projectMetrics.filter(x=>x.health==='At risk')
  const overloaded=peopleMetrics.filter(x=>x.workload==='Overloaded')
  const underloaded=peopleMetrics.filter(x=>x.workload==='Low'&&x.m.status==='active')
  const reviewLeaders=[...peopleMetrics].sort((a,b)=>b.review-a.review).filter(x=>x.review>0).slice(0,5)
  const topOverdue=[...filtered].filter(isOverdue).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at)).slice(0,20)

  const tabBtn=(key,label)=><button type="button" onClick={()=>setTab(key)} style={{border:'1px solid #e5e7eb',background:tab===key?'#fff3e8':'#fff',color:tab===key?'#b45309':'#374151',borderRadius:999,padding:'8px 12px',fontWeight:800,cursor:'pointer'}}>{label}</button>
  const workloadStyle=w=>({color:w==='Overloaded'?'#b91c1c':w==='High'?'#c2410c':w==='Balanced'?'#166534':'#2563eb',fontWeight:800})
  const healthStyle=h=>({color:h==='At risk'?'#b91c1c':h==='Watch'?'#c2410c':'#166534',fontWeight:800})

  function openProjectMetric(x){ onOpenProject?.(x.p) }
  function openPerson(x){ setMemberFilter(x.m.user_id); setTab('overview') }

  return <section className="page">
    <div className="pageHead"><div><h1>Reports</h1><p>Smart Reports & Workload Intelligence — theo dõi Project, Task, workload và rủi ro theo quyền truy cập hiện tại.</p></div></div>

    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{tabBtn('overview','Overview')}{tabBtn('projects','Projects')}{tabBtn('people','People')}{tabBtn('workload','Workload')}{tabBtn('insights','Insights')}</div>

    <div style={{display:'grid',gridTemplateColumns:'150px 1fr 180px 180px 180px',gap:9,marginBottom:10}}>
      <select value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">Tất cả thời gian</option><option value="d7">7 ngày</option><option value="d30">30 ngày</option><option value="d90">90 ngày</option></select>
      <input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Tìm task, project hoặc nhân sự..."/>
      <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="all">Tất cả Team</option>{(teams||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Tất cả Project</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select value={memberFilter} onChange={e=>setMemberFilter(e.target.value)}><option value="all">Tất cả Member</option>{(members||[]).map(m=><option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email}</option>)}</select>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
      {[['all','Tất cả'],['overdue','Overdue'],['review','Chờ Review'],['priority','High/Urgent'],['unassigned','Chưa assign']].map(([k,l])=><button type="button" key={k} onClick={()=>setQuick(k)} style={{border:'1px solid #e5e7eb',background:quick===k?'#fff3e8':'#fff',borderRadius:999,padding:'7px 11px',fontWeight:700,cursor:'pointer'}}>{l}</button>)}
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{width:160}}><option value="all">Mọi status</option>{STATUS.map(s=><option key={s} value={s}>{LABEL[s]||s}</option>)}</select>
    </div>

    {loading?<div className="panel"><div className="empty">Đang tải dữ liệu báo cáo...</div></div>:<>
      {tab==='overview'&&<>
        <div className="statGrid" style={{gridTemplateColumns:'repeat(7,minmax(120px,1fr))'}}>
          <Stat label="Projects" value={overall.projects}/><Stat label="Tasks" value={overall.tasks}/><Stat label="Active" value={overall.active}/><Stat label="Overdue" value={overall.overdue}/><Stat label="Review" value={overall.review}/><Stat label="Done" value={overall.done}/><Stat label="On-time" value={overall.ontime===null?'—':overall.ontime+'%'}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
          <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Project cần chú ý</h3>{atRisk.length?atRisk.slice(0,6).map(x=><button key={x.p.id} onClick={()=>openProjectMetric(x)} className="memberRow" style={{width:'100%'}}><span><b>{x.p.name}</b><small>{x.overdue} overdue · {x.progress}% hoàn thành</small></span><span style={healthStyle(x.health)}>{x.health}</span></button>):<div className="empty">Chưa có Project At risk.</div>}</div>
          <div className="panel" style={{padding:16}}><h3 style={{marginTop:0}}>Workload cần cân bằng</h3>{[...overloaded,...underloaded].slice(0,6).map(x=><button key={x.m.user_id} onClick={()=>openPerson(x)} className="memberRow" style={{width:'100%'}}><span><b>{x.m.profiles?.full_name||x.m.profiles?.email}</b><small>{x.projects} Project · {x.active} task active · {x.overdue} overdue</small></span><span style={workloadStyle(x.workload)}>{x.workload}</span></button>)}</div>
        </div>
        <div className="panel" style={{marginTop:14}}><h3 style={{padding:'14px 16px 0'}}>Task cần can thiệp</h3>{topOverdue.length?topOverdue.map(t=><button key={t.id} className="memberRow" style={{width:'100%'}} onClick={()=>onOpenTask?.(t)}><span className={'statusBadge '+t.status}>{LABEL[t.status]||t.status}</span><span style={{minWidth:0}}><b>{t.title}</b><small>{t.project?.name||projectMap.get(t.project_id)?.name} · {t.profiles?.full_name||'Chưa assign'}</small></span><span style={{textAlign:'right',color:'#b91c1c',fontWeight:800}}>Trễ {Math.max(1,Math.ceil((now-new Date(t.due_at).getTime())/dayMs))} ngày</span></button>):<div className="empty">Không có task overdue trong bộ lọc hiện tại.</div>}</div>
      </>}

      {tab==='projects'&&<div className="panel" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}><thead><tr>{['Project','Tổng task','Active','Done','Review','Overdue','Progress','On-time','Health'].map(h=><th key={h} style={{textAlign:'left',padding:12,borderBottom:'1px solid #eceff3'}}>{h}</th>)}</tr></thead><tbody>{projectMetrics.map(x=><tr key={x.p.id} onClick={()=>openProjectMetric(x)} style={{cursor:'pointer'}}><td style={{padding:12,borderBottom:'1px solid #f0f2f4'}}><b>{x.p.name}</b><small style={{display:'block'}}>{x.p.code}</small></td><td>{x.total}</td><td>{x.active}</td><td>{x.done}</td><td>{x.review}</td><td style={{color:x.overdue?'#b91c1c':undefined,fontWeight:x.overdue?800:400}}>{x.overdue}</td><td>{x.progress}%</td><td>{x.ontime===null?'—':x.ontime+'%'}</td><td style={healthStyle(x.health)}>{x.health}</td></tr>)}</tbody></table></div>}

      {tab==='people'&&<div className="panel" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:950}}><thead><tr>{['Nhân sự','Project đang làm','Task active','Tổng task','Done','Overdue','Review','On-time','Workload'].map(h=><th key={h} style={{textAlign:'left',padding:12,borderBottom:'1px solid #eceff3'}}>{h}</th>)}</tr></thead><tbody>{peopleMetrics.map(x=><tr key={x.m.user_id} onClick={()=>openPerson(x)} style={{cursor:'pointer'}}><td style={{padding:12,borderBottom:'1px solid #f0f2f4'}}><b>{x.m.profiles?.full_name||x.m.profiles?.email}</b><small style={{display:'block'}}>{x.m.teams?.name||''}</small></td><td>{x.projects}</td><td>{x.active}</td><td>{x.total}</td><td>{x.done}</td><td style={{color:x.overdue?'#b91c1c':undefined,fontWeight:x.overdue?800:400}}>{x.overdue}</td><td>{x.review}</td><td>{x.ontime===null?'—':x.ontime+'%'}</td><td style={workloadStyle(x.workload)}>{x.workload} · {x.score}</td></tr>)}</tbody></table></div>}

      {tab==='workload'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>{peopleMetrics.map(x=><article className="projectCard" key={x.m.user_id} onClick={()=>openPerson(x)} style={{cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><h3 style={{margin:'0 0 4px'}}>{x.m.profiles?.full_name||x.m.profiles?.email}</h3><small>{x.m.teams?.name||'Chưa gán Team'}</small></div><b style={workloadStyle(x.workload)}>{x.workload}</b></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14}}><div><small>Project</small><b style={{display:'block',fontSize:20}}>{x.projects}</b></div><div><small>Active</small><b style={{display:'block',fontSize:20}}>{x.active}</b></div><div><small>Overdue</small><b style={{display:'block',fontSize:20,color:x.overdue?'#b91c1c':undefined}}>{x.overdue}</b></div></div><small style={{display:'block',marginTop:12}}>Workload score {x.score} · On-time {x.ontime===null?'chưa đủ dữ liệu':x.ontime+'%'}</small></article>)}</div>}

      {tab==='insights'&&<div className="panel" style={{padding:18}}><h3 style={{marginTop:0}}>Manager Insights</h3><div style={{display:'grid',gap:10}}>
        <div style={{padding:13,border:'1px solid #eceff3',borderRadius:10}}><b>Project rủi ro:</b> {atRisk.length?`${atRisk.length} Project đang ở mức At risk. Ưu tiên kiểm tra ${atRisk.slice(0,3).map(x=>x.p.name).join(', ')}.`:'Chưa có Project nào bị đánh dấu At risk trong bộ lọc hiện tại.'}</div>
        <div style={{padding:13,border:'1px solid #eceff3',borderRadius:10}}><b>Quá tải:</b> {overloaded.length?`${overloaded.length} người có workload Overloaded: ${overloaded.slice(0,5).map(x=>x.m.profiles?.full_name||x.m.profiles?.email).join(', ')}.`:'Chưa có người ở mức Overloaded.'}</div>
        <div style={{padding:13,border:'1px solid #eceff3',borderRadius:10}}><b>Có thể nhận thêm việc:</b> {underloaded.length?`${underloaded.length} người đang ở mức Low: ${underloaded.slice(0,5).map(x=>x.m.profiles?.full_name||x.m.profiles?.email).join(', ')}.`:'Không có member active ở mức Low trong bộ lọc hiện tại.'}</div>
        <div style={{padding:13,border:'1px solid #eceff3',borderRadius:10}}><b>Review backlog:</b> {overall.review?`${overall.review} task đang chờ Review.${reviewLeaders.length?' Người đang có nhiều task review: '+reviewLeaders.map(x=>`${x.m.profiles?.full_name||x.m.profiles?.email} (${x.review})`).join(', ')+'.':''}`:'Không có task chờ Review.'}</div>
        <div style={{padding:13,border:'1px solid #eceff3',borderRadius:10}}><b>Đúng hạn:</b> {overall.ontime===null?'Chưa đủ dữ liệu completed_at + deadline để tính tỷ lệ đúng hạn.':`Tỷ lệ hoàn thành đúng hạn hiện tại là ${overall.ontime}%.`}</div>
        <small style={{color:'#7b8491'}}>Workload là chỉ số hỗ trợ điều phối, không phải điểm đánh giá nhân sự. Score hiện tính theo task active, in-progress, priority cao, overdue, review và số Project đang tham gia.</small>
      </div></div>}
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

      </div>

    </aside>

  </div>
}


// =====================================================
// MOBILE / FULL TASK CREATE DRAWER
// =====================================================
function TaskCreateDrawer({project,members,onClose,onCreate}){
  const [form,setForm]=useState({
    title:'',description:'',assignee_id:'',due_at:'',priority:'medium',delivery_url:''
  })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')

  async function submit(e){
    e?.preventDefault?.()
    if(!form.title.trim()){
      setError('Vui lòng nhập tên Task.')
      return
    }
    setSaving(true); setError('')
    const result=await onCreate?.(form)
    setSaving(false)
    if(!result?.ok){
      setError(result?.error||'Không tạo được Task.')
    }
  }

  return <div className="drawerWrap mobileTaskCreate" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <aside className="drawer taskCreateDrawer">
      <div className="drawerHead">
        <div><small>{project?.code}</small><h2 style={{margin:0}}>Tạo Task mới</h2></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <form className="drawerBody taskCreateBody" onSubmit={submit}>
        <Field label="Tên Task *">
          <input autoFocus className="fullInput" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ví dụ: Thiết kế KV Open Day" />
        </Field>
        <Field label="Mô tả / đầu ra cần bàn giao">
          <textarea rows="5" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mô tả rõ yêu cầu, đầu ra, lưu ý..." />
        </Field>
        <Field label="Người phụ trách">
          <SmartMemberPicker members={members||[]} value={form.assignee_id} onChange={id=>setForm({...form,assignee_id:id})} placeholder="Gõ tên, email, Team hoặc role..." emptyLabel="— Chưa assign —" />
        </Field>
        <div className="fieldGrid taskCreateGrid">
          <Field label="Deadline"><input type="date" value={form.due_at} onChange={e=>setForm({...form,due_at:e.target.value})}/></Field>
          <Field label="Priority"><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.keys(PRIORITY).map(x=><option key={x} value={x}>{PRIORITY[x]}</option>)}</select></Field>
        </div>
        <Field label="Delivery URL">
          <input className="fullInput" type="url" inputMode="url" value={form.delivery_url} onChange={e=>setForm({...form,delivery_url:e.target.value})} placeholder="https://drive.google.com/..." />
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

            onChange={e=>
              setRole(
                e.target.value
              )
            }
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
        <button className="primary full" disabled={saving} onClick={save}>{saving?'Đang lưu...':'Lưu hồ sơ'}</button>
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
        <button className="primary full" disabled={saving} onClick={save}>{saving?'Đang lưu...':'Lưu Team'}</button>
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
    if(!x)return null
    if(/^https?:\/\//i.test(x))return x
    return 'https://'+x
  }

  async function save(){
    if(!form.name.trim()){setError('Vui lòng nhập tên Project');return}
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
      const {data:{user}}=await supabase.auth.getUser()
      const {error:metaErr}=await supabase.from('project_files').insert({
        project_id:project.id,
        file_name:file.name,
        storage_path:path,
        file_size:file.size,
        mime_type:file.type||null,
        uploaded_by:user?.id||null
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
    const {error}=await supabase.from('project_files').delete().eq('id',row.id)
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
