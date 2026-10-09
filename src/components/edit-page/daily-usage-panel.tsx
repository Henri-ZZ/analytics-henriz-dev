"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { JsonView } from "@/components/edit-page/json-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { DailyUsageRow } from "@/lib/edit-page-types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

type UsageState = { status: "loading" | "ready" | "error"; days: DailyUsageRow[] };

const resolvedUsage = new Map<string, DailyUsageRow[]>();
const pendingUsage = new Map<string, Promise<DailyUsageRow[]>>();

/**
 * 同一个 installationId 共用一个请求。
 * React StrictMode 在开发环境会把 effect 挂载两次，共享同一个 promise 后只会真正发一次请求；
 * 收起再展开也能直接命中缓存，不再发起请求。
 */
function loadUsage(installationId: string): Promise<DailyUsageRow[]> {
  const resolved = resolvedUsage.get(installationId);
  if (resolved) return Promise.resolve(resolved);

  const pending = pendingUsage.get(installationId);
  if (pending) return pending;

  const request = fetch(`/api/edit-page/installations/${installationId}/usage`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { days?: DailyUsageRow[] };
      const days = payload.days ?? [];
      resolvedUsage.set(installationId, days);
      return days;
    })
    .catch((error: unknown) => {
      // 失败不缓存，允许下次展开重试
      resolvedUsage.delete(installationId);
      throw error;
    })
    .finally(() => {
      pendingUsage.delete(installationId);
    });

  pendingUsage.set(installationId, request);
  return request;
}

/** 只要 installationId 就够，所以安装分析、卸载分析的明细表都能复用 */
export function DailyUsagePanel({ installationId }: { installationId: string }) {
  const [activeDay, setActiveDay] = useState<DailyUsageRow | null>(null);
  const [state, setState] = useState<UsageState>(() => {
    const cached = resolvedUsage.get(installationId);
    return cached ? { status: "ready", days: cached } : { status: "loading", days: [] };
  });

  useEffect(() => {
    if (resolvedUsage.has(installationId)) return;

    let active = true;

    loadUsage(installationId)
      .then((days) => {
        if (active) setState({ status: "ready", days });
      })
      .catch(() => {
        if (active) setState({ status: "error", days: [] });
      });

    return () => {
      active = false;
    };
  }, [installationId]);

  return (
    <div className="border-t border-dashed border-[var(--border)] bg-[var(--muted)]/50 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--subtle)]">
        <span className="font-medium text-[var(--secondary)]">每日使用明细 · 近 30 天</span>
        <span className="break-all font-mono">installationId：{installationId}</span>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-6 text-xs text-[var(--subtle)]">
          <Loader2 size={14} className="animate-spin" />
          正在加载每日使用明细…
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-6 text-xs text-rose-700">
          加载失败，请稍后重试。
        </div>
      )}

      {state.status === "ready" && state.days.length === 0 && (
        <div className="rounded-xl border bg-white px-4 py-6 text-xs text-[var(--subtle)]">
          该安装近 30 天没有使用记录。
        </div>
      )}

      {state.status === "ready" && state.days.length > 0 && (
        <div className="max-h-[360px] overflow-y-auto rounded-xl border bg-white">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>编辑</TableHead>
                <TableHead>编辑会话</TableHead>
                <TableHead>打开面板</TableHead>
                <TableHead>图片替换</TableHead>
                <TableHead>总事件</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.days.map((day) => (
                <TableRow key={day.date} className="hover:bg-[var(--muted)]/60">
                  <TableCell className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setActiveDay(day)}
                      title="查看该日原始 events JSON"
                      className="font-medium tabular-nums text-[var(--accent-ink)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
                    >
                      {day.date}
                    </button>
                    <span className="ml-2 text-xs text-[var(--subtle)]">{weekdayOf(day.date)}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatNumber(day.edits)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.editStarts)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.dashboardOpens)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.imageReplaces)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.totalEvents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog.Root open={activeDay !== null} onOpenChange={(open) => !open && setActiveDay(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[var(--border)] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold">原始 events JSON</Dialog.Title>
                <Dialog.Description className="mt-1 break-all text-xs leading-5 text-[var(--subtle)]">
                  {activeDay ? `${activeDay.date} · ${installationId}` : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="关闭"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--subtle)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <JsonView value={activeDay?.events} className="max-h-none" />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
