import * as cheerio from "cheerio";

const RUSSIAN_WORD = /^(это|этот|эта|эти|что|чтобы|или|также|который|которая|которое|которые|купить|описание|состав|только|очень|можно|нужно|большой|большая|хорошая|наличие|отсутствует|бесплатно|скидка|новый|новая|цена|вес|кошек|кошка|кошки|щенков|щенки|котят)$/u;

// Каже, чи є в тексті російське слово або російська літера в слові.
export function hasRussian(text: string): boolean {
  return russianHit(text) !== null;
}

// Повертає російське слово і початок речення, де воно стоїть.
export function russianHit(text: string): { word: string; snippet: string } | null {
  const clean = text.replace(/\s+/g, " ").trim();
  for (const match of clean.matchAll(/\p{L}{3,}/gu)) {
    const word = match[0];
    if (match.index === undefined || !isRussianWord(word)) continue;
    return { word, snippet: sentenceAround(clean, match.index, word.length) };
  }
  return null;
}

// Перевіряє одне слово на російський словник або російську літеру.
function isRussianWord(word: string): boolean {
  const lower = word.toLowerCase();
  return RUSSIAN_WORD.test(lower) || (lower.length >= 4 && /[ыэёъ]/.test(lower));
}

// Бере початок речення і саме слово, щоб було видно місце помилки.
function sentenceAround(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const mark = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "));
  const sentence = mark === -1 ? 0 : mark + 2;
  let from = Math.max(sentence, index - 40);
  if (from > sentence) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < index) from = space + 1;
  }
  const to = Math.min(text.length, index + length + 40);
  let snippet = text.slice(from, to).trim();
  if (from > sentence) snippet = `…${snippet}`;
  if (to < text.length) snippet = `${snippet}…`;
  return snippet;
}

// Повертає видимий текст сторінки без скриптів і без відгуків покупців.
export function pageText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, [data-tab-content='reviews'], [data-id='reviews'], .comments, .add-reply-form").remove();
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
