"use client";

import { Fragment, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ExpandedState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DailyUsagePanel } from "@/components/edit-page/daily-usage-panel";
import { JsonView } from "@/components/edit-page/json-view";
import { cn, formatNumber } from "@/lib/utils";
import { displayDate } from "@/lib/timezone";
import { browserLabel, licenseLabel, osLabel, STATUS_META } from "@/lib/edit-page-display";
import type { InstallationRow } from "@/lib/edit-page-types";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

function browserName(row: InstallationRow) {
  const version = row.browserMajorVersion ? ` ${row.browserMajorVersion}` : "";
  return `${browserLabel(row.browser)}${version}`;
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
      {licenseLabel(licenseType)}
    </span>
  );
}

function StatusPill({ status }: { status: InstallationRow["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.text)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/**
 * 可排序表头：点击在「升序 → 降序 → 不排序」之间循环。
 * 单列排序由 table 的 enableMultiSort: false 保证。
 */
function SortHeader<TData, TValue>({ column, label }: { column: Column<TData, TValue>; label: string }) {
  const sorted = column.getIsSorted();
  const next = column.getNextSortingOrder();
  const hint = next === "asc" ? "升序" : next === "desc" ? "降序" : "取消排序";
  const active = sorted === "asc" || sorted === "desc";

  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      title={hint}
      aria-label={`${label}：${hint}`}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)]",
        active && "text-[var(--accent-ink)] hover:text-[var(--accent)]",
      )}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp size={14} className="shrink-0" />
      ) : sorted === "desc" ? (
        <ArrowDown size={14} className="shrink-0" />
      ) : (
        <ArrowUpDown size={14} className="shrink-0 opacity-40" />
      )}
    </button>
  );
}

function SettingsPopover({ installation }: { installation: InstallationRow }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className="text-xs font-medium text-[var(--accent-ink)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
        >
          查看
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-white p-4 shadow-xl"
        >
          <div className="space-y-4">
            <section>
              <h4 className="mb-1.5 text-xs font-semibold text-[var(--secondary)]">settings</h4>
              <JsonView value={installation.settings} />
            </section>
            <section>
              <h4 className="mb-1.5 text-xs font-semibold text-[var(--secondary)]">optionalPermissions</h4>
              <JsonView value={installation.optionalPermissions} />
            </section>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  columnHelper.accessor("seq", {
    header: ({ column }) => <SortHeader column={column} label="序号" />,
    sortingFn: "basic",
    cell: ({ getValue }) => <span className="tabular-nums text-xs text-[var(--secondary)]">{formatNumber(getValue())}</span>,
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
    header: ({ column }) => <SortHeader column={column} label="版本" />,
    // 版本号按语义比较，否则 "2.10.0" 会被排在 "2.2.2" 前面
    sortingFn: (rowA, rowB) =>
      rowA.original.currentVersion.localeCompare(rowB.original.currentVersion, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-xs">
        <div className="font-medium tabular-nums text-[var(--ink)]">{row.original.currentVersion}</div>
        {row.original.firstVersion !== row.original.currentVersion && (
          <div className="mt-0.5 text-[var(--subtle)]">首次 {row.original.firstVersion}</div>
        )}
      </div>
    ),
  }),
  columnHelper.display({
    id: "browser",
    header: "浏览器",
    cell: ({ row }) => <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{browserName(row.original)}</span>,
  }),
  columnHelper.display({
    id: "os",
    header: "操作系统",
    cell: ({ row }) => <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{osLabel(row.original.os)}</span>,
  }),
  columnHelper.accessor("locale", {
    header: "语言",
    cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{getValue()}</span>,
  }),
  columnHelper.accessor("distribution", {
    header: "渠道",
    cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{getValue()}</span>,
  }),
  columnHelper.accessor("firstSeenAt", {
    header: ({ column }) => <SortHeader column={column} label="首次上报" />,
    // ISO 8601 字符串按字典序比较即等价于按时间比较
    sortingFn: "basic",
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{displayDate(getValue())}</span>
    ),
  }),
  columnHelper.accessor("lastSeenAt", {
    header: ({ column }) => <SortHeader column={column} label="最近上报" />,
    // ISO 8601 字符串按字典序比较即等价于按时间比较
    sortingFn: "basic",
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-xs">
        <div className="text-[var(--secondary)]">{relativeDays(row.original.daysSinceLastSeen)}</div>
        <div className="mt-0.5 text-[var(--subtle)]">{displayDate(row.original.lastSeenAt)}</div>
      </div>
    ),
  }),
  columnHelper.display({
    id: "settings",
    header: "设置和权限",
    cell: ({ row }) => <SettingsPopover installation={row.original} />,
  }),
];

/**
 * 安装列表表格。数据由外层按筛选条件过滤后传入；
 * 分页状态提升到外层，方便「筛选变化 / 重新查询」时回到第一页。
 */
export function InstallationsTable({
  data,
  hasFilters,
  pagination,
  onPaginationChange,
}: {
  data: InstallationRow[];
  hasFilters: boolean;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  // 默认序号倒序（序号按 id 升序生成，所以等价于原来的 id 降序：最新安装在前）
  const [sorting, setSorting] = useState<SortingState>([{ id: "seq", desc: true }]);

  const table = useReactTable({
    data,
    columns,
    state: { expanded, pagination, sorting },
    onExpandedChange: setExpanded,
    onPaginationChange,
    // 排序变化后回到第一页；enableMultiSort 关闭保证同时只有一列参与排序
    onSortingChange: (updater) => {
      setSorting(updater);
      onPaginationChange((prev) => ({ ...prev, pageIndex: 0 }));
    },
    enableMultiSort: false,
    enableSortingRemoval: true,
    autoResetPageIndex: false,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div>
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
                {hasFilters ? "没有符合条件的安装。" : "还没有任何安装上报。"}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-[var(--secondary)]">
          <span>每页</span>
          <Select
            value={String(pagination.pageSize)}
            aria-label="每页条数"
            className="h-8 pr-7 text-xs"
            onChange={(event) => onPaginationChange({ pageIndex: 0, pageSize: Number(event.target.value) })}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} 条
              </option>
            ))}
          </Select>
          <span className="tabular-nums">共 {formatNumber(data.length)} 条</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--secondary)]">
          <span className="tabular-nums">
            第 {pagination.pageIndex + 1} / {pageCount} 页
          </span>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft size={14} />
            上一页
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            下一页
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
