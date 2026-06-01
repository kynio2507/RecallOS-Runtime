"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "◉", group: "Core", tone: "blue" },
  { href: "/project-brain", label: "Project Brain", icon: "✦", group: "Core", tone: "violet" },
  { href: "/memory", label: "Memory", icon: "◇", group: "Intelligence", tone: "green" },
  { href: "/memory-capture", label: "Memory Capture", icon: "✧", group: "Intelligence", tone: "green" },
  { href: "/codegraph", label: "CodeGraph", icon: "⬡", group: "Intelligence", tone: "cyan" },
  { href: "/knowledge-base", label: "Knowledge Base", icon: "▣", group: "Knowledge", tone: "amber" },
  { href: "/context-pack", label: "Context Pack", icon: "◆", group: "Knowledge", tone: "blue" },
  { href: "/retrieval-debugger", label: "Retrieval Debugger", icon: "⌁", group: "Knowledge", tone: "cyan" },
  { href: "/workflows", label: "Workflows", icon: "↯", group: "Agents", tone: "blue" },
  { href: "/forgebase9", label: "Multi Agent", icon: "✦", group: "Agents", tone: "violet" },
];

const toneText: Record<string, string> = {
  blue: "text-blue-400", green: "text-emerald-400", violet: "text-violet-400", cyan: "text-cyan-400", amber: "text-amber-400",
};
const toneActive: Record<string, string> = {
  blue: "from-blue-400", green: "from-emerald-400", violet: "from-violet-400", cyan: "from-cyan-400", amber: "from-amber-400",
};

export function Sidebar() {
  const pathname = usePathname();
  const groups = [...new Set(NAV.map(n => n.group))];
  return (
    <aside
      className="fixed left-0 top-0 z-50 h-full border-r border-white/[0.06] bg-[#070a12]/90 backdrop-blur-2xl flex flex-col"
      style={{ width: 220 }}
    >
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-blue-500/15">R</div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">RecallOS</h1>
            <p className="text-[11px] text-white/38">runtime v1.0</p>
          </div>
        </div>
        <div className="signal-line mt-3 mb-1" />
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {groups.map(group => (
          <div key={group}>
            <div className="kicker px-2.5 pb-1.5">{group}</div>
            <div className="space-y-0.5">
              {NAV.filter(n => n.group === group).map(item => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`group relative flex min-h-[34px] items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${active ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(148,163,184,.14)]" : "text-white/52 hover:bg-white/[0.04] hover:text-white/82"}`}>
                    {active && <span className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-gradient-to-b ${toneActive[item.tone] || "from-blue-400"} to-transparent`} />}
                    <span className={`text-[15px] ${active ? toneText[item.tone] || "text-blue-400" : "text-white/32 group-hover:text-white/62"}`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/35"><span className="pulse-dot bg-emerald-400" />Live</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-md bg-white/[0.04] py-2"><div className="metric-value text-sm font-bold text-blue-300">10</div><div className="text-[10px] text-white/35">modules</div></div>
            <div className="rounded-md bg-white/[0.04] py-2"><div className="metric-value text-sm font-bold text-violet-300">78</div><div className="text-[10px] text-white/35">tools</div></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
