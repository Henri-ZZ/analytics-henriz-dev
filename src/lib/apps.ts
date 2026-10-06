import { FilePenLine, type LucideIcon } from "lucide-react";

export type AnalyticsApp = {
  name: string;
  slug: string;
  description: string;
  status: "ready" | "coming-soon";
  icon: LucideIcon;
};

export const analyticsApps: AnalyticsApp[] = [
  {
    name: "Edit Page",
    slug: "/edit-page",
    description: "编辑行为、页面使用与产品体验分析",
    status: "coming-soon",
    icon: FilePenLine,
  },
];
