"use client";

import { useEffect, useState } from "react";

export function CountUp({ end, duration = 1400 }: { end: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setValue(Math.round(progress * end));
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, end]);

  return <span>{value}</span>;
}
