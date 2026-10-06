import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Braces, Hash, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { EDIT_PAGE_COUNTER_KEY_TOTAL, EDIT_PAGE_EVENT_SECTIONS } from "@/lib/edit-page-events";

export const metadata: Metadata = { title: "事件清单" };

export default function EditPageEventList() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/edit-page-logo.svg" alt="" width={20} height={20} unoptimized className="size-5 shrink-0 rounded-md" />
            <p className="text-sm font-medium text-[var(--accent-ink)]">Edit Page</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">事件清单</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--secondary)]">
            Edit Page 全部遥测事件的键名与含义，作为事件分析的字典。
          </p>
        </div>

        <Link href="/edit-page/events" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft size={15} />
          返回事件分析
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Info icon={<Hash size={15} />} label="计数键" value={`${EDIT_PAGE_COUNTER_KEY_TOTAL} 个`} hint="事件名 + 激活失败原因子键" />
        <Info icon={<Braces size={15} />} label="存储形态" value="events JSONB" hint="UsageDaily 按 (安装, UTC 日期) 存 { 事件名: 次数 }" />
        <Info icon={<ShieldCheck size={15} />} label="隐私边界" value="仅计数" hint="不含 URL、文本内容、图片数据或元素信息" />
      </section>

      {EDIT_PAGE_EVENT_SECTIONS.map((section) => (
        <section
          key={section.title}
          className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgb(15_23_42/.025)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <span className="rounded-full border bg-white px-2.5 py-0.5 text-xs text-[var(--secondary)]">
              {section.events.length} 个
            </span>
          </div>

          {section.note && (
            <p className="border-b bg-[var(--muted)]/40 px-5 py-2.5 text-xs leading-5 text-[var(--subtle)]">{section.note}</p>
          )}

          <Table>
            <TableBody>
              {section.events.map((event) => (
                <TableRow key={event.key}>
                  <TableCell className="w-[21rem] align-top">
                    <code className="font-mono text-xs text-[var(--ink)]">{event.key}</code>
                  </TableCell>
                  <TableCell className="align-top text-xs leading-5 text-[var(--secondary)]">{event.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}

function Info({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white/65 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-[var(--subtle)]">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--subtle)]">{hint}</div>
    </div>
  );
}
