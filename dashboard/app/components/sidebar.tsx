"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "◉", group: "Core", tone: "blue" },
  { href: "/project-brain", label: "Project Brain", icon: "◈", group: "Core", tone: "green" },
  { href: "/memory", label: "Memory", icon: "◇", group: "Intelligence", tone: "violet" },
  { href: "/codegraph", label: "CodeGraph", icon: "⬡", group: "Intelligence", tone: "cyan" },
  { href: "/knowledge-base", label: "Knowledge Base", icon: "▣", group: "Knowledge", tone: "amber" },
  { href: "/context-pack", label: "Context Pack", icon: "◆", group: "Knowledge", tone: "blue" },
  { href: "/forgebase9", label: "Multi Agent", icon: "✦", group: "Agents", tone: "violet" },
];

const toneClass: Record<string, string> = {
  blue: "from-blue-400 to-cyan-300 text-blue-200",
  green: "from-emerald-400 to-cyan-300 text-emerald-200",
  violet: "from-violet-400 to-fuchsia-300 text-violet-200",
  cyan: "from-cyan-400 to-blue-300 text-cyan-200",
  amber: "from-amber-400 to-orange-300 text-amber-200",
};

export function Sidebar() {
  const pathname = usePathname();
  const groups = [...new Set(NAV.map(n => n.group))];
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[264px] border-r border-white/10 bg-[#070a12]/86 backdrop-blur-2xl lg:flex lg:flex-col">
      <div className="p-5">
        <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-4 shadow-[0_0_45px_rgba(59,130,246,.12)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 font-black text-white shadow-lg shadow-blue-500/20">R</div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-100">RecallOS</h1>
              <p className="kicker">runtime command</p>
            </div>
          </div>
          <div className="signal-line my-4" />
          <div className="flex items-center justify-between text-xs text-slate-400"><span>system pulse</span><span className="text-emerald-300">nominal</span></div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map(group => (
          <div key={group}>
            <div className="kicker px-3 pb-2">{group}</div>
            <div className="space-y-1">
              {NAV.filter(n => n.group === group).map(item => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-all ${active ? "bg-white/[0.08] text-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,.14)]" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"}`}>
                    {active && <span className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b ${toneClass[item.tone]}`} />}
                    <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${toneClass[item.tone]} bg-opacity-10 text-base`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-300"><span className="status-dot green" />Live index</div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.04] p-2"><div className="metric-value text-lg font-black text-blue-200">7</div><div className="text-[10px] text-slate-500">modules</div></div>
            <div className="rounded-xl bg-white/[0.04] p-2"><div className="metric-value text-lg font-black text-violet-200">68</div><div className="text-[10px] text-slate-500">tools</div></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
