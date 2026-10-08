"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /**
   * 半选状态（例如「本页已选中一部分」）。
   * React 没有对应属性，只能通过 DOM 写入，所以这里用 ref 处理。
   */
  indeterminate?: boolean;
};

export function Checkbox({ className, indeterminate = false, checked, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
