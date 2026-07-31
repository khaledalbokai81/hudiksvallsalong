import content from "../../content/site-content.json";

export function SiteFooter() {
  const { business } = content;
  const mapUrl = "https://maps.app.goo.gl/98FjG87YQFpVDmhz8";
  return <footer id="hitta-hit">
    <div className="footer-brand">HUDIKSVALLS<br/><em>SALONG</em></div>
    <div>
      <p className="eyebrow">Besök oss</p>
      <address>{business.address}<br/>{business.postalCity}</address>
      <a href={mapUrl} target="_blank" rel="noreferrer">Visa på karta &nearr;</a>
    </div>
    <div>
      <p className="eyebrow">Öppettider</p>
      <p>Mån–fre {business.weekdayHours}<br/>Lör {business.saturdayHours}<br/>Sön {business.sundayHours}</p>
    </div>
    <div>
      <p className="eyebrow">Kontakt</p>
      <a href={`tel:${business.phoneHref}`}>{business.phoneDisplay}</a>
      {business.instagramUrl && <a href={business.instagramUrl} target="_blank" rel="noreferrer">Instagram &nearr;</a>}
      {business.facebookUrl && <a href={business.facebookUrl} target="_blank" rel="noreferrer">Facebook &nearr;</a>}
    </div>
    <div className="footer-bottom">
      <p className="copyright">&copy; 2026 Hudiksvalls Salong. Alla rättigheter förbehållna.</p>
      <nav className="footer-links" aria-label="Sidfotsmeny"><a href="/">Startsida</a><a href="/tjanster">Priser och tjänster</a><a href="/galleri">Galleri</a></nav>
      {(business.instagramUrl || business.facebookUrl) && <div className="footer-social" aria-label="Sociala medier">
        {business.instagramUrl && <a href={business.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>}
        {business.facebookUrl && <a href={business.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.6 1.7-1.6h1.6V3.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8V10H9v3h2.4v8H14Z" fill="currentColor" stroke="none"/></svg></a>}
      </div>}
    </div>
  </footer>;
}
