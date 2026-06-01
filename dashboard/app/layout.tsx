import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallOS Runtime Command Center",
  description: "Dark-mode AI infrastructure dashboard for RecallOS memory, CodeGraph, project brain, knowledge base, Multi Agent registry, retrieval debugger, and context packs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full">
        <Sidebar />
        <main className="relative z-10 min-h-screen px-4 py-4 lg:ml-[220px]">
          <div className="mx-auto max-w-[1600px] space-y-4">
            <header className="glass-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="pulse-dot bg-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Runtime online</div>
                  <div className="text-[10px] text-white/28">localhost:3303 · PostgreSQL · SQLite · CodeGraph</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge green">10 modules</span>
                <span className="badge blue">78 tools</span>
                <span className="badge violet">dark ops</span>
              </div>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
