import {
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";
import { getAIHandle } from "./firebase";
import {
  deepReviewPrompt,
  moveExplanationPrompt,
  type GameSummary,
  type MoveContext,
} from "./prompts";

/**
 * Hybrid inference wrappers — the three routing modes of Firebase AI Logic:
 *
 *  - explainMove()       PREFER_ON_DEVICE: per-move explanation. Tries
 *                        Gemini Nano on-device first (private, offline,
 *                        zero cost) and falls back to cloud Gemini.
 *  - explainMoveOffline() ONLY_ON_DEVICE: strictly on-device. Throws a
 *                        typed OnDeviceUnavailableError when Nano is not
 *                        available so the UI can say so honestly instead
 *                        of silently using the cloud.
 *  - deepReview()        ONLY_IN_CLOUD: whole-game structured review;
 *                        needs long context + JSON output, cloud only.
 *
 * On-device initialisation must be triggered from a user gesture:
 * call initDeviceModel() from a click handler before the first call.
 */

const CLOUD_MODEL =
  (import.meta.env.VITE_CLOUD_MODEL as string | undefined) ??
  "gemini-2.5-flash";

export type InferenceSourceLabel = "on_device" | "in_cloud" | "unknown";

export interface AIResult {
  text: string;
  source: InferenceSourceLabel;
}

export class OnDeviceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnDeviceUnavailableError";
  }
}

let hybridModel: GenerativeModel | null = null;
let deviceModel: GenerativeModel | null = null;
let cloudModel: GenerativeModel | null = null;
let deviceInitPromise: Promise<void> | null = null;

function getHybridModel(): GenerativeModel {
  if (!hybridModel) {
    hybridModel = getGenerativeModel(getAIHandle(), {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL },
    });
  }
  return hybridModel;
}

function getDeviceModel(): GenerativeModel {
  if (!deviceModel) {
    deviceModel = getGenerativeModel(getAIHandle(), {
      mode: InferenceMode.ONLY_ON_DEVICE,
    });
  }
  return deviceModel;
}

function getCloudModel(): GenerativeModel {
  if (!cloudModel) {
    cloudModel = getGenerativeModel(getAIHandle(), {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: { model: CLOUD_MODEL },
    });
  }
  return cloudModel;
}

/**
 * Initialise the on-device model (may trigger a model download).
 * MUST be called from a user-gesture handler (click / key press).
 * Resolves quietly when on-device inference is unavailable — callers
 * learn about availability from the result source or the offline call.
 */
export async function initDeviceModel(
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (!deviceInitPromise) {
    deviceInitPromise = (async () => {
      try {
        await getHybridModel().initializeDeviceModel(onProgress);
      } catch (err) {
        console.info("[ai] on-device model not available:", err);
      }
      try {
        await getDeviceModel().initializeDeviceModel(onProgress);
      } catch (err) {
        console.info("[ai] on-device-only model not available:", err);
      }
    })();
  }
  return deviceInitPromise;
}

function sourceOf(response: { inferenceSource?: string }): InferenceSourceLabel {
  if (response.inferenceSource === "on_device") return "on_device";
  if (response.inferenceSource === "in_cloud") return "in_cloud";
  return "unknown";
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const rec = err as { status?: unknown; code?: unknown };
    if (rec.status === 429 || rec.code === 429) return true;
  }
  if (err instanceof Error) {
    return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(err.message);
  }
  return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(String(err));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(
  model: GenerativeModel,
  prompt: string,
  timeoutMs?: number,
): Promise<AIResult> {
  // Cloud calls can hit the free-tier rate limit (429); retry a few times
  // with exponential backoff (PLAN risk 4). On-device failures are not
  // rate limits, so they surface immediately on the first attempt.
  //
  // A cloud call with no timeout hangs the UI on "Thinking…" forever when
  // the network stalls (observed 2026-11-24: 4 min, no result, no error).
  // Callers that pass timeoutMs get a diagnosable error instead. On-device
  // calls deliberately pass no timeout: Nano took ~90 s on this machine.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const call = model.generateContent(prompt);
      const result =
        timeoutMs === undefined
          ? await call
          : await Promise.race([
              call,
              new Promise<never>((_resolve, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Cloud request timed out after ${timeoutMs / 1000}s with no response. ` +
                          `If the proxy is off, switch it to global mode and retry; ` +
                          `if it still fails, check App Check enforcement in Firebase Console.`,
                      ),
                    ),
                  timeoutMs,
                ),
              ),
            ]);
      return { text: result.response.text(), source: sourceOf(result.response) };
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err) || attempt === 2) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

/** Per-move explanation: on-device preferred, cloud fallback. */
export async function explainMove(ctx: MoveContext): Promise<AIResult> {
  return run(getHybridModel(), moveExplanationPrompt(ctx));
}

/** Per-move explanation that must run on-device (offline mode). */
export async function explainMoveOffline(ctx: MoveContext): Promise<AIResult> {
  try {
    const res = await run(getDeviceModel(), moveExplanationPrompt(ctx));
    return { ...res, source: "on_device" };
  } catch (err) {
    throw new OnDeviceUnavailableError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Whole-game deep review: cloud only, structured JSON in the text body. */
export async function deepReview(game: GameSummary): Promise<AIResult> {
  // 60 s is generous for Gemini 2.5 Flash (normally seconds); without it a
  // stalled connection hangs the UI indefinitely with no error to act on.
  return run(getCloudModel(), deepReviewPrompt(game), 60_000);
}
