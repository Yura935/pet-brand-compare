import * as cheerio from "cheerio";

const RUSSIAN_WORD = /^(это|этот|эта|эти|что|чтобы|или|также|который|которая|которое|которые|купить|описание|состав|только|очень|можно|нужно|большой|большая|хороший|хорошая|наличие|отсутствует|бесплатно|скидка|новый|новая|цена|вес|кошек|кошка|кошки|щенков|щенки|котят|котята)$/u;

// Каже, чи є в тексті російське слово або російська літера в слові.
export function hasRussian(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}{3,}/gu) || [];
  return words.some((word) => RUSSIAN_WORD.test(word) || (word.length >= 4 && /[ыэёъ]/.test(word)));
}

// Повертає видимий текст сторінки без скриптів.
export function pageText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return ($("body").text() || $.root().text()).replace(/\s+/g, " ");
}

// Повертає адресу головного фото товару, без дрібних мініатюр і фасовок.
export function productPhotoUrl(html: string, pageUrl: string): string {
  const photos = [...html.matchAll(/https?:[^"'\\\s>]+\.(?:jpe?g|png|webp)/gi)].map((match) => match[0].replace(/&amp;/g, "&"));
  const main = photos.find((item) => /\/prods\//.test(item) && !/\/(?:small|packing)\//.test(item));
  if (main) return main;
  const $ = cheerio.load(html);
  const raw = $('meta[property="og:image"]').attr("content")
    || $(".product img, img[itemprop='image']").first().attr("src")
    || $(".product img, img[itemprop='image']").first().attr("data-src")
    || "";
  if (!raw || raw.startsWith("data:") || /\.svg(?:$|\?)/i.test(raw)) return "";
  try {
    return new URL(raw, pageUrl).href;
  } catch {
    return "";
  }
}
