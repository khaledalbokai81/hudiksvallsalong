"use client";

import { useState } from "react";

export function BeforeAfterComparison({ className = "" }: { className?: string }) {
  const [position, setPosition] = useState(50);

  return <div className={`comparison ${className}`}>
    <img className="comparison-image" src="/images/gallery-before-demo.png" alt="Fore klippning" loading="lazy" />
    <img className="comparison-image comparison-after" src="/images/gallery-after-demo.png" alt="Efter klippning" loading="lazy" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
    <span className="comparison-label before">Fore</span><span className="comparison-label after">Efter</span>
    <div className="comparison-line" style={{ "--comparison-position": `${position}%` } as React.CSSProperties} aria-hidden="true"><span>&harr;</span></div>
    <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Jamfor fore och efter" />
  </div>;
}

