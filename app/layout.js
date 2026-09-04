import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({ subsets: ['latin', 'vietnamese'], weight: ['400','500','700'], display: 'swap' });

export const metadata = { title: 'FPTU Work', description: 'Task & Project Management for FPTU HCM Marketing' };

export default function RootLayout({ children }) {
  return <html lang="vi"><body className={roboto.className}>{children}</body></html>;
}
