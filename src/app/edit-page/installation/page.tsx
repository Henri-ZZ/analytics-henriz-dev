import type { Metadata } from "next";
import Image from "next/image";
import { Boxes, CircleCheck, Database, MousePointerClick, Pencil } from "lucide-react";
import { InstallationsExplorer } from "@/components/edit-page/installations-explorer";
import { getFilterOptions, getInstallationSummary, isEditPageDbConfigured, listInstallations } from "@/lib/edit-page-db";
import type { EditPageSummary, FilterOptions, InstallationRow } from "@/lib/edit-page-types";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "安装分析" };
export const dynamic = "force-dynamic";

const EMPTY_OPTIONS: FilterOptions = { browsers: [], systems: [], channels: [], licenses: [], versions: [] };

export default async function EditPageInstallationAnalytics() {
  if (!isEditPageDbConfigured()) {
    return (
      <Notice
        title="尚未配置 Edit Page 数据源"
        description="在 .env.local 中填写 EDIT_PAGE_DATABASE_URL（Edit Page 的 Neon Postgres 连接串）后重启 dev server，即可展示真实的安装与每日使用数据。"
      />
    );
  }

  let installations: InstallationRow[] = [];
  let options: FilterOptions = EMPTY_OPTIONS;
  let summary: EditPageSummary | null = null;
  let loadError: string | null = null;

  try {
    const [rows, filterOptions, aggregate] = await Promise.all([
      listInstallations(),
      getFilterOptions(),
      getInstallationSummary(),
    ]);
    installations = rows;
    options = filterOptions;
    summary = aggregate;
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : "未知错误";
    console.error("[edit-page] failed to load installations", cause);
  }

  if (loadError || !summary) {
    return <Notice tone="error" title="查询 Neon 失败" description={loadError ?? "未知错误"} />;
  }

  const loadedCount = installations.length;
  const truncated = summary.total > loadedCount;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/edit-page-logo.svg" alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-md" />
            <p className="text-sm font-medium text-[var(--accent-ink)]">Edit Page</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">安装分析</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--secondary)]">
            数据直连 Edit Page 的 Neon 遥测库。展开任意一行，查看该安装近 30 天的每日使用明细。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-[var(--secondary)]">
          <span className="size-2 rounded-full bg-emerald-500" />
          Neon 已连接
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">全部安装</h2>
            <p className="mt-0.5 text-xs text-[var(--subtle)]">按最近活跃倒序，支持搜索与筛选；点击任意一行展开每日使用子表格</p>
          </div>
          <span className="rounded-full border bg-white px-3 py-1 text-xs text-[var(--secondary)]">
            {formatNumber(summary.total)} 个安装
          </span>
        </div>

        {truncated && (
          <div className="border-b bg-amber-50/60 px-5 py-2.5 text-xs leading-5 text-amber-800">
            数据量较大，仅加载了按最近活跃排序的前 {formatNumber(loadedCount)} 条（共 {formatNumber(summary.total)} 条）。请用搜索或筛选缩小范围。
          </div>
        )}

        <InstallationsExplorer data={installations} options={options} />
      </section>
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

function Notice({
  title,
  description,
  tone = "info",
}: {
  title: string;
  description: string;
  tone?: "info" | "error";
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Image src="/edit-page-logo.svg" alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-md" />
        <p className="text-sm font-medium text-[var(--accent-ink)]">Edit Page</p>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">安装分析</h1>
      <div
        className={cn(
          "mt-6 rounded-2xl border p-6 sm:p-8",
          tone === "error" ? "border-rose-200 bg-rose-50/50" : "bg-white",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              tone === "error" ? "bg-rose-100 text-rose-600" : "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
            )}
          >
            <Database size={19} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--secondary)]">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
