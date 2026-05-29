import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, accent = "blue", actions }: { eyebrow: string; title: string; description: string; accent?: "blue" | "violet" | "cyan" | "green" | "amber"; actions?: ReactNode }) {
  const gradient = {
    blue: "from-blue-200 via-cyan-200 to-violet-200",
    violet: "from-violet-200 via-fuchsia-200 to-blue-200",
    cyan: "from-cyan-200 via-blue-200 to-emerald-200",
    green: "from-emerald-200 via-cyan-200 to-blue-200",
    amber: "from-amber-200 via-orange-200 to-rose-200",
  }[accent];
  return (
    <section className="hero-panel p-7 md:p-8">
      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="kicker mb-3">{eyebrow}</div>
          <h1 className={`text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{title}</h1>
          <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-300 leading-7">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function DataCard({ children, className = "", glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return <div className={`data-card ${glow ? "border-blue-400/30 shadow-[0_0_50px_rgba(59,130,246,.12)]" : ""} ${className}`}>{children}</div>;
}

export function MetricTile({ label, value, tone = "blue", detail }: { label: string; value: ReactNode; tone?: "blue" | "violet" | "cyan" | "green" | "amber" | "rose"; detail?: ReactNode }) {
  const colors = {
    blue: "text-blue-300 bg-blue-400/10 border-blue-400/20",
    violet: "text-violet-300 bg-violet-400/10 border-violet-400/20",
    cyan: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    green: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
    amber: "text-amber-300 bg-amber-400/10 border-amber-400/20",
    rose: "text-rose-300 bg-rose-400/10 border-rose-400/20",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${colors}`}>
      <div className="kicker">{label}</div>
      <div className="metric-value mt-2 text-3xl font-black">{value}</div>
      {detail && <div className="mt-2 text-xs text-slate-400">{detail}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold tracking-tight text-slate-100">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}</div><div className="h-px flex-1 bg-gradient-to-r from-blue-400/30 to-transparent" /></div>;
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "yellow" | "amber" | "red" | "gray" | "violet" | "cyan" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function EmptyState({ icon = "◇", title, description }: { icon?: string; title: string; description: string }) {
  return <div className="data-card flex min-h-[220px] items-center justify-center text-center"><div><div className="text-5xl text-blue-300/70">{icon}</div><h3 className="mt-4 font-bold text-slate-200">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{description}</p></div></div>;
}

export function CommandBar({ children }: { children: ReactNode }) {
  return <div className="glass-panel p-3 md:p-4">{children}</div>;
}
