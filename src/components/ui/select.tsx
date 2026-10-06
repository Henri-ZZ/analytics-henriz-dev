import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative inline-flex">
      <select
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-lg border border-[var(--border)] bg-white pl-3 pr-8 text-sm text-[var(--ink)] outline-none transition-colors hover:bg-[var(--muted)]/60 focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]"
      />
    </span>
  );
}
