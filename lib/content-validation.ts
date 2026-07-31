import type { SiteContent } from "./site-content";

const isText = (value: unknown, max = 5000): value is string => typeof value === "string" && value.length <= max;
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isImagePath = (value: unknown) => isText(value, 300) && /^\/images\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp)$/.test(value);
const isSocialUrl = (value: unknown, host: string) => value === "" || (isText(value, 500) && (() => { try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === host || url.hostname === `www.${host}`); } catch { return false; } })());

export function validateSiteContent(value: unknown): value is SiteContent {
  if (!isRecord(value) || !exactKeys(value, ["business", "landing", "prices", "galleryPage"])) return false;
  const { business, landing, prices, galleryPage } = value;

  if (!isRecord(business) || !exactKeys(business, ["name", "phoneDisplay", "phoneHref", "address", "postalCity", "weekdayHours", "saturdayHours", "sundayHours", "instagramUrl", "facebookUrl"])) return false;
  if (!Object.values(business).every((item) => isText(item, 300))) return false;
  if (!/^\+?[0-9 -]{7,20}$/.test(String(business.phoneHref))) return false;
  if (!isSocialUrl(business.instagramUrl, "instagram.com") || !isSocialUrl(business.facebookUrl, "facebook.com")) return false;

  if (!isRecord(landing) || !exactKeys(landing, ["heroEyebrow", "heroTitle", "bookingEyebrow", "bookingTitle", "bookingText", "galleryTitle", "galleryText", "beforeImage", "afterImage", "slides"])) return false;
  if (!["heroEyebrow", "heroTitle", "bookingEyebrow", "bookingTitle", "bookingText", "galleryTitle", "galleryText"].every((key) => isText(landing[key], 2000))) return false;
  if (!isImagePath(landing.beforeImage) || !isImagePath(landing.afterImage) || !Array.isArray(landing.slides) || landing.slides.length > 30) return false;
  if (!landing.slides.every((slide) => isRecord(slide) && exactKeys(slide, ["src", "title", "text"]) && isImagePath(slide.src) && isText(slide.title, 300) && isText(slide.text, 2000))) return false;

  if (!Array.isArray(prices) || prices.length > 100 || !prices.every((price) => isRecord(price) && exactKeys(price, ["service", "price"]) && isText(price.service, 300) && isText(price.price, 100))) return false;

  if (!isRecord(galleryPage) || !exactKeys(galleryPage, ["eyebrow", "title", "intro", "beforeImage", "afterImage", "chapters"])) return false;
  if (!isText(galleryPage.eyebrow, 300) || !isText(galleryPage.title, 2000) || !isText(galleryPage.intro, 2000) || !isImagePath(galleryPage.beforeImage) || !isImagePath(galleryPage.afterImage) || !Array.isArray(galleryPage.chapters) || galleryPage.chapters.length > 30) return false;
  return galleryPage.chapters.every((chapter) => isRecord(chapter) && exactKeys(chapter, ["title", "text", "images"]) && isText(chapter.title, 300) && isText(chapter.text, 2000) && Array.isArray(chapter.images) && chapter.images.length <= 50 && chapter.images.every((image) => isRecord(image) && exactKeys(image, ["src", "title"]) && isImagePath(image.src) && isText(image.title, 300)));
}
