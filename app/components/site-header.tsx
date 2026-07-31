"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Om oss" },
  { href: "/tjanster", label: "Priser" },
  { href: "/galleri", label: "Galleri" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const close = () => setOpen(false);
  const hrefFor = (href: string) => href === "/" && isHome ? "#top" : href;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <header className={`site-header ${open ? "menu-open" : ""}`}>
    <div className="site-header-inner">
      <a className="brand" href={isHome ? "#top" : "/"} onClick={close} aria-label="Hudiksvalls Salong, startsida">
        <img className="brand-logo" src="/hudiksvalls-salong-wordmark.svg" alt="Hudiksvalls Salong" />
      </a>
      <nav className="desktop-nav" aria-label="Huvudmeny">{links.map((link) => {
        const active = pathname === link.href;
        return <a href={hrefFor(link.href)} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={link.href}>{link.label}</a>;
      })}</nav>
      <div className="header-actions">
        <a className="header-phone" href="tel:+46720147022" onClick={close}><span><small>Drop-in</small>Ring oss</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg></a>
        <button className="menu-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "Stäng meny" : "Öppna meny"} aria-controls="mobile-navigation" aria-expanded={open}><span/><span/></button>
      </div>
    </div>
    <button className="menu-backdrop" type="button" onClick={close} aria-label="Stäng meny" tabIndex={open ? 0 : -1} />
    <div className="mobile-menu" id="mobile-navigation" aria-hidden={!open}>
      <div className="mobile-menu-label"><span>Meny</span><span>Hudiksvall</span></div>
      <nav aria-label="Mobilmeny">{links.map((link, index) => {
        const active = pathname === link.href;
        return <a href={hrefFor(link.href)} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={close} key={link.href}><span>0{index + 1}</span><strong>{link.label}</strong><b>&nearr;</b></a>;
      })}</nav>
      <div className="mobile-menu-footer"><div><small>Öppettider</small><p>Mån–fre 10–18 · Lör 11–16 · Sön stängt</p></div><a href="tel:+46720147022" onClick={close}><span>Ring 072–014 70 22</span><b>&rarr;</b></a></div>
    </div>
  </header>;
}

