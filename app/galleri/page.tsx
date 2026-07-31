import Image from "next/image";
import { BeforeAfterComparison } from "../components/before-after-comparison";
import { InteractiveMap } from "../components/interactive-map";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import content from "../../content/site-content.json";
import type { Metadata } from "next";
import { JsonLd } from "../components/json-ld";

export const metadata: Metadata = {
  title: "Galleri – herrklippning och skägg",
  description: "Se klippningar, skäggtrimning, före- och efterbilder samt detaljer från Hudiksvalls Salong på Kungsgatan 14.",
  alternates: { canonical: "/galleri" },
  openGraph: { title: "Galleri – Hudiksvalls Salong", description: "Se herrklippningar, skäggtrimning och resultat från salongen i Hudiksvall.", url: "/galleri", images: [{ url: "/images/gallery-after.png", alt: "Klippning på Hudiksvalls Salong" }] },
};

type GalleryImage = { src: string; title: string };

function GalleryChapter({ title, text, images }: { title: string; text: string; images: GalleryImage[] }) {
  return <section className="gallery-chapter"><div className="gallery-chapter-heading"><p className="eyebrow">Galleri</p><h2>{title}</h2><p>{text}</p></div><div className="gallery-chapter-grid">{images.map((image, index) => <figure key={`${image.src}-${index}`}><Image src={image.src} alt={`${image.title} på Hudiksvalls Salong`} width={1200} height={900} sizes="(max-width: 800px) 100vw, 50vw" /><figcaption>{String(index + 1).padStart(2, "0")} <span>{image.title}</span></figcaption></figure>)}</div></section>;
}

export default function GalleryPage() {
  const gallery = content.galleryPage;
  const titleLines = gallery.title.split("\n");
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Startsida", item: "https://www.hudiksvallsalong.com/" }, { "@type": "ListItem", position: 2, name: "Galleri", item: "https://www.hudiksvallsalong.com/galleri" }] };
  return <><JsonLd data={breadcrumb} /><SiteHeader /><main className="gallery-page"><section className="gallery-page-intro"><p className="eyebrow">{gallery.eyebrow}</p><h1>{titleLines[0]}<br/><em>{titleLines.slice(1).join(" ")}</em></h1><p>{gallery.intro}</p></section><BeforeAfterComparison className="gallery-page-comparison" beforeSrc={gallery.beforeImage} afterSrc={gallery.afterImage} /><div className="gallery-chapters">{gallery.chapters.map((chapter) => <GalleryChapter key={chapter.title} {...chapter} />)}</div></main><InteractiveMap /><SiteFooter /></>;
}

