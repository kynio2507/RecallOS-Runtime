import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallOS Runtime Command Center",
  description: "Dark-mode AI infrastructure dashboard for RecallOS memory, CodeGraph, project brain, knowledge base, ForgeBase9, and context packs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full">
        <Sidebar />
        <main className="relative z-10 min-h-screen px-4 py-5 md:px-7 lg:ml-[264px]">
          <div className="mx-auto max-w-[1800px] space-y-6">
            <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="status-dot green" />
                <div>
                  <div className="text-sm font-bold text-slate-100">Runtime online</div>
                  <div className="kicker">localhost:3303 · PostgreSQL · SQLite · CodeGraph</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge green">7 modules</span>
                <span className="badge blue">68 tools</span>
                <span className="badge violet">dark ops UI</span>
              </div>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
