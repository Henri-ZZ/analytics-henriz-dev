import type { Metadata } from "next";
import Image from "next/image";
import { UninstallExplorer } from "@/components/edit-page/uninstall-explorer";
import {
  FAST_UNINSTALL_LABEL,
  FAST_UNINSTALL_SECONDS,
} from "@/lib/edit-page-display";
import { displayDate } from "@/lib/timezone";

export const metadata: Metadata = { title: "卸载分析" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export default function EditPageUninstall() {
  // 注意：这一页的日轴是服务端瞬时刻（firstSeenAt / uninstalledAt）换算到 UTC+8 后的自然日，
  // 和事件页、分布页那套「UsageDaily.date 的 UTC 日历日」不是同一个东西，所以默认区间按 UTC+8 的今天算。
  const now = Date.now();
  const end = displayDate(now);
  const start = displayDate(now - 6 * DAY_MS);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Image
          src="/edit-page-logo.svg"
          alt=""
          width={20}
          height={20}
          unoptimized
          className="size-5 shrink-0 rounded-md"
        />
        <p className="text-sm font-medium text-[var(--accent-ink)]">
          Edit Page
        </p>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">
        卸载分析
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--secondary)]">
        看有多少人装完马上就走：每日新增安装与卸载的对比、卸载前的存活时长，以及某一天卸载掉的具体安装。
      </p>

      <div className="mt-4 max-w-3xl rounded-xl border border-[var(--border)] bg-white/70 px-4 py-3">
        <p className="text-xs font-medium text-[var(--ink)]">口径说明</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--subtle)]">
          <li>
            · 安装后{" "}
            <span className="tabular-nums text-[var(--ink)]">
              {FAST_UNINSTALL_SECONDS / 60} 分钟内
            </span>
            卸载，即记为
            <span className="ml-1 font-medium text-red-600">
              {FAST_UNINSTALL_LABEL}
            </span>
          </li>
          <li>
            · 新增与卸载各按自己的时刻归日（新增看安装时刻，卸载看卸载时刻）；
            所以
            <span className="text-[var(--ink)]">
              某一天的卸载可能来自几天前安装的那些安装
            </span>
          </li>
          <li>
            · 「新增安装」只记录安装本身，不管之后有没有卸载，都不会从新增里扣掉
          </li>
          <li>
            · 「卸载」包含其中的快速卸载——
            <span className="text-[var(--ink)]">快速卸载是卸载的子集</span>
          </li>
          <li>
            ·
            卸载信号是尽力而为的——离线卸载（扩展已删、无从重试）观测不到，所以卸载数是下限
          </li>
        </ul>
      </div>

      <UninstallExplorer defaultStart={start} defaultEnd={end} />
    </div>
  );
}
