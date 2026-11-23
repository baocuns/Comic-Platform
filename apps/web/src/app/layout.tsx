import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Lora } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { SocketProvider } from '@/components/providers/socket-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SearchModal } from '@/components/layout/search-modal';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: {
    default: 'OWOC — Đọc Truyện Tranh Bản Quyền & Tu Luyện',
    template: '%s | OWOC',
  },
  description:
    'Nền tảng đọc truyện tranh bản quyền với không gian Warm Editorial dịu mắt, hỗ trợ tác giả Việt Nam và hệ thống Tu Luyện tương tác.',
  icons: {
    icon: '/img/aaa_logo.png',
    shortcut: '/img/aaa_logo.png',
    apple: '/img/aaa_logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${lora.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'light';if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] antialiased">
        <ErrorBoundary>
          <QueryProvider>
            <ToastProvider>
              <ThemeProvider>
                <AuthProvider>
                  <SocketProvider>
                    <Header />
                    <SearchModal />
                    <main className="flex-1">{children}</main>
                    <Footer />
                    <MobileBottomNav />
                  </SocketProvider>
                </AuthProvider>
              </ThemeProvider>
            </ToastProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
