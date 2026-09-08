export default function manifest(){
  return {
    name:'FPTU MKT Work',
    short_name:'MKT Work',
    description:'Quản lý Project, Task và phối hợp công việc của FPTU MKT.',
    start_url:'/',
    scope:'/',
    display:'standalone',
    orientation:'portrait-primary',
    background_color:'#ffffff',
    theme_color:'#ff6a00',
    categories:['productivity','business'],
    icons:[
      {
        src:'/icons/icon-192.png',
        sizes:'192x192',
        type:'image/png',
        purpose:'any maskable'
      },
      {
        src:'/icons/icon-512.png',
        sizes:'512x512',
        type:'image/png',
        purpose:'any maskable'
      }
    ]
  }
}
