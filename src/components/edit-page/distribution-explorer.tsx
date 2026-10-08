"use client";

import { useState } from "react";
import { BarChart3, PieChart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DistributionChart, type DistributionDatum } from "@/components/edit-page/distribution-chart";
import {
  chartColor,
  DISTRIBUTION_DIMENSION_OPTIONS,
  dimensionTooltipLabel,
  dimensionValueLabel,
} from "@/lib/edit-page-display";
import type { DistributionDimension, DistributionResult } from "@/lib/edit-page-types";
import { cn, formatNumber } from "@/lib/utils";

const CHART_TYPES: { value: "pie" | "bar"; label: string; icon: typeof PieChart }[] = [
  { value: "pie", label: "饼图", icon: PieChart },
  { value: "bar", label: "柱状图", icon: BarChart3 },
];

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: DistributionResult };

export function DistributionExplorer({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [dimension, setDimension] = useState<DistributionDimension>("browser");
  const [variant, setVariant] = useState<"pie" | "bar">("pie");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [hiddenValues, setHiddenValues] = useState<string[]>([]);
  const [state, setState] = useState<QueryState>({ status: "idle" });

  const runQuery = async () => {
    setHiddenValues([]);
    setState({ status: "loading" });

    try {
      const params = new URLSearchParams({ dimension, start, end });
      const response = await fetch(`/api/edit-page/distribution?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as DistributionResult;
      setState({ status: "ready", result });
    } catch (cause) {
      setState({ status: "error", message: cause instanceof Error ? cause.message : "未知错误" });
    }
  };

  const result = state.status === "ready" ? state.result : null;
  const activeDimension = result?.dimension ?? dimension;
  const dimensionLabel = DISTRIBUTION_DIMENSION_OPTIONS.find((option) => option.value === activeDimension)?.label ?? "";

  const chartItems: DistributionDatum[] =
    result?.items.map((item, index) => ({
      value: item.value,
      label: dimensionValueLabel(result.dimension, item.value),
      tooltip: dimensionTooltipLabel(result.dimension, item.value),
      count: item.count,
      color: chartColor(index),
    })) ?? [];

  const toggleValue = (value: string) =>
    setHiddenValues((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">统计维度</h2>
          <p className="mt-0.5 text-xs text-[var(--subtle)]">选择一个维度，查看该维度下各分类的安装数占比</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DISTRIBUTION_DIMENSION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDimension(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  dimension === option.value
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--secondary)] hover:bg-[var(--muted)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
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

            <div className="inline-flex rounded-lg border bg-white p-0.5">
              {CHART_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVariant(option.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    variant === option.value
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--secondary)] hover:bg-[var(--muted)]",
                  )}
                >
                  <option.icon size={13} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={runQuery} disabled={state.status === "loading"}>
            <Search size={15} />
            {state.status === "loading" ? "查询中…" : "查询"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{dimensionLabel}占比</h2>
            <p className="mt-0.5 text-xs text-[var(--subtle)]">
              {result
                ? `${result.start} ~ ${result.end} · 共 ${formatNumber(result.total)} 个安装 · 占比按当前可见分类归一化`
                : "选择维度与时间范围后点击查询"}
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          {state.status === "idle" && (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                <PieChart size={22} />
              </span>
              <p className="mt-5 text-sm font-medium">还没有查询结果</p>
              <p className="mt-1.5 max-w-md text-xs leading-5 text-[var(--subtle)]">
                选好统计维度、时间范围和图表类型后点「查询」。
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

          {result && result.items.length === 0 && (
            <div className="flex min-h-72 items-center justify-center text-sm text-[var(--subtle)]">
              该时间范围内没有使用记录
            </div>
          )}

          {result && result.items.length > 0 && (
            <DistributionChart
              variant={variant}
              items={chartItems}
              hiddenValues={hiddenValues}
              onToggleValue={toggleValue}
            />
          )}
        </div>
      </section>
    </div>
  );
}
