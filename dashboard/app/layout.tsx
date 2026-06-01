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
        <main className="relative z-10 min-h-screen ml-[220px] w-[calc(100%-220px)] px-4 py-4">
          <div className="mx-auto max-w-[1600px] space-y-4">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
