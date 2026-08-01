"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import type { SiteContent } from "../../lib/site-content";
import { validateSiteContent } from "../../lib/content-validation";

type Upload = { path: string; sha: string };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const MAX_UPLOAD_BYTES = 2_800_000;
const DRAFT_KEY = "hudik-admin-draft-v2";

class AdminApiError extends Error {
  constructor(message: string, readonly status = 0, readonly currentCommit?: string) { super(message); }
}

async function adminRequest<T>(url: string, init: RequestInit, retries = 0): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...init.headers } });
      const text = await response.text();
      let result: Record<string, unknown> = {};
      try { result = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { throw new AdminApiError(response.status === 413 ? "Uppladdningen är för stor." : "Servern skickade ett oväntat svar.", response.status); }
      if (!response.ok) {
        const error = new AdminApiError(
          typeof result.error === "string" ? result.error : "Förfrågan misslyckades.",
          response.status,
          typeof result.currentCommit === "string" ? result.currentCommit : undefined,
        );
        if (attempt < retries && [0, 502, 503, 504].includes(response.status)) { lastError = error; continue; }
        throw error;
      }
      return result as T;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || (error instanceof AdminApiError && ![0, 502, 503, 504].includes(error.status))) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw lastError;
}

async function prepareImage(file: File) {
  const browserReady = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (browserReady && file.size <= MAX_UPLOAD_BYTES) return { blob: file, extension: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg" };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Bilden kunde inte läsas. Välj JPG, PNG eller WebP, eller exportera HEIC-bilden som JPG.");
  }

  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Bilden kunde inte bearbetas i den här webbläsaren.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = .86;
  let blob: Blob | null = null;
  do {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    quality -= .1;
  } while (blob && blob.size > MAX_UPLOAD_BYTES && quality >= .46);
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("Bilden är fortfarande för stor efter optimering. Prova en mindre bild.");
  return { blob, extension: "jpg" };
}

function AdminSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return <section className={`admin-section${expanded ? " is-expanded" : ""}`}>
    <button className="admin-section-toggle" type="button" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded}>
      <span><strong>{title}</strong><small>{hint}</small></span>
      <span className="admin-section-chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /></svg>
      </span>
    </button>
    <div className="admin-section-content">{children}</div>
  </section>;
}

function InstallAdminApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    const ready = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const completed = () => { setInstalled(true); setShowGuide(false); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", completed);
    return () => { window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", completed); };
  }, []);

  if (installed) return null;

  async function install() {
    if (!promptEvent) return setShowGuide(true);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  return <>
    <button className="admin-install-button" type="button" onClick={install}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>
      Installera adminappen
    </button>
    {showGuide && <div className="install-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
      <div className="install-guide">
        <button className="install-guide-close" type="button" aria-label="Stäng" onClick={() => setShowGuide(false)}>×</button>
        <p>Installera på mobilen</p><h2 id="install-guide-title">Lägg appen på hemskärmen</h2>
        <ol>
          <li><span>1</span><div><strong>Tryck på Dela</strong><small>Symbolen ser ut som en ruta med en pil uppåt.</small></div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v9h14v-9" /></svg></li>
          <li><span>2</span><div><strong>Välj “Lägg till på hemskärmen”</strong><small>Scrolla lite nedåt om valet inte syns direkt.</small></div></li>
          <li><span>3</span><div><strong>Tryck på “Lägg till”</strong><small>Appen hamnar sedan bland dina andra appar.</small></div></li>
        </ol>
        <button className="install-guide-done" type="button" onClick={() => setShowGuide(false)}>Jag förstår</button>
      </div>
    </div>}
  </>;
}

export function AdminPanel({ initialContent, initiallyAuthenticated, initialCommit }: { initialContent: SiteContent; initiallyAuthenticated: boolean; initialCommit: string | null }) {
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [password, setPassword] = useState("");
  const [content, setContent] = useState<SiteContent>(structuredClone(initialContent));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expectedCommit, setExpectedCommit] = useState<string | null>(initialCommit);
  const [publishId, setPublishId] = useState("");
  const draftHydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as { content?: SiteContent; uploads?: Upload[]; expectedCommit?: string | null; publishId?: string; savedAt?: number };
        const restoredUploads = Array.isArray(draft.uploads) ? draft.uploads : null;
        if (draft.savedAt && Date.now() - draft.savedAt < 30 * 24 * 60 * 60 * 1000 && validateSiteContent(draft.content) && restoredUploads && restoredUploads.every((upload) => upload && /^public\/images\/admin\/[a-zA-Z0-9._-]+\.(?:jpg|png|webp)$/.test(upload.path) && /^[a-f0-9]{40}$/.test(upload.sha))) {
          setContent(draft.content); setUploads(restoredUploads); setExpectedCommit(initialCommit ?? draft.expectedCommit ?? null); setPublishId(draft.publishId || crypto.randomUUID()); setStatus("Ett lokalt utkast har återställts.");
        }
      }
    } catch { localStorage.removeItem(DRAFT_KEY); }
    if (!publishId) setPublishId(crypto.randomUUID());
    draftHydrated.current = true;
  }, [initialCommit]);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, uploads, expectedCommit, publishId, savedAt: Date.now() })); }
      catch { setStatus("Utkastet kunde inte sparas lokalt. Behåll sidan öppen tills du har publicerat."); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [content, uploads, expectedCommit, publishId]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      await adminRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      setAuthenticated(true); setPassword("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Inloggningen misslyckades."); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (busy) return;
    setBusy(true); setStatus("Publicerar till GitHub …");
    const id = publishId || crypto.randomUUID(); setPublishId(id);
    try {
      const result = await adminRequest<{ message: string; commit: string }>("/api/admin/publish", { method: "POST", body: JSON.stringify({ content, uploads, expectedCommit, publishId: id }) }, 1);
      setStatus(result.message); setUploads([]); setPreviews({}); setExpectedCommit(result.commit); setPublishId(crypto.randomUUID()); localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) { setAuthenticated(false); setStatus("Sessionen gick ut. Logga in igen – utkastet är sparat."); }
      else if (error instanceof AdminApiError && error.status === 409 && error.currentCommit) {
        setExpectedCommit(error.currentCommit);
        setStatus("GitHub hade en nyare version. Utkastet är kvar och har synkroniserats – tryck Publicera igen.");
      } else setStatus(error instanceof Error ? error.message : "Publiceringen misslyckades. Utkastet finns kvar.");
    } finally { setBusy(false); }
  }

  const uploadFor = (setPath: (path: string) => void, previousPath: string) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return setStatus("Välj en giltig bildfil.");
    setBusy(true); setStatus("Förbereder bilden …");
    let prepared: Awaited<ReturnType<typeof prepareImage>>;
    try { prepared = await prepareImage(file); } catch (error) { setBusy(false); return setStatus(error instanceof Error ? error.message : "Bilden kunde inte bearbetas."); }
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${prepared.extension}`;
    const path = `public/images/admin/${filename}`;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Bilden kunde inte läsas.")); reader.readAsDataURL(prepared.blob); });
      setStatus("Laddar upp bilden säkert …");
      const staged = await adminRequest<Upload>("/api/admin/upload", { method: "POST", body: JSON.stringify({ path, content: dataUrl.split(",")[1] }) }, 1);
      setUploads((old) => [...old.filter((item) => item.path !== previousPath.replace(/^\//, "public/")), staged]);
      const publicPath = `/images/admin/${filename}`;
      setPreviews((old) => ({ ...old, [publicPath]: dataUrl }));
      setPath(publicPath); setStatus(`${file.name} är uppladdad och ingår i nästa publicering.`);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) { setAuthenticated(false); setStatus("Sessionen gick ut. Logga in och välj bilden igen."); }
      else setStatus(error instanceof Error ? error.message : "Bilden kunde inte laddas upp.");
    } finally { setBusy(false); event.target.value = ""; }
  };

  const input = (label: string, value: string, set: (value: string) => void, area = false) => (
    <label><span>{label}</span>{area ? <textarea value={value} onChange={(e) => set(e.target.value)} /> : <input value={value} onChange={(e) => set(e.target.value)} />}</label>
  );
  const image = (label: string, src: string, set: (value: string) => void) => (
    <div className="admin-image"><img src={previews[src] ?? (uploads.find((item) => item.path === src.replace(/^\//, "public/")) ? `/api/admin/staged-image?sha=${uploads.find((item) => item.path === src.replace(/^\//, "public/"))?.sha}` : src)} alt=""/><div><strong>{label}</strong><small>{src}</small><label className="upload-button">Byt bild<input type="file" accept="image/*" onChange={uploadFor(set, src)} /></label></div></div>
  );

  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><p>Hudiksvalls Salong</p><h1>Admin</h1><label><span>Lösenord</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></label><button disabled={busy}>Logga in</button>{status && <div className="admin-status error">{status}</div>}<InstallAdminApp /></form></main>;

  const setBusiness = (key: keyof SiteContent["business"], value: string) => setContent((old) => ({ ...old, business: { ...old.business, [key]: value } }));
  const setLanding = (key: keyof SiteContent["landing"], value: string) => setContent((old) => ({ ...old, landing: { ...old.landing, [key]: value } }));

  return <main className="admin-shell">
    <header><div><p>Hudiksvalls Salong</p><h1>Redigera webbplatsen</h1></div><div className="admin-actions"><a href="/" target="_blank">Visa webbplats</a><button onClick={publish} disabled={busy}>Publicera</button></div></header>
    {status && <div className="admin-status">{status}</div>}
    <AdminSection title="Företagsinformation" hint="Namn, kontakt och öppettider"><div className="form-grid">
      {input("Namn", content.business.name, (v) => setBusiness("name", v))}
      {input("Telefon (visning)", content.business.phoneDisplay, (v) => setBusiness("phoneDisplay", v))}
      {input("Telefon (länk)", content.business.phoneHref, (v) => setBusiness("phoneHref", v))}
      {input("Adress", content.business.address, (v) => setBusiness("address", v))}
      {input("Postnummer och ort", content.business.postalCity, (v) => setBusiness("postalCity", v))}
      {input("Måndag–fredag", content.business.weekdayHours, (v) => setBusiness("weekdayHours", v))}
      {input("Lördag", content.business.saturdayHours, (v) => setBusiness("saturdayHours", v))}
      {input("Söndag", content.business.sundayHours, (v) => setBusiness("sundayHours", v))}
      {input("Instagram-länk", content.business.instagramUrl, (v) => setBusiness("instagramUrl", v))}
      {input("Facebook-länk", content.business.facebookUrl, (v) => setBusiness("facebookUrl", v))}
    </div></AdminSection>
    <AdminSection title="Startsida – texter" hint="Rubriker och introduktioner"><div className="form-grid">
      {input("Hero – liten rubrik", content.landing.heroEyebrow, (v) => setLanding("heroEyebrow", v))}
      {input("Hero – huvudrubrik", content.landing.heroTitle, (v) => setLanding("heroTitle", v), true)}
      {input("Drop-in – liten rubrik", content.landing.bookingEyebrow, (v) => setLanding("bookingEyebrow", v))}
      {input("Drop-in – rubrik", content.landing.bookingTitle, (v) => setLanding("bookingTitle", v), true)}
      {input("Drop-in – text", content.landing.bookingText, (v) => setLanding("bookingText", v), true)}
      {input("Galleri – rubrik", content.landing.galleryTitle, (v) => setLanding("galleryTitle", v), true)}
      {input("Galleri – text", content.landing.galleryText, (v) => setLanding("galleryText", v), true)}
    </div></AdminSection>
    <AdminSection title="Prislista" hint={`${content.prices.length} tjänster`}><div className="price-editor">
      {content.prices.map((row, index) => <div key={index}>
        {input("Tjänst", row.service, (v) => setContent((old) => ({ ...old, prices: old.prices.map((p, i) => i === index ? { ...p, service: v } : p) })))}
        {input("Pris", row.price, (v) => setContent((old) => ({ ...old, prices: old.prices.map((p, i) => i === index ? { ...p, price: v } : p) })))}
        <button className="remove" onClick={() => setContent((old) => ({ ...old, prices: old.prices.filter((_, i) => i !== index) }))}>Ta bort</button>
      </div>)}
      <button className="secondary" onClick={() => setContent((old) => ({ ...old, prices: [...old.prices, { service: "Ny tjänst", price: "0" }] }))}>+ Lägg till pris</button>
    </div></AdminSection>
    <AdminSection title="Startsida – bilder" hint="Jämförelse, galleri och bildtexter"><div className="image-grid">
      {image("Före", content.landing.beforeImage, (v) => setLanding("beforeImage", v))}
      {image("Efter", content.landing.afterImage, (v) => setLanding("afterImage", v))}
      {content.landing.slides.map((slide, index) => image(`Galleribild ${index + 1}`, slide.src, (v) => setContent((old) => ({ ...old, landing: { ...old.landing, slides: old.landing.slides.map((s, i) => i === index ? { ...s, src: v } : s) } }))))}
    </div><div className="slide-copy">{content.landing.slides.map((slide, index) => <div key={index}>
      {input(`Bild ${index + 1} – titel`, slide.title, (v) => setContent((old) => ({ ...old, landing: { ...old.landing, slides: old.landing.slides.map((s, i) => i === index ? { ...s, title: v } : s) } })))}
      {input("Beskrivning", slide.text, (v) => setContent((old) => ({ ...old, landing: { ...old.landing, slides: old.landing.slides.map((s, i) => i === index ? { ...s, text: v } : s) } })), true)}
    </div>)}</div></AdminSection>
    <AdminSection title="Gallerisida" hint="Sidtext och alla galleribilder"><div className="form-grid">
      {input("Liten rubrik", content.galleryPage.eyebrow, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, eyebrow: v } })))}
      {input("Huvudrubrik", content.galleryPage.title, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, title: v } })), true)}
      {input("Introduktion", content.galleryPage.intro, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, intro: v } })), true)}
    </div><div className="image-grid">
      {image("Före", content.galleryPage.beforeImage, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, beforeImage: v } })))}
      {image("Efter", content.galleryPage.afterImage, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, afterImage: v } })))}
      {content.galleryPage.chapters.flatMap((chapter, chapterIndex) => chapter.images.map((item, imageIndex) => image(`${chapter.title} – ${item.title}`, item.src, (v) => setContent((old) => ({ ...old, galleryPage: { ...old.galleryPage, chapters: old.galleryPage.chapters.map((ch, ci) => ci === chapterIndex ? { ...ch, images: ch.images.map((im, ii) => ii === imageIndex ? { ...im, src: v } : im) } : ch) } })))))}
    </div></AdminSection>
    <footer><span>{uploads.length ? `${uploads.length} ny(a) bild(er) väntar` : "Ändringar sparas automatiskt"}</span><div><button onClick={publish} disabled={busy}>{busy ? "Sparar …" : "Spara och publicera"}</button></div></footer>
  </main>;
}
