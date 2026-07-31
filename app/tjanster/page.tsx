import { SiteHeader } from "../components/site-header";
import { InteractiveMap } from "../components/interactive-map";
import { ReferencePoster } from "../components/reference-poster";
import { SiteFooter } from "../components/site-footer";
import type { Metadata } from "next";
import content from "../../content/site-content.json";
import { JsonLd } from "../components/json-ld";

export const metadata: Metadata = {
  title: "Priser och tjänster – herrfrisör",
  description: "Priser för herrklippning, pensionär, student, barn under 9 år och skäggtrimning i Hudiksvall. Drop-in eller ring för att boka tid.",
  alternates: { canonical: "/tjanster" },
  openGraph: { title: "Priser och tjänster – Hudiksvalls Salong", description: "Herrklippning, student, pensionär, barnklippning och skäggtrimning i Hudiksvall.", url: "/tjanster", images: [{ url: "/images/barber-hero.png", alt: "Herrfrisör i Hudiksvall" }] },
};

export default function ServicesPage() {
  const schemas = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Startsida", item: "https://www.hudiksvallsalong.com/" }, { "@type": "ListItem", position: 2, name: "Priser och tjänster", item: "https://www.hudiksvallsalong.com/tjanster" }] }, { "@context": "https://schema.org", "@type": "ItemList", name: "Priser hos Hudiksvalls Salong", itemListElement: content.prices.map((service, index) => ({ "@type": "ListItem", position: index + 1, item: { "@type": "Service", name: service.service, offers: { "@type": "Offer", price: service.price, priceCurrency: "SEK" }, provider: { "@id": "https://www.hudiksvallsalong.com/#salong" } } })) }];
  return <>{schemas.map((schema, index) => <JsonLd data={schema} key={index} />)}<SiteHeader /><main className="services-page"><section className="service-seo-intro"><p className="eyebrow">Priser och tjänster</p><h1>Herrfrisör i Hudiksvall</h1><p>Klippning för herr, pensionär, student och barn under 9 år samt skäggtrimning. Kom på drop-in eller ring för att boka en tid.</p></section><ReferencePoster /></main><InteractiveMap /><SiteFooter /></>;
}

