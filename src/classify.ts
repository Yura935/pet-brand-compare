import * as cheerio from "cheerio";
import { brandFromTitle, cleanBrandName } from "./brands.js";
import type { CardResult } from "./types.js";

type Offer = {
  availability?: string;
  offers?: Offer | Offer[];
};

type ProductNode = {
  "@type"?: string;
  "@graph"?: ProductNode[];
  brand?: { name?: string };
  offers?: Offer | Offer[];
};

// Дістає об'єкти Product із блоків schema.org на сторінці.
function productNodes(html: string): ProductNode[] {
  const nodes: ProductNode[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const data = JSON.parse(match[1] || "") as ProductNode;
      const list = data["@graph"] || [data];
      for (const node of list) {
        if (node && node["@type"] === "Product") nodes.push(node);
      }
    } catch {
      // Пропускає зіпсований блок і читає наступний.
    }
  }
  return nodes;
}

// Збирає всі пропозиції товару, включно з вкладеним списком.
function offerList(offers: Offer | Offer[] | undefined): Offer[] {
  if (!offers) return [];
  if (Array.isArray(offers)) return offers.flatMap((offer) => offerList(offer));
  if (Array.isArray(offers.offers)) return offers.offers.flatMap((offer) => offerList(offer));
  return [offers];
}

// Визначає бренд і статус картки Petslike.
export function classifyPetslike(html: string, names: string[] = []): CardResult {
  const $ = cheerio.load(html);
  const product = $(".product").first();
  const scope = product.length ? product : $("body");
  const text = scope.text().replace(/\s+/g, " ");
  let source = "";
  $("tr, li, div, span, td").each((_, element) => {
    const value = $(element).text().replace(/\s+/g, " ").trim();
    if (/^Бренд:\s*\S/.test(value) && (!source || value.length < source.length)) source = value;
  });
  const heading = $("h1").first().text();
  const brand = cleanBrandName(source) || brandFromTitle(heading, names);
  if (/знятий з виробництва|знято з виробництва/i.test(text)) {
    return { brand, status: "discontinued" };
  }
  const offers = scope.find(".product__offer");
  let inStock = false;
  offers.each((_, element) => {
    const buy = $(element).find(".js-product-offer-buy").first();
    const style = buy.attr("style") || "";
    if (buy.length && !/display\s*:\s*none/i.test(style)) inStock = true;
  });
  return { brand, status: inStock ? "inStock" : "outOfStock" };
}

// Визначає бренд і статус картки Pethouse.
export function classifyPethouse(html: string, names: string[] = []): CardResult {
  const products = productNodes(html);
  const product = products[0];
  const $ = cheerio.load(html);
  const heading = $("h1").first().text();
  const brand = cleanBrandName(product?.brand?.name || "") || brandFromTitle(heading, names);
  $("script, style, noscript").remove();
  const visible = $("body").text().replace(/\s+/g, " ");
  const main = visible.split("Схожі товари")[0] || "";
  if (main.includes("Товар знятий з продажу")) {
    return { brand, status: "discontinued" };
  }
  const inStock = offerList(product?.offers).some((offer) =>
    String(offer.availability || "").endsWith("InStock"),
  );
  return { brand, status: inStock ? "inStock" : "outOfStock" };
}
