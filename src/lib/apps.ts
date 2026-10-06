import { FilePenLine, type LucideIcon } from "lucide-react";

export type AnalyticsApp = {
  name: string;
  slug: string;
  description: string;
  /** public/ 下的静态资源路径；存在时优先展示该 logo，否则回退到 icon */
  logoSrc?: string;
  icon: LucideIcon;
};

export const analyticsApps: AnalyticsApp[] = [
  {
    name: "Edit Page",
    slug: "/edit-page",
    description: "编辑行为、页面使用与产品体验分析",
    logoSrc: "/edit-page-logo.svg",
    icon: FilePenLine,
  },
];
