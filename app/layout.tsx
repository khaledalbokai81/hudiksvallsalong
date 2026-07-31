import type { Metadata } from "next";
import "./globals.css";
import { ScrollReveals } from "./components/scroll-reveals";

export const metadata: Metadata = {
  title: "Hudiksvall Salong",
  description: "Herrklippning, skaggtrimning och har & skagg pa Hudiksvalls Salong. Valkommen pa drop-in under vara oppettider.",
  keywords: ["barberare Hudiksvall", "herrklippning Hudiksvall", "skäggtrimning", "barbershop Hudiksvall"],
  alternates: { canonical: "/" },
  openGraph: { title: "Hudiksvalls Salong | Herrfrisor i Hudiksvall", description: "Klassisk herrklippning och skaggtrimning i hjartat av Hudiksvall.", type: "website", locale: "sv_SE" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body suppressHydrationWarning><ScrollReveals />{children}</body></html>;
}
