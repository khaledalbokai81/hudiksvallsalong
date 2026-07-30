export function SalonMapFooter() {
  return (
    <>
      <section className="salon-manage-map" aria-label="Hitta till Hudiksvalls Salong">
        <iframe
          title="Hudiksvalls Salong på karta"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden&output=embed"
        />
        <div className="salon-map-caption">
          <p>Hitta hit</p>
          <strong>Kungsgatan 14<br/>824 30 Hudiksvall</strong>
          <a href="https://maps.google.com/?q=Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden" target="_blank" rel="noreferrer">
            Öppna i Google Maps <span>↗</span>
          </a>
        </div>
      </section>
      <footer className="salon-manage-footer">
        <div className="salon-footer-brand">HUDIKSVALLS<br/><em>SALONG</em></div>
        <div><p>Besök oss</p><address>Kungsgatan 14<br/>824 30 Hudiksvall</address></div>
        <div><p>Öppettider</p><span>Mån–fre 10:00–18:00<br/>Lör 10:00–17:00<br/>Sön stängt</span></div>
        <div><p>Kontakt</p><a href="tel:+46702564122">070–256 41 22</a><a href="https://instagram.com/b_ra_www" target="_blank" rel="noreferrer">Instagram ↗</a></div>
        <small>© 2026 Hudiksvalls Salong. Alla rättigheter förbehållna.</small>
      </footer>
    </>
  );
}
