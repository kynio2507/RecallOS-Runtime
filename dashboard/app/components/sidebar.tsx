"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/project-brain", label: "Project Brain", icon: "◈" },
  { href: "/memory", label: "Memory", icon: "◇" },
  { href: "/codegraph", label: "CodeGraph", icon: "⬡" },
  { href: "/knowledge-base", label: "Knowledge Base", icon: "▣" },
  { href: "/context-pack", label: "Context Pack", icon: "◆" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 h-full w-[240px] bg-[var(--surface)] border-r border-[var(--border-color)] flex flex-col z-50">
      <div className="p-5 border-b border-[var(--border-color)]">
        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          RecallOS
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">Runtime Dashboard</p>
      </div>
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="status-dot green" />
          <span>6 modules · 41 tools</span>
        </div>
      </div>
    </aside>
  );
}
