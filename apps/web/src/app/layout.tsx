import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/layout/header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: {
    default: "OWOC — Đọc Truyện Tranh Online",
    template: "%s | OWOC",
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
      <body className="min-h-full bg-[#0a0a0a] font-sans text-white antialiased">
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <Header />
              <main className="flex-1">{children}</main>
              {/* Footer */}
              <footer className="border-t border-white/5 bg-[#0a0a0a]">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">O</div>
                      <span className="text-sm text-zinc-500">OW<span className="text-zinc-400">OC</span></span>
                    </div>
                    <p className="text-xs text-zinc-600">© 2026 OWOC. Hỗ trợ tác giả Việt Nam 🇻🇳</p>
                  </div>
                </div>
              </footer>
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
