import { redirect } from "next/navigation";

/** 安装分析已迁到 /edit-page/installation，旧路径保留重定向（首页应用卡片仍指向 /edit-page） */
export default function EditPageIndex() {
  redirect("/edit-page/installation");
}
