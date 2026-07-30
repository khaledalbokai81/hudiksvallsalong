"use client";

import { useEffect, useState } from "react";

const slideshowImages = [
  { src: "/images/gallery-1.png", title: "Precision cut", text: "Skarpa linjer och en form som sitter hela dagen." },
  { src: "/images/gallery-2.png", title: "Modern finish", text: "En stilren klippning med en avslappnad finish." },
  { src: "/images/gallery-3.png", title: "Classic detail", text: "Klassiskt hantverk med fokus pa de sma detaljerna." },
  { src: "/images/gallery-4.png", title: "Beard shape", text: "En balanserad skaggform med rena konturer." },
  { src: "/images/gallery-5.png", title: "Clean fade", text: "Mjuka overgangen och en precision som syns." },
  { src: "/images/gallery-6.png", title: "The salon", text: "En lugn plats for din stund i stolen." },
  { src: "/images/gallery-7.png", title: "Final styling", text: "Sista finishen som gor att helheten sitter." },
  { src: "/images/gallery-8.png", title: "Grooming finish", text: "Valvardade detaljer for en komplett look." },
];

export function GallerySection() {
  const [position, setPosition] = useState(50);
  const [slide, setSlide] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setSlide((current) => (current + 1) % slideshowImages.length), 4500); return () => window.clearInterval(timer); }, []);
  const activeSlide = slideshowImages[slide];
  return <section className="gallery-section" aria-labelledby="gallery-title">
    <div className="gallery-heading"><p className="eyebrow">Galleri</p><h2 id="gallery-title">Se skillnaden<br/>i detaljerna.</h2><p>Fore och efter, foljt av glimtar fran arbetet i salongen.</p></div>
    <div className="comparison">
      <img className="comparison-image" src="/images/gallery-before.png" alt="Fore klippning" loading="lazy" />
      <img className="comparison-image comparison-after" src="/images/gallery-after.png" alt="Efter klippning" loading="lazy" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
      <span className="comparison-label before">Fore</span><span className="comparison-label after">Efter</span>
      <div className="comparison-line" style={{ "--comparison-position": `${position}%` } as React.CSSProperties} aria-hidden="true"><span>&harr;</span></div>
      <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Jamfor fore och efter" />
    </div>
    <div className="gallery-slideshow"><div className="slideshow-image-wrap"><img src={activeSlide.src} alt={activeSlide.title} loading="lazy" key={activeSlide.src} /><div><p className="eyebrow">I salongen</p></div></div><div className="slideshow-controls"><div className="slideshow-info"><p className="eyebrow">Utvalt arbete</p><h3>{activeSlide.title}</h3><p>{activeSlide.text}</p><div className="slideshow-progress" aria-hidden="true"><span style={{ width: `${((slide + 1) / slideshowImages.length) * 100}%` }} /></div></div><div className="slideshow-nav"><button onClick={() => setSlide((slide - 1 + slideshowImages.length) % slideshowImages.length)} aria-label="Foregaende bild">&larr;</button><span>{String(slide + 1).padStart(2, "0")} / {String(slideshowImages.length).padStart(2, "0")}</span><button onClick={() => setSlide((slide + 1) % slideshowImages.length)} aria-label="Nasta bild">&rarr;</button></div></div></div>
  </section>;
}
