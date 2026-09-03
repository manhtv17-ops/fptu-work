import './globals.css';

export const metadata = {
  title: 'FPTU Work Manager',
  description: 'Task, project and team management demo'
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
