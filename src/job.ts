import fs from "node:fs";
import path from "node:path";
import { addCard, buildRows, loadAliases, mergeRows, siteBrandNames } from "./brands.js";
import { MissingPageError, readPethouse, sleep } from "./browser.js";
import { classifyPetslike, classifyPethouse } from "./classify.js";
import { parsePetslikeBrands, parsePethouseBrands, parseSitemapLocs, pethouseProductUrls, petslikeProductUrls } from "./lists.js";
import { addIssue, errorMessage, issuesFromLog, log, rememberIssues } from "./log.js";
import type { AliasGroup, Issue, Job, PublicJob, PublicSite, ReadText, Site } from "./types.js";
import { writeWorkbook } from "./xlsx.js";

const DATA_DIR = path.resolve("data");
const JOB_PATH = path.join(DATA_DIR, "job.json");
const ALIASES_PATH = path.resolve("aliases.json");
const SITES: Site[] = ["petslike", "pethouse"];

const URLS = {
  petslikeBrands: "https://petslike.ua/brand",
  pethouseBrands: "https://pethouse.ua/ua/brand/",
  petslikeProducts: "https://petslike.ua/sitemap/products.xml",
  pethouseSitemap: "https://pethouse.ua/sitemap.xml",
};

let current: Job | null = null;
let running = false;
let issues: Issue[] = [];
let issuesLoaded = false;

const LOG_PATH = path.join(DATA_DIR, "app.log");

rememberIssues((issue) => {
  loadIssues();
  addIssue(issues, issue);
});

// Повертає поточний стан збору для екрана.
export function getJob(): Job | null {
  return current || loadJob();
}

// Починає новий збір і прибирає попередній результат з екрана.
export function startJob(readText: ReadText): Job {
  if (running && current) return current;
  issues = [];
  issuesLoaded = true;
  current = emptyJob();
  saveJob(current);
  void execute(readText);
  return current;
}

// Продовжує збір з кроку, на якому він зупинився.
export function continueJob(readText: ReadText): Job {
  if (running && current) return current;
  current = loadJob() || emptyJob();
  current.status = "running";
  current.error = null;
  saveJob(current);
  void execute(readText);
  return current;
}

// Після перезапуску процесу підхоплює незавершений збір.
export function resumeIfNeeded(readText: ReadText): void {
  const saved = loadJob();
  if (saved && saved.status === "running") {
    current = saved;
    log("INFO", "Продовжую незавершений збір");
    void execute(readText);
  }
}

function emptyJob(): Job {
  return {
    status: "idle",
    phase: "brands",
    error: null,
    warning: null,
    percent: 0,
    statusLine: "",
    skipped: 0,
    processed: 0,
    total: 0,
    site: null,
    rows: [],
    urls: null,
    next: { petslike: 0, pethouse: 0 },
    xlsxPath: null,
  };
}

function loadJob(): Job | null {
  if (!fs.existsSync(JOB_PATH)) return null;
  return JSON.parse(fs.readFileSync(JOB_PATH, "utf8")) as Job;
}

function saveJob(job: Job): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${JOB_PATH}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(job));
  fs.renameSync(temporary, JOB_PATH);
}

// Веде збір від поточного кроку до файлу.
async function execute(readText: ReadText): Promise<void> {
  running = true;
  const job = current;
  if (!job) {
    running = false;
    return;
  }
  const groups = loadAliases(ALIASES_PATH);
  job.rows = mergeRows(job.rows, groups);
  job.status = "running";
  try {
    if (!job.rows.length) await loadBrands(job, readText, groups);
    if (!job.urls) await loadLists(job, readText);
    await loadCards(job, readText, groups);
    await writeFile(job, groups);
    job.status = "done";
    job.percent = 100;
    job.site = null;
    job.statusLine = job.warning ? `Готово. ${job.warning}` : "Готово";
    log("INFO", job.statusLine);
  } catch (error) {
    job.status = "error";
    job.error = errorMessage(error);
    job.statusLine = job.error;
    log("ERROR", job.error);
  } finally {
    saveJob(job);
    running = false;
  }
}

// Читає довідники брендів і одразу ставить Null для відсутніх.
async function loadBrands(job: Job, readText: ReadText, groups: AliasGroup[]): Promise<void> {
  job.phase = "brands";
  job.percent = 0;
  job.statusLine = "Збираю список брендів";
  const petslikeHtml = await readRequired(readText, URLS.petslikeBrands);
  const pethouseHtml = await readRequired(readPethouse, URLS.pethouseBrands);
  const catalog = {
    petslike: parsePetslikeBrands(petslikeHtml),
    pethouse: parsePethouseBrands(pethouseHtml),
  };
  if (!catalog.petslike.length || !catalog.pethouse.length) {
    throw new Error("Довідник брендів порожній");
  }
  job.rows = buildRows(catalog, groups);
  log("INFO", `Бренди: Petslike ${catalog.petslike.length}, Pethouse ${catalog.pethouse.length}`);
  saveJob(job);
}

// Читає списки карток з карт сайтів.
async function loadLists(job: Job, readText: ReadText): Promise<void> {
  job.phase = "lists";
  job.percent = 0;
  job.statusLine = "Збираю список карток";
  const petslikeXml = await readRequired(readText, URLS.petslikeProducts);
  const indexXml = await readRequired(readPethouse, URLS.pethouseSitemap);
  const pethouseLocs: string[] = [];
  for (const sitemapUrl of parseSitemapLocs(indexXml)) {
    if (!/sobakam|koshkam|horkam|grizunam|rybam|pticam|reptiliyam/.test(sitemapUrl)) continue;
    const xml = await readRequired(readPethouse, sitemapUrl);
    pethouseLocs.push(...parseSitemapLocs(xml));
  }
  job.urls = {
    petslike: petslikeProductUrls(parseSitemapLocs(petslikeXml)),
    pethouse: pethouseProductUrls(pethouseLocs),
  };
  job.total = job.urls.petslike.length + job.urls.pethouse.length;
  if (!job.total) throw new Error("Список карток порожній");
  log("INFO", `Картки: Petslike ${job.urls.petslike.length}, Pethouse ${job.urls.pethouse.length}`);
  saveJob(job);
}

const BATCH: Record<Site, number> = { petslike: 2, pethouse: 4 };

// Веде Petslike через Chrome і Pethouse звичайними запитами одночасно.
async function loadCards(job: Job, readText: ReadText, groups: AliasGroup[]): Promise<void> {
  if (!job.urls) throw new Error("Список карток порожній");
  job.phase = "cards";
  log("INFO", "Petslike через Chrome, Pethouse звичайними запитами, одночасно");
  await Promise.all(SITES.map((site) => loadSite(job, site, site === "pethouse" ? readPethouse : readText, groups)));
  saveJob(job);
}

// Відкриває картки одного сайту пачками і розкладає їх по статусах.
async function loadSite(job: Job, site: Site, readText: ReadText, groups: AliasGroup[]): Promise<void> {
  const urls = job.urls;
  if (!urls) return;
  let sinceSave = 0;
  while (job.next[site] < urls[site].length) {
    const start = job.next[site];
    const batch = urls[site].slice(start, start + BATCH[site]);
    await Promise.all(batch.map((url) => readCard(job, site, url, readText, groups)));
    job.next[site] = start + batch.length;
    job.processed = job.next.petslike + job.next.pethouse;
    job.percent = Math.min(99, Math.floor((job.processed / job.total) * 100));
    job.site = site;
    job.statusLine = statusLine(job);
    sinceSave += batch.length;
    if (sinceSave >= 50) {
      sinceSave = 0;
      saveJob(job);
    }
  }
}

// Тричі пробує прочитати картку. Сторінку 404 пропускає одразу.
async function readCard(job: Job, site: Site, url: string, readText: ReadText, groups: AliasGroup[]): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const html = await readText(url);
      const names = siteBrandNames(job.rows, site);
      const result = site === "petslike" ? classifyPetslike(html, names) : classifyPethouse(html, names);
      if (!result.brand) {
        job.skipped += 1;
        log("WARN", `Немає бренду: ${url}`);
        return;
      }
      addCard(job.rows, site, result.brand, result.status, groups);
      return;
    } catch (error) {
      if (error instanceof MissingPageError) {
        job.skipped += 1;
        log("WARN", `Пропущено ${url}: ${error.message}`);
        return;
      }
      lastError = error;
      await sleep(2000 * attempt);
    }
  }
  job.skipped += 1;
  log("WARN", `Пропущено ${url}: ${errorMessage(lastError)}`);
}

// Записує xlsx після повного проходу карток.
async function writeFile(job: Job, groups: AliasGroup[]): Promise<void> {
  job.phase = "file";
  job.statusLine = "Записую файл";
  const ratio = job.total ? job.skipped / job.total : 0;
  if (ratio > 0.05) {
    job.warning = `Пропущено ${job.skipped} карток (${Math.round(ratio * 100)}%).`;
    log("WARN", job.warning);
  }
  const day = new Date().toISOString().slice(0, 10);
  const filePath = path.join(DATA_DIR, `porivnyannya-saitiv-${day}.xlsx`);
  await writeWorkbook(mergeRows(job.rows, groups), filePath);
  job.xlsxPath = filePath;
}

function statusLine(job: Job): string {
  const siteName = job.site === "pethouse" ? "Pethouse" : "Petslike";
  return `${siteName}: розкладено ${job.processed} з ${job.total}. Пропущено ${job.skipped}.`;
}

// Повторює обов'язкову сторінку тричі, потім зупиняє збір.
async function readRequired(readText: ReadText, url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await readText(url);
    } catch (error) {
      if (error instanceof MissingPageError) throw error;
      lastError = error;
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`Не вдалося прочитати ${url}. ${errorMessage(lastError)}`);
}

// Готує стан для відповіді екрану без довгих списків адрес.
export function publicJob(job: Job | null): PublicJob {
  const source = job || emptyJob();
  return {
    status: source.status || "idle",
    percent: source.percent || 0,
    statusLine: source.statusLine || "",
    error: source.error || null,
    warning: source.warning || null,
    downloadEnabled: source.status === "done" && Boolean(source.xlsxPath),
    analyzeEnabled: source.status !== "running",
    continueMode: source.status === "error",
    rows: mergeRows(source.rows || [], loadAliases(ALIASES_PATH)).map((row) => ({
      title: row.title,
      petslike: viewSite(row, "petslike"),
      pethouse: viewSite(row, "pethouse"),
    })),
    issues: loadIssues(),
  };
}

// Читає вже записані warn і error один раз за запуск процесу.
function loadIssues(): Issue[] {
  if (issuesLoaded) return issues;
  const text = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf8") : "";
  issues = issuesFromLog(text);
  issuesLoaded = true;
  return issues;
}

function viewSite(row: Job["rows"][number], site: Site): PublicSite {
  if (!row[site].onSite) return { inStock: "Null", outOfStock: "Null", discontinued: "Null" };
  return {
    inStock: row[site].inStock,
    outOfStock: row[site].outOfStock,
    discontinued: row[site].discontinued,
  };
}

export function xlsxPath(): string | null {
  return current?.xlsxPath || loadJob()?.xlsxPath || null;
}
