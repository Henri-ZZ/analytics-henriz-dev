import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: { default: "Henri Analytics", template: "%s · Henri Analytics" }, description: "Henri 产品数据分析工作台" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning：浏览器扩展等外部脚本会在 React 加载前改动 <html> 属性
  // （例如 GA 退出插件写入的 data-google-analytics-opt-out），这不是服务端/客户端渲染不一致
  return <html lang="zh-CN" suppressHydrationWarning><body><AppShell>{children}</AppShell></body></html>;
}
