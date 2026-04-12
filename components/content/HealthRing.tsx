"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  score: number; // 0-100
  segments: {
    healthy: number; // count of articles score >= 50
    warning: number; // count score 30-49
    declining: number; // count score < 30
  };
  subtitle?: string; // e.g. "3 quick wins → 80"
  size?: number; // diameter in px, default 120
}

const SEGMENT_COLORS = {
  healthy: "#34d399",
  warning: "#f59e0b",
  declining: "#f43f5e",
} as const;

/**
 * Radial progress ring (donut chart) for Content Health Score.
 * Inspired by Ahrefs Site Audit health score.
 * Pure SVG, no external chart deps.
 */
export function HealthRing({
  score,
  segments,
  subtitle,
  size = 120,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [displayScore, setDisplayScore] = useState(score);
  const prevScoreRef = useRef(score);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setMounted(true);
  }, []);

  // Animate the center number ticking up/down when the score changes — the
  // SurferSEO dopamine-loop pattern. Uses rAF for smooth 60fps interpolation.
  useEffect(() => {
    if (prevScoreRef.current === score) return;
    if (prefersReducedMotion.current) {
      setDisplayScore(score);
      prevScoreRef.current = score;
      return;
    }
    const from = prevScoreRef.current;
    const to = score;
    const duration = 600;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevScoreRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // 2px visual gap between segments, converted to dash units
  const gapLength = 2;

  const segmentData = useMemo(() => {
    const total = segments.healthy + segments.warning + segments.declining;
    if (total === 0) return [];

    const order: Array<{ key: keyof typeof SEGMENT_COLORS; count: number }> = [
      { key: "healthy", count: segments.healthy },
      { key: "warning", count: segments.warning },
      { key: "declining", count: segments.declining },
    ];

    // Filter out zero-count segments
    const active = order.filter((s) => s.count > 0);
    const gapCount = active.length > 1 ? active.length : 0;
    const totalGap = gapCount * gapLength;
    const usableCircumference = circumference - totalGap;

    let offset = 0;
    return active.map((seg) => {
      const fraction = seg.count / total;
      const arcLength = fraction * usableCircumference;
      const dasharray = `${arcLength} ${circumference - arcLength}`;
      // Rotate so arcs start from top (-90deg equivalent in SVG dash offset)
      // strokeDashoffset shifts the start of the dash pattern
      const dashoffset = circumference * 0.25 - offset;
      offset += arcLength + (gapCount > 0 ? gapLength : 0);

      return {
        key: seg.key,
        color: SEGMENT_COLORS[seg.key],
        dasharray,
        dashoffset,
      };
    });
  }, [segments, circumference]);

  const shouldAnimate = mounted && !prefersReducedMotion.current;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Content health score: ${score} out of 100`}
        role="img"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {segmentData.map((seg) => (
          <circle
            key={seg.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            style={{
              transition: shouldAnimate
                ? "stroke-dashoffset 0.8s ease-out, stroke-dasharray 0.8s ease-out"
                : "none",
            }}
          />
        ))}

        {/* Center score text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white text-2xl font-bold"
          style={{ fontSize: size * 0.28, fontWeight: 700 }}
        >
          {displayScore}
        </text>
      </svg>

      {subtitle && (
        <span className="text-xs text-zinc-400 text-center max-w-[160px] leading-tight">
          {subtitle}
        </span>
      )}
    </div>
  );
}
