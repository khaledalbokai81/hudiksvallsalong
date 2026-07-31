import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }, sitemap: "https://www.hudiksvallsalong.com/sitemap.xml", host: "https://www.hudiksvallsalong.com" };
}
