"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export function Countdown({ expiresAt, onExpire, className }: CountdownProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setRemaining(calc());

    const interval = setInterval(() => {
      const secs = calc();
      setRemaining(secs);
      if (secs === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 60;
  const isExpired = remaining === 0;
  const progress = (remaining / (10 * 60)) * 100;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "font-mono text-4xl font-bold tabular-nums tracking-tight transition-colors",
          isExpired && "text-red-500",
          isUrgent && !isExpired && "text-amber-500",
          !isUrgent && "text-slate-800"
        )}
      >
        {isExpired ? "EXPIRED" : `${minutes}:${seconds.toString().padStart(2, "0")}`}
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            isExpired && "bg-red-400",
            isUrgent && !isExpired && "bg-amber-400",
            !isUrgent && "bg-emerald-400"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {isExpired
          ? "Your reservation has expired"
          : isUrgent
          ? "Hurry! Time running out"
          : "Time remaining to complete purchase"}
      </p>
    </div>
  );
}
