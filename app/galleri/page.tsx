import Image from "next/image";
import { BeforeAfterComparison } from "../components/before-after-comparison";
import { InteractiveMap } from "../components/interactive-map";
import { SiteHeader } from "../components/site-header";

type GalleryImage = { src: string; title: string; number: string };

const chapters: { title: string; text: string; images: GalleryImage[] }[] = [
  { title: "Klippning", text: "Form, overganger och detaljer som ar gjorda for att halla.", images: [{ src: "/images/gallery-2.png", title: "Modern finish", number: "02" }, { src: "/images/gallery-3.png", title: "Classic detail", number: "03" }, { src: "/images/gallery-5.png", title: "Clean fade", number: "04" }] },
  { title: "Skagg & finish", text: "Rena konturer och den sista finishen som gor helheten.", images: [{ src: "/images/gallery-4.png", title: "Beard shape", number: "05" }, { src: "/images/gallery-7.png", title: "Final styling", number: "06" }] },
  { title: "I salongen", text: "En lugn stund, med fokus pa din stil och ditt uttryck.", images: [{ src: "/images/gallery-6.png", title: "The salon", number: "07" }, { src: "/images/gallery-8.png", title: "Grooming finish", number: "08" }] },
];

function SocialIcons() {
  return <div className="footer-social" aria-label="Sociala medier"><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.6 1.7-1.6h1.6V3.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V10H9v3h2.4v8H14Z" fill="currentColor" stroke="none"/></svg></a></div>;
}

function GalleryChapter({ title, text, images }: { title: string; text: string; images: GalleryImage[] }) {
  return <section className="gallery-chapter"><div className="gallery-chapter-heading"><p className="eyebrow">Galleri</p><h2>{title}</h2><p>{text}</p></div><div className="gallery-chapter-grid">{images.map((image) => <figure key={image.src}><Image src={image.src} alt={image.title} width={1200} height={900} sizes="(max-width: 800px) 100vw, 50vw" /><figcaption>{image.number} <span>{image.title}</span></figcaption></figure>)}</div></section>;
}

export default function GalleryPage() {
  return <><SiteHeader /><main className="gallery-page"><section className="gallery-page-intro"><p className="eyebrow">Hudiksvalls Salong</p><h1>Arbete med<br/><em>kansla</em> for detaljer.</h1><p>Har samlar vi glimtar fran salongen, klippningarna och detaljerna som gor skillnad.</p></section><BeforeAfterComparison className="gallery-page-comparison" /><div className="gallery-chapters">{chapters.map((chapter) => <GalleryChapter key={chapter.title} {...chapter} />)}</div></main><InteractiveMap /><footer id="hitta-hit"><div className="footer-brand">HUDIKSVALLS<br/><em>SALONG</em></div><div><p className="eyebrow">Besok oss</p><address>Kungsgatan 14<br/>824 30 Hudiksvall</address><a href="https://maps.google.com/?q=Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden" target="_blank" rel="noreferrer">Visa pa karta &nearr;</a></div><div><p className="eyebrow">Oppettider</p><p>Man&ndash;fre 10:00&ndash;18:00<br/>Lor 10:00&ndash;17:00<br/>Son stangt</p></div><div><p className="eyebrow">Kontakt</p><a href="tel:+46720147022">072&ndash;014 70 22</a><a href="https://instagram.com/b_ra_www" target="_blank" rel="noreferrer">Instagram &nearr;</a></div><div className="footer-bottom"><p className="copyright">&copy; 2026 Hudiksvalls Salong. Alla rattigheter forbehallna.</p><SocialIcons /></div></footer></>;
}

