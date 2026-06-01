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
        <main className="relative z-10 h-screen overflow-hidden px-4 py-3 lg:ml-[220px]">
          <div className="mx-auto h-full max-w-[1600px] overflow-y-auto pr-1 scroll-area">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
