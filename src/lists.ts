import * as cheerio from "cheerio";

// Дістає адреси з xml-карти сайту.
export function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => (match[1] || "").trim());
}

// Залишає українські картки товарів Pethouse.
export function isPethouseProductUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parsed.hostname.endsWith("pethouse.ua") && parts[0] === "ua" && parts[1] === "shop" && parts.length >= 6;
}

// Читає назви брендів зі сторінки Petslike.
export function parsePetslikeBrands(html: string): string[] {
  const $ = cheerio.load(html);
  const names = new Set<string>();
  $("a[href*='/brand/']").each((_, element) => {
    const href = $(element).attr("href") || "";
    const linkPath = href.replace(/^https?:\/\/[^/]+/, "");
    const parts = linkPath.split("/").filter(Boolean);
    const name = $(element).text().replace(/\s+/g, " ").trim();
    if (parts[0] === "brand" && parts.length === 2 && name && name !== "Бренди") names.add(name);
  });
  return [...names];
}

// Читає назви брендів зі сторінки Pethouse.
export function parsePethouseBrands(html: string): string[] {
  const $ = cheerio.load(html);
  const names = new Set<string>();
  $("a[href*='/brand/']").each((_, element) => {
    const href = $(element).attr("href") || "";
    const linkPath = href.replace(/^https?:\/\/[^/]+/, "");
    const parts = linkPath.split("/").filter(Boolean);
    const name = $(element).text().replace(/\s+/g, " ").trim();
    if (parts[0] === "ua" && parts[1] === "brand" && parts.length === 3 && name) names.add(name);
  });
  return [...names];
}

// Залишає по одній адресі на товар Petslike.
export function petslikeProductUrls(locs: string[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of locs) {
    if (!url.includes("petslike.ua") || url.includes("/ru/")) continue;
    if (/\/(category|brand|page|sitemap)\//.test(url)) continue;
    const key = productPath(url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

// Залишає по одній адресі на товар Pethouse, навіть якщо він є в кількох категоріях.
export function pethouseProductUrls(locs: string[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of locs) {
    if (!isPethouseProductUrl(url)) continue;
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const key = parts.at(-1) || url;
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

// Повертає шлях адреси без хвоста зі слеша, щоб одна картка не рахувалась двічі.
function productPath(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || url;
  } catch {
    return url;
  }
}
