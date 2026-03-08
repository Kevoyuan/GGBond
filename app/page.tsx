'use client';

import dynamic from 'next/dynamic';

const HomePageClient = dynamic(() => import('./HomePageClient'), {
  ssr: false,
  loading: () => (
    <main className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
        <p className="text-sm">Starting workspace…</p>
      </div>
    </main>
  ),
});

export default function Page() {
  return <HomePageClient />;
}
