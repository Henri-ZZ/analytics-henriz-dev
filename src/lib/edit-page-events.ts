/**
 * Edit Page 的遥测事件目录（中文说明）。
 *
 * 键名严格对应 edit-page-web 的
 * `src/lib/telemetry/constants.ts` → TELEMETRY_EVENTS / ACTIVATION_FAILURE_REASONS，
 * 说明依据 `docs/EDIT_PAGE_TELEMETRY_SPEC.md` §7.2「Counting semantics」。
 * 上游新增事件时需要同步这里。
 */

export type EditPageEvent = {
  /** 事件计数器键名，也是 UsageDaily.events 里的 key */
  key: string;
  /** 中文说明：这个计数在什么时候 +1 */
  description: string;
};

export type EditPageEventSection = {
  title: string;
  /** 该组事件的共同注意事项 */
  note?: string;
  events: EditPageEvent[];
};

export const EDIT_PAGE_EVENT_SECTIONS: EditPageEventSection[] = [
  {
    title: "核心使用",
    events: [
      {
        key: "dashboard.open",
        description: "扩展控制面板完成打开。每次页面加载计 1 次。",
      },
      {
        key: "edit.start",
        description: "编辑模式从「未激活」切换到「激活」。已在激活状态下重复点击不计。",
      },
      {
        key: "text.edit",
        description: "一次文本编辑被提交（通常在失焦 / 回车 / 结束编辑时），且内容确实发生变化。不按每次按键计数。",
      },
    ],
  },
  {
    title: "文本格式化",
    note: "只记录「命令被成功应用」这一事实，不包含具体数值、颜色、字号、选中的文本或目标元素信息。",
    events: [
      { key: "format.bold", description: "加粗命令成功应用一次。" },
      { key: "format.italic", description: "斜体命令成功应用一次。" },
      { key: "format.underline", description: "下划线命令成功应用一次。" },
      { key: "format.strikethrough", description: "删除线命令成功应用一次。" },
      { key: "format.font_size", description: "字号调整成功应用一次。" },
      { key: "format.text_color", description: "文字颜色成功应用一次。" },
      { key: "format.background_color", description: "背景颜色成功应用一次。" },
    ],
  },
  {
    title: "图片",
    note: "不包含图片数据、URL、文件名、MIME 类型、像素尺寸或目标元素信息。",
    events: [
      { key: "image.replace", description: "替换图片成功应用到元素上。一次导入应用到 3 个元素会计 3 次。" },
      {
        key: "image.resize",
        description:
          "一次缩放拖拽提交到历史记录：用户松开手柄且元素尺寸确实变化。每次拖拽计 1 次，不按指针移动计；结束时尺寸未变或按 Esc 取消的不计。",
      },
      {
        key: "image.import_local",
        description:
          "从本机选择的文件被读取、解码并接受为当前图片。通过免费额度校验后才计 1 次；被额度拦下的会记 monetization.free_limit_reached。",
      },
      {
        key: "image.import_url",
        description: "远程图片 URL 通过校验并被接受为当前图片。每次成功导入计 1 次。",
      },
      {
        key: "image.import_local_failed",
        description: "本地文件导入最终失败：文件读不出来，或解码结果不是可加载的图片。",
      },
      {
        key: "image.import_url_failed",
        description:
          "非空的图片 URL 输入最终失败：不是可用的 http(s) 地址，或远程校验 / 加载失败（超时、域名被拦、HTTP 错误、非图片类型）。空输入不算尝试，不计。",
      },
    ],
  },
  {
    title: "元素与历史",
    events: [
      { key: "element.remove", description: "元素删除成功应用一次。" },
      { key: "history.undo", description: "撤销命令成功改变了编辑状态。无实际变化（no-op）的不计。" },
      { key: "history.redo", description: "重做命令成功改变了编辑状态。无实际变化（no-op）的不计。" },
    ],
  },
  {
    title: "截图",
    note: "只统计真正完成 / 写入成功的动作，失败或取消不计。",
    events: [
      { key: "screenshot.viewport", description: "可视区域截图成功完成并产出内部图片结果。" },
      { key: "screenshot.fullpage", description: "整页截图成功完成并产出内部图片结果。" },
      { key: "screenshot.copy", description: "截图成功写入剪贴板。权限失败或写入失败不计。" },
      { key: "screenshot.download", description: "浏览器 API 成功发起 / 确认下载。准备失败或被取消不计。" },
    ],
  },
  {
    title: "商业化",
    note: "激活失败必须携带一个原因子键（见下方「激活失败原因」），不允许记录原始错误信息或错误码。",
    events: [
      {
        key: "monetization.free_limit_reached",
        description: "某个产品操作被免费额度限制拦下。每次被拦的操作计 1 次，不按渲染 / 重渲染计。",
      },
      {
        key: "monetization.upgrade_shown",
        description: "升级界面因产品流程而展示。每次展示计 1 次，不按组件渲染计。",
      },
      { key: "monetization.learn_premium_clicked", description: "用户点击控制面板的「了解 Premium」按钮。" },
      { key: "monetization.activation_started", description: "用户明确提交了一次激活尝试。" },
      { key: "monetization.activation_succeeded", description: "Licentra 确认激活，且本地 premium 状态已写入。" },
      {
        key: "monetization.activation_failed",
        description: "一次激活尝试最终失败。该事件必须带一个原因子键，本身不单独入库。",
      },
      {
        key: "monetization.checkin_succeeded",
        description:
          "客户端与 Licentra 完成一次 check-in 往返且许可证被确认有效。跳过（签名仍新鲜、未发请求）和离线宽限（服务端不可达）都不计，因为它们不是成功的往返。",
      },
    ],
  },
  {
    title: "支持与反馈",
    events: [
      { key: "support.review_clicked", description: "用户点击控制面板的「去评价」按钮。" },
      { key: "support.feedback_clicked", description: "用户点击控制面板的「发送反馈」按钮。" },
    ],
  },
  {
    title: "生命周期",
    events: [
      {
        key: "lifecycle.installed",
        description:
          "新安装的扩展第一次上报。每个安装只发一次，在安装之后、任何功能使用之前。它是唯一会触发立即上传的计数，用来把 firstSeenAt 锚定到真实安装时刻。",
      },
    ],
  },
  {
    title: "激活失败原因",
    note: "库里只存带原因的子键：monetization.activation_failed.<原因>。不带原因的那个键不会出现在 UsageDaily.events 里。",
    events: [
      { key: "monetization.activation_failed.invalid_key", description: "密钥无效。" },
      { key: "monetization.activation_failed.expired_key", description: "密钥已过期。" },
      { key: "monetization.activation_failed.revoked_key", description: "密钥已被吊销。" },
      { key: "monetization.activation_failed.device_limit", description: "超出设备数量上限。" },
      { key: "monetization.activation_failed.network_error", description: "网络错误。" },
      { key: "monetization.activation_failed.server_error", description: "服务端错误。" },
      { key: "monetization.activation_failed.timeout", description: "请求超时。" },
      { key: "monetization.activation_failed.unknown", description: "未知原因（无法归类时兜底）。" },
    ],
  },
];

/** 全部计数键（事件名 + 激活失败原因子键），服务端用来校验查询入参 */
export const EDIT_PAGE_COUNTER_KEYS: string[] = EDIT_PAGE_EVENT_SECTIONS.flatMap((section) =>
  section.events.map((event) => event.key),
);

export const EDIT_PAGE_COUNTER_KEY_SET = new Set<string>(EDIT_PAGE_COUNTER_KEYS);

/** 全部计数键数量 */
export const EDIT_PAGE_COUNTER_KEY_TOTAL = EDIT_PAGE_COUNTER_KEYS.length;
