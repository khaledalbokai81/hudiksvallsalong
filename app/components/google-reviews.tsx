"use client";

import { useEffect, useState } from "react";

const reviews = [
  { initial: "E", name: "Erik Lundgren", ago: "2 months ago", rating: 5, text: "Riktigt noggrann klippning och trevligt bemotande. Jag kommer garna tillbaka." },
  { initial: "M", name: "Marcus Sjostrom", ago: "3 months ago", rating: 5, text: "Smidigt, avslappnat och ett snyggt resultat. Precis den stil jag var ute efter." },
  { initial: "D", name: "David Andersson", ago: "3 months ago", rating: 5, text: "Lugn atmosfar, bra service och ett riktigt fint bemotande fran start till slut." },
  { initial: "J", name: "Jonas Berg", ago: "4 months ago", rating: 5, text: "Alltid professionellt och med stor kansla for detaljer. Rekommenderas varmt." },
  { initial: "A", name: "Adam Nilsson", ago: "4 months ago", rating: 5, text: "Bra rad, skarp fade och en enkel bokning. Jag ar supernojd med resultatet." },
  { initial: "O", name: "Oskar Lind", ago: "5 months ago", rating: 4, text: "Trevlig salong och riktigt bra klippning. Kommer definitivt tillbaka igen." },
  { initial: "V", name: "Viktor Karlsson", ago: "5 months ago", rating: 5, text: "En trygg hand och ett resultat som blev battre an jag hade tankt mig." },
  { initial: "N", name: "Nils Larsson", ago: "6 months ago", rating: 5, text: "Precis lagom personligt och mycket noggrant. Salongen har blivit mitt sjalvklara val." },
  { initial: "L", name: "Leo Eriksson", ago: "6 months ago", rating: 5, text: "Mycket bra service och skaggtrimning med riktigt rena linjer. Toppen." },
];

export function GoogleReviews() {
  const [start, setStart] = useState(0);
  const visibleReviews = Array.from({ length: 4 }, (_, index) => reviews[(start + index) % reviews.length]);
  const show = (index: number) => setStart((index + reviews.length) % reviews.length);

  useEffect(() => {
    const timer = window.setInterval(() => setStart((current) => (current + 1) % reviews.length), 6000);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="google-reviews" id="google-reviews" aria-labelledby="google-reviews-title" data-reveal>
    <div className="google-reviews-heading"><p className="eyebrow">Kundrecensioner</p><h2 id="google-reviews-title">Det har sager<br/>vara kunder.</h2><p>Riktiga ord fran kunder som har valt Hudiksvalls Salong.</p></div>
    <div className="google-review-carousel" aria-live="polite">
      <div className="google-review-grid">{visibleReviews.map((review, index) => <article className="google-review-card" key={index}><div className="google-review-top"><span className={`review-avatar avatar-${review.initial}`}>{review.initial}</span><div><strong>{review.name}</strong><small>{review.ago}</small></div><span className="google-mark" aria-label="Google">G</span></div><p className="google-stars" aria-label={`${review.rating} av 5 stjarnor`}>{Array.from({ length: 5 }, (_, star) => <span className={star < review.rating ? "filled" : ""} key={star}>&#9733;</span>)}</p><p className="google-review-copy">{review.text}</p></article>)}</div>
      <div className="review-carousel-footer"><div className="review-pagination" aria-label="Valj recension">{reviews.map((review, index) => <button key={review.name} className={index === start ? "active" : ""} onClick={() => show(index)} aria-label={`Visa recension fran ${review.name}`} />)}</div><div className="review-carousel-actions"><button type="button" onClick={() => show(start - 1)} aria-label="Visa foregaende recensioner">&larr;</button><button type="button" onClick={() => show(start + 1)} aria-label="Visa nasta recensioner">&rarr;</button></div></div>
    </div>
  </section>;
}


