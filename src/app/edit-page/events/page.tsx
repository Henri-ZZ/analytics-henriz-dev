import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListTree } from "lucide-react";
import { EventExplorer } from "@/components/edit-page/event-explorer";
import { buttonVariants } from "@/components/ui/button";
import { displayDate } from "@/lib/timezone";

export const metadata: Metadata = { title: "事件分析" };
// 「今天」跟随当前时刻，不能把这个页面当成静态页在构建时把日期烤死
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export default function EditPageEvents() {
  // 「今天」按展示时区（UTC+8）算：按 UTC 算的话，北京时间 0:00–8:00 会判成昨天，
  // 日期选择器就把今天禁掉了（选不到今天）。数据轴仍是 UsageDaily.date 的 UTC 日历日。
  const now = Date.now();
  const defaultEnd = displayDate(now);
  const defaultStart = displayDate(now - 6 * DAY_MS);

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/edit-page-logo.svg" alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-md" />
            <p className="text-sm font-medium text-[var(--accent-ink)]">Edit Page</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">事件分析</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--secondary)]">
            选择要对比的遥测事件与时间范围，查看每天的事件次数走势。
          </p>
        </div>

        <Link href="/edit-page/events/list" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ListTree size={15} />
          事件清单
        </Link>
      </div>

      <EventExplorer defaultStart={defaultStart} defaultEnd={defaultEnd} />
    </div>
  );
}
