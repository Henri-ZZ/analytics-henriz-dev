"use client";

import { useMemo, useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { Boxes, CircleCheck, MousePointerClick, Pencil, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, InstallationsTable } from "@/components/edit-page/installations-table";
import { browserLabel, licenseLabel, osLabel, STATUS_META } from "@/lib/edit-page-display";
import type { EditPageSummary, FilterOptions, InstallationRow, InstallationStatus } from "@/lib/edit-page-types";
import { formatNumber } from "@/lib/utils";

const STATUS_OPTIONS: InstallationStatus[] = ["active", "idle", "churned", "uninstalled"];

/** 外层常量，保证 useMemo 的依赖引用稳定 */
const EMPTY_ROWS: InstallationRow[] = [];

const QUERY_ERROR_MESSAGES: Record<string, string> = {
  database_not_configured: "尚未配置 EDIT_PAGE_DATABASE_URL",
  query_failed: "数据库查询失败，请查看服务端日志",
};

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: InstallationRow[]; options: FilterOptions; summary: EditPageSummary };

export function InstallationExplorer({ initialOptions }: { initialOptions: FilterOptions }) {
  const [search, setSearch] = useState("");
  const [browser, setBrowser] = useState("");
  const [os, setOs] = useState("");
  const [channel, setChannel] = useState("");
  const [license, setLicense] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [state, setState] = useState<QueryState>({ status: "idle" });

  const backToFirstPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }));

  const runQuery = async () => {
    setState({ status: "loading" });
    backToFirstPage();

    try {
      const response = await fetch("/api/edit-page/installations");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const code = payload?.error ?? `HTTP ${response.status}`;
        throw new Error(QUERY_ERROR_MESSAGES[code] ?? code);
      }

      const payload = (await response.json()) as {
        rows: InstallationRow[];
        options: FilterOptions;
        summary: EditPageSummary;
      };
      setState({ status: "ready", rows: payload.rows, options: payload.options, summary: payload.summary });
    } catch (cause) {
      setState({ status: "error", message: cause instanceof Error ? cause.message : "未知错误" });
    }
  };

  // 查询成功后用返回的候选值覆盖，保证下拉里能看到新增的版本 / 渠道
  const options = state.status === "ready" ? state.options : initialOptions;
  const rows = state.status === "ready" ? state.rows : EMPTY_ROWS;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
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
  }, [rows, search, browser, os, channel, license, status, version]);

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

  const loading = state.status === "loading";
  const summary = state.status === "ready" ? state.summary : null;
  const truncated = summary !== null && summary.total > rows.length;

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">查询条件</h2>
          <p className="mt-0.5 text-xs text-[var(--subtle)]">按环境属性筛选安装，点「查询」从 Neon 读取最新数据</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
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
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw size={14} />
                清除筛选
              </Button>
            )}
            <Button onClick={runQuery} disabled={loading}>
              <Search size={15} />
              {loading ? "查询中…" : "查询"}
            </Button>
          </div>
        </div>
      </section>

      {state.status === "idle" && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-5 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
              <Boxes size={22} />
            </span>
            <p className="mt-5 text-sm font-medium">还没有查询结果</p>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-[var(--subtle)]">
              设置好筛选条件后点「查询」，读取安装列表与近 7 日使用汇总。
            </p>
          </div>
        </section>
      )}

      {loading && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
          <div className="flex min-h-72 items-center justify-center px-5 py-5 text-sm text-[var(--subtle)]">正在查询…</div>
        </section>
      )}

      {state.status === "error" && (
        <section className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/50 shadow-[0_1px_2px_rgb(15_23_42/.025)]">
          <div className="flex min-h-72 items-center justify-center px-5 py-5 text-sm text-rose-600">
            查询失败：{state.message}
          </div>
        </section>
      )}

      {summary !== null && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={<Boxes size={15} />}
              label="安装总数"
              value={formatNumber(summary.total)}
              hint={`${summary.active} 活跃 · ${summary.idle} 沉默 · ${summary.churned} 流失 · ${summary.uninstalled} 已卸载`}
            />
            <Stat
              icon={<CircleCheck size={15} />}
              label="活跃安装"
              value={formatNumber(summary.active)}
              hint="近 7 天有上报记录"
            />
            <Stat
              icon={<Pencil size={15} />}
              label="近 7 日编辑"
              value={formatNumber(summary.edits7d)}
              hint={`全部事件 ${formatNumber(summary.events7d)} 次`}
            />
            <Stat
              icon={<MousePointerClick size={15} />}
              label="近 7 日有使用安装"
              value={formatNumber(summary.usedLast7d)}
              hint={summary.total > 0 ? `占比 ${Math.round((summary.usedLast7d / summary.total) * 100)}%` : "—"}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">全部安装</h2>
                <p className="mt-0.5 text-xs text-[var(--subtle)]">
                  默认按 id 倒序，点击表头可切换排序；点击任意一行展开每日使用子表格
                  {hasFilters && (
                    <>
                      {" · 筛选后 "}
                      <span className="tabular-nums text-[var(--secondary)]">{formatNumber(filtered.length)}</span> 条
                    </>
                  )}
                </p>
              </div>
              <span className="rounded-full border bg-white px-3 py-1 text-xs text-[var(--secondary)]">
                {formatNumber(summary.total)} 个安装
              </span>
            </div>

            {truncated && (
              <div className="border-b bg-amber-50/60 px-5 py-2.5 text-xs leading-5 text-amber-800">
                数据量较大，仅加载了按最近活跃排序的前 {formatNumber(rows.length)} 条（共 {formatNumber(summary.total)}{" "}
                条）。请用搜索或筛选缩小范围。
              </div>
            )}

            <InstallationsTable
              data={filtered}
              hasFilters={hasFilters}
              pagination={pagination}
              onPaginationChange={setPagination}
            />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white/65 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-[var(--subtle)]">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--subtle)]">{hint}</div>
    </div>
  );
}
