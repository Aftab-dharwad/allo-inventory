"use client";

import { cn } from "@/lib/utils";

interface StockBadgeProps {
  available: number;
  className?: string;
}

export function StockBadge({ available, className }: StockBadgeProps) {
  const level = available === 0 ? "out" : available <= 3 ? "low" : "ok";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide",
        level === "out" && "bg-red-100 text-red-700 border border-red-200",
        level === "low" && "bg-amber-100 text-amber-700 border border-amber-200",
        level === "ok" && "bg-emerald-100 text-emerald-700 border border-emerald-200",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          level === "out" && "bg-red-500",
          level === "low" && "bg-amber-500 animate-pulse",
          level === "ok" && "bg-emerald-500"
        )}
      />
      {available === 0 ? "Out of stock" : `${available} available`}
    </span>
  );
}
