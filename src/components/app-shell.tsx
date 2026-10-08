"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Blocks,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { analyticsApps } from "@/lib/apps";
import { cn } from "@/lib/utils";
import { DISPLAY_TIME_ZONE_LABEL } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // 移动端抽屉
  const [open, setOpen] = useState(false);
  // 桌面端收起成图标窄栏
  const [collapsed, setCollapsed] = useState(false);
  // 二级菜单展开状态：用户手动切换过就以其为准，否则跟随当前路由（在当前应用下即展开）
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});

  const isGroupOpen = (slug: string) => groupOverrides[slug] ?? pathname.startsWith(slug);
  const toggleGroup = (slug: string) =>
    setGroupOverrides((prev) => ({ ...prev, [slug]: !(prev[slug] ?? pathname.startsWith(slug)) }));

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-4 transition-[transform,width] duration-200 lg:translate-x-0",
          collapsed && "lg:w-[68px]",
          open && "translate-x-0",
        )}
      >
        <div className={cn("flex h-11 items-center gap-3 px-3", collapsed && "lg:justify-center lg:px-0")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white shadow-sm">
            <Image src="/logo.svg" alt="" width={20} height={20} unoptimized className="size-5" />
          </span>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <div className="text-sm font-semibold tracking-tight">Henri Analytics</div>
            <div className="text-[10px] font-medium uppercase tracking-[.16em] text-[var(--subtle)]">Workspace</div>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-6" aria-label="主导航">
          <div>
            <p
              className={cn(
                "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--subtle)]",
                collapsed && "lg:hidden",
              )}
            >
              总览
            </p>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              title="应用"
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-[var(--secondary)]",
                pathname === "/" && "bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgb(15_23_42/.05)]",
                collapsed && "lg:justify-center lg:px-0",
              )}
            >
              <Blocks size={17} className="shrink-0" />
              <span className={cn(collapsed && "lg:hidden")}>应用</span>
            </Link>
          </div>

          <div>
            <p
              className={cn(
                "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--subtle)]",
                collapsed && "lg:hidden",
              )}
            >
              应用分析
            </p>
            {analyticsApps.map((app) => {
              const groupOpen = isGroupOpen(app.slug);
              const appActive = pathname.startsWith(app.slug);
              const hasChildren = Boolean(app.children?.length);

              const inner = (
                <>
                  {app.logoSrc ? (
                    <Image
                      src={app.logoSrc}
                      alt=""
                      width={20}
                      height={20}
                      unoptimized
                      className="size-5 shrink-0 rounded-[5px]"
                    />
                  ) : (
                    <app.icon size={17} className="shrink-0" />
                  )}
                  <span className={cn("truncate", collapsed && "lg:hidden")}>{app.name}</span>
                  {hasChildren && (
                    <ChevronRight
                      size={15}
                      className={cn(
                        "ml-auto shrink-0 transition-transform duration-200",
                        groupOpen && "rotate-90",
                        collapsed && "lg:hidden",
                      )}
                    />
                  )}
                </>
              );

              return (
                <div key={app.slug} className="mt-2">
                  <button
                    type="button"
                    title={app.name}
                    aria-expanded={hasChildren ? groupOpen : undefined}
                    onClick={() => {
                      // 收起成窄栏时没有二级菜单可展开，直接进入该应用
                      if (collapsed || !hasChildren) {
                        setOpen(false);
                        router.push(app.slug);
                        return;
                      }
                      toggleGroup(app.slug);
                    }}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--secondary)] transition-colors hover:bg-white/60",
                      appActive && "text-[var(--ink)]",
                      collapsed && "lg:justify-center lg:px-0",
                      collapsed && appActive && "lg:bg-white lg:shadow-[0_1px_2px_rgb(15_23_42/.05)]",
                    )}
                  >
                    {inner}
                  </button>

                  {hasChildren && (
                    <div className={cn("mt-1 space-y-1", !groupOpen && "hidden", collapsed && "lg:hidden")}>
                      {app.children?.map((child) => (
                        <Link
                          key={child.slug}
                          href={child.slug}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex h-9 items-center rounded-lg pl-11 pr-3 text-sm text-[var(--secondary)] transition-colors hover:bg-white/60",
                            (pathname === child.slug || pathname.startsWith(`${child.slug}/`)) &&
                              "bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgb(15_23_42/.05)]",
                          )}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <Button
          variant="outline"
          className={cn("hidden w-full lg:inline-flex", !collapsed && "lg:justify-start", collapsed && "lg:px-0")}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          <span className={cn(collapsed && "lg:hidden")}>收起侧边栏</span>
        </Button>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={cn("transition-[padding] duration-200 lg:pl-64", collapsed && "lg:pl-[68px]")}>
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--canvas)_88%,transparent)] px-4 backdrop-blur-xl sm:px-7">
          <Button variant="ghost" size="icon" className="mr-2 lg:hidden" aria-label="打开导航" onClick={() => setOpen(true)}>
            <Menu size={19} />
          </Button>
          <div className="hidden items-center gap-2 text-sm text-[var(--subtle)] sm:flex">
            <Search size={16} />
            <span>统一查看 Henri 产品数据</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              title="站内时间统一按 UTC+8（上海）展示；数据库里存的是 UTC"
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--secondary)]"
            >
              {DISPLAY_TIME_ZONE_LABEL}
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1.5 pr-2 text-left hover:bg-white">
                  <Avatar.Root className="grid size-8 place-items-center rounded-full bg-[var(--accent-soft)]">
                    <Avatar.Fallback className="text-xs font-semibold text-[var(--accent-ink)]">H</Avatar.Fallback>
                  </Avatar.Root>
                  <span className="hidden text-sm font-medium sm:block">Henri</span>
                  <ChevronDown size={14} className="text-[var(--subtle)]" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-48 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-xl"
                >
                  <DropdownMenu.Label className="px-2 py-1.5 text-xs text-[var(--subtle)]">
                    Henri 统一身份
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                  <DropdownMenu.Item asChild>
                    <a
                      href="/api/auth/logout"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-[var(--muted)]"
                    >
                      <LogOut size={15} />
                      退出登录
                    </a>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1536px] px-4 py-8 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
