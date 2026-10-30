import fs from "node:fs";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { openBrowser, readText } from "./browser.js";
import { continueJob, getJob, publicJob, resetJob, resumeIfNeeded, startJob, stopJob, xlsxPath } from "./job.js";
import { errorMessage, log } from "./log.js";
import type { PublicJob } from "./types.js";
import { issuesWorkbook } from "./xlsx.js";

const port = Number(process.env.PORT || 3000);
const publicDir = path.resolve("public");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// Віддає сторінку, стан збору і файл xlsx.
const server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/job" && request.method === "GET") return sendJson(response, publicJob(getJob()));
  if (url.pathname === "/api/job/start" && request.method === "POST") return sendJson(response, publicJob(startJob(readText)));
  if (url.pathname === "/api/job/continue" && request.method === "POST") return sendJson(response, publicJob(continueJob(readText)));
  if (url.pathname === "/api/job/stop" && request.method === "POST") return sendJson(response, publicJob(stopJob()));
  if (url.pathname === "/api/job/reset" && request.method === "POST") return sendJson(response, publicJob(resetJob()));
  if (url.pathname === "/api/download" && request.method === "GET") return sendFile(response);
  if (url.pathname === "/api/download/issues" && request.method === "GET") {
    void sendIssues(response);
    return;
  }
  return sendStatic(response, url.pathname);
});

function sendJson(response: ServerResponse, body: PublicJob): void {
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

// Віддає готовий xlsx лише після завершеного збору.
function sendFile(response: ServerResponse): void {
  const job = publicJob(getJob());
  const filePath = xlsxPath();
  if (!job.downloadEnabled || !filePath || !fs.existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Файл ще не готовий");
    return;
  }
  response.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
  });
  fs.createReadStream(filePath).pipe(response);
}

// Віддає поточну таблицю Issues окремим xlsx, не чекаючи кінця збору.
async function sendIssues(response: ServerResponse): Promise<void> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const body = await issuesWorkbook(publicJob(getJob()).issues);
    response.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="issues-${day}.xlsx"`,
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(errorMessage(error));
  }
}

function sendStatic(response: ServerResponse, pathname: string): void {
  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.join(publicDir, fileName);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Немає сторінки");
    return;
  }
  response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "text/plain" });
  fs.createReadStream(filePath).pipe(response);
}

openBrowser()
  .then(() => {
    server.listen(port, () => {
      log("INFO", `Сторінка http://localhost:${port}`);
      resumeIfNeeded(readText);
    });
  })
  .catch((error: unknown) => {
    log("ERROR", errorMessage(error));
    process.exit(1);
  });
