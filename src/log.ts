import fs from "node:fs";
import path from "node:path";
import type { Issue, Level } from "./types.js";

const filePath = path.resolve("data", "app.log");
let remember: ((issue: Issue) => void) | null = null;

// Передає кожен warn і error у таблицю Issues.
export function rememberIssues(listener: (issue: Issue) => void): void {
  remember = listener;
}

// Повертає локальний час у вигляді YYYY-MM-DDTHH:mm:ss.sss+HH:mm.
function localTimestamp(now: Date): string {
  const pad = (value: number, size = 2) => String(Math.trunc(Math.abs(value))).padStart(size, "0");
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

// Очищає журнал, щоб новий збір не підтягнув старі Issues.
export function clearLog(): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
}

// Пише один рядок журналу в консоль і у файл data/app.log.
export function log(level: Level, message: string): void {
  const line = `${localTimestamp(new Date())} ${level} ${message}`;
  if (level === "ERROR") console.error(line);
  else console.log(line);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${line}\n`);
  const issue = level === "WARN" || level === "ERROR" ? issueFromLine(line) : null;
  if (issue) remember?.(issue);
}

// Дістає warn або error з одного рядка журналу.
export function issueFromLine(line: string): Issue | null {
  const match = line.match(/ (WARN|ERROR) (.*)$/);
  if (!match || !match[1] || match[2] === undefined) return null;
  const message = match[2];
  if (message.startsWith("Російська мова на фото")) return null;
  return {
    level: match[1] === "ERROR" ? "error" : "warn",
    status: issueStatus(message),
    url: productUrl(message),
    detail: issueDetail(message, productUrl(message)),
    message,
  };
}

// Бере коротку назву події: текст до адреси товару або до двокрапки.
function issueStatus(message: string): string {
  const url = productUrl(message);
  const head = url ? message.slice(0, message.indexOf(url)) : message.split(":")[0];
  return head.replace(/[:\s]+$/, "").trim() || message.trim();
}

// Повертає фрагмент речення після адреси, якщо журнал його записав.
function issueDetail(message: string, url: string): string {
  if (!url) return "";
  const rest = message.slice(message.indexOf(url) + url.length);
  const mark = rest.match(/^\s+—\s+(.*)$/);
  return mark?.[1]?.trim() || "";
}

// Збирає унікальні warn і error з усього журналу.
export function issuesFromLog(text: string): Issue[] {
  const issues: Issue[] = [];
  for (const line of text.split(/\r?\n/)) {
    const issue = issueFromLine(line);
    if (issue) addIssue(issues, issue);
  }
  return issues;
}

// Додає запис, якщо такого самого ще немає.
export function addIssue(issues: Issue[], issue: Issue): void {
  const same = issues.some((item) => item.level === issue.level && item.url === issue.url && item.message === issue.message);
  if (!same) issues.push(issue);
}

// Повертає першу адресу з тексту без хвостової пунктуації.
function productUrl(message: string): string {
  const found = message.match(/https?:\/\/\S+/);
  return found ? found[0].replace(/[),.:;]+$/, "") : "";
}

// Повертає текст помилки з значення catch.
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
