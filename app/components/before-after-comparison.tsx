"use client";

import { useState } from "react";

export function BeforeAfterComparison({ className = "", beforeSrc = "/images/gallery-before-demo.png", afterSrc = "/images/gallery-after-demo.png" }: { className?: string; beforeSrc?: string; afterSrc?: string }) {
  const [position, setPosition] = useState(50);

  return <div className={`comparison ${className}`}>
    <img className="comparison-image" src={beforeSrc} alt="Före klippning" loading="lazy" />
    <img className="comparison-image comparison-after" src={afterSrc} alt="Efter klippning" loading="lazy" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
    <span className="comparison-label before">Före</span><span className="comparison-label after">Efter</span>
    <div className="comparison-line" style={{ "--comparison-position": `${position}%` } as React.CSSProperties} aria-hidden="true"><span>&harr;</span></div>
    <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Jämför före och efter" />
  </div>;
}

