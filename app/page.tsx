import Image from "next/image";
import { CountUp } from "./components/count-up";
import { InteractiveMap } from "./components/interactive-map";
import { SiteHeader } from "./components/site-header";
import { GallerySection } from "./components/gallery-section";
import { ReferencePoster } from "./components/reference-poster";
import { SiteFooter } from "./components/site-footer";
import { JsonLd } from "./components/json-ld";
import content from "../content/site-content.json";

function Arrow() { return <span aria-hidden="true">&rarr;</span>; }

export default function Home() {
  const { landing, business } = content;
  const localBusinessSchema = {
    "@context": "https://schema.org", "@type": "HairSalon", "@id": "https://www.hudiksvallsalong.com/#salong", name: business.name,
    description: "Herrfrisör i Hudiksvall för herr, pensionärer, studenter, barn under 9 år och skäggtrimning. Främst drop-in, med möjlighet att ringa och boka tid.",
    url: "https://www.hudiksvallsalong.com/", image: "https://www.hudiksvallsalong.com/images/barber-hero.png", logo: "https://www.hudiksvallsalong.com/icon.svg",
    telephone: business.phoneHref, priceRange: "180–280 SEK", currenciesAccepted: "SEK", knowsLanguage: "sv",
    address: { "@type": "PostalAddress", streetAddress: "Kungsgatan 14", postalCode: "824 30", addressLocality: "Hudiksvall", addressCountry: "SE" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "10:00", closes: "18:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "11:00", closes: "16:00" },
    ],
    areaServed: [{ "@type": "City", name: "Hudiksvall" }, { "@type": "City", name: "Ljusdal" }, { "@type": "AdministrativeArea", name: "Hälsingland" }],
    founder: { "@type": "Person", name: "Khaled" }, foundingDate: "2019", hasMap: "https://maps.app.goo.gl/98FjG87YQFpVDmhz8",
    sameAs: [business.instagramUrl, business.facebookUrl],
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Klippning och skägg", itemListElement: content.prices.map((service) => ({ "@type": "Offer", price: service.price, priceCurrency: "SEK", availability: "https://schema.org/InStock", itemOffered: { "@type": "Service", name: service.service, areaServed: "Hudiksvall" } })) },
  };

  return <main>
    <JsonLd data={localBusinessSchema} />
    <SiteHeader />

    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">{landing.heroEyebrow}</p>
        <h1 id="hero-title">{landing.heroTitle.split("\n").map((line, index) => <span key={`${line}-${index}`}>{line}{index < landing.heroTitle.split("\n").length - 1 && <br/>}</span>)}</h1>
        <a className="button hero-booking" href={`tel:${business.phoneHref}`}>Ring oss <Arrow /></a>
        <div className="hero-details" aria-label="Salongens kontaktuppgifter"><span>M&aring;n&ndash;fre 10&ndash;18</span><a href="tel:+46720147022">072&ndash;014 70 22</a></div>
      </div>
      <div className="hero-image-wrap"><Image className="hero-image" src="/images/barber-hero.png" alt="Khaled utför en herrklippning på Hudiksvalls Salong" fill priority sizes="(max-width: 800px) 100vw, 52vw" /></div>
    </section>

    <section className="review-strip" aria-labelledby="review-strip-title" data-reveal>
      <div className="review-strip-intro"><p className="eyebrow">Herrfrisör i Hudiksvall</p><h2 id="review-strip-title">Enkelt att<br/>klippa sig.</h2><p>Khaled har drivit Hudiksvalls Salong i 7 år. Här får du personlig service på svenska, mitt i Hudiksvall.</p></div>
      <div className="review-strip-cards">
        <figure><blockquote>Herr, pensionär och student</blockquote><figcaption><strong>Klippning</strong><span>Från 250 kr</span></figcaption></figure>
        <figure><blockquote>Barn under 9 år</blockquote><figcaption><strong>Barnklippning</strong><span>180 kr</span></figcaption></figure>
        <figure><blockquote>Trimning och rena konturer</blockquote><figcaption><strong>Skägg</strong><span>200 kr</span></figcaption></figure>
      </div>
    </section>

    <section className="trust-bar" aria-label="Information om salongen"><div className="review-ticker"><div className="review-ticker-track">{Array.from({ length: 2 }).flatMap((_, copy) => ["Drop-in under öppettiderna", "Ring för att boka tid", "Svensktalande", "Kungsgatan 14 i Hudiksvall", "Även kunder från Ljusdal och närliggande orter"].map((text, index) => <p key={`${copy}-${index}`}><strong>{text}</strong><b aria-hidden="true">&bull;</b></p>))}</div></div></section>

    <ReferencePoster />

    <section className="reviews section" aria-labelledby="reviews-title" data-reveal><div className="section-heading"><p className="eyebrow">Hudiksvalls Salong</p><h2 id="reviews-title">Lokalt hantverk<br/>nära dig.</h2></div><div className="review-grid achievements-grid"><figure><blockquote>Drop-in</blockquote><figcaption>Enkelt besök</figcaption><p>Kom förbi under öppettiderna eller ring i förväg för att boka en tid.</p></figure><figure><blockquote>Svenska</blockquote><figcaption>Personlig service</figcaption><p>Khaled hjälper dig att hitta en klippning eller skäggform som passar.</p></figure><figure><blockquote><CountUp end={7} /> år</blockquote><figcaption>I Hudiksvall</figcaption><p>Lokalt herrfrisörhantverk på Kungsgatan 14 sedan 2019.</p></figure></div></section>

    <section className="local-faq" aria-labelledby="faq-title" data-reveal><div><p className="eyebrow">Bra att veta</p><h2 id="faq-title">Vanliga frågor</h2><p>Snabba svar inför ditt besök hos Hudiksvalls Salong.</p></div><dl><div><dt>Behöver jag boka tid?</dt><dd>Nej, vi arbetar främst med drop-in. Vill du vara säker på en viss tid kan du ringa <a href={`tel:${business.phoneHref}`}>{business.phoneDisplay}</a> i förväg.</dd></div><div><dt>Vilka tjänster erbjuder ni?</dt><dd>Klippning för herr, pensionär, student och barn under 9 år samt skäggtrimning. Se hela <a href="/tjanster">prislistan och våra tjänster</a>.</dd></div><div><dt>Var ligger salongen?</dt><dd>Du hittar oss på Kungsgatan 14 i centrala Hudiksvall. Vi välkomnar även kunder från Ljusdal och andra närliggande orter.</dd></div><div><dt>Vilket språk talar ni?</dt><dd>Servicen i salongen sker på svenska.</dd></div></dl></section>

    <section className="booking" id="drop-in" aria-labelledby="drop-in-title" data-reveal><div className="booking-intro"><p className="eyebrow">{landing.bookingEyebrow}</p><h2 id="drop-in-title">{landing.bookingTitle.split("\n").map((line, index) => <span key={`${line}-${index}`}>{line}{index < landing.bookingTitle.split("\n").length - 1 && <br/>}</span>)}</h2><p className="booking-lead">{landing.bookingText}</p></div><div className="booking-card"><p className="eyebrow">Drop-in</p><h3>Din stil,<br/><em>när du vill.</em></h3><a className="button" href={`tel:${business.phoneHref}`}>Ring oss <Arrow /></a><div className="booking-card-contact"><span>Har du frågor?</span><a href={`tel:${business.phoneHref}`}>Ring {business.phoneDisplay}</a></div><small>I mån av tid</small></div></section>

    <GallerySection />
    <InteractiveMap />
    <SiteFooter />
  </main>;
}












