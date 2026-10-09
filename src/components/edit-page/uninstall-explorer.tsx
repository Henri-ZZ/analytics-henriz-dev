"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronRight, MousePointerClick, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DailyUsagePanel } from "@/components/edit-page/daily-usage-panel";
import { UninstallTrendChart } from "@/components/edit-page/uninstall-trend-chart";
import { FAST_UNINSTALL_LABEL, browserLabel, licenseLabel, localePairLabel, osLabel } from "@/lib/edit-page-display";
import type { UninstallDailyResult, UninstallDetailResult, UninstallDetailRow } from "@/lib/edit-page-types";
import { displayDateTime } from "@/lib/timezone";
import { cn, formatDuration, formatNumber } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  database_not_configured: "尚未配置 EDIT_PAGE_DATABASE_URL",
  invalid_range: "时间范围不合法",
  invalid_date: "日期不合法",
  range_too_long: "时间范围最长 366 天",
  query_failed: "查询失败，请查看服务端日志",
};

/** 明细表的列数（含展开箭头），展开行要用它做 colSpan */
const DETAIL_COLUMN_COUNT = 11;

type TrendState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: UninstallDailyResult };

export function UninstallExplorer({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [state, setState] = useState<TrendState>({ status: "idle" });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<UninstallDetailResult | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  /** 明细表里展开了每日使用明细的行 */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const result = state.status === "ready" ? state.result : null;

  const runQuery = async () => {
    setState({ status: "loading" });
    setSelectedDate(null);
    setDetail(null);
    setDetailError(null);
    setExpanded({});

    try {
      const params = new URLSearchParams({ start, end });
      const response = await fetch(`/api/edit-page/uninstall/daily?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const code = payload?.error ?? `HTTP ${response.status}`;
        throw new Error(ERROR_MESSAGES[code] ?? code);
      }
      setState({ status: "ready", result: (await response.json()) as UninstallDailyResult });
    } catch (cause) {
      setState({ status: "error", message: cause instanceof Error ? cause.message : "未知错误" });
    }
  };

  /**
   * 点击某天 → 按需拉当天明细。
   * 「加载中」是由"选中日 ≠ 已加载的日"推导出来的，不在 effect 里同步 setState，
   * 这样既不会触发 react-hooks 的「effect 内 setState」规则，也不用额外的 loading 状态。
   */
  useEffect(() => {
    if (!selectedDate) return;

    let active = true;
    const controller = new AbortController();

    fetch(`/api/edit-page/uninstall/detail?date=${selectedDate}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          const code = payload?.error ?? `HTTP ${response.status}`;
          throw new Error(ERROR_MESSAGES[code] ?? code);
        }
        return (await response.json()) as UninstallDetailResult;
      })
      .then((payload) => {
        if (active) setDetail(payload);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setDetailError(cause instanceof Error ? cause.message : "未知错误");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDate]);

  const selectDate = (date: string) => {
    if (date === selectedDate) return;
    setDetail(null);
    setDetailError(null);
    setExpanded({});
    setSelectedDate(date);
  };

  const toggleExpanded = (installationId: string) =>
    setExpanded((prev) => ({ ...prev, [installationId]: !prev[installationId] }));

  const detailLoading = selectedDate !== null && detail?.date !== selectedDate && detailError === null;
  const detailRows: UninstallDetailRow[] = detail?.date === selectedDate ? detail.rows : [];

  const totals = (result?.days ?? []).reduce(
    (sum, day) => ({
      installs: sum.installs + day.installs,
      uninstalls: sum.uninstalls + day.uninstalls,
      fastUninstalls: sum.fastUninstalls + day.fastUninstalls,
    }),
    { installs: 0, uninstalls: 0, fastUninstalls: 0 },
  );
  const ratio = totals.installs > 0 ? (totals.uninstalls / totals.installs) * 100 : null;

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">查询条件</h2>
          <p className="mt-0.5 text-xs text-[var(--subtle)]">
            按 UTC+8 的日历日统计服务端收到的安装与卸载时刻；已打过滤标的安装不计入
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--secondary)]">时间范围</span>
            <DateRangePicker
              value={{ start, end }}
              onChange={(next) => {
                setStart(next.start);
                setEnd(next.end);
              }}
              maxDate={defaultEnd}
              presets={[7, 30, 90]}
              defaultRangeDays={7}
            />
          </div>

          <Button onClick={() => runQuery()} disabled={state.status === "loading"}>
            <Search size={15} />
            {state.status === "loading" ? "查询中…" : "查询"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">每日安装与卸载</h2>
            <p className="mt-0.5 text-xs text-[var(--subtle)]">
              {result
                ? `${result.start} ~ ${result.end} · 新增 ${formatNumber(totals.installs)} · 卸载 ${formatNumber(totals.uninstalls)} · ${FAST_UNINSTALL_LABEL} ${formatNumber(totals.fastUninstalls)} · 占比 ${ratio === null ? "—" : `${ratio.toFixed(1)}%`}（占比 = 区间卸载 ÷ 区间新增）`
                : "选好时间范围后点「查询」"}
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          {state.status === "idle" && (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                <MousePointerClick size={22} />
              </span>
              <p className="mt-5 text-sm font-medium">还没有查询结果</p>
              <p className="mt-1.5 max-w-md text-xs leading-5 text-[var(--subtle)]">
                选好时间范围后点「查询」，再点任意一天的柱子查看当天卸载明细。
              </p>
            </div>
          )}

          {state.status === "loading" && (
            <div className="flex min-h-72 items-center justify-center text-sm text-[var(--subtle)]">正在查询…</div>
          )}

          {state.status === "error" && (
            <div className="flex min-h-72 items-center justify-center text-sm text-rose-600">
              查询失败：{state.message}
            </div>
          )}

          {result && (
            <UninstallTrendChart days={result.days} selectedDate={selectedDate} onSelectDate={selectDate} />
          )}
        </div>
      </section>

      {result && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">{selectedDate ? `${selectedDate} 卸载明细` : "当天卸载明细"}</h2>
              <p className="mt-0.5 text-xs text-[var(--subtle)]">
                {selectedDate
                  ? `${formatNumber(detailRows.length)} 条 · 当天全部观测到的卸载（不只快速卸载）· 按存活时长升序，装完马上就走的最靠前；点任意一行展开每日使用明细`
                  : "点击上方柱状图的某一天，查看当天卸载的安装"}
              </p>
            </div>
          </div>

          {selectedDate === null && (
            <div className="flex min-h-32 items-center justify-center px-5 py-6 text-xs text-[var(--subtle)]">
              还没有选中日期。
            </div>
          )}

          {detailLoading && (
            <div className="flex min-h-32 items-center justify-center px-5 py-6 text-xs text-[var(--subtle)]">
              正在加载 {selectedDate} 的卸载明细…
            </div>
          )}

          {detailError && (
            <div className="flex min-h-32 items-center justify-center px-5 py-6 text-xs text-rose-600">
              加载失败：{detailError}
            </div>
          )}

          {selectedDate !== null && !detailLoading && !detailError && detailRows.length === 0 && (
            <div className="flex min-h-32 items-center justify-center px-5 py-6 text-xs text-[var(--subtle)]">
              当天没有观测到卸载。
            </div>
          )}

          {!detailLoading && !detailError && detailRows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>序号</TableHead>
                  <TableHead>存活时长</TableHead>
                  <TableHead>首次上报</TableHead>
                  <TableHead>卸载时间</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>语言</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>授权</TableHead>
                  <TableHead>installationId</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.map((row) => (
                  <Fragment key={row.installationId}>
                    <TableRow
                      onClick={() => toggleExpanded(row.installationId)}
                      className={cn(
                        "cursor-pointer hover:bg-[var(--muted)]/70",
                        expanded[row.installationId] && "bg-[var(--muted)]/40",
                      )}
                    >
                    <TableCell className="w-10">
                      <button
                        type="button"
                        aria-label={expanded[row.installationId] ? "收起每日使用明细" : "展开每日使用明细"}
                        aria-expanded={Boolean(expanded[row.installationId])}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpanded(row.installationId);
                        }}
                        className="grid size-7 place-items-center rounded-md text-[var(--subtle)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <ChevronRight
                          size={16}
                          className={cn("transition-transform duration-200", expanded[row.installationId] && "rotate-90")}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-[var(--subtle)]">#{row.seq}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div className="font-medium text-[var(--ink)]">{formatDuration(row.survivalSeconds)}</div>
                      {row.fast && (
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          {FAST_UNINSTALL_LABEL}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-xs text-[var(--secondary)]">
                      {displayDateTime(row.firstSeenAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-xs text-[var(--secondary)]">
                      {displayDateTime(row.uninstalledAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-xs text-[var(--secondary)]">
                      {row.currentVersion}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[var(--secondary)]">
                      {browserLabel(row.browser)}
                      {row.browserMajorVersion ? ` ${row.browserMajorVersion}` : ""} · {osLabel(row.os)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[var(--secondary)]">
                      {localePairLabel(row.locale)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[var(--secondary)]">
                      {row.distribution}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[var(--secondary)]">
                      {licenseLabel(row.licenseType)}
                    </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[11px] text-[var(--subtle)]">
                        {row.installationId}
                      </TableCell>
                    </TableRow>

                    {expanded[row.installationId] && (
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableCell colSpan={DETAIL_COLUMN_COUNT} className="p-0">
                          <DailyUsagePanel installationId={row.installationId} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
