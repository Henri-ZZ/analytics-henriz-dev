import { cn } from "@/lib/utils";

/** 兼容驱动把 jsonb 直接返回成对象，或返回成字符串两种情况 */
function normalize(value: unknown) {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** 把任意 JSON 值格式化成易读的等宽块 */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  let text: string;
  try {
    text = JSON.stringify(normalize(value), null, 2);
  } catch {
    text = String(value);
  }

  return (
    <pre
      className={cn(
        "max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-xs leading-5",
        className,
      )}
    >
      <code className="font-mono text-[var(--ink)]">{text}</code>
    </pre>
  );
}
