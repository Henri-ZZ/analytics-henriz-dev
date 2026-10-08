"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn, formatNumber } from "@/lib/utils";

export type DistributionDatum = {
  value: string;
  label: string;
  /** tooltip 里用的更详细文案；缺省时回退到 label */
  tooltip?: string;
  count: number;
  color: string;
};

const PIE_VIEW = { width: 620, height: 320 };
const PIE_OUTER = 102;
const PIE_INNER = 64;
/** 引线从圆环外再往外伸出的距离 */
const PIE_ELBOW_GAP = 16;
/** 同侧标签之间的最小垂直间距，避免小扇区标签叠在一起 */
const PIE_LABEL_GAP = 15;

const BAR_HEIGHT = 320;
const BAR_PAD = { top: 30, right: 16, bottom: 46, left: 48 };
const BAR_TICKS = [0, 25, 50, 75, 100];

type HoverState = { item: DistributionDatum; x: number; y: number };

function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function formatPercent(value: number) {
  if (value <= 0) return "0%";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

/** 环形扇区路径 */
function donutSlice(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const x0 = cx + outer * Math.cos(start);
  const y0 = cy + outer * Math.sin(start);
  const x1 = cx + outer * Math.cos(end);
  const y1 = cy + outer * Math.sin(end);
  const x2 = cx + inner * Math.cos(end);
  const y2 = cy + inner * Math.sin(end);
  const x3 = cx + inner * Math.cos(start);
  const y3 = cy + inner * Math.sin(start);
  const largeArc = end - start > Math.PI ? 1 : 0;

  return [
    `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function ChartTooltip({ hover, share, width }: { hover: HoverState; share: number; width: number }) {
  const left = Math.min(Math.max(hover.x + 14, 8), Math.max(8, width - 200));
  const top = Math.max(8, hover.y - 62);

  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[150px] rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-xl"
      style={{ left, top }}
    >
      <div className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hover.item.color }} />
        <span className="font-medium text-[var(--ink)]">{hover.item.tooltip ?? hover.item.label}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[var(--subtle)]">
        <span>
          数量 <span className="font-medium tabular-nums text-[var(--ink)]">{formatNumber(hover.item.count)}</span>
        </span>
        <span>
          占比 <span className="font-medium tabular-nums text-[var(--ink)]">{formatPercent(share)}</span>
        </span>
      </div>
    </div>
  );
}

function DonutChart({
  items,
  hiddenValues,
  onHoverMove,
  onHoverLeave,
}: {
  items: DistributionDatum[];
  hiddenValues: string[];
  onHoverMove: (item: DistributionDatum) => (event: ReactMouseEvent) => void;
  onHoverLeave: () => void;
}) {
  const cx = PIE_VIEW.width / 2;
  const cy = PIE_VIEW.height / 2;
  const ringRadius = (PIE_OUTER + PIE_INNER) / 2;
  const ringWidth = PIE_OUTER - PIE_INNER;

  const visible = items.filter((item) => !hiddenValues.includes(item.value));
  const total = visible.reduce((sum, item) => sum + item.count, 0);

  // 先算好每个扇区的角度，避免在 JSX 里累积变量
  const slices: { item: DistributionDatum; start: number; end: number; mid: number }[] = [];
  let cursor = -Math.PI / 2;
  for (const item of visible) {
    const sweep = (item.count / total) * Math.PI * 2;
    slices.push({ item, start: cursor, end: cursor + sweep, mid: cursor + sweep / 2 });
    cursor += sweep;
  }

  // 引线标签：先算理想位置，再按左右两侧分别把过近的标签推开
  const labels = slices.map((slice) => {
    const side = Math.cos(slice.mid) >= 0 ? 1 : -1;
    const anchorX = cx + PIE_OUTER * Math.cos(slice.mid);
    const anchorY = cy + PIE_OUTER * Math.sin(slice.mid);
    const elbowX = cx + side * (PIE_OUTER + PIE_ELBOW_GAP);
    return { item: slice.item, side, anchorX, anchorY, elbowX, textX: elbowX + side * 6, idealY: anchorY };
  });

  const labelY = new Map<string, number>();
  for (const side of [1, -1]) {
    const group = labels.filter((label) => label.side === side).sort((a, b) => a.idealY - b.idealY);
    let previous = Number.NEGATIVE_INFINITY;
    for (const label of group) {
      const next = Math.max(label.idealY, previous + PIE_LABEL_GAP);
      labelY.set(label.item.value, next);
      previous = next;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${PIE_VIEW.width} ${PIE_VIEW.height}`}
      className="mx-auto block h-auto w-full max-w-[620px]"
      role="img"
      aria-label="分布占比环形图"
    >
      {total <= 0 && (
        <circle cx={cx} cy={cy} r={ringRadius} fill="none" stroke="var(--muted)" strokeWidth={ringWidth} />
      )}

      {slices.map(({ item, start, end }) => {
        // 只剩一个分类时是整圆，起终点重合会让路径不可见，单独用圆环画
        if (end - start >= Math.PI * 2 - 1e-6) {
          return (
            <circle
              key={item.value}
              cx={cx}
              cy={cy}
              r={ringRadius}
              fill="none"
              stroke={item.color}
              strokeWidth={ringWidth}
              onMouseMove={onHoverMove(item)}
              onMouseLeave={onHoverLeave}
            />
          );
        }

        return (
          <path
            key={item.value}
            d={donutSlice(cx, cy, PIE_OUTER, PIE_INNER, start, end)}
            fill={item.color}
            stroke="#fff"
            strokeWidth={2}
            onMouseMove={onHoverMove(item)}
            onMouseLeave={onHoverLeave}
          />
        );
      })}

      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-[var(--ink)] text-[22px] font-semibold tabular-nums">
        {total > 0 ? formatNumber(total) : "—"}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" className="fill-[var(--subtle)] text-[11px]">
        {total > 0 ? "安装数" : "全部已隐藏"}
      </text>

      {labels.map((label) => {
        const y = labelY.get(label.item.value) ?? label.anchorY;
        return (
          <g key={label.item.value}>
            <polyline
              points={`${label.anchorX.toFixed(1)},${label.anchorY.toFixed(1)} ${label.elbowX.toFixed(1)},${y.toFixed(1)} ${label.textX.toFixed(1)},${y.toFixed(1)}`}
              fill="none"
              stroke={label.item.color}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
            <text
              x={label.textX + label.side * 4}
              y={y}
              textAnchor={label.side === 1 ? "start" : "end"}
              dominantBaseline="middle"
              className="text-[11px]"
            >
              <tspan className="fill-[var(--ink)]">{label.item.label}</tspan>
              <tspan className="fill-[var(--ink)]" dx="5">
                {formatNumber(label.item.count)}
              </tspan>
              <tspan className="fill-[var(--subtle)]">({formatPercent(percent(label.item.count, total))})</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({
  items,
  hiddenValues,
  onHoverMove,
  onHoverLeave,
}: {
  items: DistributionDatum[];
  hiddenValues: string[];
  onHoverMove: (item: DistributionDatum) => (event: ReactMouseEvent) => void;
  onHoverLeave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

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

  const visible = items.filter((item) => !hiddenValues.includes(item.value));
  const total = visible.reduce((sum, item) => sum + item.count, 0);

  const plotWidth = Math.max(200, width - BAR_PAD.left - BAR_PAD.right);
  const plotHeight = BAR_HEIGHT - BAR_PAD.top - BAR_PAD.bottom;
  const band = items.length > 0 ? plotWidth / items.length : plotWidth;
  const barWidth = Math.min(56, band * 0.6);
  const yOf = (value: number) => BAR_PAD.top + plotHeight - (value / 100) * plotHeight;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={BAR_HEIGHT} className="block" role="img" aria-label="分布占比柱状图">
        {BAR_TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={BAR_PAD.left}
              x2={BAR_PAD.left + plotWidth}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={BAR_PAD.left - 10}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-[var(--subtle)] text-[10px] tabular-nums"
            >
              {tick}%
            </text>
          </g>
        ))}

        {items.map((item, index) => {
          const hidden = hiddenValues.includes(item.value);
          const value = percent(item.count, total);
          const centerX = BAR_PAD.left + band * index + band / 2;

          return (
            <g key={item.value}>
              {!hidden && value > 0 && (
                <>
                  <rect
                    x={centerX - barWidth / 2}
                    y={yOf(value)}
                    width={barWidth}
                    height={Math.max(2, plotHeight - (yOf(value) - BAR_PAD.top))}
                    rx={4}
                    fill={item.color}
                  />
                  {/* 柱顶：数量(占比)，数量深色，括号与占比浅灰 */}
                  <text x={centerX} y={yOf(value) - 9} textAnchor="middle" className="text-[11px] tabular-nums">
                    <tspan className="fill-[var(--ink)] font-medium">{formatNumber(item.count)}</tspan>
                    <tspan className="fill-[var(--subtle)]">({formatPercent(value)})</tspan>
                  </text>
                </>
              )}
              <text
                x={centerX}
                y={BAR_HEIGHT - BAR_PAD.bottom + 18}
                textAnchor="middle"
                className={cn("text-[10px]", hidden ? "fill-[var(--subtle)]" : "fill-[var(--secondary)]")}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* 悬停热区：整条 band 都算，画在最上层 */}
        {items.map((item, index) =>
          hiddenValues.includes(item.value) ? null : (
            <rect
              key={`hit-${item.value}`}
              x={BAR_PAD.left + band * index}
              y={BAR_PAD.top}
              width={band}
              height={plotHeight}
              fill="transparent"
              onMouseMove={onHoverMove(item)}
              onMouseLeave={onHoverLeave}
            />
          ),
        )}
      </svg>
    </div>
  );
}

export function DistributionChart({
  variant,
  items,
  hiddenValues,
  onToggleValue,
}: {
  variant: "pie" | "bar";
  items: DistributionDatum[];
  hiddenValues: string[];
  onToggleValue: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hover, setHover] = useState<HoverState | null>(null);

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

  // 占比按「当前可见的分类」重新归一化，所以隐藏后剩下的会重新铺满
  const visibleTotal = items
    .filter((item) => !hiddenValues.includes(item.value))
    .reduce((sum, item) => sum + item.count, 0);

  const handleHoverMove = (item: DistributionDatum) => (event: ReactMouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ item, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const handleHoverLeave = () => setHover(null);

  const chartProps = { items, hiddenValues, onHoverMove: handleHoverMove, onHoverLeave: handleHoverLeave };

  return (
    <div ref={containerRef} className="relative w-full">
      {variant === "pie" ? <DonutChart {...chartProps} /> : <BarChart {...chartProps} />}

      {hover && <ChartTooltip hover={hover} share={percent(hover.item.count, visibleTotal)} width={width} />}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
        {items.map((item) => {
          const hidden = hiddenValues.includes(item.value);
          const share = hidden ? null : percent(item.count, visibleTotal);

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onToggleValue(item.value)}
              aria-pressed={!hidden}
              title={hidden ? "点击显示这一项" : "点击隐藏这一项"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--muted)]",
                hidden && "opacity-45",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[var(--ink)]">{item.label}</span>
              <span className="tabular-nums">
                <span className="font-medium text-[var(--ink)]">{formatNumber(item.count)}</span>
                {share !== null && <span className="text-[var(--subtle)]">({formatPercent(share)})</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
