"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn, formatNumber } from "@/lib/utils";

const HEIGHT = 320;
const PAD = { top: 16, right: 20, bottom: 36, left: 56 };
const DIVISIONS = 4;

export type EventTrendSeries = {
  key: string;
  color: string;
  counts: number[];
  total: number;
};

/** 把最大值向上取整到一个「好看」的刻度（保证 DIVISIONS 等分后是整数） */
function niceMax(value: number) {
  if (value <= DIVISIONS) return DIVISIONS;
  const raw = value / DIVISIONS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 3, 5, 10].map((candidate) => candidate * magnitude).find((candidate) => candidate >= raw) ?? magnitude * 10;
  return step * DIVISIONS;
}

export function EventTrendChart({
  dates,
  series,
  hiddenKeys,
  onToggleSeries,
}: {
  dates: string[];
  series: EventTrendSeries[];
  /** 被隐藏的曲线 key；由父组件持有，方便「查询」时统一重置为全部显示 */
  hiddenKeys: string[];
  onToggleSeries: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 隐藏的曲线不参与绘图，也不参与 Y 轴刻度计算，剩下的线会重新铺满高度
  const visibleSeries = series.filter((item) => !hiddenKeys.includes(item.key));

  const plotWidth = Math.max(160, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const stepX = dates.length > 1 ? plotWidth / (dates.length - 1) : 0;
  const xOf = (index: number) => (dates.length > 1 ? PAD.left + index * stepX : PAD.left + plotWidth / 2);

  const yMax = niceMax(Math.max(1, ...visibleSeries.flatMap((item) => item.counts)));
  const yOf = (value: number) => PAD.top + plotHeight - (value / yMax) * plotHeight;
  const yTicks = Array.from({ length: DIVISIONS + 1 }, (_, index) => (yMax / DIVISIONS) * index);

  // x 轴最多标 8 个日期，均匀取样
  const labelIndices = new Set<number>();
  const labelCount = Math.min(dates.length, 8);
  for (let i = 0; i < labelCount; i += 1) {
    labelIndices.add(Math.round((i * (dates.length - 1)) / Math.max(1, labelCount - 1)));
  }

  const showPoints = dates.length <= 31;

  const handleMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - rect.left - PAD.left;
    const index = stepX > 0 ? Math.round(offset / stepX) : 0;
    setActiveIndex(Math.min(dates.length - 1, Math.max(0, index)));
  };

  const tooltipRows =
    activeIndex === null
      ? []
      : [...visibleSeries].sort((a, b) => (b.counts[activeIndex] ?? 0) - (a.counts[activeIndex] ?? 0));

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        className="block select-none"
        role="img"
        aria-label="事件每日次数折线图"
        onMouseMove={handleMove}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-[var(--subtle)] text-[10px] tabular-nums"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {dates.map((date, index) =>
          labelIndices.has(index) ? (
            <text
              key={date}
              x={xOf(index)}
              y={HEIGHT - PAD.bottom + 20}
              textAnchor="middle"
              className="fill-[var(--subtle)] text-[10px]"
            >
              {date}
            </text>
          ) : null,
        )}

        {activeIndex !== null && (
          <line
            x1={xOf(activeIndex)}
            x2={xOf(activeIndex)}
            y1={PAD.top}
            y2={PAD.top + plotHeight}
            stroke="var(--subtle)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {visibleSeries.map((item) => (
          <g key={item.key}>
            <path
              d={item.counts
                .map(
                  (value, index) =>
                    `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`,
                )
                .join(" ")}
              fill="none"
              stroke={item.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showPoints &&
              item.counts.map((value, index) => (
                <circle
                  key={index}
                  cx={xOf(index)}
                  cy={yOf(value)}
                  r={activeIndex === index ? 3.5 : 2.5}
                  fill={item.color}
                />
              ))}
          </g>
        ))}

        {visibleSeries.length === 0 && (
          <text
            x={PAD.left + plotWidth / 2}
            y={PAD.top + plotHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--subtle)] text-xs"
          >
            所有曲线已隐藏，点击下方图例恢复
          </text>
        )}
      </svg>

      {activeIndex !== null && tooltipRows.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 w-52 rounded-lg border bg-white p-2.5 shadow-lg"
          style={{ left: Math.min(Math.max(xOf(activeIndex) + 12, 0), Math.max(0, width - 216)), top: 44 }}
        >
          <div className="mb-1.5 text-xs font-medium tabular-nums">{dates[activeIndex]}</div>
          <div className="space-y-1">
            {tooltipRows.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <code className="truncate font-mono text-[var(--secondary)]">{item.key}</code>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatNumber(item.counts[activeIndex] ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
        {series.map((item) => {
          const hidden = hiddenKeys.includes(item.key);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggleSeries(item.key)}
              aria-pressed={!hidden}
              title={hidden ? "点击显示这条曲线" : "点击隐藏这条曲线"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--muted)]",
                hidden && "opacity-45",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <code className="font-mono text-[var(--ink)]">{item.key}</code>
              <span className="tabular-nums text-[var(--subtle)]">{formatNumber(item.total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
