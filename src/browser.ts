import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { errorMessage, log } from "./log.js";

const CHECK_WAIT_MS = 180000;
const PROFILE_DIR = path.resolve("data", "chrome-profile");

const PAUSE_MS = 500;
const PETHOUSE_PAUSE_MS = 150;
const PETHOUSE_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let queue: Promise<void> = Promise.resolve();
let pethouseQueue: Promise<void> = Promise.resolve();
let securityNotice: (message: string) => void = (message) => log("INFO", message);

// Показує на екрані збору, що треба підтвердити перевірку у вікні Chrome.
export function whenSecurityCheck(listener: (message: string) => void): void {
  securityNotice = listener;
}

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

// Відкриває звичайний Chrome. Підроблений агент і позначка автоматизації зривають перевірку.
async function launchBrowser(): Promise<BrowserContext> {
  const options = {
    headless: false,
    viewport: null,
    locale: "uk-UA",
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  };
  try {
    return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel: "chrome" });
  } catch (error) {
    log("WARN", `Chrome не відкрився: ${errorMessage(error)}`);
    return chromium.launchPersistentContext(PROFILE_DIR, options);
  }
}

// Відкриває один браузер і заходить на обидва магазини, щоб отримати сесію.
export async function openBrowser(): Promise<void> {
  context = await launchBrowser();
  browser = context.browser() ?? undefined;
  const page = context.pages()[0] ?? (await context.newPage());
  await openPage(page, "https://petslike.ua/");
  await openPage(page, "https://pethouse.ua/ua/");
  await page.goto("about:blank");
  log("INFO", "Браузер відкрито");
}

// Відкриває адресу і чекає, поки зникне сторінка перевірки.
async function openPage(page: Page, url: string): Promise<void> {
  await loadDocument(page, url);
}

// Читає сторінку. Перший 403 від перевірки не вважає помилкою, якщо далі відкрився сайт.
async function loadDocument(page: Page, url: string): Promise<string> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  let text = await page.content();
  if (isChallenge(text)) {
    await page.bringToFront();
    text = await waitUntilReady(page, url);
  }
  if (response?.status() === 404) throw new MissingPageError(url);
  if (response && response.status() >= 400 && response.status() !== 403) {
    throw new Error(`Сайт не віддав сторінку ${url} (${response.status()})`);
  }
  if (isChallenge(text)) throw new Error(`Сайт показав перевірку замість сторінки ${url}`);
  return text;
}

// Чекає, поки у вікні Chrome підтвердять перевірку і сторінка не перезавантажиться знову.
async function waitUntilReady(page: Page, url: string): Promise<string> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let announced = false;
  let stable = 0;
  let latest = "";
  while (Date.now() < deadline) {
    if (page.isClosed()) throw new Error(`Вікно Chrome закрито до завершення перевірки ${url}`);
    try {
      latest = await page.content();
    } catch (error) {
      if (page.isClosed()) throw error;
      stable = 0;
      await page.waitForTimeout(500);
      continue;
    }
    if (isChallenge(latest)) {
      stable = 0;
      if (!announced) {
        announced = true;
        securityNotice("Підтвердьте у вікні Chrome, що ви людина. Не закривайте це вікно.");
      }
    } else {
      stable += 1;
      if (stable >= 2) return latest;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Сайт показав перевірку замість сторінки ${url}`);
}

// Закриває браузер після збору.
export async function closeBrowser(): Promise<void> {
  await context?.close();
  browser = undefined;
  context = undefined;
}

// Впізнає сторінку перевірки Cloudflare українською і англійською.
export function isChallenge(text: string): boolean {
  return /Just a moment|Трохи зачекайте|Триває перевірка безпеки|Підтвердьте, що ви людина|Performing security verification|cf-browser-verification|Attention Required/i.test(text);
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
    return await loadDocument(page, url);
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
