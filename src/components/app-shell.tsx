"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Blocks, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { analyticsApps } from "@/lib/apps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink)]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-4 transition-transform lg:translate-x-0", open && "translate-x-0")}>
        <div className="flex h-11 items-center gap-3 px-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white shadow-sm"><Image src="/logo.svg" alt="" width={20} height={20} unoptimized className="size-5" /></span>
          <div><div className="text-sm font-semibold tracking-tight">Henri Analytics</div><div className="text-[10px] font-medium uppercase tracking-[.16em] text-[var(--subtle)]">Workspace</div></div>
        </div>
        <nav className="mt-7 flex-1" aria-label="主导航">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--subtle)]">总览</p>
          <Link href="/" onClick={() => setOpen(false)} className={cn("mt-2 flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-[var(--secondary)]", pathname === "/" && "bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgb(15_23_42/.05)]")}><Blocks size={17} />应用</Link>
          <p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--subtle)]">应用分析</p>
          {analyticsApps.map((app) => <Link key={app.slug} href={app.slug} onClick={() => setOpen(false)} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-[var(--secondary)]", pathname.startsWith(app.slug) && "bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgb(15_23_42/.05)]")}>{app.logoSrc ? <Image src={app.logoSrc} alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-[5px]" /> : <app.icon size={17} />}{app.name}</Link>)}
        </nav>
        <div className="rounded-xl border border-[var(--border)] bg-white/65 p-3 text-xs leading-5 text-[var(--secondary)]">分析应用会在这里逐步加入，数据与页面按应用隔离。</div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" aria-label="关闭导航" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--canvas)_88%,transparent)] px-4 backdrop-blur-xl sm:px-7">
          <Button variant="ghost" size="icon" className="mr-2 lg:hidden" aria-label="打开导航" onClick={() => setOpen(true)}><Menu size={19} /></Button>
          <div className="hidden items-center gap-2 text-sm text-[var(--subtle)] sm:flex"><Search size={16} /><span>统一查看 Henri 产品数据</span></div>
          <div className="ml-auto">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><button className="flex items-center gap-2 rounded-full p-1.5 pr-2 text-left hover:bg-white"><Avatar.Root className="grid size-8 place-items-center rounded-full bg-[#dce8e0]"><Avatar.Fallback className="text-xs font-semibold text-[#315b47]">H</Avatar.Fallback></Avatar.Root><span className="hidden text-sm font-medium sm:block">Henri</span><ChevronDown size={14} className="text-[var(--subtle)]" /></button></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-48 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-xl"><DropdownMenu.Label className="px-2 py-1.5 text-xs text-[var(--subtle)]">Henri 统一身份</DropdownMenu.Label><DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" /><DropdownMenu.Item asChild><a href="/api/auth/logout" className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-[var(--muted)]"><LogOut size={15} />退出登录</a></DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  );
}
