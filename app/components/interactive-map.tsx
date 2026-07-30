"use client";

import { useState } from "react";

const location = "Kungsgatan%2014%2C%20824%2030%20Hudiksvall%2C%20Sweden";

export function InteractiveMap() {
  const [satellite, setSatellite] = useState(false);
  const src = `https://www.google.com/maps?q=${location}&z=16${satellite ? "&t=k" : ""}&output=embed`;

  return <section className={`map-footer ${satellite ? "is-satellite" : "is-roadmap"}`} aria-label="Interaktiv karta till salongen">
    <div className="map-toggle" role="group" aria-label="Valj kartvy"><button className={!satellite ? "active" : ""} onClick={() => setSatellite(false)}>Map</button><button className={satellite ? "active" : ""} onClick={() => setSatellite(true)}>Satellite</button></div>
    <iframe key={src} title="Karta till salongen pa Kungsgatan 14, Hudiksvall" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
  </section>;
}
