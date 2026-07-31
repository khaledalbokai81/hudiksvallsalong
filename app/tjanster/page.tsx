import { SiteHeader } from "../components/site-header";
import { InteractiveMap } from "../components/interactive-map";
import { ReferencePoster } from "../components/reference-poster";

const services = [
  { number: "01", title: "Herrklippning", text: "En noggrann klippning anpassad efter din stil.", price: "300 kr" },
  { number: "02", title: "Sk\u00e4ggtrimning", text: "Trimning och form for ett valvardat skagg.", price: "200 kr" },
  { number: "03", title: "Har + skagg", text: "Klippning och skaggtrimning i samma behandling.", price: "400 kr" },
  { number: "04", title: "Barnklippning", text: "En smidig klippning for de yngre kunderna.", price: "250 kr" },
  { number: "05", title: "Pension\u00e4rsklippning", text: "Klassisk klippning med god service och tid.", price: "250 kr" },
  { number: "06", title: "Maskinklippning", text: "Ren och enkel klippning med maskin.", price: "200 kr" },
  { number: "07", title: "Tvatt & styling", text: "Avslutande tvatt och styling for en skarp finish.", price: "150 kr" },
  { number: "08", title: "Konturtrimning", text: "Snabb uppfr\u00e4schning av nacke, tinningar och skagg.", price: "150 kr" },
];

function SocialIcons() {
  return <div className="footer-social" aria-label="Sociala medier"><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.6 1.7-1.6h1.6V3.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V10H9v3h2.4v8H14Z" fill="currentColor" stroke="none"/></svg></a></div>;
}

export default function ServicesPage() {
  return <><SiteHeader /><main className="services-page"><ReferencePoster /></main><InteractiveMap /><footer id="hitta-hit"><div className="footer-brand">HUDIKSVALLS<br/><em>SALONG</em></div><div><p className="eyebrow">Besok oss</p><address>Kungsgatan 14<br/>824 30 Hudiksvall</address><a href="https://maps.google.com/?q=Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden" target="_blank" rel="noreferrer">Visa pa karta &nearr;</a></div><div><p className="eyebrow">Oppettider</p><p>Man&ndash;fre 10:00&ndash;18:00<br/>Lor 11:00&ndash;16:00<br/>Son stangt</p></div><div><p className="eyebrow">Kontakt</p><a href="tel:+46702564122">070&ndash;256 41 22</a><a href="https://instagram.com/b_ra_www" target="_blank" rel="noreferrer">Instagram &nearr;</a></div><div className="footer-bottom"><p className="copyright">&copy; 2026 Hudiksvalls Salong. Alla rattigheter forbehallna.</p><SocialIcons /></div></footer></>;
}

