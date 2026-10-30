import assert from "node:assert/strict";
import test from "node:test";
import { publicJob } from "../src/job.js";
import type { Job, JobStatus } from "../src/types.js";

// Збирає мінімальний стан збору для перевірки кнопок.
function sample(status: JobStatus): Job {
  return {
    status,
    phase: "cards",
    error: status === "error" ? "немає сторінки" : null,
    warning: null,
    percent: status === "idle" ? 0 : 12,
    statusLine: "",
    skipped: 0,
    processed: 3,
    total: 10,
    site: "petslike",
    rows: [],
    urls: null,
    next: { petslike: 1, pethouse: 2 },
    xlsxPath: null,
  };
}

test("аналіз доступний лише коли збір не іде і не стоїть на паузі", () => {
  assert.equal(publicJob(sample("idle")).analyzeEnabled, true);
  assert.equal(publicJob(sample("done")).analyzeEnabled, true);
  assert.equal(publicJob(sample("error")).analyzeEnabled, true);
  assert.equal(publicJob(sample("running")).analyzeEnabled, false);
  assert.equal(publicJob(sample("paused")).analyzeEnabled, false);
  assert.equal(publicJob(sample("error")).continueMode, true);
  assert.equal(publicJob(sample("paused")).continueMode, false);
});
