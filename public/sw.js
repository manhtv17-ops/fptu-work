const DEFAULT_TITLE='FPTU MKT Work'
const DEFAULT_BODY='Bạn có cập nhật mới.'

self.addEventListener('install',()=>{
  self.skipWaiting()
})

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push',event=>{
  let data={}

  try{
    data=event.data
      ? event.data.json()
      : {}
  }catch{
    data={
      body:event.data
        ? event.data.text()
        : DEFAULT_BODY
    }
  }

  const options={
    body:data.body||DEFAULT_BODY,
    icon:'/icons/icon-192.png',
    badge:'/icons/badge-96.png',
    tag:data.tag||undefined,
    renotify:true,
    data:{
      url:data.url||'/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title||DEFAULT_TITLE,
      options
    )
  )
})

self.addEventListener('notificationclick',event=>{
  event.notification.close()

  const targetUrl=
    new URL(
      event.notification.data?.url||'/',
      self.location.origin
    ).href

  event.waitUntil(
    self.clients
      .matchAll({
        type:'window',
        includeUncontrolled:true
      })
      .then(async clientList=>{
        for(const client of clientList){
          if('navigate' in client){
            await client.navigate(targetUrl)
          }

          if('focus' in client){
            return client.focus()
          }
        }

        if(self.clients.openWindow){
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
