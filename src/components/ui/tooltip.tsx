"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** 出现延迟，远短于原生 title（约 1s） */
const DELAY_DURATION = 80;

/**
 * 自带 Provider 的 Tooltip：Radix 的 Root 依赖 Provider 上下文（缺了会直接报错），
 * 内嵌之后使用处不用再额外包一层，写起来更省心。
 */
export function Tooltip({ delayDuration = DELAY_DURATION, ...props }: ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={150}>
      <TooltipPrimitive.Root {...props} />
    </TooltipPrimitive.Provider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-50 max-w-[18rem] rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs leading-5 text-[var(--secondary)] shadow-xl",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
