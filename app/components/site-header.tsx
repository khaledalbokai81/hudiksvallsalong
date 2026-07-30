"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/tjanster", label: "Tj\u00e4nster" },
  { href: "/#om-oss", label: "Om salongen" },
  { href: "/galleri", label: "Galleri" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const close = () => setOpen(false);
  return <header className={`site-header ${open ? "menu-open" : ""}`}>
    <a className="brand" href={isHome ? "#top" : "/"} onClick={close} aria-label="Hudiksvalls Salong, startsida"><img className="brand-logo" src="/hudiksvalls-salong-wordmark.svg" alt="Hudiksvalls Salong" /></a>
    <nav aria-label="Huvudmeny">{links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}</nav>
    <div className="header-actions"><a className="button header-book" href={isHome ? "#boka" : "/#boka"} onClick={close}>Boka tid <span aria-hidden="true">&rarr;</span></a><button className="menu-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "Stang meny" : "Oppna meny"} aria-expanded={open}><span/><span/></button></div>
    <div className="mobile-menu" aria-hidden={!open}>{links.map((link, index) => <a href={link.href} onClick={close} key={link.href}><span>0{index + 1}</span>{link.label}<b>&rarr;</b></a>)}<a className="mobile-menu-book" href={isHome ? "#boka" : "/#boka"} onClick={close}>Boka tid online <b>&rarr;</b></a></div>
  </header>;
}

