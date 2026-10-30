import type { Metadata } from "next";
import { Be_Vietnam_Pro, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SearchModal } from "@/components/layout/search-modal";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SocketProvider } from "@/components/providers/socket-provider";

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const displayFont = Nunito({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OWOC — Đọc Truyện Tranh Online",
    template: "%s | OWOC",
  },
  icons: {
    icon: "/img/aaa_logo.png",
    shortcut: "/img/aaa_logo.png",
    apple: "/img/aaa_logo.png",
  },
  description: "Nền tảng đọc truyện tranh online miễn phí, hỗ trợ tác giả Việt Nam. Đọc Manga, Manhwa, Manhua, Webtoon chất lượng cao.",
  keywords: ["truyện tranh", "manga", "manhwa", "webtoon", "đọc truyện", "comic", "online"],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "OWOC",
    title: "OWOC — Đọc Truyện Tranh Online",
    description: "Nền tảng đọc truyện tranh online miễn phí, hỗ trợ tác giả Việt Nam.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${bodyFont.variable} ${displayFont.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || 'light';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <link
          rel="stylesheet"
          href="/css/font-awesome/css/all.css"
        />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <ErrorBoundary>
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <SocketProvider>
                  <Header />
                  <SearchModal />
                  <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
                  <Footer />
                </SocketProvider>
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
