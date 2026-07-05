"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface XpRingProps {
  pct: number;
  level: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function XpRing({ pct, level, size = 88, strokeWidth = 8, className }: XpRingProps) {
  const gradientId = useId();
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <defs>
          {/* Hardcoded amber gradient: deliberate "gold" accent independent of theme tokens,
              consistent with the hardcoded yellow used for coins elsewhere. */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-heading leading-none">{level}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Lvl</span>
      </div>
    </div>
  );
}
