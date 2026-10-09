"use client";

import { useState } from "react";
import { LineChart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EventTrendChart } from "@/components/edit-page/event-trend-chart";
import { EDIT_PAGE_COUNTER_KEY_TOTAL, EDIT_PAGE_EVENT_SECTIONS } from "@/lib/edit-page-events";
import { CHART_COLORS } from "@/lib/edit-page-display";
import type { EventDailyResult } from "@/lib/edit-page-types";
import { cn } from "@/lib/utils";

const PRESET_DAYS = [7, 30, 90];
const MAX_SELECTED = 12;
// 工具入口是一组四个计数器（弹窗 + 三个工具），默认把它们一起展示，
// 而不是只拿 edit.start 代表入口。
const DEFAULT_SELECTED = ["popup.open", "edit.start", "remove.start", "image.replace.start"];
const DAY_MS = 86_400_000;

function countDays(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.floor((endMs - startMs) / DAY_MS) + 1;
}

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: EventDailyResult };

export function EventExplorer({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [distinctUsers, setDistinctUsers] = useState(false);
  // 图例里被隐藏的曲线：每次查询都重置为全部显示
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [state, setState] = useState<QueryState>({ status: "idle" });

  const atLimit = selected.length >= MAX_SELECTED;
  const rangeDays = countDays(start, end);

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, key];
    });
  };

  const toggleSection = (keys: string[]) => {
    setSelected((prev) => {
      if (keys.every((key) => prev.includes(key))) return prev.filter((key) => !keys.includes(key));

      const merged = [...prev];
      for (const key of keys) {
        if (merged.length >= MAX_SELECTED) break;
        if (!merged.includes(key)) merged.push(key);
      }
      return merged;
    });
  };

  const runQuery = async () => {
    setHiddenSeries([]);
    setState({ status: "loading" });

    try {
      const params = new URLSearchParams({
        keys: selected.join(","),
        start,
        end,
        unique: distinctUsers ? "1" : "0",
      });
      const response = await fetch(`/api/edit-page/events/daily?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as EventDailyResult;
      setState({ status: "ready", result });
    } catch (cause) {
      setState({ status: "error", message: cause instanceof Error ? cause.message : "未知错误" });
    }
  };

  // 查询后以「实际查询用的口径」为准，否则跟随勾选框
  const uniqueMode = state.status === "ready" ? state.result.unique : distinctUsers;

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">选择事件</h2>
            <p className="mt-0.5 text-xs text-[var(--subtle)]">
              支持多选，最多 {MAX_SELECTED} 个；共 {EDIT_PAGE_COUNTER_KEY_TOTAL} 个计数键
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--secondary)]">
              已选 <span className="font-medium tabular-nums text-[var(--ink)]">{selected.length}</span>
            </span>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                清空
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 space-y-4 overflow-y-auto px-5 py-4">
          {EDIT_PAGE_EVENT_SECTIONS.map((section) => {
            const keys = section.events.map((event) => event.key);
            const allSelected = keys.every((key) => selected.includes(key));

            return (
              <div key={section.title}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--secondary)]">{section.title}</span>
                  <span className="text-[11px] text-[var(--subtle)]">{keys.length}</span>
                  <button
                    type="button"
                    onClick={() => toggleSection(keys)}
                    className="text-[11px] font-medium text-[var(--accent-ink)] underline underline-offset-2"
                  >
                    {allSelected ? "取消全选" : "全选"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {section.events.map((event) => {
                    const active = selected.includes(event.key);
                    const blocked = !active && atLimit;

                    return (
                      <Tooltip key={event.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => toggle(event.key)}
                            disabled={blocked}
                            className={cn(
                              "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                              active
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border)] bg-white text-[var(--secondary)] hover:bg-[var(--muted)]",
                              blocked && "cursor-not-allowed opacity-40 hover:bg-white",
                            )}
                          >
                            {event.key}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="block font-mono text-[11px] font-medium text-[var(--accent-ink)]">
                            {event.key}
                          </span>
                          <span className="mt-1 block">{event.description}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--secondary)]">时间范围</span>

            <DateRangePicker
              value={{ start, end }}
              onChange={(next) => {
                setStart(next.start);
                setEnd(next.end);
              }}
              maxDate={defaultEnd}
              presets={PRESET_DAYS}
              defaultRangeDays={7}
            />

            <label className="inline-flex items-center gap-2 text-xs text-[var(--secondary)]">
              <input
                type="checkbox"
                checked={distinctUsers}
                onChange={(event) => setDistinctUsers(event.target.checked)}
                className="size-3.5 accent-[var(--accent)]"
              />
              去重用户数
            </label>

            <span className="text-xs text-[var(--subtle)]">
              共 <span className="tabular-nums text-[var(--secondary)]">{Math.max(0, rangeDays)}</span> 天
            </span>
          </div>

          <Button onClick={runQuery} disabled={selected.length === 0 || state.status === "loading" || rangeDays < 1}>
            <Search size={15} />
            {state.status === "loading" ? "查询中…" : "查询"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{uniqueMode ? "每日去重用户数" : "每日事件次数"}</h2>
            <p className="mt-0.5 text-xs text-[var(--subtle)]">
              {state.status === "ready"
                ? `${state.result.start} ~ ${state.result.end} · ${state.result.series.length} 个事件 · ${
                    state.result.unique ? "按每日去重安装数" : "按事件次数"
                  }`
                : "选择事件与时间范围后点击查询"}
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          {state.status === "idle" && (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                <LineChart size={22} />
              </span>
              <p className="mt-5 text-sm font-medium">还没有查询结果</p>
              <p className="mt-1.5 max-w-md text-xs leading-5 text-[var(--subtle)]">
                在上面选择要对比的事件（默认已选中「核心使用」三项），选好时间范围后点「查询」。
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

          {state.status === "ready" && (
            <EventTrendChart
              dates={state.result.dates}
              series={state.result.series.map((item, index) => ({
                ...item,
                color: CHART_COLORS[index % CHART_COLORS.length],
              }))}
              hiddenKeys={hiddenSeries}
              onToggleSeries={(key) =>
                setHiddenSeries((prev) =>
                  prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
                )
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
