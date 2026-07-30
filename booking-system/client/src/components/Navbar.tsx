import { useState } from "react";

const websiteUrl = "http://localhost:3000";
const links = [
  { href: `${websiteUrl}/tjanster`, label: "Tjänster" },
  { href: websiteUrl, label: "Om oss" },
  { href: `${websiteUrl}/galleri`, label: "Galleri" }
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className={`salon-system-header ${open ? "menu-open" : ""}`}>
      <a className="salon-header-brand" href={websiteUrl} aria-label="Hudiksvalls Salong, startsida">
        <img src="/hudiksvalls-salong-wordmark.svg" alt="Hudiksvalls Salong" />
      </a>
      <nav className="salon-header-nav" aria-label="Huvudmeny">
        {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <div className="salon-header-actions">
        <a className="salon-header-book" href={`${websiteUrl}/boka`}>Boka tid <span aria-hidden="true">→</span></a>
        <button
          className="salon-header-toggle"
          type="button"
          aria-label={open ? "Stäng meny" : "Öppna meny"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span/><span/>
        </button>
      </div>
      <div className="salon-header-mobile" aria-hidden={!open}>
        {links.map((link, index) => <a href={link.href} key={link.href}><span>0{index + 1}</span>{link.label}<b>→</b></a>)}
        <a className="salon-header-mobile-book" href={`${websiteUrl}/boka`}>Boka tid online <b>→</b></a>
      </div>
    </header>
  );
}
