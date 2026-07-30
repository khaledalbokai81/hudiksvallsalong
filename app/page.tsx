import Image from "next/image";
import { CountUp } from "./components/count-up";
import { GoogleReviews } from "./components/google-reviews";
import { InteractiveMap } from "./components/interactive-map";
import { SiteHeader } from "./components/site-header";
import { GallerySection } from "./components/gallery-section";

const services = [
  { number: "01", title: "Herrklippning", text: "En noggrann klippning anpassad efter din stil.", price: "300 kr" },
  { number: "02", title: "Sk\u00e4ggtrimning", text: "Trimning och form for ett valvardat skagg.", price: "200 kr" },
  { number: "03", title: "Har + skagg", text: "Klippning och skaggtrimning i samma behandling.", price: "400 kr" },
  { number: "04", title: "Barnklippning", text: "En smidig klippning for de yngre kunderna.", price: "250 kr" },
  { number: "05", title: "Pension\u00e4rsklippning", text: "Klassisk klippning med god service och tid.", price: "250 kr" },
  { number: "06", title: "Maskinklippning", text: "Ren och enkel klippning med maskin.", price: "200 kr" },
  { number: "07", title: "Tvatt & styling", text: "Avslutande tvatt och styling for en skarp finish.", price: "150 kr" },
  { number: "08", title: "Konturtrimning", text: "Snabb uppfräschning av nacke, tinningar och skagg.", price: "150 kr" },
];

const tickerReviews = [
  { name: "Jonas", text: "Snygg klippning och alltid bra bemotande." },
  { name: "Marcus", text: "Smidigt, noggrant och precis den stil jag ville ha." },
  { name: "David", text: "Lugn atmosfar och ett riktigt bra resultat." },
  { name: "Erik", text: "Min nya favorit i Hudiksvall." },
];

function Arrow() { return <span aria-hidden="true">&rarr;</span>; }

export default function Home() {
  const localBusinessSchema = {
    "@context": "https://schema.org", "@type": "BarberShop", name: "Hudiksvalls Salong",
    description: "Klassisk herrfrisor med klippning och skaggtrimning i Hudiksvall.",
    telephone: "+46702564122", priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: "Storgatan 29", postalCode: "824 30", addressLocality: "Hudiksvall", addressCountry: "SE" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "10:00", closes: "18:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "10:00", closes: "17:00" },
    ],
    areaServed: "Hudiksvall",
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Barbertjanster", itemListElement: services.map((service) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: service.title } })) },
  };

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
    <SiteHeader />

    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">HerrfrisÃ¶r &middot; Hudiksvall</p>
        <h1 id="hero-title">Stil.<br/>Hantverk.<br/>Din look.</h1>
        <a className="button hero-booking" href="#boka">Boka din tid <Arrow /></a>
        <div className="hero-details" aria-label="Salongens kontaktuppgifter"><span>M&aring;n&ndash;fre 10&ndash;18</span><a href="tel:+46702564122">070&ndash;256 41 22</a></div>
      </div>
      <div className="hero-image-wrap"><Image className="hero-image" src="/images/barber-hero.png" alt="Barberare som utfor en klassisk herrklippning" fill priority sizes="(max-width: 800px) 100vw, 52vw" /></div>
    </section>

    <section className="review-strip" aria-labelledby="review-strip-title">
      <div className="review-strip-intro"><p className="eyebrow">Kundrecensioner</p><h2 id="review-strip-title">Bra stil<br/>borjar har.</h2><p>Exempel pa hur omdomen fran Google kan visas har.</p></div>
      <div className="review-strip-cards">
        <figure><p className="stars" aria-label="5 av 5 stjarnor">â˜…â˜…â˜…â˜…â˜…</p><blockquote>â€œRiktigt noggrann klippning och trevligt bemotande. Jag kommer garna tillbaka.â€</blockquote><figcaption><strong>Erik L.</strong><span>Verifierad kund</span></figcaption></figure>
        <figure><p className="stars" aria-label="5 av 5 stjarnor">â˜…â˜…â˜…â˜…â˜…</p><blockquote>â€œLugn atmosfar, bra service och precis den frisyr jag var ute efter.â€</blockquote><figcaption><strong>David A.</strong><span>Verifierad kund</span></figcaption></figure>
        <figure><p className="stars" aria-label="4 av 5 stjarnor">â˜…â˜…â˜…â˜…<i>â˜…</i></p><blockquote>â€œSmidig drop-in och ett snyggt resultat. Rekommenderar salongen.â€</blockquote><figcaption><strong>Marcus S.</strong><span>Verifierad kund</span></figcaption></figure>
      </div>
    </section>

    <section className="trust-bar" aria-label="Kundrecensioner"><div className="review-ticker"><div className="review-ticker-track">{[...tickerReviews, ...tickerReviews].map((review, index) => <p key={`${review.name}-${index}`}><strong>{review.name}</strong><span>: {review.text}</span><b aria-hidden="true">&bull;</b></p>)}</div></div></section>

    <section className="services" id="tjanster" aria-labelledby="services-title">
      <div className="section-intro"><p className="eyebrow">Prislista</p><h2 id="services-title">Tydliga priser.<br/>Bra resultat.</h2></div>
      <div className="price-list" aria-label="Prislista">
        {[services.slice(0, 4), services.slice(4)].map((column, columnIndex) => <div className="price-list-column" key={columnIndex}><div className="price-list-head"><span>Behandling</span><span>Pris</span></div>{column.map((service) => <article className="price-row" key={service.number}><div className="price-row-main"><span className="service-number">{service.number}</span><div><h3>{service.title}</h3><p>{service.text}</p></div></div><strong>{service.price}</strong></article>)}</div>)}
      </div>    </section>

    <GoogleReviews />

    <section className="reviews section" aria-labelledby="reviews-title"><div className="section-heading"><p className="eyebrow">Hudiksvalls Salong</p><h2 id="reviews-title">Ett val kunder<br/>valjer igen.</h2></div><div className="review-grid achievements-grid"><figure><blockquote>50+</blockquote><figcaption>Google-recensioner</figcaption><p>Starka omdomen fran kunder som har besokt salongen.</p></figure><figure><blockquote>Stammisar</blockquote><figcaption>Aterkommande kunder</figcaption><p>Manga kunder valjer att komma tillbaka, gang efter gang.</p></figure><figure><blockquote><CountUp end={10} />+ &aring;r</blockquote><figcaption>I Hudiksvall</figcaption><p>Erfarenhet, hantverk och personlig service mitt i stan.</p></figure></div></section>

    <section className="booking" id="boka" aria-labelledby="booking-title"><div className="booking-intro"><p className="eyebrow">Din nasta tid</p><h2 id="booking-title">Dags f&ouml;r en<br/>ny look.</h2><p className="booking-lead">V&auml;lj en tid som passar dig &mdash; vi tar hand om resten.</p></div><div className="booking-card"><p className="eyebrow">Boka pa nagra sekunder</p><h3>Din tid,<br/><em>din stil.</em></h3><a className="button" href="/boka">Boka tid online <Arrow /></a><div className="booking-card-contact"><span>Har du fragor?</span><a href="tel:+46702564122">Ring 070&ndash;256 41 22</a></div><small>Drop-in i man av tid</small></div></section>

    <GallerySection />
    <InteractiveMap />
    <footer id="hitta-hit"><div className="footer-brand">HUDIKSVALLS<br/><em>SALONG</em></div><div><p className="eyebrow">Besok oss</p><address>Kungsgatan 14<br/>824 30 Hudiksvall</address><a href="https://maps.google.com/?q=Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden" target="_blank" rel="noreferrer">Visa pa karta &nearr;</a></div><div><p className="eyebrow">Oppettider</p><p>Man&ndash;fre 10:00&ndash;18:00<br/>Lor 10:00&ndash;17:00<br/>Son stangt</p></div><div><p className="eyebrow">Kontakt</p><a href="tel:+46702564122">070&ndash;256 41 22</a><a href="https://instagram.com/b_ra_www" target="_blank" rel="noreferrer">Instagram &nearr;</a></div><div className="footer-bottom"><p className="copyright">&copy; 2026 Hudiksvalls Salong. Alla rattigheter forbehallna.</p><div className="footer-social" aria-label="Sociala medier"><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.6 1.7-1.6h1.6V3.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V10H9v3h2.4v8H14Z" fill="currentColor" stroke="none"/></svg></a></div></div></footer>
  </main>;
}












