import './globals.css'
import { Roboto } from 'next/font/google'

const roboto = Roboto({ subsets: ['latin','vietnamese'], weight: ['400','500','700'] })

export const metadata = { title: 'FPTU Work', description: 'Project Management Workspace' }

export default function RootLayout({ children }) {
  return <html lang="vi"><body className={roboto.className}>{children}</body></html>
}
