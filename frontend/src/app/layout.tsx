/**
 * RootLayout - 全局布局
 *
 * 功能：提供侧边导航栏 + 主内容区域 + TanStack Query Provider
 * 数据流：无服务端数据，纯 UI 壳
 */

import "@/styles/globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "社交媒体评论生成与评估系统",
  description: "Social Comment Generation & Evaluation System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden bg-background text-foreground">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
