import type { Metadata } from "next";
import "./globals.css";
import { ScrollReveals } from "./components/scroll-reveals";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hudiksvallsalong.com"),
  title: { default: "Herrfrisör i Hudiksvall | Hudiksvalls Salong", template: "%s | Hudiksvalls Salong" },
  description: "Herrfrisör i Hudiksvall för herr, pensionär, student, barn och skägg. Drop-in eller ring 072-014 70 22 för att boka tid.",
  alternates: { canonical: "/" },
  openGraph: { title: "Herrfrisör i Hudiksvall | Hudiksvalls Salong", description: "Klippning och skäggtrimning på Kungsgatan 14. Drop-in eller ring för att boka tid.", url: "/", siteName: "Hudiksvalls Salong", images: [{ url: "/images/barber-hero.png", width: 1200, height: 630, alt: "Herrklippning på Hudiksvalls Salong" }], type: "website", locale: "sv_SE" },
  twitter: { card: "summary_large_image", title: "Herrfrisör i Hudiksvall | Hudiksvalls Salong", description: "Klippning och skäggtrimning på Kungsgatan 14.", images: ["/images/barber-hero.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  appleWebApp: { capable: true, title: "Salong Admin", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body suppressHydrationWarning><ScrollReveals />{children}</body></html>;
}
