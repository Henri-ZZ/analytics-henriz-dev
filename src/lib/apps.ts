import { FilePenLine, type LucideIcon } from "lucide-react";

/** 应用下的分析页面，渲染为侧边栏二级菜单 */
export type AnalyticsAppPage = {
  name: string;
  /** 绝对路径 */
  slug: string;
};

export type AnalyticsApp = {
  name: string;
  slug: string;
  description: string;
  /** public/ 下的静态资源路径；存在时优先展示该 logo，否则回退到 icon */
  logoSrc?: string;
  icon: LucideIcon;
  /** 二级菜单；为空时该应用在侧边栏直接是一个链接 */
  children?: AnalyticsAppPage[];
};

export const analyticsApps: AnalyticsApp[] = [
  {
    name: "Edit Page",
    slug: "/edit-page",
    description: "编辑行为、页面使用与产品体验分析",
    logoSrc: "/edit-page-logo.svg",
    icon: FilePenLine,
    children: [
      { name: "安装分析", slug: "/edit-page/installation" },
      { name: "事件分析", slug: "/edit-page/events" },
      { name: "分布分析", slug: "/edit-page/distribution" },
      { name: "卸载分析", slug: "/edit-page/uninstall" },
    ],
  },
];
