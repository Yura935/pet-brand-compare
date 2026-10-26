import assert from "node:assert/strict";
import test from "node:test";
import { addIssue, issueFromLine, issuesFromLog } from "../src/log.js";

test("варнінг із адресою товару стає рядком Issues", () => {
  const issue = issueFromLine(
    "2026-10-26T16:00:05.237+02:00 WARN Пропущено https://petslike.ua/lamb-brown-rice-junior-all-breeds: Сайт не віддав сторінку https://petslike.ua/lamb-brown-rice-junior-all-breeds (404)",
  );
  assert.equal(issue?.level, "warn");
  assert.equal(issue?.status, "Пропущено");
  assert.equal(issue?.url, "https://petslike.ua/lamb-brown-rice-junior-all-breeds");
});

test("статус береться з тексту журналу", () => {
  const missing = issueFromLine("2026-10-26T16:06:40.621+02:00 WARN Немає бренду: https://petslike.ua/apple");
  const other = issueFromLine("2026-10-26T16:06:40.621+02:00 WARN Chrome не відкрився: таймаут");
  assert.equal(missing?.status, "Немає бренду");
  assert.equal(other?.status, "Chrome не відкрився");
});

test("помилка теж потрапляє в Issues, інформаційний рядок ні", () => {
  const error = issueFromLine("2026-10-26T16:00:05.237+02:00 ERROR Не вдалося прочитати https://pethouse.ua/ua/shop/a/b/c/d.");
  assert.equal(error?.level, "error");
  assert.equal(error?.status, "Не вдалося прочитати");
  assert.equal(error?.url, "https://pethouse.ua/ua/shop/a/b/c/d");
  assert.equal(issueFromLine("2026-10-26T16:00:05.237+02:00 INFO Браузер відкрито"), null);
});

test("однаковий варнінг не дублюється", () => {
  const text = [
    "2026-10-26T16:06:40.621+02:00 WARN Немає бренду: https://petslike.ua/apple",
    "2026-10-26T17:36:21.766+02:00 WARN Немає бренду: https://petslike.ua/apple",
  ].join("\n");
  const issues = issuesFromLog(text);
  assert.equal(issues.length, 1);
  addIssue(issues, issues[0]);
  assert.equal(issues.length, 1);
});
