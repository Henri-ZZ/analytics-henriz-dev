import type { Metadata } from "next";
import { BarChart3, Database, MousePointerClick } from "lucide-react";

export const metadata: Metadata = { title: "Edit Page" };

export default function EditPageAnalytics() {
  return <div><div><p className="mb-2 text-sm font-medium text-[var(--accent)]">Edit Page</p><h1 className="text-3xl font-semibold tracking-[-.035em]">分析空间已就绪</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--secondary)]">路由、导航和页面容器已经准备好。下一步接入遥测源后，我们会在这里加入真正的指标、趋势和明细。</p></div>
    <div className="mt-9 grid gap-4 md:grid-cols-3"><Placeholder icon={<MousePointerClick size={19} />} title="使用指标" text="核心操作与功能采用" /><Placeholder icon={<BarChart3 size={19} />} title="趋势分析" text="活跃与留存变化" /><Placeholder icon={<Database size={19} />} title="事件明细" text="可筛选的遥测记录" /></div>
    <div className="mt-6 rounded-2xl border bg-white p-6 sm:p-8"><div className="flex min-h-72 flex-col items-center justify-center text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#e8f0eb] text-[var(--accent)]"><Database size={22} /></span><h2 className="mt-5 text-base font-semibold">等待定义分析页面</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--secondary)]">告诉我你最想了解 Edit Page 的哪些问题，我们再从问题出发设计指标和页面，而不是先堆图表。</p></div></div>
  </div>;
}

function Placeholder({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-xl border bg-white/70 p-4"><span className="text-[var(--accent)]">{icon}</span><div className="mt-5 text-sm font-semibold">{title}</div><div className="mt-1 text-xs text-[var(--subtle)]">{text}</div></div>; }
