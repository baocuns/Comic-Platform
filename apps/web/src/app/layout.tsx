import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/layout/header";
import { SearchModal } from "@/components/layout/search-modal";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: {
    default: "OWOC — Đọc Truyện Tranh Online",
    template: "%s | OWOC",
  },
  icons: {
    icon: "/aaa_logo.png",
    shortcut: "/aaa_logo.png",
    apple: "/aaa_logo.png",
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
    <html lang="vi" className={`${inter.variable} h-full`}>
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
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/fontawesome.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/sharp-solid.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/sharp-regular.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/sharp-light.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/duotone.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/solid.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/regular.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/light.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rizmyabdulla/fontawesome-pro@main/releases/v7.2.0/css/brands.css"
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased transition-colors duration-300">
        <ErrorBoundary>
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <Header />
                <SearchModal />
                <main className="flex-1">{children}</main>
                {/* Footer */}
                <footer className="bg-gradient-to-t from-green-300/40 via-green-100/10 to-background dark:from-green-700/20 dark:via-green-700/5 dark:to-background pt-12">
                  <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/owoc_banner_black.png" className="h-36 w-auto dark:hidden" alt="Owoc Logo" />
                        <img src="/owoc_banner_white.png" className="h-36 w-auto hidden dark:block" alt="Owoc Logo" />
                      </div>
                      <p className="text-sm text-zinc-600">© 2026 OWOC. One word one civilization!</p>
                    </div>
                  </div>
                </footer>
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
