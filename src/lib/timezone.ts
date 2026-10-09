/**
 * 展示时区。
 *
 * 库里 `timestamptz` 存的是 UTC 瞬时刻，**只在展示时**转成本时区，
 * 数据层（SQL、API 响应、行模型）保持 UTC 不变。
 *
 * 固定用 UTC+8（上海）：中国自 1991 年起不使用夏令时，所以固定偏移是安全的。
 * 如果将来要跟随某个有夏令时的地区，把这里的实现换成 Intl.DateTimeFormat + IANA 时区即可，
 * 其余代码不用动。
 *
 * 注意：`UsageDaily.date` 是纯日历日（客户端按 UTC 上报），不属于瞬时刻，
 * 不参与这里的转换，按原样展示。
 */

export const DISPLAY_UTC_OFFSET_HOURS = 8;
export const DISPLAY_TIME_ZONE_LABEL = "UTC+8";

const OFFSET_MS = DISPLAY_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function parseInstant(input: string | number): number | null {
  const ms = typeof input === "number" ? input : Date.parse(input);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 展示时区下的日历日，YYYY-MM-DD。
 *
 * 做法是把瞬时刻整体平移偏移量后按 UTC 读，这样"平移后的 UTC 日期"就等于本地日期，
 * 不需要依赖运行环境的时区设置（服务端和浏览器结果一致）。
 */
export function displayDate(input: string | number): string {
  const ms = parseInstant(input);
  if (ms === null) return "—";
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** 展示时区下的日期时间，精确到秒：YYYY-MM-DD HH:mm:ss */
export function displayDateTime(input: string | number): string {
  const ms = parseInstant(input);
  if (ms === null) return "—";
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * input 距「今天」相差几个自然日（按展示时区的日历日算）：0 = 今天，1 = 昨天。
 *
 * 刻意不用"过去 24 小时"的口径：上海的 8 号凌晨看 7 号 20 点的上报，
 * 按 24 小时算会显示"今天"（才过去 6 小时），但按日历日应该是"昨天"。
 */
export function displayDaysAgo(input: string | number, now: number = Date.now()): number {
  const ms = parseInstant(input);
  if (ms === null) return 0;

  const startOfToday = Date.parse(`${displayDate(now)}T00:00:00.000Z`);
  const startOfTarget = Date.parse(`${displayDate(ms)}T00:00:00.000Z`);
  return Math.max(0, Math.round((startOfToday - startOfTarget) / DAY_MS));
}
