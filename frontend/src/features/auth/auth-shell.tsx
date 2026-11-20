import Image from 'next/image';

export function AuthShell({ children, eyebrow = 'Home & Lifestyle', title, intro }: { children: React.ReactNode; eyebrow?: string; title: string; intro: string }) {
  return <div className="auth-shell w-full">
    <div className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-[1440px] overflow-hidden border-y border-[var(--hl-border)] bg-[var(--hl-surface)] lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[46%_54%] lg:border-x">
      <aside className="relative hidden min-h-full overflow-hidden lg:block" aria-label="Home and Lifestyle inspiration">
        <Image src="/images/auth-interior.png" alt="A warmly lit living space with a table lamp, ceramics, and greenery" fill priority sizes="(min-width: 1024px) 46vw, 0px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:rgb(20_38_32_/_0.82)] via-[color:rgb(20_38_32_/_0.18)] to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-end p-9 text-white"><span className="rounded-full border border-white/35 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase">Everyday living</span></div>
        <div className="absolute inset-x-0 bottom-0 p-10 text-white"><p className="mb-3 text-xs font-semibold tracking-[0.18em] uppercase text-white/75">Thoughtful spaces</p><h2 className="max-w-sm font-[family-name:var(--font-display)] text-5xl leading-[1.04] tracking-tight">Pieces for the way you live.</h2><p className="mt-5 max-w-sm text-sm leading-6 text-white/80">A considered collection for rooms that feel distinctly yours.</p></div>
      </aside>
      <section className="flex min-w-0 items-start justify-center px-5 py-9 sm:px-8 sm:py-12 lg:items-center lg:px-12 xl:px-20" aria-labelledby="auth-title">
        <div className="w-full max-w-[28rem]">
          <p className="mb-4 text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--hl-accent)]">{eyebrow}</p>
          <h1 id="auth-title" className="m-0 font-[family-name:var(--font-display)] text-4xl leading-[1.06] tracking-tight text-[var(--hl-ink)] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-[var(--hl-muted)]">{intro}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  </div>;
}
