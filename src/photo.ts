import path from "node:path";
import Tesseract from "tesseract.js";
import { errorMessage, log } from "./log.js";
import { russianHit } from "./russian.js";

let engine: Promise<Tesseract.Worker> | null = null;
let queue: Promise<void> = Promise.resolve();
let engineFailed = false;
let reported = false;

// Готує одне розпізнавання тексту і не запускає два фото одночасно.
function getEngine(): Promise<Tesseract.Worker> {
  engine ??= Tesseract.createWorker("rus+ukr", undefined, { cachePath: path.resolve("data"), logger: () => undefined });
  return engine;
}

// Читає текст із фото товару і повертає місце, де є російська.
export async function photoRussianHit(imageUrl: string): Promise<{ word: string; snippet: string } | null> {
  if (engineFailed) return null;
  const task = queue.then(() => readPhoto(imageUrl));
  queue = task.then(() => undefined, () => undefined);
  return task;
}

// Розпізнає одне фото. Якщо рушій не відкрився, далі фото не перевіряє.
async function readPhoto(imageUrl: string): Promise<{ word: string; snippet: string } | null> {
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
    return null;
  }
  try {
    const result = await worker.recognize(imageUrl);
    return russianHit(result.data.text || "");
  } catch {
    return null;
  }
}
