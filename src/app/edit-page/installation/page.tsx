import type { Metadata } from "next";
import Image from "next/image";
import { Database } from "lucide-react";
import { InstallationExplorer } from "@/components/edit-page/installation-explorer";
import { getFilterOptions, isEditPageDbConfigured } from "@/lib/edit-page-db";
import type { FilterOptions } from "@/lib/edit-page-types";
import { cn } from "@/lib/utils";

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

  // 只预取筛选下拉的候选值（一条轻量 DISTINCT 查询），安装列表与汇总在点击「查询」后才拉
  let options: FilterOptions = EMPTY_OPTIONS;
  let loadError: string | null = null;

  try {
    options = await getFilterOptions();
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : "未知错误";
    console.error("[edit-page] failed to load filter options", cause);
  }

  if (loadError) {
    return <Notice tone="error" title="查询 Neon 失败" description={loadError} />;
  }

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

      <InstallationExplorer initialOptions={options} />
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
