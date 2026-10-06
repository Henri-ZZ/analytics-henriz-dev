"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
} from "@tanstack/react-table";
import { ChevronRight, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatNumber } from "@/lib/utils";
import type { DailyUsageRow, InstallationRow, InstallationStatus } from "@/lib/edit-page-types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  opera: "Opera",
  vivaldi: "Vivaldi",
  other_chromium: "Chromium",
};

const OS_LABELS: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  chromeos: "ChromeOS",
  android: "Android",
  other: "Other",
};

const statusMeta: Record<InstallationStatus, { label: string; dot: string; text: string }> = {
  active: { label: "活跃", dot: "bg-emerald-500", text: "text-emerald-700" },
  idle: { label: "沉默", dot: "bg-amber-400", text: "text-amber-700" },
  churned: { label: "流失", dot: "bg-rose-400", text: "text-rose-600" },
  uninstalled: { label: "已卸载", dot: "bg-[#b6bdb9]", text: "text-[var(--subtle)]" },
};

function platformLabel(row: InstallationRow) {
  const browser = BROWSER_LABELS[row.browser] ?? row.browser;
  const major = row.browserMajorVersion ? ` ${row.browserMajorVersion}` : "";
  const os = OS_LABELS[row.os] ?? row.os;
  return `${browser}${major} · ${os}`;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split(/[-T]/).map(Number);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function formatMonthDay(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

function weekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function relativeDays(days: number) {
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function LicenseBadge({ licenseType }: { licenseType: string }) {
  const premium = licenseType === "premium";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        premium ? "bg-[#efe8f7] text-[#5b3f8f]" : "bg-[var(--muted)] text-[var(--secondary)]",
      )}
    >
      {premium ? "Premium" : "Free"}
    </span>
  );
}

function StatusPill({ status }: { status: InstallationStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.text)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[.08em] text-[var(--subtle)]">{label}</dt>
      <dd className="mt-0.5 text-xs text-[var(--ink)]">{value}</dd>
    </div>
  );
}

const columnHelper = createColumnHelper<InstallationRow>();

const columns = [
  columnHelper.display({
    id: "expander",
    header: () => null,
    cell: ({ row }) => (
      <button
        type="button"
        aria-label={row.getIsExpanded() ? "收起每日使用" : "展开每日使用"}
        aria-expanded={row.getIsExpanded()}
        onClick={(event) => {
          event.stopPropagation();
          row.toggleExpanded();
        }}
        className="grid size-7 place-items-center rounded-md text-[var(--subtle)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]"
      >
        <ChevronRight size={16} className={cn("transition-transform duration-200", row.getIsExpanded() && "rotate-90")} />
      </button>
    ),
  }),
  columnHelper.accessor("installationId", {
    header: "安装",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="font-mono text-xs font-medium text-[var(--ink)]" title={row.original.installationId}>
          {row.original.installationId.slice(0, 8)}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-xs text-[var(--subtle)]">{platformLabel(row.original)}</div>
      </div>
    ),
  }),
  columnHelper.accessor("licenseType", {
    header: "授权",
    cell: ({ getValue }) => <LicenseBadge licenseType={getValue()} />,
  }),
  columnHelper.accessor("status", {
    header: "状态",
    cell: ({ getValue }) => <StatusPill status={getValue()} />,
  }),
  columnHelper.accessor("currentVersion", {
    header: "版本",
    cell: ({ row }) => (
      <div className="text-xs">
        <div className="font-medium tabular-nums text-[var(--ink)]">{row.original.currentVersion}</div>
        {row.original.firstVersion !== row.original.currentVersion && (
          <div className="mt-0.5 text-[var(--subtle)]">首次 {row.original.firstVersion}</div>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("edits7d", {
    header: "近 7 日编辑",
    cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatNumber(getValue())}</span>,
  }),
  columnHelper.accessor("activeDays7d", {
    header: "近 7 日活跃",
    cell: ({ getValue }) => <span className="tabular-nums text-[var(--secondary)]">{getValue()} 天</span>,
  }),
  columnHelper.accessor("daysSinceLastSeen", {
    header: "最近活跃",
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-xs">
        <div className="text-[var(--secondary)]">{relativeDays(row.original.daysSinceLastSeen)}</div>
        <div className="mt-0.5 text-[var(--subtle)]">{formatDate(row.original.lastSeenAt)}</div>
      </div>
    ),
  }),
];

type UsageState = { status: "loading" | "ready" | "error"; days: DailyUsageRow[] };

function DailyUsagePanel({ installation }: { installation: InstallationRow }) {
  const [state, setState] = useState<UsageState>({ status: "loading", days: [] });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/edit-page/installations/${installation.installationId}/usage`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { days?: DailyUsageRow[] };
        setState({ status: "ready", days: payload.days ?? [] });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", days: [] });
      });

    return () => controller.abort();
  }, [installation.installationId]);

  const maxEvents = Math.max(...state.days.map((day) => day.events), 1);
  const totalEdits = state.days.reduce((total, day) => total + day.edits, 0);

  return (
    <div className="border-t border-dashed border-[var(--border)] bg-[var(--muted)]/50 px-5 py-4">
      <dl className="flex flex-wrap gap-x-6 gap-y-3">
        <Meta
          label="完整 ID"
          value={<span className="font-mono break-all">{installation.installationId}</span>}
        />
        <Meta label="授权" value={<LicenseBadge licenseType={installation.licenseType} />} />
        <Meta label="版本" value={`${installation.firstVersion} → ${installation.currentVersion}`} />
        <Meta label="平台" value={platformLabel(installation)} />
        <Meta label="语言 / 渠道" value={`${installation.locale} · ${installation.distribution}`} />
        <Meta label="首次出现" value={formatDate(installation.firstSeenAt)} />
        <Meta label="最近活跃" value={formatDate(installation.lastSeenAt)} />
        <Meta label="30 天编辑" value={state.status === "ready" ? formatNumber(totalEdits) : "—"} />
      </dl>

      <div className="mt-4">
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
                  <TableHead className="w-40">强度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.days.map((day) => (
                  <TableRow key={day.date} className="hover:bg-[var(--muted)]/60">
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium tabular-nums">{formatMonthDay(day.date)}</span>
                      <span className="ml-2 text-xs text-[var(--subtle)]">{weekdayOf(day.date)}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(day.edits)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.editStarts)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.dashboardOpens)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.imageReplaces)}</TableCell>
                    <TableCell className="tabular-nums text-[var(--secondary)]">{formatNumber(day.events)}</TableCell>
                    <TableCell>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]/70"
                          style={{ width: `${Math.max(4, (day.events / maxEvents) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallationsTable({ data }: { data: InstallationRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-[var(--subtle)]">
              还没有任何安装上报。
            </TableCell>
          </TableRow>
        )}

        {table.getRowModel().rows.map((row) => (
          <Fragment key={row.id}>
            <TableRow
              onClick={row.getToggleExpandedHandler()}
              className={cn("cursor-pointer hover:bg-[var(--muted)]/70", row.getIsExpanded() && "bg-[var(--muted)]/40")}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
            {row.getIsExpanded() && (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                  <DailyUsagePanel key={row.original.installationId} installation={row.original} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
