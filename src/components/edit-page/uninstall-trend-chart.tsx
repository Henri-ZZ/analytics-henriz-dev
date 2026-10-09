"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FAST_UNINSTALL_LABEL } from "@/lib/edit-page-display";
import type { UninstallDailyPoint } from "@/lib/edit-page-types";
import { cn, formatNumber } from "@/lib/utils";

const HEIGHT = 320;
const PAD = { top: 24, right: 16, bottom: 46, left: 44 };
/** 相邻 x 轴标签至少隔这么多像素，避免日期糊在一起 */
const MIN_LABEL_GAP = 46;

/** 三条系列：安装=绿、卸载=橙、快速卸载=红（红与明细里的标签同色） */
const SERIES = [
  { key: "installs", label: "新增安装", color: "#22c55e" },
  { key: "uninstalls", label: "卸载", color: "#f97316" },
  { key: "fastUninstalls", label: FAST_UNINSTALL_LABEL, color: "#ef4444" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

/** 取一个整齐的纵轴上限与刻度步长，刻度控制在 5 条以内 */
function niceScale(max: number) {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  const step = candidates.find((value) => max / value <= 5) ?? Math.ceil(max / 5);
  const top = Math.max(step, Math.ceil(max / step) * step);

  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}

function TrendTooltip({
  day,
  x,
  y,
  width,
}: {
  day: UninstallDailyPoint;
  x: number;
  y: number;
  width: number;
}) {
  const left = Math.min(Math.max(x + 14, 8), Math.max(8, width - 200));
  const top = Math.max(8, y - 108);
  const ratio = day.installs > 0 ? (day.uninstalls / day.installs) * 100 : null;

  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[176px] rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-xl"
      style={{ left, top }}
    >
      <div className="font-medium tabular-nums text-[var(--ink)]">{day.date}</div>
      <div className="mt-1.5 space-y-1">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-1.5 text-[var(--secondary)]">
            <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: series.color }} />
            {series.label}
            <span className="ml-auto font-medium tabular-nums text-[var(--ink)]">{formatNumber(day[series.key])}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 border-t border-[var(--border)] pt-1.5 text-[var(--subtle)]">
        卸载 / 新增
        <span className="ml-auto font-medium tabular-nums text-[var(--ink)]">
          {ratio === null ? "—" : `${ratio.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}

export function UninstallTrendChart({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: UninstallDailyPoint[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hover, setHover] = useState<{ day: UninstallDailyPoint; x: number; y: number } | null>(null);

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

  const plotWidth = Math.max(200, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = days.length > 0 ? plotWidth / days.length : plotWidth;
  const groupWidth = Math.min(band * 0.72, 36);
  const barWidth = Math.max(1.5, groupWidth / SERIES.length);

  const maxValue = days.reduce(
    (max, day) => Math.max(max, day.installs, day.uninstalls, day.fastUninstalls),
    0,
  );
  const { top, ticks } = niceScale(maxValue);
  const yOf = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const labelStep = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotWidth / MIN_LABEL_GAP))));

  const handleMove = (day: UninstallDailyPoint, event: ReactMouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ day, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {SERIES.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5 text-xs text-[var(--secondary)]">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
        <span className="ml-auto text-xs text-[var(--subtle)]">点击某一天的柱子，下方查看当天卸载明细</span>
      </div>

      <svg width={width} height={HEIGHT} className="block" role="img" aria-label="每日新增安装与卸载趋势">
        {ticks.map((tick) => (
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
              {tick}
            </text>
          </g>
        ))}

        {days.map((day, index) => {
          const bandX = PAD.left + band * index;
          const centerX = bandX + band / 2;
          const selected = day.date === selectedDate;
          const values: Record<SeriesKey, number> = {
            installs: day.installs,
            uninstalls: day.uninstalls,
            fastUninstalls: day.fastUninstalls,
          };

          return (
            <g key={day.date}>
              {selected && (
                <rect
                  x={bandX + 1}
                  y={PAD.top}
                  width={Math.max(2, band - 2)}
                  height={plotHeight}
                  rx={4}
                  fill="var(--muted)"
                />
              )}

              {SERIES.map((series, seriesIndex) => {
                const value = values[series.key];
                if (value <= 0) return null;

                const barHeight = Math.max(2, (value / top) * plotHeight);
                return (
                  <rect
                    key={series.key}
                    x={centerX - groupWidth / 2 + seriesIndex * barWidth}
                    y={PAD.top + plotHeight - barHeight}
                    width={Math.max(1, barWidth - 1.5)}
                    height={barHeight}
                    rx={2}
                    fill={series.color}
                    // 选中某天后，其余日子压暗，视线集中在当天
                    opacity={!selectedDate || selected ? 1 : 0.45}
                  />
                );
              })}

              {index % labelStep === 0 && (
                <text
                  x={centerX}
                  y={HEIGHT - PAD.bottom + 16}
                  textAnchor="middle"
                  className={cn("text-[10px] tabular-nums", selected ? "fill-[var(--ink)]" : "fill-[var(--subtle)]")}
                >
                  {day.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}

        {/* 热区：整条 band 可点可选，柱子太矮时也好点 */}
        {days.map((day, index) => (
          <rect
            key={`hit-${day.date}`}
            x={PAD.left + band * index}
            y={PAD.top}
            width={band}
            height={plotHeight}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onSelectDate(day.date)}
            onMouseMove={(event) => handleMove(day, event)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover && <TrendTooltip day={hover.day} x={hover.x} y={hover.y} width={width} />}
    </div>
  );
}
