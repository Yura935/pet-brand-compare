import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { errorMessage, log } from "./log.js";

const PAUSE_MS = 500;
const PETHOUSE_PAUSE_MS = 150;
const PETHOUSE_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let queue: Promise<void> = Promise.resolve();
let pethouseQueue: Promise<void> = Promise.resolve();

// Позначає адресу, якої на сайті вже немає.
export class MissingPageError extends Error {
  constructor(url: string) {
    super(`Сайт не віддав сторінку ${url} (404)`);
    this.name = "MissingPageError";
  }
}

// Чекає пів секунди між стартами запитів.
function pause(): Promise<void> {
  const next = queue.then(() => sleep(PAUSE_MS));
  queue = next.catch(() => undefined);
  return next;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Бере встановлений Chrome, а якщо його немає — браузер Playwright.
async function launchBrowser(): Promise<Browser> {
  const options = { headless: true, args: ["--disable-blink-features=AutomationControlled"] };
  try {
    return await chromium.launch({ ...options, channel: "chrome" });
  } catch (error) {
    log("WARN", `Chrome не відкрився: ${errorMessage(error)}`);
    return chromium.launch(options);
  }
}

// Відкриває один браузер і заходить на обидва магазини, щоб отримати сесію.
export async function openBrowser(): Promise<void> {
  browser = await launchBrowser();
  context = await browser.newContext({
    locale: "uk-UA",
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "stylesheet" || type === "font" || type === "media") {
      void route.abort();
      return;
    }
    void route.continue();
  });
  const page = await context.newPage();
  await openPage(page, "https://petslike.ua/");
  await openPage(page, "https://pethouse.ua/ua/");
  await page.close();
  log("INFO", "Браузер відкрито");
}

// Відкриває адресу і чекає, поки зникне сторінка перевірки.
async function openPage(page: Page, url: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  let text = await page.content();
  if (isChallenge(text) || (response && response.status() >= 400)) {
    await page.waitForTimeout(5000);
    text = await page.content();
  }
  if (isChallenge(text)) throw new Error(`Сайт показав перевірку замість сторінки ${url}`);
}

// Закриває браузер після збору.
export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
  context = undefined;
}

function isChallenge(text: string): boolean {
  return /Just a moment|cf-browser-verification|Attention Required/i.test(text);
}

// Читає текст сторінки через сесію браузера.
export async function readText(url: string): Promise<string> {
  if (!context) throw new Error("Браузер не відкрито");
  await pause();
  const response = await context.request.get(url, { timeout: 45000, failOnStatusCode: false });
  if (response.status() === 404) throw new MissingPageError(url);
  const text = await response.text();
  if (response.status() < 400 && text && !isChallenge(text)) return text;
  return readWithPage(url);
}

// Відкриває сторінку у вкладці, якщо звичайний запит отримав блокування.
async function readWithPage(url: string): Promise<string> {
  if (!context) throw new Error("Браузер не відкрито");
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    let text = await page.content();
    if (isChallenge(text)) {
      await page.waitForTimeout(5000);
      text = await page.content();
    }
    const status = response ? response.status() : 0;
    if (status === 404) throw new MissingPageError(url);
    if (status >= 400 || isChallenge(text)) {
      throw new Error(`Сайт не віддав сторінку ${url} (${status})`);
    }
    return text;
  } finally {
    await page.close();
  }
}

function pausePethouse(): Promise<void> {
  const next = pethouseQueue.then(() => sleep(PETHOUSE_PAUSE_MS));
  pethouseQueue = next.catch(() => undefined);
  return next;
}

// Читає сторінку Pethouse звичайним запитом, без Chrome.
export async function readPethouse(url: string): Promise<string> {
  await pausePethouse();
  const response = await fetch(url, {
    headers: { "user-agent": PETHOUSE_AGENT, "accept-language": "uk" },
    signal: AbortSignal.timeout(45000),
  });
  if (response.status === 404) throw new MissingPageError(url);
  if (!response.ok) throw new Error(`Сайт не віддав сторінку ${url} (${response.status})`);
  return response.text();
}
