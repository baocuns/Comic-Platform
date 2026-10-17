'use client';

import { usePathname } from 'next/navigation';

export function Footer() {
    const pathname = usePathname();

    if (pathname?.startsWith('/studio')) {
        return null;
    }

    return (
        // bg-gradient-to-t from-amber-300/40 via-amber-100/10 to-background dark:from-amber-700/20 dark:via-green-700/5 dark:to-background
        <footer className="pt-12">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/img/owoc_banner_black.png" className="h-36 w-auto dark:hidden" alt="Owoc Logo" />
                        <img src="/img/owoc_banner_white.png" className="h-36 w-auto hidden dark:block" alt="Owoc Logo" />
                    </div>
                    <p className="text-sm text-zinc-600">© 2026 OWOC. One word one civilization!</p>
                </div>
            </div>
        </footer>
    );
}
