import path from "node:path";
import Tesseract from "tesseract.js";
import { errorMessage, log } from "./log.js";
import { hasRussian } from "./russian.js";

let engine: Promise<Tesseract.Worker> | null = null;
let queue: Promise<void> = Promise.resolve();
let engineFailed = false;
let reported = false;

// Готує одне розпізнавання тексту і не запускає два фото одночасно.
function getEngine(): Promise<Tesseract.Worker> {
  engine ??= Tesseract.createWorker("rus+ukr", undefined, { cachePath: path.resolve("data"), logger: () => undefined });
  return engine;
}

// Читає текст із фото товару і каже, чи є на ньому російська.
export async function photoHasRussian(imageUrl: string): Promise<boolean> {
  if (engineFailed) return false;
  const task = queue.then(() => readPhoto(imageUrl));
  queue = task.then(() => undefined, () => undefined);
  return task;
}

// Розпізнає одне фото. Якщо рушій не відкрився, далі фото не перевіряє.
async function readPhoto(imageUrl: string): Promise<boolean> {
  let worker: Tesseract.Worker;
  try {
    worker = await getEngine();
  } catch (error) {
    engineFailed = true;
    engine = null;
    if (!reported) {
      reported = true;
      log("WARN", `Перевірка фото недоступна: ${errorMessage(error)}`);
    }
    return false;
  }
  try {
    const result = await worker.recognize(imageUrl);
    return hasRussian(result.data.text || "");
  } catch {
    return false;
  }
}
