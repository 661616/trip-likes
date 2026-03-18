/**
 * Sidebar - 全局侧边导航栏
 *
 * 功能：主导航 + 底部设置/主题切换
 * 交互：当前页高亮；主题按钮切换亮暗
 *
 * 业务规则：「评论生成」不是独立入口，生成从帖子管理页发起，
 * 因此侧边栏不放生成项，避免歧义。
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutList,
  BarChart3,
  Settings,
  Sun,
  Moon,
  MessageSquareText,
} from "lucide-react";
import { useTheme } from "@/app/providers";

const NAV_ITEMS = [
  { href: "/posts", label: "帖子管理", icon: LayoutList, desc: "录入与管理帖子" },
  { href: "/evaluation", label: "评估结果", icon: BarChart3, desc: "查看多Agent评分" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <MessageSquareText className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight">评论生成系统</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-0.5 border-t border-border p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          系统设置
        </Link>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "切换亮色" : "切换暗色"}
        </button>
      </div>
    </aside>
  );
}
