"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  DayPicker,
  DayFlag,
  SelectionState,
  UI,
  type CalendarDay,
  type ClassNames,
  type CustomComponents,
  type DateRange,
  type Modifiers,
} from "react-day-picker";
import { zhCN } from "react-day-picker/locale/zh-CN";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { displayDate } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type DateRangeValue = {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** ISO 字符串 → 本地 Date（用本地构造避免时区把日期挪走） */
function toDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftDays(iso: string, delta: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return toIso(new Date(year, month - 1, day + delta));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

const navButtonClass =
  "absolute top-0 grid size-7 place-items-center rounded-md text-[var(--subtle)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 单元格（td）只负责浅色条带，圆点留给首尾两个按钮，
 * 这样才是 antd 那种「一条浅色带 + 两端实心圆角块」的效果，
 * 而不是把区间里每一天都涂成实心块。
 */
const classNames: Partial<ClassNames> = {
  [UI.Root]: "w-fit",
  [UI.Months]: "flex gap-6",
  [UI.Month]: "space-y-1.5",
  [UI.MonthCaption]: "flex h-7 items-center justify-center",
  [UI.CaptionLabel]: "text-sm font-semibold text-[var(--ink)]",
  [UI.MonthGrid]: "border-collapse",
  [UI.Weekday]: "size-8 pb-1.5 text-[11px] font-normal text-[var(--subtle)]",
  [UI.Day]: "p-0 text-center align-middle",
  [SelectionState.selected]: "bg-[var(--accent)]/15",
  [SelectionState.range_start]: "rounded-l-md bg-[var(--accent)]/15",
  [SelectionState.range_end]: "rounded-r-md bg-[var(--accent)]/15",
  [SelectionState.range_middle]: "",
  [DayFlag.outside]: "",
  [DayFlag.disabled]: "",
  [DayFlag.today]: "",
  [DayFlag.focused]: "",
  [DayFlag.hidden]: "",
};

type CalendarDayButtonProps = { day: CalendarDay; modifiers: Modifiers } & ComponentPropsWithoutRef<"button">;

function CalendarDayButton({ day, modifiers, className, ...props }: CalendarDayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isEdge = Boolean(modifiers.range_start || modifiers.range_end);
  const inRange = Boolean(modifiers.selected);
  const muted = Boolean(modifiers.outside) && !inRange && !isEdge;

  return (
    <button
      ref={ref}
      {...props}
      title={day.isoDate}
      className={cn(
        className,
        "grid size-8 place-items-center rounded-md text-xs transition-colors",
        isEdge
          ? "bg-[var(--accent)] font-medium text-white"
          : inRange
            ? "text-[var(--accent-ink)] hover:bg-[var(--accent)]/20"
            : "hover:bg-[var(--muted)]",
        !isEdge && !inRange && modifiers.today && "font-semibold text-[var(--accent-ink)]",
        muted && "text-[var(--subtle)]",
        modifiers.disabled && "cursor-not-allowed text-[var(--subtle)]/50 hover:bg-transparent",
      )}
    />
  );
}

const components: Partial<CustomComponents> = {
  Chevron: ({ orientation }) => (orientation === "right" ? <ChevronRight size={15} /> : <ChevronLeft size={15} />),
  DayButton: CalendarDayButton,
};

export function DateRangePicker({
  value,
  onChange,
  maxDate,
  presets = [7, 30, 90],
  defaultRangeDays = 7,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** 可选的最晚日期（YYYY-MM-DD），之后的日期会被禁用 */
  maxDate: string;
  /** 面板左侧的快捷范围（天数） */
  presets?: number[];
  /** 点「重置」时回到多少天 */
  defaultRangeDays?: number;
}) {
  const [open, setOpen] = useState(false);
  // 先点了起点、还没点终点时，把它暂存起来让日历能显示待选区间
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  // 自己接管月份切换（关掉了 RDP 自带的导航），好把 ‹ › 摆到标题行两端
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(toDate(value.start)));

  const maxDateValue = DATE_PATTERN.test(maxDate) ? toDate(maxDate) : undefined;
  // 「今天」按展示时区（UTC+8）判断，别用运行环境的本地时区：北京时间的 0:00–8:00
  // 在 UTC 下还是前一天，RDP 会把「今天」高亮到昨天。
  const todayValue = toDate(displayDate(Date.now()));
  const selected = draft ?? { from: toDate(value.start), to: toDate(value.end) };

  const endMonthValue = maxDateValue ? startOfMonth(maxDateValue) : undefined;
  const startMonthValue = endMonthValue ? addMonths(endMonthValue, -13) : undefined;
  const canGoPrevious = !startMonthValue || viewMonth.getTime() > startMonthValue.getTime();
  const canGoNext = !endMonthValue || addMonths(viewMonth, 1).getTime() <= endMonthValue.getTime();

  const handleOpenChange = (next: boolean) => {
    setDraft(undefined);
    if (next) setViewMonth(startOfMonth(toDate(value.start)));
    setOpen(next);
  };

  const applyPreset = (days: number) => {
    const range = { start: shiftDays(maxDate, -(days - 1)), end: maxDate };
    onChange(range);
    setViewMonth(startOfMonth(toDate(range.start)));
    setDraft(undefined);
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraft(undefined);
      return;
    }
    // 只有起点：进入待选状态，等第二次点击确定终点
    if (!range.to) {
      setDraft(range);
      return;
    }
    onChange({ start: toIso(range.from), end: toIso(range.to) });
    setDraft(undefined);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-white pl-3 pr-1.5 transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/20">
        <CalendarDays size={14} className="shrink-0 text-[var(--accent-ink)]" />
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="选择时间范围"
            className="inline-flex items-center gap-1.5 py-1 text-xs text-[var(--ink)] outline-none"
          >
            <span className="tabular-nums">{value.start}</span>
            <ArrowRight size={12} className="text-[var(--subtle)]" />
            <span className="tabular-nums">{value.end}</span>
          </button>
        </Popover.Trigger>
        <button
          type="button"
          aria-label={`重置为最近 ${defaultRangeDays} 天`}
          title={`重置为最近 ${defaultRangeDays} 天`}
          onClick={() => applyPreset(defaultRangeDays)}
          className="grid size-5 shrink-0 place-items-center rounded-full text-[var(--subtle)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
        >
          <X size={12} />
        </button>
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex rounded-xl border border-[var(--border)] bg-white shadow-xl"
        >
          <div className="w-32 shrink-0 space-y-0.5 border-r border-[var(--border)] p-2">
            {presets.map((days) => {
              const preset = { start: shiftDays(maxDate, -(days - 1)), end: maxDate };
              const active = value.start === preset.start && value.end === preset.end;

              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyPreset(days)}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-[var(--accent)]/10 font-medium text-[var(--accent-ink)]"
                      : "text-[var(--secondary)] hover:bg-[var(--muted)]",
                  )}
                >
                  最近 {days} 天
                </button>
              );
            })}
          </div>

          <div className="p-4">
            <div className="relative">
              <button
                type="button"
                aria-label="上个月"
                disabled={!canGoPrevious}
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                className={cn(navButtonClass, "left-0")}
              >
                <ChevronLeft size={15} />
              </button>

              <DayPicker
                mode="range"
                locale={zhCN}
                numberOfMonths={2}
                weekStartsOn={1}
                showOutsideDays
                fixedWeeks
                max={366}
                resetOnSelect
                hideNavigation
                month={viewMonth}
                onMonthChange={setViewMonth}
                startMonth={startMonthValue}
                endMonth={endMonthValue}
                today={todayValue}
                selected={selected}
                onSelect={handleSelect}
                disabled={maxDateValue ? { after: maxDateValue } : undefined}
                classNames={classNames}
                components={components}
              />

              <button
                type="button"
                aria-label="下个月"
                disabled={!canGoNext}
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className={cn(navButtonClass, "right-0")}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
