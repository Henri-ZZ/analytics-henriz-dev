"use client";

import { Fragment, useMemo, useState } from "react";
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
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DailyUsagePanel } from "@/components/edit-page/daily-usage-panel";
import { JsonView } from "@/components/edit-page/json-view";
import { cn, formatNumber } from "@/lib/utils";
import { browserLabel, licenseLabel, osLabel, STATUS_META } from "@/lib/edit-page-display";
import type { FilterOptions, InstallationRow, InstallationStatus } from "@/lib/edit-page-types";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const STATUS_OPTIONS: InstallationStatus[] = ["active", "idle", "churned", "uninstalled"];

function browserName(row: InstallationRow) {
  const version = row.browserMajorVersion ? ` ${row.browserMajorVersion}` : "";
  return `${browserLabel(row.browser)}${version}`;
}

/** 日期统一展示为 YYYY-MM-DD（ISO 串前 10 位就是日期部分） */
function formatDate(iso: string) {
  return iso.slice(0, 10);
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

function StatusPill({ status }: { status: InstallationStatus }) {
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
  columnHelper.accessor("id", {
    header: ({ column }) => <SortHeader column={column} label="id" />,
    sortingFn: "basic",
    cell: ({ getValue }) => <span className="tabular-nums text-xs text-[var(--secondary)]">{getValue()}</span>,
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
    header: ({ column }) => <SortHeader column={column} label="首次出现" />,
    // ISO 8601 字符串按字典序比较即等价于按时间比较
    sortingFn: "basic",
    cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-[var(--secondary)]">{formatDate(getValue())}</span>,
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
  columnHelper.display({
    id: "settings",
    header: "设置和权限",
    cell: ({ row }) => <SettingsPopover installation={row.original} />,
  }),
];

export function InstallationsExplorer({ data, options }: { data: InstallationRow[]; options: FilterOptions }) {
  const [search, setSearch] = useState("");
  const [browser, setBrowser] = useState("");
  const [os, setOs] = useState("");
  const [channel, setChannel] = useState("");
  const [license, setLicense] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [sorting, setSorting] = useState<SortingState>([]);

  const backToFirstPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.filter((row) => {
      if (browser && row.browser !== browser) return false;
      if (os && row.os !== os) return false;
      if (channel && row.distribution !== channel) return false;
      if (license && row.licenseType !== license) return false;
      if (status && row.status !== status) return false;
      if (version && row.currentVersion !== version) return false;
      if (term) {
        const hit = row.installationId.toLowerCase().includes(term) || String(row.id).includes(term);
        if (!hit) return false;
      }
      return true;
    });
  }, [data, search, browser, os, channel, license, status, version]);

  const hasFilters = Boolean(search || browser || os || channel || license || status || version);

  const clearFilters = () => {
    setSearch("");
    setBrowser("");
    setOs("");
    setChannel("");
    setLicense("");
    setStatus("");
    setVersion("");
    backToFirstPage();
  };

  const table = useReactTable({
    data: filtered,
    columns,
    state: { expanded, pagination, sorting },
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    // 排序变化后回到第一页；enableMultiSort 关闭保证同时只有一列参与排序
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
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
      <div className="flex flex-col gap-3 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                backToFirstPage();
              }}
              placeholder="搜索 id 或 installationId"
              aria-label="搜索安装"
              className="pl-9"
            />
          </div>

          <Select
            value={browser}
            aria-label="按浏览器筛选"
            onChange={(event) => {
              setBrowser(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部浏览器</option>
            {options.browsers.map((value) => (
              <option key={value} value={value}>
                {browserLabel(value)}
              </option>
            ))}
          </Select>

          <Select
            value={os}
            aria-label="按操作系统筛选"
            onChange={(event) => {
              setOs(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部操作系统</option>
            {options.systems.map((value) => (
              <option key={value} value={value}>
                {osLabel(value)}
              </option>
            ))}
          </Select>

          <Select
            value={channel}
            aria-label="按渠道筛选"
            onChange={(event) => {
              setChannel(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部渠道</option>
            {options.channels.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>

          <Select
            value={license}
            aria-label="按授权筛选"
            onChange={(event) => {
              setLicense(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部授权</option>
            {options.licenses.map((value) => (
              <option key={value} value={value}>
                {licenseLabel(value)}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            aria-label="按状态筛选"
            onChange={(event) => {
              setStatus(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUS_META[value].label}
              </option>
            ))}
          </Select>

          <Select
            value={version}
            aria-label="按版本筛选"
            onChange={(event) => {
              setVersion(event.target.value);
              backToFirstPage();
            }}
          >
            <option value="">全部版本</option>
            {options.versions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw size={14} />
              清除筛选
            </Button>
          )}
        </div>

        <div className="text-xs text-[var(--subtle)]">
          筛选后 <span className="tabular-nums text-[var(--secondary)]">{formatNumber(filtered.length)}</span> 条
        </div>
      </div>

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
            onChange={(event) => setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} 条
              </option>
            ))}
          </Select>
          <span className="tabular-nums">共 {formatNumber(filtered.length)} 条</span>
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
