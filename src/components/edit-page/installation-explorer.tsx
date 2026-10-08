"use client";

import { useMemo, useState } from "react";
import type { PaginationState, RowSelectionState } from "@tanstack/react-table";
import * as Dialog from "@radix-ui/react-dialog";
import { Boxes, CircleCheck, Filter, FilterX, MousePointerClick, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, InstallationsTable } from "@/components/edit-page/installations-table";
import { browserLabel, licenseLabel, osLabel, STATUS_META } from "@/lib/edit-page-display";
import type {
  DeletedInstallationsResult,
  EditPageSummary,
  FilterOptions,
  InstallationRow,
  InstallationStatus,
} from "@/lib/edit-page-types";
import { formatNumber } from "@/lib/utils";

const STATUS_OPTIONS: InstallationStatus[] = ["active", "idle", "churned", "uninstalled"];

/** 外层常量，保证 useMemo 的依赖引用稳定 */
const EMPTY_ROWS: InstallationRow[] = [];

const QUERY_ERROR_MESSAGES: Record<string, string> = {
  database_not_configured: "尚未配置 EDIT_PAGE_DATABASE_URL",
  query_failed: "数据库查询失败，请查看服务端日志",
};

/** PATCH（过滤标记）与 DELETE（硬删除）共用的错误码文案 */
const WRITE_ERROR_MESSAGES: Record<string, string> = {
  database_not_configured: "尚未配置 EDIT_PAGE_DATABASE_URL",
  invalid_ids: "没有选中有效的数据",
  too_many_ids: "一次最多操作 200 个安装",
  invalid_filtered: "过滤参数不合法",
  cross_origin_rejected: "请求来源校验未通过",
  update_failed: "过滤标记更新失败，请查看服务端日志",
  delete_failed: "数据库删除失败，请查看服务端日志",
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
  /** "" | "no" 未过滤 | "yes" 已过滤 */
  const [filteredFlag, setFilteredFlag] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [state, setState] = useState<QueryState>({ status: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeletedInstallationsResult | null>(null);
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  /**
   * 筛选条件变化 / 重新查询后：回到第一页、清空选中、清掉上一次的删除提示。
   * 清空选中是必须的——否则被筛掉的选中项会藏起来，变成"看不见的删除"。
   */
  const resetView = () => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setRowSelection({});
    setDeleteResult(null);
  };

  /**
   * 拉取列表与 KPI。
   * - keepView：保留当前分页与选中，用于「过滤标记」这类"行还在、只是状态变了"的刷新
   * - silent：不切到 loading 态，直接静默替换数据，避免表格闪一下
   */
  const runQuery = async (options?: { keepView?: boolean; silent?: boolean }) => {
    if (!options?.silent) setState({ status: "loading" });
    if (!options?.keepView) resetView();

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
      if (filteredFlag === "yes" && row.filteredAt === null) return false;
      if (filteredFlag === "no" && row.filteredAt !== null) return false;
      if (term) {
        // 只按 installationId 搜；数据库主键不在界面上展示，搜它会让结果对不上号
        if (!row.installationId.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, browser, os, channel, license, status, version, filteredFlag]);

  const hasFilters = Boolean(search || browser || os || channel || license || status || version || filteredFlag);

  const clearFilters = () => {
    setSearch("");
    setBrowser("");
    setOs("");
    setChannel("");
    setLicense("");
    setStatus("");
    setVersion("");
    setFilteredFlag("");
    resetView();
  };

  // 选中项按当前筛选结果取，保证弹窗里列出来的就是即将被删的那些行
  const selectedRows = useMemo(
    () => filtered.filter((row) => rowSelection[row.installationId]),
    [filtered, rowSelection],
  );

  const selectedFilteredCount = selectedRows.filter((row) => row.filteredAt !== null).length;
  /** 硬删除不可撤销，所以要求整批都先打过过滤标，避免手滑直接删生产数据 */
  const allSelectedFiltered = selectedRows.length > 0 && selectedFilteredCount === selectedRows.length;

  /** 打上 / 取消过滤标记。过滤不改变行的存在，所以保留选中与分页，方便接着点删除 */
  const applyFilter = async (nextFiltered: boolean) => {
    if (selectedRows.length === 0) return;

    setFilterBusy(true);
    setFilterError(null);

    try {
      const response = await fetch("/api/edit-page/installations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationIds: selectedRows.map((row) => row.installationId),
          filtered: nextFiltered,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const code = payload?.error ?? `HTTP ${response.status}`;
        throw new Error(WRITE_ERROR_MESSAGES[code] ?? code);
      }

      setDeleteResult(null);
      await runQuery({ keepView: true, silent: true });
    } catch (cause) {
      setFilterError(cause instanceof Error ? cause.message : "未知错误");
    } finally {
      setFilterBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedRows.length === 0) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/edit-page/installations", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationIds: selectedRows.map((row) => row.installationId) }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const code = payload?.error ?? `HTTP ${response.status}`;
        throw new Error(WRITE_ERROR_MESSAGES[code] ?? code);
      }

      const result = (await response.json()) as DeletedInstallationsResult;
      setConfirmOpen(false);
      setRowSelection({});
      // 静默重拉列表与顶部 KPI，避免关掉弹窗后表格闪一下；提示写在后面，避免被 resetView 清掉
      await runQuery({ silent: true });
      setDeleteResult(result);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "未知错误");
    } finally {
      setDeleting(false);
    }
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
                  resetView();
                }}
                placeholder="搜索 installationId"
                aria-label="搜索安装"
                className="pl-9"
              />
            </div>

            <Select
              value={browser}
              aria-label="按浏览器筛选"
              onChange={(event) => {
                setBrowser(event.target.value);
                resetView();
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
                resetView();
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
                resetView();
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
                resetView();
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
                resetView();
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
                resetView();
              }}
            >
              <option value="">全部版本</option>
              {options.versions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>

            <Select
              value={filteredFlag}
              aria-label="按过滤状态筛选"
              onChange={(event) => {
                setFilteredFlag(event.target.value);
                resetView();
              }}
            >
              <option value="">全部过滤状态</option>
              <option value="no">仅未过滤</option>
              <option value="yes">仅已过滤</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw size={14} />
                清除筛选
              </Button>
            )}
            <Button onClick={() => runQuery()} disabled={loading}>
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
              hint={`${summary.active} 活跃 · ${summary.idle} 沉默 · ${summary.churned} 流失 · ${summary.uninstalled} 已卸载 · ${summary.filtered} 已过滤`}
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
                  默认按序号倒序（最新安装在前），点击表头可切换排序；点击任意一行展开每日使用子表格
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

            {selectedRows.length > 0 && (
              <div className="border-b bg-[var(--accent-soft)]/50 px-5 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-[var(--secondary)]">
                    已选 <span className="font-semibold tabular-nums text-[var(--ink)]">{formatNumber(selectedRows.length)}</span> 项
                    {selectedFilteredCount > 0 && (
                      <>
                        {" · 其中 "}
                        <span className="tabular-nums">{formatNumber(selectedFilteredCount)}</span> 已过滤
                      </>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
                    取消选择
                  </Button>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {!allSelectedFiltered && (
                      <span className="text-[11px] text-[var(--subtle)]">整批已过滤后才能删除</span>
                    )}
                    {selectedFilteredCount < selectedRows.length && (
                      <Button variant="outline" size="sm" onClick={() => applyFilter(true)} disabled={filterBusy}>
                        <Filter size={14} />
                        过滤
                      </Button>
                    )}
                    {selectedFilteredCount > 0 && (
                      <Button variant="outline" size="sm" onClick={() => applyFilter(false)} disabled={filterBusy}>
                        <FilterX size={14} />
                        取消过滤
                      </Button>
                    )}
                    {allSelectedFiltered && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmOpen(true);
                        }}
                      >
                        <Trash2 size={14} />
                        删除
                      </Button>
                    )}
                  </div>
                </div>

                {filterError && <p className="mt-2 text-xs text-rose-600">过滤操作失败：{filterError}</p>}
              </div>
            )}

            {selectedRows.length === 0 && deleteResult && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-emerald-50/70 px-5 py-2.5 text-xs text-emerald-800">
                <CircleCheck size={14} className="shrink-0" />
                <span>
                  已删除 {formatNumber(deleteResult.installations)} 个安装 · {" "}
                  {formatNumber(deleteResult.usage)} 行每日使用 · {formatNumber(deleteResult.requests)} 条上报记录
                </span>
                <button
                  type="button"
                  aria-label="关闭提示"
                  onClick={() => setDeleteResult(null)}
                  className="ml-auto grid size-6 place-items-center rounded-md transition-colors hover:bg-emerald-100"
                >
                  <X size={14} />
                </button>
              </div>
            )}

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
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </section>
        </>
      )}

      <Dialog.Root open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold">
              确认删除这 {formatNumber(selectedRows.length)} 个安装？
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs leading-5 text-[var(--secondary)]">
              将永久删除这些安装的记录，以及它们关联的每日使用数据（UsageDaily）与上报记录（TelemetryRequest）。
              此操作不可撤销。
            </Dialog.Description>

            <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-xl border bg-[var(--muted)]/40 px-3 py-2 text-xs">
              {selectedRows.map((row) => (
                <li key={row.installationId} className="flex items-center gap-2">
                  <span className="shrink-0 tabular-nums text-[var(--subtle)]">#{row.seq}</span>
                  <span className="truncate font-mono text-[var(--secondary)]">{row.installationId}</span>
                  <span className="ml-auto shrink-0 text-[var(--subtle)]">{row.currentVersion}</span>
                </li>
              ))}
            </ul>

            {deleteError && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                删除失败：{deleteError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm" disabled={deleting}>
                  取消
                </Button>
              </Dialog.Close>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
                <Trash2 size={14} />
                {deleting ? "删除中…" : "确认删除"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
