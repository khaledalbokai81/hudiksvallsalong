import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hudiksvalls Salong | Herrfrisor i Hudiksvall",
  description: "Herrklippning, skaggtrimning och har & skagg pa Hudiksvalls Salong. Boka tid online eller valkommen pa drop-in.",
  keywords: ["barberare Hudiksvall", "herrklippning Hudiksvall", "skäggtrimning", "barbershop Hudiksvall"],
  alternates: { canonical: "/" },
  openGraph: { title: "Hudiksvalls Salong | Herrfrisor i Hudiksvall", description: "Klassisk herrklippning och skaggtrimning i hjartat av Hudiksvall.", type: "website", locale: "sv_SE" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body suppressHydrationWarning>{children}</body></html>;
}
