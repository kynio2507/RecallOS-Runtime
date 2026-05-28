import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallOS Dashboard",
  description: "Multi-module AI runtime dashboard — 6 modules, 41 tools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 ml-[240px]">
          {children}
        </main>
      </body>
    </html>
  );
}
