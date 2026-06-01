import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, accent = "blue", actions }: { eyebrow?: string; title: string; description?: string; accent?: "blue" | "violet" | "cyan" | "green" | "amber"; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-3">
      <div className="min-w-0">
        {eyebrow && <div className="kicker mb-1 text-white/55">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-white/58 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  );
}

export function DataCard({ children, className = "", glow = false, title, subtitle, accent }: { children: ReactNode; className?: string; glow?: boolean; title?: string; subtitle?: string; accent?: "blue" | "violet" | "cyan" | "green" | "amber" }) {
  const accentLine: Record<string, string> = { blue: "from-blue-500/40", violet: "from-violet-500/40", cyan: "from-cyan-500/40", green: "from-emerald-500/40", amber: "from-amber-500/40" };
  return (
    <div className={`data-card animate-fade-up ${glow ? "border-blue-400/18 shadow-[0_0_32px_rgba(59,130,246,.08)]" : ""} ${className}`}>
      {accent && <div className={`absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b ${accentLine[accent] || ""} to-transparent`} />}
      {(title || subtitle) && (
        <div className="mb-3 border-b border-white/[0.07] pb-3">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-white/52">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function MetricTile({ label, value, tone = "blue", detail }: { label: string; value: ReactNode; tone?: "blue" | "violet" | "cyan" | "green" | "amber" | "rose"; detail?: ReactNode }) {
  const colors: Record<string, { border: string; text: string; glow: string }> = {
    blue: { border: "border-blue-500/15", text: "text-blue-400", glow: "glow-blue" },
    violet: { border: "border-violet-500/15", text: "text-violet-400", glow: "glow-violet" },
    cyan: { border: "border-cyan-500/15", text: "text-cyan-400", glow: "glow-cyan" },
    green: { border: "border-emerald-500/15", text: "text-emerald-400", glow: "glow-emerald" },
    amber: { border: "border-amber-500/15", text: "text-amber-400", glow: "" },
    rose: { border: "border-rose-500/15", text: "text-rose-400", glow: "" },
  };
  const c = colors[tone] || colors.blue;
  return (
    <div className={`glass animate-fade-up rounded-xl p-4 ${c.border}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.09em] text-white/50">{label}</div>
      <div className={`metric-value mt-2 text-2xl font-semibold leading-none tracking-tight ${c.text} ${c.glow}`}>{value}</div>
      {detail && <div className="mt-2 text-xs text-white/42">{detail}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="h-3.5 w-[2px] rounded-full bg-gradient-to-b from-blue-400 to-violet-500 opacity-70" />
      <div>
        <h2 className="text-sm font-semibold leading-none text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  );
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "yellow" | "amber" | "red" | "gray" | "violet" | "cyan" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function EmptyState({ icon = "◇", title, description }: { icon?: string; title: string; description: string }) {
  return (
    <div className="data-card flex min-h-[140px] items-center justify-center text-center">
      <div>
        <div className="text-3xl text-blue-300/50">{icon}</div>
        <h3 className="mt-3 text-base font-semibold text-slate-100">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-300">{description}</p>
      </div>
    </div>
  );
}

export function CommandBar({ children }: { children: ReactNode }) {
  return <div className="glass-panel p-3">{children}</div>;
}
