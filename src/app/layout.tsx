import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "パッと見通学",
  description: "北海道情報大学の学生向け通学・時刻表サポートアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className={`${inter.className} h-full flex flex-col`}>
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
