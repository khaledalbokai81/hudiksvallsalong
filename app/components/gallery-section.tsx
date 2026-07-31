"use client";

import { useEffect, useState } from "react";
import content from "../../content/site-content.json";

export function GallerySection() {
  const { landing } = content;
  const slideshowImages = landing.slides;
  const [position, setPosition] = useState(50);
  const [slide, setSlide] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setSlide((current) => (current + 1) % slideshowImages.length), 4500); return () => window.clearInterval(timer); }, []);
  const activeSlide = slideshowImages[slide];
  return <section className="gallery-section" aria-labelledby="gallery-title" data-reveal>
    <div className="gallery-heading"><p className="eyebrow">Galleri</p><h2 id="gallery-title">{landing.galleryTitle.split("\n").map((line, index) => <span key={line}>{line}{index === 0 && <br/>}</span>)}</h2><p>{landing.galleryText}</p></div>
    <div className="comparison">
      <img className="comparison-image" src={landing.beforeImage} alt="Före klippning" loading="lazy" />
      <img className="comparison-image comparison-after" src={landing.afterImage} alt="Efter klippning" loading="lazy" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
      <span className="comparison-label before">Före</span><span className="comparison-label after">Efter</span>
      <div className="comparison-line" style={{ "--comparison-position": `${position}%` } as React.CSSProperties} aria-hidden="true"><span>&harr;</span></div>
      <input type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Jämför före och efter" />
    </div>
    <div className="gallery-slideshow"><div className="slideshow-image-wrap"><img src={activeSlide.src} alt={`${activeSlide.title} på Hudiksvalls Salong`} loading="lazy" key={activeSlide.src} /><div><p className="eyebrow">I salongen</p></div></div><div className="slideshow-controls"><div className="slideshow-info"><p className="eyebrow">Utvalt arbete</p><h3>{activeSlide.title}</h3><p>{activeSlide.text}</p><div className="slideshow-progress" aria-hidden="true"><span style={{ width: `${((slide + 1) / slideshowImages.length) * 100}%` }} /></div></div><div className="slideshow-nav"><button onClick={() => setSlide((slide - 1 + slideshowImages.length) % slideshowImages.length)} aria-label="Föregående bild">&larr;</button><span>{String(slide + 1).padStart(2, "0")} / {String(slideshowImages.length).padStart(2, "0")}</span><button onClick={() => setSlide((slide + 1) % slideshowImages.length)} aria-label="Nästa bild">&rarr;</button></div></div></div>
  </section>;
}
