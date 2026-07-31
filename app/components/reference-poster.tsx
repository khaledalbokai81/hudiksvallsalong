import Image from "next/image";
import referencePoster from "../../refrence.jpg";
import content from "../../content/site-content.json";

function Moustache() {
  return <svg className="poster-moustache" viewBox="0 0 180 58" aria-hidden="true">
    <path d="M90 27C76 10 59 7 45 17C33 26 20 28 4 16C12 36 35 49 58 42C73 38 83 30 90 27Z" />
    <path d="M90 27C104 10 121 7 135 17C147 26 160 28 176 16C168 36 145 49 122 42C107 38 97 30 90 27Z" />
  </svg>;
}

function BarberPole() {
  return <span className="poster-pole" aria-hidden="true"><i /></span>;
}

function DotBlock() {
  return <span className="poster-dot-block" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</span>;
}

export function ReferencePoster() {
  const { business, prices } = content;
  return <section className="reference-poster-section" id="prislista" aria-labelledby="poster-title" data-reveal>
    <div className="reference-poster">
      <div className="poster-top">
        <BarberPole />
        <div className="poster-brand-lockup">
          <Moustache />
          <h2 id="poster-title">Hudiksvalls<br/>Salong</h2>
          <p>Drop in</p>
        </div>
        <BarberPole />
      </div>

      <div className="poster-photo-row">
        <DotBlock />
        <div className="poster-photo-crop">
          <Image src={referencePoster} alt="Skäggtrimning på Hudiksvalls Salong" priority={false} sizes="(max-width: 700px) 78vw, 580px" />
        </div>
        <DotBlock />
      </div>

      <div className="poster-cross-row" aria-hidden="true"><span>× × ×</span><span>× × ×</span></div>

      <div className="poster-info-grid">
        <div className="poster-hours" aria-label="Öppettider">
          <p><strong>Mån–Fre</strong><span>{business.weekdayHours}</span></p>
          <p><strong>Lör</strong><span>{business.saturdayHours}</span></p>
          <p><strong>Sön</strong><span>{business.sundayHours}</span></p>
        </div>
        <div className="poster-prices" aria-label="Prislista">
          {prices.map(({ service, price }) => <p key={service}><span>{service}</span><strong>{price}</strong></p>)}
        </div>
      </div>

      <div className="poster-cta-line"><span aria-hidden="true"/><strong>Boka din tid här</strong><span aria-hidden="true"/></div>
      <div className="poster-contact">
        <a href={`tel:${business.phoneHref}`}>{business.phoneDisplay}</a>
        <span className="poster-scissors" aria-hidden="true">✂</span>
        <a href="https://maps.app.goo.gl/98FjG87YQFpVDmhz8" target="_blank" rel="noreferrer">{business.address} Hudiksvall</a>
      </div>
    </div>
  </section>;
}
