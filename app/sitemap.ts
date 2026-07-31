import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.hudiksvallsalong.com";
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/tjanster`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/galleri`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
