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

// Залишає адреси карток Petslike з карти товарів.
export function petslikeProductUrls(locs: string[]): string[] {
  return [...new Set(locs.filter((url) => {
    if (!url.includes("petslike.ua") || url.includes("/ru/")) return false;
    return !/\/(category|brand|page|sitemap)\//.test(url);
  }))];
}

// Залишає унікальні українські картки Pethouse.
export function pethouseProductUrls(locs: string[]): string[] {
  return [...new Set(locs.filter(isPethouseProductUrl))];
}
